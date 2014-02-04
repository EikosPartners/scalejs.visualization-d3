/*global define*/
define([
    //'scalejs!core',
    'knockout',
    'scalejs.visualization-d3/d3'
], function (
    //core,
    ko,
    d3
) {
    'use strict';

    ko.bindingHandlers.d3 = d3;
    ko.virtualElements.allowedBindings.d3 = true;
});

