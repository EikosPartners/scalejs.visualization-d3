/*global define*/
/*jslint devel: true */
/*jslint browser: true */
define([
    'scalejs!core',
    'knockout',
    'd3',
    'd3.colorbrewer',
    'scalejs.canvas',
    'scalejs.visualization-d3/treemap',
    'scalejs.visualization-d3/sunburst'
], function (
    core,
    ko,
    d3,
    colorbrewer,
    canvasRender,
    treemap,
    sunburst
) {
    "use strict";
    var //imports
        observable = ko.observable,
        computed = ko.computed,
        unwrap = ko.utils.unwrapObservable,
        isObservable = ko.isObservable,
        visualizations = {
            treemap: treemap,
            sunburst: sunburst
        },
        sortByFuncs = {
            unordered: function (a, b) { return a.index - b.index; },
            ascendingSize: function (a, b) { return a.size - b.size; },
            descendingSize: function (a, b) { return b.size - a.size; }
        };

    function blankVisualization(type) {
        // Generate error function:
        function visualizationError(func) {
            var strFuncError = "Calling " + func + " function of undefined visualization. Visualization (" + type + ") doesn't exist!";
            return function () { console.error(strFuncError); };
        }

        // Return blank visualization with errors as functions:
        return {
            init: visualizationError("init"),
            update: visualizationError("update"),
            resize: visualizationError("resize"),
            remove: visualizationError("remove")
        };
    }

    function init(
        element,
        valueAccessor
    ) {
        var parameters = valueAccessor(),
            triggerTime = parameters.triggerTime == null || 10,
            enableRotate = parameters.enableRotate,
            enableZoom = parameters.enableZoom || false,
            enableTouch = parameters.enableTouch || false,
            allowTextOverflow = parameters.allowTextOverflow || false,
            visualization,
            visualizationType = isObservable(parameters.visualization) ? parameters.visualization : observable(parameters.visualization),
            visualizationParams, // visualization specific parameters may be passed
            json,
            globals = {},
            zoomedItemPath = isObservable(parameters.zoomedItemPath) ? parameters.zoomedItemPath : observable(parameters.zoomedItemPath),
            selectedItemPath = isObservable(parameters.selectedItemPath) ? parameters.selectedItemPath : observable(parameters.selectedItemPath),
            heldItemPath = isObservable(parameters.heldItemPath) ? parameters.heldItemPath : observable(parameters.heldItemPath),
            nodeScale = d3.scale.linear(),
            canvasElement,
            canvas,
            elementStyle,
            canvasWidth,
            canvasHeight,
            root,
            zoomedNode = {
                id: null
            },
            transform = {
                left: 0,
                top: 0,
                rotate: 0,
                scale: 1
            },
            touchHandler,
            zoomOutScale = 0.8,
            disposeLayout;

        // Attempts to find a node when given a path
        // 1. If the Path is found, it returns the node
        // 2. If the Path does not exist, it returns undefined
        // 3. If the Path has a length of 0, it returns the root node
        // 4. If the Path is not an array, it returns undefined
        function getNode(path) {
            var curNode = json();
            if (path instanceof Array) {
                for (var i = 0; i < path.length; i += 1) {
                    if (curNode.childrenReference[path[i]] === undefined) {
                        return;
                    }
                    curNode = curNode.childrenReference[path[i]];
                }
                return curNode;
            }
            return;
        }

        // Subscribe to zoomedItemPath changes, verify path and then zoom:
        zoomedItemPath.subscribe(function (path) {
            var node = getNode(path);
            // even if there is no node, the zoom must still be set to something
            if (!node) {
                zoomedItemPath([]);
                // if there is no node, that means our zoomed node is the root
                node = json();
            }
            if (node) {
                zoomedNode = node;
                root.curLevel = zoomedNode.lvl;
                root.curMaxLevel = zoomedNode.lvl + root.maxVisibleLevels - 1;
                visualization.update(zoomedNode);    // Animate zoom effect
            }
        });

        // Subscribe to selectedItemPath changes from outside:
        selectedItemPath.subscribe(function (path) {
            // if there is no node, there is no path
            if (!getNode(path)) {
                selectedItemPath(undefined);
            }
        });

        // Get element's width and height:
        elementStyle = window.getComputedStyle(element);
        // Get width and height. Must be >= 1 pixel in order for d3 to calculate layouts properly:
        canvasWidth = parseInt(elementStyle.width, 10);
        canvasWidth = canvasWidth >= 1 ? canvasWidth : 1;
        canvasHeight = parseInt(elementStyle.height, 10);
        canvasHeight = canvasHeight >= 1 ? canvasHeight : 1;

        canvasElement = d3.select(element)
                        .style('overflow', 'hidden')
                        .append("canvas")
                            .attr("width", canvasWidth)
                            .attr("height", canvasHeight)
                            .node();

        // Clear the canvas's transform and animate from current to cleared state:
        function resetTransformAnimation() {
            // Reset target transform:
            transform.left = 0;
            transform.top = 0;
            transform.rotate = 0;
            transform.scale = 1;
            canvas.select("group").transition().duration(1000)
                .tween("canvasTween", function () {
                    // Create interpolations used for a nice slide around the parent:
                    var interpLeft = d3.interpolate(this.left, 0),
                        interpTop = d3.interpolate(this.top, 0),
                        interpAngle = d3.interpolate(this.angle, 0),
                        interpScaleX = d3.interpolate(this.scaleX, 1),
                        interpScaleY = d3.interpolate(this.scaleY, 1),
                        el = this;
                    return function (t) {
                        el.left = interpLeft(t);
                        el.top = interpTop(t);
                        el.angle = interpAngle(t);
                        el.scaleX = interpScaleX(t);
                        el.scaleY = interpScaleY(t);
                    };
                });
        }

        // This function resets the selected node:
        function selectRelease() {
            // Reset selectedItemPath:
            heldItemPath(undefined);
        }

        // This function sets the selected node:
        function selectTouch(node) {
            var path = [],
                tmpNode = node;
            // Set selectedItemPath:
            while (tmpNode.parent !== undefined) {
                path.unshift(tmpNode.index);
                tmpNode = tmpNode.parent;
            }
            selectedItemPath(path);
        }

        // This function sets the held node:
        function selectHeld(node) {
            var path = [],
                tmpNode = node;
            // Set heldItemPath:
            while (tmpNode.parent !== undefined) {
                path.unshift(tmpNode.index);
                tmpNode = tmpNode.parent;
            }
            heldItemPath(path);
        }

        // Zoom after click, and set the path:
        function selectZoom(node) {
            var path = [],
                tmpNode,
                curZoomedNode = zoomedNode;

            // Only zoom if enabled:
            if (unwrap(enableZoom)) {
                if (visualization.enableRootZoom && node === curZoomedNode) {    // Reset path since item was already selected.
                    node = root;
                }

                if (node !== curZoomedNode) {
                    // Reset transform:
                    resetTransformAnimation();
                }

                zoomedNode = tmpNode = node;
                // Set selected node for use in calculating the max depth.
                root.curLevel = zoomedNode.lvl;
                root.curMaxLevel = zoomedNode.lvl + root.maxVisibleLevels - 1;

                // Set zoomedItemPath:
                while (tmpNode.parent !== undefined) {
                    path.unshift(tmpNode.index);
                    tmpNode = tmpNode.parent;
                }
                zoomedItemPath(path);
            }

            // Prevent event from firing more than once:
            if (d3.event) {
                d3.event.stopPropagation();
            }
        }

        // The following set of callbacks are for the pinch&zoom touch handler:
        function renderCallback(left, top, rotate, scale) { // Called on beginning and end of touch gestures:
            // Update transform:
            transform.left = left;
            transform.top = top;
            transform.rotate = rotate;
            transform.scale = scale;
            canvas.select("group")
                .attr("scaleX", transform.scale)
                .attr("scaleY", transform.scale)
                .attr("angle", transform.rotate)
                .attr("left", transform.left)
                .attr("top", transform.top);
            canvas.pumpRender();
        }
        
        function startCallback() {  // Called when user initiates a touch gesture:
            // Set Rotate State:
            visualization.enableRotate = unwrap(enableRotate) !== undefined ? unwrap(enableRotate) : visualization.enableRotateDefault;
            touchHandler.setRotateState(visualization.enableRotate);

            return transform;
        }

        function transformCallback(zoomOutHandler) {   // Called for every update to a touch gesture's transform (end and step):
            return function (left, top, rotate, scale) {
                // If rotate is not enabled on visualization, lock the visualization to not go off of the screen:
                if (!visualization.enableRotate) {
                    left > 0 && (left = 0);
                    top > 0 && (top = 0);
                    var right = left + scale * canvasWidth,
                        bottom = top + scale * canvasHeight;
                    right < canvasWidth && (left += canvasWidth - right);
                    bottom < canvasHeight && (top += canvasHeight - bottom);
                }
                if (scale < 1) {   // scaling is handled differently for step and end
                    zoomOutHandler(left, top, rotate, scale);
                } else {
                    // Update transform:
                    transform.left = left;
                    transform.top = top;
                    transform.rotate = rotate;
                    transform.scale = scale;
                }
                // Return updated transform to canvas-touch:
                return transform;
            }
        }

        // passed to transformCallback to create step-specific transform callback function
        function stepZoomOutHandler(left, top, rotate, scale) {
            scale = Math.max(zoomOutScale, scale);
            // Reset transform:
            transform.left = (1 - scale) / 2 * canvasWidth;
            transform.top = (1 - scale) / 2 * canvasHeight;
            transform.rotate = 0;
            transform.scale = scale;
        };

        // passed to transformCallback to create end-specific transform callback function
        function endZoomOutHandler(left, top, rotate, scale) {
            // Bounce back
            transform.left = 0;
            transform.top = 0;
            transform.rotate = 0;
            transform.scale = 1;
            if (scale < zoomOutScale + (1 - zoomOutScale) / 4) {
                // zoom to parent
                selectZoom(zoomedNode.parent || zoomedNode);
            }
        }

        function registerTouchHandler() {
            // Check if a canvas touch plugin exists (register before initializing visualization to avoid event handler conflicts):
            if (core.canvas.touch && unwrap(enableTouch)) {
                touchHandler = core.canvas.touch({
                    canvas: canvasElement,
                    renderCallback: renderCallback,
                    startCallback: startCallback,
                    stepCallback: transformCallback(stepZoomOutHandler),
                    endCallback: transformCallback(endZoomOutHandler)
                });
            } else {
                touchHandler = {
                    setRotateState: function () { return; },
                    remove: function () { return; }
                };
            }
        }

        // Register pinch&zoom extension to canvas:
        registerTouchHandler();
        if (isObservable(enableTouch)) {
            // Subscribe to changes in enableTouch to dynamically enable and disable the pinch&zoom touch handler:
            enableTouch.subscribe(function () {
                touchHandler.remove();
                registerTouchHandler();
            });
        }

        // Select canvas and set default ease function:
        // This is done after the touch handler, because select registers touch events on top of the touch handler.
        canvas = canvasRender.select(canvasElement).ease(d3.ease("cubic-in-out"));

        // Sets each parameter in globals to the parameter or to a default value:
        function setGlobalParameters() {
            globals.idPath = unwrap(parameters.idPath) || 'id';
            globals.namePath = unwrap(parameters.namePath) || globals.idPath;
            globals.childrenPath = unwrap(parameters.childrenPath) || 'children';
            globals.areaPath = unwrap(parameters.areaPath) || 'area';
            globals.colorPath = unwrap(parameters.colorPath) || 'color';
            globals.colorPalette = unwrap(parameters.colorPalette) || 'PuBu';
            globals.fontSize = unwrap(parameters.fontSize) || 11;
            globals.fontFamily = unwrap(parameters.fontFamily) || "Times New Roman";
            globals.fontColor = unwrap(parameters.fontColor) || "#000";

            // Set global colorPalette (array, undefined or string) parameters:
            if (globals.colorPalette instanceof Array) {
                if (globals.colorPalette.length === 1) globals.colorPalette[1] = globals.colorPalette[0];
            } else {
                globals.colorPalette = colorbrewer[globals.colorPalette][3];
            }
        }

        // Loop through levels to parse parameters:
        function parseLevelParameters(lvls) {
            // Clear levels:
            var levels = [];

            // Loop through all levels and parse the parameters:
            for (var i = 0; i < lvls.length; i += 1) {
                var l = lvls[i];
                if (l instanceof Object) {
                    // Level has parameters, or use globals
                    levels[i] = {   
                        idPath:         unwrap(l.idPath)                || globals.idPath,
                        namePath:       unwrap(l.namePath || l.idPath)  || globals.namePath,
                        childrenPath:   unwrap(l.childrenPath)          || globals.childrenPath,
                        areaPath:       unwrap(l.areaPath)              || globals.areaPath,
                        colorPath:      unwrap(l.colorPath)             || globals.colorPath,                        
                        fontSize:       unwrap(l.fontSize)              || globals.fontSize,
                        fontFamily:     unwrap(l.fontFamily)            || globals.fontFamily,
                        fontColor:      unwrap(l.fontColor)             || globals.fontColor,
                        colorPalette:   unwrap(l.colorPalette)          // more processing below
                    };

                    // Set level's colorPalette (array, undefined or string) and colorScale parameters:
                    // A new scale must be created for every new colorPalette, eg array or string.
                    if (levels[i].colorPalette instanceof Array) {
                        if (levels[i].colorPalette.length === 1) levels[i].colorPalette[1] = levels[i].colorPalette[0];
                    } else if (levels[i].colorPalette == null) {    // Catch if null or undefined
                        levels[i].colorPalette = globals.colorPalette;
                    } else {
                        levels[i].colorPalette = colorbrewer[levels[i].colorPalette][3];
                    }
                } else {
                    levels[i] = {   // l defines the childrenPath, use global parameters for the rest:
                        childrenPath:   l || globals.childrenPath,
                        idPath:         globals.idPath,
                        namePath:       globals.namePath,
                        areaPath:       globals.areaPath,
                        colorPath:      globals.colorPath,
                        colorPalette:   globals.colorPalette,
                        fontSize:       globals.fontSize,
                        fontFamily:     globals.fontFamily,
                        fontColor:      globals.fontColor
                    };
                }
            }
            return levels;
        }
        
        // Recursively traverse json data, and build it for rendering:
        function createNodeJson(node, levelConfig, index, maxlvl) {
            var childNode, children, stepSize, color,
                lvl = levelConfig[index] || globals, 
                newNode = {
                    id:         node[lvl.idPath] || '',
                    name:       node[lvl.namePath] || '',
                    lvl:        index,
                    size:       node[lvl.areaPath] !== undefined ? node[lvl.areaPath] : 1,
                    colorSize:  node[lvl.colorPath] || 0,
                    fontSize:   lvl.fontSize,
                    fontFamily: lvl.fontFamily,
                    fontColor:  lvl.fontColor
                };

            if (newNode.id === zoomedNode.id) zoomedNode = newNode; // If node is the current zoomed node, update the zoomed node reference:

            // Check if leaf node:
            if (!node[lvl.childrenPath]) {
                if (maxlvl.value < index) maxlvl.value = index; // Update the max depth to the leaf's depth (if deeper than maxlvl's value):
                return newNode;
            }

            // Set default properties of node with children:
            newNode.children = [];
            newNode.childrenReference = [];

            // Node has children, so set them up first:
            children = node[lvl.childrenPath];
            for (var i = 0; i < children.length; i += 1) {
                childNode = createNodeJson(children[i], levelConfig, index + 1, maxlvl); //recursion
                childNode.parent = newNode;
                childNode.index = i;    // Set node's index to match the index it appears in the original dataset.

                if (node[lvl.areaPath] === undefined) newNode.size += childNode.size; // If parent has no size, default to adding child colors.

                if (node[lvl.colorPath] === undefined) newNode.colorSize += childNode.colorSize;   // If parent has no color, default to adding child colors.

                newNode.minSize = Math.min(newNode.minSize || childNode.size, childNode.size);
                newNode.maxSize = Math.max(newNode.maxSize || childNode.size + 1, childNode.size);
                newNode.minColor = Math.min(newNode.minColor || childNode.colorSize, childNode.colorSize);
                newNode.maxColor = Math.max(newNode.maxColor || childNode.colorSize + 1, childNode.colorSize);

                // d3 reorganizes the children later in the code, so the following array is used to preserve children order for indexing:
                newNode.children[i] = newNode.childrenReference[i] = childNode;
            }

            nodeScale.range(levelConfig.length <= index + 1 ? globals.colorPalette : levelConfig[index + 1].colorPalette);
            // Set domain of color values:
            stepSize = (newNode.maxColor - newNode.minColor) / Math.max(nodeScale.range().length - 1, 1);
            nodeScale.domain(d3.range(newNode.minColor, newNode.maxColor + stepSize, stepSize));

            for (var i = 0; i < children.length; i += 1) newNode.children[i].color = nodeScale(newNode.children[i].colorSize);

            return newNode;
        }
        json = ko.computed(function () {
            var maxlvl = { value: 0 }, stepSize,
                // Get parameters (or defaults values):
                sortByParam = unwrap(parameters.sortBy) || "unordered",
                maxVisibleLevels = unwrap(parameters.maxVisibleLevels || 2),
                dataSource = unwrap(parameters.data) || { name: "Empty" },
                levelsSource = unwrap(parameters.levels) || [{}],
                levels;

            setGlobalParameters();

            // Create copy of data in a easy structure for d3:
            levels = parseLevelParameters(levelsSource);
            // Generate Json:
            root = createNodeJson(dataSource, levels, 0, maxlvl, 0);
            // No node is zoomed to, so zoom to root:
            if (zoomedNode.id == null) zoomedNode = root;

            // Set root-specific properties:
            root.curLevel = zoomedNode.lvl;
            root.curMaxLevel = zoomedNode.lvl + maxVisibleLevels - 1;
            root.maxlvl = maxlvl.value;
            root.maxVisibleLevels = maxVisibleLevels;
            root.levels = levels;
            root.index = 0;

            // Set root's sortBy function used to sort nodes.
            if (sortByParam instanceof Function) {
                root.sortBy = sortByParam;
            } else if (sortByFuncs[sortByParam]) {
                root.sortBy = sortByFuncs[sortByParam];
            } else {
                root.sortBy = sortByParam.unordered;
            }

            // Setup colorscale for the root:
            nodeScale.range(levels[0].colorPalette);
            stepSize = 2 / Math.max(nodeScale.range().length - 1, 1);
            nodeScale.domain(d3.range(root.colorSize - stepSize / 2, root.colorSize + stepSize / 2, stepSize));

            // Set root's color:
            root.color = nodeScale(root.colorSize);

            visualizationParams = unwrap(parameters[visualizationType.peek()]);

            // Return the new json data:
            return root;
        }).extend({ throttle: triggerTime });;

        // Change/Set visualization:
        function setVisualization(type) {
            // Retrieve new visualization type, and fail gracefully:
            if (visualizations[type] != null) visualization = visualizations[type]();
            else visualization = blankVisualization(type);

            // Reset transform:
            transform.left = 0;
            transform.top = 0;
            transform.rotate = 0;
            transform.scale = 1;

            // Run visualization's initialize code:
            visualization.allowTextOverflow = unwrap(allowTextOverflow);
            visualization.parameters = computed(function () {
                return unwrap(parameters[type]);
            });//visualizationParams;
            visualization.init(parameters, canvas, canvasWidth, canvasHeight, json, selectTouch, selectZoom, selectHeld, selectRelease, zoomedNode, element);
        }

        // Initialize visualization:
        setVisualization(visualizationType());

        // Subscribe to allowTextOverflow changes:
        if (isObservable(allowTextOverflow)) {
            allowTextOverflow.subscribe(function () {
                visualization.allowTextOverflow = unwrap(allowTextOverflow);
                visualization.update(zoomedNode);
            });
        }

        // Subscribe to visualization type changes:
        visualizationType.subscribe(function (type) {
            visualization.remove();
            setVisualization(type);
        });
        
        // Subscribe to data changes:
        json.subscribe(function () {
            //visualization.parameters = visualizationParams;
            visualization.update(zoomedNode);
        });

        // Check if a layout plugin exists:
        if (core.layout) {
            // Add event listener for on layout change:
            disposeLayout = core.layout.onLayoutDone(function () {
                var lastWidth = canvasWidth,
                    lastHeight = canvasHeight;
                elementStyle = window.getComputedStyle(element);
                // Get width and height. Must be >= 1 pixel in order for d3 to calculate layouts properly:
                canvasWidth = parseInt(elementStyle.width, 10);
                canvasWidth = canvasWidth >= 1 ? canvasWidth : 1;
                canvasHeight = parseInt(elementStyle.height, 10);
                canvasHeight = canvasHeight >= 1 ? canvasHeight : 1;
                if (canvasWidth === lastWidth && canvasHeight === lastHeight) return;

                canvas.attr('width', canvasWidth);
                canvas.attr('height', canvasHeight);
                visualization.resize(canvasWidth, canvasHeight);
                // Must set width and height before doing any animation (to calculate layouts properly):
                resetTransformAnimation();
                visualization.update(zoomedNode);
            });
            ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
                disposeLayout();
                disposeLayout = undefined;
            });
        }
    }

    return {
        init: init
    };
});
