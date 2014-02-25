/*global define*/
/*jslint browser: true */
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
            //lastEvent,
            //lastGesture,
            lastTouches,
            lastCenter,
            inZoom = false,
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

        function renderEnd() {
            canvas.getContext('2d').clearRect(0, 0, canvasWidth, canvasHeight);
        }

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
            scaleVal = scaleStart * val;
        }
        function rotate(ang) {
            if (canvasArea === undefined) {
                return; // Catch for if treemap hasn't been setup.
            }
            rotateVal = rotateStart + ang;
        }
        function pan(dx, dy) {
            if (canvasArea === undefined) {
                return; // Catch for if treemap hasn't been setup.
            }
            leftVal = left + dx;
            topVal = top + dy;
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

            var gesture = event.gesture,
                touches = [],
                center,
                scaleDiff,
                rotateDiff,
                pagePos,
                elementPos,
                groupPos,
                rotatePos,
                scalePos,
                transPos,
                sin,
                cos,
                i;

            // Convert touches to an array (to avoid safari's reuse of touch objects):
            for (i = 0; i < gesture.touches.length; i += 1) {
                touches[i] = {
                    pageX: gesture.touches[i].pageX,
                    pageY: gesture.touches[i].pageY
                };
            }

            function distance(p1, p2) { // Get distance between two points:
                var x = p1.pageX - p2.pageX,
                    y = p1.pageY - p2.pageY;
                return Math.sqrt(x * x + y * y);
            }

            if (event.type === "touch") {
                // Set all last* variables to starting gesture:
                //lastEvent = event;
                //lastGesture = gesture;
                lastTouches = touches;
                // Calculate Center:
                if (touches.length === 2) {
                    lastCenter = {
                        x: (touches[0].pageX - touches[1].pageX) / 2 + touches[1].pageX,
                        y: (touches[0].pageY - touches[1].pageY) / 2 + touches[1].pageY
                    };
                } else {
                    lastCenter = {
                        x: touches[0].pageX,
                        y: touches[0].pageY
                    };
                }
            } else if (event.type === "release") {
                // Reset all last* variables, and update fabric canvas to get crisper image:
                //lastEvent = undefined;
                //lastGesture = undefined;
                lastTouches = undefined;
                lastCenter = undefined;
                updateCan();
            } else {
                // Last action was a release, so fix lastTouches:
                if (lastTouches === undefined) {
                    lastTouches = touches;
                }
                if (touches.length === 1) {
                    // Starting action, so reset lastTouches:
                    if (lastTouches.length !== 1) {
                        lastTouches = touches;
                        lastCenter = undefined; // Prevent rotating when removing finger.
                    }

                    // Calculate Center:
                    center = {
                        x: touches[0].pageX,
                        y: touches[0].pageY
                    };

                    // Translate:
                    left += touches[0].pageX - lastTouches[0].pageX;
                    top += touches[0].pageY - lastTouches[0].pageY;
                    pan(0, 0);
                } else if (touches.length === 2) {
                    // Starting action, so reset lastTouches:
                    if (lastTouches.length !== 2) {
                        lastTouches = touches;
                        lastCenter = undefined; // Prevent rotating when adding finger.
                    }

                    // Calculate Center:
                    center = {
                        x: (touches[0].pageX - touches[1].pageX) / 2 + touches[1].pageX,
                        y: (touches[0].pageY - touches[1].pageY) / 2 + touches[1].pageY
                    };
                    if (lastCenter === undefined) {
                        lastCenter = center;
                    }

                    // Calculate Scale:
                    scaleDiff = distance(touches[0], touches[1]) / distance(lastTouches[0], lastTouches[1]);

                    // Calculate Rotation:
                    rotateDiff = Math.atan2(lastTouches[0].pageX - lastCenter.x, lastTouches[0].pageY - lastCenter.y) - Math.atan2(touches[0].pageX - center.x, touches[0].pageY - center.y);
                    // Get sin and cos of angle in radians (for later):
                    sin = Math.sin(rotateDiff);
                    cos = Math.cos(rotateDiff);
                    // Convert to degrees for fabric:
                    rotateDiff *= 180 / Math.PI;

                    // Apply Scale:
                    scaleStart *= scaleDiff;
                    scale(1);

                    // Apply Rotation:
                    rotateStart += rotateDiff;
                    rotate(0);

                    // Get canvas position:
                    pagePos = event.currentTarget.getBoundingClientRect();
                    // Convert page coords to canvas coords:
                    elementPos = {
                        pageX: center.x,
                        pageY: center.y
                    };
                    elementPos.pageX -= pagePos.left;
                    elementPos.pageY -= pagePos.top;

                    // Get difference between center position and group:
                    groupPos = {
                        x: left - elementPos.pageX,
                        y: top - elementPos.pageY
                    };

                    // Rotate around point:
                    rotatePos = {
                        x: groupPos.x * cos - groupPos.y * sin + elementPos.pageX,
                        y: groupPos.x * sin + groupPos.y * cos + elementPos.pageY
                    };

                    // Scale relative to center point:
                    scalePos = {
                        x: scaleDiff * (rotatePos.x - elementPos.pageX) + elementPos.pageX - left,
                        y: scaleDiff * (rotatePos.y - elementPos.pageY) + elementPos.pageY - top
                    };

                    // Translate delta in center position:
                    transPos = {
                        x: scalePos.x + (center.x - lastCenter.x),
                        y: scalePos.y + (center.y - lastCenter.y)
                    };

                    // Apply Translate:
                    left += transPos.x;
                    top += transPos.y;
                    pan(0, 0);
                }

                context.setTransform(1, 0, 0, 1, 0, 0);
                context.clearRect(0, 0, canvasWidth, canvasHeight);
                context.translate(leftVal, topVal);
                context.scale(scaleVal, scaleVal);
                context.rotate(rotateVal / 180 * Math.PI);
                context.translate(-leftVal, -topVal);
                context.drawImage(canvasRender, leftVal, topVal);
                context.setTransform(1, 0, 0, 1, 0, 0);

                //lastEvent = event;
                //lastGesture = gesture;
                lastTouches = touches;
                lastCenter = center;
            }
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

            // Render updates (temp fix):
            updateCan();
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
            }).on("touch drag swipe pinch rotate transform release", testHammer);//release drag transformstart transformend rotate pinch", testHammer); // Missing event before drag after touch

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
            for (i = 0; i < 10; i += 1) {
                addNodes(celSel);
            }

            // Render updates (temp fix):
            updateCan();
        }

        function resize(width, height) {
            canvasWidth = width;
            canvasHeight = height;

            canvasShow.attr('width', canvasWidth);
            canvasShow.attr('height', canvasHeight);

            canvasRender.width = canvasWidth;
            canvasRender.height = canvasHeight;

            updateCan();
        }

        function remove() {
            if (canvasArea !== undefined) {
                canvasArea.selectAll("group").remove();
                canvasArea = undefined;
                canvasShow.remove();
                canvasShow = undefined;
                canvasRender.remove();
                canvasRender = undefined;
                hammertime.off("touch drag swipe pinch rotate transform release", testHammer);
                hammertime.enable(false);
                hammertime = undefined;
            }
        }

        // Return treemap object:
        return {
            init: init,
            update: update,
            zoom: zoom,
            renderEnd: renderEnd,
            resize: resize,
            remove: remove
        };
    };
});