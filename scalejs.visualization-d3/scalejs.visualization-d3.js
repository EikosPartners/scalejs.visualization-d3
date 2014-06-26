/*global define*/
/*jslint devel: true */
define([
    'scalejs!core',
    'knockout',
    'scalejs.visualization-d3/visualizations/treemap',
    'scalejs.visualization-d3/visualizations/sunburst'
], function (
    core,
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

    core.registerExtension({
        treemap: treemap,
        sunburst: sunburst
    });
});

