import type { Vector2 } from "@pointclick/contracts";

export type FlagValue = string | number | boolean;

export interface WorldState {
  started: boolean;
  sceneId: string;
  player: Vector2;
  flags: Record<string, FlagValue>;
  inventory: string[];
  activeFlowId: string | null;
  sequence: number;
}

export function createInitialState(sceneId: string, player: Vector2): WorldState {
  return {
    started: false,
    sceneId,
    player: { ...player },
    flags: {},
    inventory: [],
    activeFlowId: null,
    sequence: 0
  };
}

