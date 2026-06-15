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

  it("tracks active verb and selected inventory item", () => {
    const initial = createInitialState("dock", { x: 0, y: 0 });

    const selectedVerb = executeCommand(initial, { type: "verb/select", verb: "use" });
    const selectedItem = executeCommand(selectedVerb.state, {
      type: "inventory/select",
      itemId: "rusty-hook"
    });
    const toggledOff = executeCommand(selectedItem.state, {
      type: "inventory/select",
      itemId: "rusty-hook"
    });

    expect(selectedVerb.state.activeVerb).toBe("use");
    expect(selectedItem.state.selectedItemId).toBe("rusty-hook");
    expect(toggledOff.state.selectedItemId).toBeNull();
  });

  it("collects pickups only once and keeps inventory unique", () => {
    const initial = createInitialState("dock", { x: 0, y: 0 });

    const first = executeCommand(initial, {
      type: "pickup/collect",
      pickupId: "dock-hook",
      itemId: "rusty-hook"
    });
    const duplicate = executeCommand(first.state, {
      type: "pickup/collect",
      pickupId: "dock-hook",
      itemId: "rusty-hook"
    });

    expect(first.state.inventory).toEqual(["rusty-hook"]);
    expect(first.state.collectedPickups).toEqual(["dock-hook"]);
    expect(duplicate.events).toEqual([]);
  });
});
