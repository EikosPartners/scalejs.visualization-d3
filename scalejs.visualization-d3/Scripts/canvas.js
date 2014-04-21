/*global define*/
/*jslint devel: true */
/*jslint browser: true */
define([
    'hammer'
], function (
    hammer
) {
    "use strict";

    // Get requestAnimationFrame function based on which browser:
    var requestAnimFrame = window.requestAnimationFrame ||
                           window.webkitRequestAnimationFrame ||
                           window.mozRequestAnimationFrame ||
                           function (callback) {
                               window.setTimeout(callback, 1000 / 60);
                           },
        deg90InRad = Math.PI * 0.5; // 90 degrees in radians.

    return function (canvas) {
        var context = canvas.getContext("2d"),
            // Canvas object (unique to each canvas):
            canvasObj = {
                type: "canvas",
                className: "canvas",
                element: canvas,
                context: context,
                parent: canvasObj,
                children: [],
                animations: [],
                requestFrameID: undefined,
                setwidth: function (width) {
                    this.element.width = width;
                },
                setheight: function (height) {
                    this.element.height = height;
                },
                onAnimationFrame: function () {
                    // Check if there is anything to animate:
                    if (canvasObj.animations.length <= 0) {
                        canvasObj.requestFrameID = undefined;
                        return;
                    }
                    // Request to call this function on next frame (done before rendering to make animations smoother):
                    canvasObj.requestFrameID = requestAnimFrame(canvasObj.onAnimationFrame);
                    // Get current time to test if animations are over:
                    var curTime = new Date().getTime();
                    // Execute all animations, remove any that are finished:
                    canvasObj.animations = canvasObj.animations.filter(function (animation) {
                        // Call tween function for object:
                        var timeRatio = Math.min((curTime - animation.timeStart) / animation.duration, 1);  // Get the current animation fram which is can be [0, 1).
                        animation.tweenFunc.call(animation, animation.easeFunc(timeRatio)); // Call animation tween function.
                        // Filter out animations which exceeded the time:
                        return curTime < animation.timeEnd;
                    });
                    // Render objects:
                    canvasObj.pumpRender();
                },
                pumpRender: function () {
                    // Reset transform:
                    canvasObj.context.setTransform(1, 0, 0, 1, 0, 0);
                    // Clear globals:
                    canvasObj.context.font = "40px Times New Roman";
                    canvasObj.context.fontFamily = "Times New Roman";
                    canvasObj.context.fontSize = 40;
                    // Calculate all objects' boundaries and parameters:
                    canvasObj.children.forEach(function (child) { child.calcBounds(); });
                    // Clear canvas:
                    canvasObj.context.clearRect(0, 0, canvasObj.element.width, canvasObj.element.height);
                    // Render all objects:
                    canvasObj.children.forEach(function (child) { child.render(); });
                },
                startRender: function () {},
                render: function () { this.pumpRender(); }
            },
            // Object that holds the offset based on size:
            getOffset = {
                left: function (size) {
                    return 0;
                },
                top: function (size) {
                    return 0;
                },
                center: function (size) {
                    return -size / 2;
                },
                right: function (size) {
                    return -size;
                },
                bottom: function (size) {
                    return -size;
                }
            },
            // Object that holds offset+position data:
            applyOffset = {
                left: function (pos, size) {
                    return pos;
                },
                top: function (pos, size) {
                    return pos;
                },
                center: function (pos, size) {
                    return pos - size / 2;
                },
                right: function (pos, size) {
                    return pos - size;
                },
                bottom: function (pos, size) {
                    return pos - size;
                }
            },
            // Object that holds all object type constructors:
            createObject = {
                group: function (opts) {
                    return {
                        type: "group",
                        className: "group",
                        parent: opts.parent || canvasObj,
                        id: opts.id || opts.parent.children.length,
                        data: opts.data || {},
                        fontFamily: opts.fontFamily || "",
                        fontSize: opts.fontSize || 0,
                        originX: opts.originX || "left",
                        originY: opts.originY || "top",
                        left: opts.left || 0,
                        top: opts.top || 0,
                        width: opts.width || 0,
                        height: opts.height || 0,
                        angle: opts.angle || 0,
                        scaleX: opts.scaleX || 1,
                        scaleY: opts.scaleY || 1,
                        backFill: opts.backFill || "",
                        offset: { left: 0, top: 0 },
                        pos: { left: 0, top: 0 },
                        extents: { left: 0, top: 0, right: 0, bottom: 0 },
                        children: [],
                        getExtents: function () {
                            return this.extents;
                        },
                        calcBounds: function () {
                            // Check if font is set on group:
                            if (this.fontFamily && this.fontSize) {
                                // Compile font:
                                this.font = this.fontSize + "px " + this.fontFamily;
                                canvasObj.context.font = this.font;
                                canvasObj.context.fontFamily = this.fontFamily;
                                canvasObj.context.fontSize = this.fontSize;
                            } else {
                                this.font = "";
                            }
                            // Calculate children's boundaries and parameters:
                            this.children.forEach(function (child) { child.calcBounds(); });
                            if (this.children.length > 0) {
                                // Get first child's extents:
                                var childExtents = this.children[0].extents,
                                    i;
                                // Set this.extents to first child:
                                this.extents.left = childExtents.left;
                                this.extents.top = childExtents.top;
                                this.extents.right = childExtents.right;
                                this.extents.bottom = childExtents.bottom;
                                // Update this.extents based on the other children:
                                for (i = 1; i < this.children.length; i += 1) {
                                    childExtents = this.children[i].extents;
                                    if (childExtents.left < this.extents.left) {
                                        this.extents.left = childExtents.left;
                                    }
                                    if (childExtents.top < this.extents.top) {
                                        this.extents.top = childExtents.top;
                                    }
                                    if (childExtents.right > this.extents.right) {
                                        this.extents.right = childExtents.right;
                                    }
                                    if (childExtents.bottom > this.extents.bottom) {
                                        this.extents.bottom = childExtents.bottom;
                                    }
                                }
                            } else {
                                // Set extents to center:
                                this.extents.left = 0;
                                this.extents.top = 0;
                                this.extents.right = 0;
                                this.extents.bottom = 0;
                            }
                            // Calculate boundaries and additional parameters:
                            /*this.width = (this.extents.right - this.extents.left) * this.scaleX;
                            this.height = (this.extents.bottom - this.extents.top) * this.scaleY;
                            this.offset.left = getOffset[this.originX](this.width);
                            this.offset.top = getOffset[this.originY](this.height);
                            this.pos.left = this.left + this.offset.left;
                            this.pos.top = this.top + this.offset.top;
                            this.extents.left += this.pos.left;
                            this.extents.top += this.pos.top;
                            this.extents.right += this.pos.left;
                            this.extents.bottom += this.pos.top;*/
                            this.offset.left = getOffset[this.originX](this.width);
                            this.offset.top = getOffset[this.originY](this.height);
                            this.pos.left = this.left + this.offset.left;
                            this.pos.top = this.top + this.offset.top;
                            this.radianAngle = this.angle * Math.PI / 180;
                        },
                        render: function () {
                            canvasObj.context.save();   // Required to restore transform matrix after the following render:
                            canvasObj.context.translate(this.pos.left, this.pos.top);   // Set group center.
                            canvasObj.context.scale(this.scaleX, this.scaleY);  // Scale group at center.
                            canvasObj.context.rotate(this.radianAngle);   // Rotate group at center.
                            if (this.backFill) {
                                canvasObj.context.fillStyle = this.backFill;
                                canvasObj.context.fillRect(this.pos.left, this.pos.top, this.width, this.height);
                            }
                            if (this.font) {    // Set font if a global font is set.
                                // Save previous family and size:
                                var pFontFamily = canvasObj.context.fontFamily,
                                    pFontSize = canvasObj.context.fontSize;
                                // Set font and family and size:
                                canvasObj.context.font = this.font;
                                canvasObj.context.fontFamily = this.fontFamily;
                                canvasObj.context.fontSize = this.fontSize;
                                this.children.forEach(function (child) { child.render(); });    // Render children.
                                // Restore family and size:
                                canvasObj.context.fontFamily = pFontFamily;
                                canvasObj.context.fontSize = pFontSize;

                            } else {
                                this.children.forEach(function (child) { child.render(); });    // Render children.
                            }
                            canvasObj.context.restore();
                        },
                        isPointIn: function (posX, posY, event) {
                            // Remove translate:
                            posX -= this.pos.left;
                            posY -= this.pos.top;
                            // Remove scale:
                            posX /= this.scaleX;
                            posY /= this.scaleY;
                            // Remove rotate:
                            var sin = Math.sin(-this.radianAngle),
                                cos = Math.cos(-this.radianAngle),
                                tposX = posX;
                            posX = posX * cos - posY * sin;
                            posY = tposX * sin + posY * cos;
                            // Loop through all children and check if the point is in:
                            return this.children.some(function (child) {
                                return child.isPointIn(posX, posY, event);
                            });
                            // Use the last extents (as it was last visible to user for click event):
                            //return posX >= this.extents.left && posY >= this.extents.top && posX <= this.extents.right && posY <= this.extents.bottom;
                        },
                        mouseDownEvent: function (posX, posY, event) {
                            canvasObj.context.save();   // Required to restore transform matrix after the following transform:
                            // Translate position:
                            //canvasObj.context.translate(this.pos.left, this.pos.top);
                            posX -= this.pos.left;
                            posY -= this.pos.top;
                            // Scale Position:
                            //canvasObj.context.scale(1 / this.scaleX, 1 / this.scaleY);
                            posX /= this.scaleX;
                            posY /= this.scaleY;
                            // Rotate position:
                            //canvasObj.context.rotate(-this.radianAngle);
                            var sin = Math.sin(-this.radianAngle),
                                cos = Math.cos(-this.radianAngle),
                                tposX = posX;
                            posX = posX * cos - posY * sin;
                            posY = tposX * sin + posY * cos;
                            // Loop through all children and check if they have been clicked:
                            this.children.forEach(function (child) {
                                if (child.isPointIn(posX, posY, event)) {
                                    child.mouseDownEvent.call(child, posX, posY, event);
                                }
                            });
                            this.onmousedown && this.onmousedown.call(this, this.data.data);
                            canvasObj.context.restore();
                        }
                    };
                },
                rect: function (opts) {
                    return {
                        type: "obj",
                        className: "rect",
                        parent: opts.parent || canvasObj,
                        id: opts.id || opts.parent.children.length,
                        data: opts.data || {},
                        left: opts.left || 0,
                        top: opts.top || 0,
                        originX: opts.originX || "left",
                        originY: opts.originY || "top",
                        width: opts.width || 0,
                        height: opts.height || 0,
                        fill: opts.fill || "#000",
                        offset: { left: 0, top: 0 },
                        pos: { left: 0, top: 0 },
                        extents: { left: 0, top: 0, right: 0, bottom: 0 },
                        getExtents: function () {
                            return this.extents;
                        },
                        calcBounds: function () {
                            // Calculate boundaries and additional parameters:
                            this.offset.left = getOffset[this.originX](this.width);
                            this.offset.top = getOffset[this.originY](this.height);
                            this.pos.left = this.left + this.offset.left;
                            this.pos.top = this.top + this.offset.top;
                            this.extents.left = this.pos.left;
                            this.extents.top = this.pos.top;
                            this.extents.right = this.pos.left + this.width;
                            this.extents.bottom = this.pos.top + this.height;
                        },
                        render: function () {
                            //canvasObj.context.save();
                            canvasObj.context.fillStyle = this.fill;
                            canvasObj.context.fillRect(this.pos.left, this.pos.top, this.width, this.height);
                            //canvasObj.context.restore();
                        },
                        isPointIn: function (posX, posY, event) {
                            // Use the last extents (as it was last visible to user for click event):
                            return posX >= this.extents.left && posY >= this.extents.top && posX <= this.extents.right && posY <= this.extents.bottom;
                        },
                        mouseDownEvent: function (posX, posY, event) {
                            this.onmousedown && this.onmousedown.call(this, this.data.data);
                        }
                    };
                },
                text: function (opts) {
                    return {
                        type: "obj",
                        className: "text",
                        parent: opts.parent || canvasObj,
                        id: opts.id || opts.parent.children.length,
                        data: opts.data || {},
                        fontFamily: opts.fontFamily || "",//"Times New Roman",
                        fontSize: opts.fontSize || 0,//40,
                        text: opts.text || "",
                        setText: function (text) {
                            // Compile font:
                            if (this.fontFamily && this.fontSize) {
                                this.font = this.fontSize + "px " + this.fontFamily;
                                this.height = this.fontSize;
                            } else {
                                this.height = canvasObj.context.fontSize;
                            }
                            // Check if text has changed, if so get width:
                            if (this.calcText !== this.text) {
                                canvasObj.context.save();
                                this.font && (canvasObj.context.font = this.font);  // Only set font if not using the global font.
                                //canvasObj.context.fillStyle = this.fill;  // not needed to compute width
                                this.text = text;
                                this.width = canvasObj.context.measureText(text || "").width;
                                canvasObj.context.restore();
                                this.calcText = this.text;
                            }
                        },
                        originX: opts.originX || "left",
                        originY: opts.originY || "top",
                        fill: opts.fill || "#000",
                        opacity: opts.opacity || 1,
                        left: opts.left || 0,
                        top: opts.top || 0,
                        width: opts.width || 0,
                        height: opts.height || 0,
                        angle: opts.angle || 0,
                        offset: { left: 0, top: 0 },
                        pos: { left: 0, top: 0 },
                        extents: { left: 0, top: 0, right: 0, bottom: 0 },
                        getExtents: function () {
                            return this.extents;
                        },
                        calcBounds: function () {
                            // Calculate boundaries and additional parameters:
                            this.setText(this.text);
                            this.offset.left = getOffset[this.originX](this.width);
                            this.offset.top = getOffset[this.originY](this.height) + this.height;
                            this.pos.left = this.left + this.offset.left;
                            this.pos.top = this.top + this.offset.top;
                            this.extents.left = this.pos.left;
                            this.extents.right = this.pos.left;
                            this.extents.top = this.pos.top + this.width;
                            this.extents.bottom = this.pos.top + this.height;
                        },
                        render: function () {
                            // Only render if text is visible (saves time):
                            if (this.opacity > 0) {
                                canvasObj.context.save();   // Required to restore transform matrix after the following render:
                                this.font && (canvasObj.context.font = this.font);
                                canvasObj.context.fillStyle = this.fill;
                                canvasObj.context.globalAlpha = this.opacity;
                                canvasObj.context.translate(this.left, this.top);   // Set rotate center.
                                canvasObj.context.rotate(this.angle * Math.PI / 180);   // Rotate text.
                                canvasObj.context.fillText(this.text, this.offset.left, this.offset.top);   // Draw text at offset pos.
                                canvasObj.context.restore();
                            }
                        },
                        isPointIn: function (posX, posY, event) {
                            // Use the last extents (as it was last visible to user for click event):
                            return posX >= this.extents.left && posY >= this.extents.top && posX <= this.extents.right && posY <= this.extents.bottom;  // Incorrect when rotated.
                        },
                        mouseDownEvent: function (posX, posY, event) {
                            this.onmousedown && this.onmousedown.call(this, this.data.data);
                        }
                    };
                },
                arc: function (opts) {
                    return {
                        type: "obj",
                        className: "arc",
                        parent: opts.parent || canvasObj,
                        id: opts.id || opts.parent.children.length,
                        data: opts.data || {},
                        left: opts.left || 0,
                        top: opts.top || 0,
                        originX: opts.originX || "center",
                        originY: opts.originY || "center",
                        width: opts.width || 0,
                        height: opts.height || 0,
                        innerRadius: opts.innerRadius || 0,
                        radius: 0,
                        outerRadius: opts.outerRadius || 0,
                        thickness: 0,
                        startAngle: opts.startAngle || 0,
                        endAngle: opts.endAngle || 0,
                        fill: opts.fill || "#000",
                        offset: { left: 0, top: 0 },
                        extents: { left: 0, top: 0, right: 0, bottom: 0 },
                        getExtents: function () {
                            return this.extents;
                        },
                        calcBounds: function () {
                            // Calculate boundaries and additional parameters:
                            this.width = this.height = this.outerRadius * 2;
                            this.offset.left = this.left;//applyOffset[this.originX](this.left, this.width) + this.width;
                            this.offset.top = this.top;//applyOffset[this.originY](this.top, this.height) + this.height;
                            this.extents.left = this.offset.left - this.outerRadius;
                            this.extents.right = this.offset.left + this.outerRadius;
                            this.extents.top = this.offset.top - this.outerRadius;
                            this.extents.bottom = this.offset.top + this.outerRadius;
                            this.thickness = this.outerRadius - this.innerRadius;
                            this.radius = this.thickness / 2 + this.innerRadius;
                        },
                        render: function () {
                            //canvasObj.context.save();
                            canvasObj.context.beginPath();
                            canvasObj.context.strokeStyle = this.fill;
                            canvasObj.context.lineWidth = this.thickness;
                            canvasObj.context.arc(this.offset.left, this.offset.top, this.radius, this.startAngle - deg90InRad, this.endAngle - deg90InRad);
                            canvasObj.context.stroke();
                            //canvasObj.context.restore();
                        },
                        isPointIn: function (posX, posY, event) {
                            // Use the last extents (as it was last visible to user for click event):
                            /*var check;
                            canvasObj.context.beginPath();
                            //canvasObj.context.lineWidth = this.thickness;
                            canvasObj.context.arc(this.offset.left, this.offset.top, this.outerRadius, this.startAngle - deg90InRad, this.endAngle - deg90InRad);
                            check = canvasObj.context.isPointInPath(event.offsetX, event.offsetY);
                            canvasObj.context.beginPath();
                            //canvasObj.context.lineWidth = this.thickness;
                            canvasObj.context.arc(this.offset.left, this.offset.top, this.innerRadius, this.startAngle - deg90InRad, this.endAngle - deg90InRad);
                            check = check && !canvasObj.context.isPointInPath(event.offsetX, event.offsetY);
                            return check;*/
                            var distance = (posX - this.offset.left) * (posX - this.offset.left) + (posY - this.offset.top) * (posY - this.offset.top), // Distance from point to arc center.
                                angle = Math.atan2(posY - this.offset.top, posX - this.offset.left) + deg90InRad;   // Angle from +x axis to arc center to pointer.
                            if (angle < 0) {
                                angle += 2 * Math.PI;   // This is to fix the differences in d3 start/end angle and canvas's.
                                // d3 has: [0, 2 * Math.PI], which starts from and goes to (+)y-axis.
                                // canvas has: [-Math.PI, Math.PI], which starts from and goes to (-)x-axis.
                            }
                            return distance <= this.outerRadius * this.outerRadius && distance >= this.innerRadius * this.innerRadius && angle >= this.startAngle && angle <= this.endAngle;
                        },
                        mouseDownEvent: function (posX, posY, event) {
                            this.onmousedown && this.onmousedown.call(this, this.data.data);
                        }
                    };
                }
            };

        // TODO: Rework object's parents for appending enterObjects.
        function createSelector(opts) {
            var thisSelector = {
                type: "select",
                className: "select",
                isTransition: opts.transition || false,
                durationTime: opts.duration || 250,
                easeFunc: opts.ease || function (t) { return t; },
                object: opts.object || canvasObj,
                objects: opts.objects || [],
                enterObjects: opts.enterObjects || [],
                exitObjects: opts.exitObjects || [],
                select: function (objectClassName) {
                    var firstObj = [];
                    // Get first object with the class that matches objectClassName, from each object in objects:
                    thisSelector.objects.forEach(function (object) {
                        // Check to see if object has children:
                        if (object.children !== undefined && object.children.length > 0) {
                            // Look for first child with the specified class:
                            object.children.some(function (child) {
                                return child.className === objectClassName ? ((firstObj.push(child)), true) : false;
                            });
                        }
                    })
                    // Return a new selector with the first matching class in each object:
                    return createSelector({
                        transition: thisSelector.isTransition,
                        duration: thisSelector.durationTime,
                        ease: thisSelector.easeFunc,
                        object: firstObj.length > 0 ? firstObj[0].parent : (thisSelector.objects.length > 0 ? thisSelector.objects[0] : thisSelector.object), //Should rework this to accept more than one parent...
                        objects: firstObj
                    });
                },
                selectAll: function (objectClassName) {
                    var objs = [];
                    // Get all objects with class name as objectClassName:
                    thisSelector.objects.forEach(function (object) {
                        // Check to see if object has children:
                        if (object.children !== undefined && object.children.length > 0) {
                            // Loop through object's children:
                            object.children.forEach(function (child) {
                                if (child.className === objectClassName) {
                                    objs.push(child);   // Found, append to objs.
                                }
                            });
                        }
                    });
                    // Return a new selector with all objects matching objectClassName:
                    return createSelector({
                        transition: thisSelector.isTransition,
                        duration: thisSelector.durationTime,
                        ease: thisSelector.easeFunc,
                        object: objs.length > 0 ? objs[0].parent : (thisSelector.objects.length > 0 ? thisSelector.objects[0] : thisSelector.object), //Should rework this to accept more than one parent...
                        objects: objs
                    });
                },
                filter: function (filterFunc) {
                    var objs = [];
                    // Get all objects where filterFunc returns true:
                    thisSelector.objects.forEach(function (object) {
                        // Check if object should be added to new selector:
                        if (filterFunc.call(object, object.data.data)) {
                            objs.push(object);
                        }
                    });
                    // Return a new selector with all objects matching objectClassName:
                    return createSelector({
                        transition: thisSelector.isTransition,
                        duration: thisSelector.durationTime,
                        ease: thisSelector.easeFunc,
                        object: objs.length > 0 ? objs[0].parent : (thisSelector.objects.length > 0 ? thisSelector.objects[0] : thisSelector.object), //Should rework this to accept more than one parent...
                        objects: objs
                    });
                },
                data: function (nodes, keyFunc) {
                    // TODO FINISH
                    // Data is applied to those objects within the selection only!
                    // Each time this is called, it checks against the objects var.
                    //   If object with datakey exists in dataArray, it is kept in objects var.
                    //   If a data's key doesn't have an object associated with it, the data is added in enterObjects var.
                    //   If object's datakey isn't in dataArray, then the object is added to exitObjects var.
                    // If nodes is a function, each object retrieves its data from nodes(curData)!
                    // Else nodes contains the array of data for the objects.
                    // TEMP FIX:
                    thisSelector.exitObjects = [];
                    // Map nodes data to match object data.
                    nodes = nodes.map(function (node) {
                        return {
                            id: keyFunc(node),
                            data: node
                        };
                    });
                    thisSelector.objects.forEach(function (object) {
                        var firstNode, nodeIndex;
                        // Look for object in nodes:
                        if (nodes.some(function (node, index) {
                            return object.data.id === node.id ? ((firstNode = node), (nodeIndex = index), true) : false;
                        })) {
                            // Found object in nodes, update it:
                            object.data.data = firstNode.data;
                            nodes.splice(nodeIndex, 1); // Remove node from nodes.
                        } else {
                            // Can't find object in nodes, so mark for exit:
                            thisSelector.exitObjects.push(object);
                        }
                    });
                    // Nodes left are new, so mark for enter:
                    thisSelector.enterObjects = nodes;
                    return thisSelector;
                },
                enter: function () {
                    // TODO FINISH
                    // Returns enterObjects custom selector, with it's parent as this selector.
                    // The selector adds exitObjects to the objects list of this selector when it appends (only function supported with this yet).
                    var enterSelector = {
                        type: "select",
                        className: "enterSelect",
                        parentSelector: thisSelector,
                        append: function (objectClassName, opts) {
                            opts = opts || {};
                            return createSelector({
                                transition: thisSelector.isTransition,
                                duration: thisSelector.durationTime,
                                ease: thisSelector.easeFunc,
                                objects: enterSelector.parentSelector.enterObjects.map(function (object) {
                                    opts.parent = enterSelector.parentSelector.object;  // Set parent of child to object.
                                    opts.data = object;    // Pass data to child!
                                    var newObj = createObject[objectClassName](opts);   // Create child.
                                    enterSelector.parentSelector.object.children.push(newObj);  // Add child to object.
                                    return newObj;  // Add child to new selector.
                                })
                            });
                        }
                    };
                    return enterSelector;
                    // Rethink selectors in order to properly append items into the right parents!
                },
                exit: function () {
                    // TODO FINISH
                    // Returns exitObjects custom selector, with it's parent as this selector.
                    // The selector removes exitObjects from the objects list of this selector when it removes (only function supported with this yet).
                    var exitSelector = {
                        type: "select",
                        className: "exitSelect",
                        parentSelector: thisSelector,
                        remove: function () {
                            exitSelector.parentSelector.exitObjects.forEach(function (object) {
                                object.parent.children.splice(object.parent.children.indexOf(object), 1);
                                exitSelector.parentSelector.objects.splice(exitSelector.parentSelector.objects.indexOf(object), 1);
                            });
                            exitSelector.parentSelector.exitObjects = [];
                            return exitSelector.parentSelector;
                        }
                    };
                    return exitSelector;
                },
                on: function (eventName, eventFunc) {
                    // Map given name to internal property:
                    eventName = "on" + eventName;
                    // Add property to every object in selector:
                    thisSelector.objects.forEach(function (object) {
                        object[eventName] = eventFunc;
                    });
                    return thisSelector;
                },
                append: function (objectClassName, opts) {
                    opts = opts || {};  // Make sure opts exists.
                    // Return a new selector of all appended objects:
                    return createSelector({
                        transition: thisSelector.isTransition,
                        duration: thisSelector.durationTime,
                        ease: thisSelector.easeFunc,
                        objects: thisSelector.objects.map(function (object) { // For each object in selector, append a new object:
                            opts.parent = object;       // Set parent of child to object.
                            opts.data = object.data;    // Pass data to child!
                            var newObj = createObject[objectClassName](opts);   // Create child.
                            object.children.push(newObj);   // Add child to object.
                            return newObj;  // Add child to new selector.
                        })
                    });
                },
                remove: function () {
                    // Loop through all objects, and remove them from their individual parent:
                    thisSelector.objects.forEach(function (object) {
                        object.parent.children.splice(object.parent.children.indexOf(object), 1);
                    });
                    // Reset selector's objects list:
                    thisSelector.objects = [];
                    return thisSelector;
                    // TODO: Read d3 docs on what to return!
                },
                attr: function (attrName, attrVal) {
                    thisSelector.objects.forEach(function (object) {
                        var value = attrVal;
                        if (typeof (value) === "function") {
                            value = value(attrFunc.call(object, object.data.data));
                        }
                        if (object.hasOwnProperty("set" + attrName)) {
                            object["set" + attrName](value);
                        } else {
                            object[attrName] = value;
                        }
                    });
                    return thisSelector;
                },
                each: function (func) {
                    // Execute a given function for each object:
                    thisSelector.objects.forEach(function (object) { func.call(object, object.data.data); });
                    return thisSelector;
                },
                transition: function () {
                    // Mark selector as in a transition now:
                    thisSelector.isTransition = true;
                    return thisSelector;
                },
                duration: function (ms) {
                    // Set selector's duration of a transition:
                    thisSelector.durationTime = ms;
                    return thisSelector;
                },
                ease: function (type) {
                    // Set selector's ease function:
                    thisSelector.easeFunc = type;
                    return thisSelector;
                },
                tween: function (tweenName, tweenFunc) {
                    // TODO: Register tweenFunc for all objects in this selector.
                    // Setup timeout:
                    var timeStart = new Date().getTime(),
                        timeEnd = timeStart + thisSelector.durationTime,
                        i;
                    // Register object on canvas's animation array. If object already is there, then replace the current tween.
                    for (i = 0; i < thisSelector.objects.length; i += 1) {//thisSelector.objects.forEach(function (object) {
                        var object = thisSelector.objects[i];
                        // TODO: Make animation's ID based to test speed.
                        var animationIndex = canvasObj.animations.indexOf(object);
                        if (animationIndex < 0) {
                            animationIndex = canvasObj.animations.length;
                            canvasObj.animations[animationIndex] = object;
                        }
                        object.tweenFunc = tweenFunc.call(object, object.data.data);
                        object.easeFunc = thisSelector.easeFunc;
                        object.timeStart = timeStart;
                        object.timeEnd = timeEnd;
                        object.duration = thisSelector.durationTime;
                    }//});
                    if (canvasObj.requestFrameID === undefined && canvasObj.animations.length > 0) {
                        canvasObj.requestFrameID = requestAnimFrame(canvasObj.onAnimationFrame);
                    }
                    return thisSelector;
                },
                startRender: function () { },   // This function is a temp fix to render the canvas!
                pumpRender: function () {
                    // This function is a temp fix to render the canvas!
                    canvasObj.pumpRender();
                    return createSelector({
                        objects: [canvasObj]
                    });
                }
            };
            return thisSelector;
        }


        function clickHandler(event) {
            // Ignore event with no gesture:
            if (!event.gesture) {
                return;
            }
            event.gesture.preventDefault();

            // Ignore events with more than one touch.
            if (event.gesture.touches.length === 1) {
                // Calculate offset from target's top-left corner:
                var touch = event.gesture.touches[0],       // Get touch location on page.
                    display = touch.target.style.display,   // Save display property.
                    pagePos;                                // Get target position on page.
                touch.target.style.display = "";    // Make visible
                pagePos = touch.target.getBoundingClientRect(); // Get visible coords.
                touch.target.style.display = display;   // Restore display property.
                event.offsetX = touch.pageX - pagePos.left;
                event.offsetY = touch.pageY - pagePos.top;

                canvasObj.context.save();
                // Reset transform:
                canvasObj.context.setTransform(1, 0, 0, 1, 0, 0);
                // Loop through every child object on canvas:
                canvasObj.children.forEach(function (child) {
                    // Check if mouse is in child:
                    if (child.isPointIn(event.offsetX, event.offsetY)) {
                        // If so, propagate event down to child.
                        child.mouseDownEvent.call(child, event.offsetX, event.offsetY, event);
                    }
                });
                canvasObj.context.restore();
            }
        }

        var hammerObj = hammer(canvasObj.element, {
            prevent_default: true
        });

        hammerObj.on("click tap", clickHandler);

        /*var lastDownTime,
            lastDownPosX,
            lastDownPosY;
        // Mouse event for clicking an object:
        function mouseStartEvent(event) {
            // Prevent auto-zoom, and other gestures:
            event.preventDefault();

            // Get offset if doesn't exist:
            if (event["offsetX"] === undefined) {
                var pagePos = event.target.getBoundingClientRect(); // Get target position on page.
                event.offsetX = event.pageX - pagePos.left;
                event.offsetY = event.pageY - pagePos.top;
            }
            lastDownTime = new Date().getTime();
            lastDownPosX = event.offsetX;
            lastDownPosY = event.offsetY;
        }
        // Mouse event for clicking an object:
        function mouseEndEvent(event) {
            // Prevent auto-zoom, and other gestures:
            event.preventDefault();

            // Get offset if doesn't exist:
            if (event["offsetX"] === undefined) {
                var pagePos = event.target.getBoundingClientRect(); // Get target position on page.
                event.offsetX = event.pageX - pagePos.left;
                event.offsetY = event.pageY - pagePos.top;
            }
            var distance = (event.offsetX - lastDownPosX) * (event.offsetX - lastDownPosX) + (event.offsetY - lastDownPosY) * (event.offsetY - lastDownPosY);

            if (distance <= 10 && (new Date().getTime()) - lastDownTime <= 250) {
                canvasObj.context.save();
                // Reset transform:
                canvasObj.context.setTransform(1, 0, 0, 1, 0, 0);
                // Loop through every child object on canvas:
                canvasObj.children.forEach(function (child) {
                    // Check if mouse is in child:
                    if (child.isPointIn(event.offsetX, event.offsetY)) {
                        // If so, propagate event down to child.
                        child.mouseDownEvent.call(child, event.offsetX, event.offsetY, event);
                    }
                });
                canvasObj.context.restore();
            }
        }

        // Touch event for clicking an object (maps event to mouseEvent):
        function touchEvent(event) {
            // Ignore events with more than one touch.
            if (event.targetTouches.length === 1) {
                // Calculate offset from target's top-left corner:
                var touch = event.targetTouches[0],                 // Get touch location on page.
                    pagePos = event.target.getBoundingClientRect(); // Get target position on page.
                event.offsetX = touch.pageX - pagePos.left;
                event.offsetY = touch.pageY - pagePos.top;

                mouseEvent(event);
            }
        }

        // Add event listeners for down:
        canvasObj.element.addEventListener("mousedown", mouseStartEvent);    // For mouse inputs.
        //canvasObj.element.addEventListener("touchstart", touchStartEvent);   // For touch screens.
        // Add event listeners for up:
        canvasObj.element.addEventListener("mouseup", mouseEndEvent);    // For mouse inputs.
        //canvasObj.element.addEventListener("touchend", touchEvent);*/   // For touch screens.

        // Create a selector containing the canvas:
        var canvasSelector = createSelector({
            objects: [canvasObj]
        });
        canvasSelector[0] = [canvasObj.element]; // Temp Fix to access element!

        // Return the canvas selector:
        return canvasSelector;
    }
});