import {
  createEditorCommandBus,
  type EditorCommandBus,
  type EditorCommandGateway
} from "./editor-command-bus";
import {
  hydrateEditorProject,
  loadEditorProjectSession,
  projectAnimationPackSelectionFor,
  projectAssetSelectionFor,
  projectLoadStatusFor,
  projectSettingsDraftFor,
  syncEditorRecovery,
  type EditorProjectSessionGateway,
  type EditorRecoveryGateway,
  type EditorProjectHydration,
  type EditorRecoverySyncResult,
  type LoadedEditorProjectSession
} from "./editor-project-session";
import { discardSavedDraft } from "./editor-session";
import type {
  EditorProjectData,
  EditorRecoverySnapshot,
  EditorSessionState
} from "./editor-session";
import type { EditorProjectSnapshot } from "./preload";

/**
 * The controller only needs the project/session slice of the full gateway.
 * Keeping this type narrow makes the project boundary independently testable
 * while the public preload gateway remains unchanged.
 */
export type EditorProjectControllerGateway =
  & EditorProjectSessionGateway
  & EditorRecoveryGateway
  & EditorCommandGateway;

export interface EditorProjectResourceSelection {
  selectedAnimationPackId: string | null;
  selectedAssetId: string | null;
}

export interface EditorProjectReconciliation extends EditorProjectResourceSelection {}

export interface EditorProjectController {
  applyCommand: EditorCommandBus["apply"];
  clearRecovery: (projectDirectory: string) => Promise<void>;
  discardSavedDraft: typeof discardSavedDraft;
  hydrate: (
    snapshot: EditorProjectSnapshot,
    pendingRecovery: EditorRecoverySnapshot | null
  ) => EditorProjectHydration;
  loadSession: (providedSnapshot?: EditorProjectSnapshot) => Promise<LoadedEditorProjectSession>;
  projectSettingsDraftFor: typeof projectSettingsDraftFor;
  projectAnimationPackSelectionFor: (
    snapshot: EditorProjectSnapshot,
    currentAnimationPackId: string | null
  ) => string | null;
  projectAssetSelectionFor: (
    snapshot: EditorProjectSnapshot,
    currentAssetId: string | null
  ) => string | null;
  projectLoadStatusFor: (
    snapshot: EditorProjectSnapshot,
    pendingRecovery: EditorRecoverySnapshot | null
  ) => string;
  syncRecovery: (
    project: EditorProjectData,
    session: EditorSessionState,
    pendingRecovery: EditorRecoverySnapshot | null
  ) => Promise<EditorRecoverySyncResult>;
  reconcileSnapshot: (
    snapshot: EditorProjectSnapshot,
    current: EditorProjectResourceSelection
  ) => EditorProjectReconciliation;
}

export function createEditorProjectController(
  gateway: EditorProjectControllerGateway
): EditorProjectController {
  const commandBus = createEditorCommandBus(gateway);

  return {
    applyCommand: (command) => commandBus.apply(command),
    clearRecovery: (projectDirectory) => gateway.clearRecovery(projectDirectory),
    discardSavedDraft,
    hydrate: hydrateEditorProject,
    loadSession: (providedSnapshot) => loadEditorProjectSession(gateway, providedSnapshot),
    projectAnimationPackSelectionFor,
    projectAssetSelectionFor,
    projectLoadStatusFor,
    projectSettingsDraftFor,
    reconcileSnapshot: (snapshot, current) => ({
      selectedAnimationPackId: projectAnimationPackSelectionFor(snapshot, current.selectedAnimationPackId),
      selectedAssetId: projectAssetSelectionFor(snapshot, current.selectedAssetId)
    }),
    syncRecovery: (project, session, pendingRecovery) =>
      syncEditorRecovery(gateway, project, session, pendingRecovery)
  };
}
