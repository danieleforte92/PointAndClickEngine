import type { ReactNode } from "react";
import type { SceneSelectionTool } from "../../../editor-session";

export interface ScenesWorkspaceProps {
  model: ScenesWorkspaceModel;
  children: ReactNode;
}

export interface ScenesWorkspaceModel {
  activeTool: SceneSelectionTool;
  selectedSceneId: string | null;
}

/** Scene viewport boundary. Mutations stay in the composition root/controller. */
export function ScenesWorkspace({ children, model }: ScenesWorkspaceProps) {
  return (
    <div
      className="scene-workspace-surface"
      data-feature="scenes"
      data-scene-id={model.selectedSceneId ?? undefined}
      data-tool={model.activeTool}
    >
      {children}
    </div>
  );
}
