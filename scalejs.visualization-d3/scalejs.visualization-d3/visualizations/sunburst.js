/*global define*/
define([
    'knockout',
    'd3',
    'scalejs.visualization-d3/canvas-helper',
    'scalejs.visualization-d3/gesture-helper',
    'scalejs.visualization-d3/json-helper',
    'scalejs.visualization-d3/nested-data-helper',
    'scalejs.visualization-d3/color-helper'
], function (
    ko,
    d3,
    canvasHelper,
    gestureHelperCreator,
    jsonHelper,
    nestedDataHelper,
    colorHelper
) {
    "use strict";
    var // Imports
        unwrap = ko.utils.unwrapObservable,
        observable = ko.observable,
        isObservable = ko.isObservable,
        getNode = nestedDataHelper.getNode,
        getDistanceToTreePath = nestedDataHelper.getDistanceToTreePath,
        getNodeTreePath = nestedDataHelper.getNodeTreePath,
        parseColor = colorHelper.parseColor;


    function createInstance() {
        var
            canvasInfo,
            json,
            touchFunc,
            zoomFunc,
            heldFunc,
            releaseFunc,
            radius,
            x,
            y,
            root,
            sunburstLayout,
            canvasZoom,
            canvasArea,
            params,//
            parameters,
            triggerTime,
            enableZoom,
            enableTouch,
            zoomedItemPath,
            selectedItemPath,
            heldItemPath,
            enableRotate = true,
            enableRotateDefault = true,
            enableRootZoom = false,
            fontSize = 11,
            fontFamily = "Times New Roman",
            allowTextOverflow = false,
            nodeSelected;

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
                    sum += parentFr;
                    return sum;
                }
                if (i > p.lvl - 1 && i <= root.curMaxLevel) {
                    sum += x;
                    return sum;
                }
                return sum;
            }).map(function (x, i, arr) {
                return x / arr[arr.length - 1] * radius;
            });
            a.unshift(0);
            return a;
        }

        function mapRangeToDomain(a) {
            var arr = [], i;
            for (i = 0; i < a.length; i += 1) {
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
                    interpX = d3.interpolate(this.left, canvasInfo.canvasWidth / 2),
                    interpY = d3.interpolate(this.top, canvasInfo.canvasHeight / 2),
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
                    rad,
                    radless,
                    offsety,
                    angle,
                    outerRad,
                    innerRad,
                    arcStartAngle,
                    arcEndAngle,
                    arcWidth;
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
                        if (allowTextOverflow) {
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
                        if (allowTextOverflow) {
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

        function remove() {
            if (canvasArea !== undefined) {
                canvasZoom.remove();
                canvasZoom = undefined;
                canvasArea = undefined;
            }
        }

        function update(duration) {
            var nodes,
                zoomedNode = getNode(zoomedItemPath(), json()),
                groupNodes,
                newGroupNodes,
                removeGroupNodes,
                arcNodes,
                newArcNodes,
                removeArcNodes,
                textNodes,
                newTextNodes,
                removeTextNodes;

            duration = duration !== undefined ? duration : 1000;

            root = json();

            // Get sunburst specific parameters:
            //TODO make this follow standard pattern
            params = unwrap(parameters);

            // This is a sunburst being updated:
            // Filter out nodes with children:
            nodes = sunburstLayout.sort(root.sortBy).nodes(root)
                .filter(function (d) {
                    return getDistanceToTreePath(d, getNodeTreePath(zoomedNode)) < root.maxVisibleLevels;
                });

            // Select all nodes in Canvas, and apply data:
            groupNodes = canvasArea.selectAll("group")
                .data(nodes, function (d) { return d.id; });

            // Add new nodes to Canvas:
            newGroupNodes = groupNodes.enter().append("group")
                .each(function (d) {
                    this.left = canvasInfo.canvasWidth / 2;
                    this.top = canvasInfo.canvasHeight / 2;
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
                        if (allowTextOverflow) {
                            this.opacity = newColor.opacity;
                        } else {
                            this.opacity = (d.bw - 4 >= this.height) && ((d.bh - 2 >= this.width) || (root === d && y(d.y) < 1)) ? newColor.opacity : 0;
                        }
                    } else {
                        ang -= 90;

                        // Change opacity:
                        if (allowTextOverflow) {
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
                .tween("zoomTween", zoomTween(zoomedNode));

            // Add tween to new nodes:
            newGroupNodes.transition().duration(duration)
                .tween("groupTween", groupTween(1));
            // Add tween to new arcs:
            newArcNodes.transition().duration(duration)
                .tween("arcTween", arcTween(zoomedNode));
            // Add tween to new text:
            newTextNodes.transition().duration(duration)
                .tween("textTween", textTween(zoomedNode));

            // Add tween to current nodes:
            groupNodes.transition().duration(duration)
                .tween("groupTween", groupTween(1));
            // Add tween to current arcs:
            arcNodes = groupNodes.select("arc").transition().duration(duration)
                .tween("arcTween", arcTween(zoomedNode));
            // Add tween to current text:
            textNodes = groupNodes.select("text").transition().duration(duration)
                .tween("textTween", textTween(zoomedNode));

            // Remove missing nodes:
            removeGroupNodes = groupNodes.exit().transition().duration(duration)
                .tween("groupTween", groupTween(0))
                .each(function () {
                    this.remove();
                }, "end");
            removeArcNodes = removeGroupNodes.select("arc").tween("arcTween", arcTween(zoomedNode));
            removeTextNodes = removeGroupNodes.select("text").tween("textTween", textTween(zoomedNode));

            // Prevent event from firing more than once:
            if (d3.event) {
                d3.event.stopPropagation();
            }
        }

        function resize(width, height) {
            canvasInfo.canvasWidth = width;
            canvasInfo.canvasHeight = height;

            radius = Math.min(canvasInfo.canvasWidth, canvasInfo.canvasHeight) / 2;
        }

        function initializeCanvas(element) {

            canvasInfo = canvasHelper.initializeCanvas(element);

        }

        function setLayoutHandler(element) {
            gestureHelper.setLayoutHandler(element, canvasInfo, update, resize);
        }

        function setupGestures() {
            var tempFuncObj = gestureHelper.setupGestures(
                    canvasInfo,
                    enableRotate,
                    enableTouch,
                    enableZoom,
                    heldItemPath,
                    selectedItemPath,
                    zoomedItemPath,
                    json,
                    enableRootZoom,
                    resize,
                    enableRotateDefault
                );

            touchFunc = tempFuncObj.selectTouch;
            zoomFunc = tempFuncObj.selectZoom;
            heldFunc = tempFuncObj.selectHeld;
            releaseFunc = tempFuncObj.selectRelease;
        }

        function initializeSunburst(element, valueAccessor) {

            var nodes,
                root;

            gestureHelper = gestureHelperCreator(),
            parameters = valueAccessor();
            triggerTime = parameters.triggerTime === undefined ? 10 : parameters.triggerTime;
            enableRotate = parameters.enableRotate;
            enableZoom = parameters.enableZoom || false;
            enableTouch = parameters.enableTouch || false;
            allowTextOverflow = parameters.allowTextOverflow || false;
            zoomedItemPath = isObservable(parameters.zoomedItemPath) ? parameters.zoomedItemPath : observable(parameters.zoomedItemPath);
            if (zoomedItemPath() === undefined) {
                zoomedItemPath([]);
            }
            selectedItemPath = isObservable(parameters.selectedItemPath) ? parameters.selectedItemPath : observable(parameters.selectedItemPath);
            if (selectedItemPath() === undefined) {
                selectedItemPath([]);
            }
            heldItemPath = isObservable(parameters.heldItemPath) ? parameters.heldItemPath : observable(parameters.heldItemPath);
            if (heldItemPath() === undefined) {
                heldItemPath([]);
            }

            // Subscribe to zoomedItemPath changes, verify path and then zoom:
            zoomedItemPath.subscribe(function (path) {
                var node = getNode(path, json());
                // even if there is no node, the zoom must still be set to something
                if (!node) {
                    zoomedItemPath([]);
                    // if there is no node, that means our zoomed node is the root
                    node = json();
                }
                if (node) {
                    json().curLevel = node.lvl;
                    json().curMaxLevel = node.lvl + json().maxVisibleLevels - 1;
                    update();    // Animate zoom effect
                }
            });

            // Subscribe to selectedItemPath changes from outside:
            selectedItemPath.subscribe(function (path) {
                // if there is no node, there is no path
                if (!getNode(path, json())) {
                    selectedItemPath(undefined);
                }
            });

            json = jsonHelper(parameters, triggerTime, zoomedItemPath);
            root = json();
            json.subscribe(function () {
                update();
            });

            initializeCanvas(element);

            setLayoutHandler(element);

            setupGestures();

            // Start Real Init
            radius = Math.min(canvasInfo.canvasWidth, canvasInfo.canvasHeight) / 2;
            x = d3.scale.linear().range([0, 2 * Math.PI]);
            y = d3.scale.linear().range([0, radius]);

            // This is a new sunburst:
            // Setup sunburst and Canvas:
            sunburstLayout = d3.layout.partition()
                            .sort(root.sortBy)
                            .value(function (d) { return d.size; })
                            .children(function (d) { return d.children; });

            canvasZoom = canvasInfo.canvas.append("group");
            canvasArea = canvasZoom.append("group").each(function () {
                this.fontFamily = "Times New Roman";
                this.fontSize = 11;
            });

            // Filter out nodes with children:
            nodes = sunburstLayout.nodes(root)
                .filter(function (d) {
                    return getDistanceToTreePath(d, getNodeTreePath(getNode(zoomedItemPath(), json()))) < root.maxVisibleLevels;
                });

            // Join data with selection (may not be needed):
            canvasArea.selectAll("group")
                .data(nodes, function (d) { return d.id; });

            // Add nodes to Canvas:
            nodeSelected = getNode(zoomedItemPath(), json());
            x.domain([nodeSelected.x, nodeSelected.x + nodeSelected.dx]);
            y.domain([nodeSelected.y, (root.curMaxLevel + 1) / (root.maxlvl + 1)]).range([nodeSelected.y ? nodeSelected.dy * radius / 2 : 0, radius]);
            update(0);
        }

        return {
            initializeSunburst: initializeSunburst
        }

    }

    function init(element, valueAccessor) {
        
        var sunburstObj = createInstance();

        sunburstObj.initializeSunburst(element, valueAccessor);
    }

    return {
        init: init
    };

});
