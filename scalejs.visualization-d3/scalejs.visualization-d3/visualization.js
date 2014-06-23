/*global define*/
/*jslint devel: true */
/*jslint browser: true */
define([
    'scalejs!core',
    'knockout',
    'd3',
    'd3.colorbrewer',
    'scalejs.canvas',
    'scalejs.visualization-d3/visualizations/treemap',
    'scalejs.visualization-d3/visualizations/sunburst',
    'scalejs.visualization-d3/json-helper',
    'scalejs.visualization-d3/misc-helpers'
], function (
    core,
    ko,
    d3,
    colorbrewer,
    canvasRender,
    treemap,
    sunburst,
    jsonHelper,
    helpers
) {
    "use strict";
    var //imports
        observable = ko.observable,
        computed = ko.computed,
        unwrap = ko.utils.unwrapObservable,
        isObservable = ko.isObservable,
        getNode = helpers.getNode,
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
            triggerTime = parameters.triggerTime == null ? 10 : parameters.triggerTime,
            enableRotate = parameters.enableRotate,
            enableZoom = parameters.enableZoom || false,
            enableTouch = parameters.enableTouch || false,
            allowTextOverflow = parameters.allowTextOverflow || false,
            visualization = {},
            visualizationType = isObservable(parameters.visualization) ? parameters.visualization : observable(parameters.visualization),
            visualizationParams, // visualization specific parameters may be passed
            json,
            globals = {},
            zoomedItemPath = isObservable(parameters.zoomedItemPath) ? parameters.zoomedItemPath : observable(parameters.zoomedItemPath),
            selectedItemPath = isObservable(parameters.selectedItemPath) ? parameters.selectedItemPath : observable(parameters.selectedItemPath),
            heldItemPath = isObservable(parameters.heldItemPath) ? parameters.heldItemPath : observable(parameters.heldItemPath),
            nodeScale = d3.scale.linear(),
            root,
            zoomedNode,
            tempFuncObj;

        // Subscribe to zoomedItemPath changes, verify path and then zoom:
        zoomedItemPath.subscribe(function (path) {
            var node = getNode(path, json());
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
                visualization.update(getNode(zoomedItemPath(), json()));    // Animate zoom effect
            }
        });

        // Subscribe to selectedItemPath changes from outside:
        selectedItemPath.subscribe(function (path) {
            // if there is no node, there is no path
            if (!getNode(path, json())) {
                selectedItemPath(undefined);
            }
        });

        //REFACTORED INITIALIZATIONS===================================================================================
        var jsonHelperFunctions = jsonHelper(parameters, triggerTime),
            setGlobalParameters = jsonHelperFunctions.setGlobalParameters,
            parseLevelParameters = jsonHelperFunctions.parseLevelParameters,
            createNodeJson = jsonHelperFunctions.createNodeJson;
        //END REFACTORED INITIALIZATIONS===============================================================================



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

            visualizationParams = unwrap(parameters[visualizationType.peek()]);



            // Set root-specific properties:
            root.curLevel = getNode(zoomedItemPath(), root).lvl;
            root.curMaxLevel = root.curLevel + maxVisibleLevels - 1;
            root.maxlvl = maxlvl.value;
            root.maxVisibleLevels = maxVisibleLevels;
            root.levels = levels;
            root.index = 0;

            // Return the new json data:
            return root;
        }).extend({ throttle: triggerTime });


        // Change/Set visualization:
        function setVisualization(type, domElement, rootFromJson) {

            //Remove previous visualization's nodes
            while (domElement.firstChild) {
                domElement.removeChild(domElement.firstChild);
            }

            // Retrieve new visualization type, and fail gracefully:
            if (visualizations[type] != null) visualization = visualizations[type]();
            else visualization = blankVisualization(type);

            visualization.initializeCanvas(domElement);

            // Remove old layout handlers and set new ones
            visualization.setLayoutHandler(domElement, getNode(zoomedItemPath(), json()));

            visualization.setupGestures(
                enableRotate,
                enableTouch,
                enableZoom,
                heldItemPath,
                selectedItemPath,
                zoomedItemPath,
                getNode(zoomedItemPath(), json()),
                rootFromJson
            );

            // Reset transform:
            visualization.resetTransformations();

            // Run visualization's initialize code:
            visualization.allowTextOverflow = unwrap(allowTextOverflow);
            visualization.parameters = computed(function () {
                return unwrap(parameters[type]);
            });//visualizationParams;
            visualization.init(parameters, json, getNode(zoomedItemPath(), json()));
        }

        // Initialize visualization:
        setVisualization(visualizationType(), element, root);

        // Subscribe to allowTextOverflow changes:
        if (isObservable(allowTextOverflow)) {
            allowTextOverflow.subscribe(function () {
                visualization.allowTextOverflow = unwrap(allowTextOverflow);
                visualization.update(getNode(zoomedItemPath(), json()));
            });
        }

        // Subscribe to visualization type changes:
        visualizationType.subscribe(function (type) {
            visualization.remove();
            setVisualization(type, element, root);
        });
        
        // Subscribe to data changes:
        json.subscribe(function () {
            //visualization.parameters = visualizationParams;
            visualization.update(getNode(zoomedItemPath(), json()));
        });
        
    }

    return {
        init: init
    };
});
