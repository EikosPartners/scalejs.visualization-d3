/*global define*/
define([
    'knockout',
    'd3',
    'scalejs.visualization-d3/canvas-helper',
    'scalejs.visualization-d3/gesture-helper'
], function (
    ko,
    d3,
    canvasHelper,
    gestureHelperCreator
) {
    "use strict";
    var unwrap = ko.utils.unwrapObservable;
    return function () {
        var gestureHelper = gestureHelperCreator(),
            //Sunburst variables
            visualization,
            canvas,
            json,
            touchFunc,
            zoomFunc,
            heldFunc,
            releaseFunc,
            canvasWidth,
            canvasHeight,
            radius,
            x,
            y,
            root,
            sunburstLayout,
            canvasZoom,
            canvasArea,
            params,
            tempObject,
            elementStyle,
            canvasElement;

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

        function parseColor(color) {
            var rgba, opacity = 1;
            if (color.indexOf("rgba") === 0) {
                rgba = color.substring(5, color.length - 1)
                     .replace(/ /g, '')
                     .split(',');
                opacity = Number(rgba.pop());
                color = "rgb(" + rgba.join(",") + ")";
            }
            return {
                color: color,
                opacity: opacity
            };
        }

        function startAngle(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x))); }
        function endAngle(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))); }
        function innerRadius(d) { return Math.max(0, y(d.y)); }
        function outerRadius(d) { return Math.max(0, y(d.y + d.dy)); }

        function repeat(n, r) {
            var a = [], i;
            for (i = 0; i < n; i += 1) {
                a[i] = r;
            }
            return a;
        }

        function mapFrToPx(params, p) {
            var sum = 0,
                a = params.levelsFr,
                fr = params.fr || 1,
                parentFr = params.parentFr || 1;

            if (a.length < root.maxlvl + 1) {
                a = a.concat(repeat(root.maxlvl - a.length + 1, fr));
            }
            a = a.map(function (x, i) {
                if (i === p.lvl - 1) {
                    return sum += parentFr;
                }
                if (i > p.lvl - 1 && i <= root.curMaxLevel) {
                    return sum += x;
                }
                return sum;
            }).map(function (x, i, arr) {
                return x / arr[arr.length - 1] * radius;
            });
            a.unshift(0);
            return a;
        }
        function mapRangeToDomain(a, p) {
            var arr = [], i;
            for (i = 0; i < a.length; i++) {
                arr.push(i / (a.length - 1));
            }
            return arr;
        }

        // The order the following tweens appear MUST be called in the same order!
        function zoomTween(p) {
            var override = params && params.levelsFr,
                range = override ? mapFrToPx(params, p)
                        : [p.y ? p.dy * radius / 2 : 0, radius],
                domain = override ? mapRangeToDomain(range, p) : [p.y, (root.curMaxLevel + 1) / (root.maxlvl + 1)];

            return function () {
                // Create interpolations used for clamping all arcs to ranges:
                var interpXD = d3.interpolate(x.domain(), [p.x, p.x + p.dx]),
                    // GLITCH: when previous domain/range is not the same length as new domain/range. It works when all levels are visible, but not with only some.
                    interpYD = d3.interpolate(y.domain(), domain),
                    interpYR = d3.interpolate(y.range(), range); //checks if its the root (or has no parent)
                return function (t) {
                    // Set clamps for arcs:
                    x.domain(interpXD(t));
                    y.domain(interpYD(t)).range(interpYR(t));
                };
            };
        }
        function groupTween(opacity) {
            return function (d) {
                // Create interpolations used for a nice slide:
                var interpOldX = d3.interpolate(this.old.x, d.x),
                    interpOldY = d3.interpolate(this.old.y, d.y),
                    interpOldDX = d3.interpolate(this.old.dx, d.dx),
                    interpOldDY = d3.interpolate(this.old.dy, d.dy),
                    interpX = d3.interpolate(this.left, canvasWidth / 2),
                    interpY = d3.interpolate(this.top, canvasHeight / 2),
                    newColor = parseColor(d.color),
                    interpOpacity = d3.interpolate(this.opacity, opacity * newColor.opacity);
                return function (t) {
                    // Store new data in the old property:
                    this.old.x = interpOldX(t);
                    this.old.y = interpOldY(t);
                    this.old.dx = interpOldDX(t);
                    this.old.dy = interpOldDY(t);

                    this.left = interpX(t);
                    this.top = interpY(t);
                    this.opacity = interpOpacity(t);
                };
            };
        }
        function arcTween() {
            return function (d) {
                // Create interpolations used for a nice slide around the parent:
                var newColor = parseColor(d.color),
                    interpFill = d3.interpolate(this.fill, newColor.color),
                    interpOpacity = d3.interpolate(this.opacity, newColor.opacity);
                return function (t) { // Interpolate arc:
                    // Store new data in the old property:
                    this.fill = interpFill(t);
                    this.opacity = interpOpacity(t);
                    this.innerRadius = innerRadius(this.old);
                    this.outerRadius = outerRadius(this.old);
                    this.startAngle = startAngle(this.old);
                    this.endAngle = endAngle(this.old);
                };
            };
        }
        function textTween(p) {
            return function (d) {
                // Create interpolations used for a nice slide around the parent:
                var newColor = parseColor(d.fontColor),
                    interpFill = d3.interpolate(this.fill, newColor.color),
                    interpOpacity = d3.interpolate(this.opacity, newColor.opacity),
                    // Interpolate attributes:
                    rad, radless, offsety, angle,
                    outerRad, innerRad, arcStartAngle, arcEndAngle, arcWidth;
                this.fontFamily = d.fontFamily;
                this.fontSize = d.fontSize;
                return function (t) {
                    // Setup variables for opacity:
                    outerRad = outerRadius(this.old);
                    innerRad = innerRadius(this.old);
                    arcStartAngle = startAngle(this.old);
                    arcEndAngle = endAngle(this.old);
                    arcWidth = (arcEndAngle - arcStartAngle) * innerRad;

                    // Calculate color:
                    this.fill = interpFill(t);

                    // Calculate text angle:
                    rad = x(this.old.x + this.old.dx / 2);
                    radless = rad - Math.PI / 2;
                    offsety = y(d.y) + 2;
                    angle = rad * 180 / Math.PI - 90;
                    this.left = offsety * Math.cos(radless);
                    this.top = offsety * Math.sin(radless);
                    if (p !== d) {
                        // Flip text right side up:
                        if (angle > 90) {
                            angle = (angle + 180) % 360;
                        }
                        // Change anchor based on side of Sunburst the text is on:
                        this.originX = rad > Math.PI ? "right" : "left";

                        // Change opacity:
                        if (visualization.allowTextOverflow) {
                            this.opacity = interpOpacity(t);
                        } else {
                            this.opacity = (outerRad - innerRad - 4 >= this.width) && ((arcWidth - 2 >= this.height) || (p === d && innerRad < 1)) ? interpOpacity(t) : 0;
                        }
                    } else {
                        angle -= 90;
                        // Change anchor based on side of Sunburst the text is on:
                        this.originX = "center";
                        this.originY = "top";

                        // Change opacity:
                        if (visualization.allowTextOverflow) {
                            this.opacity = interpOpacity(t);
                        } else {
                            this.opacity = (outerRad - innerRad - 4 >= this.height) && ((arcWidth - 2 >= this.width) || (p === d && innerRad < 1)) ? interpOpacity(t) : 0;
                        }
                    }

                    // Rotate text angle:
                    this.angle = (params && params.enableRotatedText != null) ? (params.enableRotatedText ? angle : 0) : angle;
                };
            };
        }

        function update(p, duration) {
            // Get sunburst specific parameters:
            params = unwrap(visualization.parameters);

            // Get transition duration parameter:
            duration = duration !== undefined ? duration : 1000;

            // Get treemap data:
            root = json();

            // Define temp vars:
            var nodes, groupNodes, newGroupNodes, removeGroupNodes, arcNodes, newArcNodes, removeArcNodes, textNodes, newTextNodes, removeTextNodes,
                zoomTreePath = getNodeTreePath(p);

            // This is a sunburst being updated:
            // Filter out nodes with children:
            nodes = sunburstLayout.sort(root.sortBy).nodes(root)
                .filter(function (d) {
                    return getDistanceToTreePath(d, zoomTreePath) < root.maxVisibleLevels;
                });

            // Select all nodes in Canvas, and apply data:
            groupNodes = canvasArea.selectAll("group")
                .data(nodes, function (d) { return d.id; });

            // Add new nodes to Canvas:
            newGroupNodes = groupNodes.enter().append("group")
                .each(function (d) {
                    this.left = canvasWidth / 2;
                    this.top = canvasHeight / 2;
                    this.opacity = 0;
                    this.old = {
                        x: d.x,
                        y: d.y,
                        dx: d.dx,
                        dy: d.dy
                    };
                });

            // Add arc to each node:
            newArcNodes = newGroupNodes.append("arc")
                .each(function (d) {
                    this.fill = d.color;
                    this.outerRadius = this.innerRadius = innerRadius(d);
                    //innerRadius(d);//outerRadius(d);
                    this.endAngle = this.startAngle = (endAngle(d) - startAngle(d)) / 2;//startAngle(d);
                    //this.endAngle = endAngle(d);
                    this.old = this.parent.old;
                })
                .on("touch", touchFunc)
                .on("tap", zoomFunc)
                .on("hold", heldFunc)
                .on("release", releaseFunc);

            // Add text to each node:
            newTextNodes = newGroupNodes.append("text")
                .each(function (d) {
                    if (root !== d) {
                        // Change anchor based on side of Sunburst the text is on:
                        this.originX = (x(d.x + d.dx / 2) > Math.PI) ? "right" : "left";
                        this.originY = "center";
                    } else {
                        // Change anchor based on side of Sunburst the text is on:
                        this.originX = "center";
                        this.originY = "top";
                    }
                    this.fontFamily = d.fontFamily;
                    this.fontSize = d.fontSize;
                    var newColor = parseColor(d.fontColor),
                        ang = x(d.x + d.dx / 2) * 180 / Math.PI - 90;
                    this.fill = newColor.color;
                    this.setText(d.name);
                    d.bw = y(d.y + d.dy) - y(d.y);
                    d.bh = (x(d.x + d.dx) - x(d.x)) * y(d.y);
                    if (root !== d) {
                        // Flip text right side up:
                        if (ang > 90) {
                            ang = (ang + 180) % 360;
                        }

                        // Change opacity:
                        if (visualization.allowTextOverflow) {
                            this.opacity = newColor.opacity;
                        } else {
                            this.opacity = (d.bw - 4 >= this.height) && ((d.bh - 2 >= this.width) || (root === d && y(d.y) < 1)) ? newColor.opacity : 0;
                        }
                    } else {
                        ang -= 90;

                        // Change opacity:
                        if (visualization.allowTextOverflow) {
                            this.opacity = newColor.opacity;
                        } else {
                            this.opacity = (d.bw - 4 >= this.width) && ((d.bh - 2 >= this.height) || (root === d && y(d.y) < 1)) ? newColor.opacity : 0;
                        }
                    }
                    this.angle = ang;
                    this.left = (Math.max(y(d.y), 0) + 2) * Math.cos(x(d.x + d.dx / 2) - Math.PI / 2);
                    this.top = (Math.max(y(d.y), 0) + 2) * Math.sin(x(d.x + d.dx / 2) - Math.PI / 2);
                    this.old = this.parent.old;
                });

            // Add tween to Canvas:
            canvasArea.transition().duration(duration)
                .tween("zoomTween", zoomTween(p));

            // Add tween to new nodes:
            newGroupNodes.transition().duration(duration)
                .tween("groupTween", groupTween(1));
            // Add tween to new arcs:
            newArcNodes.transition().duration(duration)
                .tween("arcTween", arcTween(p));
            // Add tween to new text:
            newTextNodes.transition().duration(duration)
                .tween("textTween", textTween(p));

            // Add tween to current nodes:
            groupNodes.transition().duration(duration)
                .tween("groupTween", groupTween(1));
            // Add tween to current arcs:
            arcNodes = groupNodes.select("arc").transition().duration(duration)
                .tween("arcTween", arcTween(p));
            // Add tween to current text:
            textNodes = groupNodes.select("text").transition().duration(duration)
                .tween("textTween", textTween(p));

            // Remove missing nodes:
            removeGroupNodes = groupNodes.exit().transition().duration(duration)
                .tween("groupTween", groupTween(0))
                .each(function () {
                    this.remove();
                }, "end");
            removeArcNodes = removeGroupNodes.select("arc").tween("arcTween", arcTween(p));
            removeTextNodes = removeGroupNodes.select("text").tween("textTween", textTween(p));

            // Prevent event from firing more than once:
            if (d3.event) {
                d3.event.stopPropagation();
            }
        }


        function init(
            parameters,
            jsonObservable,
            nodeSelected
        ) {
            json = jsonObservable;
            radius = Math.min(canvasWidth, canvasHeight) / 2;
            x = d3.scale.linear().range([0, 2 * Math.PI]);
            y = d3.scale.linear().range([0, radius]);

            // Define temp vars:
            var zoomTreePath = getNodeTreePath(nodeSelected),
                nodes;

            // Get sunburst data:
            root = json();

            // This is a new sunburst:
            // Setup sunburst and Canvas:
            sunburstLayout = d3.layout.partition()
                            .sort(root.sortBy)
                            .value(function (d) { return d.size; })
                            .children(function (d) { return d.children; });

            canvasZoom = canvas.append("group");
            canvasArea = canvasZoom.append("group").each(function () {
                this.fontFamily = "Times New Roman";
                this.fontSize = 11;
            });

            // Filter out nodes with children:
            nodes = sunburstLayout.nodes(root)
                .filter(function (d) {
                    return getDistanceToTreePath(d, zoomTreePath) < root.maxVisibleLevels;
                });

            // Join data with selection (may not be needed):
            canvasArea.selectAll("group")
                .data(nodes, function (d) { return d.id; });

            // Add nodes to Canvas:
            x.domain([nodeSelected.x, nodeSelected.x + nodeSelected.dx]);
            y.domain([nodeSelected.y, (root.curMaxLevel + 1) / (root.maxlvl + 1)]).range([nodeSelected.y ? nodeSelected.dy * radius / 2 : 0, radius]);
            update(nodeSelected, 0);
        }

        function resize(width, height) {
            canvasWidth = width;
            canvasHeight = height;

            radius = Math.min(canvasWidth, canvasHeight) / 2;
            y.range([0, radius]);
        }

        function remove() {
            if (canvasArea !== undefined) {
                canvasZoom.remove();
                canvasZoom = undefined;
                canvasArea = undefined;
            }
        }

        function initializeCanvas(element) {

            tempObject = canvasHelper.initializeCanvas(element);

            canvas = tempObject.canvas;
            canvasWidth = tempObject.canvasWidth;
            canvasHeight = tempObject.canvasHeight;
            canvasElement = tempObject.canvasElement;
            elementStyle = tempObject.elementStyle;

        }

        function getCanvas() {
            return canvas;
        }

        function getCanvasWidth() {
            return canvasWidth;
        }

        function getCanvasHeight() {
            return canvasHeight;
        }

        function getCanvasElement() {
            return canvasElement;
        }

        function getElementStyle() {
            return elementStyle;
        }

        function setLayoutHandler(element, zoomedNode) {
            gestureHelper.setLayoutHandler(element, canvas, canvasWidth, canvasHeight, update, zoomedNode);
        }

        function setupGestures (
                enableRotate,
                enableTouch,
                enableZoom,
                heldItemPath,
                selectedItemPath,
                zoomedItemPath,
                zoomedNode,
                root
            
        ) {
            var tempFuncObj = gestureHelper.setupGestures(
                    visualization,
                    canvas,
                    canvasElement,
                    canvasWidth,
                    canvasHeight,
                    enableRotate,
                    enableTouch,
                    enableZoom,
                    heldItemPath,
                    selectedItemPath,
                    zoomedItemPath,
                    zoomedNode,
                    root
            );

            touchFunc = tempFuncObj.selectTouch;
            zoomFunc = tempFuncObj.selectZoom;
            heldFunc = tempFuncObj.selectHeld;
            releaseFunc = tempFuncObj.selectRelease;
        }

        function resetTransformations() {
            gestureHelper.resetTransformations();
        }

        // Return sunburst object:
        visualization = {
            init: init,
            update: update,
            resize: resize,
            remove: remove,
            initializeCanvas: initializeCanvas,
            getCanvas: getCanvas,
            getCanvasWidth: getCanvasWidth,
            getCanvasHeight: getCanvasHeight,
            getCanvasElement: getCanvasElement,
            getElementStyle: getElementStyle,
            setLayoutHandler: setLayoutHandler,
            setupGestures: setupGestures,
            resetTransformations: resetTransformations,
            enableRotate: true,
            enableRotateDefault: true,
            enableRootZoom: false,
            fontSize: 11,
            fontFamily: "Times New Roman",
            allowTextOverflow: false
        };
        return visualization;
    };
});
