/*global define*/
/*jslint devel: true */
/*jslint browser: true */
define([
    'd3',
    'scalejs.canvas'
], function (
    d3,
    canvasRender
) {
    "use strict";

    function initializeCanvas(element) {

        var elementStyle,
            canvasWidth,
            canvasHeight,
            canvasElement,
            canvas;

        // Clear the element that this visualization is in
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }

        // Get element's width and height:
        elementStyle = window.getComputedStyle(element);

        // Get width and height. Must be >= 1 pixel in order for d3 to calculate layouts properly:
        canvasWidth = parseInt(elementStyle.width, 10);
        canvasWidth = canvasWidth >= 1 ? canvasWidth : 1;
        canvasHeight = parseInt(elementStyle.height, 10);
        canvasHeight = canvasHeight >= 1 ? canvasHeight : 1;


        //req canvasWidth, canvasHeight
        canvasElement = d3.select(element)
                            .style('overflow', 'hidden')
                            .append("canvas")
                                .attr("width", canvasWidth)
                                .attr("height", canvasHeight)
                                .attr("display", "none")
                                .node();

        //req canvasElement
        canvas = canvasRender.select(canvasElement).ease(d3.ease("cubic-in-out"));

        return {
            elementStyle: elementStyle,
            canvasWidth: canvasWidth,
            canvasHeight: canvasHeight,
            canvasElement: canvasElement,
            canvas: canvas
        };
    }

    return {
        initializeCanvas: initializeCanvas
    };
});