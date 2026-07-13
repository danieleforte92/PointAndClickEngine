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
    const collected = executeCommand(initial, {
      type: "pickup/collect",
      pickupId: "dock-hook",
      itemId: "rusty-hook"
    });

    const selectedVerb = executeCommand(collected.state, { type: "verb/select", verb: "use" });
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

  it("rejects selecting an item that is not in the inventory", () => {
    const initial = createInitialState("dock", { x: 0, y: 0 });
    const result = executeCommand(initial, {
      type: "inventory/select",
      itemId: "missing-item"
    });

    expect(result.events).toEqual([]);
    expect(result.state.selectedItemId).toBeNull();
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

  it("collects distinct pickups that grant the same unique item", () => {
    const initial = createInitialState("dock", { x: 0, y: 0 });
    const first = executeCommand(initial, {
      type: "pickup/collect",
      pickupId: "dock-hook-a",
      itemId: "rusty-hook"
    });
    const second = executeCommand(first.state, {
      type: "pickup/collect",
      pickupId: "dock-hook-b",
      itemId: "rusty-hook"
    });

    expect(second.events).toEqual([
      { type: "pickup/collected", pickupId: "dock-hook-b", itemId: "rusty-hook" }
    ]);
    expect(second.state.inventory).toEqual(["rusty-hook"]);
    expect(second.state.collectedPickups).toEqual(["dock-hook-a", "dock-hook-b"]);
  });

  it("records actor interactions as replayable events", () => {
    const initial = createInitialState("dock", { x: 0, y: 0 });
    const result = executeCommand(initial, {
      actorId: "screwdriver",
      itemId: null,
      type: "actor/interact",
      verb: "look"
    });

    expect(result.events).toEqual([
      {
        actorId: "screwdriver",
        itemId: null,
        type: "actor/interacted",
        verb: "look"
      }
    ]);
    expect(result.state.sequence).toBe(1);
  });

  it("changes scenes as a replayable state transition", () => {
    const initial = createInitialState("dock", { x: 10, y: 20 });
    const result = executeCommand(initial, {
      type: "scene/change",
      sceneId: "tavern",
      player: { x: 300, y: 580 }
    });

    expect(result.events).toEqual([
      {
        type: "scene/changed",
        sceneId: "tavern",
        player: { x: 300, y: 580 }
      }
    ]);
    expect(result.state.sceneId).toBe("tavern");
    expect(result.state.player).toEqual({ x: 300, y: 580 });
    expect(replay(initial, result.events)).toEqual(result.state);
  });
});
