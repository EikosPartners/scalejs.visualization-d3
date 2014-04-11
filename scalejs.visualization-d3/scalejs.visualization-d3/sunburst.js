﻿/*global define*/
define([
    'd3'
], function (
    d3
) {
    "use strict";

    return function () {
        var //Sunburst variables
            canvasElement,
            json,
            selectZoom,
            canvasWidth,
            canvasHeight,
            radius,
            x,
            y,
            root,
            sunburstLayout,
            arc,
            canvasArea,
            lastClickTime;

        function isParentOf(p, c) {
            if (p === c) {
                return true;
            }
            if (p.children) {
                return p.children.some(function (d) {
                    return isParentOf(d, c);
                });
            }
            return false;
        }

        function pathTween(p) {
            return function (d) {
                // Create interpolations used for a nice slide around the parent:
                var interpX = d3.interpolate(this.old.x, d.x),
                    interpY = d3.interpolate(this.old.y, d.y),
                    interpDX = d3.interpolate(this.old.dx, d.dx),
                    interpDY = d3.interpolate(this.old.dy, d.dy),
                    interpXD = d3.interpolate(this.old.xd, [p.x, p.x + p.dx]),
                    interpYD = d3.interpolate(this.old.yd, [p.y, 1]),
                    interpYR = d3.interpolate(this.old.yr, [p.y ? 20 : 0, radius]),
                    // Remember this element:
                    element = this;
                return function (t) { // Interpolate arc:
                    // Store new data in the old property:
                    element.old = {
                        x: interpX(t),
                        y: interpY(t),
                        dx: interpDX(t),
                        dy: interpDY(t),
                        xd: interpXD(t),
                        yd: interpYD(t),
                        yr: interpYR(t)
                    };
                    x.domain(element.old.xd);
                    y.domain(element.old.yd).range(element.old.yr);
                    var value = arc({
                        x: element.old.x,
                        y: element.old.y,
                        dx: element.old.dx,
                        dy: element.old.dy
                    });
                    element.initialize(value, {
                        left: element.left,
                        top: element.top,
                        width: element.width,
                        height: element.height,
                        //pathOffset: { x: 0, y: 0 },
                        d3fabricOrgPath: value
                    });
                };
            };
        }
        function textTween(p) {
            return function (d) {
                // Create interpolations used for a nice slide around the parent:
                var interpX = d3.interpolate(this.old.x, d.x),
                    interpY = d3.interpolate(this.old.y, d.y),
                    interpDX = d3.interpolate(this.old.dx, d.dx),
                    interpDY = d3.interpolate(this.old.dy, d.dy),
                    textElement = this;
                return function (t) { // Interpolate attributes:
                    var rad, radless, offsety, angle,
                        outerRadius, innerRadius, padding, arcWidth;
                    // Store new data in the old property:
                    textElement.old = {
                        x: interpX(t),
                        y: interpY(t),
                        dx: interpDX(t),
                        dy: interpDY(t)
                    };

                    // Update data:
                    d.w = this.width;
                    d.h = this.height;

                    // Calculate text angle:
                    rad = x(textElement.old.x + textElement.old.dx / 2);
                    radless = rad - Math.PI / 2;
                    offsety = y(d.y) + 2;
                    angle = rad * 180 / Math.PI - 90;
                    if (angle > 90) {
                        angle = (angle + 180) % 360;
                    }

                    // Change anchor based on side of Sunburst the text is on:
                    textElement.originX = rad > Math.PI ? "right" : "left";
                    textElement.left = offsety * Math.cos(radless);
                    textElement.top = offsety * Math.sin(radless);

                    // Setup variables for opacity:
                    outerRadius = Math.max(0, y(textElement.old.y + textElement.old.dy));
                    innerRadius = Math.max(0, y(textElement.old.y));
                    arcWidth = (x(textElement.old.x + textElement.old.dx) - x(textElement.old.x)) * y(textElement.old.y);

                    // Change opacity:
                    textElement.opacity = isParentOf(p, d) && (outerRadius - innerRadius - 4 >= d.w) && ((arcWidth - 2 >= d.h) || y(textElement.old.y) < 1) ? 1 : 0;

                    // Rotate text angle:
                    textElement.angle = angle;
                };
            };
        }
        // Zoom after click:
        function zoom(p) {
            if (canvasArea === undefined) {
                return; // Catch for if sunburst hasn't been setup.
            }
            // Animate sunburst nodes:
            var t = canvasArea.selectAll("group")
                .transition()
                .duration(d3.event ? (d3.event.altKey ? 7500 : 1000) : 1000)
                .tween("groupZoom", function (d) {
                    // Create interpolations used for a nice slide:
                    var interpX = d3.interpolate(this.left, canvasWidth / 2),
                        interpY = d3.interpolate(this.top, canvasHeight / 2),
                        element = this;
                    return function (t) {
                        element.left = interpX(t);
                        element.top = interpY(t);
                    };
                });

            t.select("path")
                .tween("pathZoom", pathTween(p));

            t.select("text")
                .tween("textZoom", textTween(p));

            // Prevent event from firing more than once:
            if (d3.event) {
                d3.event.stopPropagation();
            }
        }

        function addNodes(celSel) {
            // Add nodes to Canvas:
            var cell = celSel.enter().append("group").each(function (d) {
                this.originX = "center";
                this.originY = "center";
                this.left = canvasWidth / 2;
                this.top = canvasHeight / 2;
                this.perPixelTargetFind = true;
            }).on("mousedown", function (d) {
                var clickTime = (new Date()).getTime();
                if (clickTime - lastClickTime < 500) {
                    selectZoom(d);
                }
                lastClickTime = clickTime;
            });

            // Add arc to nodes:
            cell.append("path")
                .attr("d", function (d) {
                    this.fill = d.color;
                    this.old = {
                        x: d.x,
                        y: d.y,
                        dx: d.dx,
                        dy: d.dy,
                        xd: x.domain(),
                        yd: y.domain(),
                        yr: y.range()
                    };
                    return arc(d);
                });

            // Add text to nodes:
            cell.append("text").each(function (d) {
                this.originX = (x(d.x + d.dx / 2) > Math.PI) ? "right" : "left";
                this.originY = "center";
                this.fontSize = 11;
                this.setText(d.name);
                d.bw = y(d.y + d.dy) - y(d.y);
                d.bh = (x(d.x + d.dx) - x(d.x)) * y(d.y);
                this.opacity = (d.bw - 4 >= this.width) && ((d.bh - 2 >= this.height) || y(d.y) < 1) ? 1 : 0;
                var ang = x(d.x + d.dx / 2) * 180 / Math.PI - 90;
                if (ang > 90) {
                    ang = (ang + 180) % 360;
                }
                this.angle = ang;
                this.left = (y(d.y) + 2) * Math.cos(x(d.x + d.dx / 2) - Math.PI / 2);
                this.top = (y(d.y) + 2) * Math.sin(x(d.x + d.dx / 2) - Math.PI / 2);
                this.old = {
                    x: d.x,
                    y: d.y,
                    dx: d.dx,
                    dy: d.dy
                };
            });
        }

        function update() {
            if (canvasArea === undefined) {
                return; // Catch for if sunburst hasn't been setup.
            }
            // Define temp vars:
            var celSel, cell, nodes;

            // Get treemap data:
            root = json();

            // This is a sunburst being updated:
            // Filter out nodes with children:
            nodes = sunburstLayout.nodes(root);

            // Select all nodes in Canvas, and apply data:
            celSel = canvasArea.selectAll("group")
                .data(nodes, function (d) { return d.name; });

            // Update nodes on Canvas:
            cell = celSel.transition()
                .duration(1000)
                .tween("groupUpdate", function (d) {
                    // Create interpolations used for a nice slide:
                    var interpX = d3.interpolate(this.left, canvasWidth / 2),
                        interpY = d3.interpolate(this.top, canvasHeight / 2),
                        element = this;
                    return function (t) {
                        element.left = interpX(t);
                        element.top = interpY(t);
                    };
                });

            // Update arcs on Canvas:
            cell.select("path")
                .tween("pathUpdate", function (d) {
                    // Create interpolations used for a nice slide around the parent:
                    var p = nodes[0],
                        interpX = d3.interpolate(this.old.x, d.x),
                        interpY = d3.interpolate(this.old.y, d.y),
                        interpDX = d3.interpolate(this.old.dx, d.dx),
                        interpDY = d3.interpolate(this.old.dy, d.dy),
                        interpXD = d3.interpolate(this.old.xd, [p.x, p.x + p.dx]),
                        interpYD = d3.interpolate(this.old.yd, [p.y, 1]),
                        interpYR = d3.interpolate(this.old.yr, [p.y ? 20 : 0, radius]),
                        interpFill = d3.interpolate(this.fill, d.color),
                        // Remember this element:
                        element = this;
                    return function (t) { // Interpolate arc:
                        // Store new data in the old property:
                        element.old = {
                            x: interpX(t),
                            y: interpY(t),
                            dx: interpDX(t),
                            dy: interpDY(t),
                            xd: interpXD(t),
                            yd: interpYD(t),
                            yr: interpYR(t)
                        };
                        x.domain(element.old.xd);
                        y.domain(element.old.yd).range(element.old.yr);
                        element.fill = interpFill(t);
                        var value = arc({
                            x: element.old.x,
                            y: element.old.y,
                            dx: element.old.dx,
                            dy: element.old.dy
                        });
                        element.initialize(value, {
                            left: element.left,
                            top: element.top,
                            width: element.width,
                            height: element.height,
                            //pathOffset: { x: 0, y: 0 },
                            d3fabricOrgPath: value
                        });
                        /*var dim = element._parseDimensions();
                        delete dim.left;
                        delete dim.top;
                        element.set(dim);
                        element.setCoords();*/
                    };
                });

            // Update titles on Canvas:
            cell.select("text")
                .tween("textTween", textTween(nodes[0]));   // Sunburst Text Tween animation, zoom to root (node0)

            // Add nodes to Canvas:
            addNodes(celSel);

            // Remove nodes from Canvas:
            cell = celSel.exit().remove();
        }

        function init(
            element,
            width,
            height,
            jsonObservable,
            selectZoomFunction
        ) {
            if (canvasArea !== undefined) {
                return; // Catch for if sunburst has been setup.
            }
            canvasElement = element;
            json = jsonObservable;
            canvasWidth = width;
            canvasHeight = height;
            radius = Math.min(canvasWidth, canvasHeight) / 2;
            x = d3.scale.linear().range([0, 2 * Math.PI]);
            y = d3.scale.linear().range([0, radius]);//sqrt
            selectZoom = selectZoomFunction;

            // Define temp vars:
            var celSel, nodes;

            // Get sunburst data:
            root = json();

            // This is a new sunburst:
            // Setup sunburst and Canvas:
            sunburstLayout = d3.layout.partition()
                            .value(function (d) { return d.size; })
                            .children(function (d) { return d.children; });

            canvasArea = canvasElement.append("group").each(function () {
                this.originX = "center";
                this.originY = "center";
            });

            // Setup arc function:
            arc = d3.svg.arc()
                .startAngle(function (d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x))); })
                .endAngle(function (d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))); })
                .innerRadius(function (d) { return Math.max(0, y(d.y)); })
                .outerRadius(function (d) { return Math.max(0, y(d.y + d.dy)); });

            // Filter out nodes with children:
            nodes = sunburstLayout.nodes(root);

            // Join data with selection:
            celSel = canvasArea.selectAll("group")
                .data(nodes, function (d) { return d.name; });

            // Add nodes to Canvas:
            addNodes(celSel);

            canvasElement.pumpRender();
        }

        function resize(width, height) {
            canvasWidth = width;
            canvasHeight = height;

            radius = Math.min(canvasWidth, canvasHeight) / 2;
            y.range([0, radius]);
        }

        function remove() {
            if (canvasArea !== undefined) {
                canvasArea.remove();
                //canvasElement.select("group").remove();
                //canvasArea.selectAll("group").remove();
                canvasArea = undefined;
            }
        }

        // Return sunburst object:
        return {
            init: init,
            update: update,
            zoom: zoom,
            resize: resize,
            remove: remove,
            enableRotate: true
        };
    };
});
