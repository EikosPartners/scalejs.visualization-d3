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
            canvasWidth,
            canvasHeight,
            root,
            canvasArea,
            posx = 0,
            posy = 0;

        function posTween(posx, posy) {
            return function () {
                // Create interpolations used for a nice slide around the parent:
                var interpX = d3.interpolate(this.left, this.d.x + posx),
                    interpY = d3.interpolate(this.top, this.d.y + posy),
                    element = this;
                return function (t) {
                    element.left = interpX(t);
                    element.top = interpY(t);
                };
            };
        }

        // Zoom after click:
        function zoom() {
            if (canvasArea === undefined) {
                return; // Catch for if treemap hasn't been setup.
            }

            // Prevent event from firing more than once:
            if (d3.event) {
                d3.event.stopPropagation();
            }
        }

        function addNodes(celSel) {
            var cell = celSel.enter().append("group").each(function (d) {
                this.originX = "center";
                this.originY = "center";
                this.left = d.x;
                this.top = d.y;
            });

            // Add rectangle to each node:
            cell.append("rect").each(function (d) {
                this.width = d.dx;
                this.height = d.dy;
                this.fill = d.color;
            });

            // Add title to each node:
            cell.append("text").each(function (d) {
                this.fontSize = 11;
                this.text = d.name;
            });
        }

        function update() {
            if (canvasArea === undefined) {
                return; // Catch for if treemap hasn't been setup.
            }

            // Randomize goto position:
            posx = Math.random() * canvasWidth / 4;
            posy = Math.random() * canvasHeight / 4;

            // Update each node:
            canvasArea.transition()
                .duration(1000)
                .tween("posTween", posTween(posx, posy));
        }

        function init(
            element,
            width,
            height
        ) {
            if (canvasArea !== undefined) {
                return; // Catch for if treemap has been setup.
            }
            canvasElement = element;
            canvasWidth = width;
            canvasHeight = height;

            // Define temp vars:
            var celSel, i, x, y, w, h, col;

            // Generate test data:
            json = [];
            for (i = 0; i < 500; i += 1) {
                x = Math.random() * width / 2 + width / 4;
                y = Math.random() * height / 2 + height / 4;
                w = 20;
                h = 20;
                col = "#ff0000";
                json[i] = {
                    x: x,
                    y: y,
                    dx: w,
                    dy: h,
                    color: col,
                    name: String(i)
                };
            }
            root = json;

            canvasArea = canvasElement.append("group").each(function () {
                this.originX = "center";
                this.originY = "center";
                this.d = {
                    x: this.left,
                    y: this.top
                };
            });

            // Join data with selection:
            celSel = canvasArea.selectAll("group")
                    .data(root, function (d) { return d.name; });

            // Add nodes to Canvas:
            addNodes(celSel);

            canvasElement.pumpRender();
        }

        function resize(width, height) {
            canvasWidth = width;
            canvasHeight = height;
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
            enableRotate: false
        };
    };
});