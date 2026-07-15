import type { ComponentProps, ReactNode } from "react";
import { AssetStudioSidebar } from "../../editor-shell";
import { AssetStudioPreview, type AssetStudioPreviewProps } from "./asset-studio-preview";
import { AssetStudioToolPanel, type AssetStudioToolPanelProps } from "./asset-studio-tool-panel";
import {
  AssetStudioWorkspace,
  type AssetStudioWorkspaceModel
} from "./asset-studio-workspace";

type AssetStudioSidebarProps = ComponentProps<typeof AssetStudioSidebar>;

type ActionKeys<T> = {
  [Key in keyof T]-?: T[Key] extends (...args: never[]) => unknown ? Key : never;
}[keyof T];

type ModelPart<T> = Omit<T, ActionKeys<T>>;
type ActionsPart<T> = Pick<T, ActionKeys<T>>;

export interface AssetStudioLaunchpadModel {
  preview: ModelPart<AssetStudioPreviewProps>;
  sidebar: ModelPart<AssetStudioSidebarProps>;
  toolPanel: ModelPart<AssetStudioToolPanelProps>;
  workspace: AssetStudioWorkspaceModel;
}

export interface AssetStudioLaunchpadActions {
  preview: ActionsPart<AssetStudioPreviewProps>;
  sidebar: ActionsPart<AssetStudioSidebarProps>;
  toolPanel: ActionsPart<AssetStudioToolPanelProps>;
}

export interface AssetStudioLaunchpadProps {
  actions: AssetStudioLaunchpadActions;
  children?: ReactNode;
  model: AssetStudioLaunchpadModel;
}

/**
 * Asset Studio's composition boundary. The composition root supplies a
 * serializable view model and explicit action groups; feature agents can own
 * the preview, tool panel, and future animation surface without reaching into
 * EditorGateway or sibling workspace state.
 */
export function AssetStudioLaunchpad({ actions, children, model }: AssetStudioLaunchpadProps) {
  return (
    <AssetStudioWorkspace model={model.workspace}>
      <section className="overview-card asset-studio-shell">
        <AssetStudioSidebar {...model.sidebar} {...actions.sidebar} />
        <AssetStudioPreview {...model.preview} {...actions.preview} />
        <AssetStudioToolPanel {...model.toolPanel} {...actions.toolPanel} />
      </section>
      {children}
    </AssetStudioWorkspace>
  );
}
