import { assetStudioReducer, type AssetStudioAction, type AssetStudioState } from "./asset-studio-state";

export interface AssetStudioController {
  reduce(state: AssetStudioState, action: AssetStudioAction): AssetStudioState;
  hasActiveFilter(state: AssetStudioState): boolean;
  toolLabel(state: AssetStudioState): string;
}

const toolLabels: Record<AssetStudioState["activeTool"], string> = {
  animation: "Animation",
  chroma: "Chroma key",
  crop: "Bezier crop",
  guide: "Generation guide",
  info: "Asset details",
  optimize: "Optimize"
};

export function createAssetStudioController(): AssetStudioController {
  return {
    reduce: assetStudioReducer,
    hasActiveFilter: (state) => state.resourceHealth !== "all" || state.resourceKind !== "all" || state.resourceQuery.trim() !== "",
    toolLabel: (state) => toolLabels[state.activeTool]
  };
}
