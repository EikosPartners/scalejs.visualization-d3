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
            canvasArea,
            spacing = 3,
            parentColor = d3.interpolate("#888", "#fff");

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
            t = canvasArea.selectAll("group").transition()
                .duration(d3.event ? (d3.event.altKey ? 7500 : 1000) : 1000)
                .tween("groupZoom", function (d) {
                    // Create interpolations used for a nice slide:
                    var interpX = d3.interpolate(this.left, x(d.x)),
                        interpY = d3.interpolate(this.top, y(d.y)),
                        interpWidth = d3.interpolate(this.width, Math.max(kx * d.dx - spacing, 0)),
                        interpHeight = d3.interpolate(this.height, Math.max(ky * d.dy - spacing, 0)),
                        element = this;
                    return function (t) {
                        element.left = interpX(t);
                        element.top = interpY(t);
                        element.width = interpWidth(t);
                        element.height = interpHeight(t);
                    };
                });

            t.select("text").tween("textZoom", function (d) {
                // Create interpolations used for a nice slide:
                var interpX = d3.interpolate(this.left, kx * d.dx / 2),
                    interpY = d3.interpolate(this.top, ky * d.dy / 2),
                    interpOpacity = d3.interpolate(this.opacity, (kx * d.dx - 4 >= this.width) && (ky * d.dy - 2 >= this.height) ? 1 : 0),
                    element = this;
                return function (t) {
                    element.left = interpX(t);
                    element.top = interpY(t);
                    element.opacity = interpOpacity(t);
                };
            });

            // Prevent event from firing more than once:
            if (d3.event) {
                d3.event.stopPropagation();
            }
        }

        function addNodes(celSel) {
            // Add nodes to Canvas:
            var cell = celSel.enter().append("group")
                .each(function (d) {
                    //this.originX = "center";
                    //this.originY = "center";
                    this.left = d.x;
                    this.top = d.y;
                    this.width = Math.max(d.dx - spacing, 0);
                    this.height = Math.max(d.dy - spacing, 0);
                    this.backFill = d.children ? parentColor(d.lvl / (root.maxlvl - 1)) : d.color;
                })
                .filter(function (d) { return !d.children; })
                    .on("mousedown", function (d) { selectZoom(d.parent || root); });

            // Add title to each node:
            cell.append("text")
                .each(function (d) {
                this.originX = "center";
                this.originY = "center";
                this.left = d.dx / 2;
                this.top = d.dy / 2;
                this.setText(d.name);
                this.opacity = (d.dx - 4 >= this.width) && (d.dy - 2 >= this.height) ? 1 : 0;
            });
        }

        function update() {
            if (canvasArea === undefined) {
                return; // Catch for if treemap hasn't been setup.
            }
            // Define temp vars:
            var celSel, cell, nodes, textNodes;

            // Get treemap data:
            root = json();

            // This is a treemap being updated:
            // Filter out nodes with children:
            nodes = treemapLayout.size([canvasWidth, canvasHeight])
                    .nodes(root)
                    .sort(function (a, b) {
                        return a.depth === b.depth ? b.value - a.value : a.depth - b.depth;
                    });
                    //.filter(function (d) { return !d.children; });

            // Select all nodes in Canvas, and apply data:
            celSel = canvasArea.selectAll("group")
                    .data(nodes, function (d) { return d.name; });

            // Update nodes on Canvas:
            cell = celSel.transition()
                .duration(1000)
                .tween("groupTween", function (d) {
                    // Create interpolations used for a nice slide:
                    var interpX = d3.interpolate(this.left, d.x),
                        interpY = d3.interpolate(this.top, d.y),
                        interpWidth = d3.interpolate(this.width, Math.max(d.dx - spacing, 0)),
                        interpHeight = d3.interpolate(this.height, Math.max(d.dy - spacing, 0)),
                        interpFill = d3.interpolate(this.backFill, (d.children ? parentColor(d.lvl / (root.maxlvl - 1)) : d.color)),
                        element = this;
                    return function (t) {
                        element.left = interpX(t);
                        element.top = interpY(t);
                        element.width = interpWidth(t);
                        element.height = interpHeight(t);
                        element.backFill = interpFill(t);
                    };
                });
            celSel.filter(function (d) { return d.children; })
                    .on("mousedown", null);

            // Update each node's title:
            textNodes = cell.select("text");
            textNodes.filter(function (d) { return d.children; }).remove();
            textNodes.filter(function (d) { return !d.children; }).tween("textTween", function (d) {
                // Create interpolations used for a nice slide:
                var interpX = d3.interpolate(this.left, d.dx / 2),
                    interpY = d3.interpolate(this.top, d.dy / 2),
                    interpOpacity,
                    element = this;
                if (this.name !== d.name) {
                    this.setText(d.name);
                    interpOpacity = d3.interpolate(this.opacity, (d.dx - 4 >= this.width) && (d.dy - 2 >= this.height) ? 1 : 0);
                    return function (t) {
                        element.left = interpX(t);
                        element.top = interpY(t);
                        element.opacity = interpOpacity(t);
                    };
                }
                return function (t) {
                    element.left = interpX(t);
                    element.top = interpY(t);
                };
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
            selectZoomFunction//,
            //trueElement
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
                            .padding(function (d) { return d.parent && d.parent.children.length > 1 ? spacing : 0; })
                            .sticky(false)
                            .mode('squarify')
                            .value(function (d) { return d.size; })
                            .children(function (d) { return d.children; });

            canvasArea = canvasElement.append("group").each(function () {
                this.fontFamily = "Times New Roman";
                this.fontSize = 11;
                //this.originX = "center";
                //this.originY = "center";
            });

            // Filter out nodes with children:
            nodes = treemapLayout.nodes(root)
                .sort(function (a, b) {
                    return a.depth === b.depth ? b.value - a.value : a.depth - b.depth;
                });
                //.filter(function (d) { return !d.children; });

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
                canvasArea.remove();
                canvasArea = undefined;
            }
        }

        // Return treemap object:
        return {
            init: init,
            update: update,
            zoom: zoom,
            resize: resize,
            remove: remove,
            enableRotate: false,
            enableRootZoom: true
        };
    };
});