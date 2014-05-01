/*! Hammer.JS - v1.0.6 - 2014-01-02
 * http://eightmedia.github.com/hammer.js
 *
 * Copyright (c) 2014 Jorik Tangelder <j.tangelder@gmail.com>;
 * Licensed under the MIT license */

(function (window, undefined) {
    

    /**
     * Hammer
     * use this to create instances
     * @param   {HTMLElement}   element
     * @param   {Object}        options
     * @returns {Hammer.Instance}
     * @constructor
     */
    var Hammer = function (element, options) {
        return new Hammer.Instance(element, options || {});
    };

    // default settings
    Hammer.defaults = {
        // add styles and attributes to the element to prevent the browser from doing
        // its native behavior. this doesnt prevent the scrolling, but cancels
        // the contextmenu, tap highlighting etc
        // set to false to disable this
        stop_browser_behavior: {
            // this also triggers onselectstart=false for IE
            userSelect: 'none',
            // this makes the element blocking in IE10 >, you could experiment with the value
            // see for more options this issue; https://github.com/EightMedia/hammer.js/issues/241
            touchAction: 'none',
            touchCallout: 'none',
            contentZooming: 'none',
            userDrag: 'none',
            tapHighlightColor: 'rgba(0,0,0,0)'
        }

        //
        // more settings are defined per gesture at gestures.js
        //
    };

    // detect touchevents
    Hammer.HAS_POINTEREVENTS = window.navigator.pointerEnabled || window.navigator.msPointerEnabled;
    Hammer.HAS_TOUCHEVENTS = ('ontouchstart' in window);

    // dont use mouseevents on mobile devices
    Hammer.MOBILE_REGEX = /mobile|tablet|ip(ad|hone|od)|android|silk/i;
    Hammer.NO_MOUSEEVENTS = Hammer.HAS_TOUCHEVENTS && window.navigator.userAgent.match(Hammer.MOBILE_REGEX);

    // eventtypes per touchevent (start, move, end)
    // are filled by Hammer.event.determineEventTypes on setup
    Hammer.EVENT_TYPES = {};

    // direction defines
    Hammer.DIRECTION_DOWN = 'down';
    Hammer.DIRECTION_LEFT = 'left';
    Hammer.DIRECTION_UP = 'up';
    Hammer.DIRECTION_RIGHT = 'right';

    // pointer type
    Hammer.POINTER_MOUSE = 'mouse';
    Hammer.POINTER_TOUCH = 'touch';
    Hammer.POINTER_PEN = 'pen';

    // touch event defines
    Hammer.EVENT_START = 'start';
    Hammer.EVENT_MOVE = 'move';
    Hammer.EVENT_END = 'end';

    // hammer document where the base events are added at
    Hammer.DOCUMENT = window.document;

    // plugins and gestures namespaces
    Hammer.plugins = Hammer.plugins || {};
    Hammer.gestures = Hammer.gestures || {};

    // if the window events are set...
    Hammer.READY = false;

    /**
     * setup events to detect gestures on the document
     */
    function setup() {
        if (Hammer.READY) {
            return;
        }

        // find what eventtypes we add listeners to
        Hammer.event.determineEventTypes();

        // Register all gestures inside Hammer.gestures
        Hammer.utils.each(Hammer.gestures, function (gesture) {
            Hammer.detection.register(gesture);
        });

        // Add touch events on the document
        Hammer.event.onTouch(Hammer.DOCUMENT, Hammer.EVENT_MOVE, Hammer.detection.detect);
        Hammer.event.onTouch(Hammer.DOCUMENT, Hammer.EVENT_END, Hammer.detection.detect);

        // Hammer is ready...!
        Hammer.READY = true;
    }

    Hammer.utils = {
        /**
         * extend method,
         * also used for cloning when dest is an empty object
         * @param   {Object}    dest
         * @param   {Object}    src
         * @parm  {Boolean}  merge    do a merge
         * @returns {Object}    dest
         */
        extend: function extend(dest, src, merge) {
            for (var key in src) {
                if (dest[key] !== undefined && merge) {
                    continue;
                }
                dest[key] = src[key];
            }
            return dest;
        },


        /**
         * for each
         * @param obj
         * @param iterator
         */
        each: function (obj, iterator, context) {
            var i, length;
            // native forEach on arrays
            if ('forEach' in obj) {
                obj.forEach(iterator, context);
            }
                // arrays
            else if (obj.length !== undefined) {
                for (i = 0, length = obj.length; i < length; i++) {
                    if (iterator.call(context, obj[i], i, obj) === false) {
                        return;
                    }
                }
            }
                // objects
            else {
                for (i in obj) {
                    if (obj.hasOwnProperty(i) && iterator.call(context, obj[i], i, obj) === false) {
                        return;
                    }
                }
            }
        },

        /**
         * find if a node is in the given parent
         * used for event delegation tricks
         * @param   {HTMLElement}   node
         * @param   {HTMLElement}   parent
         * @returns {boolean}       has_parent
         */
        hasParent: function (node, parent) {
            while (node) {
                if (node == parent) {
                    return true;
                }
                node = node.parentNode;
            }
            return false;
        },


        /**
         * get the center of all the touches
         * @param   {Array}     touches
         * @returns {Object}    center
         */
        getCenter: function getCenter(touches) {
            var valuesX = [], valuesY = [];

            Hammer.utils.each(touches, function (touch) {
                // I prefer clientX because it ignore the scrolling position
                valuesX.push(typeof touch.clientX !== 'undefined' ? touch.clientX : touch.pageX);
                valuesY.push(typeof touch.clientY !== 'undefined' ? touch.clientY : touch.pageY);
            });

            return {
                pageX: ((Math.min.apply(Math, valuesX) + Math.max.apply(Math, valuesX)) / 2),
                pageY: ((Math.min.apply(Math, valuesY) + Math.max.apply(Math, valuesY)) / 2)
            };
        },


        /**
         * calculate the velocity between two points
         * @param   {Number}    delta_time
         * @param   {Number}    delta_x
         * @param   {Number}    delta_y
         * @returns {Object}    velocity
         */
        getVelocity: function getVelocity(delta_time, delta_x, delta_y) {
            return {
                x: Math.abs(delta_x / delta_time) || 0,
                y: Math.abs(delta_y / delta_time) || 0
            };
        },


        /**
         * calculate the angle between two coordinates
         * @param   {Touch}     touch1
         * @param   {Touch}     touch2
         * @returns {Number}    angle
         */
        getAngle: function getAngle(touch1, touch2) {
            var y = touch2.pageY - touch1.pageY,
              x = touch2.pageX - touch1.pageX;
            return Math.atan2(y, x) * 180 / Math.PI;
        },


        /**
         * angle to direction define
         * @param   {Touch}     touch1
         * @param   {Touch}     touch2
         * @returns {String}    direction constant, like Hammer.DIRECTION_LEFT
         */
        getDirection: function getDirection(touch1, touch2) {
            var x = Math.abs(touch1.pageX - touch2.pageX),
              y = Math.abs(touch1.pageY - touch2.pageY);

            if (x >= y) {
                return touch1.pageX - touch2.pageX > 0 ? Hammer.DIRECTION_LEFT : Hammer.DIRECTION_RIGHT;
            }
            else {
                return touch1.pageY - touch2.pageY > 0 ? Hammer.DIRECTION_UP : Hammer.DIRECTION_DOWN;
            }
        },


        /**
         * calculate the distance between two touches
         * @param   {Touch}     touch1
         * @param   {Touch}     touch2
         * @returns {Number}    distance
         */
        getDistance: function getDistance(touch1, touch2) {
            var x = touch2.pageX - touch1.pageX,
              y = touch2.pageY - touch1.pageY;
            return Math.sqrt((x * x) + (y * y));
        },


        /**
         * calculate the scale factor between two touchLists (fingers)
         * no scale is 1, and goes down to 0 when pinched together, and bigger when pinched out
         * @param   {Array}     start
         * @param   {Array}     end
         * @returns {Number}    scale
         */
        getScale: function getScale(start, end) {
            // need two fingers...
            if (start.length >= 2 && end.length >= 2) {
                return this.getDistance(end[0], end[1]) /
                  this.getDistance(start[0], start[1]);
            }
            return 1;
        },


        /**
         * calculate the rotation degrees between two touchLists (fingers)
         * @param   {Array}     start
         * @param   {Array}     end
         * @returns {Number}    rotation
         */
        getRotation: function getRotation(start, end) {
            // need two fingers
            if (start.length >= 2 && end.length >= 2) {
                return this.getAngle(end[1], end[0]) -
                  this.getAngle(start[1], start[0]);
            }
            return 0;
        },


        /**
         * boolean if the direction is vertical
         * @param    {String}    direction
         * @returns  {Boolean}   is_vertical
         */
        isVertical: function isVertical(direction) {
            return (direction == Hammer.DIRECTION_UP || direction == Hammer.DIRECTION_DOWN);
        },


        /**
         * stop browser default behavior with css props
         * @param   {HtmlElement}   element
         * @param   {Object}        css_props
         */
        stopDefaultBrowserBehavior: function stopDefaultBrowserBehavior(element, css_props) {
            if (!css_props || !element || !element.style) {
                return;
            }

            // with css properties for modern browsers
            Hammer.utils.each(['webkit', 'khtml', 'moz', 'Moz', 'ms', 'o', ''], function (vendor) {
                Hammer.utils.each(css_props, function (prop) {
                    // vender prefix at the property
                    if (vendor) {
                        prop = vendor + prop.substring(0, 1).toUpperCase() + prop.substring(1);
                    }
                    // set the style
                    if (prop in element.style) {
                        element.style[prop] = prop;
                    }
                });
            });

            // also the disable onselectstart
            if (css_props.userSelect == 'none') {
                element.onselectstart = function () {
                    return false;
                };
            }

            // and disable ondragstart
            if (css_props.userDrag == 'none') {
                element.ondragstart = function () {
                    return false;
                };
            }
        }
    };


    /**
     * create new hammer instance
     * all methods should return the instance itself, so it is chainable.
     * @param   {HTMLElement}       element
     * @param   {Object}            [options={}]
     * @returns {Hammer.Instance}
     * @constructor
     */
    Hammer.Instance = function (element, options) {
        var self = this;

        // setup HammerJS window events and register all gestures
        // this also sets up the default options
        setup();

        this.element = element;

        // start/stop detection option
        this.enabled = true;

        // merge options
        this.options = Hammer.utils.extend(
          Hammer.utils.extend({}, Hammer.defaults),
          options || {});

        // add some css to the element to prevent the browser from doing its native behavoir
        if (this.options.stop_browser_behavior) {
            Hammer.utils.stopDefaultBrowserBehavior(this.element, this.options.stop_browser_behavior);
        }

        // start detection on touchstart
        Hammer.event.onTouch(element, Hammer.EVENT_START, function (ev) {
            if (self.enabled) {
                Hammer.detection.startDetect(self, ev);
            }
        });

        // return instance
        return this;
    };


    Hammer.Instance.prototype = {
        /**
         * bind events to the instance
         * @param   {String}      gesture
         * @param   {Function}    handler
         * @returns {Hammer.Instance}
         */
        on: function onEvent(gesture, handler) {
            var gestures = gesture.split(' ');
            Hammer.utils.each(gestures, function (gesture) {
                this.element.addEventListener(gesture, handler, false);
            }, this);
            return this;
        },


        /**
         * unbind events to the instance
         * @param   {String}      gesture
         * @param   {Function}    handler
         * @returns {Hammer.Instance}
         */
        off: function offEvent(gesture, handler) {
            var gestures = gesture.split(' ');
            Hammer.utils.each(gestures, function (gesture) {
                this.element.removeEventListener(gesture, handler, false);
            }, this);
            return this;
        },


        /**
         * trigger gesture event
         * @param   {String}      gesture
         * @param   {Object}      [eventData]
         * @returns {Hammer.Instance}
         */
        trigger: function triggerEvent(gesture, eventData) {
            // optional
            if (!eventData) {
                eventData = {};
            }

            // create DOM event
            var event = Hammer.DOCUMENT.createEvent('Event');
            event.initEvent(gesture, true, true);
            event.gesture = eventData;

            // trigger on the target if it is in the instance element,
            // this is for event delegation tricks
            var element = this.element;
            if (Hammer.utils.hasParent(eventData.target, element)) {
                element = eventData.target;
            }

            element.dispatchEvent(event);
            return this;
        },


        /**
         * enable of disable hammer.js detection
         * @param   {Boolean}   state
         * @returns {Hammer.Instance}
         */
        enable: function enable(state) {
            this.enabled = state;
            return this;
        }
    };


    /**
     * this holds the last move event,
     * used to fix empty touchend issue
     * see the onTouch event for an explanation
     * @type {Object}
     */
    var last_move_event = null;


    /**
     * when the mouse is hold down, this is true
     * @type {Boolean}
     */
    var enable_detect = false;


    /**
     * when touch events have been fired, this is true
     * @type {Boolean}
     */
    var touch_triggered = false;


    Hammer.event = {
        /**
         * simple addEventListener
         * @param   {HTMLElement}   element
         * @param   {String}        type
         * @param   {Function}      handler
         */
        bindDom: function (element, type, handler) {
            var types = type.split(' ');
            Hammer.utils.each(types, function (type) {
                element.addEventListener(type, handler, false);
            });
        },


        /**
         * touch events with mouse fallback
         * @param   {HTMLElement}   element
         * @param   {String}        eventType        like Hammer.EVENT_MOVE
         * @param   {Function}      handler
         */
        onTouch: function onTouch(element, eventType, handler) {
            var self = this;

            this.bindDom(element, Hammer.EVENT_TYPES[eventType], function bindDomOnTouch(ev) {
                var sourceEventType = ev.type.toLowerCase();

                // onmouseup, but when touchend has been fired we do nothing.
                // this is for touchdevices which also fire a mouseup on touchend
                if (sourceEventType.match(/mouse/) && touch_triggered) {
                    return;
                }

                    // mousebutton must be down or a touch event
                else if (sourceEventType.match(/touch/) ||   // touch events are always on screen
                  sourceEventType.match(/pointerdown/) || // pointerevents touch
                  (sourceEventType.match(/mouse/) && ev.which === 1)   // mouse is pressed
                  ) {
                    enable_detect = true;
                }

                    // mouse isn't pressed
                else if (sourceEventType.match(/mouse/) && !ev.which) {
                    enable_detect = false;
                }


                // we are in a touch event, set the touch triggered bool to true,
                // this for the conflicts that may occur on ios and android
                if (sourceEventType.match(/touch|pointer/)) {
                    touch_triggered = true;
                }

                // count the total touches on the screen
                var count_touches = 0;

                // when touch has been triggered in this detection session
                // and we are now handling a mouse event, we stop that to prevent conflicts
                if (enable_detect) {
                    // update pointerevent
                    if (Hammer.HAS_POINTEREVENTS && eventType != Hammer.EVENT_END) {
                        count_touches = Hammer.PointerEvent.updatePointer(eventType, ev);
                    }
                        // touch
                    else if (sourceEventType.match(/touch/)) {
                        count_touches = ev.touches.length;
                    }
                        // mouse
                    else if (!touch_triggered) {
                        count_touches = sourceEventType.match(/up/) ? 0 : 1;
                    }

                    // if we are in a end event, but when we remove one touch and
                    // we still have enough, set eventType to move
                    if (count_touches > 0 && eventType == Hammer.EVENT_END) {
                        eventType = Hammer.EVENT_MOVE;
                    }
                        // no touches, force the end event
                    else if (!count_touches) {
                        eventType = Hammer.EVENT_END;
                    }

                    // store the last move event
                    if (count_touches || last_move_event === null) {
                        last_move_event = ev;
                    }

                    // trigger the handler
                    handler.call(Hammer.detection, self.collectEventData(element, eventType, self.getTouchList(last_move_event, eventType), ev));

                    // remove pointerevent from list
                    if (Hammer.HAS_POINTEREVENTS && eventType == Hammer.EVENT_END) {
                        count_touches = Hammer.PointerEvent.updatePointer(eventType, ev);
                    }
                }

                // on the end we reset everything
                if (!count_touches) {
                    last_move_event = null;
                    enable_detect = false;
                    touch_triggered = false;
                    Hammer.PointerEvent.reset();
                }
            });
        },


        /**
         * we have different events for each device/browser
         * determine what we need and set them in the Hammer.EVENT_TYPES constant
         */
        determineEventTypes: function determineEventTypes() {
            // determine the eventtype we want to set
            var types;

            // pointerEvents magic
            if (Hammer.HAS_POINTEREVENTS) {
                types = Hammer.PointerEvent.getEvents();
            }
                // on Android, iOS, blackberry, windows mobile we dont want any mouseevents
            else if (Hammer.NO_MOUSEEVENTS) {
                types = [
                  'touchstart',
                  'touchmove',
                  'touchend touchcancel'];
            }
                // for non pointer events browsers and mixed browsers,
                // like chrome on windows8 touch laptop
            else {
                types = [
                  'touchstart mousedown',
                  'touchmove mousemove',
                  'touchend touchcancel mouseup'];
            }

            Hammer.EVENT_TYPES[Hammer.EVENT_START] = types[0];
            Hammer.EVENT_TYPES[Hammer.EVENT_MOVE] = types[1];
            Hammer.EVENT_TYPES[Hammer.EVENT_END] = types[2];
        },


        /**
         * create touchlist depending on the event
         * @param   {Object}    ev
         * @param   {String}    eventType   used by the fakemultitouch plugin
         */
        getTouchList: function getTouchList(ev/*, eventType*/) {
            // get the fake pointerEvent touchlist
            if (Hammer.HAS_POINTEREVENTS) {
                return Hammer.PointerEvent.getTouchList();
            }
                // get the touchlist
            else if (ev.touches) {
                return ev.touches;
            }
                // make fake touchlist from mouse position
            else {
                ev.identifier = 1;
                return [ev];
            }
        },


        /**
         * collect event data for Hammer js
         * @param   {HTMLElement}   element
         * @param   {String}        eventType        like Hammer.EVENT_MOVE
         * @param   {Object}        eventData
         */
        collectEventData: function collectEventData(element, eventType, touches, ev) {
            // find out pointerType
            var pointerType = Hammer.POINTER_TOUCH;
            if (ev.type.match(/mouse/) || Hammer.PointerEvent.matchType(Hammer.POINTER_MOUSE, ev)) {
                pointerType = Hammer.POINTER_MOUSE;
            }

            return {
                center: Hammer.utils.getCenter(touches),
                timeStamp: new Date().getTime(),
                target: ev.target,
                touches: touches,
                eventType: eventType,
                pointerType: pointerType,
                srcEvent: ev,

                /**
                 * prevent the browser default actions
                 * mostly used to disable scrolling of the browser
                 */
                preventDefault: function () {
                    if (this.srcEvent.preventManipulation) {
                        this.srcEvent.preventManipulation();
                    }

                    if (this.srcEvent.preventDefault) {
                        this.srcEvent.preventDefault();
                    }
                },

                /**
                 * stop bubbling the event up to its parents
                 */
                stopPropagation: function () {
                    this.srcEvent.stopPropagation();
                },

                /**
                 * immediately stop gesture detection
                 * might be useful after a swipe was detected
                 * @return {*}
                 */
                stopDetect: function () {
                    return Hammer.detection.stopDetect();
                }
            };
        }
    };

    Hammer.PointerEvent = {
        /**
         * holds all pointers
         * @type {Object}
         */
        pointers: {},

        /**
         * get a list of pointers
         * @returns {Array}     touchlist
         */
        getTouchList: function () {
            var self = this;
            var touchlist = [];

            // we can use forEach since pointerEvents only is in IE10
            Hammer.utils.each(self.pointers, function (pointer) {
                touchlist.push(pointer);
            });

            return touchlist;
        },

        /**
         * update the position of a pointer
         * @param   {String}   type             Hammer.EVENT_END
         * @param   {Object}   pointerEvent
         */
        updatePointer: function (type, pointerEvent) {
            if (type == Hammer.EVENT_END) {
                this.pointers = {};
            }
            else {
                pointerEvent.identifier = pointerEvent.pointerId;
                this.pointers[pointerEvent.pointerId] = pointerEvent;
            }

            return Object.keys(this.pointers).length;
        },

        /**
         * check if ev matches pointertype
         * @param   {String}        pointerType     Hammer.POINTER_MOUSE
         * @param   {PointerEvent}  ev
         */
        matchType: function (pointerType, ev) {
            if (!ev.pointerType) {
                return false;
            }

            var pt = ev.pointerType,
              types = {};
            types[Hammer.POINTER_MOUSE] = (pt === ev.MSPOINTER_TYPE_MOUSE || pt === Hammer.POINTER_MOUSE);
            types[Hammer.POINTER_TOUCH] = (pt === ev.MSPOINTER_TYPE_TOUCH || pt === Hammer.POINTER_TOUCH);
            types[Hammer.POINTER_PEN] = (pt === ev.MSPOINTER_TYPE_PEN || pt === Hammer.POINTER_PEN);
            return types[pointerType];
        },


        /**
         * get events
         */
        getEvents: function () {
            return [
              'pointerdown MSPointerDown',
              'pointermove MSPointerMove',
              'pointerup pointercancel MSPointerUp MSPointerCancel'
            ];
        },

        /**
         * reset the list
         */
        reset: function () {
            this.pointers = {};
        }
    };


    Hammer.detection = {
        // contains all registred Hammer.gestures in the correct order
        gestures: [],

        // data of the current Hammer.gesture detection session
        current: null,

        // the previous Hammer.gesture session data
        // is a full clone of the previous gesture.current object
        previous: null,

        // when this becomes true, no gestures are fired
        stopped: false,


        /**
         * start Hammer.gesture detection
         * @param   {Hammer.Instance}   inst
         * @param   {Object}            eventData
         */
        startDetect: function startDetect(inst, eventData) {
            // already busy with a Hammer.gesture detection on an element
            if (this.current) {
                return;
            }

            this.stopped = false;

            this.current = {
                inst: inst, // reference to HammerInstance we're working for
                startEvent: Hammer.utils.extend({}, eventData), // start eventData for distances, timing etc
                lastEvent: false, // last eventData
                name: '' // current gesture we're in/detected, can be 'tap', 'hold' etc
            };

            this.detect(eventData);
        },


        /**
         * Hammer.gesture detection
         * @param   {Object}    eventData
         */
        detect: function detect(eventData) {
            if (!this.current || this.stopped) {
                return;
            }

            // extend event data with calculations about scale, distance etc
            eventData = this.extendEventData(eventData);

            // instance options
            var inst_options = this.current.inst.options;

            // call Hammer.gesture handlers
            Hammer.utils.each(this.gestures, function (gesture) {
                // only when the instance options have enabled this gesture
                if (!this.stopped && inst_options[gesture.name] !== false) {
                    // if a handler returns false, we stop with the detection
                    if (gesture.handler.call(gesture, eventData, this.current.inst) === false) {
                        this.stopDetect();
                        return false;
                    }
                }
            }, this);

            // store as previous event event
            if (this.current) {
                this.current.lastEvent = eventData;
            }

            // endevent, but not the last touch, so dont stop
            if (eventData.eventType == Hammer.EVENT_END && !eventData.touches.length - 1) {
                this.stopDetect();
            }

            return eventData;
        },


        /**
         * clear the Hammer.gesture vars
         * this is called on endDetect, but can also be used when a final Hammer.gesture has been detected
         * to stop other Hammer.gestures from being fired
         */
        stopDetect: function stopDetect() {
            // clone current data to the store as the previous gesture
            // used for the double tap gesture, since this is an other gesture detect session
            this.previous = Hammer.utils.extend({}, this.current);

            // reset the current
            this.current = null;

            // stopped!
            this.stopped = true;
        },


        /**
         * extend eventData for Hammer.gestures
         * @param   {Object}   ev
         * @returns {Object}   ev
         */
        extendEventData: function extendEventData(ev) {
            var startEv = this.current.startEvent;

            // if the touches change, set the new touches over the startEvent touches
            // this because touchevents don't have all the touches on touchstart, or the
            // user must place his fingers at the EXACT same time on the screen, which is not realistic
            // but, sometimes it happens that both fingers are touching at the EXACT same time
            if (startEv && (ev.touches.length != startEv.touches.length || ev.touches === startEv.touches)) {
                // extend 1 level deep to get the touchlist with the touch objects
                startEv.touches = [];
                Hammer.utils.each(ev.touches, function (touch) {
                    startEv.touches.push(Hammer.utils.extend({}, touch));
                });
            }

            var delta_time = ev.timeStamp - startEv.timeStamp
              , delta_x = ev.center.pageX - startEv.center.pageX
              , delta_y = ev.center.pageY - startEv.center.pageY
              , velocity = Hammer.utils.getVelocity(delta_time, delta_x, delta_y)
              , interimAngle
              , interimDirection;

            // end events (e.g. dragend) don't have useful values for interimDirection & interimAngle
            // because the previous event has exactly the same coordinates
            // so for end events, take the previous values of interimDirection & interimAngle
            // instead of recalculating them and getting a spurious '0'
            if (ev.eventType === 'end') {
                interimAngle = this.current.lastEvent && this.current.lastEvent.interimAngle;
                interimDirection = this.current.lastEvent && this.current.lastEvent.interimDirection;
            }
            else {
                interimAngle = this.current.lastEvent && Hammer.utils.getAngle(this.current.lastEvent.center, ev.center);
                interimDirection = this.current.lastEvent && Hammer.utils.getDirection(this.current.lastEvent.center, ev.center);
            }

            Hammer.utils.extend(ev, {
                deltaTime: delta_time,

                deltaX: delta_x,
                deltaY: delta_y,

                velocityX: velocity.x,
                velocityY: velocity.y,

                distance: Hammer.utils.getDistance(startEv.center, ev.center),

                angle: Hammer.utils.getAngle(startEv.center, ev.center),
                interimAngle: interimAngle,

                direction: Hammer.utils.getDirection(startEv.center, ev.center),
                interimDirection: interimDirection,

                scale: Hammer.utils.getScale(startEv.touches, ev.touches),
                rotation: Hammer.utils.getRotation(startEv.touches, ev.touches),

                startEvent: startEv
            });

            return ev;
        },


        /**
         * register new gesture
         * @param   {Object}    gesture object, see gestures.js for documentation
         * @returns {Array}     gestures
         */
        register: function register(gesture) {
            // add an enable gesture options if there is no given
            var options = gesture.defaults || {};
            if (options[gesture.name] === undefined) {
                options[gesture.name] = true;
            }

            // extend Hammer default options with the Hammer.gesture options
            Hammer.utils.extend(Hammer.defaults, options, true);

            // set its index
            gesture.index = gesture.index || 1000;

            // add Hammer.gesture to the list
            this.gestures.push(gesture);

            // sort the list by index
            this.gestures.sort(function (a, b) {
                if (a.index < b.index) { return -1; }
                if (a.index > b.index) { return 1; }
                return 0;
            });

            return this.gestures;
        }
    };


    /**
     * Drag
     * Move with x fingers (default 1) around on the page. Blocking the scrolling when
     * moving left and right is a good practice. When all the drag events are blocking
     * you disable scrolling on that area.
     * @events  drag, drapleft, dragright, dragup, dragdown
     */
    Hammer.gestures.Drag = {
        name: 'drag',
        index: 50,
        defaults: {
            drag_min_distance: 10,

            // Set correct_for_drag_min_distance to true to make the starting point of the drag
            // be calculated from where the drag was triggered, not from where the touch started.
            // Useful to avoid a jerk-starting drag, which can make fine-adjustments
            // through dragging difficult, and be visually unappealing.
            correct_for_drag_min_distance: true,

            // set 0 for unlimited, but this can conflict with transform
            drag_max_touches: 1,

            // prevent default browser behavior when dragging occurs
            // be careful with it, it makes the element a blocking element
            // when you are using the drag gesture, it is a good practice to set this true
            drag_block_horizontal: false,
            drag_block_vertical: false,

            // drag_lock_to_axis keeps the drag gesture on the axis that it started on,
            // It disallows vertical directions if the initial direction was horizontal, and vice versa.
            drag_lock_to_axis: false,

            // drag lock only kicks in when distance > drag_lock_min_distance
            // This way, locking occurs only when the distance has become large enough to reliably determine the direction
            drag_lock_min_distance: 25
        },

        triggered: false,
        handler: function dragGesture(ev, inst) {
            // current gesture isnt drag, but dragged is true
            // this means an other gesture is busy. now call dragend
            if (Hammer.detection.current.name != this.name && this.triggered) {
                inst.trigger(this.name + 'end', ev);
                this.triggered = false;
                return;
            }

            // max touches
            if (inst.options.drag_max_touches > 0 &&
              ev.touches.length > inst.options.drag_max_touches) {
                return;
            }

            switch (ev.eventType) {
                case Hammer.EVENT_START:
                    this.triggered = false;
                    break;

                case Hammer.EVENT_MOVE:
                    // when the distance we moved is too small we skip this gesture
                    // or we can be already in dragging
                    if (ev.distance < inst.options.drag_min_distance &&
                      Hammer.detection.current.name != this.name) {
                        return;
                    }

                    // we are dragging!
                    if (Hammer.detection.current.name != this.name) {
                        Hammer.detection.current.name = this.name;
                        if (inst.options.correct_for_drag_min_distance && ev.distance > 0) {
                            // When a drag is triggered, set the event center to drag_min_distance pixels from the original event center.
                            // Without this correction, the dragged distance would jumpstart at drag_min_distance pixels instead of at 0.
                            // It might be useful to save the original start point somewhere
                            var factor = Math.abs(inst.options.drag_min_distance / ev.distance);
                            Hammer.detection.current.startEvent.center.pageX += ev.deltaX * factor;
                            Hammer.detection.current.startEvent.center.pageY += ev.deltaY * factor;

                            // recalculate event data using new start point
                            ev = Hammer.detection.extendEventData(ev);
                        }
                    }

                    // lock drag to axis?
                    if (Hammer.detection.current.lastEvent.drag_locked_to_axis || (inst.options.drag_lock_to_axis && inst.options.drag_lock_min_distance <= ev.distance)) {
                        ev.drag_locked_to_axis = true;
                    }
                    var last_direction = Hammer.detection.current.lastEvent.direction;
                    if (ev.drag_locked_to_axis && last_direction !== ev.direction) {
                        // keep direction on the axis that the drag gesture started on
                        if (Hammer.utils.isVertical(last_direction)) {
                            ev.direction = (ev.deltaY < 0) ? Hammer.DIRECTION_UP : Hammer.DIRECTION_DOWN;
                        }
                        else {
                            ev.direction = (ev.deltaX < 0) ? Hammer.DIRECTION_LEFT : Hammer.DIRECTION_RIGHT;
                        }
                    }

                    // first time, trigger dragstart event
                    if (!this.triggered) {
                        inst.trigger(this.name + 'start', ev);
                        this.triggered = true;
                    }

                    // trigger normal event
                    inst.trigger(this.name, ev);

                    // direction event, like dragdown
                    inst.trigger(this.name + ev.direction, ev);

                    // block the browser events
                    if ((inst.options.drag_block_vertical && Hammer.utils.isVertical(ev.direction)) ||
                      (inst.options.drag_block_horizontal && !Hammer.utils.isVertical(ev.direction))) {
                        ev.preventDefault();
                    }
                    break;

                case Hammer.EVENT_END:
                    // trigger dragend
                    if (this.triggered) {
                        inst.trigger(this.name + 'end', ev);
                    }

                    this.triggered = false;
                    break;
            }
        }
    };

    /**
     * Hold
     * Touch stays at the same place for x time
     * @events  hold
     */
    Hammer.gestures.Hold = {
        name: 'hold',
        index: 10,
        defaults: {
            hold_timeout: 500,
            hold_threshold: 1
        },
        timer: null,
        handler: function holdGesture(ev, inst) {
            switch (ev.eventType) {
                case Hammer.EVENT_START:
                    // clear any running timers
                    clearTimeout(this.timer);

                    // set the gesture so we can check in the timeout if it still is
                    Hammer.detection.current.name = this.name;

                    // set timer and if after the timeout it still is hold,
                    // we trigger the hold event
                    this.timer = setTimeout(function () {
                        if (Hammer.detection.current.name == 'hold') {
                            inst.trigger('hold', ev);
                        }
                    }, inst.options.hold_timeout);
                    break;

                    // when you move or end we clear the timer
                case Hammer.EVENT_MOVE:
                    if (ev.distance > inst.options.hold_threshold) {
                        clearTimeout(this.timer);
                    }
                    break;

                case Hammer.EVENT_END:
                    clearTimeout(this.timer);
                    break;
            }
        }
    };

    /**
     * Release
     * Called as last, tells the user has released the screen
     * @events  release
     */
    Hammer.gestures.Release = {
        name: 'release',
        index: Infinity,
        handler: function releaseGesture(ev, inst) {
            if (ev.eventType == Hammer.EVENT_END) {
                inst.trigger(this.name, ev);
            }
        }
    };

    /**
     * Swipe
     * triggers swipe events when the end velocity is above the threshold
     * @events  swipe, swipeleft, swiperight, swipeup, swipedown
     */
    Hammer.gestures.Swipe = {
        name: 'swipe',
        index: 40,
        defaults: {
            // set 0 for unlimited, but this can conflict with transform
            swipe_min_touches: 1,
            swipe_max_touches: 1,
            swipe_velocity: 0.7
        },
        handler: function swipeGesture(ev, inst) {
            if (ev.eventType == Hammer.EVENT_END) {
                // max touches
                if (inst.options.swipe_max_touches > 0 &&
                  ev.touches.length < inst.options.swipe_min_touches &&
                  ev.touches.length > inst.options.swipe_max_touches) {
                    return;
                }

                // when the distance we moved is too small we skip this gesture
                // or we can be already in dragging
                if (ev.velocityX > inst.options.swipe_velocity ||
                  ev.velocityY > inst.options.swipe_velocity) {
                    // trigger swipe events
                    inst.trigger(this.name, ev);
                    inst.trigger(this.name + ev.direction, ev);
                }
            }
        }
    };

    /**
     * Tap/DoubleTap
     * Quick touch at a place or double at the same place
     * @events  tap, doubletap
     */
    Hammer.gestures.Tap = {
        name: 'tap',
        index: 100,
        defaults: {
            tap_max_touchtime: 250,
            tap_max_distance: 10,
            tap_always: true,
            doubletap_distance: 20,
            doubletap_interval: 300
        },
        handler: function tapGesture(ev, inst) {
            if (ev.eventType == Hammer.EVENT_END && ev.srcEvent.type != 'touchcancel') {
                // previous gesture, for the double tap since these are two different gesture detections
                var prev = Hammer.detection.previous,
                  did_doubletap = false;

                // when the touchtime is higher then the max touch time
                // or when the moving distance is too much
                if (ev.deltaTime > inst.options.tap_max_touchtime ||
                  ev.distance > inst.options.tap_max_distance) {
                    return;
                }

                // check if double tap
                if (prev && prev.name == 'tap' &&
                  (ev.timeStamp - prev.lastEvent.timeStamp) < inst.options.doubletap_interval &&
                  ev.distance < inst.options.doubletap_distance) {
                    inst.trigger('doubletap', ev);
                    did_doubletap = true;
                }

                // do a single tap
                if (!did_doubletap || inst.options.tap_always) {
                    Hammer.detection.current.name = 'tap';
                    inst.trigger(Hammer.detection.current.name, ev);
                }
            }
        }
    };

    /**
     * Touch
     * Called as first, tells the user has touched the screen
     * @events  touch
     */
    Hammer.gestures.Touch = {
        name: 'touch',
        index: -Infinity,
        defaults: {
            // call preventDefault at touchstart, and makes the element blocking by
            // disabling the scrolling of the page, but it improves gestures like
            // transforming and dragging.
            // be careful with using this, it can be very annoying for users to be stuck
            // on the page
            prevent_default: false,

            // disable mouse events, so only touch (or pen!) input triggers events
            prevent_mouseevents: false
        },
        handler: function touchGesture(ev, inst) {
            if (inst.options.prevent_mouseevents && ev.pointerType == Hammer.POINTER_MOUSE) {
                ev.stopDetect();
                return;
            }

            if (inst.options.prevent_default) {
                ev.preventDefault();
            }

            if (ev.eventType == Hammer.EVENT_START) {
                inst.trigger(this.name, ev);
            }
        }
    };

    /**
     * Transform
     * User want to scale or rotate with 2 fingers
     * @events  transform, pinch, pinchin, pinchout, rotate
     */
    Hammer.gestures.Transform = {
        name: 'transform',
        index: 45,
        defaults: {
            // factor, no scale is 1, zoomin is to 0 and zoomout until higher then 1
            transform_min_scale: 0.01,
            // rotation in degrees
            transform_min_rotation: 1,
            // prevent default browser behavior when two touches are on the screen
            // but it makes the element a blocking element
            // when you are using the transform gesture, it is a good practice to set this true
            transform_always_block: false
        },
        triggered: false,
        handler: function transformGesture(ev, inst) {
            // current gesture isnt drag, but dragged is true
            // this means an other gesture is busy. now call dragend
            if (Hammer.detection.current.name != this.name && this.triggered) {
                inst.trigger(this.name + 'end', ev);
                this.triggered = false;
                return;
            }

            // atleast multitouch
            if (ev.touches.length < 2) {
                return;
            }

            // prevent default when two fingers are on the screen
            if (inst.options.transform_always_block) {
                ev.preventDefault();
            }

            switch (ev.eventType) {
                case Hammer.EVENT_START:
                    this.triggered = false;
                    break;

                case Hammer.EVENT_MOVE:
                    var scale_threshold = Math.abs(1 - ev.scale);
                    var rotation_threshold = Math.abs(ev.rotation);

                    // when the distance we moved is too small we skip this gesture
                    // or we can be already in dragging
                    if (scale_threshold < inst.options.transform_min_scale &&
                      rotation_threshold < inst.options.transform_min_rotation) {
                        return;
                    }

                    // we are transforming!
                    Hammer.detection.current.name = this.name;

                    // first time, trigger dragstart event
                    if (!this.triggered) {
                        inst.trigger(this.name + 'start', ev);
                        this.triggered = true;
                    }

                    inst.trigger(this.name, ev); // basic transform event

                    // trigger rotate event
                    if (rotation_threshold > inst.options.transform_min_rotation) {
                        inst.trigger('rotate', ev);
                    }

                    // trigger pinch event
                    if (scale_threshold > inst.options.transform_min_scale) {
                        inst.trigger('pinch', ev);
                        inst.trigger('pinch' + ((ev.scale < 1) ? 'in' : 'out'), ev);
                    }
                    break;

                case Hammer.EVENT_END:
                    // trigger dragend
                    if (this.triggered) {
                        inst.trigger(this.name + 'end', ev);
                    }

                    this.triggered = false;
                    break;
            }
        }
    };


    /**
     * enable multitouch on the desktop by pressing the shiftkey
     * the other touch goes in the opposite direction so the center keeps at its place
     * it's recommended to enable Hammer.debug.showTouches for this one
     */
    Hammer.plugins.fakeMultitouch = function () {
        // keeps the start position to keep it centered
        var start_pos = false;

        // test for msMaxTouchPoints to enable this for IE10 with only one pointer (a mouse in all/most cases)
        Hammer.HAS_POINTEREVENTS = navigator.msPointerEnabled &&
          navigator.msMaxTouchPoints && navigator.msMaxTouchPoints >= 1;

        /**
         * overwrites Hammer.event.getTouchList.
         * @param   {Event}     ev
         * @param   TOUCHTYPE   type
         * @return  {Array}     Touches
         */
        Hammer.event.getTouchList = function (ev, eventType) {
            // get the fake pointerEvent touchlist
            if (Hammer.HAS_POINTEREVENTS) {
                return Hammer.PointerEvent.getTouchList();
            }
                // get the touchlist
            else if (ev.touches) {
                return ev.touches;
            }

            // reset on start of a new touch
            if (eventType == Hammer.EVENT_START) {
                start_pos = false;
            }

            // when the shift key is pressed, multitouch is possible on desktop
            // why shift? because ctrl and alt are taken by osx and linux
            if (ev.shiftKey) {
                // on touchstart we store the position of the mouse for multitouch
                if (!start_pos) {
                    start_pos = {
                        pageX: ev.pageX,
                        pageY: ev.pageY
                    };
                }

                var distance_x = start_pos.pageX - ev.pageX;
                var distance_y = start_pos.pageY - ev.pageY;

                // fake second touch in the opposite direction
                return [
                  {
                      identifier: 1,
                      pageX: start_pos.pageX - distance_x - 50,
                      pageY: start_pos.pageY - distance_y + 50,
                      target: ev.target
                  },
                  {
                      identifier: 2,
                      pageX: start_pos.pageX + distance_x + 50,
                      pageY: start_pos.pageY + distance_y - 50,
                      target: ev.target
                  }
                ];
            }
                // normal single touch
            else {
                start_pos = false;
                return [
                  {
                      identifier: 1,
                      pageX: ev.pageX,
                      pageY: ev.pageY,
                      target: ev.target
                  }
                ];
            }
        };
    };

    /**
        * ShowTouches gesture
        * show all touch on the screen by placing elements at there pageX and pageY
        * @param   {Boolean}   [force]
        */
    Hammer.plugins.showTouches = function (force) {
        // the circles under your fingers
        var template_style = 'position:absolute;z-index:9999;left:0;top:0;height:14px;width:14px;border:solid 2px #777;' +
            'background:rgba(255,255,255,.7);border-radius:20px;pointer-events:none;' +
            'margin-top:-9px;margin-left:-9px;';

        // elements by identifier
        var touch_elements = {};
        var touches_index = {};

        /**
            * remove unused touch elements
            */
        function removeUnusedElements() {
            // remove unused touch elements
            for (var key in touch_elements) {
                if (touch_elements.hasOwnProperty(key) && !touches_index[key]) {
                    document.body.removeChild(touch_elements[key]);
                    delete touch_elements[key];
                }
            }
        }

        Hammer.detection.register({
            name: 'show_touches',
            priority: 0,
            handler: function (ev, inst) {
                touches_index = {};

                // clear old elements when not using a mouse
                if (ev.pointerType != Hammer.POINTER_MOUSE && !force) {
                    removeUnusedElements();
                    return;
                }

                // place touches by index
                for (var t = 0, total_touches = ev.touches.length; t < total_touches; t++) {
                    var touch = ev.touches[t];

                    var id = touch.identifier;
                    touches_index[id] = touch;

                    // new touch element
                    if (!touch_elements[id]) {
                        // create new element and attach base styles
                        var template = document.createElement('div');
                        template.setAttribute('style', template_style);

                        // append element to body
                        document.body.appendChild(template);

                        touch_elements[id] = template;
                    }

                    // Paul Irish says that translate is faster then left/top
                    touch_elements[id].style.left = touch.pageX + 'px';
                    touch_elements[id].style.top = touch.pageY + 'px';
                }

                removeUnusedElements();
            }
        });
    };




    // Based off Lo-Dash's excellent UMD wrapper (slightly modified) - https://github.com/bestiejs/lodash/blob/master/lodash.js#L5515-L5543
    // some AMD build optimizers, like r.js, check for specific condition patterns like the following:
    if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
        // define as an anonymous module
        define('hammer',[],function () {
            return Hammer;
        });
        // check for `exports` after `define` in case a build optimizer adds an `exports` object
    }
    else if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = Hammer;
    }
    else {
        window.Hammer = Hammer;
    }
})(this);

/*global define*/
define('scalejs.canvas/utils',[],function () {
    

    var // Object that holds the offset based on size:
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
        };

    return {
        getOffset: getOffset,
        applyOffset: applyOffset
    };
});
/*global define*/
define('scalejs.canvas/group',[
    './utils'
], function (utils) {
    

    return function (canvasObj) {
        function group(opts) {
            this.type = "group";
            this.className = "group";
            this.parent = opts.parent || canvasObj;
            this.id = opts.id || opts.parent.children.length;
            this.data = opts.data || {};
            this.fontFamily = opts.fontFamily || "";
            this.fontSize = opts.fontSize || 0;
            this.originX = opts.originX || "left";
            this.originY = opts.originY || "top";
            this.left = opts.left || 0;
            this.top = opts.top || 0;
            this.width = opts.width || 0;
            this.height = opts.height || 0;
            this.angle = opts.angle || 0;
            this.scaleX = opts.scaleX || 1;
            this.scaleY = opts.scaleY || 1;
            this.backFill = opts.backFill || "";
            this.opacity = opts.opacity || 1;
            this.offset = { left: 0, top: 0 };
            this.pos = { left: 0, top: 0 };
            this.extents = { left: 0, top: 0, right: 0, bottom: 0 };
            this.children = [];
        }

        group.prototype.getExtents = function () {
            return this.extents;
        };

        group.prototype.calcBounds = function () {
            // Check if font is set on group:
            if (this.fontFamily && this.fontSize) {
                // Compile font:
                this.font = this.fontSize + "px " + this.fontFamily;

                if (this.font !== canvasObj.curFont) {
                    var pFont = canvasObj.curFont;
                    
                    canvasObj.context.font = this.font;
                    canvasObj.curFont = this.font;
                    canvasObj.curFontSize = this.fontSize;
                    // Calculate children's boundaries and parameters:
                    for (var i = 0; i < this.children.length; i += 1) {
                        this.children[i].calcBounds();
                    }
                    
                    // Restore font:
                    this.curFont = pFont;
                    canvasObj.context.restore();
                } else {
                    // Calculate children's boundaries and parameters:
                    for (var i = 0; i < this.children.length; i += 1) {
                        this.children[i].calcBounds();
                    }
                }
            } else {
                this.font = undefined;
                // Calculate children's boundaries and parameters:
                for (var i = 0; i < this.children.length; i += 1) {
                    this.children[i].calcBounds();
                }
            }
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
            this.offset.left = utils.getOffset[this.originX](this.width);
            this.offset.top = utils.getOffset[this.originY](this.height);
            this.pos.left = this.left + this.offset.left;
            this.pos.top = this.top + this.offset.top;
            this.extents.left += this.pos.left;
            this.extents.top += this.pos.top;
            this.extents.right += this.pos.left;
            this.extents.bottom += this.pos.top;*/
            this.offset.left = utils.getOffset[this.originX](this.width);
            this.offset.top = utils.getOffset[this.originY](this.height);
            this.pos.left = this.left + this.offset.left;
            this.pos.top = this.top + this.offset.top;
            this.radianAngle = this.angle * Math.PI / 180;
        };

        group.prototype.render = function () {
            if (this.opacity > 0) {
                canvasObj.context.save();   // Required to restore transform matrix after the following render:
                this.opacity < 1 && (canvasObj.context.globalAlpha *= this.opacity);
                canvasObj.context.translate(this.pos.left, this.pos.top);   // Set group center.
                canvasObj.context.scale(this.scaleX, this.scaleY);  // Scale group at center.
                canvasObj.context.rotate(this.radianAngle);   // Rotate group at center.
                if (this.backFill && this.width > 0 && this.height > 0) {
                    canvasObj.context.fillStyle = this.backFill;
                    canvasObj.context.fillRect(0, 0, this.width, this.height);
                }
                if (this.font && this.font !== canvasObj.curFont) {    // Set font if a global font is set.
                    // Save previous family and size:
                    var pFont = canvasObj.curFont,
                        pFontSize = canvasObj.curFontSize;
                    // Set font and family and size:
                    canvasObj.context.font = this.font;
                    //canvasObj.context.fontFamily = this.fontFamily;
                    canvasObj.curFont = this.font;
                    canvasObj.curFontSize = this.fontSize;
                    // Render children:
                    for (var i = 0; i < this.children.length; i += 1) {
                        this.children[i].calcBounds();
                    }
                    // Restore family and size:
                    canvasObj.curFont = pFont;
                    canvasObj.curFontSize = pFontSize;

                } else {
                    // Render children:
                    for (var i = 0; i < this.children.length; i += 1) {
                        this.children[i].calcBounds();
                    }
                }
                canvasObj.context.restore();
            }
        };

        group.prototype.isPointIn = function (posX, posY, event) {
            var sin = Math.sin(-this.radianAngle),
                cos = Math.cos(-this.radianAngle),
                tposX,
                i;
            // Remove translate:
            posX -= this.pos.left;
            posY -= this.pos.top;
            // Remove scale:
            posX /= this.scaleX;
            posY /= this.scaleY;
            // Remove rotate:
            tposX = posX;
            posX = posX * cos - posY * sin;
            posY = tposX * sin + posY * cos;
            // Loop through all children and check if the point is in:
            if (this.backFill) {
                return posX >= 0 && posY >= 0 && posX <= this.width && posY <= this.height;
            }

            for (i = 0; i < this.children.length; i += 1) {
                if (this.children[i].isPointIn(posX, posY, event)) return true;
            }
            return false;
            // Use the last extents (as it was last visible to user for click event):
            //return posX >= this.extents.left && posY >= this.extents.top && posX <= this.extents.right && posY <= this.extents.bottom;
        };

        group.prototype.mouseDownEvent = function (posX, posY, event) {
            var sin = Math.sin(-this.radianAngle),
                cos = Math.cos(-this.radianAngle),
                tposX,
                i;
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
            tposX = posX;
            posX = posX * cos - posY * sin;
            posY = tposX * sin + posY * cos;
            // Loop through all children and check if they have been clicked:
            for (i = 0; i < this.children.length; i += 1) {
                if (this.children[i].isPointIn(posX, posY, event)) {
                    this.children[i].mouseDownEvent(posX, posY, event);
                }
            }
            this.onmousedown && this.onmousedown(this.data.data);
            canvasObj.context.restore();
        };

        group.prototype.remove = function () {
            this.parent.children.splice(this.parent.children.indexOf(this), 1);
        };

        return group;
    };
});
/*global define*/
define('scalejs.canvas/rect',[
    './utils'
], function (utils) {
    

    return function (canvasObj) {
        function rect(opts) {
            this.type = "obj";
            this.className = "rect";
            this.parent = opts.parent || canvasObj;
            this.id = opts.id || opts.parent.children.length;
            this.data = opts.data || {};
            this.originX = opts.originX || "left";
            this.originY = opts.originY || "top";
            this.left = opts.left || 0;
            this.top = opts.top || 0;
            this.width = opts.width || 0;
            this.height = opts.height || 0;
            this.fill = opts.fill || "#000";
            this.offset = { left: 0, top: 0 };
            this.pos = { left: 0, top: 0 };
            this.extents = { left: 0, top: 0, right: 0, bottom: 0 };
        }

        rect.prototype.getExtents = function () {
            return this.extents;
        };

        rect.prototype.calcBounds = function () {
            // Calculate boundaries and additional parameters:
            this.offset.left = utils.getOffset[this.originX](this.width);
            this.offset.top = utils.getOffset[this.originY](this.height);
            this.pos.left = this.left + this.offset.left;
            this.pos.top = this.top + this.offset.top;
            this.extents.left = this.pos.left;
            this.extents.top = this.pos.top;
            this.extents.right = this.pos.left + this.width;
            this.extents.bottom = this.pos.top + this.height;
        };

        rect.prototype.render = function () {
            if (this.width > 0 && this.height > 0) {
                //canvasObj.context.save();
                canvasObj.context.fillStyle = this.fill;
                canvasObj.context.fillRect(this.pos.left, this.pos.top, this.width, this.height);
                //canvasObj.context.restore();
            }
        };

        rect.prototype.isPointIn = function (posX, posY, event) {
            // Use the last extents (as it was last visible to user for click event):
            return posX >= this.extents.left && posY >= this.extents.top && posX <= this.extents.right && posY <= this.extents.bottom;
        };

        rect.prototype.mouseDownEvent = function (posX, posY, event) {
            this.onmousedown && this.onmousedown(this.data.data);
        };

        rect.prototype.remove = function () {
            this.parent.children.splice(this.parent.children.indexOf(this), 1);
        };

        return rect;
    };
});
/*global define*/
define('scalejs.canvas/text',[
    './utils'
], function (utils) {
    

    return function (canvasObj) {
        function text(opts) {
            this.type = "obj";
            this.className = "text";
            this.parent = opts.parent || canvasObj;
            this.id = opts.id || opts.parent.children.length;
            this.data = opts.data || {};
            this.fontFamily = opts.fontFamily || "";//"Times New Roman";
            this.fontSize = opts.fontSize || 0;//40;
            this.text = opts.text || "";
            this.originX = opts.originX || "left";
            this.originY = opts.originY || "top";
            this.left = opts.left || 0;
            this.top = opts.top || 0;
            this.width = opts.width || 0;
            this.height = opts.height || 0;
            this.angle = opts.angle || 0;
            this.fill = opts.fill || "#000";
            this.opacity = opts.opacity || 1;
            this.offset = { left: 0, top: 0 };
            this.pos = { left: 0, top: 0 };
            this.extents = { left: 0, top: 0, right: 0, bottom: 0 };
        }

        text.prototype.setText = function (text) {
            // Compile font:
            if (this.fontFamily && this.fontSize) {
                this.font = this.fontSize + "px " + this.fontFamily;
                this.height = this.fontSize;
            } else {
                this.font = undefined;
                this.height = canvasObj.curFontSize;
            }
            // Check if text or font has changed, if so get width:
            if (this.font && (this.font !== this.calcFont || this.calcText !== this.text)) {
                canvasObj.context.save();
                canvasObj.context.font = this.font;
                this.text = text;
                this.width = canvasObj.context.measureText(text || "").width;
                canvasObj.context.restore();
                this.calcText = this.text;
                this.calcFont = this.font;
            } else if (!this.font && (canvasObj.curFont !== this.calcFont || this.calcText !== this.text)) {
                this.text = text;
                this.width = canvasObj.context.measureText(text || "").width;
                this.calcText = this.text;
                this.calcFont = canvasObj.curFont;
            }
        };

        text.prototype.getExtents = function () {
            return this.extents;
        };

        text.prototype.calcBounds = function () {
            // Calculate boundaries and additional parameters:
            this.setText(this.text);
            this.offset.left = utils.getOffset[this.originX](this.width);
            this.offset.top = utils.getOffset[this.originY](this.height) + this.height;
            this.pos.left = this.left + this.offset.left;
            this.pos.top = this.top + this.offset.top;
            this.extents.left = this.pos.left;
            this.extents.right = this.pos.left;
            this.extents.top = this.pos.top + this.width;
            this.extents.bottom = this.pos.top + this.height;
        };

        text.prototype.render = function () {
            // Only render if text is visible (saves time):
            if (this.opacity > 0 && this.text.length > 0) {
                canvasObj.context.save();   // Required to restore transform matrix after the following render:
                this.font && this.font !== canvasObj.curFont && (canvasObj.context.font = this.font);
                this.fill && (canvasObj.context.fillStyle = this.fill);
                this.opacity < 1 && (canvasObj.context.globalAlpha *= this.opacity);
                canvasObj.context.translate(this.left, this.top);   // Set center.
                this.angle && canvasObj.context.rotate(this.angle * Math.PI / 180);   // Rotate text around center.
                canvasObj.context.fillText(this.text, this.offset.left, this.offset.top);   // Draw text at offset pos.
                canvasObj.context.restore();
            }
        };

        text.prototype.isPointIn = function (posX, posY, event) {
            // Use the last extents (as it was last visible to user for click event):
            return posX >= this.extents.left && posY >= this.extents.top && posX <= this.extents.right && posY <= this.extents.bottom;
        };

        text.prototype.mouseDownEvent = function (posX, posY, event) {
            this.onmousedown && this.onmousedown(this.data.data);
        };

        text.prototype.remove = function () {
            this.parent.children.splice(this.parent.children.indexOf(this), 1);
        };

        return text;
    };
});
/*global define*/
define('scalejs.canvas/arc',[
    './utils'
], function (utils) {
    

    /*var is_chrome = navigator.userAgent.toLowerCase().indexOf('chrome') > -1;
    if (is_chrome) {
        CanvasRenderingContext2D.prototype.arc = function (x, y, radius, startAngle, endAngle, anticlockwise) {
            // Signed length of curve
            var signedLength;
            var tau = 2 * Math.PI;

            if (!anticlockwise && (endAngle - startAngle) >= tau) {
                signedLength = tau;
            } else if (anticlockwise && (startAngle - endAngle) >= tau) {
                signedLength = -tau;
            } else {
                var delta = endAngle - startAngle;
                signedLength = delta - tau * Math.floor(delta / tau);

                // If very close to a full number of revolutions, make it full
                if (Math.abs(delta) > 1e-12 && signedLength < 1e-12)
                    signedLength = tau;

                // Adjust if anti-clockwise
                if (anticlockwise && signedLength > 0)
                    signedLength = signedLength - tau;
            }

            // Minimum number of curves; 1 per quadrant.
            var minCurves = Math.ceil(Math.abs(signedLength) / (Math.PI / 2));

            // Number of curves; square-root of radius (or minimum)
            var numCurves = Math.ceil(Math.max(minCurves, Math.sqrt(radius)));

            // "Radius" of control points to ensure that the middle point
            // of the curve is exactly on the circle radius.
            var cpRadius = radius * (2 - Math.cos(signedLength / (numCurves * 2)));

            // Angle step per curve
            var step = signedLength / numCurves;

            // Draw the circle
            this.lineTo(x + radius * Math.cos(startAngle), y + radius * Math.sin(startAngle));
            for (var i = 0, a = startAngle + step, a2 = startAngle + step / 2; i < numCurves; ++i, a += step, a2 += step)
                this.quadraticCurveTo(x + cpRadius * Math.cos(a2), y + cpRadius * Math.sin(a2), x + radius * Math.cos(a), y + radius * Math.sin(a));
        }
    }*/

    var deg90InRad = Math.PI * 0.5; // 90 degrees in radians.

    return function (canvasObj) {
        function arc(opts) {
            this.type = "obj";
            this.className = "arc";
            this.parent = opts.parent || canvasObj;
            this.id = opts.id || opts.parent.children.length;
            this.data = opts.data || {};
            this.originX = opts.originX || "center";
            this.originY = opts.originY || "center";
            this.left = opts.left || 0;
            this.top = opts.top || 0;
            this.width = opts.width || 0;
            this.height = opts.height || 0;
            this.radius = 0;
            this.innerRadius = opts.innerRadius || 0;
            this.outerRadius = opts.outerRadius || 0;
            this.thickness = 0;
            this.startAngle = opts.startAngle || 0;
            this.endAngle = opts.endAngle || 0;
            this.fill = opts.fill || "#000";
            this.opacity = opts.opacity || 1;
            this.offset = { left: 0, top: 0 };
            this.pos = { left: 0, top: 0 };
            this.extents = { left: 0, top: 0, right: 0, bottom: 0 };
        }

        arc.prototype.getExtents = function () {
            return this.extents;
        };

        arc.prototype.calcBounds = function () {
            // Calculate boundaries and additional parameters:
            this.width = this.height = this.outerRadius * 2;
            this.offset.left = this.left;//utils.applyOffset[this.originX](this.left, this.width) + this.width;
            this.offset.top = this.top;//utils.applyOffset[this.originY](this.top, this.height) + this.height;
            this.extents.left = this.offset.left - this.outerRadius;
            this.extents.right = this.offset.left + this.outerRadius;
            this.extents.top = this.offset.top - this.outerRadius;
            this.extents.bottom = this.offset.top + this.outerRadius;
            this.thickness = this.outerRadius - this.innerRadius;
            this.radius = this.thickness / 2 + this.innerRadius;
        };

        arc.prototype.render = function () {
            if (this.opacity > 0 && this.thickness !== 0 && this.endAngle !== this.startAngle) {
                //canvasObj.context.save();
                canvasObj.context.beginPath();
                this.fill && (canvasObj.context.strokeStyle = this.fill);
                this.opacity < 1 && (canvasObj.context.globalAlpha *= this.opacity);
                canvasObj.context.lineWidth = this.thickness;
                canvasObj.context.arc(this.offset.left, this.offset.top, this.radius, this.startAngle - deg90InRad, this.endAngle - deg90InRad);
                canvasObj.context.stroke();
                //canvasObj.context.restore();
            }
        };

        arc.prototype.isPointIn = function (posX, posY, event) {
            // Use the last extents (as it was last visible to user for click event):
            var distance = (posX - this.offset.left) * (posX - this.offset.left) + (posY - this.offset.top) * (posY - this.offset.top), // Distance from point to arc center.
                angle = Math.atan2(posY - this.offset.top, posX - this.offset.left) + deg90InRad;   // Angle from +x axis to arc center to pointer.
            if (angle < 0) {
                angle += 2 * Math.PI;   // This is to fix the differences in d3 start/end angle and canvas's.
                // d3 has: [0, 2 * Math.PI], which starts from and goes to (+)y-axis.
                // canvas has: [-Math.PI, Math.PI], which starts from and goes to (-)x-axis.
            }
            return distance <= this.outerRadius * this.outerRadius && distance >= this.innerRadius * this.innerRadius && angle >= this.startAngle && angle <= this.endAngle;
        };

        arc.prototype.mouseDownEvent = function (posX, posY, event) {
            this.onmousedown && this.onmousedown(this.data.data);
        };

        arc.prototype.remove = function () {
            this.parent.children.splice(this.parent.children.indexOf(this), 1);
        };

        return arc;
    };
});
/*global define*/
define('scalejs.canvas/selector',[
    './group',
    './rect',
    './text',
    './arc'
], function (
    group,
    rect,
    text,
    arc
) {
    

    // Get requestAnimationFrame function based on which browser:
    var requestAnimFrame = window.requestAnimationFrame ||
                           window.webkitRequestAnimationFrame ||
                           window.mozRequestAnimationFrame ||
                           function (callback) {
                               window.setTimeout(callback, 1000 / 60);
                           };

    return function canvasSelector(canvasObj) {
        // Object that holds all object type constructors:
        var createObject = {
                group: group(canvasObj),
                rect: rect(canvasObj),
                text: text(canvasObj),
                arc: arc(canvasObj)
            },
            canvasSelector;

        function Selector(opts) {
            this.isTransition = opts.isTransition || false;
            this.durationTime = opts.durationTime || 250;
            this.easeFunc = opts.easeFunc || function (t) { return t; };
            this.endFunc = undefined;
            this.object = opts.object || canvasObj;
            this.objects = opts.objects || [];
            this.enterObjects = opts.enterObjects || [];
            this.updateObjects = opts.updateObjects || [];
            this.exitObjects = opts.exitObjects || [];
        }

        Selector.prototype.select = function (objectClassName) {
            var firstObj = [], object, i, j;
            // Get first object with the class that matches objectClassName, from each object in objects:
            for (i = 0; i < this.objects.length; i += 1) {
                object = this.objects[i];
                if (object.children !== undefined && object.children.length > 0) {
                    for (j = 0; j < object.children.length; j += 1) {
                        if (object.children[j].className === objectClassName) {
                            firstObj.push(object.children[j]);
                            break;
                        }
                    }
                }
            }
            // Return a new selector with the first matching class in each object:
            return new Selector({
                isTransition: this.isTransition,
                durationTime: this.durationTime,
                easeFunc: this.easeFunc,
                object: firstObj.length > 0 ? firstObj[0].parent : (this.objects.length > 0 ? this.objects[0] : this.object), //Should rework this to accept more than one parent...
                objects: firstObj
            });
        };

        Selector.prototype.selectAll = function (objectClassName) {
            var objs = [], object, i, j;
            // Get all objects with class name as objectClassName:
            for (i = 0; i < this.objects.length; i += 1) {
                object = this.objects[i];
                if (object.children !== undefined && object.children.length > 0) {
                    for (j = 0; j < object.children.length; j += 1) {
                        if (object.children[j].className === objectClassName) {
                            objs.push(object.children[j]);  // Found, append to objs.
                        }
                    }
                }
            }
            // Return a new selector with all objects matching objectClassName:
            return new Selector({
                isTransition: this.isTransition,
                durationTime: this.durationTime,
                easeFunc: this.easeFunc,
                object: objs.length > 0 ? objs[0].parent : (this.objects.length > 0 ? this.objects[0] : this.object), //Should rework this to accept more than one parent...
                objects: objs
            });
        };

        Selector.prototype.filter = function (filterFunc) {
            var objs = [], i, j;
            // Get all objects where filterFunc returns true:
            for (i = 0; i < this.objects.length; i += 1) {
                // Check if object should be added to new selector:
                if (filterFunc.call(this.objects[i], this.objects[i].data.data)) {
                    objs.push(this.objects[i]);
                }
            }
            // Return a new selector with all objects matching objectClassName:
            return new Selector({
                isTransition: this.isTransition,
                durationTime: this.durationTime,
                easeFunc: this.easeFunc,
                object: objs.length > 0 ? objs[0].parent : (this.objects.length > 0 ? this.objects[0] : this.object), //Should rework this to accept more than one parent...
                objects: objs
            });
        };

        Selector.prototype.data = function (nodes, keyFunc) {
            // TODO FINISH
            // Data is applied to those objects within the selection only!
            // Each time this is called, it checks against the objects var.
            //   If object with datakey exists in dataArray, it is kept in objects var.
            //   If a data's key doesn't have an object associated with it, the data is added in enterObjects var.
            //   If object's datakey isn't in dataArray, then the object is added to exitObjects var.
            // If nodes is a function, each object retrieves its data from nodes(curData)!
            // Else nodes contains the array of data for the objects.
            // TEMP FIX:
            /*this.exitObjects = [];
            // Map nodes data to match object data.
            nodes = nodes.map(function (node) {
                return {
                    id: keyFunc(node),
                    data: node
                };
            }, this);
            this.objects.forEach(function (object) {
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
                    this.exitObjects.push(object);
                }
            }, this);
            // Nodes left are new, so mark for enter:
            this.enterObjects = nodes;*/
            // Generate a table filled with the nodes:
            var nodeTable = {},
                i;
            for (i = 0; i < nodes.length; i += 1) {
                var key = keyFunc(nodes[i]);
                nodes[i] = {
                    id: key,
                    data: nodes[i]
                };
                nodeTable[key] = nodes[i];
            }
            // Populate the objects and exitObjects arrays:
            this.exitObjects = [];
            this.objects = this.objects.filter(function (object) {
                if (nodeTable[object.data.id]) {
                    object.data.data = nodeTable[object.data.id].data;
                    nodeTable[object.data.id] = undefined;
                    return true;
                } else {
                    this.exitObjects.push(object);
                    return false;
                }
            }, this);
            // Populate enterObjects array:
            this.enterObjects = nodes.filter(function (node) {
                return nodeTable[node.id];
            });
            // Return current selection (update selection):
            // TODO: Return new selection.
            return this;
        };

        Selector.prototype.enter = function () {
            // TODO FINISH
            // Returns enterObjects custom selector, with it's parent as this selector.
            // The selector adds exitObjects to the objects list of this selector when it appends (only function supported with this yet).
            return {
                parentSelector: this,
                append: function (objectClassName, opts) {
                    opts = opts || {};
                    return new Selector({
                        isTransition: this.parentSelector.isTransition,
                        durationTime: this.parentSelector.durationTime,
                        easeFunc: this.parentSelector.easeFunc,
                        objects: this.parentSelector.enterObjects.map(function (object) {
                            opts.parent = this.parentSelector.object;  // Set parent of child to object.
                            opts.data = object;    // Pass data to child!
                            var newObj = new createObject[objectClassName](opts);   // Create child.
                            this.parentSelector.object.children.push(newObj);  // Add child to object.
                            return newObj;  // Add child to new selector.
                        }, this)
                    });
                }
            };
            // Rethink selectors in order to properly append items into the right parents!
        };

        Selector.prototype.update = function () {
            // Returns selector with updateObjects as objects:
            var newSelector = new Selector(this);
            newSelector.objects = this.updateObjects;
            return newSelector;
        }

        Selector.prototype.exit = function () {
            // TODO FINISH
            // Returns exitObjects custom selector, with it's parent as this selector.
            // The selector removes exitObjects from the objects list of this selector when it removes (only function supported with this yet).
            var newSelector = new Selector(this);
            newSelector.objects = this.exitObjects;
            return newSelector;
        };

        Selector.prototype.on = function (eventName, eventFunc) {
            // Map given name to internal property:
            eventName = "on" + eventName;
            // Add property to every object in selector:
            this.objects.forEach(function (object) {
                object[eventName] = eventFunc;
            });
            return this;
        };

        Selector.prototype.append = function (objectClassName, opts) {
            opts = opts || {};  // Make sure opts exists.
            // Return a new selector of all appended objects:
            var newSelector = new Selector(this);
            newSelector.objects = this.objects.map(function (object) { // For each object in selector, append a new object:
                opts.parent = object;       // Set parent of child to object.
                opts.data = object.data;    // Pass data to child!
                var newObj = new createObject[objectClassName](opts);   // Create child.
                object.children.push(newObj);   // Add child to object.
                return newObj;  // Add child to new selector.
            });
            return newSelector;
        };

        Selector.prototype.remove = function () {
            // Loop through all objects, and remove them from their individual parent:
            this.objects.forEach(function (object) {
                object.parent.children.splice(object.parent.children.indexOf(object), 1);
            });
            // Reset selector's objects list:
            this.objects = [];
            return this;
            // TODO: Read d3 docs on what to return!
        };

        Selector.prototype.attr = function (attrName, attrVal) {
            this.objects.forEach(function (object) {
                var value = attrVal;
                if (typeof (value) === "function") {
                    value = value(attrFunc.call(object, object.data.data));
                }
                if (typeof (object["set" + attrName]) === "function") {//object.hasOwnProperty("set" + attrName)) {
                    object["set" + attrName](value);
                } else {
                    object[attrName] = value;
                }
            });
            return this;
        };

        Selector.prototype.sort = function (compFunc) {
            // Sort objects in selection:
            this.objects.sort(function (a, b) {
                return compFunc(a.data.data, b.data.data);
            });
            return this;
        };

        Selector.prototype.order = function () {
            // Apply object order in selection to render scene:
            this.objects.forEach(function (object) {
                // First start by removing the objects:
                object.parent.children.splice(object.parent.children.indexOf(object), 1);
                // Then put it back at the end:
                object.parent.children.push(object);
            });
            return this;
        };

        Selector.prototype.each = function (func, listener) {
            // Execute a given function for each object:
            if (listener === undefined || listener === "start") {
                this.objects.forEach(function (object) { func.call(object, object.data.data); });
            } else if (listener === "end") {
                this.objects.forEach(function (object) { object.tweenEndFunc = func; });
                //this.endFunc = func;
            }
            return this;
        };

        Selector.prototype.transition = function () {
            // Return a new selector with the first matching class in each object:
            var newSelector = new Selector(this);
            newSelector.isTransition = true;
            newSelector.objects.forEach(function (object) { object.tweenEndFunc = undefined; });
            return newSelector;
            // Mark selector as in a transition now:
            /*this.isTransition = true;
            return this;*/
        };

        Selector.prototype.duration = function (ms) {
            // Set selector's duration of a transition:
            this.durationTime = ms;
            return this;
        };

        Selector.prototype.ease = function (type) {
            // Set selector's ease function:
            this.easeFunc = type;
            return this;
        };

        Selector.prototype.tween = function (tweenName, tweenFunc) {
            // TODO: Register tweenFunc for all objects in this selector.
            // Setup timeout:
            var timeStart = new Date().getTime(),
                timeEnd = timeStart + this.durationTime,
                i;
            // Register object on canvas's animation array. If object already is there, then replace the current tween.
            this.objects.forEach(function (object) {
                // TODO: Make animation's ID based to test speed.
                if (!(object.animationIndex >= 0)) {
                    object.animationIndex = canvasObj.animations.length;
                    canvasObj.animations[object.animationIndex] = object;
                }
                object.tweenFunc = tweenFunc.call(object, object.data.data);
                object.easeFunc = this.easeFunc;
                object.timeStart = timeStart;
                object.timeEnd = timeEnd;
                object.duration = this.durationTime;
            }, this);
            if (canvasObj.requestFrameID === undefined && canvasObj.animations.length > 0) {
                canvasObj.requestFrameID = requestAnimFrame(function () { canvasObj.onAnimationFrame(); });
            }
            return this;
        };

        Selector.prototype.startRender = function () { }; // This function is a temp fix to render the canvas!

        Selector.prototype.pumpRender = function () {
            // This function is a temp fix to render the canvas!
            canvasObj.pumpRender();
            return canvasSelector;
        };

        canvasSelector = new Selector({
            objects: [canvasObj]
        });
        canvasSelector[0] = [canvasObj.element]; // Temp Fix to access element!

        return canvasSelector;
    };
});
/*global define*/
define('scalejs.canvas/canvas',[
    'hammer',
    './selector'
], function (
    hammer,
    selector
) {
    

    // Get requestAnimationFrame function based on which browser:
    var requestAnimFrame = window.requestAnimationFrame ||
                           window.webkitRequestAnimationFrame ||
                           window.mozRequestAnimationFrame ||
                           function (callback) {
                               window.setTimeout(callback, 1000 / 60);
                           };

    function canvas(element) {
        this.type = "canvas";
        this.className = "canvas";
        this.element = element;
        this.context = element.getContext("2d");
        this.parent = this;
        this.children = [];
        this.animations = [];
        this.requestFrameID = undefined;
        this.curFont = "";
        this.curFontSize = 0;
    }

    canvas.prototype.setwidth = function (width) {
        this.element.width = width;
    };

    canvas.prototype.setheight = function (height) {
        this.element.height = height;
    };

    canvas.prototype.onAnimationFrame = function () {
        // Check if there is anything to animate:
        if (this.animations.length <= 0) {
            this.requestFrameID = undefined;
            return;
        }
        // Request to call this function on next frame (done before rendering to make animations smoother):
        var thisCanvas = this;
        this.requestFrameID = requestAnimFrame(function () { thisCanvas.onAnimationFrame(); });
        // Get current time to test if animations are over:
        var curTime = new Date().getTime(), i, animation;
        // Execute all animations, remove any that are finished:
        for (i = 0; i < this.animations.length; i += 1) {
            animation = this.animations[i];
            // Call tween function for object:
            var timeRatio = Math.min((curTime - animation.timeStart) / animation.duration, 1);  // Get the current animation fram which is can be [0, 1).
            animation.tweenFunc.call(animation, animation.easeFunc(timeRatio)); // Call animation tween function.
            // Filter out animations which exceeded the time:
            if (curTime >= animation.timeEnd) {
                animation.animationIndex = undefined;
                animation.tweenEndFunc && animation.tweenEndFunc.call(animation, animation.data.data);
                this.animations.splice(i, 1);
                i -= 1;
            } else {
                animation.animationIndex = i;
            }
        }
        // Render objects:
        this.pumpRender();
    };

    canvas.prototype.pumpRender = function () {
        // Reset transform:
        this.context.setTransform(1, 0, 0, 1, 0, 0);
        // Clear globals:
        this.context.font = "40px Times New Roman";
        this.curFont = "40px Times New Roman";
        //this.curFontFamily = "Times New Roman";
        this.curFontSize = 40;
        // Calculate all objects' boundaries and parameters:
        for (var i = 0; i < this.children.length; i += 1) {
            this.children[i].calcBounds();
        }
        // Clear canvas:
        this.context.clearRect(0, 0, this.element.width, this.element.height);
        // Render all objects:
        for (var i = 0; i < this.children.length; i += 1) {
            this.children[i].render();
        }
    };

    canvas.prototype.startRender = function () { };

    canvas.prototype.render = function () {
        this.pumpRender();
    };

    function select(canvasElement) {
        var // Canvas object (unique to each canvas):
            canvasObj = new canvas(canvasElement);

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

        // Return the canvas selector:
        return selector(canvasObj);
    }

    return {
        select: select
    };
});
/*global define*/
define('scalejs.canvas',[
    'scalejs!core',
    './scalejs.canvas/canvas'
], function (
    core,
    canvas
) {
    

    // There are few ways you can register an extension.
    // 1. Core and Sandbox are extended in the same way:
    //      core.registerExtension({ part1: part1 });
    //
    // 2. Core and Sandbox are extended differently:
    //      core.registerExtension({
    //          core: {corePart: corePart},
    //          sandbox: {sandboxPart: sandboxPart}
    //      });
    //
    // 3. Core and Sandbox are extended dynamically:
    //      core.registerExtension({
    //          buildCore: buildCore,
    //          buildSandbox: buildSandbox
    //      });
    core.registerExtension({
        canvas: canvas
    });

    return canvas;
});



/*global define*/
define('scalejs.visualization-d3/treemap',[
    'd3'
], function (
    d3
) {
    

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
            lastClickTime;

        // Zoom after click:
        function zoom(d) {
            if (canvasArea === undefined) {
                return; // Catch for if treemap hasn't been setup.
            }
            // Set zoom domain to d's area:
            var kx = canvasWidth / d.dx, ky = canvasHeight / d.dy, t;
            x.domain([d.x, d.x + d.dx]);
            y.domain([d.y, d.y + d.dy]);

            // Animate treemap nodes:
            t = canvasArea.selectAll("group").transition()
                .duration(d3.event ? (d3.event.altKey ? 7500 : 1000) : 1000)
                .tween("groupZoom", function (d) {
                    // Create interpolations used for a nice slide:
                    var interpX = d3.interpolate(this.left, x(d.x)),
                        interpY = d3.interpolate(this.top, y(d.y)),
                        element = this;
                    return function (t) {
                        element.left = interpX(t);
                        element.top = interpY(t);
                    };
                });

            t.select("rect").tween("rectZoom", function (d) {
                // Create interpolations used for a nice slide:
                var interpWidth = d3.interpolate(this.width, Math.max(kx * d.dx - 1, 0)),
                    interpHeight = d3.interpolate(this.height, Math.max(ky * d.dy - 1, 0)),
                    element = this;
                return function (t) {
                    element.width = interpWidth(t);
                    element.height = interpHeight(t);
                };
            });

            t.select("text").tween("textZoom", function (d) {
                // Create interpolations used for a nice slide:
                var interpX = d3.interpolate(this.left, kx * d.dx / 2),
                    interpY = d3.interpolate(this.top, ky * d.dy / 2),
                    interpOpacity = d3.interpolate(this.opacity, (d.dx - 4 >= this.width) && (d.dy - 2 >= this.height) ? 1 : 0),
                    element = this;
                return function (t) {
                    element.left = interpX(t);
                    element.top = interpY(t);
                    element.opacity = interpOpacity(t);
                };
            });

            // Prevent event from firing more than once:
            if (d3.event) {
                d3.event.stopPropagation();
            }
        }

        function addNodes(celSel) {
            // Add nodes to Canvas:
            var cell = celSel.enter().append("group").each(function (d) {
                this.originX = "center";
                this.originY = "center";
                this.left = d.x;
                this.top = d.y;
            });

            // Add rectangle to each node:
            cell.append("rect").each(function (d) {
                this.width = Math.max(d.dx - 1, 0);
                this.height = Math.max(d.dy - 1, 0);
                this.fill = d.color;
            });

            // Add title to each node:
            cell.append("text").each(function (d) {
                this.originX = "center";
                this.originY = "center";
                this.left = d.dx / 2;
                this.top = d.dy / 2;
                this.fontSize = 11;
                this.setText(d.name);
                this.opacity = (d.dx - 4 >= this.width) && (d.dy - 2 >= this.height) ? 1 : 0;
            });
        }

        function update() {
            if (canvasArea === undefined) {
                return; // Catch for if treemap hasn't been setup.
            }
            // Define temp vars:
            var celSel, cell, nodes;

            // Get treemap data:
            root = json();

            // This is a treemap being updated:
            // Filter out nodes with children:
            nodes = treemapLayout.size([canvasWidth, canvasHeight])
                    .nodes(root)
                    .filter(function (d) { return !d.children; });

            // Select all nodes in Canvas, and apply data:
            celSel = canvasArea.selectAll("group")
                    .data(nodes, function (d) { return d.name; });

            // Update nodes on Canvas:
            cell = celSel.transition()
                .duration(1000)
                .tween("groupTween", function (d) {
                    // Create interpolations used for a nice slide:
                    var interpX = d3.interpolate(this.left, d.x),
                        interpY = d3.interpolate(this.top, d.y),
                        element = this;
                    return function (t) {
                        element.left = interpX(t);
                        element.top = interpY(t);
                    };
                });

            // Update each node's rectangle:
            cell.select("rect").tween("rectTween", function (d) {
                // Create interpolations used for a nice slide:
                var interpWidth = d3.interpolate(this.width, Math.max(d.dx - 1, 0)),
                    interpHeight = d3.interpolate(this.height, Math.max(d.dy - 1, 0)),
                    interpFill = d3.interpolate(this.fill, d.color),
                    element = this;
                return function (t) {
                    element.width = interpWidth(t);
                    element.height = interpHeight(t);
                    element.fill = interpFill(t);
                };
            });

            // Update each node's title:
            cell.select("text").tween("textTween", function (d) {
                // Create interpolations used for a nice slide:
                var interpX = d3.interpolate(this.left, d.dx / 2),
                    interpY = d3.interpolate(this.top, d.dy / 2),
                    interpOpacity,
                    element = this;
                if (this.name !== d.name) {
                    this.setText(d.name);
                    interpOpacity = d3.interpolate(this.opacity, (d.dx - 4 >= this.width) && (d.dy - 2 >= this.height) ? 1 : 0);
                    return function (t) {
                        element.left = interpX(t);
                        element.top = interpY(t);
                        element.opacity = interpOpacity(t);
                    };
                }
                return function (t) {
                    element.left = interpX(t);
                    element.top = interpY(t);
                };
            });

            // Add new nodes to Canvas:
            addNodes(celSel);

            // Remove nodes from Canvas:
            cell = celSel.exit().remove();
        }

        function init(
            element,
            width,
            height,
            jsonObservable,
            selectZoomFunction
        ) {
            if (canvasArea !== undefined) {
                return; // Catch for if treemap has been setup.
            }
            canvasElement = element;
            json = jsonObservable;
            canvasWidth = width;
            canvasHeight = height;
            x = d3.scale.linear().range([0, canvasWidth]);
            y = d3.scale.linear().range([0, canvasHeight]);
            selectZoom = selectZoomFunction;

            // Define temp vars:
            var celSel, nodes;

            // Get treemap data:
            root = json();

            // This is a new treemap:
            // Setup treemap and SVG:
            treemapLayout = d3.layout.treemap()
                            .round(false)
                            .size([canvasWidth, canvasHeight])
                            .sticky(false)
                            .mode('squarify')
                            .value(function (d) { return d.size; })
                            .children(function (d) { return d.children; });

            canvasArea = canvasElement.append("group").each(function () {
                this.originX = "center";
                this.originY = "center";
            });

            // Filter out nodes with children:
            nodes = treemapLayout.nodes(root)
                    .filter(function (d) { return !d.children; });

            // Join data with selection:
            celSel = canvasArea.selectAll("group")
                    .data(nodes, function (d) { return d.name; });

            // Add nodes to Canvas:
            addNodes(celSel);

            canvasElement.pumpRender();
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
                //canvasElement.select("group").remove();
                //canvasArea.selectAll("group").remove();
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
/*global define*/
define('scalejs.visualization-d3/treemapCustom',[
    'd3'
], function (
    d3
) {
    

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
            visualization,
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

        function parseColor(color) {
            var rgba, opacity = 1;
            if (color.indexOf("rgba") === 0) {
                rgba = color.substring(5, color.length - 1)
                     .replace(/ /g, '')
                     .split(',');
                opacity = rgba.pop();
                color = "rgb(" + rgba.join(",") + ")";
            }
            return {
                color: color,
                opacity: opacity
            };
        }

        function groupTween(p, opacity) {
            return function (d) {
                // Create interpolations used for a nice slide:
                var nodeSpaced = getNodeSpaced(d, d),
                    interpX, interpY,
                    interpWidth, interpHeight,
                    newFill = (d.children && d.lvl < root.curMaxLevel ? parentColor(d.lvl / (root.maxlvl - 1)) : d.color),
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
                    newColor = parseColor(d.fontColor),
                    interpFill = d3.interpolate(this.fill, newColor.color),
                    interpOpacity,// = d3.interpolate(this.opacity, !(d.children && d.lvl < root.curMaxLevel) && (d.sdx - 1 >= this.width) && (d.sdy - 1 >= this.height) ? newColor.opacity : 0),
                    //interpOpacity = d3.interpolate(this.opacity, !(d.children && d.lvl < root.curMaxLevel) && (kx * d.dx - sp * 2 >= this.width) && (ky * d.dy - sp * 2 >= this.height) ? 1 : 0),
                    element = this;
                if (visualization.allowTextOverflow) {
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
                .data(nodes, function (d) { return d.id; });

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
                    newColor = parseColor(d.children && d.lvl < root.curMaxLevel ? parentColor(d.lvl / (root.maxlvl - 1)) : d.color);
                    this.backFill = newColor.color;
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
                    this.fontFamily = d.fontFamily;
                    this.fontSize = d.fontSize;
                    this.setText(d.name);
                    //this.static = true;
                    if (visualization.allowTextOverflow) {
                        this.opacity = (d.parent && d.parent.children && d.parent.lvl < root.curMaxLevel) ? 1 : 0;
                    } else {
                        this.opacity = (d.parent && d.parent.children && d.parent.lvl < root.curMaxLevel) && (kx * d.dx - spacing * 2 >= this.width) && (ky * d.dy - spacing * 2 >= this.height) ? 1 : 0;
                    }
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
            parameters,
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
                    .data(nodes, function (d) { return d.id; });

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
        visualization = {
            init: init,
            update: update,
            zoom: zoom,
            resize: resize,
            remove: remove,
            enableRotate: false,
            enableRotateDefault: false,
            enableRootZoom: true,
            fontSize: 11,
            fontFamily: "Times New Roman",
            allowTextOverflow: false
        };
        return visualization;
    };
});
/*global define*/
define('scalejs.visualization-d3/sunburst',[
    'd3'
], function (
    d3
) {
    

    return function () {
        var //Sunburst variables
            canvasElement,
            json,
            selectZoom,
            canvasWidth,
            canvasHeight,
            radius,
            x,
            y,
            root,
            sunburstLayout,
            arc,
            canvasArea,
            lastClickTime;

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

        function pathTween(p) {
            return function (d) {
                // Create interpolations used for a nice slide around the parent:
                var interpX = d3.interpolate(this.old.x, d.x),
                    interpY = d3.interpolate(this.old.y, d.y),
                    interpDX = d3.interpolate(this.old.dx, d.dx),
                    interpDY = d3.interpolate(this.old.dy, d.dy),
                    interpXD = d3.interpolate(this.old.xd, [p.x, p.x + p.dx]),
                    interpYD = d3.interpolate(this.old.yd, [p.y, 1]),
                    interpYR = d3.interpolate(this.old.yr, [p.y ? 20 : 0, radius]),
                    // Remember this element:
                    element = this;
                return function (t) { // Interpolate arc:
                    // Store new data in the old property:
                    element.old = {
                        x: interpX(t),
                        y: interpY(t),
                        dx: interpDX(t),
                        dy: interpDY(t),
                        xd: interpXD(t),
                        yd: interpYD(t),
                        yr: interpYR(t)
                    };
                    x.domain(element.old.xd);
                    y.domain(element.old.yd).range(element.old.yr);
                    var value = arc({
                        x: element.old.x,
                        y: element.old.y,
                        dx: element.old.dx,
                        dy: element.old.dy
                    });
                    element.initialize(value, {
                        left: element.left,
                        top: element.top,
                        width: element.width,
                        height: element.height,
                        //pathOffset: { x: 0, y: 0 },
                        d3fabricOrgPath: value
                    });
                };
            };
        }
        function textTween(p) {
            return function (d) {
                // Create interpolations used for a nice slide around the parent:
                var interpX = d3.interpolate(this.old.x, d.x),
                    interpY = d3.interpolate(this.old.y, d.y),
                    interpDX = d3.interpolate(this.old.dx, d.dx),
                    interpDY = d3.interpolate(this.old.dy, d.dy),
                    textElement = this;
                return function (t) { // Interpolate attributes:
                    var rad, radless, offsety, angle,
                        outerRadius, innerRadius, padding, arcWidth;
                    // Store new data in the old property:
                    textElement.old = {
                        x: interpX(t),
                        y: interpY(t),
                        dx: interpDX(t),
                        dy: interpDY(t)
                    };

                    // Update data:
                    d.w = this.width;
                    d.h = this.height;

                    // Calculate text angle:
                    rad = x(textElement.old.x + textElement.old.dx / 2);
                    radless = rad - Math.PI / 2;
                    offsety = y(d.y) + 2;
                    angle = rad * 180 / Math.PI - 90;
                    if (angle > 90) {
                        angle = (angle + 180) % 360;
                    }

                    // Change anchor based on side of Sunburst the text is on:
                    textElement.originX = rad > Math.PI ? "right" : "left";
                    textElement.left = offsety * Math.cos(radless);
                    textElement.top = offsety * Math.sin(radless);

                    // Setup variables for opacity:
                    outerRadius = Math.max(0, y(textElement.old.y + textElement.old.dy));
                    innerRadius = Math.max(0, y(textElement.old.y));
                    arcWidth = (x(textElement.old.x + textElement.old.dx) - x(textElement.old.x)) * y(textElement.old.y);

                    // Change opacity:
                    textElement.opacity = isParentOf(p, d) && (outerRadius - innerRadius - 4 >= d.w) && ((arcWidth - 2 >= d.h) || y(textElement.old.y) < 1) ? 1 : 0;

                    // Rotate text angle:
                    textElement.angle = angle;
                };
            };
        }
        // Zoom after click:
        function zoom(p) {
            if (canvasArea === undefined) {
                return; // Catch for if sunburst hasn't been setup.
            }
            // Animate sunburst nodes:
            var t = canvasArea.selectAll("group")
                .transition()
                .duration(d3.event ? (d3.event.altKey ? 7500 : 1000) : 1000)
                .tween("groupZoom", function (d) {
                    // Create interpolations used for a nice slide:
                    var interpX = d3.interpolate(this.left, canvasWidth / 2),
                        interpY = d3.interpolate(this.top, canvasHeight / 2),
                        element = this;
                    return function (t) {
                        element.left = interpX(t);
                        element.top = interpY(t);
                    };
                });

            t.select("path")
                .tween("pathZoom", pathTween(p));

            t.select("text")
                .tween("textZoom", textTween(p));

            // Prevent event from firing more than once:
            if (d3.event) {
                d3.event.stopPropagation();
            }
        }

        function addNodes(celSel) {
            // Add nodes to Canvas:
            var cell = celSel.enter().append("group").each(function (d) {
                this.originX = "center";
                this.originY = "center";
                this.left = canvasWidth / 2;
                this.top = canvasHeight / 2;
                this.perPixelTargetFind = true;
            }).on("mousedown", function (d) {
                var clickTime = (new Date()).getTime();
                if (clickTime - lastClickTime < 500) {
                    selectZoom(d);
                }
                lastClickTime = clickTime;
            });

            // Add arc to nodes:
            cell.append("path")
                .attr("d", function (d) {
                    this.fill = d.color;
                    this.old = {
                        x: d.x,
                        y: d.y,
                        dx: d.dx,
                        dy: d.dy,
                        xd: x.domain(),
                        yd: y.domain(),
                        yr: y.range()
                    };
                    return arc(d);
                });

            // Add text to nodes:
            cell.append("text").each(function (d) {
                this.originX = (x(d.x + d.dx / 2) > Math.PI) ? "right" : "left";
                this.originY = "center";
                this.fontSize = 11;
                this.setText(d.name);
                d.bw = y(d.y + d.dy) - y(d.y);
                d.bh = (x(d.x + d.dx) - x(d.x)) * y(d.y);
                this.opacity = (d.bw - 4 >= this.width) && ((d.bh - 2 >= this.height) || y(d.y) < 1) ? 1 : 0;
                var ang = x(d.x + d.dx / 2) * 180 / Math.PI - 90;
                if (ang > 90) {
                    ang = (ang + 180) % 360;
                }
                this.angle = ang;
                this.left = (y(d.y) + 2) * Math.cos(x(d.x + d.dx / 2) - Math.PI / 2);
                this.top = (y(d.y) + 2) * Math.sin(x(d.x + d.dx / 2) - Math.PI / 2);
                this.old = {
                    x: d.x,
                    y: d.y,
                    dx: d.dx,
                    dy: d.dy
                };
            });
        }

        function update() {
            if (canvasArea === undefined) {
                return; // Catch for if sunburst hasn't been setup.
            }
            // Define temp vars:
            var celSel, cell, nodes;

            // Get treemap data:
            root = json();

            // This is a sunburst being updated:
            // Filter out nodes with children:
            nodes = sunburstLayout.nodes(root);

            // Select all nodes in Canvas, and apply data:
            celSel = canvasArea.selectAll("group")
                .data(nodes, function (d) { return d.name; });

            // Update nodes on Canvas:
            cell = celSel.transition()
                .duration(1000)
                .tween("groupUpdate", function (d) {
                    // Create interpolations used for a nice slide:
                    var interpX = d3.interpolate(this.left, canvasWidth / 2),
                        interpY = d3.interpolate(this.top, canvasHeight / 2),
                        element = this;
                    return function (t) {
                        element.left = interpX(t);
                        element.top = interpY(t);
                    };
                });

            // Update arcs on Canvas:
            cell.select("path")
                .tween("pathUpdate", function (d) {
                    // Create interpolations used for a nice slide around the parent:
                    var p = nodes[0],
                        interpX = d3.interpolate(this.old.x, d.x),
                        interpY = d3.interpolate(this.old.y, d.y),
                        interpDX = d3.interpolate(this.old.dx, d.dx),
                        interpDY = d3.interpolate(this.old.dy, d.dy),
                        interpXD = d3.interpolate(this.old.xd, [p.x, p.x + p.dx]),
                        interpYD = d3.interpolate(this.old.yd, [p.y, 1]),
                        interpYR = d3.interpolate(this.old.yr, [p.y ? 20 : 0, radius]),
                        interpFill = d3.interpolate(this.fill, d.color),
                        // Remember this element:
                        element = this;
                    return function (t) { // Interpolate arc:
                        // Store new data in the old property:
                        element.old = {
                            x: interpX(t),
                            y: interpY(t),
                            dx: interpDX(t),
                            dy: interpDY(t),
                            xd: interpXD(t),
                            yd: interpYD(t),
                            yr: interpYR(t)
                        };
                        x.domain(element.old.xd);
                        y.domain(element.old.yd).range(element.old.yr);
                        element.fill = interpFill(t);
                        var value = arc({
                            x: element.old.x,
                            y: element.old.y,
                            dx: element.old.dx,
                            dy: element.old.dy
                        });
                        element.initialize(value, {
                            left: element.left,
                            top: element.top,
                            width: element.width,
                            height: element.height,
                            //pathOffset: { x: 0, y: 0 },
                            d3fabricOrgPath: value
                        });
                        /*var dim = element._parseDimensions();
                        delete dim.left;
                        delete dim.top;
                        element.set(dim);
                        element.setCoords();*/
                    };
                });

            // Update titles on Canvas:
            cell.select("text")
                .tween("textTween", textTween(nodes[0]));   // Sunburst Text Tween animation, zoom to root (node0)

            // Add nodes to Canvas:
            addNodes(celSel);

            // Remove nodes from Canvas:
            cell = celSel.exit().remove();
        }

        function init(
            element,
            width,
            height,
            jsonObservable,
            selectZoomFunction
        ) {
            if (canvasArea !== undefined) {
                return; // Catch for if sunburst has been setup.
            }
            canvasElement = element;
            json = jsonObservable;
            canvasWidth = width;
            canvasHeight = height;
            radius = Math.min(canvasWidth, canvasHeight) / 2;
            x = d3.scale.linear().range([0, 2 * Math.PI]);
            y = d3.scale.linear().range([0, radius]);//sqrt
            selectZoom = selectZoomFunction;

            // Define temp vars:
            var celSel, nodes;

            // Get sunburst data:
            root = json();

            // This is a new sunburst:
            // Setup sunburst and Canvas:
            sunburstLayout = d3.layout.partition()
                            .value(function (d) { return d.size; })
                            .children(function (d) { return d.children; });

            canvasArea = canvasElement.append("group").each(function () {
                this.originX = "center";
                this.originY = "center";
            });

            // Setup arc function:
            arc = d3.svg.arc()
                .startAngle(function (d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x))); })
                .endAngle(function (d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))); })
                .innerRadius(function (d) { return Math.max(0, y(d.y)); })
                .outerRadius(function (d) { return Math.max(0, y(d.y + d.dy)); });

            // Filter out nodes with children:
            nodes = sunburstLayout.nodes(root);

            // Join data with selection:
            celSel = canvasArea.selectAll("group")
                .data(nodes, function (d) { return d.name; });

            // Add nodes to Canvas:
            addNodes(celSel);

            canvasElement.pumpRender();
        }

        function resize(width, height) {
            canvasWidth = width;
            canvasHeight = height;

            radius = Math.min(canvasWidth, canvasHeight) / 2;
            y.range([0, radius]);
        }

        function remove() {
            if (canvasArea !== undefined) {
                canvasArea.remove();
                //canvasElement.select("group").remove();
                //canvasArea.selectAll("group").remove();
                canvasArea = undefined;
            }
        }

        // Return sunburst object:
        return {
            init: init,
            update: update,
            zoom: zoom,
            resize: resize,
            remove: remove,
            enableRotate: true
        };
    };
});

/*global define*/
define('scalejs.visualization-d3/sunburstCustom',[
    'd3'
], function (
    d3
) {
    

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
        var //Sunburst variables
            visualization,
            canvasElement,
            json,
            selectZoom,
            canvasWidth,
            canvasHeight,
            radius,
            x,
            y,
            root,
            sunburstLayout,
            arc,
            canvasZoom,
            canvasArea,
            currentZoomNode;

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
                opacity = rgba.pop();
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

        function zoomTween(p) {
            return function () {
                // Create interpolations used for clamping all arcs to ranges:
                var interpXD = d3.interpolate(x.domain(), [p.x, p.x + p.dx]),
                    interpYD = d3.interpolate(y.domain(), [p.y, (root.curMaxLevel + 1) / (root.maxlvl + 1)]),
                    interpYR = d3.interpolate(y.range(), [p.y ? p.dy * radius / 2 : 0, radius]);
                return function (t) {
                    // Set clamps for arcs:
                    x.domain(interpXD(t));
                    y.domain(interpYD(t)).range(interpYR(t));
                };
            };
        }
        function groupTween(p, opacity) {
            return function (d) {
                // Create interpolations used for a nice slide:
                var interpX = d3.interpolate(this.left, canvasWidth / 2),
                    interpY = d3.interpolate(this.top, canvasHeight / 2),
                    newColor = parseColor(d.color),
                    interpOpacity = d3.interpolate(this.opacity, opacity * newColor.opacity),
                    element = this;
                return function (t) {
                    element.left = interpX(t);
                    element.top = interpY(t);
                    element.opacity = interpOpacity(t);
                };
            };
        }
        function arcTween() {
            return function (d) {
                // Create interpolations used for a nice slide around the parent:
                var interpX = d3.interpolate(this.old.x, d.x),
                    interpY = d3.interpolate(this.old.y, d.y),
                    interpDX = d3.interpolate(this.old.dx, d.dx),
                    interpDY = d3.interpolate(this.old.dy, d.dy),
                    newColor = parseColor(d.color),
                    interpFill = d3.interpolate(this.fill, newColor.color),
                    interpOpacity = d3.interpolate(this.opacity, newColor.opacity),
                    // Remember this element:
                    element = this;
                return function (t) { // Interpolate arc:
                    // Store new data in the old property:
                    element.old.x = interpX(t);
                    element.old.y = interpY(t);
                    element.old.dx = interpDX(t);
                    element.old.dy = interpDY(t);
                    element.fill = interpFill(t);
                    element.opacity = interpOpacity(t);
                    this.innerRadius = innerRadius(element.old);
                    this.outerRadius = outerRadius(element.old);
                    this.startAngle = startAngle(element.old);
                    this.endAngle = endAngle(element.old);
                };
            };
        }
        function textTween(p) {
            return function (d) {
                // Create interpolations used for a nice slide around the parent:
                var interpX = d3.interpolate(this.old.x, d.x),
                    interpY = d3.interpolate(this.old.y, d.y),
                    interpDX = d3.interpolate(this.old.dx, d.dx),
                    interpDY = d3.interpolate(this.old.dy, d.dy),
                    newColor = parseColor(d.fontColor),
                    interpFill = d3.interpolate(this.fill, newColor.color),
                    interpOpacity,// = d3.interpolate(this.opacity, newColor.opacity),
                    // Remember this element:
                    element = this,
                    // Interpolate attributes:
                    rad, radless, offsety, angle,
                    outerRad, innerRad, arcStartAngle, arcEndAngle, arcWidth;
                if (visualization.allowTextOverflow) {
                    interpOpacity = d3.interpolate(this.opacity, newColor.opacity);
                } else {
                    interpOpacity = d3.interpolate(this.opacity, (d.bw - 4 >= this.width) && ((d.bh - 2 >= this.height) || (root === d && y(d.y) < 1)) ? newColor.opacity : 0);
                }
                return function (t) {
                    // Store new data in the old property:
                    element.old.x = interpX(t);
                    element.old.y = interpY(t);
                    element.old.dx = interpDX(t);
                    element.old.dy = interpDY(t);

                    // Setup variables for opacity:
                    outerRad = outerRadius(element.old);
                    innerRad = innerRadius(element.old);
                    arcStartAngle = startAngle(element.old);
                    arcEndAngle = endAngle(element.old);
                    arcWidth = (arcEndAngle - arcStartAngle) * innerRad;

                    // Calculate color:
                    element.fill = interpFill(t);

                    // Calculate text angle:
                    rad = x(element.old.x + element.old.dx / 2);
                    radless = rad - Math.PI / 2;
                    offsety = y(d.y) + 2;
                    angle = rad * 180 / Math.PI - 90;
                    element.left = offsety * Math.cos(radless);
                    element.top = offsety * Math.sin(radless);
                    if (p !== d) {
                        // Flip text right side up:
                        if (angle > 90) {
                            angle = (angle + 180) % 360;
                        }
                        // Change anchor based on side of Sunburst the text is on:
                        element.originX = rad > Math.PI ? "right" : "left";


                        // Change opacity:
                        if (visualization.allowTextOverflow) {
                            this.opacity = interpOpacity(t);
                        } else {
                            this.opacity = (outerRad - innerRad - 4 >= this.width) && ((arcWidth - 2 >= this.height) || (p === d && innerRad < 1)) ? interpOpacity(t) : 0;
                        }
                    } else {
                        angle -= 90;
                        // Change anchor based on side of Sunburst the text is on:
                        element.originX = "center";
                        element.originY = "top";

                        // Change opacity:
                        if (visualization.allowTextOverflow) {
                            this.opacity = interpOpacity(t);
                        } else {
                            this.opacity = (outerRad - innerRad - 4 >= this.height) && ((arcWidth - 2 >= this.width) || (p === d && innerRad < 1)) ? interpOpacity(t) : 0;
                        }
                    }

                    // Rotate text angle:
                    element.angle = angle;
                };
            };
        }
        // Zoom after click:
        function zoom(p) {
            if (canvasArea === undefined || currentZoomNode === p) {
                return; // Catch for if sunburst hasn't been setup.
            }
            // Set current zoomed node:
            currentZoomNode = p;
            // Animate sunburst nodes:
            update(p);

            // Prevent event from firing more than once:
            if (d3.event) {
                d3.event.stopPropagation();
            }
        }

        function update(p, duration) {
            if (canvasArea === undefined) {
                return; // Catch for if sunburst hasn't been setup.
            }

            // Get transition duration parameter:
            duration = duration !== undefined ? duration : 1000;

            // Get treemap data:
            root = json();

            // Define temp vars:
            var celSel, cell, nodes, groupNodes, newGroupNodes, removeGroupNodes, arcNodes, newArcNodes, removeArcNodes, textNodes, newTextNodes, removeTextNodes,
                zoomTreePath = getNodeTreePath(p);

            // This is a sunburst being updated:
            // Filter out nodes with children:
            nodes = sunburstLayout.nodes(root)
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
                });

            // Add arc to each node:
            newArcNodes = newGroupNodes.append("arc")
                .each(function (d) {
                    this.fill = d.color;
                    this.outerRadius = this.innerRadius = innerRadius(d);
                    //innerRadius(d);//outerRadius(d);
                    this.endAngle = this.startAngle = (endAngle(d) - startAngle(d)) / 2;//startAngle(d);
                    //this.endAngle = endAngle(d);
                    this.old = {
                        x: d.x,
                        y: d.y,
                        dx: d.dx,
                        dy: d.dy
                    };
                })
                .on("mousedown", selectZoom);

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
                    //this.fontSize = 11;
                    this.setText(d.name);
                    d.bw = y(d.y + d.dy) - y(d.y);
                    d.bh = (x(d.x + d.dx) - x(d.x)) * y(d.y);
                    var ang = x(d.x + d.dx / 2) * 180 / Math.PI - 90;
                    if (root !== d) {
                        // Flip text right side up:
                        if (ang > 90) {
                            ang = (ang + 180) % 360;
                        }

                        // Change opacity:
                        if (visualization.allowTextOverflow) {
                            this.opacity = 1;
                        } else {
                            this.opacity = (d.bw - 4 >= this.height) && ((d.bh - 2 >= this.width) || (root === d && y(d.y) < 1)) ? 1 : 0;
                        }
                    } else {
                        ang -= 90;

                        // Change opacity:
                        if (visualization.allowTextOverflow) {
                            this.opacity = 1;
                        } else {
                            this.opacity = (d.bw - 4 >= this.width) && ((d.bh - 2 >= this.height) || (root === d && y(d.y) < 1)) ? 1 : 0;
                        }
                    }
                    this.angle = ang;
                    this.left = (Math.max(y(d.y), 0) + 2) * Math.cos(x(d.x + d.dx / 2) - Math.PI / 2);
                    this.top = (Math.max(y(d.y), 0) + 2) * Math.sin(x(d.x + d.dx / 2) - Math.PI / 2);
                    this.old = {
                        x: d.x,
                        y: d.y,
                        dx: d.dx,
                        dy: d.dy
                    };
                });

            // Add tween to Canvas:
            canvasArea.transition().duration(duration)
                .tween("zoomTween", zoomTween(p));

            // Add tween to new nodes:
            newGroupNodes.transition().duration(duration)
                .tween("groupTween", groupTween(p, 1));
            // Add tween to new arcs:
            newArcNodes.transition().duration(duration)
                .tween("arcTween", arcTween(p));
            // Add tween to new text:
            newTextNodes.transition().duration(duration)
                .tween("textTween", textTween(p));

            // Add tween to current nodes:
            groupNodes.transition().duration(duration)
                .tween("groupTween", groupTween(p, 1));
            // Add tween to current arcs:
            arcNodes = groupNodes.select("arc").transition().duration(duration)
                .tween("arcTween", arcTween(p));
            // Add tween to current text:
            textNodes = groupNodes.select("text").transition().duration(duration)
                .tween("textTween", textTween(p));

            // Remove missing nodes:
            removeGroupNodes = groupNodes.exit().transition().duration(duration)
                .tween("groupTween", groupTween(p, 0))
                .each(function () {
                    this.remove();
                }, "end");
            removeArcNodes = removeGroupNodes.select("arc").tween("arcTween", arcTween(p));
            removeTextNodes = removeGroupNodes.select("text").tween("textTween", textTween(p));
        }

        function init(
            parameters,
            element,
            width,
            height,
            jsonObservable,
            selectZoomFunction,
            nodeSelected
        ) {
            if (canvasArea !== undefined) {
                return; // Catch for if sunburst has been setup.
            }
            canvasElement = element;
            json = jsonObservable;
            canvasWidth = width;
            canvasHeight = height;
            radius = Math.min(canvasWidth, canvasHeight) / 2;
            x = mapValue().range([0, 2 * Math.PI]);//d3.scale.linear().range([0, 2 * Math.PI]);
            y = mapValue().range([0, radius]);//d3.scale.linear().range([0, radius]);//sqrt
            selectZoom = selectZoomFunction;

            // Define temp vars:
            var celSel, nodes,
                zoomTreePath = getNodeTreePath(nodeSelected);

            // Get sunburst data:
            root = json();
            currentZoomNode = nodeSelected;

            // This is a new sunburst:
            // Setup sunburst and Canvas:
            sunburstLayout = d3.layout.partition()
                            .value(function (d) { return d.size; })
                            .children(function (d) { return d.children; });

            canvasZoom = canvasElement.append("group");
            canvasArea = canvasZoom.append("group").each(function () {
                this.fontFamily = "Times New Roman";
                this.fontSize = 11;
                //this.originX = "center";
                //this.originY = "center";
            });

            // Setup arc function:
            arc = d3.svg.arc()
                .startAngle(startAngle)
                .endAngle(endAngle)
                .innerRadius(innerRadius)
                .outerRadius(outerRadius);

            // Filter out nodes with children:
            nodes = sunburstLayout.nodes(root)
                .filter(function (d) {
                    return getDistanceToTreePath(d, zoomTreePath) < root.maxVisibleLevels;
                });

            // Join data with selection:
            celSel = canvasArea.selectAll("group")
                .data(nodes, function (d) { return d.id; });

            // Add nodes to Canvas:
            x.domain([nodeSelected.x, nodeSelected.x + nodeSelected.dx]);
            y.domain([nodeSelected.y, (root.curMaxLevel + 1) / (root.maxlvl + 1)]).range([nodeSelected.y ? nodeSelected.dy * radius / 2 : 0, radius]);
            update(nodeSelected, 0);
            //addNodes(celSel);
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
                //canvasElement.select("group").remove();
                //canvasArea.selectAll("group").remove();
                canvasZoom = undefined;
                canvasArea = undefined;
            }
        }

        // Return sunburst object:
        visualization = {
            init: init,
            update: update,
            zoom: zoom,
            resize: resize,
            remove: remove,
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

/*global define*/
define('scalejs.visualization-d3/voronoi',[
    'd3'
], function (
    d3
) {
    

    return function () {
        var //Voronoi variables
            data = [{ "count": 174, "coords": ["391.885,330.542", "417.410,334.603", "402.827,370.451", "390.266,365.328"], "name": "Public Services" }, { "count": 442, "color": "#DFDD7A", "coords": ["478.269,458.569", "443.424,465.644", "419.340,440.846", "429.357,403.370", "465.808,397.980", "476.719,404.983"], "name": "College/University", "children": [{ "count": 442, "color": "#DFDD7A", "coords": ["457.101,462.867", "443.424,465.644", "419.340,440.846", "424.298,422.298", "441.700,415.308", "451.918,416.594", "467.742,431.129"], "name": "College/University (general)" }, { "count": 168, "coords": ["477.446,430.126", "478.269,458.569", "457.101,462.867", "467.742,431.129"], "name": "Graduate School" }, { "count": 159, "coords": ["477.446,430.126", "467.742,431.129", "451.918,416.594", "458.625,399.042", "465.808,397.980", "476.719,404.983"], "name": "Financial Aid" }, { "count": 29, "coords": ["437.840,402.116", "458.625,399.042", "451.918,416.594", "441.700,415.308"], "name": "UVSC/UVU" }, { "count": 22, "coords": ["424.298,422.298", "429.357,403.370", "437.840,402.116", "441.700,415.308"], "name": "University of Utah" }] }, { "count": 135, "coords": ["254.187,545.597", "239.937,555.697", "219.040,522.646", "237.922,517.638"], "name": "Family History/Genealogy" }, { "count": 19, "coords": ["0.000,338.881", "28.012,342.780", "33.436,355.324", "0.000,374.860"], "name": "Human Rights" }, { "count": 51, "coords": ["466.935,204.335", "464.219,194.778", "475.897,168.726", "513.262,178.585", "508.094,200.279"], "name": "Architecture" }, { "count": 299, "coords": ["180.958,406.709", "152.806,416.431", "141.547,402.486", "170.266,378.235"], "name": "Statistics" }, { "count": 952, "color": "#003A80", "coords": ["264.022,0.000", "420.775,0.000", "445.396,147.850", "430.128,179.696", "409.728,205.539", "368.349,227.792", "331.505,234.468", "271.667,222.711", "239.090,197.881", "215.441,165.841", "205.534,87.744", "218.673,52.874"], "name": "BYU", "children": [{ "count": 2344, "coords": ["427.072,37.815", "436.032,91.621", "408.668,122.885", "383.213,131.995", "349.469,125.059", "330.390,106.917", "319.965,84.093", "319.289,63.748", "337.172,32.739", "344.637,27.109", "390.944,18.537"], "name": "Academics", "children": [{ "count": 2344, "coords": ["430.318,57.307", "397.849,126.757", "383.213,131.995", "349.469,125.059", "330.390,106.917", "319.965,84.093", "319.289,63.748", "337.172,32.739", "344.637,27.109", "390.944,18.537", "427.072,37.815"], "name": "Academics (general)" }, { "count": 223, "coords": ["397.849,126.757", "430.318,57.307", "436.032,91.621", "408.668,122.885"], "name": "Departments" }] }, { "count": 1216, "coords": ["238.039,196.458", "215.441,165.841", "209.197,116.621", "279.619,131.947", "287.246,161.078", "276.646,180.114"], "name": "Student Life" }, { "count": 962, "coords": ["244.605,22.638", "288.501,28.373", "301.372,36.881", "319.289,63.748", "319.965,84.093", "311.362,106.244", "294.410,125.043", "279.619,131.947", "209.197,116.621", "205.534,87.744", "218.673,52.874"], "name": "Campus (physical)", "children": [{ "count": 1100, "coords": ["269.972,25.952", "278.133,131.624", "209.197,116.621", "205.534,87.744", "218.673,52.874", "244.605,22.638"], "name": "Buildings", "children": [{ "count": 1100, "coords": ["273.014,65.333", "278.133,131.624", "209.197,116.621", "205.534,87.744", "217.081,57.099"], "name": "Buildings (general)" }, { "count": 423, "coords": ["273.014,65.333", "217.081,57.099", "218.673,52.874", "244.605,22.638", "269.972,25.952"], "name": "Library" }] }, { "count": 962, "coords": ["269.972,25.952", "288.501,28.373", "301.372,36.881", "319.289,63.748", "319.965,84.093", "311.362,106.244", "294.410,125.043", "279.619,131.947", "278.133,131.624"], "name": "Campus (physical) (general)" }] }, { "count": 952, "color": "#003A80", "coords": ["383.213,131.995", "392.467,145.532", "392.623,177.936", "391.036,180.286", "379.060,190.009", "351.861,193.948", "327.448,175.826", "324.743,157.562", "333.472,136.790", "349.469,125.059"], "name": "BYU (general)" }, { "count": 652, "coords": ["348.849,231.325", "331.505,234.468", "302.920,228.852", "298.290,192.649", "304.987,184.261", "327.448,175.826", "351.861,193.948"], "name": "Athletics" }, { "count": 488, "coords": ["441.798,155.354", "430.128,179.696", "424.961,186.241", "392.623,177.936", "392.467,145.532", "413.607,132.337", "425.997,136.130"], "name": "Activities/Events" }, { "count": 404, "coords": ["392.499,0.000", "390.944,18.537", "344.637,27.109", "341.833,0.000"], "name": "Honor Code" }, { "count": 355, "coords": ["265.549,218.049", "239.090,197.881", "238.039,196.458", "276.646,180.114", "286.581,192.665", "276.284,213.519"], "name": "Culture" }, { "count": 335, "coords": ["391.429,215.380", "368.349,227.792", "348.849,231.325", "351.861,193.948", "379.060,190.009"], "name": "Network/Email" }, { "count": 314, "coords": ["290.513,0.000", "288.501,28.373", "244.605,22.638", "264.022,0.000"], "name": "Admissions" }, { "count": 251, "coords": ["436.032,91.621", "442.196,128.634", "425.997,136.130", "413.607,132.337", "408.668,122.885"], "name": "Clubs" }, { "count": 234, "coords": ["290.513,0.000", "320.150,0.000", "321.425,25.004", "301.372,36.881", "288.501,28.373"], "name": "Dining" }, { "count": 215, "coords": ["302.920,228.852", "281.878,224.718", "276.284,213.519", "286.581,192.665", "298.290,192.649"], "name": "BYU Rumors/Myths" }, { "count": 206, "coords": ["392.499,0.000", "420.775,0.000", "427.072,37.815", "390.944,18.537"], "name": "Policy" }, { "count": 176, "coords": ["291.397,161.386", "287.246,161.078", "279.619,131.947", "294.410,125.043", "304.912,133.037", "305.234,151.747"], "name": "Freshmen" }, { "count": 168, "coords": ["324.743,157.562", "327.448,175.826", "304.987,184.261", "291.397,161.386", "305.234,151.747"], "name": "Devotionals/Forums" }, { "count": 152, "coords": ["337.172,32.739", "319.289,63.748", "301.372,36.881", "321.425,25.004"], "name": "Faculty/Staff" }, { "count": 130, "coords": ["304.912,133.037", "320.509,127.278", "333.472,136.790", "324.743,157.562", "305.234,151.747"], "name": "Graduation" }, { "count": 99, "coords": ["333.472,136.790", "320.509,127.278", "321.630,111.786", "330.390,106.917", "349.469,125.059"], "name": "Bookstore" }, { "count": 92, "coords": ["304.987,184.261", "298.290,192.649", "286.581,192.665", "276.646,180.114", "287.246,161.078", "291.397,161.386"], "name": "BYUSA" }, { "count": 87, "coords": ["404.172,208.527", "391.429,215.380", "379.060,190.009", "391.036,180.286"], "name": "Study Abroad", "children": [{ "count": 87, "coords": ["399.365,211.112", "390.010,212.470", "379.060,190.009", "391.036,180.286", "404.172,208.527"], "name": "Study Abroad (general)" }, { "count": 3, "coords": ["399.365,211.112", "391.429,215.380", "390.010,212.470"], "name": "Travel Study" }] }, { "count": 79, "coords": ["321.630,111.786", "320.509,127.278", "304.912,133.037", "294.410,125.043", "311.362,106.244"], "name": "History" }, { "count": 40, "coords": ["442.196,128.634", "445.396,147.850", "441.798,155.354", "425.997,136.130"], "name": "Financial Aid" }, { "count": 32, "coords": ["383.213,131.995", "408.668,122.885", "413.607,132.337", "392.467,145.532"], "name": "Continuing Education" }, { "count": 31, "coords": ["424.961,186.241", "409.728,205.539", "404.172,208.527", "391.036,180.286", "392.623,177.936"], "name": "Publications", "children": [{ "count": 88, "coords": ["397.607,194.414", "407.803,181.835", "424.961,186.241", "409.728,205.539", "404.172,208.527"], "name": "Daily Universe" }, { "count": 31, "coords": ["407.803,181.835", "397.607,194.414", "391.036,180.286", "392.623,177.936"], "name": "Publications (general)" }] }, { "count": 20, "coords": ["320.150,0.000", "341.833,0.000", "344.637,27.109", "337.172,32.739", "321.425,25.004"], "name": "Alumni" }, { "count": 14, "coords": ["319.965,84.093", "330.390,106.917", "321.630,111.786", "311.362,106.244"], "name": "Advertising" }, { "count": 11, "coords": ["281.878,224.718", "271.667,222.711", "265.549,218.049", "276.284,213.519"], "name": "Salt Lake Center" }] }, { "count": 200, "coords": ["447.186,551.922", "422.410,568.721", "407.588,563.315", "409.045,528.356", "422.028,524.448"], "name": "Restaurants" }, { "count": 142, "coords": ["600.000,570.642", "600.000,600.000", "560.657,600.000", "558.295,577.129", "574.901,563.538"], "name": "Cartoons" }, { "count": 522, "coords": ["39.072,0.000", "0.000,35.089", "0.000,0.000"], "name": "Strange Things People Do" }, { "count": 129, "coords": ["183.037,42.406", "176.150,77.097", "151.579,79.814", "143.605,40.170", "157.101,32.876"], "name": "Military" }, { "count": 23, "color": "#405D80", "coords": ["67.411,362.161", "33.436,355.324", "28.012,342.780", "49.727,309.314", "78.330,315.870"], "name": "Games", "children": [{ "count": 376, "coords": ["71.367,345.387", "45.128,344.639", "34.957,332.077", "49.727,309.314", "78.330,315.870"], "name": "Computer/Video Games" }, { "count": 160, "coords": ["71.367,345.387", "67.411,362.161", "40.954,356.837", "45.128,344.639"], "name": "Board & Card Games" }, { "count": 23, "color": "#405D80", "coords": ["40.954,356.837", "33.436,355.324", "28.012,342.780", "34.957,332.077", "45.128,344.639"], "name": "Games (general)" }] }, { "count": 574, "color": "#003A80", "coords": ["0.000,374.860", "33.436,355.324", "67.411,362.161", "89.051,397.570", "74.291,436.732", "32.409,449.004", "0.000,429.573"], "name": "Utah", "children": [{ "count": 1054, "coords": ["53.800,359.422", "67.411,362.161", "89.051,397.570", "74.291,436.732", "40.360,446.674", "18.563,409.815"], "name": "Provo/Orem Community" }, { "count": 574, "color": "#003A80", "coords": ["0.000,408.030", "0.000,374.860", "33.436,355.324", "53.800,359.422", "18.563,409.815"], "name": "Utah (general)" }, { "count": 22, "coords": ["0.000,408.030", "18.563,409.815", "40.360,446.674", "32.409,449.004", "0.000,429.573"], "name": "University of Utah" }] }, { "count": 88, "coords": ["207.225,315.358", "214.178,274.973", "231.142,274.024", "238.164,312.177"], "name": "Humanitarian Aid/Projects" }, { "count": 489, "coords": ["200.539,177.240", "211.414,217.264", "205.559,221.398", "169.733,218.436", "162.488,185.999"], "name": "Electronics/Technology" }, { "count": 1603, "color": "#008963", "coords": ["139.230,295.562", "166.255,319.932", "176.768,345.653", "170.266,378.235", "141.547,402.486", "103.630,404.456", "89.051,397.570", "67.411,362.161", "78.330,315.870"], "name": "Language & Linguistics", "children": [{ "count": 1603, "color": "#008963", "coords": ["98.478,309.152", "139.230,295.562", "166.255,319.932", "176.768,345.653", "170.266,378.235", "143.679,400.685", "95.759,367.784"], "name": "Language & Linguistics (general)" }, { "count": 384, "coords": ["98.478,309.152", "95.759,367.784", "76.439,376.933", "67.411,362.161", "78.330,315.870"], "name": "English Usage/Grammar" }, { "count": 338, "coords": ["143.679,400.685", "141.547,402.486", "103.630,404.456", "89.051,397.570", "76.439,376.933", "95.759,367.784"], "name": "Etymology" }] }, { "count": 5135, "coords": ["0.000,149.351", "0.000,35.089", "39.072,0.000", "109.950,0.000", "143.605,40.170", "151.579,79.814", "117.111,141.426"], "name": "Comments" }, { "count": 263, "coords": ["156.166,489.182", "134.489,459.318", "151.456,447.247", "159.510,451.182", "171.865,480.587"], "name": "Telephones" }, { "count": 30, "coords": ["215.617,431.486", "194.899,440.709", "195.232,421.208"], "name": "Olympics" }, { "count": 210, "color": "#405D80", "coords": ["600.000,387.286", "600.000,466.078", "555.125,494.075", "516.783,494.394", "478.269,458.569", "476.719,404.983", "503.835,371.807", "549.871,360.489"], "name": "Entertainment", "children": [{ "count": 1833, "coords": ["600.000,428.551", "600.000,466.078", "555.125,494.075", "516.783,494.394", "495.634,474.722", "511.378,419.935", "522.942,411.554"], "name": "Movies" }, { "count": 1195, "coords": ["522.012,367.338", "549.871,360.489", "600.000,387.286", "600.000,428.551", "522.942,411.554"], "name": "Television", "children": [{ "count": 1195, "coords": ["522.307,381.351", "534.092,364.369", "549.871,360.489", "600.000,387.286", "600.000,428.551", "522.942,411.554"], "name": "Television (general)" }, { "count": 27, "coords": ["534.092,364.369", "522.307,381.351", "522.012,367.338"], "name": "Commercials" }] }, { "count": 210, "color": "#405D80", "coords": ["495.634,474.722", "478.269,458.569", "476.834,408.955", "511.378,419.935"], "name": "Entertainment (general)" }, { "count": 174, "coords": ["522.012,367.338", "522.942,411.554", "511.378,419.935", "476.834,408.955", "476.719,404.983", "503.835,371.807"], "name": "Theater" }] }, { "count": 140, "color": "#008963", "coords": ["382.968,600.000", "305.071,600.000", "284.693,547.588", "300.301,505.033", "327.423,485.171", "352.381,481.327", "379.931,490.781", "409.045,528.356", "407.588,563.315"], "name": "Social Science", "children": [{ "count": 968, "coords": ["346.315,600.000", "337.605,541.971", "365.115,523.336", "381.514,524.860", "408.373,544.484", "407.588,563.315", "382.968,600.000"], "name": "Government/Politics", "children": [{ "count": 968, "coords": ["387.713,592.929", "343.174,579.076", "337.605,541.971", "365.115,523.336", "381.514,524.860", "408.373,544.484", "407.588,563.315"], "name": "Government/Politics (general)" }, { "count": 94, "coords": ["387.713,592.929", "382.968,600.000", "346.315,600.000", "343.174,579.076"], "name": "International Relations", "children": [{ "count": 94, "coords": ["366.266,586.258", "362.795,600.000", "346.315,600.000", "343.174,579.076"], "name": "International Relations (general)" }, { "count": 46, "coords": ["369.621,587.302", "387.713,592.929", "382.968,600.000", "368.667,600.000"], "name": "Immigration" }, { "count": 17, "coords": ["366.266,586.258", "369.621,587.302", "368.667,600.000", "362.795,600.000"], "name": "Wars" }] }] }, { "count": 817, "coords": ["346.315,600.000", "305.071,600.000", "284.767,547.778", "330.404,538.168", "337.605,541.971"], "name": "Psychology" }, { "count": 258, "coords": ["341.802,502.937", "360.003,510.129", "365.115,523.336", "337.605,541.971", "330.404,538.168", "327.347,513.037"], "name": "Geography" }, { "count": 140, "color": "#008963", "coords": ["374.335,488.861", "379.931,490.781", "394.509,509.595", "381.514,524.860", "365.115,523.336", "360.003,510.129"], "name": "Social Science (general)" }, { "count": 127, "coords": ["339.149,483.365", "352.381,481.327", "374.335,488.861", "360.003,510.129", "341.802,502.937"], "name": "Economics" }, { "count": 72, "coords": ["408.373,544.484", "381.514,524.860", "394.509,509.595", "409.045,528.356"], "name": "Symbols" }, { "count": 69, "coords": ["307.500,499.761", "327.423,485.171", "339.149,483.365", "341.802,502.937", "327.347,513.037"], "name": "Traditions" }, { "count": 13, "coords": ["284.767,547.778", "284.693,547.588", "300.301,505.033", "307.500,499.761", "327.347,513.037", "330.404,538.168"], "name": "History", "children": [{ "count": 190, "coords": ["318.634,540.646", "284.767,547.778", "284.693,547.588", "296.160,516.323", "317.514,527.562"], "name": "World" }, { "count": 168, "coords": ["328.240,520.383", "317.514,527.562", "296.160,516.323", "300.301,505.033", "307.500,499.761", "327.347,513.037"], "name": "United States" }, { "count": 13, "coords": ["328.240,520.383", "330.404,538.168", "318.634,540.646", "317.514,527.562"], "name": "History (general)" }] }] }, { "count": 1081, "color": "#008963", "coords": ["522.463,266.864", "560.562,294.270", "566.208,327.967", "549.871,360.489", "503.835,371.807", "481.264,360.862", "457.039,322.416", "478.256,277.838"], "name": "Medical/Body", "children": [{ "count": 1081, "color": "#008963", "coords": ["508.547,270.319", "531.773,318.780", "480.583,359.781", "457.039,322.416", "478.256,277.838"], "name": "Medical/Body (general)" }, { "count": 652, "coords": ["556.554,347.186", "549.871,360.489", "503.835,371.807", "481.264,360.862", "480.583,359.781", "531.773,318.780", "533.524,319.180"], "name": "Anatomy/Physiology" }, { "count": 358, "coords": ["508.547,270.319", "522.463,266.864", "560.562,294.270", "561.961,302.617", "533.524,319.180", "531.773,318.780"], "name": "Products" }, { "count": 30, "coords": ["561.961,302.617", "566.208,327.967", "556.554,347.186", "533.524,319.180"], "name": "Research" }] }, { "count": 116, "coords": ["109.950,0.000", "161.185,0.000", "157.101,32.876", "143.605,40.170"], "name": "BYU-I/Rexburg Community" }, { "count": 728, "color": "#008963", "coords": ["558.295,577.129", "519.398,574.361", "497.241,544.413", "516.783,494.394", "555.125,494.075", "584.186,528.267", "574.901,563.538"], "name": "Sports", "children": [{ "count": 728, "color": "#008963", "coords": ["504.402,554.092", "573.882,516.144", "584.186,528.267", "574.901,563.538", "558.295,577.129", "519.398,574.361"], "name": "Sports (general)" }, { "count": 652, "coords": ["573.882,516.144", "504.402,554.092", "497.241,544.413", "516.783,494.394", "555.125,494.075"], "name": "Athletics" }] }, { "count": 209, "color": "#008963", "coords": ["404.508,446.539", "419.340,440.846", "443.424,465.644", "429.246,479.978", "403.694,471.031"], "name": "Advertising", "children": [{ "count": 209, "color": "#008963", "coords": ["404.211,455.464", "422.464,444.062", "443.424,465.644", "429.246,479.978", "403.694,471.031"], "name": "Advertising (general)" }, { "count": 27, "coords": ["422.464,444.062", "404.211,455.464", "404.508,446.539", "419.340,440.846"], "name": "Commercials" }] }, { "count": 150, "coords": ["176.150,77.097", "183.037,42.406", "192.364,38.085", "218.673,52.874", "205.534,87.744"], "name": "Dance" }, { "count": 787, "color": "#405D80", "coords": ["478.256,277.838", "457.039,322.416", "417.410,334.603", "391.885,330.542", "355.146,302.846", "351.524,261.964", "368.349,227.792", "409.728,205.539", "454.265,222.658"], "name": "Music", "children": [{ "count": 787, "color": "#405D80", "coords": ["424.041,211.041", "454.265,222.658", "466.839,251.580", "434.851,276.059", "420.006,273.959", "403.142,259.339", "398.561,237.437", "400.311,232.999"], "name": "Music (general)" }, { "count": 501, "coords": ["352.500,272.988", "351.524,261.964", "368.349,227.792", "369.070,227.404", "398.561,237.437", "403.142,259.339", "396.553,271.664", "384.439,279.508"], "name": "Bands/Artists" }, { "count": 382, "coords": ["465.934,303.726", "442.110,295.450", "434.851,276.059", "466.839,251.580", "478.256,277.838"], "name": "Audio/Radio" }, { "count": 285, "coords": ["374.173,317.190", "355.146,302.846", "352.500,272.988", "384.439,279.508", "389.296,297.418"], "name": "Lyrics" }, { "count": 282, "coords": ["410.819,333.554", "391.885,330.542", "374.173,317.190", "389.296,297.418", "406.922,297.028", "418.165,310.026"], "name": "Soundtracks" }, { "count": 245, "coords": ["429.570,310.144", "418.165,310.026", "406.922,297.028", "410.651,281.414", "420.006,273.959", "434.851,276.059", "442.110,295.450"], "name": "LDS Music" }, { "count": 195, "coords": ["465.934,303.726", "457.039,322.416", "438.376,328.155", "429.570,310.144", "442.110,295.450"], "name": "Instruments" }, { "count": 130, "coords": ["424.041,211.041", "400.311,232.999", "391.175,215.516", "409.728,205.539"], "name": "Downloads" }, { "count": 122, "coords": ["410.651,281.414", "406.922,297.028", "389.296,297.418", "384.439,279.508", "396.553,271.664"], "name": "Sheet Music" }, { "count": 100, "coords": ["438.376,328.155", "417.410,334.603", "410.819,333.554", "418.165,310.026", "429.570,310.144"], "name": "Vocal" }, { "count": 52, "coords": ["403.142,259.339", "420.006,273.959", "410.651,281.414", "396.553,271.664"], "name": "Videos" }, { "count": 45, "coords": ["369.070,227.404", "391.175,215.516", "400.311,232.999", "398.561,237.437"], "name": "Classical" }] }, { "count": 447, "coords": ["600.000,466.078", "600.000,526.415", "584.186,528.267", "555.125,494.075"], "name": "Etiquette" }, { "count": 371, "coords": ["352.381,481.327", "327.423,485.171", "312.224,463.585", "320.654,440.967", "349.484,438.127", "351.272,439.316"], "name": "Business" }, { "count": 71, "coords": ["362.601,398.350", "378.732,409.937", "379.127,429.513", "351.272,439.316", "349.484,438.127", "345.854,411.932"], "name": "Appliances" }, { "count": 15, "coords": ["464.219,194.778", "466.935,204.335", "454.265,222.658", "409.728,205.539", "430.128,179.696"], "name": "Mechanics" }, { "count": 305, "coords": ["312.224,463.585", "327.423,485.171", "300.301,505.033", "274.770,479.510"], "name": "Quotes/Speeches" }, { "count": 320, "color": "#003A80", "coords": ["290.298,387.892", "283.411,406.097", "247.950,434.397", "215.617,431.486", "195.232,421.208", "180.958,406.709", "170.266,378.235", "176.768,345.653", "202.597,318.119", "207.225,315.358", "238.164,312.177", "286.220,345.382"], "name": "Computers", "children": [{ "count": 1269, "coords": ["248.017,318.985", "261.172,351.204", "261.464,355.467", "251.200,381.098", "219.224,393.305", "190.860,379.576", "175.821,350.398", "176.768,345.653", "202.597,318.119", "207.225,315.358", "238.164,312.177"], "name": "Internet (general)" }, { "count": 534, "coords": ["273.063,414.355", "247.950,434.397", "226.622,432.477", "215.974,409.688", "219.224,393.305", "251.200,381.098", "251.822,381.387"], "name": "Software" }, { "count": 320, "color": "#003A80", "coords": ["198.150,422.679", "195.232,421.208", "180.958,406.709", "174.926,390.643", "190.860,379.576", "219.224,393.305", "215.974,409.688"], "name": "Computers (general)" }, { "count": 278, "coords": ["289.009,374.457", "290.298,387.892", "283.411,406.097", "273.063,414.355", "251.822,381.387", "270.282,370.576"], "name": "Hardware" }, { "count": 116, "coords": ["248.017,318.985", "275.315,337.847", "261.172,351.204"], "name": "Programming" }, { "count": 89, "coords": ["174.926,390.643", "170.266,378.235", "175.821,350.398", "190.860,379.576"], "name": "Music" }, { "count": 84, "coords": ["226.622,432.477", "215.617,431.486", "198.150,422.679", "215.974,409.688"], "name": "Browsers" }, { "count": 32, "coords": ["275.315,337.847", "286.220,345.382", "286.656,349.925", "266.241,358.297", "261.464,355.467", "261.172,351.204"], "name": "Networking" }, { "count": 21, "coords": ["266.241,358.297", "270.282,370.576", "251.822,381.387", "251.200,381.098", "261.464,355.467"], "name": "Computer Science" }, { "count": 4, "coords": ["286.656,349.925", "289.009,374.457", "270.282,370.576", "266.241,358.297"], "name": "Operating Systems", "children": [{ "count": 43, "coords": ["273.619,355.271", "286.656,349.925", "288.147,365.469", "284.574,367.117", "276.464,366.110", "275.583,365.311"], "name": "Mac or PC" }, { "count": 19, "coords": ["273.619,355.271", "275.583,365.311", "269.148,367.131", "266.241,358.297"], "name": "Mac" }, { "count": 12, "coords": ["283.858,373.389", "275.573,371.672", "276.464,366.110", "284.574,367.117"], "name": "Windows" }, { "count": 5, "coords": ["269.148,367.131", "275.583,365.311", "276.464,366.110", "275.573,371.672", "270.282,370.576"], "name": "Linux" }, { "count": 4, "coords": ["288.147,365.469", "289.009,374.457", "283.858,373.389", "284.574,367.117"], "name": "Operating Systems (general)" }] }] }, { "count": 1719, "coords": ["139.234,600.000", "163.994,526.165", "197.572,515.642", "219.040,522.646", "239.937,555.697", "232.316,600.000"], "name": "Random" }, { "count": 323, "coords": ["246.803,241.952", "219.557,216.966", "239.090,197.881", "271.667,222.711"], "name": "Trivia/Riddles" }, { "count": 225, "coords": ["445.396,147.850", "475.897,168.726", "464.219,194.778", "430.128,179.696"], "name": "Philosophy" }, { "count": 817, "coords": ["305.071,600.000", "232.316,600.000", "239.937,555.697", "254.187,545.597", "284.693,547.588"], "name": "Products" }, { "count": 117, "coords": ["600.000,244.061", "600.000,290.681", "568.810,287.561", "569.027,256.126"], "name": "News Media" }, { "count": 385, "coords": ["176.216,480.370", "197.572,515.642", "163.994,526.165", "156.166,489.182", "171.865,480.587"], "name": "Questions about Girls" }, { "count": 858, "color": "#405D80", "coords": ["139.234,600.000", "0.000,600.000", "0.000,478.820", "32.409,449.004", "74.291,436.732", "95.770,439.440", "134.489,459.318", "156.166,489.182", "163.994,526.165"], "name": "Relationships", "children": [{ "count": 1626, "coords": ["39.142,447.031", "74.291,436.732", "95.770,439.440", "120.926,452.355", "127.160,488.935", "122.612,504.757", "95.020,528.252", "48.631,517.900", "32.857,492.840"], "name": "Dating", "children": [{ "count": 1626, "coords": ["117.893,450.798", "114.003,512.088", "95.020,528.252", "48.631,517.900", "32.857,492.840", "39.142,447.031", "74.291,436.732", "95.770,439.440"], "name": "Dating (general)" }, { "count": 120, "coords": ["117.893,450.798", "120.926,452.355", "127.160,488.935", "122.612,504.757", "114.003,512.088"], "name": "Dating Ideas" }] }, { "count": 858, "color": "#405D80", "coords": ["162.777,520.416", "163.994,526.165", "149.808,568.466", "107.258,565.528", "97.628,555.501", "95.020,528.252", "122.612,504.757"], "name": "Relationships (general)" }, { "count": 659, "coords": ["0.000,556.261", "34.959,549.026", "56.857,574.988", "54.946,600.000", "0.000,600.000"], "name": "Marriage" }, { "count": 539, "coords": ["106.523,600.000", "54.946,600.000", "56.857,574.988", "97.628,555.501", "107.258,565.528"], "name": "Friends" }, { "count": 365, "coords": ["48.631,517.900", "95.020,528.252", "97.628,555.501", "56.857,574.988", "34.959,549.026", "40.181,525.660"], "name": "Family", "children": [{ "count": 365, "coords": ["60.922,573.045", "64.970,521.546", "95.020,528.252", "97.628,555.501"], "name": "Family (general)" }, { "count": 320, "coords": ["64.970,521.546", "60.922,573.045", "56.857,574.988", "34.959,549.026", "40.181,525.660", "48.631,517.900"], "name": "Parenting" }] }, { "count": 358, "coords": ["0.000,556.261", "0.000,515.600", "20.030,511.711", "40.181,525.660", "34.959,549.026"], "name": "Affection" }, { "count": 336, "coords": ["106.523,600.000", "107.258,565.528", "149.808,568.466", "139.234,600.000"], "name": "Wedding Prep." }, { "count": 268, "coords": ["0.000,481.505", "0.000,478.820", "32.409,449.004", "39.142,447.031", "32.857,492.840", "27.755,494.350"], "name": "Roommates" }, { "count": 228, "coords": ["162.777,520.416", "122.612,504.757", "127.160,488.935", "149.522,480.030", "156.166,489.182"], "name": "Breaking Up" }, { "count": 101, "coords": ["120.926,452.355", "134.489,459.318", "149.522,480.030", "127.160,488.935"], "name": "Long Distance", "children": [{ "count": 101, "coords": ["130.491,487.608", "127.160,488.935", "120.926,452.355", "134.489,459.318", "144.388,472.957"], "name": "Long Distance (general)" }, { "count": 20, "coords": ["130.491,487.608", "144.388,472.957", "149.522,480.030"], "name": "Long Distance Relationships with Missionaries" }] }, { "count": 59, "coords": ["20.030,511.711", "27.755,494.350", "32.857,492.840", "48.631,517.900", "40.181,525.660"], "name": "Singles" }, { "count": 53, "coords": ["0.000,515.600", "0.000,481.505", "27.755,494.350", "20.030,511.711"], "name": "Chastity" }] }, { "count": 538, "color": "#003A80", "coords": ["134.489,459.318", "95.770,439.440", "103.630,404.456", "141.547,402.486", "152.806,416.431", "151.456,447.247"], "name": "Money/Finance", "children": [{ "count": 538, "color": "#003A80", "coords": ["152.409,425.492", "118.902,451.316", "95.770,439.440", "103.630,404.456", "141.547,402.486", "152.806,416.431"], "name": "Money/Finance (general)" }, { "count": 143, "coords": ["118.902,451.316", "152.409,425.492", "151.456,447.247", "134.489,459.318"], "name": "Insurance" }] }, { "count": 902, "coords": ["270.520,478.623", "247.950,434.397", "283.411,406.097", "311.754,419.503", "320.654,440.967", "312.224,463.585", "274.770,479.510"], "name": "Employment" }, { "count": 101, "coords": ["283.411,406.097", "290.298,387.892", "322.007,391.152", "324.637,404.053", "311.754,419.503"], "name": "History of" }, { "count": 451, "coords": ["152.806,416.431", "180.958,406.709", "195.232,421.208", "194.899,440.709", "184.480,451.992", "159.510,451.182", "151.456,447.247"], "name": "Questions about Guys" }, { "count": 234, "coords": ["512.775,600.000", "519.398,574.361", "558.295,577.129", "560.657,600.000"], "name": "How Stuff Works" }, { "count": 5, "coords": ["200.539,177.240", "215.441,165.841", "239.090,197.881", "219.557,216.966", "211.414,217.264"], "name": "General Reference" }, { "count": 115, "coords": ["465.808,397.980", "481.264,360.862", "503.835,371.807", "476.719,404.983"], "name": "Mail" }, { "count": 36, "color": "#DFDD7A", "coords": ["351.524,261.964", "331.505,234.468", "368.349,227.792"], "name": "Education", "children": [{ "count": 150, "coords": ["358.166,248.474", "341.709,248.483", "331.505,234.468", "368.349,227.792"], "name": "Teaching" }, { "count": 36, "color": "#DFDD7A", "coords": ["358.166,248.474", "351.524,261.964", "341.709,248.483"], "name": "Education (general)" }] }, { "count": 73, "coords": ["600.000,526.415", "600.000,570.642", "574.901,563.538", "584.186,528.267"], "name": "High School" }, { "count": 350, "coords": ["568.810,287.561", "560.562,294.270", "522.463,266.864", "531.890,249.878", "569.027,256.126"], "name": "House and Home" }, { "count": 503, "coords": ["600.000,329.010", "600.000,387.286", "549.871,360.489", "566.208,327.967"], "name": "Religion" }, { "count": 20, "coords": ["176.768,345.653", "166.255,319.932", "202.597,318.119"], "name": "BYU-H" }, { "count": 766, "color": "#003A80", "coords": ["360.566,385.405", "333.970,376.812", "318.771,339.527", "355.146,302.846", "391.885,330.542", "390.266,365.328"], "name": "Legal (law)", "children": [{ "count": 766, "color": "#003A80", "coords": ["388.118,366.780", "360.566,385.405", "333.970,376.812", "318.771,339.527", "332.805,325.375", "373.849,331.558"], "name": "Legal (law) (general)" }, { "count": 242, "coords": ["332.805,325.375", "355.146,302.846", "381.231,322.511", "373.849,331.558"], "name": "Law Enforcement" }, { "count": 46, "coords": ["388.118,366.780", "373.849,331.558", "381.231,322.511", "391.885,330.542", "390.266,365.328"], "name": "Immigration" }] }, { "count": 210, "color": "#003A80", "coords": ["382.968,600.000", "407.588,563.315", "422.410,568.721", "428.988,600.000"], "name": "Environment/Nature", "children": [{ "count": 210, "color": "#003A80", "coords": ["392.714,600.000", "388.317,592.030", "407.588,563.315", "422.410,568.721", "428.988,600.000"], "name": "Environment/Nature (general)" }, { "count": 8, "coords": ["392.714,600.000", "382.968,600.000", "388.317,592.030"], "name": "Recycling" }] }, { "count": 1049, "color": "#003A80", "coords": ["0.000,274.951", "0.000,149.351", "117.111,141.426", "162.488,185.999", "169.733,218.436", "165.252,254.816", "139.230,295.562", "78.330,315.870", "49.727,309.314"], "name": "Board", "children": [{ "count": 3317, "coords": ["128.275,152.392", "162.488,185.999", "169.733,218.436", "165.252,254.816", "139.230,295.562", "111.481,304.815", "59.496,283.284", "31.900,225.409", "37.120,198.413", "64.089,164.017"], "name": "Writers", "children": [{ "count": 3317, "coords": ["165.371,253.848", "53.886,271.519", "31.900,225.409", "37.120,198.413", "64.089,164.017", "128.275,152.392", "162.488,185.999", "169.733,218.436"], "name": "Writers (general)" }, { "count": 825, "coords": ["165.371,253.848", "165.252,254.816", "139.230,295.562", "111.481,304.815", "59.496,283.284", "53.886,271.519"], "name": "What's your favorite" }] }, { "count": 1049, "color": "#003A80", "coords": ["42.153,304.080", "0.000,274.951", "0.000,231.857", "31.900,225.409", "59.496,283.284"], "name": "Board (general)" }, { "count": 688, "coords": ["0.000,185.983", "0.000,149.351", "58.715,145.378", "64.089,164.017", "37.120,198.413"], "name": "System" }, { "count": 244, "coords": ["0.000,231.857", "0.000,185.983", "37.120,198.413", "31.900,225.409"], "name": "Readers" }, { "count": 211, "coords": ["58.715,145.378", "117.111,141.426", "128.275,152.392", "64.089,164.017"], "name": "Trivia" }, { "count": 87, "coords": ["42.153,304.080", "59.496,283.284", "111.481,304.815", "78.330,315.870", "49.727,309.314"], "name": "Policy" }] }, { "count": 344, "coords": ["196.074,257.509", "165.252,254.816", "169.733,218.436", "205.559,221.398"], "name": "Ethics" }, { "count": 32, "coords": ["324.637,404.053", "322.007,391.152", "333.970,376.812", "360.566,385.405", "362.601,398.350", "345.854,411.932"], "name": "Patriotism" }, { "count": 766, "color": "#008963", "coords": ["192.955,0.000", "264.022,0.000", "218.673,52.874", "192.364,38.085"], "name": "Animals", "children": [{ "count": 766, "color": "#008963", "coords": ["213.934,50.210", "192.364,38.085", "192.955,0.000", "240.843,0.000", "248.941,17.583", "221.095,50.050"], "name": "Animals (general)" }, { "count": 22, "coords": ["213.934,50.210", "221.095,50.050", "218.673,52.874"], "name": "Dogs" }, { "count": 13, "coords": ["240.843,0.000", "264.022,0.000", "248.941,17.583"], "name": "Cats" }] }, { "count": 1134, "coords": ["531.890,249.878", "522.463,266.864", "478.256,277.838", "454.265,222.658", "466.935,204.335", "508.094,200.279"], "name": "Hypotheticals" }, { "count": 726, "coords": ["300.301,505.033", "284.693,547.588", "254.187,545.597", "237.922,517.638", "270.520,478.623", "274.770,479.510"], "name": "Housing" }, { "count": 150, "coords": ["159.510,451.182", "184.480,451.992", "176.216,480.370", "171.865,480.587"], "name": "Current Events" }, { "count": 676, "coords": ["512.775,600.000", "462.183,600.000", "459.306,555.867", "497.241,544.413", "519.398,574.361"], "name": "Famous People" }, { "count": 41, "coords": ["0.000,478.820", "0.000,429.573", "32.409,449.004"], "name": "Emergency Preparedness" }, { "count": 157, "coords": ["89.051,397.570", "103.630,404.456", "95.770,439.440", "74.291,436.732"], "name": "Safety" }, { "count": 519, "color": "#008963", "coords": ["420.775,0.000", "600.000,0.000", "600.000,147.954", "513.262,178.585", "475.897,168.726", "445.396,147.850"], "name": "LDS", "children": [{ "count": 1691, "coords": ["535.632,0.000", "600.000,0.000", "600.000,70.875", "561.172,87.549", "522.405,71.968", "515.965,64.443", "519.420,19.419"], "name": "Doctrine", "children": [{ "count": 1691, "coords": ["517.899,39.248", "519.420,19.419", "535.632,0.000", "600.000,0.000", "600.000,70.875", "561.172,87.549", "547.258,81.956"], "name": "Doctrine (general)" }, { "count": 137, "coords": ["517.899,39.248", "547.258,81.956", "522.405,71.968", "515.965,64.443"], "name": "Word of Wisdom" }] }, { "count": 1116, "coords": ["472.995,0.000", "502.266,0.000", "519.420,19.419", "515.965,64.443", "482.006,71.556", "462.346,63.224", "450.346,29.002", "454.406,18.629"], "name": "Missionaries" }, { "count": 861, "coords": ["561.672,161.489", "519.739,176.298", "500.731,156.564", "500.505,123.281", "520.095,111.280", "544.838,115.834", "556.831,127.748"], "name": "Culture" }, { "count": 665, "coords": ["515.965,64.443", "522.405,71.968", "520.095,111.280", "500.505,123.281", "480.952,115.945", "470.897,91.019", "482.006,71.556"], "name": "Scriptures" }, { "count": 519, "color": "#008963", "coords": ["455.711,154.910", "460.096,129.438", "480.952,115.945", "500.505,123.281", "500.731,156.564", "483.972,170.857", "475.897,168.726"], "name": "LDS (general)" }, { "count": 449, "coords": ["600.000,117.098", "600.000,147.954", "561.672,161.489", "556.831,127.748", "572.998,113.725"], "name": "Temples" }, { "count": 400, "coords": ["600.000,70.875", "600.000,117.098", "572.998,113.725", "561.081,96.536", "561.172,87.549"], "name": "Policy" }, { "count": 391, "coords": ["544.838,115.834", "520.095,111.280", "522.405,71.968", "561.172,87.549", "561.081,96.536"], "name": "Prophets & General Authorities" }, { "count": 341, "coords": ["432.512,70.478", "426.330,33.354", "450.346,29.002", "462.346,63.224", "459.115,66.475"], "name": "Church History" }, { "count": 341, "coords": ["441.547,124.739", "437.280,99.113", "464.748,88.979", "470.897,91.019", "480.952,115.945", "460.096,129.438"], "name": "LDS Rumors/Myths" }, { "count": 245, "coords": ["446.027,0.000", "454.406,18.629", "450.346,29.002", "426.330,33.354", "420.775,0.000"], "name": "LDS Music" }, { "count": 206, "coords": ["432.512,70.478", "459.115,66.475", "464.748,88.979", "437.280,99.113"], "name": "General Conference" }, { "count": 145, "coords": ["572.998,113.725", "556.831,127.748", "544.838,115.834", "561.081,96.536"], "name": "LDS Literature" }, { "count": 71, "coords": ["441.547,124.739", "460.096,129.438", "455.711,154.910", "445.396,147.850"], "name": "Pornography" }, { "count": 53, "coords": ["502.266,0.000", "535.632,0.000", "519.420,19.419"], "name": "Seminary/Institute" }, { "count": 48, "coords": ["470.897,91.019", "464.748,88.979", "459.115,66.475", "462.346,63.224", "482.006,71.556"], "name": "EFY" }, { "count": 20, "coords": ["519.739,176.298", "513.262,178.585", "483.972,170.857", "500.731,156.564"], "name": "Long Distance Relationships with Missionaries" }, { "count": 19, "coords": ["446.027,0.000", "472.995,0.000", "454.406,18.629"], "name": "International" }] }, { "count": 325, "color": "#003A80", "coords": ["211.414,217.264", "219.557,216.966", "246.803,241.952", "231.142,274.024", "214.178,274.973", "196.074,257.509", "205.559,221.398"], "name": "Art", "children": [{ "count": 325, "color": "#003A80", "coords": ["199.622,243.999", "242.560,238.062", "246.803,241.952", "231.142,274.024", "214.178,274.973", "196.074,257.509"], "name": "Art (general)" }, { "count": 176, "coords": ["242.560,238.062", "199.622,243.999", "205.559,221.398", "211.414,217.264", "219.557,216.966"], "name": "Photography" }] }, { "count": 16, "coords": ["600.000,290.681", "600.000,329.010", "566.208,327.967", "560.562,294.270", "568.810,287.561"], "name": "Periodicals" }, { "count": 257, "color": "#405D80", "coords": ["378.732,409.937", "410.772,390.355", "429.357,403.370", "419.340,440.846", "404.508,446.539", "379.127,429.513"], "name": "Travel", "children": [{ "count": 257, "color": "#405D80", "coords": ["382.778,407.464", "410.772,390.355", "429.357,403.370", "421.510,432.731"], "name": "Travel (general)" }, { "count": 226, "coords": ["382.778,407.464", "421.510,432.731", "419.340,440.846", "404.508,446.539", "379.127,429.513", "378.732,409.937"], "name": "International" }] }, { "count": 10, "color": "#DFDD7A", "coords": ["409.045,528.356", "379.931,490.781", "403.694,471.031", "429.246,479.978", "422.028,524.448"], "name": "World", "children": [{ "count": 271, "coords": ["389.289,483.004", "403.694,471.031", "429.246,479.978", "426.680,495.790", "411.154,505.128", "396.245,504.949"], "name": "Country Info" }, { "count": 127, "coords": ["422.561,521.166", "422.028,524.448", "409.045,528.356", "393.190,507.893", "396.245,504.949", "411.154,505.128"], "name": "Random" }, { "count": 63, "coords": ["426.680,495.790", "422.561,521.166", "411.154,505.128"], "name": "Customs" }, { "count": 10, "color": "#DFDD7A", "coords": ["393.190,507.893", "379.931,490.781", "389.289,483.004", "396.245,504.949"], "name": "World (general)" }] }, { "count": 198, "coords": ["349.484,438.127", "320.654,440.967", "311.754,419.503", "324.637,404.053", "345.854,411.932"], "name": "Comedy" }, { "count": 715, "color": "#008963", "coords": ["219.040,522.646", "197.572,515.642", "176.216,480.370", "184.480,451.992", "194.899,440.709", "215.617,431.486", "247.950,434.397", "270.520,478.623", "237.922,517.638"], "name": "Fashion/Style", "children": [{ "count": 843, "coords": ["253.913,498.499", "183.622,454.941", "184.480,451.992", "194.899,440.709", "215.617,431.486", "247.950,434.397", "270.520,478.623"], "name": "Clothing" }, { "count": 715, "color": "#008963", "coords": ["253.913,498.499", "237.922,517.638", "219.040,522.646", "197.572,515.642", "176.216,480.370", "183.622,454.941"], "name": "Fashion/Style (general)" }] }, { "count": 351, "color": "#008963", "coords": ["462.183,600.000", "428.988,600.000", "422.410,568.721", "447.186,551.922", "459.306,555.867"], "name": "Writing/Publishing", "children": [{ "count": 351, "color": "#008963", "coords": ["450.648,553.049", "459.437,557.876", "462.183,600.000", "428.988,600.000", "422.410,568.721", "447.186,551.922"], "name": "Writing/Publishing (general)" }, { "count": 2, "coords": ["450.648,553.049", "459.306,555.867", "459.437,557.876"], "name": "Typography" }] }, { "count": 901, "color": "#003A80", "coords": ["600.000,147.954", "600.000,244.061", "569.027,256.126", "531.890,249.878", "508.094,200.279", "513.262,178.585"], "name": "Science", "children": [{ "count": 901, "color": "#003A80", "coords": ["600.000,175.446", "600.000,211.398", "571.998,223.049", "551.726,219.348", "539.475,188.863", "549.033,165.953", "569.095,158.868", "589.822,167.062"], "name": "Science (general)" }, { "count": 248, "coords": ["600.000,211.398", "600.000,244.061", "580.163,251.789", "571.998,223.049"], "name": "Mathematics" }, { "count": 223, "coords": ["521.982,229.226", "508.094,200.279", "508.915,196.832", "532.614,187.125", "539.475,188.863", "551.726,219.348", "550.460,220.686"], "name": "Biology", "children": [{ "count": 223, "coords": ["513.924,212.431", "542.226,195.708", "551.726,219.348", "550.460,220.686", "521.982,229.226"], "name": "Biology (general)" }, { "count": 139, "coords": ["542.226,195.708", "513.924,212.431", "508.094,200.279", "508.915,196.832", "532.614,187.125", "539.475,188.863"], "name": "Botany" }] }, { "count": 193, "coords": ["547.371,252.483", "531.890,249.878", "521.982,229.226", "550.460,220.686"], "name": "Meteorology/Climatology" }, { "count": 140, "coords": ["580.163,251.789", "569.027,256.126", "547.371,252.483", "550.460,220.686", "551.726,219.348", "571.998,223.049"], "name": "Physics", "children": [{ "count": 145, "coords": ["575.854,236.622", "548.282,243.101", "550.460,220.686", "551.726,219.348", "571.998,223.049"], "name": "Astronomy" }, { "count": 140, "coords": ["575.854,236.622", "580.163,251.789", "569.027,256.126", "547.371,252.483", "548.282,243.101"], "name": "Physics (general)" }] }, { "count": 86, "coords": ["526.798,173.805", "532.614,187.125", "508.915,196.832", "513.262,178.585"], "name": "Agriculture" }, { "count": 59, "coords": ["593.267,150.331", "589.822,167.062", "569.095,158.868"], "name": "Ecology" }, { "count": 41, "coords": ["549.033,165.953", "539.475,188.863", "532.614,187.125", "526.798,173.805"], "name": "Geology" }, { "count": 21, "coords": ["593.267,150.331", "600.000,147.954", "600.000,175.446", "589.822,167.062"], "name": "Computer Science" }] }, { "count": 483, "color": "#003A80", "coords": ["404.508,446.539", "403.694,471.031", "379.931,490.781", "352.381,481.327", "351.272,439.316", "379.127,429.513"], "name": "Holidays", "children": [{ "count": 483, "color": "#003A80", "coords": ["366.679,433.894", "379.127,429.513", "404.508,446.539", "403.694,471.031", "391.070,481.523", "367.583,477.869", "361.682,472.262", "355.560,454.202"], "name": "Holidays (general)" }, { "count": 69, "coords": ["391.070,481.523", "379.931,490.781", "365.211,485.730", "367.583,477.869"], "name": "Traditions" }, { "count": 44, "coords": ["352.226,475.448", "351.658,453.942", "355.560,454.202", "361.682,472.262"], "name": "Christmas" }, { "count": 34, "coords": ["366.679,433.894", "355.560,454.202", "351.658,453.942", "351.272,439.316"], "name": "Presents" }, { "count": 8, "coords": ["365.211,485.730", "352.381,481.327", "352.226,475.448", "361.682,472.262", "367.583,477.869"], "name": "Birthdays" }] }, { "count": 347, "color": "#003A80", "coords": ["402.827,370.451", "417.410,334.603", "457.039,322.416", "481.264,360.862", "465.808,397.980", "429.357,403.370", "410.772,390.355"], "name": "Transportation", "children": [{ "count": 583, "coords": ["410.108,352.554", "447.153,353.010", "458.283,399.093", "429.357,403.370", "410.772,390.355", "402.827,370.451"], "name": "Automobiles" }, { "count": 347, "color": "#003A80", "coords": ["471.524,345.404", "481.264,360.862", "465.808,397.980", "458.283,399.093", "447.153,353.010", "448.465,351.399"], "name": "Transportation (general)" }, { "count": 181, "coords": ["410.108,352.554", "417.410,334.603", "443.574,326.557", "448.465,351.399", "447.153,353.010"], "name": "Airlines/Aircraft" }, { "count": 35, "coords": ["443.574,326.557", "457.039,322.416", "471.524,345.404", "448.465,351.399"], "name": "Bicycles" }] }, { "count": 105, "color": "#405D80", "coords": ["166.255,319.932", "139.230,295.562", "165.252,254.816", "196.074,257.509", "214.178,274.973", "207.225,315.358", "202.597,318.119"], "name": "Folklore", "children": [{ "count": 341, "coords": ["172.634,319.614", "166.255,319.932", "139.230,295.562", "153.345,273.460", "172.635,277.173", "182.337,293.320"], "name": "LDS Rumors/Myths" }, { "count": 319, "coords": ["181.719,256.255", "196.074,257.509", "214.178,274.973", "210.915,293.927", "182.337,293.320", "172.635,277.173"], "name": "Rumors/Myths" }, { "count": 215, "coords": ["172.634,319.614", "182.337,293.320", "210.915,293.927", "207.225,315.358", "202.597,318.119"], "name": "BYU Rumors/Myths" }, { "count": 105, "color": "#405D80", "coords": ["153.345,273.460", "165.252,254.816", "181.719,256.255", "172.635,277.173"], "name": "Folklore (general)" }] }, { "count": 332, "coords": ["402.827,370.451", "410.772,390.355", "378.732,409.937", "362.601,398.350", "360.566,385.405", "390.266,365.328"], "name": "United States" }, { "count": 1007, "color": "#008963", "coords": ["117.111,141.426", "151.579,79.814", "176.150,77.097", "205.534,87.744", "215.441,165.841", "200.539,177.240", "162.488,185.999"], "name": "Health", "children": [{ "count": 1007, "color": "#008963", "coords": ["139.869,100.746", "166.777,104.656", "189.011,131.955", "182.286,153.135", "149.525,173.266", "117.111,141.426"], "name": "Health (general)" }, { "count": 483, "coords": ["179.825,78.429", "205.534,87.744", "210.536,127.172", "189.011,131.955", "166.777,104.656"], "name": "Wellness/Exercise" }, { "count": 333, "coords": ["210.536,127.172", "215.441,165.841", "202.092,176.052", "182.286,153.135", "189.011,131.955"], "name": "Hygiene" }, { "count": 281, "coords": ["149.525,173.266", "182.286,153.135", "202.092,176.052", "200.539,177.240", "162.488,185.999"], "name": "Diets" }, { "count": 204, "coords": ["139.869,100.746", "151.579,79.814", "176.150,77.097", "179.825,78.429", "166.777,104.656"], "name": "Pregnancy" }] }, { "count": 732, "color": "#003A80", "coords": ["459.306,555.867", "447.186,551.922", "422.028,524.448", "429.246,479.978", "443.424,465.644", "478.269,458.569", "516.783,494.394", "497.241,544.413"], "name": "Literature", "children": [{ "count": 732, "color": "#003A80", "coords": ["427.442,491.096", "429.246,479.978", "443.424,465.644", "478.269,458.569", "493.382,472.627", "487.793,505.355", "464.451,518.480", "450.933,515.680"], "name": "Literature (general)" }, { "count": 243, "coords": ["431.423,534.708", "450.933,515.680", "464.451,518.480", "470.161,530.884", "466.282,544.131", "450.225,552.911", "447.186,551.922"], "name": "Harry Potter" }, { "count": 188, "coords": ["431.423,534.708", "422.028,524.448", "427.442,491.096", "450.933,515.680"], "name": "Children's" }, { "count": 167, "coords": ["511.756,507.262", "489.660,506.742", "487.793,505.355", "493.382,472.627", "516.783,494.394"], "name": "Classics" }, { "count": 145, "coords": ["494.885,525.230", "486.698,533.355", "470.161,530.884", "464.451,518.480", "487.793,505.355", "489.660,506.742"], "name": "LDS Literature" }, { "count": 95, "coords": ["491.477,546.153", "471.156,552.289", "466.282,544.131", "470.161,530.884", "486.698,533.355"], "name": "Poetry" }, { "count": 76, "coords": ["511.756,507.262", "503.779,527.680", "494.885,525.230", "489.660,506.742"], "name": "Comic Books" }, { "count": 23, "coords": ["503.779,527.680", "497.241,544.413", "491.477,546.153", "486.698,533.355", "494.885,525.230"], "name": "Foreign Language" }, { "count": 12, "coords": ["471.156,552.289", "459.306,555.867", "450.225,552.911", "466.282,544.131"], "name": "Political" }] }, { "count": 2408, "color": "#008963", "coords": ["331.505,234.468", "351.524,261.964", "355.146,302.846", "318.771,339.527", "286.220,345.382", "238.164,312.177", "231.142,274.024", "246.803,241.952", "271.667,222.711"], "name": "Food & Drink", "children": [{ "count": 2408, "color": "#008963", "coords": ["238.106,311.861", "290.308,226.374", "331.505,234.468", "351.524,261.964", "355.146,302.846", "318.771,339.527", "286.220,345.382", "238.164,312.177"], "name": "Food & Drink (general)" }, { "count": 551, "coords": ["290.308,226.374", "238.106,311.861", "231.142,274.024", "246.803,241.952", "271.667,222.711"], "name": "Cooking" }] }, { "count": 688, "coords": ["0.000,274.951", "49.727,309.314", "28.012,342.780", "0.000,338.881"], "name": "Self Improvement" }, { "count": 520, "coords": ["318.771,339.527", "333.970,376.812", "322.007,391.152", "290.298,387.892", "286.220,345.382"], "name": "Recreation" }, { "count": 198, "coords": ["161.185,0.000", "192.955,0.000", "192.364,38.085", "183.037,42.406", "157.101,32.876"], "name": "Personal Purity" }],
            dataSize = { width: 600, height: 600 },
            canvasElement,
            //json,
            selectZoom,
            canvasWidth,
            canvasHeight,
            root,
            canvasArea,
            flatten_nodes = function flatten_nodes(node, name, depth, base_color) {
                var flat = [], i, child, desc;
                depth = depth || 0;
                if (node.color !== undefined) { base_color = d3.hsl(node.color); }
                base_color = base_color || d3.hsl("#E0D3C1");
                node.depth = depth;
                node.color = base_color;
                for (i = 1; i < depth; i += 1) { node.color = node.color.brighter(1.5); }
                //node.color = node.color.toString();
                if (node.children !== undefined) {
                    if (name === undefined) {
                        name = node.name;
                    } else { name += " > " + node.name; }
                    for (i = 0; i < node.children.length; i += 1) {
                        child = node.children[i];
                        desc = flatten_nodes(child, name, depth + 1, base_color);
                        flat = flat.concat(desc);
                    }
                } else {
                    if (name !== undefined) { node.name = name + " > " + node.name; }
                    flat.push(node);
                }
                return flat;
            },
            i, flat = [], node, desc,
            lastClickTime;

        // Parse demo data:
        for (i = 0; i < data.length; i += 1) {
            node = data[i];
            desc = flatten_nodes(node);
            flat = flat.concat(desc);
        }

        // Zoom after click:
        function zoom() {
            if (canvasArea === undefined || true) {
                return; // Catch for if treemap hasn't been setup.
            }

            // Prevent event from firing more than once:
            if (d3.event) {
                d3.event.stopPropagation();
            }
        }

        function addNodes(celSel) {
            // Add nodes to Canvas:
            var cell = celSel.enter().append("group")
                .attr("originX", "center")
                .attr("originY", "center")
                .on("mousedown", function (d) {
                    var clickTime = (new Date()).getTime();
                    if (clickTime - lastClickTime < 500) {
                        selectZoom(d);
                    }
                    lastClickTime = clickTime;
                });

            // Add polygon to each node:
            cell.append("polygon")
                .attr("points", function (d) {
                    return d.coords;//.join(" ");
                })
                .attr("stroke", "#000")
                .attr("stroke-width", 1)
                .attr("fill", function (d) {
                    return d.color.toString();
                })
                .attr("originX", "center")
                .attr("originY", "center");
        }

        function update() {
            if (canvasArea === undefined) {
                return; // Catch for if treemap hasn't been setup.
            }
            // Define temp vars:
            var celSel, cell, coord, j,
                widthRatio = canvasWidth / dataSize.width,
                heightRatio = canvasHeight / dataSize.height;

            // Get treemap data:
            //root = flat;

            root = [];
            for (i = 0; i < flat.length; i += 1) {
                root[i] = { name: flat[i].name, coords: [], color: flat[i].color };
                for (j = 0; j < flat[i].coords.length; j += 1) {
                    coord = flat[i].coords[j].split(",");
                    root[i].coords[j] = {
                        x: Number(coord[0]) * widthRatio,
                        y: Number(coord[1]) * heightRatio
                    };
                }
            }

            // Select all nodes in Canvas, and apply data:
            celSel = canvasArea.selectAll("group")
                    .data(root, function (d) { return d.name; });

            // Update nodes on Canvas:
            cell = celSel.transition()
                .duration(1000);

            // Update each node's rectangle:
            cell.select("polygon")
                .attr("points", function (d) {
                    return d.coords;
                })
                .attr("fill", function (d) {
                    return d.color.toString();
                });

            // Add new nodes to Canvas:
            addNodes(celSel);

            // Remove nodes from Canvas:
            cell = celSel.exit().remove();
        }
        /*jslint unparam: true*/
        function init(
            element,
            width,
            height,
            jsonObservable,
            selectZoomFunction
        ) {
            if (canvasArea !== undefined) {
                return; // Catch for if voronoi has been setup.
            }
            canvasElement = element;
            //json = jsonObservable;
            canvasWidth = width;
            canvasHeight = height;
            selectZoom = selectZoomFunction;

            // Define temp vars:
            var celSel, j, coord,
                widthRatio = canvasWidth / dataSize.width,
                heightRatio = canvasHeight / dataSize.height;

            // Get voronoi data:
            //root = flat;

            // Respace coords:
            root = [];
            for (i = 0; i < flat.length; i += 1) {
                root[i] = { name: flat[i].name, coords: [], color: flat[i].color };
                for (j = 0; j < flat[i].coords.length; j += 1) {
                    coord = flat[i].coords[j].split(",");
                    root[i].coords[j] = {
                        x: Number(coord[0]) * widthRatio,
                        y: Number(coord[1]) * heightRatio
                    };
                }
            }

            canvasArea = canvasElement.append("group")
                .attr("originX", "center")
                .attr("originY", "center");

            // Join data with selection:
            celSel = canvasArea.selectAll("group")
                    .data(root, function (d) { return d.name; });

            // Add nodes to Canvas:
            addNodes(celSel);
        }
        /*jslint unparam: false*/

        function resize(width, height) {
            // Store width and height for later:
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
            enableRotate: true
        };
    };
});
/*global define*/
define('scalejs.visualization-d3/testindiv',[
    'd3'
], function (
    d3
) {
    

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
            return function (d) {
                // Create interpolations used for a nice slide around the parent:
                var interpX = d3.interpolate(this.left, d.x + posx),
                    interpY = d3.interpolate(this.top, d.y + posy),
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
            var cellRect = celSel.selectAll("rect")
                    .data(root, function (d) { return d.name; })
                    .enter(),
                cellText = celSel.selectAll("text")
                    .data(root, function (d) { return d.name; })
                    .enter();

            // Add rectangle to each node:
            cellRect.append("rect").each(function (d) {
                this.left = d.x;
                this.top = d.y;
                this.width = d.dx;
                this.height = d.dy;
                this.fill = d.color;
            });

            // Add title to each node:
            cellText.append("text").each(function (d) {
                this.left = d.x;
                this.top = d.y;
                this.fontSize = 11;
                this.text = d.name;
            });
        }

        function update() {
            if (canvasArea === undefined) {
                return; // Catch for if treemap hasn't been setup.
            }
            // Define temp vars:
            var cell = canvasArea;

            // Randomize goto position:
            posx = Math.random() * canvasWidth / 4;
            posy = Math.random() * canvasHeight / 4;

            // Update each node's rectangle:
            cell.selectAll("rect").transition()
                .duration(1000)
                .tween("posTween", posTween(posx, posy));

            // Update each node's title:
            cell.selectAll("text").transition()
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

            celSel = canvasArea = canvasElement;

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
                //canvasArea.remove();
                canvasArea.selectAll("rect").remove();
                canvasArea.selectAll("text").remove();
                //canvasArea = undefined;
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
/*global define*/
define('scalejs.visualization-d3/testgroup',[
    'd3'
], function (
    d3
) {
    

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
/*global define*/
/*jslint devel: true */
/*jslint browser: true */
define('scalejs.visualization-d3/d3',[
    'scalejs!core',
    'knockout',
    'd3',
    'd3.colorbrewer',
    'scalejs.canvas',
    'scalejs.visualization-d3/treemap',
    'scalejs.visualization-d3/treemapCustom',
    'scalejs.visualization-d3/sunburst',
    'scalejs.visualization-d3/sunburstCustom',
    'scalejs.visualization-d3/voronoi',
    'scalejs.visualization-d3/testindiv',
    'scalejs.visualization-d3/testgroup'
], function (
    core,
    ko,
    d3,
    colorbrewer,
    canvasRender,
    treemap,
    treemapCustom,
    sunburst,
    sunburstCustom,
    voronoi,
    testindiv,
    testgroup
) {
    
    var //imports
        unwrap = ko.utils.unwrapObservable,
        isObservable = ko.isObservable,
        visualizations = {
            //treemap: treemap,
            //sunburst: sunburst,
            //voronoi: voronoi,
            //testindiv: testindiv,
            //testgroup: testgroup,
            treemapCustom: treemapCustom,
            sunburstCustom: sunburstCustom
        };

    function blankVisualization(type) {
        // Generate general error:
        var strError = "Visualization ";
        if (type !== undefined) {
            strError += "(" + type + ") ";
        }
        strError += "doesn't exist!";

        // Generate error function:
        function visualizationError(func) {
            var strFuncError = "Calling " + func + " function of undefined visualization. " + strError;
            return function () {
                console.error(strFuncError);
            };
        }

        // Return blank visualization with errors as functions:
        return {
            init: visualizationError("init"),
            update: visualizationError("update"),
            zoom: visualizationError("zoom"),
            renderEnd: visualizationError("renderEnd"),
            resize: visualizationError("resize"),
            remove: visualizationError("remove")
        };
    }

    function init(
        element,
        valueAccessor
    ) {
        var parameters = valueAccessor(),
            enableRotate = parameters.enableRotate,
            enableZoom = parameters.enableZoom || false,
            enableTouch = parameters.enableTouch || false,
            allowTextOverflow = parameters.allowTextOverflow || false,
            visualization,
            visualizationType,
            visualizationTypeObservable,
            json,
            dataSource,
            maxVisibleLevels,
            levelsSource,
            levels,
            idPath,
            namePath,
            childrenPath,
            areaPath,
            colorPath,
            colorPalette,
            colorScale,
            fontSize,
            fontFamily,
            fontColor,
            globalLevel,
            selectedItemPath = parameters.selectedItemPath || ko.observable([]),
            selectedItemPathObservable,
            rootScale = d3.scale.linear(),
            canvasElement,
            canvas,
            elementStyle,
            canvasWidth,
            canvasHeight,
            root,
            nodeSelected,
            zooms,
            zoomObservable,
            zoomEnabled = true, // Temporary fix to errors with NaN widths during adding/removing nodes.
            leftVal = 0,
            topVal = 0,
            rotateVal = 0,
            scaleVal = 1,
            touchHandler,
            zoomOutScale = 0.8,
            radialTotalFrac,
            layout;

        // Get element's width and height:
        elementStyle = window.getComputedStyle(element);
        canvasWidth = parseInt(elementStyle.width, 10);
        canvasHeight = parseInt(elementStyle.height, 10);
        if (canvasHeight <= 0) {
            canvasHeight = 1;   // Temp fix for drawImage.
        }

        canvasElement = d3.select(element)
                        .style('overflow', 'hidden')
                        .append("canvas")
                            .attr("width", canvasWidth)
                            .attr("height", canvasHeight)
                            .node();

        function renderCallback(left, top, rotate, scale) { // Called on beginning and end of touch gestures:
            // Update transform:
            leftVal = left;
            topVal = top;
            rotateVal = rotate;
            scaleVal = scale;
            canvas.select("group")
                .attr("scaleX", scaleVal)
                .attr("scaleY", scaleVal)
                .attr("angle", rotateVal)
                .attr("left", leftVal)
                .attr("top", topVal);
            canvas.pumpRender();
        }
        function startCallback() {  // Called when user initiates a touch gesture:
            // Set Rotate State:
            visualization.enableRotate = unwrap(enableRotate) !== undefined ? unwrap(enableRotate) : visualization.enableRotateDefault;
            touchHandler.setRotateState(visualization.enableRotate);

            return {
                left: leftVal,
                top: topVal,
                rotate: rotateVal,
                scale: scaleVal
            };
        }
        function stepCallback(left, top, rotate, scale) {
            if (!visualization.enableRotate) {
                if (left > 0) {
                    left = 0;
                }
                if (top > 0) {
                    top = 0;
                }
                var right = left + scale * canvasWidth,
                    bottom = top + scale * canvasHeight;
                if (right < canvasWidth) {
                    left += canvasWidth - right;
                }
                if (bottom < canvasHeight) {
                    top += canvasHeight - bottom;
                }
            }
            if (scale < 1) {   // Bounce back:
                scale = Math.max(zoomOutScale, scale);
                // Reset transform:
                leftVal = (1 - scale) / 2 * canvasWidth;
                topVal = (1 - scale) / 2 * canvasHeight;
                rotateVal = 0;
                scaleVal = scale;
            } else {
                // Update transform:
                leftVal = left;
                topVal = top;
                rotateVal = rotate;
                scaleVal = scale;
            }
            return {
                left: leftVal,
                top: topVal,
                rotate: rotateVal,
                scale: scaleVal
            };
        }
        function endCallback(left, top, rotate, scale) {    // Called when user finishes a touch gesture:
            if (!visualization.enableRotate) {
                if (left > 0) {
                    left = 0;
                }
                if (top > 0) {
                    top = 0;
                }
                var right = left + scale * canvasWidth,
                    bottom = top + scale * canvasHeight;
                if (right < canvasWidth) {
                    left += canvasWidth - right;
                }
                if (bottom < canvasHeight) {
                    top += canvasHeight - bottom;
                }
            }
            if (scale < 1) {   // Bounce back:
                // Reset transform:
                leftVal = 0;
                topVal = 0;
                rotateVal = 0;
                scaleVal = 1;
                if (scale < zoomOutScale + (1 - zoomOutScale) / 4) {
                    selectZoom(nodeSelected.parent || nodeSelected);
                }
            } else {
                // Update transform:
                leftVal = left;
                topVal = top;
                rotateVal = rotate;
                scaleVal = scale;
            }
            return {
                left: leftVal,
                top: topVal,
                rotate: rotateVal,
                scale: scaleVal
            };
        }

        function registerTouchHandler() {
            // Check if a canvas touch plugin exists (register before initializing visualization to avoid event handler conflicts):
            if (core.canvas.touch && unwrap(enableTouch)) {
                touchHandler = core.canvas.touch({
                    canvas: canvasElement,
                    renderCallback: renderCallback,
                    startCallback: startCallback,
                    stepCallback: stepCallback,
                    endCallback: endCallback
                });
            } else {
                touchHandler = {
                    setRotateState: function () { return; },
                    remove: function () { return; }
                };
            }
        }

        registerTouchHandler();
        if (isObservable(enableTouch)) {
            enableTouch.subscribe(function () {
                touchHandler.remove();
                registerTouchHandler();
            });
        }

        // Create fabric canvas:
        canvas = canvasRender.select(canvasElement)
                    .ease(d3.ease("cubic-in-out"));
                /*d3.select(element)
                .style('overflow', 'hidden')
                .append("fabric:staticcanvas")
                    .property("renderOnAddRemove", false)
                    .property("selection", false)
                    .property("targetFindTolerance", 1)
                    .attr("width", canvasWidth)
                    .attr("height", canvasHeight);*/

        // Loop through levels to determine parameters:
        function createLevelParameters(lvlsParam) {
            // Setup temp vars:
            var colorPaletteType = Object.prototype.toString.call(colorPalette),
                // Unwrap levels:
                lvls = unwrap(lvlsParam),
                i;

            // Set colorPalette parameters:
            colorScale = d3.scale.linear();
            if (colorPaletteType === '[object Array]') {
                //colorPalette is an array:
                if (colorPalette.length === 0) {
                    // Use default palette:
                    colorPalette = colorbrewer.PuBu[3];
                } else if (colorPalette.length === 1) {
                    colorPalette = [colorPalette[0], colorPalette[0]];
                }
                colorScale.range(colorPalette);
            } else if (colorPaletteType === '[object String]') {
                // Check if colorPalette is a predefined colorbrewer array:
                if (colorbrewer[colorPalette] !== undefined) {
                    // Use specified colorbrewer palette:
                    colorScale.range(colorbrewer[colorPalette][3]);
                } else {
                    // Use default palette:
                    colorScale.range(colorbrewer.PuBu[3]);
                }
            } else {
                // Use default palette:
                colorScale.range(colorbrewer.PuBu[3]);
            }

            // Clear levels:
            levels = [];

            // Loop through all levels and parse the parameters:
            if (typeof lvls !== 'array' || lvls.length === 0) {
                levels[0] = {   // Use global parameters for the level:
                    idPath: idPath,
                    namePath: namePath,
                    childrenPath: childrenPath,
                    areaPath: areaPath,
                    colorPath: colorPath,
                    colorPalette: colorPalette,
                    colorScale: colorScale,
                    fontSize: fontSize,
                    fontFamily: fontFamily,
                    fontColor: fontColor
                };
            }
            for (i = 0; i < lvls.length; i += 1) {
                if (typeof lvls[i] === 'string') {
                    levels[i] = {   // Level just defines the childrenPath, use global parameters for the rest:
                        idPath: idPath,
                        namePath: namePath,
                        childrenPath: unwrap(lvls[i]),
                        areaPath: areaPath,
                        colorPath: colorPath,
                        colorPalette: colorPalette,
                        colorScale: colorScale,
                        fontSize: fontSize,
                        fontFamily: fontFamily,
                        fontColor: fontColor
                    };
                    radialTotalFrac += 1;
                } else {
                    // Level has parameters:
                    levels[i] = {   // Use global parameters for parameters not defined:
                        idPath: unwrap(lvls[i].idPath) || idPath,
                        namePath: unwrap(lvls[i].namePath || lvls[i].idPath) || namePath,
                        childrenPath: unwrap(lvls[i].childrenPath) || childrenPath,
                        areaPath: unwrap(lvls[i].areaPath) || areaPath,
                        colorPath: unwrap(lvls[i].colorPath) || colorPath,
                        fontSize: unwrap(lvls[i].fontSize) || fontSize,
                        fontFamily: unwrap(lvls[i].fontFamily) || fontFamily,
                        fontColor: unwrap(lvls[i].fontColor) || fontColor
                    };
                    radialTotalFrac += levels[i].radialFraction;
                    if (lvls[i].colorPalette === undefined) {
                        // Use global colorScale and Palette for this Level:
                        levels[i].colorPalette = colorPalette;
                        levels[i].colorScale = colorScale;
                    } else {
                        // Create colorScale and Palette for this Level:
                        levels[i].colorPalette = unwrap(lvls[i].colorPalette);
                        levels[i].colorScale = d3.scale.linear();

                        colorPaletteType = Object.prototype.toString.call(levels[i].colorPalette);
                        if (colorPaletteType === '[object Array]') {
                            //colorPalette is an array:
                            if (levels[i].colorPalette.length === 0) {
                                // Use default palette:
                                levels[i].colorPalette = colorPalette;
                                levels[i].colorScale = colorScale;
                            } else {
                                if (levels[i].colorPalette.length === 1) {
                                    levels[i].colorPalette = [levels[i].colorPalette[0], levels[i].colorPalette[0]];
                                }
                                levels[i].colorScale.range(levels[i].colorPalette);
                            }
                        } else if (colorPaletteType === '[object String]') {
                            // Check if colorPalette is a predefined colorbrewer array:
                            if (colorbrewer[levels[i].colorPalette] !== undefined) {
                                // Use specified colorbrewer palette:
                                levels[i].colorScale.range(colorbrewer[levels[i].colorPalette][3]);
                            } else {
                                // Use default palette:
                                levels[i].colorPalette = colorPalette;
                                levels[i].colorScale = colorScale;
                            }
                        } else {
                            // Use default palette:
                            levels[i].colorPalette = colorPalette;
                            levels[i].colorScale = colorScale;
                        }
                    }
                }
            }
        }
        // Recursively traverse json data, and build it for rendering:
        function createNodeJson(dat, lvls, ind, maxlvl) {
            var node = unwrap(dat), newNode, childNode, i, children, stepSize, lvl, color, newNode;

            if (maxlvl.value < ind) {
                maxlvl.value = ind;
            }

            lvl = lvls[ind] || globalLevel;

            if (node[lvl.childrenPath] === undefined) {   // Use current level parameters for node:
                newNode = {
                    id: unwrap(node[lvl.idPath]) || '',
                    name: unwrap(node[lvl.namePath]) || '',
                    lvl: ind,
                    size: unwrap(node[lvl.areaPath] !== undefined ? node[lvl.areaPath] : 1),
                    colorSize: unwrap(node[lvl.colorPath]) || 0,
                    fontSize: lvl.fontSize,
                    fontFamily: lvl.fontFamily,
                    fontColor: lvl.fontColor
                };
                if (newNode.name === nodeSelected.name) {
                    nodeSelected = newNode;
                }
                return newNode;
            }

            // Set default properties of node with children:
            newNode = {
                id: unwrap(node[lvl.idPath]) || '',
                name: unwrap(node[lvl.namePath]) || '',
                lvl: ind,
                children: [],
                childrenReference: [],
                size: unwrap(node[lvl.areaPath] !== undefined ? node[lvl.areaPath] : 1),
                colorSize: unwrap(node[lvl.colorPath]) || 0,
                colorScale: d3.scale.linear(),
                fontSize: lvl.fontSize,
                fontFamily: lvl.fontFamily,
                fontColor: lvl.fontColor,
                minSize: 0,
                maxSize: 1,
                minColor: 0,
                maxColor: 1
            };
            if (newNode.name === nodeSelected.name) {
                nodeSelected = newNode;
            }

            // Node has children, so set them up first:
            children = unwrap(node[lvl.childrenPath]);
            for (i = 0; i < children.length; i += 1) {
                childNode = createNodeJson(children[i], lvls, ind + 1, maxlvl); // Get basic node-specific properties
                childNode.parent = newNode; // Set node's parent
                childNode.index = i;    // Set node's index to match the index it appears in the original dataset.

                // Update the parent's overall size:
                if (node[lvl.areaPath] === undefined) {
                    newNode.size += childNode.size; // If parent has no size, default to adding child colors.
                }

                // Update the parent's overall color:
                if (node[lvl.colorPath] === undefined) {
                    newNode.colorSize += childNode.colorSize;   // If parent has no color, default to adding child colors.
                }

                // Update min and max properties:
                if (i) {
                    // Update min and max values: 
                    newNode.minSize = Math.min(newNode.minSize, childNode.size);
                    newNode.maxSize = Math.max(newNode.maxSize, childNode.size);
                    newNode.minColor = Math.min(newNode.minColor, childNode.colorSize);
                    newNode.maxColor = Math.max(newNode.maxColor, childNode.colorSize);
                } else {
                    // Insure min and max values are different if there is only one child:
                    newNode.minSize = childNode.size;
                    newNode.maxSize = childNode.size + 1;
                    newNode.minColor = childNode.colorSize;
                    newNode.maxColor = childNode.colorSize + 1;
                }

                // Add node to parent's children and childrenReference arrays:
                newNode.children[i] = childNode;
                // d3 reorganizes the children later in the code, so the following array is used to preserve children order for indexing:
                newNode.childrenReference[i] = childNode;
            }

            // Set parent node's colorScale range (Palette):
            if (lvls.length <= ind + 1) {    // Set to global Palette:
                newNode.colorScale.range(colorScale.range());
            } else {    // Set to node's Level color Palette:
                newNode.colorScale.range(lvls[ind + 1].colorScale.range());
            }
            // Set domain of color values:
            stepSize = (newNode.maxColor - newNode.minColor) / Math.max(newNode.colorScale.range().length - 1, 1);
            newNode.colorScale.domain(d3.range(newNode.minColor, newNode.maxColor + stepSize, stepSize));

            // Set children's colors:
            for (i = 0; i < children.length; i += 1) {
                color = newNode.colorScale(newNode.children[i].colorSize);
                newNode.children[i].color = color;
                newNode.childrenReference[i].color = color; //Needed? This should be an object reference anyway...
            }

            return newNode;
        }
        json = ko.computed(function () {
            var maxlvl = { value: 0 }, stepSize;
            // Get parameters (or defaults values):
            maxVisibleLevels = unwrap(parameters.maxVisibleLevels || 2);
            dataSource = unwrap(parameters.data) || { name: "Empty" };
            levelsSource = unwrap(parameters.levels) || [{}];
            idPath = unwrap(parameters.idPath) || 'id';
            namePath = unwrap(parameters.namePath) || idPath;
            childrenPath = unwrap(parameters.childrenPath) || 'children';
            areaPath = unwrap(parameters.areaPath) || 'area';
            colorPath = unwrap(parameters.colorPath) || 'color';
            colorPalette = unwrap(parameters.colorPalette) || 'PuBu';
            fontSize = unwrap(parameters.fontSize) || 11;
            fontFamily = unwrap(parameters.fontFamily) || "Times New Roman";
            fontColor = unwrap(parameters.fontColor) || "#000";

            globalLevel = {
                idPath: idPath,
                namePath: namePath,
                childrenPath: childrenPath,
                areaPath: areaPath,
                colorPath: colorPath,
                colorPalette: colorPalette,
                colorScale: colorScale,
                fontSize: fontSize,
                fontFamily: fontFamily,
                fontColor: fontColor
            };


            // Create copy of data in a easy structure for d3:
            createLevelParameters(levelsSource);
            if (!nodeSelected) {
                nodeSelected = {
                    name: null
                };
            } else {
                nodeSelected.old = true;
            }
            root = createNodeJson(dataSource, levels, 0, maxlvl, 0);
            if (nodeSelected.name !== null && !nodeSelected.old) {
                root.curLevel = nodeSelected.lvl;
                root.curMaxLevel = nodeSelected.lvl + maxVisibleLevels - 1;
            } else {
                nodeSelected = root;
                root.curLevel = 0;
                root.curMaxLevel = maxVisibleLevels - 1;
            }
            root.maxlvl = maxlvl.value;
            root.maxVisibleLevels = maxVisibleLevels;
            root.radialTotalFrac = radialTotalFrac;
            root.levels = levels;

            // Setup colorscale for the root:
            rootScale = d3.scale.linear()
                        .range(levels[0].colorScale.range());
            stepSize = 2 / Math.max(rootScale.range().length - 1, 1);
            rootScale.domain(d3.range(root.colorSize - stepSize / 2, root.colorSize + stepSize / 2, stepSize));

            // Set root's color:
            root.color = rootScale(root.colorSize);

            // Return the new json data:
            return root;
        });
        selectedItemPathObservable = ko.computed(function () {
            return unwrap(selectedItemPath);
        });

        function resetTransormAnimation() {
            // Reset transform:
            leftVal = 0;
            topVal = 0;
            rotateVal = 0;
            scaleVal = 1;
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
        function selectZoom(d) {
            var path = [],
                dTmp,
                oldSelected = nodeSelected;

            // Only zoom if enabled:
            if (unwrap(enableZoom)) {
                if (visualization.enableRootZoom && d === oldSelected) {    // Reset path since item was already selected.
                    d = root;
                }

                if (d !== oldSelected) {
                    // Reset transform:
                    resetTransormAnimation();
                }

                nodeSelected = dTmp = d;
                // Set selected node for use in calculating the max depth.
                root.curLevel = nodeSelected.lvl;
                root.curMaxLevel = nodeSelected.lvl + root.maxVisibleLevels - 1;
                // Check if selectedItemPath is an observable:
                if (isObservable(selectedItemPath)) {   // Path is an observable, so set path to the selected item:
                    while (dTmp.parent !== undefined) {
                        path.unshift(dTmp.index);
                        dTmp = dTmp.parent;
                    }
                    selectedItemPath(path);
                } else {    // Path is not an observable, so no need to push an update to it.
                    visualization.zoom(nodeSelected);
                }
            }

            // Prevent event from firing more than once:
            if (d3.event) {
                d3.event.stopPropagation();
            }
        }
        // Subscribe to selectedItemPath changes from outside of the extension (and then zoom):
        selectedItemPathObservable.subscribe(function (path) {
            var d = json(), i;
            if (Object.prototype.toString.call(path) === '[object Array]') {
                for (i = 0; i < path.length; i += 1) {
                    if (d.childrenReference === undefined) {
                        d = json(); // Path doesn't exist, so reset path.
                        break;
                    }
                    if (d.childrenReference[path[i]] === undefined) {
                        d = json(); // Path doesn't exist, so reset path.
                        break;
                    }
                    d = d.childrenReference[path[i]];
                }
            }
            // Verify d exists:
            if (d) {
                nodeSelected = d;       // Set nodeSelected to d
                root.curLevel = nodeSelected.lvl;
                root.curMaxLevel = nodeSelected.lvl + root.maxVisibleLevels - 1;
                if (zoomEnabled) {
                    visualization.zoom(nodeSelected);    // Animate zoom effect
                }
            }
        });

        visualizationTypeObservable = ko.computed(function () {
            visualizationType = parameters.visualization || ko.observable("");
            return unwrap(visualizationType);
        });

        // Retrieve new visualization type:
        visualizationType = visualizationTypeObservable();
        if (visualizations[visualizationType] !== undefined) {
            visualization = visualizations[visualizationType]();
        } else {
            // Visualization doesn't exist, so create blank visualization:
            visualization = blankVisualization(visualizationType);
        }
        // Run visualization's initialize code:
        visualization.allowTextOverflow = unwrap(allowTextOverflow);
        visualization.init(parameters, canvas, canvasWidth, canvasHeight, json, selectZoom, nodeSelected, element);
        // Start rendering the canvas
        canvas.startRender();
        canvas.pumpRender();

        // Subscribe to allowTextOverflow changes:
        if (isObservable(allowTextOverflow)) {
            allowTextOverflow.subscribe(function () {
                visualization.allowTextOverflow = unwrap(allowTextOverflow);
                visualization.update(nodeSelected);
            });
        }

        // Subscribe to visualization type changes:
        visualizationTypeObservable.subscribe(function () {
            // Remove visualization:
            visualization.remove();

            // Retrieve new visualization type:
            visualizationType = visualizationTypeObservable();
            if (visualizations[visualizationType] !== undefined) {
                visualization = visualizations[visualizationType]();
            } else {
                // Visualization doesn't exist, so create blank visualization:
                visualization = blankVisualization(visualizationType);
            }

            // Set selected node to the root of the treemap:
            /*nodeSelected = root;
            root.curLevel = nodeSelected.lvl;
            root.curMaxLevel = nodeSelected.lvl + root.maxVisibleLevels - 1;
            // Set default selected item (do this after the data is set, and before modifying attributes):
            if (isObservable(selectedItemPath)) {
                selectedItemPath([]);
            }*/

            // Reset transform:
            leftVal = 0;
            topVal = 0;
            rotateVal = 0;
            scaleVal = 1;

            // Run visualization's initialize code:
            visualization.allowTextOverflow = unwrap(allowTextOverflow);
            visualization.init(parameters, canvas, canvasWidth, canvasHeight, json, selectZoom, nodeSelected, element);
            canvas.pumpRender();
        });

        function update() {
            // Set selected node to the root of the treemap:
            //nodeSelected = root;
            //root.curLevel = nodeSelected.lvl;
            //root.curMaxLevel = nodeSelected.lvl + root.maxVisibleLevels - 1;

            // Set default selected item (do this after the data is set, and before modifying attributes):
            zoomEnabled = false;
            var dTmp = nodeSelected,
                path = [];
            if (isObservable(selectedItemPath)) {
                while (dTmp.parent !== undefined) {
                    path.unshift(dTmp.index);
                    dTmp = dTmp.parent;
                }
                selectedItemPath(path);
            }   // selectedItemPath is reset here to prevent errors in zooming, need to reorder later.
            zoomEnabled = true;

            // Update visualization:
            visualization.update(nodeSelected);
            canvas.pumpRender();
        }

        // Subscribe to data changes:
        json.subscribe(function () {
            update();   // Re-render on change
        });

        // Check if a layout plugin exists:
        if (core.layout) {
            // Add event listener for on layout change:
            layout = core.layout.onLayoutDone(function () {
                var lastWidth = canvasWidth,
                    lastHeight = canvasHeight;
                // Get element's width and height:
                elementStyle = window.getComputedStyle(element);
                canvasWidth = parseInt(elementStyle.width, 10);
                canvasHeight = parseInt(elementStyle.height, 10);
                if (canvasHeight <= 0) {
                    canvasHeight = 1;   // Temp fix for drawImage.
                }
                if (canvasWidth === lastWidth && canvasHeight === lastHeight) {
                    // Element size didn't change, ignore event.
                    return;
                }

                // Resize canvas:
                canvas.attr('width', canvasWidth);
                canvas.attr('height', canvasHeight);

                // Reset transform:
                resetTransormAnimation();

                // Call visualization's resize function to handle resizing internally:
                visualization.resize(canvasWidth, canvasHeight);
                // Update the visualization:
                //nodeSelected = root;
                //root.curLevel = nodeSelected.lvl;
                //root.curMaxLevel = nodeSelected.lvl + root.maxVisibleLevels - 1;
                visualization.update(nodeSelected);
                canvas.pumpRender();
            });
            ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
                layout();
                layout = undefined;
            });
        }

        // Subscribe to zoomPath changes:
        zoomObservable = ko.computed(function () {
            zooms = parameters.scale || ko.observable(1);
            return unwrap(zooms);
        });
        zoomObservable.subscribe(function (val) {
            visualization.scale(val);
            canvas.pumpRender();
        });
    }

    return {
        init: init
    };
});

/*global define*/
/*jslint devel: true */
define('scalejs.visualization-d3',[
    'scalejs!core',
    'knockout',
    'scalejs.visualization-d3/d3',
    'd3'
], function (
    core,
    ko,
    d3
) {
    
    if (ko.bindingHandlers.d3) {
        console.error("visualization-d3 is already setup");
        return false;
    }

    ko.bindingHandlers.d3 = d3;
    ko.virtualElements.allowedBindings.d3 = true;

    core.registerExtension({
        d3: d3
    });
});


