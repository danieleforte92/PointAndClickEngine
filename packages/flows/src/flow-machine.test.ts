import type { FlowDocument } from "@pointclick/contracts";
import { createInitialState, executeCommand } from "@pointclick/core";
import { advanceFlow, createFlowSession } from "./flow-machine";
import { describe, expect, it } from "vitest";

const flow: FlowDocument = {
  schemaVersion: 1,
  id: "inspect-door",
  name: "Inspect door",
  startNodeId: "mark-seen",
  nodes: [
    {
      id: "mark-seen",
      type: "set-flag",
      key: "door.seen",
      value: true,
      next: "line-one"
    },
    {
      id: "line-one",
      type: "line",
      speakerId: "mara",
      textKey: "door.line",
      next: "done"
    },
    { id: "done", type: "end" }
  ]
};

describe("flow machine", () => {
  it("emits commands before yielding a dialogue line", () => {
    const world = createInitialState("dock", { x: 0, y: 0 });
    const step = advanceFlow(flow, createFlowSession(flow), world);
    const updated = step.commands.reduce(
      (state, command) => executeCommand(state, command).state,
      world
    );

    expect(step.line?.textKey).toBe("door.line");
    expect(updated.flags["door.seen"]).toBe(true);
  });

  it("emits scene change commands from transition nodes", () => {
    const transitionFlow: FlowDocument = {
      schemaVersion: 1,
      id: "enter-tavern",
      name: "Enter tavern",
      startNodeId: "transition",
      nodes: [
        {
          id: "transition",
          type: "change-scene",
          targetSceneId: "tavern",
          playerStart: { x: 300, y: 580 },
          next: "done"
        },
        { id: "done", type: "end" }
      ]
    };
    const world = createInitialState("dock", { x: 0, y: 0 });
    const step = advanceFlow(transitionFlow, createFlowSession(transitionFlow), world);

    expect(step.commands).toEqual([
      { type: "scene/change", sceneId: "tavern", player: { x: 300, y: 580 } },
      { type: "flow/end", flowId: "enter-tavern" }
    ]);
    expect(step.session.done).toBe(true);
  });
});
