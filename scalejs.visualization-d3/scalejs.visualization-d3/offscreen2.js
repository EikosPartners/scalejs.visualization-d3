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
            left = 250,
            top = 250,
            leftVal = 250,
            topVal = 250,
            rotateStart = 0,
            rotateVal = 0,
            scaleStart = 1,
            scaleVal = 1,
            inZoom = false,
            mg,
                objnum = 10;

        function renderFront() {
            /*context.setTransform(1, 0, 0, 1, 0, 0);
            context.clearRect(0, 0, canvasWidth, canvasHeight);
            context.drawImage(canvas, 0, 0);
            canvasRender.getContext('2d').drawImage(canvas, 0, 0);
            canvas.getContext('2d').clearRect(0, 0, canvasWidth, canvasHeight);*/
        }

        // mat[0->5] = [a, b, c, d, tx, ty]
        // mat ~= |a, b, tx|    | a,  c, 0|
        //        |c, d, ty| OR | b,  d, 0|
        //        |0, 0,  1|    |tx, ty, 1|
        function Matrix() {
            this.set = function (mat) {
                this[0] = mat[0];
                this[1] = mat[1];
                this[2] = mat[2];
                this[3] = mat[3];
                this[4] = mat[4];
                this[5] = mat[5];
                return this;
            };
            this.translate = function (tx, ty) {
                return this.set(fabric.util.multiplyTransformMatrices(this, [1, 0, 0, 1, tx, ty]));
            };
            this.rotate = function (ang) {
                ang *= Math.PI / 180;
                var sin = Math.sin(ang),
                    cos = Math.cos(ang);
                return this.set(fabric.util.multiplyTransformMatrices(this, [cos, sin, -sin, cos, 0, 0]));
            };
            this.scaleX = function (scaleX) {
                return this.set(fabric.util.multiplyTransformMatrices(this, [scaleX, 0, 0, 1, 0, 0]));
            };
            this.scaleY = function (scaleY) {
                return this.set(fabric.util.multiplyTransformMatrices(this, [1, 0, 0, scaleY, 0, 0]));
            };
            this.scaleXY = function (scaleX, scaleY) {
                return this.set(fabric.util.multiplyTransformMatrices(this, [scaleX, 0, 0, scaleY, 0, 0]));
            };
            this.scale = function (scale) {
                return this.set(fabric.util.multiplyTransformMatrices(this, [scale, 0, 0, scale, 0, 0]));
            };
            return this.set([1, 0, 0, 1, 0, 0]);
        }
        function getLeft(mat) {
            return mat[4];
        }
        function getTop(mat) {
            return mat[5];
        }
        function sign(val) {
            if (val < 0) { return -1; }
            if (val > 0) { return 1; }
            return 0;
        };
        function getScaleX(mat) {
            return sign(mat[0]) * Math.sqrt(mat[0] * mat[0] + mat[1] * mat[1]);
        }
        function getScaleY(mat) {
            return sign(mat[3]) * Math.sqrt(mat[2] * mat[2] + mat[3] * mat[3]);
        }
        function getAngle(mat) {
            return Math.atan(mat[2] / mat[3]);
        }
        function getAttributes(mat) {
            return {
                left: getLeft(mat),
                top: getTop(mat),
                scaleX: getScaleX(mat),
                scaleY: getScaleY(mat),
                angle: getAngle(mat)
            };
        }

        // Zoom after click:
        function zoom(d) {
            if (canvasArea !== undefined && !inZoom) {
                left = Math.random() * 500 + 250;
                top = 250;
                leftVal = 250;
                topVal = 250;
                rotateStart = 0;
                rotateVal = 0;
                scaleStart = 1;
                scaleVal = 1;

                canvasArea.select("group")
                    .transition().duration(1000)
                    .attr("top", top)
                    .attr("left", left)
                    .attr("scaleX", scaleVal)
                    .attr("scaleY", scaleVal)
                    .attr("angle", rotateVal)
                    .tween("test", function (d) {
                        return function (t) {
                            renderFront();
                        }
                    });
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

                var test = new Matrix();
                console.log(test.rotate(rotateStart));
                console.log(test.scale(scaleStart));
                console.log(test.translate(groupPos.x, groupPos.y));
                console.log(test.rotate(event.gesture.rotation));
                console.log(test.scale(event.gesture.scale));
                console.log(test.translate(elementPos.pageX, elementPos.pageY));
                console.log(getAttributes(test));
                console.log({
                    left: left + scalePos.x,
                    top: top + scalePos.y,
                    scaleX: scaleVal,
                    scaleY: scaleVal,
                    angle: rotateVal / 180 * Math.PI
                });
                console.log({
                    left: left,
                    top: top
                });

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
            //renderFront();
            /*context.setTransform(1, 0, 0, 1, 0, 0);
            context.clearRect(0, 0, canvasWidth, canvasHeight);
            context.translate(250, 250);
            //context.scale(scaleVal, scaleVal);
            context.rotate(rotateVal / 180 * Math.PI);
            context.translate(-250, -250);
            context.drawImage(canvasRender, 0, 0);//leftVal, topVal);
            context.setTransform(1, 0, 0, 1, 0, 0);*/
            //canvas.getContext('2d').clearRect(0, 0, canvasWidth, canvasHeight);
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
            objnum+=10;
            celSel.select("text").text("Objects: " + objnum);

            // Remove nodes from Canvas:
            //cell = celSel.exit().remove();

            // Render updates (temp fix)
            canvasElement.pumpRender();
            renderFront();
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

            /*canvas = canvasArea.domNode()[0][0];
            canvasShow = d3.select(canvasArea[0][0].parentNode.parentNode)
                .append("canvas")
                    .style("position", "absolute")
                    .style("left", 0)
                    .style("top", 0)
                    .attr("width", canvasWidth)
                    .attr("height", canvasHeight);
            context = canvasShow[0][0].getContext('2d');
            canvasRender = document.createElement("canvas");
            canvasRender.width = 500;
            canvasRender.height = 500;
            */
            //canvasElement.remove();

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
            celSel.append("text")
                .attr("left", 0)
                .attr("top", 250+5)
                .attr("originY", "top")
                .attr("originX", "center")
                .text("Objects: 10");

            // Add nodes to Canvas:
            for (var i = 0; i < 10; i += 1) {
            addNodes(celSel);
            }

            // Render updates (temp fix)
            canvasElement.pumpRender();
            renderFront();
        }

        function resize(width, height) {
            canvasWidth = width;
            canvasHeight = height;

            canvasShow.attr('width', canvasWidth);
            canvasShow.attr('height', canvasHeight);
        }

        function remove() {
            //canvasShow[0][0].parentNode.appendChild(canvasArea);    //Temp
            if (canvasArea !== undefined) {
                canvasArea.selectAll("group").remove();
                canvasArea = undefined;
                //canvasShow.remove();
                //canvasShow = undefined;
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