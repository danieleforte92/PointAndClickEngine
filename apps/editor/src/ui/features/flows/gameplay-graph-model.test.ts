import { describe, expect, it } from "vitest";
import type { FlowDocument, Layered2DScene } from "@pointclick/contracts";
import { deriveGameplayGraph } from "./gameplay-graph-model";

const scene = (id: string, ownsFlow = id === "room"): Layered2DScene => ({
  id,
  name: id,
  schemaVersion: 3,
  type: "layered-2d",
  size: { width: 640, height: 360 },
  background: "test-background",
  playerStart: { x: 20, y: 20 },
  walkArea: { points: [{ x: 0, y: 0 }, { x: 640, y: 0 }, { x: 640, y: 360 }] },
  actors: [],
  pickups: [],
  shapes: [],
  hotspots: [{ id: "door", labelKey: "door", bounds: { x: 1, y: 1, width: 20, height: 20 }, actions: { useItemFlows: ownsFlow ? [{ itemId: "key", flowId: "open" }] : [] } }]
});

const flow: FlowDocument = {
  id: "open",
  name: "Open door",
  schemaVersion: 3,
  startNodeId: "change",
  nodes: [{ id: "change", type: "change-scene", targetSceneId: "hall", next: "end" }, { id: "end", type: "end" }]
};

describe("Gameplay graph derivation", () => {
  it("derives scene edges from existing hotspot flows", () => {
    const result = deriveGameplayGraph([scene("room"), scene("hall")], [flow]);
    expect(result.nodes.map((node) => node.id)).toEqual(["scene:room", "scene:hall", "flow:open"]);
    expect(result.edges).toEqual([{ id: "room:open:change:0", source: "scene:room", target: "scene:hall", flowId: "open", label: "Open door", targetSceneId: "hall" }]);
  });

  it("does not invent an executable document for unowned flows", () => {
    const unowned = { ...flow, id: "unowned", name: "Unowned" };
    expect(deriveGameplayGraph([scene("room"), scene("hall")], [unowned]).edges).toEqual([]);
  });
});
