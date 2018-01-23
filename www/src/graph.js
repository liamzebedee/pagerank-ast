import * as d3old from 'd3'
// import 'd3-graphviz';
// import 'viz.js';
// import 'script-loader!./vendor/d3.v4.min.js';
// import 'script-loader!./vendor/viz-lite.js';
import  'script-loader!./vendor/d3.v4.min.js';
import 'script-loader!./vendor/viz-lite.js';
import 'script-loader!./vendor/d3-graphviz.min.js';



import graphdata from '../graph.json';
import graphDot from 'raw-loader!../graph.dot';
import './graph.css';


import React from 'react';
import ReactDOM from 'react-dom';
import mobx, { observable, computed } from 'mobx';
import { observer } from "mobx-react";
import Fuse from 'fuse.js';
import _ from 'underscore';

// Cheers https://bl.ocks.org/puzzler10/4438752bb93f45dc5ad5214efaa12e4a

// https://bl.ocks.org/mbostock/01ab2e85e8727d6529d20391c0fd9a16
// Fisheye https://bost.ocks.org/mike/fisheye/

// Use donut chart for import visualisation https://bl.ocks.org/mbostock/3887193
// Use circular segment for contribution viz https://bl.ocks.org/mbostock/3422480

// Zoomable sub circles https://bl.ocks.org/mbostock/7607535

class GraphStore {
  @observable hoverId = null;
  @observable highlightedNodes = null;
  @observable selectedNodeIds = [];

  @computed get selectionInfo() {
    let key = this.hoverId || this.selectionId;
    return graphdata.nodesLookup[key]
  }

  @computed.struct get selectedNodes() {
    return Array.from(this.selectedNodeIds).map(id => { return graphdata.nodesLookup[id] })
  }

  mouseoverNode(id) {
    this.hoverId = id;
  }

  mouseoutNode(id) {
    this.hoverId = null;
  }

  selectNode(id) {
    if(!_.contains(this.selectedNodeIds, id))
      this.selectedNodeIds.push(id)
  }
  // toggleSelection(id) {
    // if(this.selectionId) this.selectionId = null;
    // else this.selectionId = id;
  // }

  clearSelection(id) {
    this.selectionId = null;
  }

  searchAndHighlightNodes(query) {
    if(query == "") {
      this.highlightedNodes = null;
      return
    }
    let matches = [];

    function splitId(id) {
      // return id.split(/(?=[A-Z])/g).reverse();
      return [id]
    }

    let searchData = graphdata.nodes.map(node => {
      return {
        id: node.id, 
        label: splitId(node.label),
      }
    })

    var options = {
      shouldSort: true,
      findAllMatches: true,
      includeScore: true,
      threshold: 0.3,
      location: 0,
      distance: 100,
      maxPatternLength: 32,
      minMatchCharLength: 2,
      keys: [
        "label"
      ]
    };

    let fuse = new Fuse(searchData, options);
    let results = fuse.search(query)
    this.highlightedNodes = results.filter(el => el.score < 0.7)
  }

  getNodeHighlight(id) {
    return this.highlightedNodes.filter(el => el.item.id == id)[0];
  }
}

const graphStore = new GraphStore()

const LoadingWrap = (props) => {
  if(props.data != null) return props.children;
  else return "";
}

@observer
class InfoView extends React.Component {
  searchNodes = (ev) => {
    this.props.store.searchAndHighlightNodes(ev.target.value)
  }

  toggleThread() {

  }

  render() {
    const store = this.props.store;

    let selectedNodes = store.selectedNodes;

    return <div className="ui-pane">
      <input type="text" placeholder="&#x1F50E; Find structs, funcs, methods..." className='search' onChange={this.searchNodes}/>
      <SelectedNodes selectedNodes={selectedNodes}/>
      <button onClick={this.toggleThread}>Show thread</button>

      <LoadingWrap data={store.selectionInfo}>
        <SelectionInfo sel={store.selectionInfo}/>
      </LoadingWrap>
    </div>
  }
}

const SelectedNodes = (props) => {
  return <div>
    {props.selectedNodes.map((node, i) => <SelectedNode key={i} node={node}/>)}
  </div>
}

const SelectedNode = (props) => {
  return <div>
    <div style={{ 
      backgroundColor: nodeColor(props.node.variant),
      padding: '0.25em',
      color: 'black',
      fontWeight: 800
    }}>{props.node.label}</div>
  </div>
}

const SelectionInfo = (props) => {
  return <div style={{ padding:'1em' }}>
    {graphdata.nodeTypes[props.sel.variant]} <br/>
    <b>{props.sel.label}</b>
  </div>
}


var nodeColor = d3.scaleOrdinal(d3.schemeCategory20);

function renderGraph(nodes, edges) {
  renderGraphD3(nodes, edges)
  // renderGraphVizJs()
}


function renderGraphVizJs(nodes, edges) {
  d3
    .select("#graph")
    .append('svg')
    .attr('width', '100%').attr('height', '100%')
    .graphviz()
    .renderDot(graphDot)
    .totalMemory(16777216 * 2)
}

function renderGraphD3(nodes, edges) {
  let graph = d3.select("#graph")
  var svg = d3.select("#graph").append('svg')
  .attr('width', '100%').attr('height', '100%')
  var width = 900;
  var height = 700;

  svg.append("defs").selectAll("marker")
    .data(["end"])
  .enter().append("svg:marker")
    .attr("id", String)
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 15)
    .attr("refY", -1.5)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
  .append("svg:path")
    .attr("d", "M0,-5L10,0L0,5");

  

  // Setup simulation
  // ----------------

  var simulation = d3.forceSimulation()
                                
  var link_force =  d3.forceLink(edges)
                      .id(function(d) { return d.id; })
                      .strength(1)
                      .distance(10)
  
  var charge_force = d3.forceManyBody()
                       .strength(-200)

  simulation
      .nodes(nodes)
      .force("links", link_force)
      .force('charge', charge_force)
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(function(d) {
        return 1 + radius(d)
      }))
   ;

  simulation.stop();

  d3.timeout(function() {  
    // See https://github.com/d3/d3-force/blob/master/README.md#simulation_tick
    for (var i = 0, n = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay())); i < n; ++i) {
      simulation.tick();
      tickActions()
    }
  });
          
  //add tick instructions: 
  // simulation.on("tick", tickActions );
  
  //add encompassing group for the zoom 
  var g = svg.append("g")
             .attr("class", "everything");

  //draw lines for the links 
  var link = g.append("g")
              .attr("class", "links")
              .selectAll("path")
              .data(edges)
              .enter()
              .append("path")
              .attr("class", "link")
              .attr("marker-end", "url(#end)");
  

  //draw circles for the nodes
  var node = g.append("g")
          .attr("class", "nodes") 
          .selectAll("g")
          .data(nodes)
          .enter()
          .append('g')
          .on("mouseover", function(d){
            graphStore.mouseoverNode(d.id)
          })
          .on("mouseout", function(d){
            graphStore.mouseoutNode(d.id)
          })
          .on('click', function(d) {
            // graphStore.toggleSelection(d.id)
            graphStore.selectNode(d.id)
          })

  

function radius(d) {
  const cradius = 18; 
  return cradius * d.rank;
}


// Color ContrastColor(Color color)
// {
//     int d = 0;

//     // Counting the perceptive luminance - human eye favors green color... 
//     double a = 1 - ( 0.299 * color.R + 0.587 * color.G + 0.114 * color.B)/255;

//     if (a < 0.5)
//        d = 0; // bright colors - black font
//     else
//        d = 255; // dark colors - white font

//     return  Color.FromArgb(d, d, d);
// }

  let circle = node.append("circle")
              .attr("r", radius)
              .attr("fill", (d) => nodeColor(d.variant))
  
  mobx.autorun(() => {
    if(graphStore.highlightedNodes == null) {
      node
        .attr('opacity', 1)
      
      circle
        .classed('selected', false)
      
      link
        .attr('opacity', 1)
      
    } else {
      node
        .attr('opacity', 0.2)
        .filter(function(d) {
          return graphStore.getNodeHighlight(d.id) != null;
        })
        .attr('opacity', function(d) {
          return 1 - graphStore.getNodeHighlight(d.id).score;
        });
      
      circle
        .classed('selected', function(d) {
          return _.has(graphStore.selectedNodeIds, d.id)
        })

      link
        .attr('opacity', 0)
    }
  })

  let label = node.append('text')
              .text(function(d) { return d.label })
              .style("font-size", function(d) {
                let size =  Math.min(2 * radius(d), (2 * radius(d) - 8) / this.getComputedTextLength() * 16);
                return `${size}px`; 
              })
              .attr("dy", ".35em")

  
  
  var zoom_handler = d3.zoom()
    // .scaleExtent([1, Infinity])
    // .translateExtent([[0, 0], [width, height]])
    // .extent([[0, 0], [width, height]])
    .on("zoom", () => {
      let transform = d3.event.transform;
      
      // g.attr("transform", d3.event.transform)
      g.style("transform", () => `translate3d(${transform.x}px, ${transform.y}px, 0px) scale(${transform.k})`)
    });
  
  zoom_handler(svg);   


  var drag_handler = d3.drag()
  .on("start", drag_start)
  .on("drag", drag_drag)
  .on("end", drag_end);	
  
  drag_handler(node);

  function drag_start(d) {
    if (!d3.event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
  }

  function drag_drag(d) {
    d.fx = d3.event.x;
    d.fy = d3.event.y;
  }
  
  function drag_end(d) {
    if (!d3.event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }


  function tickActions() {
    link.attr("d", function(d) {
      // Total difference in x and y from source to target
      let diffX = d.target.x - d.source.x;
      let diffY = d.target.y - d.source.y;

      // Length of path from center of source node to center of target node
      let pathLength = Math.sqrt((diffX * diffX) + (diffY * diffY));

      // x and y distances from center to outside edge of target node
      let offsetX = (diffX * radius(d.target)) / pathLength;
      let offsetY = (diffY * radius(d.target)) / pathLength;

      return "M" + d.source.x + "," + d.source.y + "L" + (d.target.x - offsetX) + "," + (d.target.y - offsetY);
    });
  
    // update circle positions each tick of the simulation 
    node
      // .attr("style", function (d) { return `transform: translate3d(${d.x}px, ${d.y}px, 0px)` })
      .attr('transform', (d) => `translate(${d.x} ${d.y})`)
          
    // update link positions 
    link
      .attr("x1", function(d) { return d.source.x; })
      .attr("y1", function(d) { return d.source.y; })
      .attr("x2", function(d) { return d.target.x; })
      .attr("y2", function(d) { return d.target.y; });
  } 
}


document.addEventListener('DOMContentLoaded', function() {
  ReactDOM.render(
    <InfoView store={graphStore}/>,
    document.getElementById('react-mount')
  );

  renderGraph(graphdata.nodes, graphdata.edges)
});
