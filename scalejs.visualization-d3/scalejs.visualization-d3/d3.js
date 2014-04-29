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
    'scalejs.visualization-d3/treemapCustom',
    'scalejs.visualization-d3/sunburst',
    'scalejs.visualization-d3/sunburstCustom',
    'scalejs.visualization-d3/voronoi',
    'scalejs.visualization-d3/testindiv',
    'scalejs.visualization-d3/testgroup'
], function (
    core,
    ko,
    d3,
    colorbrewer,
    canvasRender,
    treemap,
    treemapCustom,
    sunburst,
    sunburstCustom,
    voronoi,
    testindiv,
    testgroup
) {
    "use strict";
    var //imports
        unwrap = ko.utils.unwrapObservable,
        isObservable = ko.isObservable,
        visualizations = {
            //treemap: treemap,
            //sunburst: sunburst,
            //voronoi: voronoi,
            //testindiv: testindiv,
            //testgroup: testgroup,
            treemapCustom: treemapCustom,
            sunburstCustom: sunburstCustom
        };

    function blankVisualization(type) {
        // Generate general error:
        var strError = "Visualization ";
        if (type !== undefined) {
            strError += "(" + type + ") ";
        }
        strError += "doesn't exist!";

        // Generate error function:
        function visualizationError(func) {
            var strFuncError = "Calling " + func + " function of undefined visualization. " + strError;
            return function () {
                console.error(strFuncError);
            };
        }

        // Return blank visualization with errors as functions:
        return {
            init: visualizationError("init"),
            update: visualizationError("update"),
            zoom: visualizationError("zoom"),
            renderEnd: visualizationError("renderEnd"),
            resize: visualizationError("resize"),
            remove: visualizationError("remove")
        };
    }

    function init(
        element,
        valueAccessor
    ) {
        var parameters = valueAccessor(),
            enableRotate = parameters.enableRotate,
            enableZoom = parameters.enableZoom || false,
            enableTouch = parameters.enableTouch || false,
            allowTextOverflow = parameters.allowTextOverflow || false,
            sunburstCustomParams = parameters.sunburstCustom || {},
            visualization,
            visualizationType,
            visualizationTypeObservable,
            json,
            dataSource,
            maxVisibleLevels,
            levelsSource,
            levels,
            idPath,
            namePath,
            childrenPath,
            areaPath,
            colorPath,
            colorPalette,
            colorScale,
            fontSize,
            fontFamily,
            fontColor,
            selectedItemPath = parameters.selectedItemPath || ko.observable([]),
            selectedItemPathObservable,
            rootScale = d3.scale.linear(),
            canvasElement,
            canvas,
            elementStyle,
            canvasWidth,
            canvasHeight,
            root,
            nodeSelected,
            zooms,
            zoomObservable,
            zoomEnabled = true, // Temporary fix to errors with NaN widths during adding/removing nodes.
            leftVal = 0,
            topVal = 0,
            rotateVal = 0,
            scaleVal = 1,
            touchHandler,
            zoomOutScale = 0.8,
            radialTotalFrac;

        // Get element's width and height:
        elementStyle = window.getComputedStyle(element);
        canvasWidth = parseInt(elementStyle.width, 10);
        canvasHeight = parseInt(elementStyle.height, 10);
        if (canvasHeight <= 0) {
            canvasHeight = 1;   // Temp fix for drawImage.
        }

        canvasElement = d3.select(element)
                        .style('overflow', 'hidden')
                        .append("canvas")
                            .attr("width", canvasWidth)
                            .attr("height", canvasHeight)
                            .node();

        function renderCallback(left, top, rotate, scale) { // Called on beginning and end of touch gestures:
            // Update transform:
            leftVal = left;
            topVal = top;
            rotateVal = rotate;
            scaleVal = scale;
            canvas.select("group")
                .attr("scaleX", scaleVal)
                .attr("scaleY", scaleVal)
                .attr("angle", rotateVal)
                .attr("left", leftVal)
                .attr("top", topVal);
            canvas.pumpRender();
        }
        function startCallback() {  // Called when user initiates a touch gesture:
            // Set Rotate State:
            visualization.enableRotate = unwrap(enableRotate) !== undefined ? unwrap(enableRotate) : visualization.enableRotateDefault;
            touchHandler.setRotateState(visualization.enableRotate);

            return {
                left: leftVal,
                top: topVal,
                rotate: rotateVal,
                scale: scaleVal
            };
        }
        function stepCallback(left, top, rotate, scale) {
            if (!visualization.enableRotate) {
                if (left > 0) {
                    left = 0;
                }
                if (top > 0) {
                    top = 0;
                }
                var right = left + scale * canvasWidth,
                    bottom = top + scale * canvasHeight;
                if (right < canvasWidth) {
                    left += canvasWidth - right;
                }
                if (bottom < canvasHeight) {
                    top += canvasHeight - bottom;
                }
            }
            if (scale < 1) {   // Bounce back:
                scale = Math.max(zoomOutScale, scale);
                // Reset transform:
                leftVal = (1 - scale) / 2 * canvasWidth;
                topVal = (1 - scale) / 2 * canvasHeight;
                rotateVal = 0;
                scaleVal = scale;
            } else {
                // Update transform:
                leftVal = left;
                topVal = top;
                rotateVal = rotate;
                scaleVal = scale;
            }
            return {
                left: leftVal,
                top: topVal,
                rotate: rotateVal,
                scale: scaleVal
            };
        }
        function endCallback(left, top, rotate, scale) {    // Called when user finishes a touch gesture:
            if (!visualization.enableRotate) {
                if (left > 0) {
                    left = 0;
                }
                if (top > 0) {
                    top = 0;
                }
                var right = left + scale * canvasWidth,
                    bottom = top + scale * canvasHeight;
                if (right < canvasWidth) {
                    left += canvasWidth - right;
                }
                if (bottom < canvasHeight) {
                    top += canvasHeight - bottom;
                }
            }
            if (scale < 1) {   // Bounce back:
                // Reset transform:
                leftVal = 0;
                topVal = 0;
                rotateVal = 0;
                scaleVal = 1;
                if (scale < zoomOutScale + (1 - zoomOutScale) / 4) {
                    selectZoom(nodeSelected.parent || nodeSelected);
                }
            } else {
                // Update transform:
                leftVal = left;
                topVal = top;
                rotateVal = rotate;
                scaleVal = scale;
            }
            return {
                left: leftVal,
                top: topVal,
                rotate: rotateVal,
                scale: scaleVal
            };
        }

        function registerTouchHandler() {
            // Check if a canvas touch plugin exists (register before initializing visualization to avoid event handler conflicts):
            if (core.canvas.touch && unwrap(enableTouch)) {
                touchHandler = core.canvas.touch({
                    canvas: canvasElement,
                    renderCallback: renderCallback,
                    startCallback: startCallback,
                    stepCallback: stepCallback,
                    endCallback: endCallback
                });
            } else {
                touchHandler = {
                    setRotateState: function () { return; },
                    remove: function () { return; }
                };
            }
        }

        registerTouchHandler();
        if (isObservable(enableTouch)) {
            enableTouch.subscribe(function () {
                touchHandler.remove();
                registerTouchHandler();
            });
        }

        // Create fabric canvas:
        canvas = canvasRender.select(canvasElement)
                    .ease(d3.ease("cubic-in-out"));
                /*d3.select(element)
                .style('overflow', 'hidden')
                .append("fabric:staticcanvas")
                    .property("renderOnAddRemove", false)
                    .property("selection", false)
                    .property("targetFindTolerance", 1)
                    .attr("width", canvasWidth)
                    .attr("height", canvasHeight);*/

        // Loop through levels to determine parameters:
        function createLevelParameters(lvlsParam) {
            // Setup temp vars:
            var colorPaletteType = Object.prototype.toString.call(colorPalette),
                // Unwrap levels:
                lvls = unwrap(lvlsParam),
                i;

            // Set colorPalette parameters:
            colorScale = d3.scale.linear();
            if (colorPaletteType === '[object Array]') {
                //colorPalette is an array:
                if (colorPalette.length === 0) {
                    // Use default palette:
                    colorPalette = colorbrewer.PuBu[3];
                } else if (colorPalette.length === 1) {
                    colorPalette = [colorPalette[0], colorPalette[0]];
                }
                colorScale.range(colorPalette);
            } else if (colorPaletteType === '[object String]') {
                // Check if colorPalette is a predefined colorbrewer array:
                if (colorbrewer[colorPalette] !== undefined) {
                    // Use specified colorbrewer palette:
                    colorScale.range(colorbrewer[colorPalette][3]);
                } else {
                    // Use default palette:
                    colorScale.range(colorbrewer.PuBu[3]);
                }
            } else {
                // Use default palette:
                colorScale.range(colorbrewer.PuBu[3]);
            }

            // Clear levels:
            levels = [];

            // Loop through all levels and parse the parameters:
            if (typeof lvls !== 'array' || lvls.length === 0) {
                levels[0] = {   // Use global parameters for the level:
                    idPath: unwrap(idPath),
                    namePath: unwrap(namePath),
                    childrenPath: unwrap(childrenPath),
                    areaPath: unwrap(areaPath),
                    colorPath: unwrap(colorPath),
                    colorPalette: unwrap(colorPalette),
                    colorScale: colorScale,
                    fontSize: unwrap(fontSize),
                    fontFamily: unwrap(fontFamily),
                    fontColor: unwrap(fontColor)
                };
            }
            for (i = 0; i < lvls.length; i += 1) {
                if (typeof lvls[i] === 'string') {
                    levels[i] = {   // Level just defines the childrenPath, use global parameters for the rest:
                        idPath: unwrap(idPath),
                        namePath: unwrap(namePath),
                        childrenPath: unwrap(lvls[i]),
                        areaPath: unwrap(areaPath),
                        colorPath: unwrap(colorPath),
                        colorPalette: unwrap(colorPalette),
                        colorScale: colorScale,
                        fontSize: unwrap(fontSize),
                        fontFamily: unwrap(fontFamily),
                        fontColor: unwrap(fontColor)
                    };
                    radialTotalFrac += 1;
                } else {
                    // Level has parameters:
                    levels[i] = {   // Use global parameters for parameters not defined:
                        idPath: unwrap(lvls[i].idPath || idPath),
                        namePath: unwrap(lvls[i].namePath || lvls[i].idPath || namePath),
                        childrenPath: unwrap(lvls[i].childrenPath || childrenPath),
                        areaPath: unwrap(lvls[i].areaPath || areaPath),
                        colorPath: unwrap(lvls[i].colorPath || colorPath),
                        fontSize: unwrap(lvls[i].fontSize || fontSize),
                        fontFamily: unwrap(lvls[i].fontFamily || fontFamily),
                        fontColor: unwrap(lvls[i].fontColor || fontColor)
                    };
                    radialTotalFrac += levels[i].radialFraction;
                    if (lvls[i].colorPalette === undefined) {
                        // Use global colorScale and Palette for this Level:
                        levels[i].colorPalette = colorPalette;
                        levels[i].colorScale = colorScale;
                    } else {
                        // Create colorScale and Palette for this Level:
                        levels[i].colorPalette = unwrap(lvls[i].colorPalette);
                        levels[i].colorScale = d3.scale.linear();

                        colorPaletteType = Object.prototype.toString.call(levels[i].colorPalette);
                        if (colorPaletteType === '[object Array]') {
                            //colorPalette is an array:
                            if (levels[i].colorPalette.length === 0) {
                                // Use default palette:
                                levels[i].colorPalette = colorPalette;
                                levels[i].colorScale = colorScale;
                            } else {
                                if (levels[i].colorPalette.length === 1) {
                                    levels[i].colorPalette = [levels[i].colorPalette[0], levels[i].colorPalette[0]];
                                }
                                levels[i].colorScale.range(levels[i].colorPalette);
                            }
                        } else if (colorPaletteType === '[object String]') {
                            // Check if colorPalette is a predefined colorbrewer array:
                            if (colorbrewer[levels[i].colorPalette] !== undefined) {
                                // Use specified colorbrewer palette:
                                levels[i].colorScale.range(colorbrewer[levels[i].colorPalette][3]);
                            } else {
                                // Use default palette:
                                levels[i].colorPalette = colorPalette;
                                levels[i].colorScale = colorScale;
                            }
                        } else {
                            // Use default palette:
                            levels[i].colorPalette = colorPalette;
                            levels[i].colorScale = colorScale;
                        }
                    }
                }
            }
        }
        // Recursively traverse json data, and build it for rendering:
        function createNodeJson(dat, lvls, ind, maxlvl) {
            var node = unwrap(dat), newNode, childNode, i, children, stepSize, lvl, color, newNode;

            if (maxlvl.value < ind) {
                maxlvl.value = ind;
            }

            if (lvls.length === 0) {    // Out of defined levels, so use global parameters for node:
                newNode = {
                    id: unwrap(node[idPath] || ''),
                    name: unwrap(node[namePath] || ''),
                    lvl: ind,
                    size: unwrap(node[areaPath] !== undefined ? node[areaPath] : 1),
                    colorSize: unwrap(node[colorPath] || 0),
                    fontSize: fontSize,
                    fontFamily: fontFamily,
                    fontColor: fontColor
                };
                if (newNode.name === nodeSelected.name) {
                    nodeSelected = newNode;
                }
                return newNode;
            }

            lvl = lvls[ind] || {
                idPath: idPath,
                namePath: namePath,
                childrenPath: childrenPath,
                areaPath: areaPath,
                colorPath: colorPath,
                colorPalette: colorPalette,
                colorScale: colorScale,
                fontSize: fontSize,
                fontFamily: fontFamily,
                fontColor: fontColor
            };

            if (node[lvl.childrenPath] === undefined) {   // Use current level parameters for node:
                newNode = {
                    id: unwrap(node[lvl.idPath] || ''),
                    name: unwrap(node[lvl.namePath] || ''),
                    lvl: ind,
                    size: unwrap(node[lvl.areaPath] !== undefined ? node[lvl.areaPath] : 1),
                    colorSize: unwrap(node[lvl.colorPath] || 0),
                    fontSize: unwrap(lvl.fontSize),
                    fontFamily: unwrap(lvl.fontFamily),
                    fontColor: unwrap(lvl.fontColor)
                };
                if (newNode.name === nodeSelected.name) {
                    nodeSelected = newNode;
                }
                return newNode;
            }

            // Set default properties of node with children:
            newNode = {
                id: unwrap(node[lvl.idPath] || ''),
                name: unwrap(node[lvl.namePath] || ''),
                lvl: ind,
                children: [],
                childrenReference: [],
                size: unwrap(node[lvl.areaPath] !== undefined ? node[lvl.areaPath] : 1),
                colorSize: unwrap(node[lvl.colorPath] || 0),
                colorScale: d3.scale.linear(),
                fontSize: unwrap(lvl.fontSize),
                fontFamily: unwrap(lvl.fontFamily),
                fontColor: unwrap(lvl.fontColor),
                minSize: 0,
                maxSize: 1,
                minColor: 0,
                maxColor: 1
            };
            if (newNode.name === nodeSelected.name) {
                nodeSelected = newNode;
            }

            // Node has children, so set them up first:
            children = unwrap(node[lvl.childrenPath]);
            for (i = 0; i < children.length; i += 1) {
                childNode = createNodeJson(children[i], lvls, ind + 1, maxlvl); // Get basic node-specific properties
                childNode.parent = newNode; // Set node's parent
                childNode.index = i;    // Set node's index to match the index it appears in the original dataset.

                // Update the parent's overall size:
                if (node[lvl.areaPath] === undefined) {
                    newNode.size += childNode.size; // If parent has no size, default to adding child colors.
                }

                // Update the parent's overall color:
                if (node[lvl.colorPath] === undefined) {
                    newNode.colorSize += childNode.colorSize;   // If parent has no color, default to adding child colors.
                }

                // Update min and max properties:
                if (i) {
                    // Update min and max values: 
                    newNode.minSize = Math.min(newNode.minSize, childNode.size);
                    newNode.maxSize = Math.max(newNode.maxSize, childNode.size);
                    newNode.minColor = Math.min(newNode.minColor, childNode.colorSize);
                    newNode.maxColor = Math.max(newNode.maxColor, childNode.colorSize);
                } else {
                    // Insure min and max values are different if there is only one child:
                    newNode.minSize = childNode.size;
                    newNode.maxSize = childNode.size + 1;
                    newNode.minColor = childNode.colorSize;
                    newNode.maxColor = childNode.colorSize + 1;
                }

                // Add node to parent's children and childrenReference arrays:
                newNode.children[i] = childNode;
                // d3 reorganizes the children later in the code, so the following array is used to preserve children order for indexing:
                newNode.childrenReference[i] = childNode;
            }

            // Set parent node's colorScale range (Palette):
            if (lvls.length <= ind + 1) {    // Set to global Palette:
                newNode.colorScale.range(colorScale.range());
            } else {    // Set to node's Level color Palette:
                newNode.colorScale.range(lvls[ind + 1].colorScale.range());
            }
            // Set domain of color values:
            stepSize = (newNode.maxColor - newNode.minColor) / Math.max(newNode.colorScale.range().length - 1, 1);
            newNode.colorScale.domain(d3.range(newNode.minColor, newNode.maxColor + stepSize, stepSize));

            // Set children's colors:
            for (i = 0; i < children.length; i += 1) {
                color = newNode.colorScale(newNode.children[i].colorSize);
                newNode.children[i].color = color;
                newNode.childrenReference[i].color = color; //Needed? This should be an object reference anyway...
            }

            return newNode;
        }
        json = ko.computed(function () {
            var maxlvl = { value: 0 }, stepSize;
            // Get parameters (or defaults values):
            maxVisibleLevels = unwrap(parameters.maxVisibleLevels || 2);
            dataSource = unwrap(parameters.data) || { name: "Empty" };
            levelsSource = unwrap(parameters.levels) || [{}];
            idPath = unwrap(parameters.idPath) || 'id';
            namePath = unwrap(parameters.namePath) || idPath;
            childrenPath = unwrap(parameters.childrenPath) || 'children';
            areaPath = unwrap(parameters.areaPath) || 'area';
            colorPath = unwrap(parameters.colorPath) || 'color';
            colorPalette = unwrap(parameters.colorPalette) || 'PuBu';
            fontSize = unwrap(parameters.fontSize) || 11;
            fontFamily = unwrap(parameters.fontFamily) || "Times New Roman";
            fontColor = unwrap(parameters.fontColor) || "#000";


            // Create copy of data in a easy structure for d3:
            createLevelParameters(levelsSource);
            if (!nodeSelected) {
                nodeSelected = {
                    name: null
                };
            } else {
                nodeSelected.old = true;
            }
            root = createNodeJson(dataSource, levels, 0, maxlvl, 0);
            if (nodeSelected.name !== null && !nodeSelected.old) {
                root.curLevel = nodeSelected.lvl;
                root.curMaxLevel = nodeSelected.lvl + maxVisibleLevels - 1;
            } else {
                nodeSelected = root;
                root.curLevel = 0;
                root.curMaxLevel = maxVisibleLevels - 1;
            }
            root.maxlvl = maxlvl.value;
            root.maxVisibleLevels = maxVisibleLevels;
            root.radialTotalFrac = radialTotalFrac;
            root.levels = levels;

            // Setup colorscale for the root:
            rootScale = d3.scale.linear()
                        .range(levels[0].colorScale.range());
            stepSize = 2 / Math.max(rootScale.range().length - 1, 1);
            rootScale.domain(d3.range(root.colorSize - stepSize / 2, root.colorSize + stepSize / 2, stepSize));

            // Set root's color:
            root.color = rootScale(root.colorSize);

            // Return the new json data:
            return root;
        });
        selectedItemPathObservable = ko.computed(function () {
            return unwrap(selectedItemPath);
        });

        // Zoom after click, and set the path:
        function selectZoom(d) {
            var path = [],
                dTmp,
                oldSelected = nodeSelected;

            // Only zoom if enabled:
            if (unwrap(enableZoom)) {
                if (visualization.enableRootZoom && d === oldSelected) {    // Reset path since item was already selected.
                    d = root;
                }

                if (d !== oldSelected) {
                    // Reset transform:
                    leftVal = 0;
                    topVal = 0;
                    rotateVal = 0;
                    scaleVal = 1;
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

                nodeSelected = dTmp = d;
                // Set selected node for use in calculating the max depth.
                root.curLevel = nodeSelected.lvl;
                root.curMaxLevel = nodeSelected.lvl + root.maxVisibleLevels - 1;
                // Check if selectedItemPath is an observable:
                if (isObservable(selectedItemPath)) {   // Path is an observable, so set path to the selected item:
                    while (dTmp.parent !== undefined) {
                        path.unshift(dTmp.index);
                        dTmp = dTmp.parent;
                    }
                    selectedItemPath(path);
                } else {    // Path is not an observable, so no need to push an update to it.
                    visualization.zoom(nodeSelected);
                }
            }

            // Prevent event from firing more than once:
            if (d3.event) {
                d3.event.stopPropagation();
            }
        }
        // Subscribe to selectedItemPath changes from outside of the extension (and then zoom):
        selectedItemPathObservable.subscribe(function (path) {
            var d = json(), i;
            if (Object.prototype.toString.call(path) === '[object Array]') {
                for (i = 0; i < path.length; i += 1) {
                    if (d.childrenReference === undefined) {
                        d = json(); // Path doesn't exist, so reset path.
                        break;
                    }
                    if (d.childrenReference[path[i]] === undefined) {
                        d = json(); // Path doesn't exist, so reset path.
                        break;
                    }
                    d = d.childrenReference[path[i]];
                }
            }
            // Verify d exists:
            if (d) {
                nodeSelected = d;       // Set nodeSelected to d
                root.curLevel = nodeSelected.lvl;
                root.curMaxLevel = nodeSelected.lvl + root.maxVisibleLevels - 1;
                if (zoomEnabled) {
                    visualization.zoom(nodeSelected);    // Animate zoom effect
                }
            }
        });

        visualizationTypeObservable = ko.computed(function () {
            visualizationType = parameters.visualization || ko.observable("");
            return unwrap(visualizationType);
        });

        // Retrieve new visualization type:
        visualizationType = visualizationTypeObservable();
        if (visualizations[visualizationType] !== undefined) {
            visualization = visualizations[visualizationType]();
        } else {
            // Visualization doesn't exist, so create blank visualization:
            visualization = blankVisualization(visualizationType);
        }
        // Run visualization's initialize code:
        visualization.allowTextOverflow = unwrap(allowTextOverflow);
        visualization.init(parameters, canvas, canvasWidth, canvasHeight, json, selectZoom, nodeSelected, element);
        // Start rendering the canvas
        canvas.startRender();
        canvas.pumpRender();

        // Subscribe to allowTextOverflow changes:
        if (isObservable(allowTextOverflow)) {
            allowTextOverflow.subscribe(function () {
                visualization.allowTextOverflow = unwrap(allowTextOverflow);
                visualization.update(nodeSelected);
            });
        }

        // Subscribe to visualization type changes:
        visualizationTypeObservable.subscribe(function () {
            // Remove visualization:
            visualization.remove();

            // Retrieve new visualization type:
            visualizationType = visualizationTypeObservable();
            if (visualizations[visualizationType] !== undefined) {
                visualization = visualizations[visualizationType]();
            } else {
                // Visualization doesn't exist, so create blank visualization:
                visualization = blankVisualization(visualizationType);
            }

            // Set selected node to the root of the treemap:
            /*nodeSelected = root;
            root.curLevel = nodeSelected.lvl;
            root.curMaxLevel = nodeSelected.lvl + root.maxVisibleLevels - 1;
            // Set default selected item (do this after the data is set, and before modifying attributes):
            if (isObservable(selectedItemPath)) {
                selectedItemPath([]);
            }*/

            // Reset transform:
            leftVal = 0;
            topVal = 0;
            rotateVal = 0;
            scaleVal = 1;

            // Run visualization's initialize code:
            visualization.allowTextOverflow = unwrap(allowTextOverflow);
            visualization.init(parameters, canvas, canvasWidth, canvasHeight, json, selectZoom, nodeSelected, element);
            canvas.pumpRender();
        });

        function update() {
            // Set selected node to the root of the treemap:
            //nodeSelected = root;
            //root.curLevel = nodeSelected.lvl;
            //root.curMaxLevel = nodeSelected.lvl + root.maxVisibleLevels - 1;

            // Set default selected item (do this after the data is set, and before modifying attributes):
            zoomEnabled = false;
            var dTmp = nodeSelected,
                path = [];
            if (isObservable(selectedItemPath)) {
                while (dTmp.parent !== undefined) {
                    path.unshift(dTmp.index);
                    dTmp = dTmp.parent;
                }
                selectedItemPath(path);
            }   // selectedItemPath is reset here to prevent errors in zooming, need to reorder later.
            zoomEnabled = true;

            // Update visualization:
            visualization.update(nodeSelected);
            canvas.pumpRender();
        }

        // Subscribe to data changes:
        json.subscribe(function () {
            update();   // Re-render on change
        });

        // Check if a layout plugin exists:
        if (core.layout) {
            // Add event listener for on layout change:
            core.layout.onLayoutDone(function () {
                // Get element's width and height:
                elementStyle = window.getComputedStyle(element);
                canvasWidth = parseInt(elementStyle.width, 10);
                canvasHeight = parseInt(elementStyle.height, 10);
                if (canvasHeight <= 0) {
                    canvasHeight = 1;   // Temp fix for drawImage.
                }

                // Resize canvas:
                canvas.attr('width', canvasWidth);
                canvas.attr('height', canvasHeight);

                // Reset transform:
                leftVal = 0;
                topVal = 0;
                rotateVal = 0;
                scaleVal = 1;
                canvas.select("group")
                    .attr("scaleX", scaleVal)
                    .attr("scaleY", scaleVal)
                    .attr("angle", rotateVal)
                    .attr("left", leftVal)
                    .attr("top", topVal);

                // Call visualization's resize function to handle resizing internally:
                visualization.resize(canvasWidth, canvasHeight);
                // Update the visualization:
                //nodeSelected = root;
                //root.curLevel = nodeSelected.lvl;
                //root.curMaxLevel = nodeSelected.lvl + root.maxVisibleLevels - 1;
                visualization.update(nodeSelected);
                canvas.pumpRender();
            });
        }

        // Subscribe to zoomPath changes:
        zoomObservable = ko.computed(function () {
            zooms = parameters.scale || ko.observable(1);
            return unwrap(zooms);
        });
        zoomObservable.subscribe(function (val) {
            visualization.scale(val);
            canvas.pumpRender();
        });
    }

    return {
        init: init
    };
});
