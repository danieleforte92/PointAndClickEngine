import type { SceneSelectionTool } from "../../../editor-session";

export interface SceneStudioState {
  activeTool: SceneSelectionTool;
  inspectorTarget: "player" | "scene";
  selectedGenerationGuideId: string | null;
  selectedLayerId: string | null;
}

export const initialSceneStudioState: SceneStudioState = {
  activeTool: "select",
  inspectorTarget: "scene",
  selectedGenerationGuideId: null,
  selectedLayerId: null
};

export type SceneStudioAction =
  | { type: "guide/select"; guideId: string | null }
  | { type: "inspector/select"; target: SceneStudioState["inspectorTarget"] }
  | { type: "layer/select"; layerId: string | null }
  | { type: "tool/select"; tool: SceneSelectionTool };

export function sceneStudioReducer(state: SceneStudioState, action: SceneStudioAction): SceneStudioState {
  switch (action.type) {
    case "guide/select":
      return { ...state, selectedGenerationGuideId: action.guideId };
    case "inspector/select":
      return { ...state, inspectorTarget: action.target };
    case "layer/select":
      return { ...state, selectedLayerId: action.layerId };
    case "tool/select":
      return { ...state, activeTool: action.tool };
  }
}
