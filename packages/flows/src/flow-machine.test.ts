import type { FlowDocument } from "@pointclick/contracts";
import { createInitialState, executeCommand } from "@pointclick/core";
import { advanceFlow, chooseFlowChoice, createFlowSession } from "./flow-machine";
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

  it("evaluates conditions, inventory commands, waits, and presentation cues", () => {
    const advancedFlow: FlowDocument = {
      schemaVersion: 1,
      id: "advanced",
      name: "Advanced flow",
      startNodeId: "condition",
      nodes: [
        {
          id: "condition",
          type: "condition",
          when: { type: "flag-equals", key: "ready", value: true },
          ifTrue: "add-item",
          ifFalse: "end"
        },
        { id: "add-item", type: "inventory", action: "add", itemId: "hook", next: "cue" },
        {
          id: "cue",
          type: "cue",
          cue: { type: "sound", key: "hook-pickup" },
          next: "wait"
        },
        { id: "wait", type: "wait", durationMs: 50, next: "end" },
        { id: "end", type: "end" }
      ]
    };
    const world = createInitialState("dock", { x: 0, y: 0 });
    const readyWorld = executeCommand(world, { type: "flag/set", key: "ready", value: true }).state;

    const waiting = advanceFlow(advancedFlow, createFlowSession(advancedFlow), readyWorld, { now: 100 });
    expect(waiting.commands).toEqual([{ type: "inventory/add", itemId: "hook" }]);
    expect(waiting.cues).toEqual([{ type: "sound", key: "hook-pickup" }]);
    expect(waiting.waitUntil).toBe(150);

    const complete = advanceFlow(advancedFlow, waiting.session, readyWorld, { now: 150 });
    expect(complete.commands).toEqual([{ type: "flow/end", flowId: "advanced" }]);
    expect(complete.session.done).toBe(true);
  });

  it("returns available choices and resumes at the selected branch", () => {
    const choiceFlow: FlowDocument = {
      schemaVersion: 1,
      id: "choice-flow",
      name: "Choice flow",
      startNodeId: "choice",
      nodes: [
        {
          id: "choice",
          type: "choice",
          promptKey: "question",
          choices: [
            { id: "yes", labelKey: "yes", next: "yes-line" },
            { id: "no", labelKey: "no", next: "no-line" }
          ]
        },
        { id: "yes-line", type: "line", speakerId: "mara", textKey: "yes", next: "end" },
        { id: "no-line", type: "line", speakerId: "mara", textKey: "no", next: "end" },
        { id: "end", type: "end" }
      ]
    };
    const world = createInitialState("dock", { x: 0, y: 0 });
    const session = createFlowSession(choiceFlow);
    const prompt = advanceFlow(choiceFlow, session, world);
    expect(prompt.promptKey).toBe("question");
    expect(prompt.choices.map((choice) => choice.id)).toEqual(["yes", "no"]);

    const selected = chooseFlowChoice(choiceFlow, prompt.session, "yes", world);
    expect(selected.line?.textKey).toBe("yes");
  });

  it("enters and returns from a sub-flow", () => {
    const child: FlowDocument = {
      schemaVersion: 1,
      id: "child",
      name: "Child",
      startNodeId: "line",
      nodes: [
        { id: "line", type: "line", speakerId: "mara", textKey: "child", next: "end" },
        { id: "end", type: "end" }
      ]
    };
    const parent: FlowDocument = {
      schemaVersion: 1,
      id: "parent",
      name: "Parent",
      startNodeId: "sub",
      nodes: [
        { id: "sub", type: "sub-flow", flowId: "child", next: "parent-line" },
        { id: "parent-line", type: "line", speakerId: "mara", textKey: "parent", next: "end" },
        { id: "end", type: "end" }
      ]
    };
    const world = createInitialState("dock", { x: 0, y: 0 });
    const first = advanceFlow(parent, createFlowSession(parent), world, { flows: { parent, child } });
    expect(first.commands).toEqual([{ type: "flow/start", flowId: "child" }]);
    expect(first.line?.textKey).toBe("child");

    const returned = advanceFlow(child, first.session, world, { flows: { parent, child } });
    expect(returned.commands).toEqual([{ type: "flow/end", flowId: "child" }]);
    expect(returned.session.flowId).toBe("parent");
    expect(returned.session.currentNodeId).toBe("end");
    expect(returned.line?.textKey).toBe("parent");
  });
});
