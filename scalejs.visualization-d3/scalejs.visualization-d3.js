/*global define*/
/*jslint devel: true */
define([
    'scalejs!core',
    'knockout',
    'scalejs.visualization-d3/visualization'
], function (
    core,
    ko,
    visualization
) {
    'use strict';
    if (ko.bindingHandlers.d3) {
        console.error("visualization-d3 is already setup");
        return false;
    }

    ko.bindingHandlers.d3 = visualization;
    ko.virtualElements.allowedBindings.d3 = true;

    core.registerExtension({
        d3: visualization
    });
});

