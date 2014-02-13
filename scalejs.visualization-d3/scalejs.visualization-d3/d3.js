/*global define*/
/*jslint browser: true */
define([
    'scalejs!core',
    'knockout',
    'd3',
    'd3.colorbrewer',
    'scalejs.visualization-d3/treemap',
    'scalejs.visualization-d3/sunburst'
], function (
    core,
    ko,
    d3,
    colorbrewer,
    treemap,
    sunburst
) {
    "use strict";
    var //imports
        unwrap = ko.utils.unwrapObservable,
        isObservable = ko.isObservable;

    function init(
        element,
        valueAccessor
    ) {
        var parameters = valueAccessor(),
            visualization = {
                init: function () { },
                update: function () { },
                zoom: function () { },
                resize: function () { },
                remove: function () { }
            },
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
            elementStyle,
            canvasWidth,
            canvasHeight,
            root,
            nodeSelected,
            zoomEnabled = true; // Temporary fix to errors with NaN widths during adding/removing nodes.

        // Get element's width and height:
        elementStyle = window.getComputedStyle(element);
        canvasWidth = parseInt(elementStyle.width, 10);
        canvasHeight = parseInt(elementStyle.height, 10);

        canvas = d3.select(element)
                .style('overflow', 'hidden')
                .append("fabric:canvas")
                    .property("renderOnAddRemove", false)
                    .property("selection", false)
                    .property("targetFindTolerance", 1)
                    .attr("width", canvasWidth)
                    .attr("height", canvasHeight);

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
                }
            }
        });

        visualizationTypeObservable = ko.computed(function () {
            visualizationType = parameters.visualization || ko.observable("");
            return unwrap(visualizationType);
        });
        visualizationType = visualizationTypeObservable();

        if (visualizationType === 'treemap') {
            visualization = treemap();
        } else if (visualizationType === 'sunburst') {
            visualization = sunburst();
        } else {
            visualization = {
                init: function () { },
                update: function () { },
                zoom: function () { },
                resize: function () { },
                remove: function () { }
            };
        }
        // Run visualization's initialize code:
        visualization.init(canvas, canvasWidth, canvasHeight, json, selectZoom);
        // Start rendering the canvas
        canvas.startRender();

        // Subscribe to visualization type changes:
        visualizationTypeObservable.subscribe(function () {
            visualization.remove();
            visualizationType = visualizationTypeObservable();

            if (visualizationType === 'treemap') {
                visualization = treemap();
            } else if (visualizationType === 'sunburst') {
                visualization = sunburst();
            } else {
                visualization = {
                    init: function () { },
                    update: function () { },
                    zoom: function () { },
                    resize: function () { },
                    remove: function () { }
                };
            }

            // Set selected node to the root of the treemap:
            nodeSelected = root;
            // Set default selected item (do this after the data is set, and before modifying attributes):
            if (isObservable(selectedItemPath)) {
                selectedItemPath([]);
            }

            // Run visualization's initialize code:
            visualization.init(canvas, canvasWidth, canvasHeight, json, selectZoom);
            // Start rendering the canvas
            canvas.startRender();
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
        }

        // Subscribe to data changes:
        json.subscribe(function () {
            update();   // Re-render on change
        });

        if (core.layout) {
            // Add event listener for on layout change:
            core.layout.onLayoutDone(function () {
                // Get element's width and height:
                elementStyle = window.getComputedStyle(element);
                canvasWidth = parseInt(elementStyle.width, 10);
                canvasHeight = parseInt(elementStyle.height, 10);
                // Resize canvas:
                canvas.attr('width', canvasWidth);
                canvas.attr('height', canvasHeight);
                // Call visualization's resize function to handle resizing internally:
                visualization.resize(canvasWidth, canvasHeight);
                // Update the visualization:
                visualization.update();
            });
        }
    }

    return {
        init: init
    };
});
