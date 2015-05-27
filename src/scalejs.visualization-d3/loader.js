/*global define, require*/
define([
    'scalejs!core',
    'knockout'
], function (
    core,
    ko
) {
    "use strict";

    var unwrap = ko.unwrap;

    if (ko.bindingHandlers.visualizations) {
        console.error("visualizations is already setup");
    }

    ko.virtualElements.allowedBindings.visualizations = true;

    ko.bindingHandlers.visualizations = {
        init: function (element, valueAccessor) {
            var type = valueAccessor().type;
                
            function initializeViz() {
                var vis = require('./scalejs.visualization-d3/visualizations/' + type());
                if (vis !== undefined) {
                    vis.init(element, valueAccessor);

                } else {
                    console.warn("Invalid visualization type:", type());
                }
            }

            type.subscribe(initializeViz);

            initializeViz();
        }
    }
});