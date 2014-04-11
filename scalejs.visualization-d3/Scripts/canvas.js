/*global define*/
/*jslint devel: true */
/*jslint browser: true */
define(function () {
    "use strict";

    // shim layer with setTimeout fallback
    var requestAnimFrame = window.requestAnimationFrame ||
                           window.webkitRequestAnimationFrame ||
                           window.mozRequestAnimationFrame ||
                           function (callback) {
                               window.setTimeout(callback, 1000 / 60);
                           };

    return function (canvas) {
        var context = canvas.getContext("2d"),
            canvasObj = {
                type: "canvas",
                className: "canvas",
                element: canvas,
                context: context,
                parent: canvasObj,
                children: [],
                animations: [],
                requestFrameID: undefined,
                animationFrame: function () {
                    if (this.animations.length <= 0) {
                        canvasObj.requestFrameID = undefined;
                        return;
                    }
                    this.requestFrameID = requestAnimFrame(this.animationFrame);
                    var curTime = new Date().getTime();
                    this.animations = this.animations.filter(function (animation) {
                        // Call tween function for object:
                        animation.tweenFunc.call(animation.object, Math.min((curTime - animation.timeStart) / animation.duration, 1));
                        // Filter out animations which exceeded the time:
                        return curTime < animation.timeEnd;
                    });
                    this.pumpRender();
                },
                pumpRender: function () {
                    context.setTransform(1, 0, 0, 1, 0, 0);
                    context.clearRect(0, 0, canvas.width, canvas.height);
                    this.children.forEach(function (child) { child.calcBounds(); });
                    this.children.forEach(function (child) { child.render(); });
                },
                startRender: function () {},
                render: function () { this.pumpRender(); }
            },
            offsetApply = {
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
                    return pos-size;
                },
                bottom: function (pos, size) {
                    return pos-size;
                }
            },
            createObject = {
                group: function (opts) {
                    return {
                        type: "group",
                        className: "group",
                        parent: opts.parent || canvasObj,
                        id: opts.id || opts.parent.children.length,
                        data: opts.data || {},
                        originX: opts.originX || "left",
                        originY: opts.originY || "top",
                        left: opts.left || 0,
                        top: opts.top || 0,
                        width: opts.width || 0,
                        height: opts.height || 0,
                        offset: { left: 0, top: 0 },
                        children: [],
                        getExtents: function () {
                            if (this.children.length > 0) {
                                var extents = this.children[0].getExtents();
                                this.children.forEach(function (child) {
                                    var childExtents = child.getExtents();
                                    if (childExtents.left < leftMin) {
                                        extents.left = childExtents.left;
                                    }
                                    if (childExtents.top < topMin) {
                                        extents.top = childExtents.top;
                                    }
                                    if (childExtents.right > rightMax) {
                                        extents.right = childExtents.right;
                                    }
                                    if (childExtents.bottom > bottomMax) {
                                        extents.bottom = childExtents.bottom;
                                    }
                                });
                                return extents;
                            }
                            return { left: 0, top: 0, right: 0, bottom: 0 };
                        },
                        calcBounds: function () {
                            this.children.forEach(function (child) { child.calcBounds(); });
                            var extents = this.getExtents();
                            this.width = extents.right - extents.left;
                            this.height = extents.bottom - extents.top;
                            this.offset.left = offsetApply[this.originX](this.left, this.width);
                            this.offset.top = offsetApply[this.originY](this.top, this.height);
                        },
                        render: function () {
                            context.save();
                            context.translate(this.offset.left, this.offset.top);
                            this.children.forEach(function (child) { child.render(); });
                            context.restore();
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
                        getExtents: function () {
                            return {
                                left: this.offset.left,
                                top: this.offset.top,
                                right: this.offset.left + this.width,
                                bottom: this.offset.top + this.height
                            };
                        },
                        calcBounds: function () {
                            this.offset.left = offsetApply[this.originX](this.left, this.width);
                            this.offset.top = offsetApply[this.originY](this.top, this.height);
                        },
                        render: function () {
                            context.save();
                            context.fillStyle = this.fill;
                            context.fillRect(this.left, this.top, this.width, this.height);
                            context.restore();
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
                        fontFamily: opts.fontFamily || "Times New Roman",
                        fontSize: opts.fontSize || 40,
                        text: opts.text || "",
                        originX: opts.originX || "left",
                        originY: opts.originY || "top",
                        fill: opts.fill || "#000",
                        opacity: opts.opacity || 1,
                        left: opts.left || 0,
                        top: opts.top || 0,
                        width: opts.width || 0,
                        height: opts.height || 0,
                        offset: { left: 0, top: 0 },
                        getExtents: function () {
                            return {
                                left: this.offset.left,
                                top: this.offset.top,
                                right: this.offset.left + this.width,
                                bottom: this.offset.top + this.height
                            };
                        },
                        calcBounds: function () {
                            this.width = contex.measureText(this.text || "").width;
                            this.height = this.fontSize;
                            this.offset.left = offsetApply[this.originX](this.left, this.width);
                            this.offset.top = offsetApply[this.originY](this.top, this.height);
                        },
                        render: function () {
                            context.save();
                            context.font = this.fontSize + "px " + this.fontFamily;
                            context.fillStyle = this.fill;
                            context.fillText(this.text, this.offset.left, this.offset.top);
                            context.restore();
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
                object: opts.object || canvasObj,
                objects: opts.objects || [],
                enterObjects: opts.enterObjects || [],
                exitObjects: opts.exitObjects || [],
                select: function (objectClassName) {
                    var firstObj;
                    thisSelector.objects.some(function (object) {
                        return object.className === objectClassName ? ((firstObj = object), true) : false;
                    });
                    return createSelector({
                        object: firstObj ? firstObj.parent : thisSelector.object,
                        objects: [firstObj]
                    });
                },
                selectAll: function (objectClassName) {
                    var objs = thisSelector.objects.filter(function (object) {
                        return object.className === objectClassName;
                    });
                    return createSelector({
                        object: objs.length > 0 ? objs[0].parent : thisSelector.object,
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
                    /*if (typeof(nodes) === "function") {

                    }
                    nodes.forEach(function (node) {
                        keyFunc(node);
                    });*/
                    // TEMP FIX:
                    exitObjects = [];
                    nodes = nodes.map(function (node) {
                        return {
                            id: keyFunc(node),
                            data: node
                        };
                    });
                    thisSelector.objects.forEach(function (object) {
                        var firstNode, nodeIndex;
                        if (nodes.some(function (node, index) {
                            return object.id === node.id ? ((firstNode = object), (nodeIndex = index), true) : false;
                        })) {
                            // Found object in nodes, update it:
                            object.data = firstNode;
                            nodes.splice(nodeIndex, 1);
                        } else {
                            // Can't find object in nodes, so mark for exit:
                            exitObjects.push(object.id);
                        }
                    });
                    // Nodes left are new, so mark for enter:
                    enterObjects = nodes;
                    return thisSelector;
                },
                enter: function () {
                    // TODO FINISH
                    // Returns enterObjects custom selector, with it's parent as this selector.
                    // The selector adds exitObjects to the objects list of this selector when it appends (only function supported with this yet).
                    return {
                        type: "select",
                        className: "enterSelect",
                        parentSelector: thisSelector,
                        append: function (objectClassName, opts) {
                            opts = opts || {};
                            return createSelector({
                                objects: this.parentSelector.enterObjects.map(function (object) {
                                    opts.parent = this.parentSelector.object;
                                    opts.data = object.data;    // Pass data to child!
                                    var newObj = createObject[objectClassName](opts);
                                    this.parentSelector.object.children.push(newObj);
                                    return newObj;
                                })
                            });
                        }
                    };
                    // Rethink selectors in order to properly append items into the right parents!
                },
                exit: function () {
                    // TODO FINISH
                    // Returns exitObjects custom selector, with it's parent as this selector.
                    // The selector removes exitObjects from the objects list of this selector when it removes (only function supported with this yet).
                    return {
                        type: "select",
                        className: "exitSelect",
                        parentSelector: thisSelector,
                        remove: function () {
                            this.parentSelector.exitObjects.forEach(function (object) {
                                this.parentSelector.objects.splice(this.parentSelector.objects.indexOf(object), 1);
                            });
                            this.parentSelector.exitObjects = [];
                            return this.parentSelector;
                        }
                    };
                    // Rethink selectors in order to properly remove the right items!
                },
                on: function () {
                    // TODO: Add .on functionality.
                    return thisSelector;
                },
                append: function (objectClassName, opts) {
                    opts = opts || {};
                    return createSelector({
                        objects: thisSelector.objects.map(function (object) {
                            opts.parent = object;
                            opts.data = object.data;    // Pass data to child!
                            var newObj = createObject[objectClassName](opts);
                            object.children.push(newObj);
                            return newObj;
                        })
                    });
                },
                remove: function () {
                    thisSelector.objects = [];
                    return thisSelector;
                    // TODO: Read d3 docs on what to return!
                },
                attr: function (attrName, attrFunc) {
                    thisSelector.objects.forEach(function (object) {
                        object[attrName] = attrFunc(object.data);
                    });
                    return thisSelector;
                },
                each: function (func) {
                    thisSelector.objects.forEach(function (object) { func.call(object, object.data); });
                    return thisSelector;
                },
                transition: function () {
                    thisSelector.isTransition = true;
                    return thisSelector;
                },
                duration: function (ms) {
                    thisSelector.durationTime = ms;
                    return thisSelector;
                },
                tween: function (tweenName, tweenFunc) {
                    // TODO: Register tweenFunc for all objects in this selector.
                    // Setup timeout:
                    var timeStart = new Date().getTime(),
                        timeEnd = curTime + thisSelector.durationTime;
                    // Register object on canvas's animation array. If object already is there, then replace the current tween.
                    thisSelector.objects.forEach(function (object) {
                        var animationIndex = canvasObj.animations.length;
                        canvasObj.animations.some(function (animation, index) {
                            return animation.object === object ? ((animationIndex = index), true) : false;
                        });
                        canvasObj.animations[animationIndex].object = object;
                        canvasObj.animations[animationIndex].tweenFunc = tweenFunc(object.data);
                        canvasObj.animations[animationIndex].timeStart = timeStart;
                        canvasObj.animations[animationIndex].timeEnd = timeEnd;
                        canvasObj.animations[animationIndex].duration = thisSelector.durationTime;
                    });
                    if (canvasObj.requestFrameID === undefined && canvasObj.animations.length > 0) {
                        canvasObj.requestFrameID = requestAnimFrame(canvasObj.animationFrame);
                    }
                    return thisSelector;
                }
            };
            return thisSelector;
        }

        return createSelector({
            objects: [canvasObj]
        });
    }
});