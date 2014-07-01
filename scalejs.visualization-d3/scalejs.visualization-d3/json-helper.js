/*global define*/
/*jslint devel: true */
/*jslint browser: true */
define([
    'knockout',
    'd3',
    'd3.colorbrewer',
    'scalejs.visualization-d3/nested-data-helper'
], function (
    ko,
    d3,
    colorbrewer,
    nestedDataHelper
) {
    "use strict";

    var unwrap = ko.utils.unwrapObservable,
        getNode = nestedDataHelper.getNode,
        nodeScale = d3.scale.linear();

    return function (parameters, triggerTime, zoomedItemPath) {

        var json,
            globals = {},
            sortByFuncs = {
                unordered: function (a, b) { return a.index - b.index; },
                ascendingSize: function (a, b) { return a.size - b.size; },
                descendingSize: function (a, b) { return b.size - a.size; }
            };

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
                if (globals.colorPalette.length === 1) {
                    globals.colorPalette[1] = globals.colorPalette[0];
                }
            } else {
                globals.colorPalette = colorbrewer[globals.colorPalette][3];
            }
        }

        // Loop through levels to parse parameters:
        function parseLevelParameters(lvls) {
            // Clear levels:
            var levels = [],
                l;

            // Loop through all levels and parse the parameters:
            for (var i = 0; i < lvls.length; i += 1) {
                l = lvls[i];
                if (l instanceof Object) {
                    // Level has parameters, or use globals
                    levels[i] = {
                        idPath: unwrap(l.idPath) || globals.idPath,
                        namePath: unwrap(l.namePath || l.idPath) || globals.namePath,
                        childrenPath: unwrap(l.childrenPath) || globals.childrenPath,
                        areaPath: unwrap(l.areaPath) || globals.areaPath,
                        colorPath: unwrap(l.colorPath) || globals.colorPath,
                        fontSize: unwrap(l.fontSize) || globals.fontSize,
                        fontFamily: unwrap(l.fontFamily) || globals.fontFamily,
                        fontColor: unwrap(l.fontColor) || globals.fontColor,
                        colorPalette: unwrap(l.colorPalette)          // more processing below
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
                        childrenPath: l || globals.childrenPath,
                        idPath: globals.idPath,
                        namePath: globals.namePath,
                        areaPath: globals.areaPath,
                        colorPath: globals.colorPath,
                        colorPalette: globals.colorPalette,
                        fontSize: globals.fontSize,
                        fontFamily: globals.fontFamily,
                        fontColor: globals.fontColor
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
                    id: node[lvl.idPath] || '',
                    name: node[lvl.namePath] || '',
                    lvl: index,
                    size: node[lvl.areaPath] !== undefined ? node[lvl.areaPath] : 1,
                    colorSize: node[lvl.colorPath] || 0,
                    fontSize: lvl.fontSize,
                    fontFamily: lvl.fontFamily,
                    fontColor: lvl.fontColor
                };


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
                maxVisibleLevels = unwrap(parameters.maxVisibleLevels),
                dataSource = unwrap(parameters.data) || { name: "Empty" },
                levelsSource = unwrap(parameters.levels) || [{}],
                levels;

            setGlobalParameters();

            // Create copy of data in a easy structure for d3:
            levels = parseLevelParameters(levelsSource);
            // Generate Json:
            root = createNodeJson(dataSource, levels, 0, maxlvl, 0);
            // Make maxVisibleLevels the max lvl if not specified:
            maxVisibleLevels = maxVisibleLevels || maxlvl.value + 1;

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

            // Set root-specific properties:
            root.curLevel = getNode(zoomedItemPath(), root).lvl;
            root.curMaxLevel = root.curLevel + maxVisibleLevels - 1;
            root.maxlvl = maxlvl.value;
            root.maxVisibleLevels = maxVisibleLevels;
            root.levels = levels;
            root.index = 0;

            // Return the new json data:
            return root;
        });

        return json;

    }

});