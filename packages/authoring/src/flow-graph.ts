import type { FlowDocument, FlowNode, ProjectBundle } from "@pointclick/contracts";

export interface FlowGraphNode {
  id: string;
  type: FlowNode["type"];
  index: number;
}

export interface FlowGraphEdge {
  from: string;
  to: string;
  kind: "next" | "condition-true" | "condition-false" | "choice";
  label?: string;
}

export interface FlowGraph {
  flowId: string;
  nodes: FlowGraphNode[];
  edges: FlowGraphEdge[];
}

export interface FlowGraphDiagnostic {
  code: "duplicate-node" | "missing-target" | "missing-start" | "unreachable-node" | "missing-sub-flow";
  nodeId?: string;
  targetId?: string;
  message: string;
  severity: "error" | "warning";
}

export interface PuzzleDependency {
  flowId: string;
  sourceId: string;
  itemId: string;
  targetId: string;
  kind: "hotspot-use" | "actor-use" | "pickup-use" | "flow-condition";
}

function nextTargets(node: FlowNode): FlowGraphEdge[] {
  if (node.type === "end" || node.type === "choice") {
    return node.type === "choice"
      ? node.choices.map((choice) => ({
          from: node.id,
          to: choice.next,
          kind: "choice" as const,
          label: choice.id
        }))
      : [];
  }
  if (node.type === "condition") {
    return [
      { from: node.id, to: node.ifTrue, kind: "condition-true" },
      { from: node.id, to: node.ifFalse, kind: "condition-false" }
    ];
  }
  return [{ from: node.id, to: node.next, kind: "next" }];
}

export function buildFlowGraph(flow: FlowDocument): FlowGraph {
  return {
    flowId: flow.id,
    nodes: flow.nodes.map((node, index) => ({ id: node.id, type: node.type, index })),
    edges: flow.nodes.flatMap(nextTargets)
  };
}

export function validateFlowGraph(
  flow: FlowDocument,
  flows: Readonly<Record<string, FlowDocument>> = {}
): FlowGraphDiagnostic[] {
  const graph = buildFlowGraph(flow);
  const diagnostics: FlowGraphDiagnostic[] = [];
  const nodes = new Set<string>();
  for (const node of graph.nodes) {
    if (nodes.has(node.id)) {
      diagnostics.push({
        code: "duplicate-node",
        nodeId: node.id,
        message: `Flow "${flow.id}" contains duplicate node "${node.id}".`,
        severity: "error"
      });
    }
    nodes.add(node.id);
  }

  if (!nodes.has(flow.startNodeId)) {
    diagnostics.push({
      code: "missing-start",
      targetId: flow.startNodeId,
      message: `Flow "${flow.id}" starts at missing node "${flow.startNodeId}".`,
      severity: "error"
    });
  }

  for (const edge of graph.edges) {
    if (!nodes.has(edge.to)) {
      diagnostics.push({
        code: "missing-target",
        nodeId: edge.from,
        targetId: edge.to,
        message: `Node "${edge.from}" points to missing node "${edge.to}".`,
        severity: "error"
      });
    }
  }

  for (const node of flow.nodes) {
    if (node.type === "sub-flow" && !flows[node.flowId]) {
      diagnostics.push({
        code: "missing-sub-flow",
        nodeId: node.id,
        targetId: node.flowId,
        message: `Node "${node.id}" calls missing sub-flow "${node.flowId}".`,
        severity: "error"
      });
    }
  }

  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from)?.push(edge.to);
  }
  const reachable = new Set<string>();
  const pending = [flow.startNodeId];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || reachable.has(current)) continue;
    reachable.add(current);
    pending.push(...(adjacency.get(current) ?? []));
  }
  for (const node of flow.nodes) {
    if (!reachable.has(node.id)) {
      diagnostics.push({
        code: "unreachable-node",
        nodeId: node.id,
        message: `Node "${node.id}" is not reachable from "${flow.startNodeId}".`,
        severity: "warning"
      });
    }
  }
  return diagnostics;
}

export function buildPuzzleDependencyView(bundle: ProjectBundle): PuzzleDependency[] {
  const dependencies: PuzzleDependency[] = [];
  for (const scene of Object.values(bundle.scenes)) {
    if (scene.type !== "layered-2d") continue;
    for (const hotspot of scene.hotspots) {
      for (const mapping of hotspot.actions.useItemFlows) {
        dependencies.push({
          flowId: mapping.flowId,
          sourceId: hotspot.id,
          itemId: mapping.itemId,
          targetId: hotspot.id,
          kind: "hotspot-use"
        });
      }
    }
    for (const actor of scene.actors) {
      for (const mapping of actor.actions.useItemFlows) {
        dependencies.push({
          flowId: mapping.flowId,
          sourceId: actor.id,
          itemId: mapping.itemId,
          targetId: actor.id,
          kind: "actor-use"
        });
      }
    }
    for (const pickup of scene.pickups) {
      if (pickup.pickupFlowId) {
        dependencies.push({
          flowId: pickup.pickupFlowId,
          sourceId: pickup.id,
          itemId: pickup.itemId,
          targetId: pickup.id,
          kind: "pickup-use"
        });
      }
    }
  }
  for (const flow of Object.values(bundle.flows)) {
    for (const node of flow.nodes) {
      if (node.type === "condition" && node.when.type === "item-in-inventory") {
        dependencies.push({
          flowId: flow.id,
          sourceId: node.id,
          itemId: node.when.itemId,
          targetId: node.id,
          kind: "flow-condition"
        });
      }
    }
  }
  return dependencies;
}
