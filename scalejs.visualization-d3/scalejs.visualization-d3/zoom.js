/*global define*/
define([
    'd3',
    'hammer',
    'fabric'
], function (
    d3,
    hammer,
    fabric
) {
    "use strict";

    return function () {
        var //Treemap variables
            canvasElement,
            json,
            selectZoom,
            canvasWidth,
            canvasHeight,
            root,
            treemapLayout,
            canvasArea,
            hammertime,
            left = 250,
            top = 250,
            rotateStart = 0,
            rotateVal = 0,
            scaleStart = 1,
            scaleVal = 1;

        // Zoom after click:
        function zoom(d) {
            if (canvasArea === undefined) {
                return; // Catch for if treemap hasn't been setup.
            }

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
            canvasArea.select("group")
                .attr("left", left + dx)
                .attr("top", top + dy);
        }
        function testHammer(event) {
            //console.log(event);
            if (!event.gesture) {
                return;
            }
            event.gesture.preventDefault();

            var diffRot,
                pagePos,
                pos,
                elementPos,
                groupPos,
                rotatePos,
                scalePos,
                sin,
                cos;

            if (event.type === "transformstart") {
                scaleStart = scaleVal;
                rotateStart = rotateVal;
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
                pos = { left: left, top: top };
                elementPos = event.gesture.center;
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

                pan(scalePos.x, scalePos.y);

                if (event.type === "transformend") {
                    scaleStart = scaleVal;
                    rotateStart = rotateVal;
                    left += scalePos.x;
                    top += scalePos.y;
                }

                //a, b, c, d, tx, ty (Doesn't work on groups)
                /*translateMatrix = [1, 0, 0, 1, left, top];
                rotateMatrix = [cos, sin, -sin, cos, 0, 0];
                scaleMatrix = [event.gesture.scale, 0, 0, event.gesture.scale, 0, 0];
                matrix = fabric.util.multiplyTransformMatrices(rotateMatrix, scaleMatrix);*/
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
                .attr("left", Math.random() * 500 - 250)
                .attr("top", Math.random() * 500 - 250)
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
            if (canvasArea === undefined) {
                return; // Catch for if treemap hasn't been setup.
            }
            // Define temp vars:
            var celSel, cell, nodes;

            celSel = canvasArea.select("group");

            // Add new nodes to Canvas:
            addNodes(celSel);

            // Remove nodes from Canvas:
            //cell = celSel.exit().remove();
        }

        function init(
            element,
            width,
            height,
            jsonObservable,
            selectZoomFunction
        ) {
            if (canvasArea !== undefined) {
                return; // Catch for if treemap has been setup.
            }
            canvasElement = element;
            json = jsonObservable;
            canvasWidth = width;
            canvasHeight = height;
            selectZoom = selectZoomFunction;

            // Define temp vars:
            var celSel, nodes;

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
            //for (var i = 0; i < 30; i += 1) {
            addNodes(celSel);
            //}
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
            scale: scale,
            resize: resize,
            remove: remove
        };
    };
});