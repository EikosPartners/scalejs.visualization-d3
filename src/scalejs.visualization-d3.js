/*global define*/
/*jslint devel: true */
define([
    'knockout',
    'scalejs.visualization-d3/visualizations/treemap',
    'scalejs.visualization-d3/visualizations/sunburst',
    'scalejs.visualization-d3/loader'
], function (
    ko,
    treemap,
    sunburst
) {
    'use strict';

    if (ko.bindingHandlers.treemap) {
        console.error("treemap is already setup");
    }

    if (ko.bindingHandlers.sunburst) {
        console.error("sunburst is already setup");
    }

    ko.bindingHandlers.treemap = treemap;
    ko.bindingHandlers.sunburst = sunburst;
    ko.virtualElements.allowedBindings.treemap = true;
    ko.virtualElements.allowedBindings.sunburst = true;
});

