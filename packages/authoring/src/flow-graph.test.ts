import type { FlowDocument, ProjectBundle } from "@pointclick/contracts";
import { describe, expect, it } from "vitest";
import { buildFlowGraph, buildPuzzleDependencyView, validateFlowGraph } from "./flow-graph";

const flow: FlowDocument = {
  schemaVersion: 2,
  id: "puzzle",
  name: "Puzzle",
  startNodeId: "condition",
  nodes: [
    {
      id: "condition",
      type: "condition",
      when: { type: "item-in-inventory", itemId: "key" },
      ifTrue: "end",
      ifFalse: "line"
    },
    { id: "line", type: "line", speakerId: "mara", textKey: "line", next: "end" },
    { id: "end", type: "end" }
  ]
};

describe("flow graph authoring model", () => {
  it("builds conditional edges and validates reachability", () => {
    const graph = buildFlowGraph(flow);
    expect(graph.edges).toEqual([
      { from: "condition", to: "end", kind: "condition-true" },
      { from: "condition", to: "line", kind: "condition-false" },
      { from: "line", to: "end", kind: "next" }
    ]);
    expect(validateFlowGraph(flow)).toEqual([]);
  });

  it("reports missing targets and exposes puzzle dependencies", () => {
    const invalid = { ...flow, nodes: [{ ...flow.nodes[1]!, next: "missing" }, flow.nodes[2]!] };
    expect(validateFlowGraph(invalid).some((diagnostic) => diagnostic.code === "missing-start")).toBe(true);

    const bundle = {
      scenes: {
        room: {
          type: "layered-2d",
          hotspots: [
            {
              id: "door",
              actions: { useItemFlows: [{ itemId: "key", flowId: "puzzle" }] }
            }
          ],
          actors: [],
          pickups: []
        }
      },
      flows: { puzzle: flow }
    } as unknown as ProjectBundle;
    expect(buildPuzzleDependencyView(bundle)).toContainEqual({
      flowId: "puzzle",
      sourceId: "door",
      itemId: "key",
      targetId: "door",
      kind: "hotspot-use"
    });
  });
});
