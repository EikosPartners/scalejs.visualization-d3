/*global define*/
/*jslint devel: true */
/*jslint browser: true */
define([
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