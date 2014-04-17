/*global define*/
define([
    'd3',
    'canvas'
], function (
    d3,
    canvasSelect
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
            lastClickTime,
            lastClickNode;

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
                        element = this;
                    return function (t) {
                        element.left = interpX(t);
                        element.top = interpY(t);
                    };
                });

            t.select("rect").tween("rectZoom", function (d) {
                // Create interpolations used for a nice slide:
                var interpWidth = d3.interpolate(this.width, Math.max(kx * d.dx - 1, 0)),
                    interpHeight = d3.interpolate(this.height, Math.max(ky * d.dy - 1, 0)),
                    element = this;
                return function (t) {
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

            //canvasElement.pumpRender();
        }

        function addNodes(celSel) {
            // Add nodes to Canvas:
            var cell = celSel.enter().append("group").each(function (d) {
                //this.originX = "center";
                //this.originY = "center";
                this.left = d.x;
                this.top = d.y;
            }).on("mousedown", function (d) {
                /*var clickTime = (new Date()).getTime();
                if (clickTime - lastClickTime < 500 && lastClickNode === d) {
                    selectZoom(d.parent);
                }
                lastClickTime = clickTime;
                lastClickNode = d;*/
                selectZoom(d.parent);
            });

            // Add rectangle to each node:
            cell.append("rect").each(function (d) {
                this.width = Math.max(d.dx - 1, 0);
                this.height = Math.max(d.dy - 1, 0);
                this.fill = d.color;
            });

            // Add title to each node:
            cell.append("text").each(function (d) {
                this.originX = "center";
                this.originY = "center";
                this.left = d.dx / 2;
                this.top = d.dy / 2;
                this.fontSize = 11;
                this.setText(d.name);
                this.opacity = (d.dx - 4 >= this.width) && (d.dy - 2 >= this.height) ? 1 : 0;
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
                .tween("groupTween", function (d) {
                    // Create interpolations used for a nice slide:
                    var interpX = d3.interpolate(this.left, d.x),
                        interpY = d3.interpolate(this.top, d.y),
                        element = this;
                    return function (t) {
                        element.left = interpX(t);
                        element.top = interpY(t);
                    };
                });

            // Update each node's rectangle:
            cell.select("rect").tween("rectTween", function (d) {
                // Create interpolations used for a nice slide:
                var interpWidth = d3.interpolate(this.width, Math.max(d.dx - 1, 0)),
                    interpHeight = d3.interpolate(this.height, Math.max(d.dy - 1, 0)),
                    interpFill = d3.interpolate(this.fill, d.color),
                    element = this;
                return function (t) {
                    element.width = interpWidth(t);
                    element.height = interpHeight(t);
                    element.fill = interpFill(t);
                };
            });

            // Update each node's title:
            cell.select("text").tween("textTween", function (d) {
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

            //canvasElement.pumpRender();
        }

        function init(
            element,
            width,
            height,
            jsonObservable,
            selectZoomFunction,
            trueElement
        ) {
            if (canvasArea !== undefined) {
                return; // Catch for if treemap has been setup.
            }
            canvasElement = element;/*canvasSelect(trueElement.getElementsByTagName("canvas")[0])
                                .ease(d3.ease("cubic-in-out"));*///element
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

            canvasArea = canvasElement.append("group").each(function () {
                //this.originX = "center";
                //this.originY = "center";
            });

            // Filter out nodes with children:
            nodes = treemapLayout.nodes(root)
                    .filter(function (d) { return !d.children; });

            // Join data with selection:
            celSel = canvasArea.selectAll("group")
                    .data(nodes, function (d) { return d.name; });

            // Add nodes to Canvas:
            addNodes(celSel);

            //canvasElement.pumpRender();
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
                //canvasElement.select("group").remove();
                //canvasArea.selectAll("group").remove();
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
            enableRotate: false
        };
    };
});