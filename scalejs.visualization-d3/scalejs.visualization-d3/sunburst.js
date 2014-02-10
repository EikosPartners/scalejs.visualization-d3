/*global define*/
/*jslint browser: true */
define([
    //'scalejs!core',
    'd3'
], function (
    //core,
    d3
) {
    "use strict";

    return function () {
        var //Sunburst variables
            svgElement,
            json,
            selectZoom,
            elementStyle,
            svgWidth,
            svgHeight,
            radius,
            x,
            y,
            root,
            sunburstLayout,
            arc,
            svgArea;

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
                    textElement = this,
                    d3this = d3.select(this);
                return function (t) { // Interpolate attributes:
                    var rad, angle;
                    // Store new data in the old property:
                    textElement.old = {
                        x: interpX(t),
                        y: interpY(t),
                        dx: interpDX(t),
                        dy: interpDY(t)
                    };

                    // Calculate text angle:
                    rad = x(textElement.old.x + textElement.old.dx / 2);
                    angle = rad * 180 / Math.PI - 90;

                    // Change padding and anchor based on side of Sunburst the text is on:
                    if (rad > Math.PI) {
                        // Center of Sunburst is Right:
                        d3this.attr("dx", "-2px");
                        d3this.attr("text-anchor", "end");
                    } else {
                        // Center of Sunburst is Left:
                        d3this.attr("dx", "2px");
                        d3this.attr("text-anchor", "start");
                    }

                    // Change opacity:
                    d3this.style("opacity", function (d) {
                        var outerRadius = Math.max(0, y(textElement.old.y + textElement.old.dy)),
                            innerRadius = Math.max(0, y(textElement.old.y)),
                            padding = 4;    // 2 pixel padding on inner and outer radius
                        return isParentOf(p, d) && (outerRadius - innerRadius - padding >= d.w) ? 1 : 0;
                    });

                    d3this.attr("transform", "rotate(" + angle + ")translate(" + y(textElement.old.y) + ")rotate(" + (angle > 90 ? -180 : 0) + ")");
                };
            };
        }

        // Zoom after click:
        function zoom(p) {
            if (svgArea === undefined) {
                return; // Catch for if sunburst hasn't been setup.
            }
            // Animate sunburst nodes:
            var t = svgArea.selectAll("g.cell")
                .transition()
                .duration(d3.event ? (d3.event.altKey ? 7500 : 1000) : 1000);

            t.select("path")
                .attrTween("d", pathTween(p));

            // Somewhat of a hack as we rely on arcTween updating the scales.
            t.select("text")
                .tween("textTween", textTween(p));

            // Prevent event from firing more than once:
            if (d3.event) {
                d3.event.stopPropagation();
            }
        }

        function update() {
            if (svgArea === undefined) {
                return; // Catch for if sunburst hasn't been setup.
            }
            // Define temp vars:
            var celSel, cell, nodes;

            // Get treemap data:
            root = json();

            // This is a sunburst being updated:
            // Filter out nodes with children:
            nodes = sunburstLayout.nodes(root);

            // Select all nodes in SVG, and apply data:
            celSel = svgArea.selectAll("g")
                .data(nodes, function (d) { return d.name; });

            // Update nodes on SVG:
            cell = celSel.transition()
                .duration(1000);

            // Update arcs on SVG:
            cell.select("path")
                .attrTween("d", pathTween(nodes[0]))    // Sunburst Path attrTween animation, zoom to root (node0)
                .style("fill", function (d) { return d.color; });   //(d.parent ? d.parent.colorScale(d.color) : rootScale(d.color)); });

            // Update titles on SVG:
            cell.select("text")
                .text(function (d) {
                    d.w = this.getComputedTextLength();
                    return d.name;
                })
                .tween("textTween", textTween(nodes[0]));   // Sunburst Text Tween animation, zoom to root (node0)

            // Add nodes to SVG:
            cell = celSel.enter().append("svg:g")
                .attr("class", "cell")
                .on("click", selectZoom);

            // Add arc to nodes:
            cell.append("svg:path")
                .attr("d", arc)
                .style("fill", function (d) { return d.color; })    //(d.parent ? d.parent.colorScale(d.color) : rootScale(d.color)); });
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
            cell.append("svg:text")
                .text(function (d) { return d.name; })
                .attr("dy", "0.35em")   // Align vertically centered
                .attr("text-anchor", function (d) {
                    if (x(d.x + d.dx / 2) > Math.PI) {
                        // Center of Sunburst is Right:
                        d3.select(this).attr("dx", "-2px");
                        return "end";
                    }
                    // Center of Sunburst is Left:
                    d3.select(this).attr("dx", "2px");
                    return "start";
                })
                .style("opacity", function (d) {
                    d.w = this.getComputedTextLength();
                    return (y(d.y + d.dy) - y(d.y) > d.w) ? 1 : 0;
                })
                .attr("transform", function (d) {
                    var angle = x(d.x + d.dx / 2) * 180 / Math.PI - 90;
                    return "rotate(" + angle + ")translate(" + y(d.y) + ")rotate(" + (angle > 90 ? -180 : 0) + ")";
                })
                .each(function (d) {
                    this.old = {
                        x: d.x,
                        y: d.y,
                        dx: d.dx,
                        dy: d.dy
                    };
                });

            // Remove nodes from SVG:
            cell = celSel.exit().remove();
        }

        function init(
            element,
            jsonObservable,
            selectZoomFunction
        ) {
            if (svgArea !== undefined) {
                return; // Catch for if sunburst has been setup.
            }
            svgElement = element;
            json = jsonObservable;
            elementStyle = window.getComputedStyle(svgElement);
            svgWidth = parseInt(elementStyle.width, 10);
            svgHeight = parseInt(elementStyle.height, 10);
            radius = Math.min(svgWidth, svgHeight) / 2;
            x = d3.scale.linear().range([0, 2 * Math.PI]);
            y = d3.scale.sqrt().range([0, radius]);
            selectZoom = selectZoomFunction;

            // Define temp vars:
            var celSel, cell, nodes;

            // Get sunburst data:
            root = json();

            // This is a new sunburst:
            // Setup sunburst and SVG:
            sunburstLayout = d3.layout.partition()
                            .value(function (d) { return d.size; })
                            .children(function (d) { return d.children; });
            svgArea = d3.select(svgElement)
                .style('overflow', 'hidden')
                .append("g")
                    .attr("transform", "translate(" + svgWidth / 2 + "," + (svgHeight / 2) + ")");

            // Setup arc function:
            arc = d3.svg.arc()
                .startAngle(function (d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x))); })
                .endAngle(function (d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))); })
                .innerRadius(function (d) { return Math.max(0, y(d.y)); })
                .outerRadius(function (d) { return Math.max(0, y(d.y + d.dy)); });

            // Filter out nodes with children:
            nodes = sunburstLayout.nodes(root);

            // Join data with selection:
            celSel = svgArea.selectAll("g")
                .data(nodes, function (d) { return d.name; });

            // Add nodes to SVG:
            cell = celSel.enter().append("svg:g")
                .attr("class", "cell")
                .on("click", selectZoom);

            // Add arc to nodes:
            cell.append("svg:path")
                .attr("d", arc)
                .style("fill", function (d) { return d.color; })    //(d.parent ? d.parent.colorScale(d.color) : rootScale(d.color)); });
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
            cell.append("svg:text")
                .text(function (d) { return d.name; })
                .attr("dy", "0.35em")   // Align vertically centered
                .attr("text-anchor", function (d) {
                    if (x(d.x + d.dx / 2) > Math.PI) {
                        // Center of Sunburst is Right:
                        d3.select(this).attr("dx", "-2px");
                        return "end";
                    }
                    // Center of Sunburst is Left:
                    d3.select(this).attr("dx", "2px");
                    return "start";
                })
                .style("opacity", function (d) {
                    d.w = this.getComputedTextLength();
                    return (y(d.y + d.dy) - y(d.y) > d.w) ? 1 : 0;
                })
                .attr("transform", function (d) {
                    var angle = x(d.x + d.dx / 2) * 180 / Math.PI - 90;
                    return "rotate(" + angle + ")translate(" + y(d.y) + ")rotate(" + (angle > 90 ? -180 : 0) + ")";
                })
                .each(function (d) {
                    this.old = {
                        x: d.x,
                        y: d.y,
                        dx: d.dx,
                        dy: d.dy
                    };
                });
        }

        function resize() {
            elementStyle = window.getComputedStyle(svgElement);
            svgWidth = parseInt(elementStyle.width, 10);
            svgHeight = parseInt(elementStyle.height, 10);

            radius = Math.min(svgWidth, svgHeight) / 2;
            y.range([0, radius]);

            svgArea.attr("transform", "translate(" + svgWidth / 2 + "," + (svgHeight / 2) + ")");
        }

        function remove() {
            if (svgArea !== undefined) {
                svgArea.remove();
                svgArea = undefined;
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