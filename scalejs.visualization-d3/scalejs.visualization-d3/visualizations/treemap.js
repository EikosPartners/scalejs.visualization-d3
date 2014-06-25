/*global define*/
define([
    'd3',
    'scalejs.visualization-d3/canvas-helper',
    'scalejs.visualization-d3/gesture-helper',
    'knockout',
    'scalejs.visualization-d3/json-helper',
    'scalejs.visualization-d3/misc-helpers'
], function (
    d3,
    canvasHelper,
    gestureHelperCreator,
    ko,
    jsonHelper,
    helpers
) {
    "use strict";

    function mapValue() {
        var domain = [0, 1], range = [0, 1],
            domain_length = 1, range_length = 1;

        function scale(x) {
            return (x - domain[0]) / domain_length * range_length + range[0];
        }

        scale.domain = function (d) {
            if (!arguments.length) { return domain; }
            domain = d;
            domain_length = domain[1] - domain[0];
            return scale;
        };
        scale.range = function (r) {
            if (!arguments.length) { return range; }
            range = r;
            range_length = range[1] - range[0];
            return scale;
        };

        return scale;
    }


    var observable = ko.observable,
        computed = ko.computed,
        unwrap = ko.utils.unwrapObservable,
        isObservable = ko.isObservable,
        getNode = helpers.getNode,
        gestureHelper = gestureHelperCreator(),
        //Treemap variables
        visualization,
        canvas,
        json,
        touchFunc,
        zoomFunc,
        heldFunc,
        releaseFunc,
        canvasWidth,
        canvasHeight,
        x,
        y,
        root,
        treemapLayout,
        canvasArea,
        spacing = 3,
        borderColor = d3.interpolate("#888", "#fff"),
        kx, ky,
        tempObject,
        elementStyle,
        canvasElement,//
        parameters,
        triggerTime,
        enableZoom,
        enableTouch,
        zoomedItemPath,
        selectedItemPath,
        heldItemPath,
        zoomedNode,
        enableRotate = false,
        enableRotateDefault = false,
        enableRootZoom = true,
        fontSize = 11,
        fontFamily = "Times New Roman",
        allowTextOverflow = false,
        nodeSelected;

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
                dy: d.dy
            };
        }
        var spx = spacing / kx,
            spy = spacing / ky,
            p = getNodeSpaced(d.parent);
        if (origD) {
            // If original node, halve the spacing to match the spacing between parent and children:
            return {
                x: p.dx / d.parent.dx * (d.x - d.parent.x) + p.x + spx / 2,
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

    function groupTween(opacity) {
        return function (d) {
            // Create interpolations used for a nice slide:
            var nodeSpaced = getNodeSpaced(d, d),
                interpX,
                interpY,
                interpWidth, interpHeight,
                newFill = (d.children && d.lvl < root.curMaxLevel ? borderColor(d.lvl / (root.maxlvl - 1)) : d.color),
                newColor = parseColor(newFill),
                interpFill = d3.interpolate(this.backFill, newColor.color),
                interpOpacity = d3.interpolate(this.opacity, opacity * newColor.opacity),
                element = this;
            d.sx = x(nodeSpaced.x);
            d.sy = y(nodeSpaced.y);
            d.sdx = Math.max(kx * nodeSpaced.dx, 0);
            d.sdy = Math.max(ky * nodeSpaced.dy, 0);
            interpX = d3.interpolate(this.left, d.sx);
            interpY = d3.interpolate(this.top, d.sy);
            interpWidth = d3.interpolate(this.width, d.sdx);
            interpHeight = d3.interpolate(this.height, d.sdy);
            // Performance optimization (d3 is slow at interpolating colors):
            // NOTE from d3 docs: The returned function below is executed once per frame during animation. This current function is executed only one per animation!
            if (newFill !== this.backFill) {
                return function (t) {
                    element.left = interpX(t);
                    element.top = interpY(t);
                    element.width = interpWidth(t);
                    element.height = interpHeight(t);
                    element.backFill = interpFill(t);
                    element.opacity = interpOpacity(t);
                };
            }
            return function (t) {
                element.left = interpX(t);
                element.top = interpY(t);
                element.width = interpWidth(t);
                element.height = interpHeight(t);
                element.opacity = interpOpacity(t);
            };
        };
    }
    function textTween() {
        return function (d) {
            // Create interpolations used for a nice slide:
            var interpX = d3.interpolate(this.left, d.sdx / 2),
                interpY = d3.interpolate(this.top, d.sdy / 2),
                newColor = parseColor(d.fontColor),
                interpFill = d3.interpolate(this.fill, newColor.color),
                interpOpacity,
                element = this;
            if (allowTextOverflow) {
                interpOpacity = d3.interpolate(this.opacity, !(d.children && d.lvl < root.curMaxLevel) ? newColor.opacity : 0);
            } else {
                interpOpacity = d3.interpolate(this.opacity, !(d.children && d.lvl < root.curMaxLevel) && (d.sdx - 1 >= this.width) && (d.sdy - 1 >= this.height) ? newColor.opacity : 0);
            }
            this.fontFamily = d.fontFamily;
            this.fontSize = d.fontSize;
            return function (t) {
                element.left = interpX(t);
                element.top = interpY(t);
                element.opacity = interpOpacity(t);
                element.fill = interpFill(t);
            };
        };
    }

    function applyTouchTween(nodes, textNodes, targetZoomedNode, duration) {
        nodes.filter(function (d) { return !(d.children && d.lvl < root.curMaxLevel); })
            .on("touch", touchFunc).on("hold", heldFunc).on("release", releaseFunc)
            .on("tap", function (d) { zoomFunc(d.parent || d); });

        nodes.transition().duration(duration).tween("groupTween", groupTween(1));
        textNodes.transition().duration(duration).tween("textTween", textTween(targetZoomedNode));
    }

    function update(p, duration) {
        duration = duration !== undefined ? duration : 1000;
        root = json();

        var nodes,
            groupNodes,
            newGroupNodes,
            removeGroupNodes,
            textNodes,
            newTextNodes,
            removeTextNodes;

        // Filter out nodes with children:
        nodes = treemapLayout.size([canvasWidth, canvasHeight]).sort(root.sortBy).nodes(root)
            .filter(function (d) {
                return getDistanceToTreePath(d, getNodeTreePath(p)) < root.maxVisibleLevels;
            })
            .sort(function (a, b) {
                return a.depth === b.depth ? b.value - a.value : a.depth - b.depth;
            });

        groupNodes = canvasArea.selectAll("group").data(nodes, function (d) { return d.id; });

        // Add new nodes to Canvas:
        newGroupNodes = groupNodes.enter().append("group").each(function (d) {
            var dNode = d.parent || d;
            this.left = x(dNode.x) + kx * dNode.dx / 2;
            this.top = y(dNode.y) + ky * dNode.dy / 2;
            var newColor = parseColor(d.children && d.lvl < root.curMaxLevel ? borderColor(d.lvl / (root.maxlvl - 1)) : d.color);
            this.backFill = newColor.color;
            this.opacity = 0;
        });
        newTextNodes = newGroupNodes.append("text").each(function (d) {
            this.originX = "center";
            this.originY = "center";
            this.left = 0;
            this.top = 0;
            this.fontFamily = d.fontFamily;
            this.fontSize = d.fontSize;
            var newColor = parseColor(d.fontColor);
            this.fill = newColor.color;
            this.setText(d.name);
            if (allowTextOverflow) {
                this.opacity = (d.parent && d.parent.children && d.parent.lvl < root.curMaxLevel) ? newColor.opacity : 0;
            } else {
                this.opacity = (d.parent && d.parent.children && d.parent.lvl < root.curMaxLevel) && (kx * d.dx - spacing * 2 >= this.width) && (ky * d.dy - spacing * 2 >= this.height) ? newColor.opacity : 0;
            }
        });

        // Set zoom domain to d's area:
        kx = canvasWidth / p.dx;
        ky = canvasHeight / p.dy;
        x.domain([p.x, p.x + p.dx]);
        y.domain([p.y, p.y + p.dy]);

        applyTouchTween(newGroupNodes, newTextNodes, p, duration);
        applyTouchTween(groupNodes, groupNodes.select("text"), p, duration);

        //reset group nodes which arent visible
        groupNodes.filter(function (d) { return d.children && d.lvl < root.curMaxLevel; }).on("touch", null).on("tap", null).on("hold", null);

        // Remove missing nodes:
        removeGroupNodes = groupNodes.exit().transition().duration(duration)
            .tween("groupTween", function (d) {
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
            }).each(function () { this.remove(); }, "end");
        removeTextNodes = removeGroupNodes.select("text").each(function (d) {
            d.sdx = 0;
            d.sdy = 0;
        }).tween("textTween", textTween(p));

        // Prevent event from firing more than once:
        if (d3.event) d3.event.stopPropagation();
    }

    function resize(width, height) {
        canvasWidth = width;
        canvasHeight = height;

        x.range([0, canvasWidth]);
        y.range([0, canvasHeight]);
    }

    function remove() {
        canvasArea.remove();
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

    function setLayoutHandler(element, zoomedNode, resize) {
        gestureHelper.setLayoutHandler(element, canvas, canvasWidth, canvasHeight, update, zoomedNode, resize, enableRotate, enableRotateDefault);
    }

    function setupGestures(
            enableRotate,
            enableTouch,
            enableZoom,
            heldItemPath,
            selectedItemPath,
            zoomedItemPath,
            zoomedNode

    ) {
        var tempFuncObj = gestureHelper.setupGestures(
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
                json(),
                enableRootZoom,
                resize
        );

        touchFunc = tempFuncObj.selectTouch;
        zoomFunc = tempFuncObj.selectZoom;
        heldFunc = tempFuncObj.selectHeld;
        releaseFunc = tempFuncObj.selectRelease;
    }

    function resetTransformations() {
        gestureHelper.resetTransformations();
    }

    function init(element, valueAccessor) {

        parameters = valueAccessor();
        triggerTime = parameters.triggerTime == null ? 10 : parameters.triggerTime;
        enableRotate = parameters.enableRotate;
        enableZoom = parameters.enableZoom || false;
        enableTouch = parameters.enableTouch || false;
        allowTextOverflow = parameters.allowTextOverflow || false;
        zoomedItemPath = isObservable(parameters.zoomedItemPath) ? parameters.zoomedItemPath : observable(parameters.zoomedItemPath);
        selectedItemPath = isObservable(parameters.selectedItemPath) ? parameters.selectedItemPath : observable(parameters.selectedItemPath);
        heldItemPath = isObservable(parameters.heldItemPath) ? parameters.heldItemPath : observable(parameters.heldItemPath);

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
                zoomedNode = node;
                json().curLevel = zoomedNode.lvl;
                json().curMaxLevel = zoomedNode.lvl + json().maxVisibleLevels - 1;
                update(getNode(zoomedItemPath(), json()));    // Animate zoom effect
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

        // Subscribe to data changes:
        json.subscribe(function () {
            //visualization.parameters = visualizationParams;
            update(getNode(zoomedItemPath(), json()));
        });




        //Remove previous visualization's nodes
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }

        initializeCanvas(element);

        setLayoutHandler(element, getNode(zoomedItemPath(), json()), resize);

        setupGestures(
            enableRotate,
            enableTouch,
            enableZoom,
            heldItemPath,
            selectedItemPath,
            zoomedItemPath,
            getNode(zoomedItemPath(), json())
        );

        resetTransformations();

        allowTextOverflow = unwrap(allowTextOverflow);


        //start real init
        // Setup variables:
        x = mapValue().range([0, canvasWidth]);
        y = mapValue().range([0, canvasHeight]);

        // Define temp vars:
        var nodes;

        // Get treemap data:
        root = json();

        // This is a new treemap:
        // Setup treemap and SVG:
        treemapLayout = d3.layout.treemap()
                        .round(false)
                        .sort(root.sortBy)
                        .size([canvasWidth, canvasHeight])
                        .sticky(false)
                        .mode('squarify')
                        .value(function (d) { return d.size; })
                        .children(function (d) { return d.children; });

        canvasArea = canvas.append("group").each(function () {
            this.fontFamily = "Times New Roman";
            this.fontSize = 11;
        });

        // Filter out nodes with children (need to do this before we set the data up):
        nodes = treemapLayout.nodes(root)
            .filter(function (d) {
                return getDistanceToTreePath(d, getNodeTreePath(getNode(zoomedItemPath(), json()))) < root.maxVisibleLevels;
            })
            .sort(function (a, b) {
                return a.depth === b.depth ? b.value - a.value : a.depth - b.depth;
            });

        // Join data with selection (may not be needed):
        canvasArea.selectAll("group")
                .data(nodes, function (d) { return d.id; });

        nodeSelected = getNode(zoomedItemPath(), json());
        // Add nodes to Canvas:
        kx = canvasWidth / nodeSelected.dx;
        ky = canvasHeight / nodeSelected.dy;
        x.domain([nodeSelected.x, nodeSelected.x + nodeSelected.dx]);
        y.domain([nodeSelected.y, nodeSelected.y + nodeSelected.dy]);
        update(nodeSelected, 0);

        // Subscribe to allowTextOverflow changes:
        if (isObservable(allowTextOverflow)) {
            allowTextOverflow.subscribe(function () {
                allowTextOverflow = unwrap(allowTextOverflow);
                update(getNode(zoomedItemPath(), json()));
            });
        }
    }

    return {
        init: init
    }

});