import type { ReactNode } from "react";
import type { AssetStudioTool } from "./asset-studio-state";

export interface AssetStudioWorkspaceProps {
  model: AssetStudioWorkspaceModel;
  children: ReactNode;
}

export interface AssetStudioWorkspaceModel {
  activeTool: AssetStudioTool;
  assetCount: number;
  selectedAssetId: string | null;
}

export function AssetStudioWorkspace({ children, model }: AssetStudioWorkspaceProps) {
  return (
    <div
      className="workspace-overview build-workspace asset-workspace"
      data-asset-count={model.assetCount}
      data-feature="assets"
      data-selected-asset={model.selectedAssetId ?? undefined}
      data-tool={model.activeTool}
    >
      {children}
    </div>
  );
}
