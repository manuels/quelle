var graph, sys;

String.prototype.lshorten = function(len) {
  if(this.length>len)
    return "…"+this.substr(this.length-len,len)
  else
    return this
}

String.prototype.rshorten = function(len) {
  if(this.length>len)
    return this.substr(0, len)+"…"
  else
    return this
}

$(document).ready(function() {
  initViewport("#viewport");
  setupExamples();

  $("button#submit").click(guiQuery);

  $("a#find_subject").click(function() { sys.renderer.click(findNodeAsSubject) })
  $("a#find_object").click(function() { sys.renderer.click(findNodeAsObject) })
})


var setupExamples = function() {
  var examples = {
    'List of top 20 populated properties':
      '# lists top 20 populated properties\n'+
      '# It uses a non-standard feature "count"\n'+
      'SELECT ?p (COUNT(?s) AS ?count) WHERE { ?s ?p ?o } GROUP BY ?p ORDER BY DESC(?count) LIMIT 20',

    'List of top 20 populated classes':
      '# lists top 20 populated classes\n'+
      '# It uses a non-standard feature "count"\n'+
      'SELECT ?c (COUNT(?s) AS ?count) WHERE { ?s ?a ?c } GROUP BY ?c ORDER BY DESC(?count) LIMIT 20',

    'Number of distinct properties':
      '# Count the number of distinct properties populated in this work\n'+
      '# It uses a non-standard feature "count"\n'+
      'SELECT ?g COUNT(DISTINCT ?p) WHERE { GRAPH ?g {[] ?p ?o} }',

    'Number of all classes for all graphs':
      '# Count the number of distinct classes populated in this work\n'+
      '# It uses a non-standard feature "count"\n'+
      'SELECT COUNT(DISTINCT ?c) WHERE {[] a ?c}',

    'Number of triples for all graphs':
      '# Count the number of triples in every named graph in a triple store.\n'+
      '# It uses a non-standard feature "count"\n'+
      'SELECT ?g COUNT(*) WHERE {GRAPH ?g {?s ?p ?o} }',
  }

  for(var title in examples)
    $('<li></li>').html( $('<a href="#"></a>').text(title) ).click(function() {
      $('textarea#sparql').val(examples[title])
      guiQuery()
    }).appendTo($('#example-queries'))
}

var guiQuery = function() {
  $('button#submit').attr("disabled", true);
  var endpoint = $('input#endpoint').val()
  var query = $('textarea#sparql').val()
  
  resetGraphModel()
  $.sparql(endpoint).query(query).execute(function(data) {
    $('button#submit').attr("disabled", false);
    resetGraphVisualization()
    appendResultToGraphModel(data)
  })
}

var findNodeAsSubject = function(node) {
  var endpoint = $('input#endpoint').val()
  var uri = "<"+node.name+">"

  $.sparql(endpoint).select([uri+" AS ?s", "?p", "?o"]).where(uri, "?p", "?o").execute(function(data) {
    appendResultToGraphModel(data)
  })
}

var findNodeAsObject = function(node) {
  var endpoint = $('input#endpoint').val()
  var uri = "<"+node.name+">"

  $.sparql(endpoint).select(["?s", "?p", uri+" AS ?o"]).where("?s", "?p", uri).execute(function(data) {
    appendResultToGraphModel(data)
  })
}


var resetGraphModel = function() {
  graph = { nodes: {}, edges: {} }
}


var resetGraphVisualization = function() {
  sys.eachNode(sys.pruneNode)
}


var appendResultToGraphModel = function(data) {
  console.log(data)

  var s = 's'
  var o = 'o'
  var p = 'p'

  for(var i in data) {
    var s_uri   = (typeof(data[i][s])=='object') ? data[i][s].uri : s_uri = data[i][s]
    var s_ltype = (typeof(data[i][s])=='object') ? 'uri' : 'string'
    var p_uri   = (typeof(data[i][p])=='object') ? data[i][p].uri : p_uri = data[i][p]
    var p_ltype = (typeof(data[i][p])=='object') ? 'uri' : 'string'
    var o_uri = (typeof(data[i][o])=='object') ? data[i][o].uri : o_uri = data[i][o]
    var o_ltype = (typeof(data[i][o])=='object') ? 'uri' : 'string'

    if(!(s_uri in graph.nodes))
      graph.nodes[s_uri] = { label: s_uri, label_type: s_ltype, edges: {} }
    if(!(p_uri in graph.nodes[s_uri].edges)) {
      sp = s_uri + " " + p_uri
      graph.edges[sp] = { label: p_uri, label_type: p_ltype }
      graph.nodes[s_uri].edges[p_uri] = []
    }
    graph.nodes[s_uri].edges[p_uri].push(o_uri)

    if(!(o_uri in graph.nodes))
      graph.nodes[ o_uri ] = { label: o_uri, label_type: o_ltype, edges: {} }
  }

  syncGraphVisualization();
}

var addEdgeToVisualization = function(n, p) {
  var object_limit = 4

  // create edge with single object
  if(graph.nodes[n].edges[p].length == 1) {
    var o = graph.nodes[n].edges[p][0]
    if(Object.keys(graph.nodes[o].edges).length == 0)
      sys.addNode(o, {type: 'node'}) // create object if it wouldn't be created anyway
    sys.addEdge(n, o, {uri: p})
  }
  else {
    // create edge with mulitple object
    var np = n+" "+p
    sys.addNode(np, {type: "edge"})
    sys.addEdge(n, np)

    var objects = graph.nodes[n].edges[p]
    var visibleObjects = objects.slice(0, object_limit)
    var hiddenObjects = objects.slice(object_limit)
    if(hiddenObjects.length == 1) {
      visibleObjects = objects
      hiddenObjects = []
    }

    var i
    for(i in visibleObjects) {
      var o = visibleObjects[i]
      sys.addNode(o, {type: 'node'})
      sys.addEdge(np, o)
    }

    if(hiddenObjects.length > 0) {
      var id = np+" remainders"
      sys.addNode(id, {type: 'hiddenObjects', remainders: hiddenObjects})
      sys.addEdge(np, id)
    }
  }
}

var syncGraphVisualization = function() {
  var edge_limit = 4

  for(var n in graph.nodes) {
    if(Object.keys(graph.nodes[n].edges).length>0)
      sys.addNode(n, {type: 'node'})

    var edges = Object.keys(graph.nodes[n].edges)
    var visibleEdges = edges.slice(0, edge_limit)
    var hiddenEdges = edges.slice(edge_limit)
    if(hiddenEdges.length==1) {
      visibleEdges = edges
      hiddenEdges = []
    }

    for(var j in visibleEdges) {
      addEdgeToVisualization(n, visibleEdges[j])
    }

    if(hiddenEdges.length > 0) {
      var id = n+" remainders"
      sys.addNode(id, {type: 'hiddenEdges', remainders: hiddenEdges})
      sys.addEdge(n, id)
    }
  }

}


var initViewport = function(selector) {
  var viewport = $(selector)
  viewport.attr({width: viewport.width(), height: viewport.height()}) 

  sys = arbor.ParticleSystem(100, 1000, 0.5)
  sys.parameters({gravity:true})
  sys.renderer = Renderer(selector)

  sys.addEdge('a','b')
  sys.addEdge('a','c')
  sys.addEdge('a','d')
  sys.addEdge('a','e')
  sys.addNode('f', {alone:true, mass:.25})
}
