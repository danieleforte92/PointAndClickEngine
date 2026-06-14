import type { FlagValue, WorldState } from "./state";

export type GameCommand =
  | { type: "game/start" }
  | { type: "character/walk"; x: number; y: number }
  | { type: "hotspot/activate"; hotspotId: string }
  | { type: "flag/set"; key: string; value: FlagValue }
  | { type: "flow/start"; flowId: string }
  | { type: "flow/end"; flowId: string };

export type DomainEvent =
  | { type: "game/started" }
  | { type: "character/moved"; x: number; y: number }
  | { type: "hotspot/activated"; hotspotId: string }
  | { type: "flag/set"; key: string; value: FlagValue }
  | { type: "flow/started"; flowId: string }
  | { type: "flow/ended"; flowId: string };

export function decide(state: WorldState, command: GameCommand): DomainEvent[] {
  switch (command.type) {
    case "game/start":
      return state.started ? [] : [{ type: "game/started" }];
    case "character/walk":
      return [{ type: "character/moved", x: command.x, y: command.y }];
    case "hotspot/activate":
      return [{ type: "hotspot/activated", hotspotId: command.hotspotId }];
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
    case "character/moved":
      return { ...state, player: { x: event.x, y: event.y }, sequence };
    case "hotspot/activated":
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

