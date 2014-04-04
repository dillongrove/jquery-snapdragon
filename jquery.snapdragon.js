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
            // get the hammer instance
            var hammertime = this.$el.data("hammer");

            hammertime.on("dragstart", function(e){
                e.stopPropagation();
                handleDragStart(e);
            });

            hammertime.on("touch drag", function(e){
                e.stopPropagation();        
                handleTouchDrag(e);
            });

            hammertime.on("dragend", function(e){
                e.stopPropagation();
                handleDragEnd(e);
            });

        },

        destroy: function() {

            // Remove attached data
            this.$el.removeData(pluginName);
        },

        snapTo: function(location){
            console.log("snapping to " + location);
            var distanceToSnap = Math.abs(getXPos(this.$el) - location);

            if(distanceToSnap > 0){
                this.setPosition(location, true);
            }
        },

        setPosition: function(position, withTransition){
            if(withTransition == false || withTransition == undefined){
                this.$el.css("-webkit-transform", "translateX("+position+"px)");
            } else {
                var hammertime = this.$el.data("hammer");
                if(hammertime){
                    hammertime.enable(false);
                }

                this.$el.addClass("snapDragonTransition");
                this.$el.css("-webkit-transform", "translateX("+position+"px)");

                var that = this;

                this.$el.one("webkitTransitionEnd", function(){
                    if(hammertime){
                        hammertime.enable(true);
                    }

                    that.$el.removeClass("snapDragonTransition");

                })
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
        e.gesture.preventDefault();
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
        e.gesture.preventDefault();
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
            console.log("drag started at a snap position");
            if(brokeThreshold(dragStartSnapPosition, currentXPos)){
                var location = getClosestSnapPos(target, [dragStartSnapPosition.location]).location;
                console.log("broke threshold");
                target.data(pluginName).snapTo(location);
                // it broke out of it's threshold, find a new position to snap to (or don't, maybe)
            } else {
                console.log("didn't break threshold");
                target.data(pluginName).snapTo(dragStartSnapPosition.location);
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

    };

}(jQuery, window, document));