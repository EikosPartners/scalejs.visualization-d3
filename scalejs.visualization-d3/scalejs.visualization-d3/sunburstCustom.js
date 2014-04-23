/*global define*/
define([
    'd3'
], function (
    d3
) {
    "use strict";

    function mapValue() {
        var domain = [0, 1], range = [0, 1],
            domain_length = 1, range_length = 1;

        function scale(x) {
            return (x - domain[0]) / domain_length * range_length + range[0];
        }

        scale.domain = function (d) {
            if (!arguments.length) { return domain; };
            domain = d;
            domain_length = domain[1] - domain[0];
            return scale;
        };
        scale.range = function (r) {
            if (!arguments.length) { return range; };
            range = r;
            range_length = range[1] - range[0];
            return scale;
        };

        return scale;
    }

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
            currentZoomNode;

        function startAngle(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x))); }
        function endAngle(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))); }
        function innerRadius(d) { return Math.max(0, y(d.y)); }
        function outerRadius(d) { return Math.max(0, y(d.y + d.dy)); }

        /*function isParentOf(p, c) {
            if (p === c) {
                return true;
            }
            if (p.children) {
                return p.children.some(function (d) {
                    return isParentOf(d, c);
                });
            }
            return false;
        }*/

        function zoomTween(p) {
            return function () {
                // Create interpolations used for clamping all arcs to ranges:
                var interpXD = d3.interpolate(x.domain(), [p.x, p.x + p.dx]),
                    interpYD = d3.interpolate(y.domain(), [p.y, 1]),
                    interpYR = d3.interpolate(y.range(), [p.y ? p.dy * radius / 2 : 0, radius]);
                return function (t) {
                    // Set clamps for arcs:
                    x.domain(interpXD(t));
                    y.domain(interpYD(t)).range(interpYR(t));
                };
            };
        }
        function arcTween() {
            return function (d) {
                // Create interpolations used for a nice slide around the parent:
                var interpX = d3.interpolate(this.old.x, d.x),
                    interpY = d3.interpolate(this.old.y, d.y),
                    interpDX = d3.interpolate(this.old.dx, d.dx),
                    interpDY = d3.interpolate(this.old.dy, d.dy),
                    interpFill = d3.interpolate(this.fill, d.color),
                    // Remember this element:
                    element = this;
                return function (t) { // Interpolate arc:
                    // Store new data in the old property:
                    element.old.x = interpX(t);
                    element.old.y = interpY(t);
                    element.old.dx = interpDX(t);
                    element.old.dy = interpDY(t);
                    element.fill = interpFill(t);
                    this.innerRadius = innerRadius(element.old);
                    this.outerRadius = outerRadius(element.old);
                    this.startAngle = startAngle(element.old);
                    this.endAngle = endAngle(element.old);
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
                    // Remember this element:
                    element = this,
                    // Interpolate attributes:
                    rad, radless, offsety, angle,
                    outerRad, innerRad, arcStartAngle, arcEndAngle, arcWidth;
                return function (t) {
                    // Store new data in the old property:
                    element.old.x = interpX(t);
                    element.old.y = interpY(t);
                    element.old.dx = interpDX(t);
                    element.old.dy = interpDY(t);

                    // Setup variables for opacity:
                    outerRad = outerRadius(element.old);
                    innerRad = innerRadius(element.old);
                    arcStartAngle = startAngle(element.old);
                    arcEndAngle = endAngle(element.old);
                    arcWidth = (arcEndAngle - arcStartAngle) * innerRad;

                    // Calculate text angle:
                    rad = x(element.old.x + element.old.dx / 2);
                    radless = rad - Math.PI / 2;
                    offsety = y(d.y) + 2;
                    angle = rad * 180 / Math.PI - 90;
                    element.left = offsety * Math.cos(radless);
                    element.top = offsety * Math.sin(radless);
                    if (p !== d) {
                        // Flip text right side up:
                        if (angle > 90) {
                            angle = (angle + 180) % 360;
                        }
                        // Change anchor based on side of Sunburst the text is on:
                        element.originX = rad > Math.PI ? "right" : "left";

                        // Change opacity:
                        element.opacity = (outerRad - innerRad - 4 >= this.width) && ((arcWidth - 2 >= this.height) || (p === d && innerRad < 1)) ? 1 : 0;// isParentOf(p, d) && // || innerRad < 1
                    } else {
                        angle -= 90;
                        // Change anchor based on side of Sunburst the text is on:
                        element.originX = "center";
                        element.originY = "top";

                        // Change opacity:
                        element.opacity = (outerRad - innerRad - 4 >= this.height) && ((arcWidth - 2 >= this.width) || (p === d && innerRad < 1)) ? 1 : 0;// isParentOf(p, d) && // || innerRad < 1
                    }

                    // Rotate text angle:
                    element.angle = angle;
                };
            };
        }
        // Zoom after click:
        function zoom(p) {
            if (canvasArea === undefined || currentZoomNode === p) {
                return; // Catch for if sunburst hasn't been setup.
            }
            // Animate sunburst nodes:
            var t = canvasArea
                .transition()
                .duration(d3.event ? (d3.event.altKey ? 7500 : 1000) : 1000)
                .tween("zoom", zoomTween(p))
                .selectAll("group")
                    .tween("groupZoom", function () {
                        // Create interpolations used for a nice slide:
                        var interpX = d3.interpolate(this.left, canvasWidth / 2),
                            interpY = d3.interpolate(this.top, canvasHeight / 2),
                            element = this;
                        return function (t) {
                            element.left = interpX(t);
                            element.top = interpY(t);
                        };
                    });

            t.select("arc")
                .tween("arcZoom", arcTween(p));

            t.select("text")
                .tween("textZoom", textTween(p));

            // Set current zoomed node:
            currentZoomNode = p;

            // Prevent event from firing more than once:
            if (d3.event) {
                d3.event.stopPropagation();
            }
        }

        function addNodes(celSel) {
            // Add nodes to Canvas:
            var cell = celSel.enter().append("group").each(function (d) {
                //this.originX = "center";
                //this.originY = "center";
                this.left = canvasWidth / 2;
                this.top = canvasHeight / 2;
                this.perPixelTargetFind = true;
            });

            // Add arc to nodes:
            cell.append("arc")
                .each(function (d) {
                    this.fill = d.color;
                    this.innerRadius = innerRadius(d);
                    this.outerRadius = outerRadius(d);
                    this.startAngle = startAngle(d);
                    this.endAngle = endAngle(d);
                    this.old = {
                        x: d.x,
                        y: d.y,
                        dx: d.dx,
                        dy: d.dy
                    };
                }).on("mousedown", selectZoom);

            // Add text to nodes:
            cell.append("text").each(function (d) {
                if (root !== d) {
                    // Change anchor based on side of Sunburst the text is on:
                    this.originX = (x(d.x + d.dx / 2) > Math.PI) ? "right" : "left";
                    this.originY = "center";
                } else {
                    // Change anchor based on side of Sunburst the text is on:
                    this.originX = "center";
                    this.originY = "top";
                }
                //this.fontSize = 11;
                this.setText(d.name);
                d.bw = y(d.y + d.dy) - y(d.y);
                d.bh = (x(d.x + d.dx) - x(d.x)) * y(d.y);
                var ang = x(d.x + d.dx / 2) * 180 / Math.PI - 90;
                if (root !== d) {
                    // Flip text right side up:
                    if (ang > 90) {
                        ang = (ang + 180) % 360;
                    }
                    // Change opacity:
                    this.opacity = (d.bw - 4 >= this.width) && ((d.bh - 2 >= this.height) || (root === d && y(d.y) < 1)) ? 1 : 0;
                } else {
                    ang -= 90;
                    // Change opacity:
                    this.opacity = (d.bw - 4 >= this.height) && ((d.bh - 2 >= this.width) || (root === d && y(d.y) < 1)) ? 1 : 0;
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
            x = d3.scale.linear().range([0, 2 * Math.PI]);
            y = d3.scale.linear().range([0, radius]);

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
            cell.select("arc")
                .tween("arcUpdate", arcTween(nodes[0]));

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
            x = mapValue().range([0, 2 * Math.PI]);//d3.scale.linear().range([0, 2 * Math.PI]);
            y = mapValue().range([0, radius]);//d3.scale.linear().range([0, radius]);//sqrt
            selectZoom = selectZoomFunction;

            // Define temp vars:
            var celSel, nodes;

            // Get sunburst data:
            root = json();
            currentZoomNode = root;

            // This is a new sunburst:
            // Setup sunburst and Canvas:
            sunburstLayout = d3.layout.partition()
                            .value(function (d) { return d.size; })
                            .children(function (d) { return d.children; });

            canvasArea = canvasElement.append("group").each(function () {
                this.fontFamily = "Times New Roman";
                this.fontSize = 11;
                //this.originX = "center";
                //this.originY = "center";
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

            //canvasElement.pumpRender();
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
            enableRotate: true,
            enableRootZoom: false
        };
    };
});
