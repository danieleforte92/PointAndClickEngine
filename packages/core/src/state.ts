import type { Vector2, Verb } from "@pointclick/contracts";

export type FlagValue = string | number | boolean;

export interface WorldState {
  started: boolean;
  sceneId: string;
  player: Vector2;
  flags: Record<string, FlagValue>;
  activeVerb: Verb;
  inventory: string[];
  selectedItemId: string | null;
  collectedPickups: string[];
  activeFlowId: string | null;
  sequence: number;
}

export function createInitialState(sceneId: string, player: Vector2): WorldState {
  return {
    started: false,
    sceneId,
    player: { ...player },
    flags: {},
    activeVerb: "walk",
    inventory: [],
    selectedItemId: null,
    collectedPickups: [],
    activeFlowId: null,
    sequence: 0
  };
}
