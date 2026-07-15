import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import { buildFlowGraph, type FlowGraphDiagnostic } from "@pointclick/authoring";
import { buildFlowNodes, createNewFlowNode, type DraftNodeType, type FlowDraft, type FlowDraftNode } from "../../../editor-session";

interface NarrativeNodeData extends Record<string, unknown> {
  diagnosticCount: number;
  draft: FlowDraftNode;
  isStart: boolean;
}

const nodeTypeLabels: Record<FlowDraftNode["type"], string> = {
  line: "Dialogue line",
  "set-flag": "Set flag",
  "change-scene": "Change scene",
  choice: "Choice",
  condition: "Condition",
  "sub-flow": "Sub-flow",
  inventory: "Inventory",
  wait: "Wait",
  cue: "Presentation cue",
  end: "End"
};

function summaryFor(node: FlowDraftNode): string {
  switch (node.type) {
    case "line": return node.textKey || "Missing text key";
    case "set-flag": return `${node.key || "flag"} = ${node.value}`;
    case "change-scene": return node.targetSceneId || "Choose a scene";
    case "choice": return `${node.choices.length} option(s)`;
    case "condition": return node.when.type === "flag-equals" ? node.when.key || "Flag condition" : node.when.itemId || "Inventory condition";
    case "sub-flow": return node.flowId || "Choose a flow";
    case "inventory": return `${node.action} ${node.itemId || "item"}`;
    case "wait": return `${node.durationMs || "0"} ms`;
    case "cue": return `${node.cueType}${node.cueKey ? ` · ${node.cueKey}` : ""}`;
    case "end": return "Flow terminates";
  }
}

function NarrativeNode({ data, selected }: NodeProps<Node<NarrativeNodeData>>) {
  const { draft, diagnosticCount, isStart } = data;
  return (
    <article className={`narrative-node ${selected ? "selected" : ""} ${diagnosticCount ? "has-diagnostics" : ""}`}>
      {draft.type !== "end" ? <Handle type="target" position={Position.Left} /> : <Handle type="target" position={Position.Left} />}
      <header>
        <span>{nodeTypeLabels[draft.type]}</span>
        {isStart ? <strong>Start</strong> : null}
      </header>
      <h3>{draft.id || "Untitled node"}</h3>
      <p>{summaryFor(draft)}</p>
      {diagnosticCount ? <small>{diagnosticCount} issue(s)</small> : null}
      {draft.type === "condition" ? (
        <>
          <Handle id="ifTrue" type="source" position={Position.Right} style={{ top: "38%" }} />
          <Handle id="ifFalse" type="source" position={Position.Right} style={{ top: "72%" }} />
        </>
      ) : draft.type === "choice" ? (
        draft.choices.map((choice, index) => (
          <Handle
            id={choice.id}
            key={choice.id}
            type="source"
            position={Position.Right}
            style={{ top: `${Math.round(((index + 1) / (draft.choices.length + 1)) * 100)}%` }}
          />
        ))
      ) : draft.type !== "end" ? <Handle id="next" type="source" position={Position.Right} /> : null}
    </article>
  );
}

const nodeTypes = { narrative: NarrativeNode };

export function buildDeterministicFlowLayout(draft: FlowDraft): NonNullable<FlowDraft["editorLayout"]> {
  const graph = buildFlowGraph({
    schemaVersion: 1,
    id: draft.id,
    name: draft.name || draft.id,
    startNodeId: draft.startNodeId,
    nodes: buildFlowNodes(draft.nodes)
  });
  const outgoing = new Map<string, string[]>();
  for (const edge of graph.edges) outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
  const levels = new Map<string, number>([[draft.startNodeId, 0]]);
  const queue = [draft.startNodeId];
  while (queue.length) {
    const id = queue.shift()!;
    const level = levels.get(id) ?? 0;
    for (const target of outgoing.get(id) ?? []) {
      if (levels.has(target)) continue;
      levels.set(target, level + 1);
      queue.push(target);
    }
  }
  const perLevel = new Map<number, number>();
  const nodes = Object.fromEntries(draft.nodes.map((node, index) => {
    const level = levels.get(node.id) ?? Math.max(0, ...levels.values()) + 1;
    const row = perLevel.get(level) ?? 0;
    perLevel.set(level, row + 1);
    return [node.id, { x: 80 + level * 310, y: 64 + row * 176 + (levels.has(node.id) ? 0 : index * 12) }];
  }));
  return { nodes, viewport: { x: 0, y: 0, zoom: 0.9 } };
}

function connectDraftNode(node: FlowDraftNode, connection: Connection): FlowDraftNode {
  const target = connection.target ?? "";
  if (node.type === "condition") {
    return connection.sourceHandle === "ifFalse" ? { ...node, ifFalse: target } : { ...node, ifTrue: target };
  }
  if (node.type === "choice") {
    return {
      ...node,
      choices: node.choices.map((choice) => choice.id === connection.sourceHandle ? { ...choice, next: target } : choice)
    };
  }
  return node.type === "end" ? node : { ...node, next: target };
}

export interface NarrativeGraphProps {
  diagnostics: readonly FlowGraphDiagnostic[];
  draft: FlowDraft;
  onChange: (recipe: (draft: FlowDraft) => FlowDraft) => void;
  onSelectNode: (nodeId: string) => void;
  selectedNodeId: string | null;
}

export function NarrativeGraph({ diagnostics, draft, onChange, onSelectNode, selectedNodeId }: NarrativeGraphProps) {
  const layout = draft.editorLayout ?? buildDeterministicFlowLayout(draft);
  const diagnosticsByNode = useMemo(() => {
    const map = new Map<string, number>();
    for (const diagnostic of diagnostics) {
      if (diagnostic.nodeId) map.set(diagnostic.nodeId, (map.get(diagnostic.nodeId) ?? 0) + 1);
    }
    return map;
  }, [diagnostics]);
  const nodes: Array<Node<NarrativeNodeData>> = draft.nodes.map((node) => ({
    id: node.id,
    type: "narrative",
    position: layout.nodes[node.id] ?? { x: 80, y: 80 },
    selected: node.id === selectedNodeId,
    data: { draft: node, diagnosticCount: diagnosticsByNode.get(node.id) ?? 0, isStart: node.id === draft.startNodeId }
  }));
  const edges: Edge[] = buildFlowGraph({
    schemaVersion: 1,
    id: draft.id,
    name: draft.name || draft.id,
    startNodeId: draft.startNodeId,
    nodes: buildFlowNodes(draft.nodes)
  }).edges.map((edge, index) => ({
    id: `${edge.from}-${edge.kind}-${edge.label ?? index}`,
    source: edge.from,
    sourceHandle: edge.kind === "condition-true" ? "ifTrue" : edge.kind === "condition-false" ? "ifFalse" : edge.kind === "choice" ? edge.label ?? null : "next",
    target: edge.to,
    ...(edge.kind === "condition-true"
      ? { label: "true" }
      : edge.kind === "condition-false"
        ? { label: "false" }
        : edge.label
          ? { label: edge.label }
          : {}),
    animated: edge.from === draft.startNodeId
  }));

  const handleNodeChanges = (changes: NodeChange[]) => {
    const positions = { ...layout.nodes };
    let changed = false;
    for (const change of changes) {
      if (change.type === "position" && change.position) {
        positions[change.id] = change.position;
        changed = true;
      }
      if (change.type === "select" && change.selected) onSelectNode(change.id);
    }
    if (changed) onChange((current) => ({ ...current, editorLayout: { ...layout, nodes: positions } }));
  };

  return (
    <section className="narrative-graph-workspace" aria-label={`Narrative graph ${draft.name}`}>
      <div className="narrative-graph-actions">
        <div>
          <span>Narrative graph</span>
          <strong>{draft.name}</strong>
        </div>
        <button type="button" onClick={() => onChange((current) => ({ ...current, editorLayout: buildDeterministicFlowLayout(current) }))}>
          Auto layout
        </button>
        <button
          type="button"
          onClick={() => {
            const node = createNewFlowNode("line", draft.nodes);
            onChange((current) => ({ ...current, nodes: [...current.nodes, node] }));
            onSelectNode(node.id);
          }}
        >
          Quick add
        </button>
        <button
          type="button"
          disabled={!selectedNodeId}
          onClick={() => {
            if (!selectedNodeId) return;
            const source = draft.nodes.find((node) => node.id === selectedNodeId);
            if (!source) return;
            const duplicate = createNewFlowNode(source.type, draft.nodes);
            const cloned = { ...source, ...duplicate, id: duplicate.id } as FlowDraftNode;
            onChange((current) => ({ ...current, nodes: [...current.nodes, cloned] }));
            onSelectNode(cloned.id);
          }}
        >
          Duplicate selected
        </button>
      </div>
      <div className="narrative-node-palette" aria-label="Node palette">
        {(["line", "set-flag", "change-scene", "choice", "condition", "sub-flow", "inventory", "wait", "cue", "end"] as DraftNodeType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => {
              const node = createNewFlowNode(type, draft.nodes);
              onChange((current) => ({ ...current, nodes: [...current.nodes, node] }));
              onSelectNode(node.id);
            }}
          >
            + {nodeTypeLabels[type]}
          </button>
        ))}
        <button
          type="button"
          disabled={!selectedNodeId || draft.nodes.length <= 1}
          onClick={() => {
            if (!selectedNodeId) return;
            onChange((current) => ({
              ...current,
              nodes: current.nodes.filter((node) => node.id !== selectedNodeId),
              startNodeId: current.startNodeId === selectedNodeId ? current.nodes.find((node) => node.id !== selectedNodeId)?.id ?? current.startNodeId : current.startNodeId
            }));
            onSelectNode(draft.startNodeId);
          }}
        >
          Delete selected
        </button>
      </div>
      <ReactFlow
        colorMode="dark"
        deleteKeyCode={"Backspace"}
        edges={edges}
        fitView
        minZoom={0.25}
        nodes={nodes}
        nodeTypes={nodeTypes}
        onConnect={(connection) => onChange((current) => ({
          ...current,
          nodes: current.nodes.map((node) => node.id === connection.source ? connectDraftNode(node, connection) : node)
        }))}
        onReconnect={(_edge, connection) => onChange((current) => ({
          ...current,
          nodes: current.nodes.map((node) => node.id === connection.source ? connectDraftNode(node, connection) : node)
        }))}
        onNodeClick={(_event, node) => onSelectNode(node.id)}
        onNodesDelete={(deleted) => {
          const deletedIds = new Set(deleted.map((node) => node.id));
          onChange((current) => ({
            ...current,
            nodes: current.nodes.filter((node) => !deletedIds.has(node.id)),
            startNodeId: deletedIds.has(current.startNodeId) ? current.nodes.find((node) => !deletedIds.has(node.id))?.id ?? current.startNodeId : current.startNodeId
          }));
        }}
        onNodesChange={handleNodeChanges}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--pc-border-strong)" gap={28} size={1} />
        <MiniMap pannable zoomable nodeColor={(node) => node.id === draft.startNodeId ? "var(--pc-state-warning)" : "var(--pc-state-info)"} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </section>
  );
}
