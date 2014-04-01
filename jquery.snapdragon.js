;(function($, window, document){

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
            this.$el.removeData("snapDragon");
        },

    }

    $.fn.snapDragon = function(options) {

        var args = arguments;

        /* an object of options (or nothing) was passed in */
        if (options === undefined || typeof options === 'object') {
            // Creates a new plugin instance, for each selected element, and
            // stores a reference withint the element's data
            return this.each(function() {
                if (!$.data(this, "snapDragon")) {
                    $.data(this, "snapDragon", new SnapDragon(this, options));
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
        target.data("snapDragon").dragStartLocation = getXPos(target);
    }

    function handleTouchDrag(e){
        e.gesture.preventDefault();
        var target = $(e.delegateTarget);

        /* does this actually need to take t instead of e? */
        var delta = deltaFromLastDrag(e, target);

        /* get the current X translate of the invoice */
        var currentXPos = getXPos(target);

        /* calculate the new X position using the current and the delta */
        var newXPos = currentXPos + delta;

        var boundaries = target.data("snapDragon").options.boundaries;
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

        /* finally set the new invoice X position */
        target.css("-webkit-transform", "translateX("+newXPos+"px)");

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
        var dragStartLocation = target.data("snapDragon").dragStartLocation;

        // See if that position was one of the defined snap positions
        var dragStartSnapPosition = getSnapPosition(target, dragStartLocation);
        
        if(dragStartSnapPosition !== undefined){
            console.log("drag started at a snap position");
            if(brokeThreshold(dragStartSnapPosition, currentXPos)){
                var location = getClosestSnapPos(target, [dragStartSnapPosition.location]).location;
                console.log("broke threshold");
                snapTo(target, location);
                // it broke out of it's threshold, find a new position to snap to (or don't, maybe)
            } else {
                console.log("didn't break threshold");
                snapTo(target, dragStartSnapPosition.location);
            };
        }

    }

    function snapTo(target, location){
        console.log("snapping to " + location);
        var distanceToSnap = Math.abs(getXPos(target) - location);

        if(distanceToSnap > 0){
            target.addClass("snapDragonTransition");
            target.css("-webkit-transform", "translateX("+location+"px)");
            target.one("webkitTransitionEnd", function(){
                target.removeClass("snapDragonTransition");
            });
        }

    }

    function brokeThreshold(snapPosition, currentXPos){
        return (Math.abs(currentXPos - snapPosition.location) > snapPosition.threshold);
    }

    /* Given a location, finds if there is a snap position there */
    function getSnapPosition(target, location){
        var snapPositions = target.data("snapDragon").options.snapPositions;

        for(var i=0; i < snapPositions.length; i++){
            var snapPosition = snapPositions[i];
            if(snapPosition.location == location){
                return snapPosition;
            }
        }

        return undefined;
    }

    function getClosestSnapPos(target, excludedLocations){
        
        var snapPositions = target.data("snapDragon").options.snapPositions;
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

/*
Notes: 

* Item must be display block or display inline-block in
  order for -webkit-transform: translateX() to actually
  work. Hm.

*/

/*
Idea: 

Right now, the issue is that the selector given to hammer (".parent") doesn't
seem to be working because (".child") elements still get moved. This is because
a touch event on the child element propogates up to the parent element and
triggers the hammer event handler, but that same event handler works with
(and changes the translateX of) the e.target, which is, by definition, the child
not the parent. What we really want to do is operate on (this) because that's
the element that actually received the event.

Solution 1: Check if (this) == e.target, return if so

Works to make the child not move, but doesn't let the event pass through to the
parent, which is what we really want to do. For this to work, we'd have to
put pointer-events none on the child(ren) which would make binding anything
on those later (like click events) impossible. So that's a no-no.

Solution 2: Check if e.target matches the selector given to hammer, if not, find
the nearest parent that does, and operate on that.

Seems like a good solution, though it means we'd have to pass the selector into
the function (instead of just relying on the Hammer instance). Should work for
multiple touches as well. Or maybe we can get the selector off the hammer
instance, which should be stored on the data of the elements anyway?

Solution 3: Is there a (this) on a per touch basis rather than an e.target?
THis would probably be the easiest solution, though I doubt this is actually
possibly. Could try console.logging the e and look through the object to see if
it's there.

*/