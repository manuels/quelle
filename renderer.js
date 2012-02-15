var Renderer = function(canvas){
  var canvas = $(canvas).get(0)
  var ctx = canvas.getContext("2d");
  var particleSystem
  var nearNode

  var that = {
    click: function(callback) {
      var func = function(e) {
        var node = that._findNodeForEvent(e)
        if(node !== undefined) {
          $(canvas).unbind('click', func)
          callback(node)
        }
      }

      $(canvas).bind('click', func)
    },
  
    init:function(system){
      particleSystem = system // save a reference for redraw()

      // inform the system of the screen dimensions so it can map coords for us.
      // if the canvas is ever resized, screenSize should be called again with
      // the new dimensions
      particleSystem.screenSize(canvas.width, canvas.height)
      particleSystem.screenPadding(40) // leave an extra 80px of whitespace per side
      
      // set up some event handlers to allow for node-dragging
      that.initDNDHandling()
      setInterval(function() {that.redraw()}, 100)
    },

    redraw:function(){
      //
      // redraw will be called repeatedly during the run whenever the node positions
      // change. the new positions for the nodes can be accessed by looking at the
      // .p attribute of a given node. however the p.x & p.y values are in the coordinates
      // of the particle system rather than the screen. you can either map them to
      // the screen yourself, or use the convenience iterators .eachNode (and .eachEdge)
      // which allow you to step through the actual node objects but also pass an
      // x,y point in the screen's coordinate system
      //
      ctx.fillStyle = "#F5F5F5"
      ctx.fillRect(0,0, canvas.width, canvas.height)
      
      particleSystem.eachEdge(function(edge, pt1, pt2){
        // edge: {source:Node, target:Node, length:#, data:{}}
        // pt1: {x:#, y:#} source position in screen coords
        // pt2: {x:#, y:#} target position in screen coords


        // draw a line from pt1 to pt2
        ctx.strokeStyle = "rgba(0,0,0, .333)"
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(pt1.x, pt1.y)
        ctx.lineTo(pt2.x, pt2.y)
        ctx.stroke()

        if(edge.data.uri) {
          var label = edge.data.uri
          ctx.fillStyle = "#707070"
          ctx.fillText(label, pt2.x+(pt1.x-pt2.x)/2, pt2.y+(pt1.y-pt2.y)/2)
        }


        // draw arrow
        ctx.save()
          // move to the head position of the edge we just drew
          var wt = 5
          var arrowLength = 6 + wt
          var arrowWidth = 2 + wt
          ctx.fillStyle = "#cccccc"
          ctx.translate(pt2.x, pt2.y);
          ctx.rotate(Math.atan2(pt2.y - pt1.y, pt2.x - pt1.x));

          // delete some of the edge that's already there (so the point isn't hidden)
          ctx.clearRect(-arrowLength/2,-wt/2, arrowLength/2,wt)

          // draw the chevron
          ctx.beginPath();
          ctx.moveTo(-arrowLength, arrowWidth);
          ctx.lineTo(0, 0);
          ctx.lineTo(-arrowLength, -arrowWidth);
          ctx.lineTo(-arrowLength * 0.8, -0);
          ctx.closePath();
          ctx.fill();
        ctx.restore()
      })

      particleSystem.eachNode(function(node, pt){
        // node: {mass:#, p:{x,y}, name:"", data:{}}
        // pt: {x:#, y:#} node position in screen coords
        var isEdge = node.name.indexOf(" ")>-1;

        // draw a rectangle centered at pt
        var w = 5
        var color,label,ltype = 'raw'
        switch(node.data.type) {
          case 'edge':
            color = "grey"
            label = graph.edges[node.name].label||""
            ltype = graph.edges[node.name].label_type
            break;
          case 'hiddenObjects':
            color = "#707070"
            label = "+"+node.data.remainders.length+" nodes"
            break;
          case 'hiddenEdges':
            color = "#707070"
            label = "+"+node.data.remainders.length+" edges"
            break;
          case 'node':
            color = Object.keys(graph.nodes[node.name].edges).length>0 ? "orange" : "black"
            label = graph.nodes[node.name].label||""
            ltype = graph.nodes[node.name].label_type
            break
        }

        if(nearNode != null && nearNode._id == node._id)
          color = "red"

        if(node != nearNode)
          label = that.shortenLabel(label, ltype)

        ctx.fillStyle = color
        ctx.fillRect(pt.x-w/2, pt.y-w/2, w,w)

        ctx.fillText(label, pt.x, pt.y+4)
      })
    },

    shortenLabel: function(label, type) {
      var max_label_length = 20
      switch(type) {
        case 'uri':
          return label.lshorten(max_label_length)
        case 'string':
          return label.rshorten(max_label_length)
        default:
          return label
      }
    },

    _findNodeForEvent: function(e) {
      var pos = $(canvas).offset();
      _mouseP = arbor.Point(e.pageX-pos.left, e.pageY-pos.top)
      var nearNode = particleSystem.nearest(_mouseP)
      if((nearNode == null) || (nearNode.distance > 75))
        return null
      else
        return nearNode.node
    },
    
    initDNDHandling:function(){
      // no-nonsense drag and drop (thanks springy.js)
      var dragged = null;

      // set up a handler object that will initially listen for mousedowns then
      // for moves and mouseups while dragging
      var handler = {
        clicked:function(e){
          var pos = $(canvas).offset();
          _mouseP = arbor.Point(e.pageX-pos.left, e.pageY-pos.top)
          dragged = particleSystem.nearest(_mouseP);

          if (dragged && dragged.node !== null){
            // while we're dragging, don't let physics move the node
            dragged.node.fixed = true
          }

          $(canvas).bind('mousemove', handler.dragged)
          $(window).bind('mouseup', handler.dropped)

          return false
        },
        dragged:function(e){
          var pos = $(canvas).offset();
          var s = arbor.Point(e.pageX-pos.left, e.pageY-pos.top)

          if (dragged && dragged.node !== null){
            var p = particleSystem.fromScreen(s)
            dragged.node.p = p
          }

          return false
        },

        dropped:function(e){
          if (dragged===null || dragged.node===undefined) return
          if (dragged.node !== null) dragged.node.fixed = false
          dragged.node.tempMass = 1000
          dragged = null
          $(canvas).unbind('mousemove', handler.dragged)
          $(window).unbind('mouseup', handler.dropped)
          _mouseP = null
          return false
        },
      }

      var highlighter = function(e) {
        nearNode = that._findNodeForEvent(e)
      }

      var unpackHidden = function(e) {
        var node = that._findNodeForEvent(e)
        if(node === undefined)
          return

        switch(node.data.type) {
          case 'hiddenObjects':
            var node_property = node.name.split(" ").slice(0,2).join(" ")
            for(var i in node.data.remainders) {
              var n = node.data.remainders[i]
              if(sys.getNode(n) === undefined)
                sys.addNode(n, {type: 'node'})
              sys.addEdge(node_property, n)
            }
            sys.pruneNode(node.name)
            break

          case 'hiddenEdges':
            var n = node.name.split(" ")[0]

            for(var i in node.data.remainders) {
              var p = node.data.remainders[i]
              addEdgeToVisualization(n, p)
            }
            sys.pruneNode(node.name)
            break
        }
      }
      
      // start listening
      $(canvas).mousedown(handler.clicked);
      $(canvas).bind('mousemove', highlighter)

      $(canvas).bind('click', unpackHidden)
    },
    
  }
  return that
} 
