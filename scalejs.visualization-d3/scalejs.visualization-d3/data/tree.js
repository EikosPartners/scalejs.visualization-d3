﻿/*global define*/
/*jslint devel: true */
/*jslint browser: true */
define([
    'scalejs!core',
    'knockout',
    'd3',
    'd3.colorbrewer'
], function (
    core,
    ko,
    d3,
    colorbrewer
) {
    "use strict";
    var //imports
        observable = ko.observable,
        computed = ko.computed,
        unwrap = ko.utils.unwrapObservable,
        isObservable = ko.isObservable,
        sortByFuncs = {
            unordered: function (a, b) { return a.index - b.index; },
            ascendingSize: function (a, b) { return a.size - b.size; },
            descendingSize: function (a, b) { return b.size - a.size; }
        };

    function init(
        element,
        valueAccessor
    ) {
        var parameters = valueAccessor(),
            triggerTime = parameters.triggerTime == null || 10,
            allowTextOverflow = parameters.allowTextOverflow || false,
            visualization,
            visualizationType = isObservable(parameters.visualization) ? parameters.visualization : observable(parameters.visualization),
            json,
            globals = {},
            zoomedItemPath = isObservable(parameters.zoomedItemPath) ? parameters.zoomedItemPath : observable(parameters.zoomedItemPath),
            selectedItemPath = isObservable(parameters.selectedItemPath) ? parameters.selectedItemPath : observable(parameters.selectedItemPath),
            heldItemPath = isObservable(parameters.heldItemPath) ? parameters.heldItemPath : observable(parameters.heldItemPath),
            nodeScale = d3.scale.linear(),
            root,
            zoomedNode = {
                id: null
            };

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

        // Register pinch&zoom extension to canvas:
        registerTouchHandler();
        if (isObservable(enableTouch)) {
            // Subscribe to changes in enableTouch to dynamically enable and disable the pinch&zoom touch handler:
            enableTouch.subscribe(function () {
                touchHandler.remove();
                registerTouchHandler();
            });
        }

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
                maxVisibleLevels = unwrap(parameters.maxVisibleLevels),
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
            // Make maxVisibleLevels the max lvl if not specified:
            maxVisibleLevels = maxVisibleLevels || maxlvl.value + 1;

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
            visualization = require('scalejs.visualization-d3/' + type);

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
            visualization.init(parameters, json, zoomedNode, element);
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
    }

    return {
        init: init
    };
});