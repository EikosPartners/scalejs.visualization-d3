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

    var
        elementStyle,
        canvasWidth,
        canvasHeight,
        canvasElement,
        canvas;

    function runLogic(element) {
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
    }

    function initializeCanvas(element) {

        /*var elementStyle,
            canvasWidth,
            canvasHeight,
            canvasElement,
            canvas;

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
        };*/
    }

    function getCanvas() {
        return canvas;
    }

    function getCanvasWidth() {
        return canvasWidth;
    }

    function getCanvasHeight() {
        return canvasHeight;
    }

    function getCanvasElement() {
        return canvasElement;
    }

    function getElementStyle() {
        return elementStyle;
    }

    return {
        //initializeCanvas: initializeCanvas,
        runLogic: runLogic,
        getCanvas: getCanvas,
        getCanvasWidth: getCanvasWidth,
        getCanvasHeight: getCanvasHeight,
        getCanvasElement: getCanvasElement,
        getElementStyle: getElementStyle
    };
});