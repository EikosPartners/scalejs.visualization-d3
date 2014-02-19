/*global define*/
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
            canvasArea;

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
                    pathElement = this;
                return function (t) { // Interpolate arc:
                    // Store new data in the old property:
                    pathElement.old = {
                        x: interpX(t),
                        y: interpY(t),
                        dx: interpDX(t),
                        dy: interpDY(t),
                        xd: interpXD(t),
                        yd: interpYD(t),
                        yr: interpYR(t)
                    };
                    x.domain(pathElement.old.xd);
                    y.domain(pathElement.old.yd).range(pathElement.old.yr);
                    return arc({
                        x: pathElement.old.x,
                        y: pathElement.old.y,
                        dx: pathElement.old.dx,
                        dy: pathElement.old.dy
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
                    d.w = this.getWidth();
                    d.h = this.getHeight();

                    // Calculate text angle:
                    rad = x(textElement.old.x + textElement.old.dx / 2);
                    radless = rad - Math.PI / 2;
                    offsety = y(d.y) + 2;
                    angle = rad * 180 / Math.PI - 90;
                    if (angle > 90) {
                        angle = (angle + 180) % 360;
                    }

                    // Change anchor based on side of Sunburst the text is on:
                    textElement.setOriginX((rad > Math.PI ? "right" : "left"));
                    textElement.setLeft(offsety * Math.cos(radless));
                    textElement.setTop(offsety * Math.sin(radless));

                    // Setup variables for opacity:
                    outerRadius = Math.max(0, y(textElement.old.y + textElement.old.dy));
                    innerRadius = Math.max(0, y(textElement.old.y));
                    padding = 2 + 2;    // 2 pixel padding on inner and outer radius
                    arcWidth = (x(textElement.old.x + textElement.old.dx) - x(textElement.old.x)) * y(textElement.old.y);

                    // Change opacity:
                    textElement.setOpacity(isParentOf(p, d) && (outerRadius - innerRadius - padding >= d.w) && ((arcWidth - 2 >= d.h) || y(textElement.old.y) < 1) ? 1 : 0);

                    // Rotate text angle:
                    textElement.setAngle(angle);
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
                .attr("left", canvasWidth / 2)
                .attr("top", canvasHeight / 2);

            t.select("path")
                .attrTween("d", pathTween(p));

            t.select("text")
                .tween("textTween", textTween(p));

            // Prevent event from firing more than once:
            if (d3.event) {
                d3.event.stopPropagation();
            }
        }

        function addNodes(celSel) {
            // Add nodes to Canvas:
            var cell = celSel.enter().append("group")
                .attr("originX", "center")
                .attr("originY", "center")
                .attr("left", canvasWidth / 2)
                .attr("top", canvasHeight / 2)
                .classed("cell", true)
                .property("perPixelTargetFind", true)
                .on("mousedown", selectZoom);

            // Add arc to nodes:
            cell.append("path")
                .attr("d", arc)
                .attr("fill", function (d) { return d.color; })
                .each(function (d) {
                    this.old = {
                        x: d.x,
                        y: d.y,
                        dx: d.dx,
                        dy: d.dy,
                        xd: x.domain(),
                        yd: y.domain(),
                        yr: y.range()
                    };
                });

            // Add text to nodes:
            cell.append("text")
                .attr("originX", function (d) { return (x(d.x + d.dx / 2) > Math.PI) ? "right" : "left"; })
                .attr("originY", "center")
                .text(function (d) { return d.name; })
                .attr("fontSize", 11)
                .attr("opacity", function (d) {
                    d.w = this.getWidth();
                    d.bw = y(d.y + d.dy) - y(d.y);
                    d.h = this.getHeight();
                    d.bh = (x(d.x + d.dx) - x(d.x)) * y(d.y);
                    var padding = 2 + 2;    // 2 for inside radius, 2 for outside radius.
                    return (d.bw - padding >= d.w) && ((d.bh - 2 >= d.h) || y(d.y) < 1) ? 1 : 0;
                })
                .attr("angle", function (d) {
                    var ang = x(d.x + d.dx / 2) * 180 / Math.PI - 90;
                    if (ang > 90) {
                        ang = (ang + 180) % 360;
                    }
                    return ang;
                })
                .attr("left", function (d) { return (y(d.y) + 2) * Math.cos(x(d.x + d.dx / 2) - Math.PI / 2); })
                .attr("top", function (d) { return (y(d.y) + 2) * Math.sin(x(d.x + d.dx / 2) - Math.PI / 2); })
                .each(function (d) {
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
                .attr("left", canvasWidth / 2)
                .attr("top", canvasHeight / 2);

            // Update arcs on Canvas:
            cell.select("path")
                .attrTween("d", pathTween(nodes[0]))    // Sunburst Path attrTween animation, zoom to root (node0)
                .attr("fill", function (d) { return d.color; });   //(d.parent ? d.parent.colorScale(d.color) : rootScale(d.color)); });

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
            y = d3.scale.sqrt().range([0, radius]);
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

            canvasArea = canvasElement;

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
        }

        function resize(width, height) {
            canvasWidth = width;
            canvasHeight = height;

            radius = Math.min(canvasWidth, canvasHeight) / 2;
            y.range([0, radius]);

            canvasArea
                .attr("left", canvasWidth / 2)
                .attr("top", canvasHeight / 2);
        }

        function remove() {
            if (canvasArea !== undefined) {
                canvasArea.selectAll("group").remove();
                canvasArea = undefined;
            }
        }

        // Return sunburst object:
        return {
            init: init,
            update: update,
            zoom: zoom,
            resize: resize,
            remove: remove
        };
    };
});
