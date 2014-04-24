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
            parentColor = d3.interpolate("#888", "#fff"),
            lastZoomlvl = 0,
            kx, ky;

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
        function getNodeTreePath(node) {
            var path = [];
            while (node !== root) {
                path.push(node);
                node = node.parent;
            }
            path.push(node);
            return path;
        }
        function getDistanceToTreePath(node, treePath) {
            var distance = 0;
            while (treePath.indexOf(node) < 0) {
                distance += 1;
                node = node.parent;
            }
            return distance;
        }

        function getNodeSpaced(d, origD) {
            if (!d.parent) {
                // Don't add margin to root nodes:
                return {
                    x: d.x,
                    y: d.y,
                    dx: d.dx,
                    dy: d.dy,
                };
            }
            var spx = spacing / kx,
                spy = spacing / ky,
                p = getNodeSpaced(d.parent);
            if (origD) {
                // If original node, halve the spacing to match the spacing between parent and children:
                return {
                    x: p.dx / d.parent.dx * (d.x - d.parent.x) + p.x + spx/2,
                    y: p.dy / d.parent.dy * (d.y - d.parent.y) + p.y + spy / 2,
                    dx: p.dx / d.parent.dx * d.dx - spx,
                    dy: p.dy / d.parent.dy * d.dy - spy
                };
            }
            return {
                x: p.dx / d.parent.dx * (d.x - d.parent.x) + p.x + spx,
                y: p.dy / d.parent.dy * (d.y - d.parent.y) + p.y + spy,
                dx: p.dx / d.parent.dx * d.dx - spx * 2,
                dy: p.dy / d.parent.dy * d.dy - spy * 2
            };
        }

        function groupTween(p, opacity) {
            return function (d) {
                // Create interpolations used for a nice slide:
                var nodeSpaced = getNodeSpaced(d, d),
                    interpX, interpY,
                    interpWidth, interpHeight,
                    newFill = (d.children && d.lvl < root.curMaxLevel ? parentColor(d.lvl / (root.maxlvl - 1)) : d.color),
                    interpFill = d3.interpolate(this.backFill, newFill),
                    interpOpacity = d3.interpolate(this.opacity, opacity),
                    element = this;
                d.sx = x(nodeSpaced.x);
                d.sy = y(nodeSpaced.y);
                d.sdx = Math.max(kx * nodeSpaced.dx, 0);
                d.sdy = Math.max(ky * nodeSpaced.dy, 0);
                interpX = d3.interpolate(this.left, d.sx);
                interpY = d3.interpolate(this.top, d.sy);
                interpWidth = d3.interpolate(this.width, d.sdx);
                interpHeight = d3.interpolate(this.height, d.sdy);
                // Performance optimization:
                if (newFill !== this.backFill) {
                    return function (t) {
                        element.left = interpX(t);
                        element.top = interpY(t);
                        element.width = interpWidth(t);
                        element.height = interpHeight(t);
                        element.backFill = interpFill(t);
                        element.opacity = interpOpacity(t);
                    };
                } else {
                    return function (t) {
                        element.left = interpX(t);
                        element.top = interpY(t);
                        element.width = interpWidth(t);
                        element.height = interpHeight(t);
                        element.opacity = interpOpacity(t);
                    };
                }
            };
        }
        function textTween(p) {
            return function (d) {
                // Create interpolations used for a nice slide:
                var sp = spacing * d.lvl,
                    interpX = d3.interpolate(this.left, d.sdx / 2),//kx * d.dx / 2),
                    interpY = d3.interpolate(this.top, d.sdy / 2),//ky * d.dy / 2),
                    interpOpacity = d3.interpolate(this.opacity, !(d.children && d.lvl < root.curMaxLevel) && (d.sdx - 1 >= this.width) && (d.sdy - 1 >= this.height) ? 1 : 0),
                    //interpOpacity = d3.interpolate(this.opacity, !(d.children && d.lvl < root.curMaxLevel) && (kx * d.dx - sp * 2 >= this.width) && (ky * d.dy - sp * 2 >= this.height) ? 1 : 0),
                    element = this;
                return function (t) {
                    element.left = interpX(t);
                    element.top = interpY(t);
                    element.opacity = interpOpacity(t);
                };
            };
        }

        // Zoom after click:
        function zoom(p) {
            if (canvasArea === undefined) {
                return; // Catch for if treemap hasn't been setup.
            }

            update(p);

            //lastZoomlvl = p.lvl;
            // Prevent event from firing more than once:
            if (d3.event) {
                d3.event.stopPropagation();
            }
        }

        function update(p, duration) {
            if (canvasArea === undefined) {
                return; // Catch for if treemap hasn't been setup.
            }

            // Get transition duration parameter:
            duration = duration !== undefined ? duration : 1000;

            // Get treemap data:
            root = json();

            // Define temp vars:
            var nodes, groupNodes, newGroupNodes, removeGroupNodes, textNodes, newTextNodes, removeTextNodes,
                zoomTreePath = getNodeTreePath(p);

            // This is a treemap being updated:
            // Filter out nodes with children:
            nodes = treemapLayout.size([canvasWidth, canvasHeight])
                .nodes(root)
                .filter(function (d) {
                    return getDistanceToTreePath(d, zoomTreePath) < root.maxVisibleLevels;
                })
                .sort(function (a, b) {
                    return a.depth === b.depth ? b.value - a.value : a.depth - b.depth;
                });

            // Select all nodes in Canvas, and apply data:
            groupNodes = canvasArea.selectAll("group")
                .data(nodes, function (d) { return d.name; });

            // Add new nodes to Canvas:
            newGroupNodes = groupNodes.enter().append("group")
                .each(function (d) {
                    if (d.parent) {
                        this.left = x(d.parent.x) + kx * d.parent.dx / 2;
                        this.top = y(d.parent.y) + ky * d.parent.dy / 2;
                    } else {
                        this.left = x(d.x) + kx * d.dx / 2;
                        this.top = y(d.y) + ky * d.dy / 2;
                    }
                    this.backFill = d.children && d.lvl < root.curMaxLevel ? parentColor(d.lvl / (root.maxlvl - 1)) : d.color;
                    this.opacity = 0;
                });
            // Add mousedown event to nodes that are treated as leaf nodes:
            newGroupNodes.filter(function (d) { return !(d.children && d.lvl < root.curMaxLevel); })
                .on("mousedown", function (d) { selectZoom(d.parent || root); });

            // Add text to each node:
            newTextNodes = newGroupNodes.append("text")
                .each(function (d) {
                    this.originX = "center";
                    this.originY = "center";
                    this.left = 0;
                    this.top = 0;
                    this.setText(d.name);
                    //this.static = true;
                    this.opacity = (d.parent && d.parent.children && d.parent.lvl < root.curMaxLevel) && (kx * d.dx - spacing * 2 >= this.width) && (ky * d.dy - spacing * 2 >= this.height) ? 1 : 0;
                });

            // Set zoom domain to d's area:
            kx = canvasWidth / p.dx;
            ky = canvasHeight / p.dy;
            x.domain([p.x, p.x + p.dx]);
            y.domain([p.y, p.y + p.dy]);


            // Add tween to new groups:
            newGroupNodes.transition().duration(duration)
                .tween("groupTween", groupTween(p, 1));
            // Add tween to new text:
            newTextNodes.transition().duration(duration)
                .tween("textTween", textTween(p));

            // Update current nodes on Canvas:
            groupNodes.filter(function (d) { return d.children && d.lvl < root.curMaxLevel; })
                .on("mousedown", null);
            groupNodes.filter(function (d) { return !(d.children && d.lvl < root.curMaxLevel); })
                .on("mousedown", function (d) { selectZoom(d.parent || root); });
            // Add tween to current nodes on Canvas:
            groupNodes.transition().duration(duration)
                .tween("groupTween", groupTween(p, 1));

            // Update current text on Canvas:
            textNodes = groupNodes.select("text").transition().duration(duration)
                .tween("textTween", textTween(p));

            // Remove missing nodes:
            removeGroupNodes = groupNodes.exit().transition().duration(duration)
                .tween("groupTween", function (d) {
                    // Create interpolations used for a nice slide:
                    var nodeSpaced = getNodeSpaced(d.parent || d, d.parent || d),
                        interpX = d3.interpolate(this.left, x(nodeSpaced.x + nodeSpaced.dx / 2)),
                        interpY = d3.interpolate(this.top, y(nodeSpaced.y + nodeSpaced.dy / 2)),
                        interpWidth = d3.interpolate(this.width, 0),
                        interpHeight = d3.interpolate(this.height, 0),
                        interpOpacity = d3.interpolate(this.opacity, 0),
                        element = this;
                    return function (t) {
                        element.left = interpX(t);
                        element.top = interpY(t);
                        element.width = interpWidth(t);
                        element.height = interpHeight(t);
                        element.opacity = interpOpacity(t);
                    };
                })
                .each(function () {
                    this.remove();
                }, "end");
            removeTextNodes = removeGroupNodes.select("text")
                .each(function (d) {
                    d.sdx = 0;
                    d.sdy = 0;
                })
                .tween("textTween", textTween(p));
        }

        function init(
            element,
            width,
            height,
            jsonObservable,
            selectZoomFunction,
            nodeSelected//,
            //trueElement
        ) {
            if (canvasArea !== undefined) {
                return; // Catch for if treemap has been setup.
            }
            canvasElement = element;
            json = jsonObservable;
            canvasWidth = width;
            canvasHeight = height;
            x = mapValue().range([0, canvasWidth]);//d3.scale.linear().range([0, canvasWidth]);
            y = mapValue().range([0, canvasHeight]);//d3.scale.linear().range([0, canvasHeight]);
            selectZoom = selectZoomFunction;

            // Define temp vars:
            var celSel, nodes,
                zoomTreePath = getNodeTreePath(nodeSelected);

            // Get treemap data:
            root = json();

            // This is a new treemap:
            // Setup treemap and SVG:
            treemapLayout = d3.layout.treemap()
                            .round(false)
                            .size([canvasWidth, canvasHeight])
                            //.padding(function (d) { return d.parent && d.parent.children.length > 1 ? spacing : 0; })
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
                .filter(function (d) {
                    return getDistanceToTreePath(d, zoomTreePath) < root.maxVisibleLevels;
                })
                .sort(function (a, b) {
                    return a.depth === b.depth ? b.value - a.value : a.depth - b.depth;
                });
                //.filter(function (d) { return !d.children; });

            // Join data with selection:
            celSel = canvasArea.selectAll("group")
                    .data(nodes, function (d) { return d.name; });

            // Add nodes to Canvas:
            //addNodes(celSel);
            kx = canvasWidth / nodeSelected.dx;
            ky = canvasHeight / nodeSelected.dy;
            x.domain([nodeSelected.x, nodeSelected.x + nodeSelected.dx]);
            y.domain([nodeSelected.y, nodeSelected.y + nodeSelected.dy]);
            update(nodeSelected, 0);
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