/*global define*/
/*jslint devel: true */
define([
    //'scalejs!core',
    'knockout',
    'scalejs.visualization-d3/d3',
    'd3',
    'fabric',
    'scalejs.d3-fabric',
    'tweenLite'
], function (
    //core,
    ko,
    d3,
    d3original,
    fabric,
    d3fabric,
    tweenLite
) {
    'use strict';
    if (ko.bindingHandlers.d3) {
        console.error("visualization-d3 is already setup");
        return false;
    }
    d3fabric(d3original, fabric, tweenLite);    // Returns true if initialized, else returns false.

    ko.bindingHandlers.d3 = d3;
    ko.virtualElements.allowedBindings.d3 = true;
});

