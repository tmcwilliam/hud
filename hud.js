(function( $ ){

  /* HUD (Heads Up Display)
   * Unobtrusive visual display next to the attached element
   *
   * @param elmID: id of HTML element for HUD display
   * @param method: action to take (default: 'init')
   * @param options: developer has control over hud positioning/alignment, fade speed, delay before fade and ajax params
   *
   * ASSUMPTIONS: only one HUD type per page at any point in time
   * EXAMPLE HUD TEMPLATE: <div id="hud"><div class="inner_hud"></div></div>
   *
   */
  $.fn.hud = function( elmID, method ) {
    if ( methods[method] ) {
      return methods[method].apply( this, Array.prototype.slice.call( arguments, 1 ));
    } else if ( typeof method === 'object' || ! method ) {
      return methods.init.apply( this, arguments );
    }
  };

  var methods = {
    init : function( elmID, options ) {
      /* Default Settings */
      var settings = {
        'alignment'     : 'center',     //align HUD in relation to HTMLElement (vertical:{left,center,right},horizontal:{top,center,bottom})
        'event'         : 'click',      //click/hover
        'delayAfter'    : 1500,         //used on 'hover' event only
        'delayBefore'   : 1000,         //used on 'hover' event only
        'fadeSpeed'     : 400,          //duration of fade in milliseconds
        'innerHud'      : 'hud_inner',  //needed for AJAX and arrow display
        'inlineMessage' : '',           //text for innerHud (populated onClick)
        'message'       : null,         //text for innerHud (populated on page load)
        'params'        : [],           //array of keys pulled in from HTMLElement attributes
        'position'      : 'vertical',   //vertical:top/bottom, horizontal:left/right
        'queryId'       : 'query_id',   //default name for the HTMLElement attribute
        'url'           : null,         //AJAX action
        'cssName'       : '',           //dynamic css name
        onSuccess       : null
      };

      /* Merge options with default settings */
      options = options ? $.extend( settings, options ) : settings;

      /* Initialize HUD Display */
      if(options.message !== null || options.url !== null || (options.inlineMessage !== null && $('#'+elmID).size() === 0) ) {
        $("BODY").append('<div id="'+elmID+'" class="hud '+options.cssName+'"><div class="hud_top"></div><div class="hud_inner clearfix">'+options.message+'</div><div class="hud_bottom"></div></div>');
      }
      var hudObj = $('#'+elmID);

      return this.each(function(){
        var obj = this;
        this.hud = hudObj;
        this.ajaxSuccess = false;
        this.emptyResponse = false;
        this.configs = options;
        this.timerId = null;

        // Bind object to configured event
        if(this.configs.event == 'click'){
          $(this).bind('click.hud', function(event){
            event.preventDefault();
            methods.reset(event, obj);
            methods.show(event,obj);
            event.stopPropagation();
            $(document).one("click", function(event) { methods.hide(event,obj); });
          });

          /* Allow for clicking inside the HUD */
          hudObj.click(function(){ return false; });
        } else if(this.configs.event == 'hover'){
          $(this).bind('mouseenter.hud', function(event){
            obj.timerId = setTimeout(function(){
              methods.reset(event, obj);
              if(!obj.emptyResponse){
                methods.show(event,obj);
              }
            },obj.configs.delayBefore );
          });

          $(this).bind('mouseleave.hud', function(event){
            clearTimeout ( obj.timerId );
            /* Only hide HUD if mouse is NOT over the HUD */
            hudObj.bind('mouseenter.hud', function(evt){
              event.stopPropagation();
            });
            hudObj.bind('mouseleave.hud', function(evt){
              window.setTimeout(
                function(){
                  /*** Deprecating this condition: seems to already apply ***/
                  /* Only hide HUD if mouse is NOT over the HUD */
                  // if($('body').data('target') != obj){
                    methods.hide(evt,obj);
                  // }
                },
                obj.configs.delayAfter
              );
            });
            window.setTimeout(
              function(){
                if(!event.isPropagationStopped()){
                  methods.hide(event,obj);
                }
              },
              obj.configs.delayAfter
            );
          });
        }

      });
    },

    ajax : function(e,obj){
      var url = $(obj).attr(obj.configs.queryId) !== undefined ? obj.configs.url + "/" + $(obj).attr(obj.configs.queryId) : obj.configs.url;
      var params = {};
      $(obj.configs.params).each(function(index,param){
        params[param] = $(obj).attr(param);
      });
      url += "?" + $.param(params);
      var numRand = Math.floor(Math.random()*1000); // Adding a cache buster because of errors in IE. This should at least be optional
      $.get(url, {"cb":numRand}, function(data) {
        if(data.trim().length !== 0){
          obj.hud.find("."+obj.configs.innerHud).html(data);
          /* Make sure images are loaded before calculating position */
          if(obj.hud.find('img').length > 0){
            obj.hud.find('img').load(function() {
              obj.ajaxSuccess = true;
              methods.show(e,obj);
              obj.ajaxSuccess = false;
            });
          } else {
            obj.ajaxSuccess = true;
            methods.show(e,obj);
            obj.ajaxSuccess = false;
          }
        } else {
          obj.ajaxSuccess = true;
          obj.emptyResponse = true;
        }
      });
    },

    show : function(e,obj){
      if(obj.configs.url !== null && obj.ajaxSuccess === false && $('body').data('target') === null){
        methods.ajax(e,obj);
      } else if($('body').data('target') === null){

        if (obj.configs.inlineMessage.length > 0) {
          $(obj.hud).find('.hud_inner').html(obj.configs.inlineMessage);
        }

        methods.positionHud(obj, obj.hud).fadeIn(obj.configs.fadeSpeed,function(){
          $('body').data('target',obj);
        });
        // Callback function
        if (obj.configs.onSuccess){
          obj.configs.onSuccess();
        }
      }
      // Bind object to window resize event for repositioning
      $(window).bind('resize.hud', function(){methods.positionHud(obj, obj.hud);});
    },

    hide : function(e,obj){
      if($('body').data('target') !== null && ($('body').data('target') == obj || obj.configs.event == 'click') ){
        obj.hud.fadeOut(obj.configs.fadeSpeed,function(){
          $('body').data('target',null);
        });
      }
      $(window).unbind('.hud');
    },

    reset : function(e,obj){
      if($('body').data('target') != obj){
        obj.hud.hide();
        $('body').data('target',null);
      }
    },

    /* Calculate position for HUD
    * @param elm: HTMLElement
    * @param hud: current HUD display
    * */
    positionHud : function(elm, hud){
      var obj = $(elm);
      var elmPos = obj.offset();
      var screenWidth,
          elmRightEdge,
          arrowPosition,
          topPosition,
          leftPosition;

      // Which gap is bigger to display the HUD in? right/left/top/bottom of element?
      if(elm.configs.position == 'horizontal'){
        screenWidth = $(window).width();
        elmRightEdge = obj.width() + elmPos.left;
        arrowPosition = screenWidth - elmRightEdge >= elmPos.left ? "arrowLeft" : "arrowRight";
      } else if(elm.configs.position == 'vertical'){
        screenHeight = $(window).height();
        elmBottomEdge = obj.height() + elmPos.top;
        arrowPosition = screenHeight - elmBottomEdge >= elmPos.top ? "arrowTop" : "arrowBottom";
      }

      hud.removeClass("arrowLeft arrowRight arrowTop arrowBottom").addClass(arrowPosition);

      /* Position HUD */
      if(elm.configs.position == 'horizontal'){
        leftPosition = arrowPosition == "arrowLeft" ? elmRightEdge : elmPos.left - hud.width();
        topPosition = elmPos.top;
      } else if(elm.configs.position == 'vertical'){
        topPosition = arrowPosition == "arrowTop" ? elmBottomEdge : elmPos.top - hud.height();
        leftPosition = elmPos.left;
      }
      if(elm.configs.alignment == 'center' && elm.configs.position == 'vertical'){
        leftPosition = elmPos.left + (obj.width() / 2) - (hud.width() / 2);
      } else if(elm.configs.alignment == 'right' && elm.configs.position == 'vertical'){
        leftPosition = elmPos.left - (hud.width() - obj.width());
      } else if(elm.configs.alignment == 'center' && elm.configs.position == 'horizontal'){
        topPosition = elmPos.top + (obj.height() / 2) - (hud.height() / 2);
      } else if(elm.configs.alignment == 'bottom' && elm.configs.position == 'horizontal'){
        topPosition = elmPos.top - (hud.height()- obj.height()) + 20; /* offset of bottom image with arrow */
      }
      hud.css({
        'left':leftPosition,
        'top':topPosition,
        'padding':0 //padding will skew positioning
      });

      return hud;
    }
  };

})( jQuery );
