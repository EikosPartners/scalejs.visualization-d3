/*global define*/
define([
    //'scalejs!core',
    'scalejs.visualization-d3/treemap'
], function (
    //core,
    treemap
) {
    'use strict';

    function init(
        element,
        valueAccessor
    ) {
        var d3 = valueAccessor(),
            visualization;

        if (d3.visualization === 'treemap') {
            visualization = treemap;
            visualization.init(element, valueAccessor);
        }
    }

    return {
        init: init
    };
});

