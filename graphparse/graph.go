package graphparse

import (
	"bufio"
	"fmt"
	"os"
	"sort"
	"path/filepath"
	"go/types"
	"encoding/json"
	"bytes"
	"github.com/dcadenas/pagerank"
)


var nodeLookup = make(map[nodeid]Node)

func addNodeToLookup(n Node) {
	nodeLookup[n.Id()] = n
}

// how to prune intermediates?
// a -> b -> c
// prune b
// a -> c

// e -> 
// a -> b -> c
//		  -> d -> a
// a -> c

// then

// e -> a
// a -> c
// a -> d

type NodeType int
const (
	Struct NodeType = iota
	Method
	Func
	Field
	RootPackage
	File
	ImportedPackage
	ImportedFunc
	FuncCall
)

type baseNode struct {
	variant NodeType
	label string
}

type Node interface {
	Id() nodeid
	Label() string
	Variant() NodeType
}

type objNode struct {
	obj types.Object
	baseNode
}

type objlookup struct {
	id string
}
var objLookups = make(map[string]*objlookup)
func (n *objNode) Id() nodeid {
	switch n.variant {
	case Struct:
		switch typ := n.obj.Type().(type) {
		case *types.Named:
			id := nodeid(typ.Obj().Pos())
			return id
		case *types.Pointer:
			id := nodeid(typ.Elem().(*types.Named).Obj().Pos())
			return id
		default:
			panic("cant find type of struct Object")
		}
	default:
		objId := n.obj.String()
		x, ok := objLookups[objId]
		if !ok {
			x = &objlookup{objId}
			objLookups[objId] = x
		}
		return pointerToId(x)
	}

	// if objId == "Run" {
	// 	fmt.Println(n.obj.String())
	// }
	// objId := string(n.obj.Pos()) + n.obj.Id()
	
	panic("cant get id")
}
func (n *objNode) Label() string {
	return n.baseNode.label
}
func (n *objNode) Variant() NodeType {
	return n.baseNode.variant
}


func LookupOrCreateNode(obj types.Object, variant NodeType, label string) *objNode {
	if obj == nil {
		panic("obj must be non-nil")
	}
	id := pointerToId(obj)

	node, ok := nodeLookup[id]

	if !ok {
		node = &objNode{
			obj,
			baseNode{variant, label},
		}
		addNodeToLookup(node)
	}

	return node.(*objNode)
}

func LookupNode(obj types.Object) *objNode {
	if obj == nil {
		panic("obj must be non-nil")
	}
	id := pointerToId(obj)

	node, ok := nodeLookup[id]
	if !ok {
		panic("node not found")
	}
	return node.(*objNode)
}

var canonicalNodeLookup = make(map[string]*canonicalNode)

type canonicalNode struct {
	baseNode
}

func (n *canonicalNode) Id() nodeid {
	return pointerToId(n)
}
func (n *canonicalNode) Label() string {
	return n.baseNode.label
}
func (n *canonicalNode) Variant() NodeType {
	return n.baseNode.variant
}

func LookupOrCreateCanonicalNode(key string, variant NodeType, label string) *canonicalNode {
	node, ok := canonicalNodeLookup[key]

	if !ok {
		node = &canonicalNode{
			baseNode{variant, label},
		}
		canonicalNodeLookup[key] = node
		addNodeToLookup(node)
	}

	return node
} 

type nodeid int64

type edge []Node

type graph struct {
	edges []edge
}

func NewGraph() *graph {
	return &graph{
	}
}


type pointerGraph struct {

}
func (g *graph) toPointerGraph() *pointerGraph {
	return nil
}

func (graph *graph) AddEdge(from, to Node) {
	if from == nil {
		panic("from node must be non-nil")
	}
	if to == nil {
		panic("to node must be non-nil")
	}
	if _, ok := nodeLookup[from.Id()]; !ok {
		panic("from node doesn't exist, cannot add edge")
	}
	if _, ok := nodeLookup[to.Id()]; !ok {
		panic("to node doesn't exist, cannot add edge")
	}
	e := edge{from, to}
	graph.edges = append(graph.edges, e)
}


// func (g *graph) ToDot() string {
// 	printToStdout := false
// 	dotfilePath, _ := filepath.Abs("./www/graph.dot")
// 	f, err := os.Create(dotfilePath)

// 	if err != nil {
// 		panic(err)
// 	}
// 	if printToStdout {
// 		f = os.Stdout
// 	} else {
// 		defer f.Close()
// 	}
// 	w := bufio.NewWriter(f)
// 	defer w.Flush()

// 	fmt.Println(len(this.edges), "edges and", len(nodeLookup), "nodes")

// 	// Compute PageRank distribution
// 	graph := pagerank.New()
// 	for _, edge := range this.edges {
// 		graph.Link(int(edge[0].Id()), int(edge[1].Id()))
// 	}

// 	probability_of_following_a_link := 0.85
// 	tolerance := 0.05

// 	// Generate .dot file for graphviz
// 	// ------
// 	w.WriteString("digraph graphname {\n")

// 	// 1. Node definitions
// 	var ranks rankPairList
// 	graph.Rank(probability_of_following_a_link, tolerance, func(identifier int, rank float64) {
// 		ranks = append(ranks, rankPair{nodeid(identifier), rank})
// 	})

// 	// normalise ranks to something that is nice to look at
// 	sort.Sort(ranks)

// 	minSize, maxSize := 1.0, 6.0
// 	min, max := ranks[0].Rank, ranks[len(ranks)-1].Rank

// 	scaleRank := func(rank float64) float64 {
// 		return (maxSize - minSize)  *  (rank - min)/(max - min) + minSize
// 	}
// 	fmt.Println("smallest node is", min, scaleRank(min))
// 	fmt.Println("biggest node is", max, scaleRank(max))

// 	for _, rank := range ranks {
// 		node := nodeLookup[rank.NodeId]
// 		rankStretched := scaleRank(rank.Rank)

// 		switch(node.Variant()) {
// 		// case RootPackage, Struct, Method:
// 		default:
// 			fmt.Fprintf(w, "%v [width=%v] [height=%v] [label=\"%v\"];\n", rank.NodeId, rankStretched, rankStretched, node.Label())
// 			// break
// 		// default:
// 			// fmt.Fprintf(w, "%v [label=\"%v\"];\n", rank.NodeId, node.Label())
// 		}
// 	}

// 	// 2. Edges
// 	for _, edge := range this.edges {
// 		from := edge[1]
// 		// to := edge[0]

// 		switch(from.Variant()) {
// 		// case RootPackage, ImportedPackage, Struct, Method:
// 		default:
// 			fmt.Fprintf(w, "\"%v\" -> \"%v\";\n", edge[1].Id(), edge[0].Id())
// 		}
// 	}

// 	w.WriteString("}\n")
// }


type jsonNodeDef struct {
	Rank float64 `json:"rank"`
	Label string `json:"label"`
	Id nodeid `json:"id"`
	Variant NodeType `json:"variant"`
}
type jsonNodeEdge struct {
	From nodeid `json:"source"`
	To nodeid   `json:"target"`
}
type jsonGraph struct {
	NodesLookup map[nodeid]jsonNodeDef `json:"nodesLookup"`
	Nodes []jsonNodeDef `json:"nodes"`
	Edges []jsonNodeEdge 		 `json:"edges"`
}
func newJsonGraph() jsonGraph {
	return jsonGraph{
		NodesLookup: make(map[nodeid]jsonNodeDef),
	}
}

func (g *graph) ToJson() {
	buf := new(bytes.Buffer)
	
	path, _ := filepath.Abs("./www/graph.json")
	f, err := os.Create(path)

	if err != nil {
		panic(err)
	}
	defer f.Close()
	w := bufio.NewWriter(f)
	defer w.Flush()

	fmt.Println(len(g.edges), "edges and", len(nodeLookup), "nodes")

	// Compute PageRank distribution
	graph := pagerank.New()
	for _, edge := range g.edges {
		graph.Link(int(edge[0].Id()), int(edge[1].Id()))
	}

	probability_of_following_a_link := 0.85
	tolerance := 0.05


	// 1. Node definitions
	var ranks rankPairList
	graph.Rank(probability_of_following_a_link, tolerance, func(identifier int, rank float64) {
		ranks = append(ranks, rankPair{nodeid(identifier), rank})
	})

	// normalise ranks to something that is nice to look at
	sort.Sort(ranks)

	minSize, maxSize := 1.0, 6.0
	min, max := ranks[0].Rank, ranks[len(ranks)-1].Rank

	scaleRank := func(rank float64) float64 {
		return (maxSize - minSize)  *  (rank - min)/(max - min) + minSize
	}
	fmt.Println("smallest node is", min, scaleRank(min))
	fmt.Println("biggest node is", max, scaleRank(max))


	jsonGraph := newJsonGraph()

	for _, rank := range ranks {
		node := nodeLookup[rank.NodeId]
		rankStretched := scaleRank(rank.Rank)

		switch(node.Variant()) {
		default:
			// fmt.Fprintf(w, "%v [width=%v] [height=%v] [label=\"%v\"];\n", rank.NodeId, rankStretched, rankStretched, node.Label())
			n := jsonNodeDef{
				Rank: rankStretched,
				Label: node.Label(),
				Id: node.Id(),
				Variant: node.Variant(),
			}
			jsonGraph.NodesLookup[rank.NodeId] = n
			jsonGraph.Nodes = append(jsonGraph.Nodes, n)
		}
	}

	// 2. Edges
	for _, edge := range g.edges {
		from := edge[1]
		// to := edge[0]

		switch(from.Variant()) {
		// case RootPackage, ImportedPackage, Struct, Method:
		default:
			// fmt.Fprintf(w, "\"%v\" -> \"%v\";\n", edge[1].Id(), edge[0].Id())
			jsonGraph.Edges = append(jsonGraph.Edges, jsonNodeEdge{
				edge[1].Id(), 
				edge[0].Id(),
			})
		}
	}

	json.NewEncoder(buf).Encode(jsonGraph)
	f.WriteString(buf.String())
}
