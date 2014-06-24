/*global define*/
/*jslint devel: true */
define([
    'scalejs!core',
    'knockout',
    'scalejs.visualization-d3/visualizations/treemap'
], function (
    core,
    ko,
    treemap
) {
    'use strict';
    if (ko.bindingHandlers.treemap) {
        console.error("treemap is already setup");
        return false;
    }

    ko.bindingHandlers.treemap = treemap;
    ko.virtualElements.allowedBindings.treemap = true;

    core.registerExtension({
        treemap: treemap
    });
});

