/*global define*/
define([
    'd3'
], function (
    d3
) {
    "use strict";

    return function () {
        var //Treemap variables
            canvasElement,
            json,
            selectZoom,
            canvasWidth,
            canvasHeight,
            x,
            y,
            root,
            treemapLayout,
            canvasArea;

        // Zoom after click:
        function zoom(d) {
            if (canvasArea === undefined) {
                return; // Catch for if treemap hasn't been setup.
            }
            // Set zoom domain to d's area:
            var kx = canvasWidth / d.dx, ky = canvasHeight / d.dy, t;
            x.domain([d.x, d.x + d.dx]);
            y.domain([d.y, d.y + d.dy]);

            // Animate treemap nodes:
            t = canvasArea.selectAll("group.cell").transition()
                .duration(d3.event ? (d3.event.altKey ? 7500 : 1000) : 1000)
                .attr("left", function (d) { return x(d.x); })
                .attr("top", function (d) { return y(d.y); });

            t.select("rect")
                .attr("width", function (d) { return Math.max(kx * d.dx - 1, 0); })
                .attr("height", function (d) { return Math.max(ky * d.dy - 1, 0); });

            t.select("text")
                .attr("left", function (d) { return kx * d.dx / 2; })
                .attr("top", function (d) { return ky * d.dy / 2; })
                .attr("opacity", function (d) {
                    d.w = this.getWidth();
                    d.h = this.getHeight();
                    var padding = 2 + 2;    // 2 for inside radius, 2 for outside radius.
                    return (kx * (d.dx - padding) >= d.w) && (ky * (d.dy - 2) >= d.h) ? 1 : 0;
                });

            // Prevent event from firing more than once:
            if (d3.event) {
                d3.event.stopPropagation();
            }
        }

        function scale(val) {
            if (canvasArea === undefined) {
                return; // Catch for if treemap hasn't been setup.
            }
            canvasArea.selectAll("group.cell").transition()
                .duration(d3.event ? (d3.event.altKey ? 7500 : 1000) : 1000)
                .attr("left", function (d) { return x(d.x * val); })
                .attr("top", function (d) { return y(d.y * val); })
                .attr("scaleX", val)
                .attr("scaleY", val);
        }

        function addNodes(celSel) {
            // Add nodes to Canvas:
            var cell = celSel.enter().append("group")
                .attr("originX", "center")
                .attr("originY", "center")
                .attr("left", function (d) { return d.x; })
                .attr("top", function (d) { return d.y; })
                .classed("cell", true)
                .on("mousedown", selectZoom);

            // Add rectangle to each node:
            cell.append("rect")
                .attr("width", function (d) { return Math.max(d.dx - 1, 0); })
                .attr("height", function (d) { return Math.max(d.dy - 1, 0); })
                .attr("fill", function (d) { return d.color; });

            // Add title to each node:
            cell.append("text")
                .attr("originX", "center")
                .attr("originY", "center")
                .attr("left", function (d) { return d.dx / 2; })
                .attr("top", function (d) { return d.dy / 2; })
                .attr("fontSize", 11)
                .text(function (d) { return d.name; })
                .attr("opacity", function (d) {
                    d.w = this.getWidth();
                    d.h = this.getHeight();
                    var padding = 2 + 2;    // 2 for inside radius, 2 for outside radius.
                    return (d.dx - padding >= d.w) && (d.dy - 2 >= d.h) ? 1 : 0;
                });
        }

        function update() {
            if (canvasArea === undefined) {
                return; // Catch for if treemap hasn't been setup.
            }
            // Define temp vars:
            var celSel, cell, nodes;

            // Get treemap data:
            root = json();

            // This is a treemap being updated:
            // Filter out nodes with children:
            nodes = treemapLayout.size([canvasWidth, canvasHeight])
                    .nodes(root)
                    .filter(function (d) { return !d.children; });

            // Select all nodes in Canvas, and apply data:
            celSel = canvasArea.selectAll("group")
                    .data(nodes, function (d) { return d.name; });

            // Update nodes on Canvas:
            cell = celSel.transition()
                .duration(1000)
                .attr("left", function (d) { return d.x; })
                .attr("top", function (d) { return d.y; });

            // Update each node's rectangle:
            cell.select("rect")
                .attr("width", function (d) { return Math.max(d.dx - 1, 0); })
                .attr("height", function (d) { return Math.max(d.dy - 1, 0); })
                .attr("fill", function (d) { return d.color; });

            // Update each node's title:
            cell.select("text")
                .attr("left", function (d) { return d.dx / 2; })
                .attr("top", function (d) { return d.dy / 2; })
                .text(function (d) { return d.name; })
                .attr("opacity", function (d) {
                    d.w = this.getWidth();
                    d.h = this.getHeight();
                    var padding = 2 + 2;    // 2 for inside radius, 2 for outside radius.
                    return (d.dx - padding >= d.w) && (d.dy - 2 >= d.h) ? 1 : 0;
                });

            // Add new nodes to Canvas:
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
                return; // Catch for if treemap has been setup.
            }
            canvasElement = element;
            json = jsonObservable;
            canvasWidth = width;
            canvasHeight = height;
            x = d3.scale.linear().range([0, canvasWidth]);
            y = d3.scale.linear().range([0, canvasHeight]);
            selectZoom = selectZoomFunction;

            // Define temp vars:
            var celSel, nodes;

            // Get treemap data:
            root = json();

            // This is a new treemap:
            // Setup treemap and SVG:
            treemapLayout = d3.layout.treemap()
                            .round(false)
                            .size([canvasWidth, canvasHeight])
                            .sticky(false)
                            .mode('squarify')
                            .value(function (d) { return d.size; })
                            .children(function (d) { return d.children; });

            canvasArea = canvasElement;

            // Filter out nodes with children:
            nodes = treemapLayout.nodes(root)
                    .filter(function (d) { return !d.children; });

            // Join data with selection:
            celSel = canvasArea.selectAll("group")
                    .data(nodes, function (d) { return d.name; });

            // Add nodes to Canvas:
            addNodes(celSel);
        }

        function resize(width, height) {
            canvasWidth = width;
            canvasHeight = height;

            x.range([0, canvasWidth]);
            y.range([0, canvasHeight]);
        }

        function remove() {
            if (canvasArea !== undefined) {
                canvasArea.selectAll("group").remove();
                canvasArea = undefined;
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