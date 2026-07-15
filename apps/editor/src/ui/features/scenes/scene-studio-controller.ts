import type { SceneSelectionTool } from "../../../editor-session";
import { sceneStudioReducer, type SceneStudioAction, type SceneStudioState } from "./scene-studio-state";

export interface SceneStudioController {
  reduce(state: SceneStudioState, action: SceneStudioAction): SceneStudioState;
  selectionLabel(state: SceneStudioState): string;
  canManipulate(state: SceneStudioState, hasScene: boolean): boolean;
}

const toolLabels: Record<SceneSelectionTool, string> = {
  actor: "Actor",
  hotspot: "Hotspot",
  pickup: "Pickup",
  "player-start": "Player start",
  "walk-area": "Walk area",
  select: "Select"
};

export function createSceneStudioController(): SceneStudioController {
  return {
    reduce: sceneStudioReducer,
    selectionLabel: (state) => toolLabels[state.activeTool],
    canManipulate: (state, hasScene) => hasScene && state.activeTool !== "select"
  };
}
