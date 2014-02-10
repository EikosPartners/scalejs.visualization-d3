/*global define*/
/*jslint browser: true */
define([
    //'scalejs!core',
    //'knockout',
    'd3'
], function (
    //core,
    //ko,
    d3
) {
    "use strict";

    return function () {
        var //Treemap variables
            svgElement,
            json,
            selectZoom,
            elementStyle,
            svgWidth,
            svgHeight,
            x,
            y,
            root,
            treemapLayout,
            svgArea;

        // Zoom after click:
        function zoom(d) {
            if (svgArea === undefined) {
                return; // Catch for if treemap hasn't been setup.
            }
            // Set zoom domain to d's area:
            var kx = svgWidth / d.dx, ky = svgHeight / d.dy, t;
            x.domain([d.x, d.x + d.dx]);
            y.domain([d.y, d.y + d.dy]);

            // Animate treemap nodes:
            t = svgArea.selectAll("g.cell").transition()
                .duration(d3.event ? (d3.event.altKey ? 7500 : 1000) : 1000)
                .attr("transform", function (d) { return "translate(" + x(d.x) + "," + y(d.y) + ")"; });

            t.select("rect")
                .attr("width", function (d) { return Math.max(kx * d.dx - 1, 0); })
                .attr("height", function (d) { return Math.max(ky * d.dy - 1, 0); });

            t.select("text")
                .attr("x", function (d) { return kx * d.dx / 2; })
                .attr("y", function (d) { return ky * d.dy / 2; })
                .style("opacity", function (d) { return kx * d.dx > d.w ? 1 : 0; });

            // Prevent event from firing more than once:
            if (d3.event) {
                d3.event.stopPropagation();
            }
        }

        function update() {
            if (svgArea === undefined) {
                return; // Catch for if treemap hasn't been setup.
            }
            // Define temp vars:
            var celSel, cell, nodes;

            // Get treemap data:
            root = json();

            // Get domData from element (used to see if treemap was setup before):
            //domData = ko.utils.domData.get(svgElement, 'selection');

            // This is a treemap being updated:
            // Filter out nodes with children:
            nodes = treemapLayout.size([svgWidth, svgHeight])
                    .nodes(root)
                    .filter(function (d) { return !d.children; });

            // Select all nodes in SVG, and apply data:
            celSel = svgArea.selectAll("g")
                    .data(nodes, function (d) { return d.name; });

            // Update nodes on SVG:
            cell = celSel.transition()
                .duration(1000)
                .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });

            // Update rectangles on SVG:
            cell.select("rect")
                .attr("width", function (d) { return Math.max(d.dx - 1, 0); })
                .attr("height", function (d) { return Math.max(d.dy - 1, 0); })
                .style("fill", function (d) { return d.color; });

            // Update titles on SVG:
            cell.select("text")
                .attr("x", function (d) { return d.dx / 2; })
                .attr("y", function (d) { return d.dy / 2; })
                .text(function (d) { return d.name; })
                .style("opacity", function (d) { d.w = this.getComputedTextLength(); return d.dx > d.w ? 1 : 0; });


            // Add new nodes to SVG:
            cell = celSel.enter().append("svg:g")
                    .attr("class", "cell")
                    .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })
                    .on("click", selectZoom);

            // Add rectangle to each new node on SVG:
            cell.append("svg:rect")
                .attr("width", function (d) { return Math.max(d.dx - 1, 0); })
                .attr("height", function (d) { return Math.max(d.dy - 1, 0); })
                .style("fill", function (d) { return d.color; });

            // Add title to each new node on SVG:
            cell.append("svg:text")
                .attr("x", function (d) { return d.dx / 2; })
                .attr("y", function (d) { return d.dy / 2; })
                .attr("dy", ".35em")
                .attr("text-anchor", "middle")
                .text(function (d) { return d.name; })
                .style("opacity", function (d) { d.w = this.getComputedTextLength(); return d.dx > d.w ? 1 : 0; });

            // Remove nodes from SVG:
            cell = celSel.exit().remove();

            // Set domData for SVG:
            //ko.utils.domData.set(svgElement, 'selection', {});
        }

        function init(
            element,
            jsonObservable,
            selectZoomFunction
        ) {
            if (svgArea !== undefined) {
                return; // Catch for if treemap has been setup.
            }
            svgElement = element;
            json = jsonObservable;
            elementStyle = window.getComputedStyle(svgElement);
            svgWidth = parseInt(elementStyle.width, 10);
            svgHeight = parseInt(elementStyle.height, 10);
            x = d3.scale.linear().range([0, svgWidth]);
            y = d3.scale.linear().range([0, svgHeight]);
            selectZoom = selectZoomFunction;

            // Define temp vars:
            var celSel, cell, nodes;

            // Get treemap data:
            root = json();

            // This is a new treemap:
            // Setup treemap and SVG:
            treemapLayout = d3.layout.treemap()
                            .round(false)
                            .size([svgWidth, svgHeight])
                            .sticky(false)
                            .mode('squarify')
                            .value(function (d) { return d.size; })
                            .children(function (d) { return d.children; });
            svgArea = d3.select(svgElement)
                      .style('overflow', 'hidden')
                      .append("g")
                        .attr("transform", "translate(.5,.5)");

            // Filter out nodes with children:
            nodes = treemapLayout.nodes(root)
                    .filter(function (d) { return !d.children; });

            // Join data with selection:
            celSel = svgArea.selectAll("g")
                    .data(nodes, function (d) { return d.name; });

            // Add nodes to SVG:
            cell = celSel.enter().append("svg:g")
                    .attr("class", "cell")
                    .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })
                    .on("click", selectZoom);

            // Add rectangle to each node:
            cell.append("svg:rect")
                .attr("width", function (d) { return Math.max(d.dx - 1, 0); })
                .attr("height", function (d) { return Math.max(d.dy - 1, 0); })
                .style("fill", function (d) { return d.color; });

            // Add title to each node:
            cell.append("svg:text")
                .attr("x", function (d) { return d.dx / 2; })
                .attr("y", function (d) { return d.dy / 2; })
                .attr("dy", ".35em")
                .attr("text-anchor", "middle")
                .text(function (d) { return d.name; })
                .style("opacity", function (d) { d.w = this.getComputedTextLength(); return d.dx > d.w ? 1 : 0; });
        }

        function resize() {
            elementStyle = window.getComputedStyle(svgElement);
            svgWidth = parseInt(elementStyle.width, 10);
            svgHeight = parseInt(elementStyle.height, 10);

            x.range([0, svgWidth]);
            y.range([0, svgHeight]);

            svgArea.attr('width', svgWidth);
            svgArea.attr('height', svgHeight);
        }

        function remove() {
            if (svgArea !== undefined) {
                svgArea.remove();
                svgArea = undefined;
            }
        }

        // Return treemap object:
        return {
            init: init,
            update: update,
            zoom: zoom,
            resize: resize,
            remove: remove
        };
    };
});