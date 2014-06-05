/*global define*/
/*jslint devel: true */
/*jslint browser: true */
define([
    'scalejs!core',
    'd3'

], function (
    core,
    d3
) {
    var transform = {
        left: 0,
        top: 0,
        rotate: 0,
        scale: 1
    };

    // Clear the canvas's transform and animate from current to cleared state:
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

    // The following set of callbacks are for the pinch&zoom touch handler:
    function renderCallback(left, top, rotate, scale) { // Called on beginning and end of touch gestures:
        // Update transform:
        transform.left = left;
        transform.top = top;
        transform.rotate = rotate;
        transform.scale = scale;
        canvas.select("group")
            .attr("scaleX", transform.scale)
            .attr("scaleY", transform.scale)
            .attr("angle", transform.rotate)
            .attr("left", transform.left)
            .attr("top", transform.top);
        canvas.pumpRender();
    }


    //====
    function getTransform() {
        return transform;
    }

    function setTransform(input) {
        transform.left = input.left;
        transform.top = input.top;
        transform.rotate = input.rotate;
        transform.scale = input.scale;
    }

    return {
        getTransform: getTransform,
        setTransform: setTransform,
        resetTransformAnimation: resetTransformAnimation,
        renderCallback: renderCallback
    };
});