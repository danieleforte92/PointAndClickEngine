import {
  capabilityBadgeLabel,
  capabilityStatusTone,
  type EditorCapability
} from "./editor-capabilities";
import type { Workspace } from "./editor-session";

/**
 * Inputs needed to render the context strip above the active workspace.
 *
 * Keeping this decision outside the React tree makes the shell's copy and
 * status rules deterministic and gives workspace-specific wording one home.
 */
export interface StageToolbarModelState {
  hasSelectedScene: boolean;
  selectedSceneActorCount: number;
  selectedSceneHotspotCount: number;
  selectedScenePickupCount: number;
  selectedSceneToolLabel: string;
  sceneLabel: string;
  workspace: Workspace;
  workspaceCapability: EditorCapability;
}

export interface StageToolbarModel {
  badgeLabel: string;
  badgeTone: "good" | "warn" | "error" | "muted";
  detail: string;
  primaryLabel: string;
}

/**
 * Build the stage toolbar's view model for the active workspace.
 *
 * Scene authoring reports the current selection and entity counts while every
 * other workspace reports its capability status and a short contextual hint.
 */
export function stageToolbarModelFor({
  hasSelectedScene,
  selectedSceneActorCount,
  selectedSceneHotspotCount,
  selectedScenePickupCount,
  selectedSceneToolLabel,
  sceneLabel,
  workspace,
  workspaceCapability
}: StageToolbarModelState): StageToolbarModel {
  if (workspace === "scene") {
    return {
      badgeLabel: selectedSceneToolLabel,
      badgeTone: "warn",
      detail: hasSelectedScene
        ? `${selectedSceneHotspotCount} hotspot(s) / ${selectedScenePickupCount} pickup(s) / ${selectedSceneActorCount} actor(s)`
        : workspaceCapability.summary,
      primaryLabel: hasSelectedScene ? sceneLabel : workspaceCapability.label
    };
  }

  return {
    badgeLabel: capabilityBadgeLabel(workspaceCapability.status),
    badgeTone: capabilityStatusTone(workspaceCapability.status),
    detail:
      workspace === "overview"
        ? "Project command center and readiness"
        : workspace === "narrative" || workspace === "flows"
          ? "Structured flow and locale editing"
          : workspaceCapability.summary,
    primaryLabel: workspaceCapability.label
  };
}
