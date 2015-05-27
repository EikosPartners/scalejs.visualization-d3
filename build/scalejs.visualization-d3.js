/*global define*/
/*jslint devel: true */
/*jslint browser: true */
define('scalejs.visualization-d3/canvas-helper',[
    'd3',
    'scalejs.canvas'
], function (
    d3,
    canvasRender
) {
    "use strict";

    function initializeCanvas(element) {

        var elementStyle,
            canvasWidth,
            canvasHeight,
            canvasElement,
            canvas;

        // Clear the dom node that this visualization is in
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }

        // Get element's width and height:
        elementStyle = window.getComputedStyle(element);

        // Get width and height. Must be >= 1 pixel in order for d3 to calculate layouts properly:
        canvasWidth = parseInt(elementStyle.width, 10);
        canvasWidth = canvasWidth >= 1 ? canvasWidth : 1;
        canvasHeight = parseInt(elementStyle.height, 10);
        canvasHeight = canvasHeight >= 1 ? canvasHeight : 1;

        canvasElement = d3.select(element)
                            .style('overflow', 'hidden')
                            .append("canvas")
                                .attr("width", canvasWidth)
                                .attr("height", canvasHeight)
                                .attr("display", "none")
                                .node();

        canvas = canvasRender.select(canvasElement).ease(d3.ease("cubic-in-out"));

        return {
            elementStyle: elementStyle,
            canvasWidth: canvasWidth,
            canvasHeight: canvasHeight,
            canvasElement: canvasElement,
            canvas: canvas
        };
    }

    return {
        initializeCanvas: initializeCanvas
    };
});
/*global define*/
define('scalejs.visualization-d3/nested-data-helper',[

], function () {
    "use strict";

    // Attempts to find a node when given a path
    // 1. If the Path is found, it returns the node
    // 2. If the Path does not exist, it returns undefined
    // 3. If the Path has a length of 0, it returns the root node
    // 4. If the Path is not an array, it returns undefined
    function getNode(path, root) {
        var curNode = root,
            i;
        if (path instanceof Array) {
            for (i = 0; i < path.length; i += 1) {
                if (curNode.childrenReference[path[i]] === undefined) {
                    return;
                }
                curNode = curNode.childrenReference[path[i]];
            }
            return curNode;
        }
        return;
    }

    function getDistanceToTreePath(node, treePath) {
        var distance = 0;
        while (treePath.indexOf(node) < 0) {
            distance += 1;
            node = node.parent;
        }
        return distance;
    }

    // Creates an array of nodes up to but not including root
    function getNodeTreePath(node) {
        var path = [];
        while (node.parent !== undefined) {
            path.push(node);
            node = node.parent;
        }
        path.push(node);
        return path;
    }

    // Creates an array of nodes from node to root
    function createNodePath(node) {
        var path = [],
            tmpNode = node;
        // Set selectedItemPath:
        while (tmpNode.parent !== undefined) {
            path.unshift(tmpNode.index);
            tmpNode = tmpNode.parent;
        }
        return path;
    }

    return {
        getNode: getNode,
        getDistanceToTreePath: getDistanceToTreePath,
        getNodeTreePath: getNodeTreePath,
        createNodePath: createNodePath
    };
});
/*global define*/
/*jslint devel: true */
/*jslint browser: true */
define('scalejs.visualization-d3/gesture-helper',[
    'scalejs!core',
    'd3',
    'knockout',
    'scalejs.visualization-d3/nested-data-helper'
], function (
    core,
    d3,
    ko,
    nestedDataHelper
) {
    var //Imports
        unwrap = ko.utils.unwrapObservable,
        isObservable = ko.isObservable,
        getNode = nestedDataHelper.getNode,
        createNodePath = nestedDataHelper.createNodePath;

    return function () {
        //Variables
        var transform = {
            left: 0,
            top: 0,
            rotate: 0,
            scale: 1
        },
        zoomOutScale = 0.8,
        disposeLayout;


        function setupGestures(
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
            enableRotateDefault,
            element,
            update
            ) {


            var touchHandler

            function setupResize() {
                var lastWidth = canvasInfo.canvasWidth,
                    lastHeight = canvasInfo.canvasHeight,
                    elementStyle = window.getComputedStyle(element),
                    newWidth,
                    newHeight;
                // Get width and height. Must be >= 1 pixel in order for d3 to calculate layouts properly:
                newWidth = parseInt(elementStyle.width, 10);
                newWidth = newWidth >= 1 ? newWidth : 1;
                newHeight = parseInt(elementStyle.height, 10);
                newHeight = newHeight >= 1 ? newHeight : 1;

                if (newWidth === lastWidth && newHeight === lastHeight) return;

                resize(newWidth, newHeight);
                // Must set width and height before doing any animation (to calculate layouts properly):
                resetTransformAnimation(canvasInfo.canvas);
                update();
            }

            // This function resets the selected node:
            function selectRelease() {
                heldItemPath(undefined);
            }

            // This function sets the selected node:
            function selectTouch(node) {
                selectedItemPath(createNodePath(node));
            }

            // This function sets the held node:
            function selectHeld(node) { 
                heldItemPath(createNodePath(node));
            }

            function resetTransformAnimation(canvas) {
                // Reset target transform:
                transform.left = 0;
                transform.top = 0;
                transform.rotate = 0;
                transform.scale = 1;
                canvas.select("group").transition().duration(1000)
                    .tween("canvasTween", function () {
                        // Create interpolations used for a nice slide around the parent:
                        var interpLeft = d3.interpolate(this.left, 0),
                            interpTop = d3.interpolate(this.top, 0),
                            interpAngle = d3.interpolate(this.angle, 0),
                            interpScaleX = d3.interpolate(this.scaleX, 1),
                            interpScaleY = d3.interpolate(this.scaleY, 1),
                            el = this;
                        return function (t) {
                            el.left = interpLeft(t);
                            el.top = interpTop(t);
                            el.angle = interpAngle(t);
                            el.scaleX = interpScaleX(t);
                            el.scaleY = interpScaleY(t);
                        };
                    });
            }

            // Zoom after click, and set the path:
            function selectZoom(node) {
                var path = [],
                    tmpNode,
                    curZoomedNode = getNode(zoomedItemPath(), json());

                // Only zoom if enabled:
                if (unwrap(enableZoom)) {
                    if (enableRootZoom && node === curZoomedNode) {    // Reset path since item was already selected.
                        node = json();
                    }

                    if (node !== curZoomedNode) {
                        // Reset transform:
                        resetTransformAnimation(canvasInfo.canvas);
                    }

                    tmpNode = node;
                    // Set selected node for use in calculating the max depth.
                    json().curLevel = tmpNode.lvl;
                    json().curMaxLevel = tmpNode.lvl + json().maxVisibleLevels - 1;

                    // Set zoomedItemPath:
                    while (tmpNode.parent !== undefined) {
                        path.unshift(tmpNode.index);
                        tmpNode = tmpNode.parent;
                    }
                    zoomedItemPath(path);
                }

                // Prevent event from firing more than once:
                if (d3.event) {
                    d3.event.stopPropagation();
                }
            }

            // The following set of callbacks are for the pinch&zoom touch handler:
            function renderCallback(left, top, rotate, scale) { // Called on beginning and end of touch gestures:
                // Update transform:
                transform.left = left;
                transform.top = top;
                transform.rotate = rotate;
                transform.scale = scale;
                canvasInfo.canvas.select("group")
                    .attr("scaleX", transform.scale)
                    .attr("scaleY", transform.scale)
                    .attr("angle", transform.rotate)
                    .attr("left", transform.left)
                    .attr("top", transform.top);
                canvasInfo.canvas.pumpRender();
            }

            function startCallback() {  // Called when user initiates a touch gesture:
                // Set Rotate State:
                enableRotate = unwrap(enableRotate) !== undefined ? unwrap(enableRotate) : enableRotateDefault;
                touchHandler.setRotateState(enableRotate);

                return transform;
            }

            function transformCallback(zoomOutHandler) {   // Called for every update to a touch gesture's transform (end and step):
                return function (left, top, rotate, scale) {
                    // If rotate is not enabled on visualization, lock the visualization to not go off of the screen:
                    if (!enableRotate) {
                        left > 0 && (left = 0);
                        top > 0 && (top = 0);
                        var right = left + scale * canvasInfo.canvasWidth,
                            bottom = top + scale * canvasInfo.canvasHeight;
                        right < canvasInfo.canvasWidth && (left += canvasInfo.canvasWidth - right);
                        bottom < canvasInfo.canvasHeight && (top += canvasInfo.canvasHeight - bottom);
                    }
                    if (scale < 1) {   // scaling is handled differently for step and end
                        zoomOutHandler(left, top, rotate, scale);
                    } else {
                        // Update transform:
                        transform.left = left;
                        transform.top = top;
                        transform.rotate = rotate;
                        transform.scale = scale;
                    }
                    // Return updated transform to canvas-touch:
                    return transform;
                }
            }

            // passed to transformCallback to create step-specific transform callback function
            function stepZoomOutHandler(left, top, rotate, scale) {
                scale = Math.max(zoomOutScale, scale);
                // Reset transform:
                transform.left = (1 - scale) / 2 * canvasInfo.canvasWidth;
                transform.top = (1 - scale) / 2 * canvasInfo.canvasHeight;
                transform.rotate = 0;
                transform.scale = scale;
            };

            // passed to transformCallback to create end-specific transform callback function
            function endZoomOutHandler(left, top, rotate, scale) {
                // Bounce back
                transform.left = 0;
                transform.top = 0;
                transform.rotate = 0;
                transform.scale = 1;
                if (scale < zoomOutScale + (1 - zoomOutScale) / 4) {
                    // zoom to parent
                    selectZoom(getNode(zoomedItemPath(), json()).parent || getNode(zoomedItemPath(), json()));
                }
            }

            function setLayoutHandler(element, canvasInfo, update, resize) {

                //Dispose previous handlers
                if (disposeLayout !== undefined) {
                    disposeLayout();
                    disposeLayout = undefined;
                }

                // Check if a layout plugin exists:
                if (core.layout) {
                    // Add event listener for on layout change:
                    disposeLayout = core.layout.onLayoutDone(setupResize);
                } else {
                    disposeLayout = window.addEventListener('resize', setupResize);
                }

                ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
                    disposeLayout();
                    disposeLayout = undefined;
                });

                return disposeLayout;
            }

            setLayoutHandler(element, canvasInfo, update, resize);


            // Check if a canvas touch plugin exists (register before initializing visualization to avoid event handler conflicts):
            if (core.canvas.touch && unwrap(enableTouch)) {
                touchHandler = core.canvas.touch({
                    canvas: canvasInfo.canvasElement,
                    renderCallback: renderCallback,
                    startCallback: startCallback,
                    stepCallback: transformCallback(stepZoomOutHandler),
                    endCallback: transformCallback(endZoomOutHandler)
                });
            } else {
                touchHandler = {
                    setRotateState: function () { return; },
                    remove: function () { return; }
                };
            }

            // Register pinch&zoom extension to canvas:
            if (isObservable(enableTouch)) {
                // Subscribe to changes in enableTouch to dynamically enable and disable the pinch&zoom touch handler:
                enableTouch.subscribe(function () {
                
                    touchHandler.remove();
                    registerTouchHandler();
                });
            }

            return {
                selectTouch: selectTouch,
                selectZoom: selectZoom,
                selectHeld: selectHeld,
                selectRelease: selectRelease
            };
        }



        return {
            setupGestures: setupGestures

        };
    };

});
// This product includes color specifications and designs developed by Cynthia Brewer (http://colorbrewer.org/).
/*global define */
define('d3.colorbrewer',{
    YlGn: {
        3: ["#f7fcb9", "#addd8e", "#31a354"],
        4: ["#ffffcc", "#c2e699", "#78c679", "#238443"],
        5: ["#ffffcc", "#c2e699", "#78c679", "#31a354", "#006837"],
        6: ["#ffffcc", "#d9f0a3", "#addd8e", "#78c679", "#31a354", "#006837"],
        7: ["#ffffcc", "#d9f0a3", "#addd8e", "#78c679", "#41ab5d", "#238443", "#005a32"],
        8: ["#ffffe5", "#f7fcb9", "#d9f0a3", "#addd8e", "#78c679", "#41ab5d", "#238443", "#005a32"],
        9: ["#ffffe5", "#f7fcb9", "#d9f0a3", "#addd8e", "#78c679", "#41ab5d", "#238443", "#006837", "#004529"]
    },
    YlGnBu: {
        3: ["#edf8b1", "#7fcdbb", "#2c7fb8"],
        4: ["#ffffcc", "#a1dab4", "#41b6c4", "#225ea8"],
        5: ["#ffffcc", "#a1dab4", "#41b6c4", "#2c7fb8", "#253494"],
        6: ["#ffffcc", "#c7e9b4", "#7fcdbb", "#41b6c4", "#2c7fb8", "#253494"],
        7: ["#ffffcc", "#c7e9b4", "#7fcdbb", "#41b6c4", "#1d91c0", "#225ea8", "#0c2c84"],
        8: ["#ffffd9", "#edf8b1", "#c7e9b4", "#7fcdbb", "#41b6c4", "#1d91c0", "#225ea8", "#0c2c84"],
        9: ["#ffffd9", "#edf8b1", "#c7e9b4", "#7fcdbb", "#41b6c4", "#1d91c0", "#225ea8", "#253494", "#081d58"]
    },
    GnBu: {
        3: ["#e0f3db", "#a8ddb5", "#43a2ca"],
        4: ["#f0f9e8", "#bae4bc", "#7bccc4", "#2b8cbe"],
        5: ["#f0f9e8", "#bae4bc", "#7bccc4", "#43a2ca", "#0868ac"],
        6: ["#f0f9e8", "#ccebc5", "#a8ddb5", "#7bccc4", "#43a2ca", "#0868ac"],
        7: ["#f0f9e8", "#ccebc5", "#a8ddb5", "#7bccc4", "#4eb3d3", "#2b8cbe", "#08589e"],
        8: ["#f7fcf0", "#e0f3db", "#ccebc5", "#a8ddb5", "#7bccc4", "#4eb3d3", "#2b8cbe", "#08589e"],
        9: ["#f7fcf0", "#e0f3db", "#ccebc5", "#a8ddb5", "#7bccc4", "#4eb3d3", "#2b8cbe", "#0868ac", "#084081"]
    },
    BuGn: {
        3: ["#e5f5f9", "#99d8c9", "#2ca25f"],
        4: ["#edf8fb", "#b2e2e2", "#66c2a4", "#238b45"],
        5: ["#edf8fb", "#b2e2e2", "#66c2a4", "#2ca25f", "#006d2c"],
        6: ["#edf8fb", "#ccece6", "#99d8c9", "#66c2a4", "#2ca25f", "#006d2c"],
        7: ["#edf8fb", "#ccece6", "#99d8c9", "#66c2a4", "#41ae76", "#238b45", "#005824"],
        8: ["#f7fcfd", "#e5f5f9", "#ccece6", "#99d8c9", "#66c2a4", "#41ae76", "#238b45", "#005824"],
        9: ["#f7fcfd", "#e5f5f9", "#ccece6", "#99d8c9", "#66c2a4", "#41ae76", "#238b45", "#006d2c", "#00441b"]
    },
    PuBuGn: {
        3: ["#ece2f0", "#a6bddb", "#1c9099"],
        4: ["#f6eff7", "#bdc9e1", "#67a9cf", "#02818a"],
        5: ["#f6eff7", "#bdc9e1", "#67a9cf", "#1c9099", "#016c59"],
        6: ["#f6eff7", "#d0d1e6", "#a6bddb", "#67a9cf", "#1c9099", "#016c59"],
        7: ["#f6eff7", "#d0d1e6", "#a6bddb", "#67a9cf", "#3690c0", "#02818a", "#016450"],
        8: ["#fff7fb", "#ece2f0", "#d0d1e6", "#a6bddb", "#67a9cf", "#3690c0", "#02818a", "#016450"],
        9: ["#fff7fb", "#ece2f0", "#d0d1e6", "#a6bddb", "#67a9cf", "#3690c0", "#02818a", "#016c59", "#014636"]
    },
    PuBu: {
        3: ["#ece7f2", "#a6bddb", "#2b8cbe"],
        4: ["#f1eef6", "#bdc9e1", "#74a9cf", "#0570b0"],
        5: ["#f1eef6", "#bdc9e1", "#74a9cf", "#2b8cbe", "#045a8d"],
        6: ["#f1eef6", "#d0d1e6", "#a6bddb", "#74a9cf", "#2b8cbe", "#045a8d"],
        7: ["#f1eef6", "#d0d1e6", "#a6bddb", "#74a9cf", "#3690c0", "#0570b0", "#034e7b"],
        8: ["#fff7fb", "#ece7f2", "#d0d1e6", "#a6bddb", "#74a9cf", "#3690c0", "#0570b0", "#034e7b"],
        9: ["#fff7fb", "#ece7f2", "#d0d1e6", "#a6bddb", "#74a9cf", "#3690c0", "#0570b0", "#045a8d", "#023858"]
    },
    BuPu: {
        3: ["#e0ecf4", "#9ebcda", "#8856a7"],
        4: ["#edf8fb", "#b3cde3", "#8c96c6", "#88419d"],
        5: ["#edf8fb", "#b3cde3", "#8c96c6", "#8856a7", "#810f7c"],
        6: ["#edf8fb", "#bfd3e6", "#9ebcda", "#8c96c6", "#8856a7", "#810f7c"],
        7: ["#edf8fb", "#bfd3e6", "#9ebcda", "#8c96c6", "#8c6bb1", "#88419d", "#6e016b"],
        8: ["#f7fcfd", "#e0ecf4", "#bfd3e6", "#9ebcda", "#8c96c6", "#8c6bb1", "#88419d", "#6e016b"],
        9: ["#f7fcfd", "#e0ecf4", "#bfd3e6", "#9ebcda", "#8c96c6", "#8c6bb1", "#88419d", "#810f7c", "#4d004b"]
    },
    RdPu: {
        3: ["#fde0dd", "#fa9fb5", "#c51b8a"],
        4: ["#feebe2", "#fbb4b9", "#f768a1", "#ae017e"],
        5: ["#feebe2", "#fbb4b9", "#f768a1", "#c51b8a", "#7a0177"],
        6: ["#feebe2", "#fcc5c0", "#fa9fb5", "#f768a1", "#c51b8a", "#7a0177"],
        7: ["#feebe2", "#fcc5c0", "#fa9fb5", "#f768a1", "#dd3497", "#ae017e", "#7a0177"],
        8: ["#fff7f3", "#fde0dd", "#fcc5c0", "#fa9fb5", "#f768a1", "#dd3497", "#ae017e", "#7a0177"],
        9: ["#fff7f3", "#fde0dd", "#fcc5c0", "#fa9fb5", "#f768a1", "#dd3497", "#ae017e", "#7a0177", "#49006a"]
    },
    PuRd: {
        3: ["#e7e1ef", "#c994c7", "#dd1c77"],
        4: ["#f1eef6", "#d7b5d8", "#df65b0", "#ce1256"],
        5: ["#f1eef6", "#d7b5d8", "#df65b0", "#dd1c77", "#980043"],
        6: ["#f1eef6", "#d4b9da", "#c994c7", "#df65b0", "#dd1c77", "#980043"],
        7: ["#f1eef6", "#d4b9da", "#c994c7", "#df65b0", "#e7298a", "#ce1256", "#91003f"],
        8: ["#f7f4f9", "#e7e1ef", "#d4b9da", "#c994c7", "#df65b0", "#e7298a", "#ce1256", "#91003f"],
        9: ["#f7f4f9", "#e7e1ef", "#d4b9da", "#c994c7", "#df65b0", "#e7298a", "#ce1256", "#980043", "#67001f"]
    },
    OrRd: {
        3: ["#fee8c8", "#fdbb84", "#e34a33"],
        4: ["#fef0d9", "#fdcc8a", "#fc8d59", "#d7301f"],
        5: ["#fef0d9", "#fdcc8a", "#fc8d59", "#e34a33", "#b30000"],
        6: ["#fef0d9", "#fdd49e", "#fdbb84", "#fc8d59", "#e34a33", "#b30000"],
        7: ["#fef0d9", "#fdd49e", "#fdbb84", "#fc8d59", "#ef6548", "#d7301f", "#990000"],
        8: ["#fff7ec", "#fee8c8", "#fdd49e", "#fdbb84", "#fc8d59", "#ef6548", "#d7301f", "#990000"],
        9: ["#fff7ec", "#fee8c8", "#fdd49e", "#fdbb84", "#fc8d59", "#ef6548", "#d7301f", "#b30000", "#7f0000"]
    },
    YlOrRd: {
        3: ["#ffeda0", "#feb24c", "#f03b20"],
        4: ["#ffffb2", "#fecc5c", "#fd8d3c", "#e31a1c"],
        5: ["#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026"],
        6: ["#ffffb2", "#fed976", "#feb24c", "#fd8d3c", "#f03b20", "#bd0026"],
        7: ["#ffffb2", "#fed976", "#feb24c", "#fd8d3c", "#fc4e2a", "#e31a1c", "#b10026"],
        8: ["#ffffcc", "#ffeda0", "#fed976", "#feb24c", "#fd8d3c", "#fc4e2a", "#e31a1c", "#b10026"],
        9: ["#ffffcc", "#ffeda0", "#fed976", "#feb24c", "#fd8d3c", "#fc4e2a", "#e31a1c", "#bd0026", "#800026"]
    },
    YlOrBr: {
        3: ["#fff7bc", "#fec44f", "#d95f0e"],
        4: ["#ffffd4", "#fed98e", "#fe9929", "#cc4c02"],
        5: ["#ffffd4", "#fed98e", "#fe9929", "#d95f0e", "#993404"],
        6: ["#ffffd4", "#fee391", "#fec44f", "#fe9929", "#d95f0e", "#993404"],
        7: ["#ffffd4", "#fee391", "#fec44f", "#fe9929", "#ec7014", "#cc4c02", "#8c2d04"],
        8: ["#ffffe5", "#fff7bc", "#fee391", "#fec44f", "#fe9929", "#ec7014", "#cc4c02", "#8c2d04"],
        9: ["#ffffe5", "#fff7bc", "#fee391", "#fec44f", "#fe9929", "#ec7014", "#cc4c02", "#993404", "#662506"]
    },
    Purples: {
        3: ["#efedf5", "#bcbddc", "#756bb1"],
        4: ["#f2f0f7", "#cbc9e2", "#9e9ac8", "#6a51a3"],
        5: ["#f2f0f7", "#cbc9e2", "#9e9ac8", "#756bb1", "#54278f"],
        6: ["#f2f0f7", "#dadaeb", "#bcbddc", "#9e9ac8", "#756bb1", "#54278f"],
        7: ["#f2f0f7", "#dadaeb", "#bcbddc", "#9e9ac8", "#807dba", "#6a51a3", "#4a1486"],
        8: ["#fcfbfd", "#efedf5", "#dadaeb", "#bcbddc", "#9e9ac8", "#807dba", "#6a51a3", "#4a1486"],
        9: ["#fcfbfd", "#efedf5", "#dadaeb", "#bcbddc", "#9e9ac8", "#807dba", "#6a51a3", "#54278f", "#3f007d"]
    },
    Blues: {
        3: ["#deebf7", "#9ecae1", "#3182bd"],
        4: ["#eff3ff", "#bdd7e7", "#6baed6", "#2171b5"],
        5: ["#eff3ff", "#bdd7e7", "#6baed6", "#3182bd", "#08519c"],
        6: ["#eff3ff", "#c6dbef", "#9ecae1", "#6baed6", "#3182bd", "#08519c"],
        7: ["#eff3ff", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#084594"],
        8: ["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#084594"],
        9: ["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#08519c", "#08306b"]
    },
    Greens: {
        3: ["#e5f5e0", "#a1d99b", "#31a354"],
        4: ["#edf8e9", "#bae4b3", "#74c476", "#238b45"],
        5: ["#edf8e9", "#bae4b3", "#74c476", "#31a354", "#006d2c"],
        6: ["#edf8e9", "#c7e9c0", "#a1d99b", "#74c476", "#31a354", "#006d2c"],
        7: ["#edf8e9", "#c7e9c0", "#a1d99b", "#74c476", "#41ab5d", "#238b45", "#005a32"],
        8: ["#f7fcf5", "#e5f5e0", "#c7e9c0", "#a1d99b", "#74c476", "#41ab5d", "#238b45", "#005a32"],
        9: ["#f7fcf5", "#e5f5e0", "#c7e9c0", "#a1d99b", "#74c476", "#41ab5d", "#238b45", "#006d2c", "#00441b"]
    },
    Oranges: {
        3: ["#fee6ce", "#fdae6b", "#e6550d"],
        4: ["#feedde", "#fdbe85", "#fd8d3c", "#d94701"],
        5: ["#feedde", "#fdbe85", "#fd8d3c", "#e6550d", "#a63603"],
        6: ["#feedde", "#fdd0a2", "#fdae6b", "#fd8d3c", "#e6550d", "#a63603"],
        7: ["#feedde", "#fdd0a2", "#fdae6b", "#fd8d3c", "#f16913", "#d94801", "#8c2d04"],
        8: ["#fff5eb", "#fee6ce", "#fdd0a2", "#fdae6b", "#fd8d3c", "#f16913", "#d94801", "#8c2d04"],
        9: ["#fff5eb", "#fee6ce", "#fdd0a2", "#fdae6b", "#fd8d3c", "#f16913", "#d94801", "#a63603", "#7f2704"]
    },
    Reds: {
        3: ["#fee0d2", "#fc9272", "#de2d26"],
        4: ["#fee5d9", "#fcae91", "#fb6a4a", "#cb181d"],
        5: ["#fee5d9", "#fcae91", "#fb6a4a", "#de2d26", "#a50f15"],
        6: ["#fee5d9", "#fcbba1", "#fc9272", "#fb6a4a", "#de2d26", "#a50f15"],
        7: ["#fee5d9", "#fcbba1", "#fc9272", "#fb6a4a", "#ef3b2c", "#cb181d", "#99000d"],
        8: ["#fff5f0", "#fee0d2", "#fcbba1", "#fc9272", "#fb6a4a", "#ef3b2c", "#cb181d", "#99000d"],
        9: ["#fff5f0", "#fee0d2", "#fcbba1", "#fc9272", "#fb6a4a", "#ef3b2c", "#cb181d", "#a50f15", "#67000d"]
    },
    Greys: {
        3: ["#f0f0f0", "#bdbdbd", "#636363"],
        4: ["#f7f7f7", "#cccccc", "#969696", "#525252"],
        5: ["#f7f7f7", "#cccccc", "#969696", "#636363", "#252525"],
        6: ["#f7f7f7", "#d9d9d9", "#bdbdbd", "#969696", "#636363", "#252525"],
        7: ["#f7f7f7", "#d9d9d9", "#bdbdbd", "#969696", "#737373", "#525252", "#252525"],
        8: ["#ffffff", "#f0f0f0", "#d9d9d9", "#bdbdbd", "#969696", "#737373", "#525252", "#252525"],
        9: ["#ffffff", "#f0f0f0", "#d9d9d9", "#bdbdbd", "#969696", "#737373", "#525252", "#252525", "#000000"]
    },
    PuOr: {
        3: ["#f1a340", "#f7f7f7", "#998ec3"],
        4: ["#e66101", "#fdb863", "#b2abd2", "#5e3c99"],
        5: ["#e66101", "#fdb863", "#f7f7f7", "#b2abd2", "#5e3c99"],
        6: ["#b35806", "#f1a340", "#fee0b6", "#d8daeb", "#998ec3", "#542788"],
        7: ["#b35806", "#f1a340", "#fee0b6", "#f7f7f7", "#d8daeb", "#998ec3", "#542788"],
        8: ["#b35806", "#e08214", "#fdb863", "#fee0b6", "#d8daeb", "#b2abd2", "#8073ac", "#542788"],
        9: ["#b35806", "#e08214", "#fdb863", "#fee0b6", "#f7f7f7", "#d8daeb", "#b2abd2", "#8073ac", "#542788"],
        10: ["#7f3b08", "#b35806", "#e08214", "#fdb863", "#fee0b6", "#d8daeb", "#b2abd2", "#8073ac", "#542788", "#2d004b"],
        11: ["#7f3b08", "#b35806", "#e08214", "#fdb863", "#fee0b6", "#f7f7f7", "#d8daeb", "#b2abd2", "#8073ac", "#542788", "#2d004b"]
    },
    BrBG: {
        3: ["#d8b365", "#f5f5f5", "#5ab4ac"],
        4: ["#a6611a", "#dfc27d", "#80cdc1", "#018571"],
        5: ["#a6611a", "#dfc27d", "#f5f5f5", "#80cdc1", "#018571"],
        6: ["#8c510a", "#d8b365", "#f6e8c3", "#c7eae5", "#5ab4ac", "#01665e"],
        7: ["#8c510a", "#d8b365", "#f6e8c3", "#f5f5f5", "#c7eae5", "#5ab4ac", "#01665e"],
        8: ["#8c510a", "#bf812d", "#dfc27d", "#f6e8c3", "#c7eae5", "#80cdc1", "#35978f", "#01665e"],
        9: ["#8c510a", "#bf812d", "#dfc27d", "#f6e8c3", "#f5f5f5", "#c7eae5", "#80cdc1", "#35978f", "#01665e"],
        10: ["#543005", "#8c510a", "#bf812d", "#dfc27d", "#f6e8c3", "#c7eae5", "#80cdc1", "#35978f", "#01665e", "#003c30"],
        11: ["#543005", "#8c510a", "#bf812d", "#dfc27d", "#f6e8c3", "#f5f5f5", "#c7eae5", "#80cdc1", "#35978f", "#01665e", "#003c30"]
    },
    PRGn: {
        3: ["#af8dc3", "#f7f7f7", "#7fbf7b"],
        4: ["#7b3294", "#c2a5cf", "#a6dba0", "#008837"],
        5: ["#7b3294", "#c2a5cf", "#f7f7f7", "#a6dba0", "#008837"],
        6: ["#762a83", "#af8dc3", "#e7d4e8", "#d9f0d3", "#7fbf7b", "#1b7837"],
        7: ["#762a83", "#af8dc3", "#e7d4e8", "#f7f7f7", "#d9f0d3", "#7fbf7b", "#1b7837"],
        8: ["#762a83", "#9970ab", "#c2a5cf", "#e7d4e8", "#d9f0d3", "#a6dba0", "#5aae61", "#1b7837"],
        9: ["#762a83", "#9970ab", "#c2a5cf", "#e7d4e8", "#f7f7f7", "#d9f0d3", "#a6dba0", "#5aae61", "#1b7837"],
        10: ["#40004b", "#762a83", "#9970ab", "#c2a5cf", "#e7d4e8", "#d9f0d3", "#a6dba0", "#5aae61", "#1b7837", "#00441b"],
        11: ["#40004b", "#762a83", "#9970ab", "#c2a5cf", "#e7d4e8", "#f7f7f7", "#d9f0d3", "#a6dba0", "#5aae61", "#1b7837", "#00441b"]
    },
    PiYG: {
        3: ["#e9a3c9", "#f7f7f7", "#a1d76a"],
        4: ["#d01c8b", "#f1b6da", "#b8e186", "#4dac26"],
        5: ["#d01c8b", "#f1b6da", "#f7f7f7", "#b8e186", "#4dac26"],
        6: ["#c51b7d", "#e9a3c9", "#fde0ef", "#e6f5d0", "#a1d76a", "#4d9221"],
        7: ["#c51b7d", "#e9a3c9", "#fde0ef", "#f7f7f7", "#e6f5d0", "#a1d76a", "#4d9221"],
        8: ["#c51b7d", "#de77ae", "#f1b6da", "#fde0ef", "#e6f5d0", "#b8e186", "#7fbc41", "#4d9221"],
        9: ["#c51b7d", "#de77ae", "#f1b6da", "#fde0ef", "#f7f7f7", "#e6f5d0", "#b8e186", "#7fbc41", "#4d9221"],
        10: ["#8e0152", "#c51b7d", "#de77ae", "#f1b6da", "#fde0ef", "#e6f5d0", "#b8e186", "#7fbc41", "#4d9221", "#276419"],
        11: ["#8e0152", "#c51b7d", "#de77ae", "#f1b6da", "#fde0ef", "#f7f7f7", "#e6f5d0", "#b8e186", "#7fbc41", "#4d9221", "#276419"]
    },
    RdBu: {
        3: ["#ef8a62", "#f7f7f7", "#67a9cf"],
        4: ["#ca0020", "#f4a582", "#92c5de", "#0571b0"],
        5: ["#ca0020", "#f4a582", "#f7f7f7", "#92c5de", "#0571b0"],
        6: ["#b2182b", "#ef8a62", "#fddbc7", "#d1e5f0", "#67a9cf", "#2166ac"],
        7: ["#b2182b", "#ef8a62", "#fddbc7", "#f7f7f7", "#d1e5f0", "#67a9cf", "#2166ac"],
        8: ["#b2182b", "#d6604d", "#f4a582", "#fddbc7", "#d1e5f0", "#92c5de", "#4393c3", "#2166ac"],
        9: ["#b2182b", "#d6604d", "#f4a582", "#fddbc7", "#f7f7f7", "#d1e5f0", "#92c5de", "#4393c3", "#2166ac"],
        10: ["#67001f", "#b2182b", "#d6604d", "#f4a582", "#fddbc7", "#d1e5f0", "#92c5de", "#4393c3", "#2166ac", "#053061"],
        11: ["#67001f", "#b2182b", "#d6604d", "#f4a582", "#fddbc7", "#f7f7f7", "#d1e5f0", "#92c5de", "#4393c3", "#2166ac", "#053061"]
    },
    RdGy: {
        3: ["#ef8a62", "#ffffff", "#999999"],
        4: ["#ca0020", "#f4a582", "#bababa", "#404040"],
        5: ["#ca0020", "#f4a582", "#ffffff", "#bababa", "#404040"],
        6: ["#b2182b", "#ef8a62", "#fddbc7", "#e0e0e0", "#999999", "#4d4d4d"],
        7: ["#b2182b", "#ef8a62", "#fddbc7", "#ffffff", "#e0e0e0", "#999999", "#4d4d4d"],
        8: ["#b2182b", "#d6604d", "#f4a582", "#fddbc7", "#e0e0e0", "#bababa", "#878787", "#4d4d4d"],
        9: ["#b2182b", "#d6604d", "#f4a582", "#fddbc7", "#ffffff", "#e0e0e0", "#bababa", "#878787", "#4d4d4d"],
        10: ["#67001f", "#b2182b", "#d6604d", "#f4a582", "#fddbc7", "#e0e0e0", "#bababa", "#878787", "#4d4d4d", "#1a1a1a"],
        11: ["#67001f", "#b2182b", "#d6604d", "#f4a582", "#fddbc7", "#ffffff", "#e0e0e0", "#bababa", "#878787", "#4d4d4d", "#1a1a1a"]
    },
    RdYlBu: {
        3: ["#fc8d59", "#ffffbf", "#91bfdb"],
        4: ["#d7191c", "#fdae61", "#abd9e9", "#2c7bb6"],
        5: ["#d7191c", "#fdae61", "#ffffbf", "#abd9e9", "#2c7bb6"],
        6: ["#d73027", "#fc8d59", "#fee090", "#e0f3f8", "#91bfdb", "#4575b4"],
        7: ["#d73027", "#fc8d59", "#fee090", "#ffffbf", "#e0f3f8", "#91bfdb", "#4575b4"],
        8: ["#d73027", "#f46d43", "#fdae61", "#fee090", "#e0f3f8", "#abd9e9", "#74add1", "#4575b4"],
        9: ["#d73027", "#f46d43", "#fdae61", "#fee090", "#ffffbf", "#e0f3f8", "#abd9e9", "#74add1", "#4575b4"],
        10: ["#a50026", "#d73027", "#f46d43", "#fdae61", "#fee090", "#e0f3f8", "#abd9e9", "#74add1", "#4575b4", "#313695"],
        11: ["#a50026", "#d73027", "#f46d43", "#fdae61", "#fee090", "#ffffbf", "#e0f3f8", "#abd9e9", "#74add1", "#4575b4", "#313695"]
    },
    Spectral: {
        3: ["#fc8d59", "#ffffbf", "#99d594"],
        4: ["#d7191c", "#fdae61", "#abdda4", "#2b83ba"],
        5: ["#d7191c", "#fdae61", "#ffffbf", "#abdda4", "#2b83ba"],
        6: ["#d53e4f", "#fc8d59", "#fee08b", "#e6f598", "#99d594", "#3288bd"],
        7: ["#d53e4f", "#fc8d59", "#fee08b", "#ffffbf", "#e6f598", "#99d594", "#3288bd"],
        8: ["#d53e4f", "#f46d43", "#fdae61", "#fee08b", "#e6f598", "#abdda4", "#66c2a5", "#3288bd"],
        9: ["#d53e4f", "#f46d43", "#fdae61", "#fee08b", "#ffffbf", "#e6f598", "#abdda4", "#66c2a5", "#3288bd"],
        10: ["#9e0142", "#d53e4f", "#f46d43", "#fdae61", "#fee08b", "#e6f598", "#abdda4", "#66c2a5", "#3288bd", "#5e4fa2"],
        11: ["#9e0142", "#d53e4f", "#f46d43", "#fdae61", "#fee08b", "#ffffbf", "#e6f598", "#abdda4", "#66c2a5", "#3288bd", "#5e4fa2"]
    },
    RdYlGn: {
        3: ["#fc8d59", "#ffffbf", "#91cf60"],
        4: ["#d7191c", "#fdae61", "#a6d96a", "#1a9641"],
        5: ["#d7191c", "#fdae61", "#ffffbf", "#a6d96a", "#1a9641"],
        6: ["#d73027", "#fc8d59", "#fee08b", "#d9ef8b", "#91cf60", "#1a9850"],
        7: ["#d73027", "#fc8d59", "#fee08b", "#ffffbf", "#d9ef8b", "#91cf60", "#1a9850"],
        8: ["#d73027", "#f46d43", "#fdae61", "#fee08b", "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850"],
        9: ["#d73027", "#f46d43", "#fdae61", "#fee08b", "#ffffbf", "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850"],
        10: ["#a50026", "#d73027", "#f46d43", "#fdae61", "#fee08b", "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850", "#006837"],
        11: ["#a50026", "#d73027", "#f46d43", "#fdae61", "#fee08b", "#ffffbf", "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850", "#006837"]
    },
    Accent: {
        3: ["#7fc97f", "#beaed4", "#fdc086"],
        4: ["#7fc97f", "#beaed4", "#fdc086", "#ffff99"],
        5: ["#7fc97f", "#beaed4", "#fdc086", "#ffff99", "#386cb0"],
        6: ["#7fc97f", "#beaed4", "#fdc086", "#ffff99", "#386cb0", "#f0027f"],
        7: ["#7fc97f", "#beaed4", "#fdc086", "#ffff99", "#386cb0", "#f0027f", "#bf5b17"],
        8: ["#7fc97f", "#beaed4", "#fdc086", "#ffff99", "#386cb0", "#f0027f", "#bf5b17", "#666666"]
    },
    Dark2: {
        3: ["#1b9e77", "#d95f02", "#7570b3"],
        4: ["#1b9e77", "#d95f02", "#7570b3", "#e7298a"],
        5: ["#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#66a61e"],
        6: ["#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#66a61e", "#e6ab02"],
        7: ["#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#66a61e", "#e6ab02", "#a6761d"],
        8: ["#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#66a61e", "#e6ab02", "#a6761d", "#666666"]
    },
    Paired: {
        3: ["#a6cee3", "#1f78b4", "#b2df8a"],
        4: ["#a6cee3", "#1f78b4", "#b2df8a", "#33a02c"],
        5: ["#a6cee3", "#1f78b4", "#b2df8a", "#33a02c", "#fb9a99"],
        6: ["#a6cee3", "#1f78b4", "#b2df8a", "#33a02c", "#fb9a99", "#e31a1c"],
        7: ["#a6cee3", "#1f78b4", "#b2df8a", "#33a02c", "#fb9a99", "#e31a1c", "#fdbf6f"],
        8: ["#a6cee3", "#1f78b4", "#b2df8a", "#33a02c", "#fb9a99", "#e31a1c", "#fdbf6f", "#ff7f00"],
        9: ["#a6cee3", "#1f78b4", "#b2df8a", "#33a02c", "#fb9a99", "#e31a1c", "#fdbf6f", "#ff7f00", "#cab2d6"],
        10: ["#a6cee3", "#1f78b4", "#b2df8a", "#33a02c", "#fb9a99", "#e31a1c", "#fdbf6f", "#ff7f00", "#cab2d6", "#6a3d9a"],
        11: ["#a6cee3", "#1f78b4", "#b2df8a", "#33a02c", "#fb9a99", "#e31a1c", "#fdbf6f", "#ff7f00", "#cab2d6", "#6a3d9a", "#ffff99"],
        12: ["#a6cee3", "#1f78b4", "#b2df8a", "#33a02c", "#fb9a99", "#e31a1c", "#fdbf6f", "#ff7f00", "#cab2d6", "#6a3d9a", "#ffff99", "#b15928"]
    },
    Pastel1: {
        3: ["#fbb4ae", "#b3cde3", "#ccebc5"],
        4: ["#fbb4ae", "#b3cde3", "#ccebc5", "#decbe4"],
        5: ["#fbb4ae", "#b3cde3", "#ccebc5", "#decbe4", "#fed9a6"],
        6: ["#fbb4ae", "#b3cde3", "#ccebc5", "#decbe4", "#fed9a6", "#ffffcc"],
        7: ["#fbb4ae", "#b3cde3", "#ccebc5", "#decbe4", "#fed9a6", "#ffffcc", "#e5d8bd"],
        8: ["#fbb4ae", "#b3cde3", "#ccebc5", "#decbe4", "#fed9a6", "#ffffcc", "#e5d8bd", "#fddaec"],
        9: ["#fbb4ae", "#b3cde3", "#ccebc5", "#decbe4", "#fed9a6", "#ffffcc", "#e5d8bd", "#fddaec", "#f2f2f2"]
    },
    Pastel2: {
        3: ["#b3e2cd", "#fdcdac", "#cbd5e8"],
        4: ["#b3e2cd", "#fdcdac", "#cbd5e8", "#f4cae4"],
        5: ["#b3e2cd", "#fdcdac", "#cbd5e8", "#f4cae4", "#e6f5c9"],
        6: ["#b3e2cd", "#fdcdac", "#cbd5e8", "#f4cae4", "#e6f5c9", "#fff2ae"],
        7: ["#b3e2cd", "#fdcdac", "#cbd5e8", "#f4cae4", "#e6f5c9", "#fff2ae", "#f1e2cc"],
        8: ["#b3e2cd", "#fdcdac", "#cbd5e8", "#f4cae4", "#e6f5c9", "#fff2ae", "#f1e2cc", "#cccccc"]
    },
    Set1: {
        3: ["#e41a1c", "#377eb8", "#4daf4a"],
        4: ["#e41a1c", "#377eb8", "#4daf4a", "#984ea3"],
        5: ["#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00"],
        6: ["#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00", "#ffff33"],
        7: ["#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00", "#ffff33", "#a65628"],
        8: ["#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00", "#ffff33", "#a65628", "#f781bf"],
        9: ["#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00", "#ffff33", "#a65628", "#f781bf", "#999999"]
    },
    Set2: {
        3: ["#66c2a5", "#fc8d62", "#8da0cb"],
        4: ["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3"],
        5: ["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854"],
        6: ["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854", "#ffd92f"],
        7: ["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854", "#ffd92f", "#e5c494"],
        8: ["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854", "#ffd92f", "#e5c494", "#b3b3b3"]
    },
    Set3: {
        3: ["#8dd3c7", "#ffffb3", "#bebada"],
        4: ["#8dd3c7", "#ffffb3", "#bebada", "#fb8072"],
        5: ["#8dd3c7", "#ffffb3", "#bebada", "#fb8072", "#80b1d3"],
        6: ["#8dd3c7", "#ffffb3", "#bebada", "#fb8072", "#80b1d3", "#fdb462"],
        7: ["#8dd3c7", "#ffffb3", "#bebada", "#fb8072", "#80b1d3", "#fdb462", "#b3de69"],
        8: ["#8dd3c7", "#ffffb3", "#bebada", "#fb8072", "#80b1d3", "#fdb462", "#b3de69", "#fccde5"],
        9: ["#8dd3c7", "#ffffb3", "#bebada", "#fb8072", "#80b1d3", "#fdb462", "#b3de69", "#fccde5", "#d9d9d9"],
        10: ["#8dd3c7", "#ffffb3", "#bebada", "#fb8072", "#80b1d3", "#fdb462", "#b3de69", "#fccde5", "#d9d9d9", "#bc80bd"],
        11: ["#8dd3c7", "#ffffb3", "#bebada", "#fb8072", "#80b1d3", "#fdb462", "#b3de69", "#fccde5", "#d9d9d9", "#bc80bd", "#ccebc5"],
        12: ["#8dd3c7", "#ffffb3", "#bebada", "#fb8072", "#80b1d3", "#fdb462", "#b3de69", "#fccde5", "#d9d9d9", "#bc80bd", "#ccebc5", "#ffed6f"]
    }
});
/*global define*/
/*jslint devel: true */
/*jslint browser: true */
define('scalejs.visualization-d3/json-helper',[
    'scalejs!core',
    'knockout',
    'd3',
    'd3.colorbrewer',
    'scalejs.visualization-d3/nested-data-helper'
], function (
    core,
    ko,
    d3,
    colorbrewer,
    nestedDataHelper
) {
    "use strict";

    var is = core.type.is,
        unwrap = ko.utils.unwrapObservable,
        getNode = nestedDataHelper.getNode,
        nodeScale = d3.scale.linear();

    function getProperty(node, path) {
        if (typeof path === 'function') {
            return path(node);
        }
        return node[path];
    }

    return function (parameters, triggerTime, zoomedItemPath) {

        var json,
            globals = {},
            sortByFuncs = {
                unordered: function (a, b) { return a.index - b.index; },
                ascendingSize: function (a, b) { return a.size - b.size; },
                descendingSize: function (a, b) { return b.size - a.size; }
            };

        // Sets each parameter in globals to the parameter or to a default value:
        function setGlobalParameters() {
            globals.idPath = unwrap(parameters.idPath) || 'id';
            globals.namePath = unwrap(parameters.namePath) || globals.idPath;
            globals.childrenPath = unwrap(parameters.childrenPath) || 'children';
            globals.areaPath = unwrap(parameters.areaPath) || 'area';
            globals.colorPath = unwrap(parameters.colorPath) || 'color';
            globals.colorPalette = unwrap(parameters.colorPalette) || 'PuBu';
            globals.fontSize = unwrap(parameters.fontSize) || 11;
            globals.fontFamily = unwrap(parameters.fontFamily) || "Times New Roman";
            globals.fontColor = unwrap(parameters.fontColor) || "#000";

            // Set global colorPalette (array, undefined or string) parameters:
            if (globals.colorPalette instanceof Array) {
                if (globals.colorPalette.length === 1) {
                    globals.colorPalette[1] = globals.colorPalette[0];
                }
            } else {
                globals.colorPalette = colorbrewer[globals.colorPalette][3];
            }
        }

        // Loop through levels to parse parameters:
        function parseLevelParameters(lvls) {
            // Clear levels:
            var levels = [],
                l,
                a;

            // Loop through all levels and parse the parameters:
            for (var i = 0; i < lvls.length; i += 1) {
                l = lvls[i];
                if (l instanceof Object) {
                    // Level has parameters, or use globals
                    levels[i] = {
                        idPath: unwrap(l.idPath) || globals.idPath,
                        namePath: unwrap(l.namePath || l.idPath) || globals.namePath,
                        childrenPath: unwrap(l.childrenPath) || globals.childrenPath,
                        areaPath: unwrap(l.areaPath) || globals.areaPath,
                        colorPath: unwrap(l.colorPath) || globals.colorPath,
                        fontSize: unwrap(l.fontSize) || globals.fontSize,
                        fontFamily: unwrap(l.fontFamily) || globals.fontFamily,
                        fontColor: unwrap(l.fontColor) || globals.fontColor,
                        colorPalette: unwrap(l.colorPalette)          // more processing below
                    };

                    // Set level's colorPalette (array, undefined or string) and colorScale parameters:
                    // A new scale must be created for every new colorPalette, eg array or string.
                    if (levels[i].colorPalette instanceof Array) {
                        if (levels[i].colorPalette.length === 1) levels[i].colorPalette[1] = levels[i].colorPalette[0];
                    } else if (levels[i].colorPalette == null) {    // Catch if null or undefined
                        levels[i].colorPalette = globals.colorPalette;
                    } else {
                        levels[i].colorPalette = colorbrewer[levels[i].colorPalette][3];
                    }
                } else {
                    levels[i] = {   // l defines the childrenPath, use global parameters for the rest:
                        childrenPath: l || globals.childrenPath,
                        idPath: globals.idPath,
                        namePath: globals.namePath,
                        areaPath: globals.areaPath,
                        colorPath: globals.colorPath,
                        colorPalette: globals.colorPalette,
                        fontSize: globals.fontSize,
                        fontFamily: globals.fontFamily,
                        fontColor: globals.fontColor
                    };
                }
            }
            return levels;
        }

        // Recursively traverse json data, and build it for rendering:
        function createNodeJson(node, levelConfig, index, maxlvl) {
            var childNode, children, stepSize, color,
                lvl = levelConfig[index] || globals,
                newNode = {
                    id: getProperty(node, lvl.idPath) || '',
                    name: node[lvl.namePath] || '',
                    lvl: index,
                    size: getProperty(node, lvl.areaPath) !== undefined ? getProperty(node, lvl.areaPath) : 1,
                    colorSize: getProperty(node, lvl.colorPath) || 0,
                    fontSize: lvl.fontSize,
                    fontFamily: lvl.fontFamily,
                    fontColor: lvl.fontColor
                };


            // Check if leaf node:
            if (!getProperty(node, lvl.childrenPath)) {
                if (maxlvl.value < index) maxlvl.value = index; // Update the max depth to the leaf's depth (if deeper than maxlvl's value):
                return newNode;
            }

            // Set default properties of node with children:
            newNode.children = [];
            newNode.childrenReference = [];

            // Node has children, so set them up first:
            children = getProperty(node, lvl.childrenPath);

            //Convert to array if it is not
            if (!is(children,'array')) {
                a = [];
                Object.keys(children).forEach(function (k) {
                    a.push(children[k]);
                });
                children = a;
            }


            for (var i = 0; i < children.length; i += 1) {
                childNode = createNodeJson(children[i], levelConfig, index + 1, maxlvl); //recursion
                childNode.parent = newNode;
                childNode.index = i;    // Set node's index to match the index it appears in the original dataset.

                // If parent has no size, default to adding child colors.
                if (getProperty(node, lvl.areaPath) === undefined) {
                    newNode.size += childNode.size;
                }

                // If parent has no color, default to adding child colors.
                if (getProperty(node, lvl.colorPath) === undefined) {
                    newNode.colorSize += childNode.colorSize;
                }

                newNode.minSize = Math.min(newNode.minSize || childNode.size, childNode.size);
                newNode.maxSize = Math.max(newNode.maxSize || childNode.size + 1, childNode.size);
                newNode.minColor = Math.min(newNode.minColor || childNode.colorSize, childNode.colorSize);
                newNode.maxColor = Math.max(newNode.maxColor || childNode.colorSize + 1, childNode.colorSize);

                // d3 reorganizes the children later in the code, so the following array is used to preserve children order for indexing:
                newNode.children[i] = newNode.childrenReference[i] = childNode;
            }

            nodeScale.range(levelConfig.length <= index + 1 ? globals.colorPalette : levelConfig[index + 1].colorPalette);
            // Set domain of color values:
            stepSize = (newNode.maxColor - newNode.minColor) / Math.max(nodeScale.range().length - 1, 1);
            nodeScale.domain(d3.range(newNode.minColor, newNode.maxColor + stepSize, stepSize));

            for (var i = 0; i < children.length; i += 1) newNode.children[i].color = nodeScale(newNode.children[i].colorSize);

            return newNode;
        }

        json = ko.computed(function () {
            var maxlvl = { value: 0 }, stepSize,
                // Get parameters (or defaults values):
                sortByParam = unwrap(parameters.sortBy) || "unordered",
                maxVisibleLevels = unwrap(parameters.maxVisibleLevels),
                dataSource = unwrap(parameters.data) || { name: "Empty" },
                levelsSource = unwrap(parameters.levels) || [{}],
                levels;

            setGlobalParameters();

            // Create copy of data in a easy structure for d3:
            levels = parseLevelParameters(levelsSource);
            // Generate Json:
            var root = createNodeJson(dataSource, levels, 0, maxlvl, 0);
            // Make maxVisibleLevels the max lvl if not specified:
            maxVisibleLevels = maxVisibleLevels || maxlvl.value + 1;

            // Set root's sortBy function used to sort nodes.
            if (sortByParam instanceof Function) {
                root.sortBy = sortByParam;
            } else if (sortByFuncs[sortByParam]) {
                root.sortBy = sortByFuncs[sortByParam];
            } else {
                root.sortBy = sortByParam.unordered;
            }

            // Setup colorscale for the root:
            nodeScale.range(levels[0].colorPalette);
            stepSize = 2 / Math.max(nodeScale.range().length - 1, 1);
            nodeScale.domain(d3.range(root.colorSize - stepSize / 2, root.colorSize + stepSize / 2, stepSize));

            // Set root's color:
            root.color = nodeScale(root.colorSize);

            // Set root-specific properties:
            root.curLevel = getNode(zoomedItemPath(), root).lvl;
            root.curMaxLevel = root.curLevel + maxVisibleLevels - 1;
            root.maxlvl = maxlvl.value;
            root.maxVisibleLevels = maxVisibleLevels;
            root.levels = levels;
            root.index = 0;

            // Return the new json data:
            return root;
        });

        return json;

    }

});

/*global define*/
define('scalejs.visualization-d3/color-helper',[], function () {
    "use strict";

    function parseColor(color) {
        var rgba,
            opacity = 1;
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

    return {
        parseColor: parseColor
    }

});
/*global define*/
define('scalejs.visualization-d3/visualizations/treemap',[
    'd3',
    'scalejs.visualization-d3/canvas-helper',
    'scalejs.visualization-d3/gesture-helper',
    'knockout',
    'scalejs.visualization-d3/json-helper',
    'scalejs.visualization-d3/nested-data-helper',
    'scalejs.visualization-d3/color-helper'
], function (
    d3,
    canvasHelper,
    gestureHelperCreator,
    ko,
    jsonHelper,
    nestedDataHelper,
    colorHelper
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
            x,
            y,
            treemapLayout,
            canvasArea,
            spacing = 3,
            borderColor,
            kx,
            ky,//
            parameters,
            triggerTime,
            enableZoom,
            enableTouch,
            zoomedItemPath,
            selectedItemPath,
            heldItemPath,
            enableRotate = false,
            enableRotateDefault = false,
            enableRootZoom = true,
            fontSize = 11,
            fontFamily = "Times New Roman",
            allowTextOverflow = false,
            nodeSelected,
            gestureHelper,
            root;

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

        function groupTween(opacity) {
            return function (d) {
                // Create interpolations used for a nice slide:
                var nodeSpaced = getNodeSpaced(d, d),
                    interpX,
                    interpY,
                    interpWidth,
                    interpHeight,
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

        function remove() {
            canvasArea.remove();
        }

        function update(duration) {
            var zoomedNode = getNode(zoomedItemPath(), json()),
                nodes,
                groupNodes,
                newGroupNodes,
                removeGroupNodes,
                textNodes,
                newTextNodes,
                removeTextNodes;

            root = json();

            duration = (duration !== undefined) ? duration : 1000;

            // Filter out nodes with children:
            nodes = treemapLayout.size([canvasInfo.canvasWidth, canvasInfo.canvasHeight])
                .sort(root.sortBy).nodes(root)
                .filter(function (d) {
                    return getDistanceToTreePath(d, getNodeTreePath(zoomedNode)) < root.maxVisibleLevels;
                })
                .sort(function (a, b) {
                    return a.depth === b.depth ? b.value - a.value : a.depth - b.depth;
                });

            groupNodes = canvasArea.selectAll("group").data(nodes, function (d) { return d.id; });

            // Add new nodes to Canvas:
            newGroupNodes = groupNodes.enter().append("group").each(function (d) {
                var dNode = d.parent || d,
                    newColor = parseColor(d.children && d.lvl < root.curMaxLevel ? borderColor(d.lvl / (root.maxlvl - 1)) : d.color); //?
                this.left = x(dNode.x) + kx * dNode.dx / 2;
                this.top = y(dNode.y) + ky * dNode.dy / 2;
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
            kx = canvasInfo.canvasWidth / zoomedNode.dx;
            ky = canvasInfo.canvasHeight / zoomedNode.dy;
            x.domain([zoomedNode.x, zoomedNode.x + zoomedNode.dx]);
            y.domain([zoomedNode.y, zoomedNode.y + zoomedNode.dy]);

            applyTouchTween(newGroupNodes, newTextNodes, zoomedNode, duration);
            applyTouchTween(groupNodes, groupNodes.select("text"), zoomedNode, duration);

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
            }).tween("textTween", textTween(zoomedNode));

            // Prevent event from firing more than once:
            if (d3.event) {
                d3.event.stopPropagation();
            }
        }

        function resize(width, height) {
            canvasInfo.canvasWidth = width;
            canvasInfo.canvasHeight = height;

            canvasInfo.canvas.attr('width', canvasInfo.canvasWidth);
            canvasInfo.canvas.attr('height', canvasInfo.canvasHeight);

            x.range([0, canvasInfo.canvasWidth]);
            y.range([0, canvasInfo.canvasHeight]);
        }

        function initializeCanvas(element) {

            canvasInfo = canvasHelper.initializeCanvas(element);
        }

        function setupGestures(element) {
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
                    enableRotateDefault,
                    element,
                    update
                );

            touchFunc = tempFuncObj.selectTouch;
            zoomFunc = tempFuncObj.selectZoom;
            heldFunc = tempFuncObj.selectHeld;
            releaseFunc = tempFuncObj.selectRelease;
        }

        function initializeTreemap(element, valueAccessor) {

            var nodes;

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

            setupGestures(element);

            //start real init
            // Setup variables:
            x = mapValue().range([0, canvasInfo.canvasWidth]);
            y = mapValue().range([0, canvasInfo.canvasHeight]);

            // Set Border Colors
            borderColor = (parameters.borderColor === undefined) ? d3.interpolate("#888", "#fff") : d3.interpolate(parameters.borderColor[0], parameters.borderColor[1]);

            // This is a new treemap:
            // Setup treemap and SVG:
            treemapLayout = d3.layout.treemap()
                            .round(false)
                            .sort(root.sortBy)
                            .size([canvasInfo.canvasWidth, canvasInfo.canvasHeight])
                            .sticky(false)
                            .mode('squarify')
                            .value(function (d) { return d.size; })
                            .children(function (d) { return d.children; });

            canvasArea = canvasInfo.canvas.append("group").each(function () {
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

            // Add nodes to Canvas:
            nodeSelected = getNode(zoomedItemPath(), json());
            kx = canvasInfo.canvasWidth / nodeSelected.dx;
            ky = canvasInfo.canvasHeight / nodeSelected.dy;
            x.domain([nodeSelected.x, nodeSelected.x + nodeSelected.dx]);
            y.domain([nodeSelected.y, nodeSelected.y + nodeSelected.dy]);
            update(0);
        }

        return {
            initializeTreemap: initializeTreemap
        }
    }

    function init(element, valueAccessor) {

        var treemapObj = createInstance();

        treemapObj.initializeTreemap(element, valueAccessor);
    }

    return {
        init: init
    };

});

/*global define*/
define('scalejs.visualization-d3/visualizations/sunburst',[
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
            nodeSelected,
            gestureHelper;

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

            canvasInfo.canvas.attr('width', canvasInfo.canvasWidth);
            canvasInfo.canvas.attr('height', canvasInfo.canvasHeight);

            radius = Math.min(canvasInfo.canvasWidth, canvasInfo.canvasHeight) / 2;
        }

        function initializeCanvas(element) {

            canvasInfo = canvasHelper.initializeCanvas(element);

        }

        function setupGestures(element) {
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
                    enableRotateDefault,
                    element,
                    update
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

            setupGestures(element);

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

/*global define, require*/
define('scalejs.visualization-d3/loader',[
    'scalejs!core',
    'knockout'
], function (
    core,
    ko
) {
    "use strict";

    var unwrap = ko.unwrap;

    if (ko.bindingHandlers.visualizations) {
        console.error("visualizations is already setup");
    }

    ko.virtualElements.allowedBindings.visualizations = true;

    ko.bindingHandlers.visualizations = {
        init: function (element, valueAccessor) {
            var type = valueAccessor().type;
                
            function initializeViz() {
                var vis = require('./scalejs.visualization-d3/visualizations/' + type());
                if (vis !== undefined) {
                    vis.init(element, valueAccessor);

                } else {
                    console.warn("Invalid visualization type:", type());
                }
            }

            type.subscribe(initializeViz);

            initializeViz();
        }
    }
});
/*global define*/
/*jslint devel: true */
define('scalejs.visualization-d3',[
    'knockout',
    'scalejs.visualization-d3/visualizations/treemap',
    'scalejs.visualization-d3/visualizations/sunburst',
    'scalejs.visualization-d3/loader'
], function (
    ko,
    treemap,
    sunburst
) {
    'use strict';

    if (ko.bindingHandlers.treemap) {
        console.error("treemap is already setup");
    }

    if (ko.bindingHandlers.sunburst) {
        console.error("sunburst is already setup");
    }

    ko.bindingHandlers.treemap = treemap;
    ko.bindingHandlers.sunburst = sunburst;
    ko.virtualElements.allowedBindings.treemap = true;
    ko.virtualElements.allowedBindings.sunburst = true;
});


