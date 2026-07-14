import {
  buildRecoverySnapshot,
  createHistoryState,
  initializeEditorSession,
  type EditorProjectData,
  type EditorHistoryState,
  type EditorRecoverySnapshot,
  type EditorSessionState
} from "./editor-session";
import type { EditorProjectSnapshot } from "./preload";

export interface EditorProjectSessionGateway {
  loadProject: () => Promise<EditorProjectSnapshot>;
  loadRecovery: (projectDirectory: string) => Promise<EditorRecoverySnapshot | null>;
}

export interface EditorRecoveryGateway {
  clearRecovery: (projectDirectory: string) => Promise<void>;
  saveRecovery: (snapshot: EditorRecoverySnapshot) => Promise<void>;
}

/**
 * The fields edited by the Project/Overview workspace. Keeping this shape
 * outside the rendered view makes session hydration and form reset testable
 * without mounting the Electron editor.
 */
export interface ProjectSettingsDraft {
  defaultLocale: string;
  initialSceneId: string;
  title: string;
  viewportHeight: string;
  viewportWidth: string;
}

export interface EditorProjectHydration {
  history: EditorHistoryState;
  pendingRecovery: EditorRecoverySnapshot | null;
  selectedAnimationPackId: string | null;
  selectedAssetId: string | null;
}

export interface LoadedEditorProjectSession {
  recovery: EditorRecoverySnapshot | null;
  snapshot: EditorProjectSnapshot;
}

export type EditorRecoverySyncResult = "cleared" | "saved" | "skipped";

export const emptyProjectSettingsDraft: ProjectSettingsDraft = {
  defaultLocale: "",
  initialSceneId: "",
  title: "",
  viewportHeight: "",
  viewportWidth: ""
};

/**
 * Load the saved project and its optional recovery snapshot at the gateway
 * boundary. A stale or unreadable recovery file must not prevent authoring
 * from opening the saved project.
 */
export async function loadEditorProjectSession(
  gateway: EditorProjectSessionGateway,
  providedSnapshot?: EditorProjectSnapshot
): Promise<LoadedEditorProjectSession> {
  const snapshot = providedSnapshot ?? (await gateway.loadProject());
  let recovery: EditorRecoverySnapshot | null = null;
  try {
    recovery = await gateway.loadRecovery(snapshot.directory);
  } catch {
    // Recovery is an enhancement; the saved project remains authoritative.
  }
  return { recovery, snapshot };
}

/** Persist only authoring drafts; an unresolved recovery prompt remains the
 * source of truth until the user explicitly restores or discards it. */
export async function syncEditorRecovery(
  gateway: EditorRecoveryGateway,
  project: EditorProjectData,
  session: EditorSessionState,
  pendingRecovery: EditorRecoverySnapshot | null
): Promise<EditorRecoverySyncResult> {
  if (pendingRecovery) return "skipped";

  const recovery = buildRecoverySnapshot(project.directory, project, session);
  if (recovery) {
    await gateway.saveRecovery(recovery);
    return "saved";
  }

  await gateway.clearRecovery(project.directory);
  return "cleared";
}

export function projectSettingsDraftFor(snapshot: EditorProjectSnapshot | null): ProjectSettingsDraft {
  if (!snapshot) return { ...emptyProjectSettingsDraft };

  return {
    defaultLocale: snapshot.manifest.defaultLocale,
    initialSceneId: snapshot.manifest.initialSceneId,
    title: snapshot.manifest.title,
    viewportHeight: String(snapshot.manifest.viewport.height),
    viewportWidth: String(snapshot.manifest.viewport.width)
  };
}

export function hydrateEditorProject(
  snapshot: EditorProjectSnapshot,
  pendingRecovery: EditorRecoverySnapshot | null
): EditorProjectHydration {
  return {
    history: createHistoryState(initializeEditorSession(snapshot)),
    pendingRecovery,
    selectedAnimationPackId: snapshot.selectedAnimationPack?.id ?? snapshot.animationPacks[0]?.id ?? null,
    selectedAssetId: snapshot.selectedAsset?.id ?? snapshot.assets[0]?.id ?? null
  };
}

export function projectLoadStatusFor(
  snapshot: EditorProjectSnapshot,
  pendingRecovery: EditorRecoverySnapshot | null
): string {
  return pendingRecovery
    ? `Loaded ${snapshot.manifest.title} - recovery available`
    : `Loaded ${snapshot.manifest.title}`;
}

/**
 * Keep a resource selection stable across gateway snapshots, while falling
 * back to the snapshot's explicit selection when the previous resource was
 * removed or the editor has not selected one yet.
 */
export function projectAssetSelectionFor(
  snapshot: EditorProjectSnapshot,
  currentAssetId: string | null
): string | null {
  if (currentAssetId && snapshot.assets.some((asset) => asset.id === currentAssetId)) return currentAssetId;
  return snapshot.selectedAsset?.id ?? snapshot.assets[0]?.id ?? null;
}

export function projectAnimationPackSelectionFor(
  snapshot: EditorProjectSnapshot,
  currentAnimationPackId: string | null
): string | null {
  if (
    currentAnimationPackId &&
    snapshot.animationPacks.some((animationPack) => animationPack.id === currentAnimationPackId)
  ) {
    return currentAnimationPackId;
  }
  return snapshot.selectedAnimationPack?.id ?? snapshot.animationPacks[0]?.id ?? null;
}
