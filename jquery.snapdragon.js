;(function($, window, document){

    var pluginName = "snapDragon";
    
    function SnapDragon(element, options){
        // Store stome references to the element on the instance
        this.el = element;
        this.$el = $(element);

        // Merge passed options with defaults
        this.options = $.extend({}, $.fn.snapDragon.defaults, options);

        this.init();
    }

    SnapDragon.prototype = {

        init: function(){
            var that = this;

            // get the hammer instance
            var hammertime = this.$el.data("hammer");

            hammertime.on("dragstart", function(e){
                handleDragStart(e);
            });

            hammertime.on("drag", function(e){   
                if(that.options.ignore_vertical_drags){
                    // only handle drag events on left/right drags
                    if(e.gesture.direction == "left" || e.gesture.direction == "right"){
                        handleTouchDrag(e);
                    }
                } else {
                    handleTouchDrag(e);
                }
            });

            hammertime.on("dragend", function(e){
                handleDragEnd(e);
            });

        },

        destroy: function() {

            // Remove attached data
            this.$el.removeData(pluginName);
        },

        // Given a location or snapLocation obj, snaps to it
        snapTo: function(destination){
            if(typeof destination == "object"){
                var location = destination.location;
                var distanceToSnap = Math.abs(getXPos(this.$el) - location);
                if(distanceToSnap > 0){
                    // pass along this snapPosition's callback
                    this.setPosition(location, true, destination.callback);
                }
            } else {
                var location = destination;
                var distanceToSnap = Math.abs(getXPos(this.$el) - location);
                if(distanceToSnap > 0){
                    this.setPosition(location, true);
                }
            }

        },

        setPosition: function(position, withTransition, callback){
            // if this particular instance of snapDragon has defined a moveAlso,
            // it means we need to move something along with this element
            if(this.options.moveAlso){
                var otherElements = $(this.options.moveAlso.selector);
            }

            // if there are no other elements to move, just set the var to the
            // empty jquery object so that the jquery methods below don't
            // throw an error
            otherElements = otherElements ? otherElements : $();

            // if we're not using a transition (probably because were in the
            // middle of a drag), we can just straight up set the new position
            if(withTransition == false || withTransition == undefined){
                this.$el.css("-webkit-transform", "translateX("+position+"px)");
                if(otherElements.length != 0){
                    // WARNING, this will break if moveFn is not defined
                    // TODO: dont break if moveFn is not defined lols
                    otherPosition = this.options.moveAlso.moveFn(position);
                    otherElements.css("-webkit-transform", "translateX("+otherPosition+"px)");
                }
            // but if so, we probably need to snap to a location 
            } else {
                // find and disable hammer during this transition
                var hammertime = this.$el.data("hammer");
                if(hammertime){
                    hammertime.enable(false);
                }

                // add transition class
                this.$el.addClass("snapDragonTransition");
                otherElements.addClass("snapDragonTransition");

                // set new positions
                this.$el.css("-webkit-transform", "translateX("+position+"px)");

                if(otherElements.length != 0){
                    otherPosition = this.options.moveAlso.moveFn(position);
                    otherElements.css("-webkit-transform", "translateX("+otherPosition+"px)");
                }

                // save reference for this next event handler function
                var that = this;

                // .one() runs and then unbinds itself
                this.$el.one("webkitTransitionEnd", function(){
                    // after transition is done, re-enable hammer
                    if(hammertime){
                        hammertime.enable(true);
                    }

                    // ...and remove the transition class
                    that.$el.removeClass("snapDragonTransition");
                    otherElements.removeClass("snapDragonTransition");

                    //...and call the callback, if there was one
                    if(callback !== undefined){
                        callback();
                    }

                });
            }
        }

    }

    $.fn.snapDragon = function(options) {

        var args = arguments;

        // an object of options (or nothing) was passed in */
        if (options === undefined || typeof options === 'object') {

            // Create a new instance for each object in the selector and
            // store a reference to the instance in the element's data.
            // Returning the result of each so that chaining works.

            return this.each(function() {
                if (!$.data(this, pluginName)) {
                    $.data(this, pluginName, new SnapDragon(this, options));
                }
            });

        } else {
            // TODO
            // Call a public pluguin method (not starting with an underscore) for each 
            // selected element. (like destroy for example)
            //  
            // args used down here if necessarys
        }

    };


    function handleDragStart(e){
        var target = $(e.delegateTarget);
        target.data(pluginName).dragStartLocation = getXPos(target);
    }

    function handleTouchDrag(e){
        var target = $(e.delegateTarget);

        var delta = deltaFromLastDrag(e, target);

        /* get the current X translate of the invoice */
        var currentXPos = getXPos(target);

        /* calculate the new X position using the current and the delta */
        var newXPos = currentXPos + delta;

        var boundaries = target.data(pluginName).options.boundaries;
        if(boundaries){
            if(boundaries.right != undefined){
                if(newXPos > boundaries.right){
                    newXPos = boundaries.right;
                }
            }
            if(boundaries.left != undefined){
                if(newXPos < boundaries.left){
                    newXPos = boundaries.left;
                }
            }
        }

        var snapDragon = target.data("snapDragon");
        snapDragon.setPosition(newXPos, false);

    }

    function handleDragEnd(e){
        var target = $(e.delegateTarget);

        /* get the current X translate of the invoice */
        //var currentXPos = getXPos(target);


        /* RESET the last drag position whenever we end a drag so it doesn't 
         * pop to the wrong place when the next drag is started--this is VERY
         * IMPORTANT
         */
        target.removeData("last-drag-pos-x");

        var currentXPos = getXPos(target);

        // Find out what the location was at the beginning of this drag
        var dragStartLocation = target.data(pluginName).dragStartLocation;

        // See if that position was one of the defined snap positions
        var dragStartSnapPosition = getSnapPosition(target, dragStartLocation);
        
        if(dragStartSnapPosition !== undefined){
            if(brokeThreshold(dragStartSnapPosition, currentXPos)){
                var snapPos = getClosestSnapPos(target, [dragStartSnapPosition.location]);
                target.data(pluginName).snapTo(snapPos);
                // it broke out of it's threshold, find a new position to snap to (or don't, maybe)
            } else {
                target.data(pluginName).snapTo(dragStartSnapPosition);
            };
        }

    }

    function brokeThreshold(snapPosition, currentXPos){
        return (Math.abs(currentXPos - snapPosition.location) > snapPosition.threshold);
    }

    /* Given a location, finds if there is a snap position there */
    function getSnapPosition(target, location){
        var snapPositions = target.data(pluginName).options.snapPositions;

        for(var i=0; i < snapPositions.length; i++){
            var snapPosition = snapPositions[i];
            if(snapPosition.location == location){
                return snapPosition;
            }
        }

        return undefined;
    }

    function getClosestSnapPos(target, excludedLocations){
        
        var snapPositions = target.data(pluginName).options.snapPositions;
        var currentXPos = getXPos(target)

        var closest = -1;
        var minDistance = -1;
        for(var i=0; i < snapPositions.length; i++){
            var snapPosition = snapPositions[i];

            if(excludedLocations.indexOf(snapPosition.location) == -1){
                var distance = Math.abs(currentXPos-snapPosition.location);

                if((distance < minDistance) || (minDistance == -1)){
                    minDistance = distance;
                    closest = snapPosition;
                }
            }
        }

        return closest;

    }

    /* Also sets the the current drag pos as data for the next drag */
    function deltaFromLastDrag(e, element){
        /* get the X position of the current drag event */
        var currentDragPosX = e.gesture.center.pageX;
        /* get the X position of the last drag event on this element */
        var lastDragPosX = element.data("last-drag-pos-x");

        /* compute delta by using these two positions, if there was no
         * previous event, default to 0
         */
        if (lastDragPosX == undefined) {
            var delta = 0;
        } else {
            var delta = currentDragPosX - lastDragPosX;
        }

        /* finally set the last drag position for next time */
        element.data("last-drag-pos-x", currentDragPosX);

        return delta;
    }

    function getXPos(elem){
        var transformMatrix = new WebKitCSSMatrix(elem.css("-webkit-transform"));
        var currentXPos = transformMatrix.m41; /* matrix 4th row, 1st column */
        return currentXPos;
    }

    $.fn.snapDragon.defaults = {
        ignore_vertical_drags: true
    };

}(jQuery, window, document));