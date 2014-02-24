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
            canvasShow,
            canvas,
            canvasRender,
            context,
            hammertime,
            left = 0,
            top = 0,
            leftVal = 0,
            topVal = 0,
            rotateStart = 0,
            rotateVal = 0,
            scaleStart = 1,
            scaleVal = 1,
            groupPos = { x: 0, y: 0 },
            elementPos = { x: 0, y: 0 },
            inZoom = false,
            last,
            objnum = 10;

        function renderFront(back) {
            context.setTransform(1, 0, 0, 1, 0, 0);
            if (!back) {
                context.clearRect(0, 0, canvasWidth, canvasHeight);
                context.drawImage(canvas, 0, 0);
            }
            canvasRender.getContext('2d').clearRect(0, 0, canvasWidth, canvasHeight);
            canvasRender.getContext('2d').drawImage(canvas, 0, 0);
            canvas.getContext('2d').clearRect(0, 0, canvasWidth, canvasHeight);
        }

        // Zoom after click:
        function zoom(d) {
            if (canvasArea !== undefined || inZoom) {
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
        }
        function rotate(ang) {
            if (canvasArea === undefined) {
                return; // Catch for if treemap hasn't been setup.
            }
            rotateVal = ang;
        }
        function pan(dx, dy) {
            if (canvasArea === undefined) {
                return; // Catch for if treemap hasn't been setup.
            }
            leftVal = left + dx;
            topVal = top + dy;
        }
        function refresh() {
            canvasElement.pumpRender();
            renderFront(true);
        }
        function updateCan() {
            canvasArea.select("group")
                    .attr("scaleX", 1)//scaleVal
                    .attr("scaleY", 1)//scaleVal
                    .attr("angle", 0)//rotateVal
                    .attr("left", 0)//leftVal
                    .attr("top", 0);//topVal
            canvasElement.pumpRender();
            renderFront(true);

            last = {
                left: left,
                top: top,
                leftVal: leftVal,
                topVal: topVal,
                rotateVal: rotateVal,
                scaleVal: scaleVal
            };

            canvasArea.select("group")
                .attr("scaleX", scaleVal)
                .attr("scaleY", scaleVal)
                .attr("angle", rotateVal)
                .attr("left", leftVal)
                .attr("top", topVal);

            canvasElement.pumpRender();
            renderFront();

            context.setTransform(1, 0, 0, 1, 0, 0);
            context.clearRect(0, 0, canvasWidth, canvasHeight);
            context.drawImage(canvasRender, 0, 0);
            canvasArea.select("group")
                .attr("scaleX", 1)//scaleVal
                .attr("scaleY", 1)//scaleVal
                .attr("angle", 0)//rotateVal
                .attr("left", 0)//leftVal
                .attr("top", 0);//topVal

            canvasElement.pumpRender();
            renderFront(true);
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
                scale(scaleStart * event.gesture.scale);
                rotate((rotateStart + event.gesture.rotation) % 360);
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
            }

            // Pan
            if (event.type === "drag") {
                pan(event.gesture.deltaX, event.gesture.deltaY);
            }
            if (event.type === "release") {
                left += event.gesture.deltaX;
                top += event.gesture.deltaY;
                pan(0, 0);
                updateCan();
            } else {
                context.setTransform(1, 0, 0, 1, 0, 0);
                context.clearRect(0, 0, canvasWidth, canvasHeight);
                context.translate(leftVal, topVal);
                context.scale(scaleVal, scaleVal);
                context.rotate(rotateVal / 180 * Math.PI);
                context.translate(-leftVal, -topVal);
                context.drawImage(canvasRender, leftVal, topVal);
                context.setTransform(1, 0, 0, 1, 0, 0);
            }
        }

        function addNodes(celSel) {
            // Add nodes to Canvas:
            var cell = celSel.append("group")
                .attr("left", Math.random() * Math.max(canvasWidth-60, 0) + 30)
                .attr("top", Math.random() * Math.max(canvasHeight-80, 0) + 50)
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
            var celSel, cell, nodes;

            celSel = canvasArea.select("group");

            // Add new nodes to Canvas:
            for (var i = 0; i < 10; i += 1) {
                addNodes(celSel);
            }
            objnum += 10;
            celSel.select("text").text("Objects: " + objnum);

            // Remove nodes from Canvas:
            //cell = celSel.exit().remove();

            // Render updates (temp fix)
            /*canvasElement.pumpRender();
            renderFront();*/
            updateCan();
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

            canvas = canvasArea.domNode()[0][0];
            canvasShow = d3.select(canvasArea[0][0].parentNode)
                .append("canvas")
                    .style("position", "absolute")
                    .style("left", 0)
                    .style("top", 0)
                    .attr("width", canvasWidth)
                    .attr("height", canvasHeight);
            context = canvasShow[0][0].getContext('2d');
            canvasRender = document.createElement("canvas");
            canvasRender.width = canvasWidth;
            canvasRender.height = canvasHeight;

            hammer.plugins.showTouches();
            hammer.plugins.fakeMultitouch();

            hammertime = hammer(canvasArea[0].parentNode, {
                prevent_default: true
            }).on("release drag pinch transformend", testHammer);//release drag transformstart transformend rotate pinch", testHammer); // Missing event before drag after touch

            celSel = canvasArea.append("group")
                .attr("left", left)
                .attr("top", top)
                .attr("originX", "center")//center
                .attr("originY", "center");//center
            celSel.append("text")
                .attr("left", 0)
                .attr("top", 0)
                .attr("originY", "top")
                .attr("originX", "left")
                .attr("fontSize", 15)
                .text("Objects: 10");

            // Add nodes to Canvas:
            for (var i = 0; i < 10; i += 1) {
                addNodes(celSel);
            }

            // Render updates (temp fix)
            /*canvasElement.pumpRender();
            renderFront();*/
            updateCan();
        }

        function resize(width, height) {
            canvasWidth = width;
            canvasHeight = height;

            canvasShow.attr('width', canvasWidth);
            canvasShow.attr('height', canvasHeight);

            canvasRender.width = canvasWidth;
            canvasRender.height = canvasHeight;

            canvasElement.pumpRender();
            renderFront();
        }

        function remove() {
            if (canvasArea !== undefined) {
                canvasArea.selectAll("group").remove();
                canvasArea = undefined;
                canvasShow.remove();
                canvasShow = undefined;
                hammertime.off("release drag pinch transformend", testHammer);
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