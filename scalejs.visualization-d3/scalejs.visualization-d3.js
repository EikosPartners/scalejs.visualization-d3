/*global define*/
/*jslint devel: true */
define([
    'scalejs!core',
    'knockout',
    'scalejs.visualization-d3/d3',
    'd3'
], function (
    core,
    ko,
    d3
) {
    'use strict';
    if (ko.bindingHandlers.d3) {
        console.error("visualization-d3 is already setup");
        return false;
    }

    ko.bindingHandlers.d3 = d3;
    ko.virtualElements.allowedBindings.d3 = true;

    core.registerExtension({
        d3: d3
    });
});

