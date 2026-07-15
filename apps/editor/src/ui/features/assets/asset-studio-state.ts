import type { ProjectResourceHealth, ProjectResourceKind } from "../../../project-resources";

export type AssetStudioTool = "info" | "chroma" | "crop" | "optimize" | "guide" | "animation";
export type AssetStudioViewMode = "grid" | "list";

export interface AssetStudioState {
  activeTool: AssetStudioTool;
  resourceHealth: "all" | ProjectResourceHealth;
  resourceKind: "all" | ProjectResourceKind;
  resourceQuery: string;
  resourceViewMode: AssetStudioViewMode;
}
export const initialAssetStudioState: AssetStudioState = {
  activeTool: "info",
  resourceHealth: "all",
  resourceKind: "all",
  resourceQuery: "",
  resourceViewMode: "list"
};

export type AssetStudioAction =
  | { type: "filter/health"; health: AssetStudioState["resourceHealth"] }
  | { type: "filter/kind"; kind: AssetStudioState["resourceKind"] }
  | { type: "filter/query"; query: string }
  | { type: "tool/select"; tool: AssetStudioTool }
  | { type: "view-mode/select"; mode: AssetStudioViewMode };

export function assetStudioReducer(state: AssetStudioState, action: AssetStudioAction): AssetStudioState {
  switch (action.type) {
    case "filter/health":
      return { ...state, resourceHealth: action.health };
    case "filter/kind":
      return { ...state, resourceKind: action.kind };
    case "filter/query":
      return { ...state, resourceQuery: action.query };
    case "tool/select":
      return { ...state, activeTool: action.tool };
    case "view-mode/select":
      return { ...state, resourceViewMode: action.mode };
  }
}
