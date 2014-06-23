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
                json().curLevel = zoomedNode.lvl;
                json().curMaxLevel = zoomedNode.lvl + json().maxVisibleLevels - 1;
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
        json = jsonHelper(parameters, triggerTime, visualizationType, zoomedItemPath);
        //END REFACTORED INITIALIZATIONS===============================================================================


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
        setVisualization(visualizationType(), element, json());

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
            setVisualization(type, element, json());
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
