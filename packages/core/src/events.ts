import type { Verb } from "@pointclick/contracts";
import type { FlagValue, WorldState } from "./state";

export type GameCommand =
  | { type: "game/start" }
  | { type: "verb/select"; verb: Verb }
  | { type: "inventory/select"; itemId: string }
  | { type: "inventory/clear-selection" }
  | { type: "pickup/collect"; pickupId: string; itemId: string }
  | { type: "character/walk"; x: number; y: number }
  | { type: "movement/complete"; x: number; y: number }
  | { type: "scene/change"; sceneId: string; player: { x: number; y: number } }
  | { type: "actor/interact"; actorId: string; verb: Verb; itemId: string | null }
  | { type: "hotspot/interact"; hotspotId: string; verb: Verb; itemId: string | null }
  | { type: "flag/set"; key: string; value: FlagValue }
  | { type: "flow/start"; flowId: string }
  | { type: "flow/end"; flowId: string };

export type DomainEvent =
  | { type: "game/started" }
  | { type: "verb/selected"; verb: Verb }
  | { type: "inventory/item-selected"; itemId: string }
  | { type: "inventory/selection-cleared" }
  | { type: "pickup/collected"; pickupId: string; itemId: string }
  | { type: "character/moved"; x: number; y: number }
  | { type: "movement/completed"; x: number; y: number }
  | { type: "scene/changed"; sceneId: string; player: { x: number; y: number } }
  | { type: "actor/interacted"; actorId: string; verb: Verb; itemId: string | null }
  | { type: "hotspot/interacted"; hotspotId: string; verb: Verb; itemId: string | null }
  | { type: "flag/set"; key: string; value: FlagValue }
  | { type: "flow/started"; flowId: string }
  | { type: "flow/ended"; flowId: string };

export function decide(state: WorldState, command: GameCommand): DomainEvent[] {
  switch (command.type) {
    case "game/start":
      return state.started ? [] : [{ type: "game/started" }];
    case "verb/select":
      return state.activeVerb === command.verb ? [] : [{ type: "verb/selected", verb: command.verb }];
    case "inventory/select":
      return !state.inventory.includes(command.itemId)
        ? []
        : state.selectedItemId === command.itemId
        ? [{ type: "inventory/selection-cleared" }]
        : [{ type: "inventory/item-selected", itemId: command.itemId }];
    case "inventory/clear-selection":
      return state.selectedItemId === null ? [] : [{ type: "inventory/selection-cleared" }];
    case "pickup/collect":
      return state.collectedPickups.includes(command.pickupId)
        ? []
        : [{ type: "pickup/collected", pickupId: command.pickupId, itemId: command.itemId }];
    case "character/walk":
      return [{ type: "character/moved", x: command.x, y: command.y }];
    case "movement/complete":
      return [{ type: "movement/completed", x: command.x, y: command.y }];
    case "scene/change":
      return state.sceneId === command.sceneId &&
        state.player.x === command.player.x &&
        state.player.y === command.player.y
        ? []
        : [{ type: "scene/changed", sceneId: command.sceneId, player: command.player }];
    case "actor/interact":
      return [
        {
          type: "actor/interacted",
          actorId: command.actorId,
          verb: command.verb,
          itemId: command.itemId
        }
      ];
    case "hotspot/interact":
      return [
        {
          type: "hotspot/interacted",
          hotspotId: command.hotspotId,
          verb: command.verb,
          itemId: command.itemId
        }
      ];
    case "flag/set":
      return state.flags[command.key] === command.value
        ? []
        : [{ type: "flag/set", key: command.key, value: command.value }];
    case "flow/start":
      return state.activeFlowId === command.flowId
        ? []
        : [{ type: "flow/started", flowId: command.flowId }];
    case "flow/end":
      return state.activeFlowId === command.flowId
        ? [{ type: "flow/ended", flowId: command.flowId }]
        : [];
  }
}

export function applyEvent(state: WorldState, event: DomainEvent): WorldState {
  const sequence = state.sequence + 1;
  switch (event.type) {
    case "game/started":
      return { ...state, started: true, sequence };
    case "verb/selected":
      return { ...state, activeVerb: event.verb, sequence };
    case "inventory/item-selected":
      return { ...state, selectedItemId: event.itemId, sequence };
    case "inventory/selection-cleared":
      return { ...state, selectedItemId: null, sequence };
    case "pickup/collected":
      return {
        ...state,
        inventory: state.inventory.includes(event.itemId) ? state.inventory : [...state.inventory, event.itemId],
        collectedPickups: state.collectedPickups.includes(event.pickupId)
          ? state.collectedPickups
          : [...state.collectedPickups, event.pickupId],
        sequence
      };
    case "character/moved":
      return { ...state, player: { x: event.x, y: event.y }, sequence };
    case "movement/completed":
      return { ...state, player: { x: event.x, y: event.y }, sequence };
    case "scene/changed":
      return { ...state, sceneId: event.sceneId, player: { ...event.player }, sequence };
    case "actor/interacted":
      return { ...state, sequence };
    case "hotspot/interacted":
      return { ...state, sequence };
    case "flag/set":
      return {
        ...state,
        flags: { ...state.flags, [event.key]: event.value },
        sequence
      };
    case "flow/started":
      return { ...state, activeFlowId: event.flowId, sequence };
    case "flow/ended":
      return { ...state, activeFlowId: null, sequence };
  }
}

export function executeCommand(
  state: WorldState,
  command: GameCommand
): { state: WorldState; events: DomainEvent[] } {
  const events = decide(state, command);
  return {
    events,
    state: events.reduce(applyEvent, state)
  };
}

export function replay(initial: WorldState, events: readonly DomainEvent[]): WorldState {
  return events.reduce(applyEvent, initial);
}
