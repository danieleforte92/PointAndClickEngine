import { describe, expect, it } from "vitest";
import type { RuntimeDebugSnapshot } from "@pointclick/contracts";
import { firstRuntimeTraceDivergence } from "./trace-diff";

function snapshot(sequence: number): RuntimeDebugSnapshot {
  return {
    sequence,
    sceneId: "dock",
    player: { x: 10, y: 20 },
    flags: {},
    inventory: [],
    activeFlowId: null,
    activeNodeId: null,
    dialogueKey: null,
    path: [],
    events: [],
    audio: []
  };
}

describe("runtime trace diff", () => {
  it("reports the first deterministic state divergence", () => {
    const expected = [snapshot(0), { ...snapshot(1), inventory: ["hook"] }];
    const actual = [snapshot(0), { ...snapshot(1), inventory: [] }];
    expect(firstRuntimeTraceDivergence(expected, actual)).toMatchObject({
      field: "inventory",
      index: 1,
      sequence: 1
    });
  });

  it("returns null for equivalent traces", () => {
    expect(firstRuntimeTraceDivergence([snapshot(0)], [snapshot(0)])).toBeNull();
  });
});
