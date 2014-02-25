/*global define*/
/*jslint devel: true */
/*jslint browser: true */
define([
    'scalejs!core',
    'knockout',
    'd3',
    'd3.colorbrewer',
    'hammer',
    'scalejs.visualization-d3/treemap',
    'scalejs.visualization-d3/sunburst',
    'scalejs.visualization-d3/voronoi',
    'scalejs.visualization-d3/zoom',
    'scalejs.visualization-d3/scale',
    'scalejs.visualization-d3/offscreen1',
    'scalejs.visualization-d3/offscreen2'
], function (
    core,
    ko,
    d3,
    colorbrewer,
    hammer,
    treemap,
    sunburst,
    voronoi,
    zoom,
    scale,
    offscreen1,
    offscreen2
) {
    "use strict";
    var //imports
        unwrap = ko.utils.unwrapObservable,
        isObservable = ko.isObservable,
        visualizations = {
            treemap: treemap,
            sunburst: sunburst,
            voronoi: voronoi,
            zoom: zoom,
            scale: scale,
            offscreen1: offscreen1,
            offscreen2: offscreen2
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
            visualization,
            visualizationType,
            visualizationTypeObservable,
            json,
            dataSource,
            levelsSource,
            levels,
            childrenPath,
            areaPath,
            colorPath,
            colorPalette,
            colorScale,
            selectedItemPath,
            selectedItemPathObservable,
            rootScale = d3.scale.linear(),
            canvas,
            canvasElement,  // Holds the lower canvas of fabric.
            canvasShow,     // Holds the canvas used to display objects on the user's screen.
            canvasRender,   // Holds the offscreen buffer canvas used to hold a snapshot of the visualization for zooming.
            context,        // Holds canvasShow's 2d context.
            hammerObj,      // Holds touch event system.
            elementStyle,
            canvasWidth,
            canvasHeight,
            root,
            nodeSelected,
            zooms,
            zoomObservable,
            zoomEnabled = true, // Temporary fix to errors with NaN widths during adding/removing nodes.
            //left = 0,
            //top = 0,
            leftVal = 0,
            topVal = 0,
            rotateVal = 0,
            scaleVal = 1,
            //lastEvent,
            //lastGesture,
            lastTouches,
            lastCenter;

        // Get element's width and height:
        elementStyle = window.getComputedStyle(element);
        canvasWidth = parseInt(elementStyle.width, 10);
        canvasHeight = parseInt(elementStyle.height, 10);
        if (canvasHeight <= 0) {
            canvasHeight = 1;   // Temp fix for drawImage.
        }

        // Create fabric canvas:
        canvas = d3.select(element)
                .style('overflow', 'hidden')
                .append("fabric:canvas")
                    .property("renderOnAddRemove", false)
                    .property("selection", false)
                    .property("targetFindTolerance", 1)
                    .attr("width", canvasWidth)
                    .attr("height", canvasHeight);

        // Create zoom canvas, and offscreen buffer canvas:
        canvasElement = canvas.domNode()[0][0];
        canvasShow = d3.select(canvas[0][0].parentNode)
            .append("canvas")
                .style("position", "absolute")
                .style("left", 0)
                .style("top", 0)
                .attr("width", canvasWidth)
                .attr("height", canvasHeight)
                .style("display", "none");
        context = canvasShow[0][0].getContext('2d');
        canvasRender = document.createElement("canvas");
        canvasRender.width = canvasWidth;
        canvasRender.height = canvasHeight;

        // Function to buffer fabric canvas for pinch and zoom feature:
        function renderFront(back) {
            context.setTransform(1, 0, 0, 1, 0, 0);
            if (!back) {
                context.clearRect(0, 0, canvasWidth, canvasHeight);
                context.drawImage(canvasElement, 0, 0);
            }
            canvasRender.getContext('2d').clearRect(0, 0, canvasWidth, canvasHeight);
            canvasRender.getContext('2d').drawImage(canvasElement, 0, 0);
            canvasElement.getContext('2d').clearRect(0, 0, canvasWidth, canvasHeight);
        }

        // Function to update canvases:
        function updateCan() {
            canvas.select("group")
                    .attr("scaleX", 1)//scaleVal
                    .attr("scaleY", 1)//scaleVal
                    .attr("angle", 0)//rotateVal
                    .attr("left", 0)//leftVal
                    .attr("top", 0);//topVal
            canvas.pumpRender();
            renderFront(true);

            canvas.select("group")
                .attr("scaleX", scaleVal)
                .attr("scaleY", scaleVal)
                .attr("angle", rotateVal)
                .attr("left", leftVal)
                .attr("top", topVal);

            canvas.pumpRender();
            renderFront();

            context.setTransform(1, 0, 0, 1, 0, 0);
            context.clearRect(0, 0, canvasWidth, canvasHeight);
            context.drawImage(canvasRender, 0, 0);
            canvas.select("group")
                .attr("scaleX", 1)//scaleVal
                .attr("scaleY", 1)//scaleVal
                .attr("angle", 0)//rotateVal
                .attr("left", 0)//leftVal
                .attr("top", 0);//topVal

            canvas.pumpRender();
            renderFront(true);
        }

        // Loop through levels to determine parameters:
        function createLevelParameters(lvlsParam) {
            // Setup temp vars:
            var colorPaletteType = Object.prototype.toString.call(unwrap(colorPalette)),
                // Unwrap levels:
                lvls = unwrap(lvlsParam),
                i;

            // Set colorPalette parameters:
            colorScale = d3.scale.linear();
            if (colorPaletteType === '[object Array]') {
                //colorPalette is an array:
                colorScale.range(unwrap(colorPalette));
            } else if (colorPaletteType === '[object String]') {
                // Check if colorPalette is a predefined colorbrewer array:
                if (colorbrewer[unwrap(colorPalette)] !== undefined) {
                    // Use specified colorbrewer palette:
                    colorScale.range(colorbrewer[unwrap(colorPalette)][3]);
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
                    childrenPath: unwrap(childrenPath),
                    areaPath: unwrap(areaPath),
                    colorPath: unwrap(colorPath),
                    colorPalette: unwrap(colorPalette),
                    colorScale: colorScale
                };
            }
            for (i = 0; i < lvls.length; i += 1) {
                if (typeof lvls[i] === 'string') {
                    levels[i] = {   // Level just defines the childrenPath, use global parameters for the rest:
                        childrenPath: unwrap(lvls[i]),
                        areaPath: unwrap(areaPath),
                        colorPath: unwrap(colorPath),
                        colorPalette: unwrap(colorPalette),
                        colorScale: colorScale
                    };
                } else {
                    // Level has parameters:
                    levels[i] = {   // Use global parameters for parameters not defined:
                        childrenPath: unwrap(lvls[i].childrenPath || childrenPath),
                        areaPath: unwrap(lvls[i].areaPath || areaPath),
                        colorPath: unwrap(lvls[i].colorPath || colorPath)
                    };
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
                            levels[i].colorScale.range(levels[i].colorPalette);
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
        function createNodeJson(dat, lvls, ind) {
            var node = unwrap(dat), newNode, childNode, i, children, stepSize, lvl, color;

            if (lvls.length === 0) {    // Out of defined levels, so use global parameters for node:
                return {
                    name: unwrap(node.name || ''),
                    size: unwrap(node[unwrap(areaPath)] || 1),
                    colorSize: unwrap(node[unwrap(colorPath)] || 0)
                };
            }

            lvl = lvls[ind] || {
                childrenPath: unwrap(childrenPath),
                areaPath: unwrap(areaPath),
                colorPath: unwrap(colorPath),
                colorPalette: unwrap(colorPalette),
                colorScale: colorScale
            };

            if (node[lvl.childrenPath] === undefined) {   // Use current level parameters for node:
                return {
                    name: unwrap(node.name || ''),
                    size: unwrap(node[lvl.areaPath] || 1),
                    colorSize: unwrap(node[lvl.colorPath] || 0)
                };
            }

            // Set default properties of node with children:
            newNode = {
                name: unwrap(node.name || ''),
                children: [],
                childrenReference: [],
                size: unwrap(node[lvl.areaPath] || 1),
                colorSize: unwrap(node[lvl.colorPath] || 0),
                colorScale: d3.scale.linear(),
                minSize: 0,
                maxSize: 1,
                minColor: 0,
                maxColor: 1
            };

            // Node has children, so set them up first:
            children = unwrap(node[lvl.childrenPath]);
            for (i = 0; i < children.length; i += 1) {
                childNode = createNodeJson(children[i], lvls, ind + 1); // Get basic node-specific properties
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
            // Get parameters (or defaults values):
            dataSource = parameters.data || { name: "Empty" };
            levelsSource = parameters.levels || [{}];
            childrenPath = parameters.childrenPath || 'children';
            areaPath = parameters.areaPath || 'area';
            colorPath = parameters.colorPath || 'color';
            colorPalette = parameters.colorPalette || 'PuBu';

            // Create copy of data in a easy structure for d3:
            createLevelParameters(levelsSource);
            root = createNodeJson(dataSource, levels, 0);

            // Setup colorscale for the root:
            rootScale = d3.scale.linear()
                        .range(levels[0].colorScale.range());
            var stepSize = 2 / Math.max(rootScale.range().length - 1, 1);
            rootScale.domain(d3.range(root.colorSize - stepSize / 2, root.colorSize + stepSize / 2, stepSize));

            // Set root's color:
            root.color = rootScale(root.colorSize);

            // Return the new json data:
            return root;
        });
        selectedItemPathObservable = ko.computed(function () {
            selectedItemPath = parameters.selectedItemPath || ko.observable([]);
            return unwrap(selectedItemPath);
        });

        // Zoom after click, and set the path:
        function selectZoom(d) {
            var path = [],
                dTmp,
                oldSelected = nodeSelected;

            if (d === oldSelected) {    // Reset path since item was already selected.
                d = root;
            }

            nodeSelected = dTmp = d;
            // Check if selectedItemPath is an observable:
            if (isObservable(selectedItemPath)) {   // Path is an observable, so set path to the selected item:
                while (dTmp.parent !== undefined) {
                    path.unshift(dTmp.index);
                    dTmp = dTmp.parent;
                }
                selectedItemPath(path);
            } else {    // Path is not an observable, so no need to push an update to it.
                visualization.zoom(d);
                //renderFront();
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
                if (zoomEnabled) {
                    visualization.zoom(d);    // Animate zoom effect
                    //renderFront();
                }
            }
        });

        visualizationTypeObservable = ko.computed(function () {
            visualizationType = parameters.visualization || ko.observable("");
            return unwrap(visualizationType);
        });
        visualizationType = visualizationTypeObservable();

        if (visualizations[visualizationType] !== undefined) {
            visualization = visualizations[visualizationType]();
        } else {
            visualization = blankVisualization(visualizationType);
        }
        // Start rendering the canvas
        canvas.startRender();
        // Run visualization's initialize code:
        visualization.init(canvas, canvasWidth, canvasHeight, json, selectZoom, element);
        canvas.pumpRender();
        visualization.renderEnd();

        // Subscribe to visualization type changes:
        visualizationTypeObservable.subscribe(function () {
            visualization.remove();
            //canvas.pumpRender();
            visualizationType = visualizationTypeObservable();

            if (visualizations[visualizationType] !== undefined) {
                visualization = visualizations[visualizationType]();
            } else {
                visualization = blankVisualization(visualizationType);
            }

            // Set selected node to the root of the treemap:
            nodeSelected = root;
            // Set default selected item (do this after the data is set, and before modifying attributes):
            if (isObservable(selectedItemPath)) {
                selectedItemPath([]);
            }

            // Reset transform:
            leftVal = 0;
            topVal = 0;
            rotateVal = 0;
            scaleVal = 1;

            // Run visualization's initialize code:
            visualization.init(canvas, canvasWidth, canvasHeight, json, selectZoom, element);
            // Start rendering the canvas
            //canvas.startRender();
            canvas.pumpRender();
            visualization.renderEnd();
        });

        function update() {
            // Set selected node to the root of the treemap:
            nodeSelected = root;

            // Set default selected item (do this after the data is set, and before modifying attributes):
            zoomEnabled = false;
            if (isObservable(selectedItemPath)) {
                selectedItemPath([]);
            }   // selectedItemPath is reset here to prevent errors in zooming, need to reorder later.
            zoomEnabled = true;

            // Update visualization:
            visualization.update();
            canvas.pumpRender();
            visualization.renderEnd();
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
                canvasShow.attr('width', canvasWidth);
                canvasShow.attr('height', canvasHeight);
                canvasRender.width = canvasWidth;
                canvasRender.height = canvasHeight;
                // Call visualization's resize function to handle resizing internally:
                visualization.resize(canvasWidth, canvasHeight);
                // Update the visualization:
                visualization.update();
                canvas.pumpRender();
                visualization.renderEnd();
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
            visualization.renderEnd();
        });

        // Function to handle touch events (for pinch and zoom):
        function touchHandler(event) {
            //console.log(event);
            if (!event.gesture) {
                return;
            }
            event.gesture.preventDefault();

            var gesture = event.gesture,
                touches = [],
                center,
                scaleDiff,
                rotateDiff,
                pagePos,
                elementPos,
                groupPos,
                rotatePos,
                scalePos,
                transPos,
                sin,
                cos,
                i;

            // Convert touches to an array (to avoid safari's reuse of touch objects):
            for (i = 0; i < gesture.touches.length; i += 1) {
                touches[i] = {
                    pageX: gesture.touches[i].pageX,
                    pageY: gesture.touches[i].pageY
                };
            }

            function distance(p1, p2) { // Get distance between two points:
                var x = p1.pageX - p2.pageX,
                    y = p1.pageY - p2.pageY;
                return Math.sqrt(x * x + y * y);
            }

            if (event.type === "touch") {
                // Set all last* variables to starting gesture:
                //lastEvent = event;
                //lastGesture = gesture;
                lastTouches = touches;
                // Calculate Center:
                if (touches.length === 2) {
                    lastCenter = {
                        x: (touches[0].pageX - touches[1].pageX) / 2 + touches[1].pageX,
                        y: (touches[0].pageY - touches[1].pageY) / 2 + touches[1].pageY
                    };
                } else {
                    lastCenter = {
                        x: touches[0].pageX,
                        y: touches[0].pageY
                    };
                }

                // Render fabric canvas to pinch&zoom canvas:
                context.setTransform(1, 0, 0, 1, 0, 0);
                context.clearRect(0, 0, canvasWidth, canvasHeight);
                context.drawImage(canvasElement, 0, 0);
                // Show pinch&zoom canvas:
                canvasShow.style("display", null);
                // Hide fabric canvas:
                canvasElement.style.display = "none";
                // Reset fabric canvas visualization to default pinch&zoom settings, and render:
                canvas.select("group")
                    .attr("scaleX", 1)//scaleVal
                    .attr("scaleY", 1)//scaleVal
                    .attr("angle", 0)//rotateVal
                    .attr("left", 0)//leftVal
                    .attr("top", 0);//topVal
                canvas.pumpRender();
                // Render fabric canvas to off-screen buffer:
                canvasRender.getContext('2d').clearRect(0, 0, canvasWidth, canvasHeight);
                canvasRender.getContext('2d').drawImage(canvasElement, 0, 0);
            } else if (event.type === "release") {
                // Reset all last* variables, and update fabric canvas to get crisper image:
                //lastEvent = undefined;
                //lastGesture = undefined;
                lastTouches = undefined;
                lastCenter = undefined;

                // Set fabric canvas visualization's pinch&zoom settings, and render:
                canvas.select("group")
                    .attr("scaleX", scaleVal)
                    .attr("scaleY", scaleVal)
                    .attr("angle", rotateVal)
                    .attr("left", leftVal)
                    .attr("top", topVal);
                canvas.pumpRender();
                // Show fabric canvas:
                canvasElement.style.display = null;
                // Hide pinch&zoom canvas:
                canvasShow.style("display", "none");
            } else {
                // Last action was a release, so fix lastTouches:
                if (lastTouches === undefined) {
                    lastTouches = touches;
                }
                if (touches.length === 1) {
                    // Starting action, so reset lastTouches:
                    if (lastTouches.length !== 1) {
                        lastTouches = touches;
                        lastCenter = undefined; // Prevent rotating when removing finger.
                    }

                    // Calculate Center:
                    center = {
                        x: touches[0].pageX,
                        y: touches[0].pageY
                    };

                    // Translate:
                    leftVal += touches[0].pageX - lastTouches[0].pageX;
                    topVal += touches[0].pageY - lastTouches[0].pageY;
                } else if (touches.length === 2) {
                    // Starting action, so reset lastTouches:
                    if (lastTouches.length !== 2) {
                        lastTouches = touches;
                        lastCenter = undefined; // Prevent rotating when adding finger.
                    }

                    // Calculate Center:
                    center = {
                        x: (touches[0].pageX - touches[1].pageX) / 2 + touches[1].pageX,
                        y: (touches[0].pageY - touches[1].pageY) / 2 + touches[1].pageY
                    };
                    if (lastCenter === undefined) {
                        lastCenter = center;
                    }

                    // Calculate Scale:
                    scaleDiff = distance(touches[0], touches[1]) / distance(lastTouches[0], lastTouches[1]);

                    // Calculate Rotation:
                    rotateDiff = Math.atan2(lastTouches[0].pageX - lastCenter.x, lastTouches[0].pageY - lastCenter.y) - Math.atan2(touches[0].pageX - center.x, touches[0].pageY - center.y);
                    // Get sin and cos of angle in radians (for later):
                    sin = Math.sin(rotateDiff);
                    cos = Math.cos(rotateDiff);
                    // Convert to degrees for fabric:
                    rotateDiff *= 180 / Math.PI;

                    // Apply Scale:
                    scaleVal *= scaleDiff;

                    // Apply Rotation:
                    rotateVal += rotateDiff;

                    // Get canvas position:
                    pagePos = event.currentTarget.getBoundingClientRect();
                    // Convert page coords to canvas coords:
                    elementPos = {
                        pageX: center.x,
                        pageY: center.y
                    };
                    elementPos.pageX -= pagePos.left;
                    elementPos.pageY -= pagePos.top;

                    // Get difference between center position and group:
                    groupPos = {
                        x: leftVal - elementPos.pageX,
                        y: topVal - elementPos.pageY
                    };

                    // Rotate around point:
                    rotatePos = {
                        x: groupPos.x * cos - groupPos.y * sin + elementPos.pageX,
                        y: groupPos.x * sin + groupPos.y * cos + elementPos.pageY
                    };

                    // Scale relative to center point:
                    scalePos = {
                        x: scaleDiff * (rotatePos.x - elementPos.pageX) + elementPos.pageX - leftVal,
                        y: scaleDiff * (rotatePos.y - elementPos.pageY) + elementPos.pageY - topVal
                    };

                    // Translate delta in center position:
                    transPos = {
                        x: scalePos.x + (center.x - lastCenter.x),
                        y: scalePos.y + (center.y - lastCenter.y)
                    };

                    // Apply Translate:
                    leftVal += transPos.x;
                    topVal += transPos.y;
                }

                // Set pinch&zoom canvas's pinch&zoom settings, and render:
                context.setTransform(1, 0, 0, 1, 0, 0);
                context.clearRect(0, 0, canvasWidth, canvasHeight);
                context.translate(leftVal, topVal);
                context.scale(scaleVal, scaleVal);
                context.rotate(rotateVal / 180 * Math.PI);
                context.translate(-leftVal, -topVal);
                context.drawImage(canvasRender, leftVal, topVal);
                context.setTransform(1, 0, 0, 1, 0, 0);

                //lastEvent = event;
                //lastGesture = gesture;
                lastTouches = touches;
                lastCenter = center;
            }
        }

        // Subscribe to touch events:
        hammer.plugins.showTouches();
        hammer.plugins.fakeMultitouch();

        hammerObj = hammer(canvas[0].parentNode, {
            prevent_default: true
        });
        hammerObj.on("touch drag swipe pinch rotate transform release", touchHandler);
    }

    return {
        init: init
    };
});
