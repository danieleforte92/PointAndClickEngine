import { describe, expect, it } from "vitest";
import { applyEvent, createInitialState, executeCommand, replay } from "./index";

describe("deterministic command/event core", () => {
  it("replays to the same state", () => {
    const initial = createInitialState("dock", { x: 10, y: 20 });
    const started = executeCommand(initial, { type: "game/start" });
    const walked = executeCommand(started.state, { type: "character/walk", x: 50, y: 70 });
    const events = [...started.events, ...walked.events];

    expect(replay(initial, events)).toEqual(walked.state);
    expect(events.reduce(applyEvent, initial).sequence).toBe(2);
  });

  it("does not emit duplicate idempotent state changes", () => {
    const initial = createInitialState("dock", { x: 0, y: 0 });
    const first = executeCommand(initial, { type: "flag/set", key: "door.open", value: true });
    const duplicate = executeCommand(first.state, {
      type: "flag/set",
      key: "door.open",
      value: true
    });

    expect(first.events).toHaveLength(1);
    expect(duplicate.events).toEqual([]);
  });
});

