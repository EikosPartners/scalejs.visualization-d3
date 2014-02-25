/*global define*/
define([
    'd3',
    'hammer'
], function (
    d3,
    hammer
) {
    "use strict";

    return function () {
        var //Treemap variables
            canvasElement,
            canvasWidth,
            canvasHeight,
            canvasArea,
            hammertime,
            left = 0,
            top = 0,
            leftVal = 0,
            topVal = 0,
            rotateStart = 0,
            rotateVal = 0,
            scaleStart = 1,
            scaleVal = 1,
            transStart,
            inZoom = false,
            objnum = 10;

        // Zoom after click:
        function zoom() {
            /*if (canvasArea !== undefined || inZoom) {
            }*/

            // Prevent event from firing more than once:
            if (d3.event) {
                d3.event.stopPropagation();
            }
        }

        function scale(val) {
            if (canvasArea === undefined) {
                return; // Catch for if treemap hasn't been setup.
            }
            scaleVal = val;
            canvasArea.select("group")
                .attr("scaleX", scaleVal)
                .attr("scaleY", scaleVal);
        }
        function rotate(ang) {
            if (canvasArea === undefined) {
                return; // Catch for if treemap hasn't been setup.
            }
            rotateVal = ang;
            canvasArea.select("group")
                .attr("angle", rotateVal);
        }
        function pan(dx, dy) {
            if (canvasArea === undefined) {
                return; // Catch for if treemap hasn't been setup.
            }
            leftVal = left + dx;
            topVal = top + dy;
            canvasArea.select("group")
                .attr("left", leftVal)
                .attr("top", topVal);
        }
        function testHammer(event) {
            //console.log(event);
            if (!event.gesture) {
                return;
            }
            event.gesture.preventDefault();

            var pagePos,
                elementPos,
                groupPos,
                rotatePos,
                scalePos,
                transPos,
                sin,
                cos;

            if (event.type === "transformstart") {
                scaleStart = scaleVal;
                rotateStart = rotateVal;
                //transStart = event.gesture.center;
            }

            // Pinch and Zoom && Rotate (rotate event isn't listened to for now, but pinch does its operations)
            if (event.type === "pinch" || event.type === "transformend") {// || event.type === "rotate") {
                if (event.type === "transformend") {
                    scale(scaleVal);
                    rotate(rotateVal);
                } else {
                    scale(scaleStart * event.gesture.scale);
                    rotate((rotateStart + event.gesture.rotation) % 360);
                }
                //console.log(event);
                pagePos = event.currentTarget.getBoundingClientRect();
                if (transStart === undefined) {
                    transStart = event.gesture.center;
                }
                elementPos = {
                    pageX: transStart.pageX,
                    pageY: transStart.pageY
                };//event.gesture.center;
                groupPos = {};
                rotatePos = {};
                scalePos = {};
                sin = Math.sin(event.gesture.rotation / 180 * Math.PI);
                cos = Math.cos(event.gesture.rotation / 180 * Math.PI);
                elementPos.pageX -= pagePos.left;
                elementPos.pageY -= pagePos.top;

                // translate point back to origin:
                groupPos.x = left - elementPos.pageX;
                groupPos.y = top - elementPos.pageY;

                // rotate point
                rotatePos.x = groupPos.x * cos - groupPos.y * sin + elementPos.pageX;
                rotatePos.y = groupPos.x * sin + groupPos.y * cos + elementPos.pageY;

                // scale to point
                scalePos.x = event.gesture.scale * (rotatePos.x - elementPos.pageX) + elementPos.pageX - left;
                scalePos.y = event.gesture.scale * (rotatePos.y - elementPos.pageY) + elementPos.pageY - top;

                // translate center
                transPos = {};
                transPos.x = scalePos.x + (event.gesture.center.pageX - transStart.pageX);
                transPos.y = scalePos.y + (event.gesture.center.pageY - transStart.pageY);

                pan(transPos.x, transPos.y);

                if (event.type === "transformend") {
                    scaleStart = scaleVal;
                    rotateStart = rotateVal;
                    transStart = undefined;
                    left += transPos.x;
                    top += transPos.y;
                }
            }

            // Pan
            if (event.type === "drag") {
                pan(event.gesture.deltaX, event.gesture.deltaY);
            }
            if (event.type === "release") {
                left += event.gesture.deltaX;
                top += event.gesture.deltaY;
                pan(0, 0);
            }

            // Render updates (temp fix)
            canvasElement.pumpRender();
        }

        function addNodes(celSel) {
            // Add nodes to Canvas:
            var cell = celSel.append("group")
                .attr("left", Math.random() * Math.max(canvasWidth - 60, 0) + 30)
                .attr("top", Math.random() * Math.max(canvasHeight - 80, 0) + 50)
                .attr("originX", "center")
                .attr("originY", "center");

            // Add rectangle to each node:
            cell.append("rect")
                .attr("left", -30)
                .attr("top", -30)
                .attr("width", 60)
                .attr("height", 60)
                .attr("fill", "blue");

            // Add rectangle to each node:
            cell.append("circle")
                .attr("left", -30)
                .attr("top", -30)
                .attr("radius", 30)
                .attr("fill", "green");

            // Add rectangle to each node:
            cell.append("triangle")
                .attr("left", -5)
                .attr("top", 0)
                .attr("width", 10)
                .attr("height", 20)
                .attr("angle", 50)
                .attr("fill", "red");
        }

        function update() {
            if (canvasArea === undefined || inZoom) {
                return; // Catch for if hasn't been setup, or is zooming (to avoid redrawing; for smooth zoom)
            }
            // Define temp vars:
            var celSel, i;  //, cell, nodes;

            celSel = canvasArea.select("group");

            // Add new nodes to Canvas:
            for (i = 0; i < 10; i += 1) {
                addNodes(celSel);
            }
            objnum += 10;
            celSel.select("text").text("Objects: " + objnum);

            // Remove nodes from Canvas:
            //cell = celSel.exit().remove();

            // Render updates (temp fix)
            canvasElement.pumpRender();
        }

        function init(
            element,
            width,
            height
        ) {
            if (canvasArea !== undefined) {
                return; // Catch for if treemap has been setup.
            }
            canvasElement = element;
            canvasWidth = width;
            canvasHeight = height;

            // Define temp vars:
            var celSel, i;  //, nodes;

            canvasArea = canvasElement;

            hammer.plugins.showTouches();
            hammer.plugins.fakeMultitouch();

            hammertime = hammer(canvasArea[0].parentNode, {
                prevent_default: true
            }).on("release drag transformstart transformend rotate pinch", testHammer); // Missing event before drag after touch

            celSel = canvasArea.append("group")
                .attr("left", left)
                .attr("top", top)
                .attr("originX", "center")
                .attr("originY", "center");

            // Add nodes to Canvas:
            for (i = 0; i < 2; i += 1) {
                addNodes(celSel);
            }
            celSel.append("text")
                .attr("left", 0)
                .attr("top", 0)
                .attr("originY", "top")
                .attr("originX", "left")
                .attr("fontSize", 15)
                .text("Objects: 10");

            // Render updates (temp fix)
            canvasElement.pumpRender();
            //renderFront();
        }

        function resize(width, height) {
            canvasWidth = width;
            canvasHeight = height;
        }

        function remove() {
            if (canvasArea !== undefined) {
                canvasArea.selectAll("group").remove();
                canvasArea = undefined;
                hammertime.off("release drag transformstart transformend rotate pinch", testHammer);
                hammertime.enable(false);
                hammertime = undefined;
            }
        }

        // Return treemap object:
        return {
            init: init,
            update: update,
            zoom: zoom,
            renderEnd: function () { },
            resize: resize,
            remove: remove
        };
    };
});