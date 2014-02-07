/*global define*/
define([
    //'scalejs!core',
    'scalejs.visualization-d3/treemap',
    'scalejs.visualization-d3/sunburst'
], function (
    //core,
    treemap,
    sunburst
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
        } else if (d3.visualization === 'sunburst') {
            visualization = sunburst;
            visualization.init(element, valueAccessor);
        }
    }

    return {
        init: init
    };
});

