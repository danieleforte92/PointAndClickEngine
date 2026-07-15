import { describe, expect, it } from "vitest";
import {
  emptyProjectSettingsDraft,
  hydrateEditorProject,
  loadEditorProjectSession,
  projectAnimationPackSelectionFor,
  projectAssetSelectionFor,
  projectLoadStatusFor,
  projectSettingsDraftFor,
  syncEditorRecovery
} from "./editor-project-session";
import { initializeEditorSession } from "./editor-session";
import type { EditorProjectSnapshot } from "./preload";

function snapshot(): EditorProjectSnapshot {
  return {
    directory: "C:/projects/echoes",
    activeActorId: null,
    activeAssetId: "asset-harbor",
    activeFlowId: null,
    activeHotspotId: null,
    activeItemId: null,
    activeLocale: null,
    activePickupId: null,
    activeSceneId: "scene-harbor",
    manifest: {
      defaultLocale: "it-IT",
      initialSceneId: "scene-harbor",
      title: "The Isle of Echoes",
      viewport: { height: 720, width: 1280 }
    },
    scenes: [
      {
        id: "scene-harbor",
        name: "Harbor",
        type: "layered-2d",
        background: "harbor.png",
        layers: [],
        actors: [],
        hotspots: [],
        pickups: []
      }
    ],
    flows: [],
    items: [],
    locales: [],
    assets: [{ id: "asset-harbor", kind: "image", path: "harbor.png", source: "generated" }],
    animationPacks: [],
    promptPacks: [],
    generationRecipes: [],
    workflowTemplates: [],
    diagnostics: [],
    selectedScene: null,
    selectedAsset: { id: "asset-harbor", kind: "image", path: "harbor.png", source: "generated" },
    selectedAnimationPack: null,
    historyRecords: [],
    historyRecordCount: 0,
    sceneCount: 1,
    flowCount: 0,
    assetCount: 1,
    promptPackCount: 0,
    generationRecipeCount: 0,
    itemCount: 0,
    localeCount: 0
  } as unknown as EditorProjectSnapshot;
}

describe("editor project session", () => {
  it("maps project manifest values into the overview draft", () => {
    expect(projectSettingsDraftFor(snapshot())).toEqual({
      defaultLocale: "it-IT",
      initialSceneId: "scene-harbor",
      title: "The Isle of Echoes",
      viewportHeight: "720",
      viewportWidth: "1280"
    });
    expect(projectSettingsDraftFor(null)).toEqual(emptyProjectSettingsDraft);
  });

  it("loads the saved project without blocking on a stale recovery snapshot", async () => {
    const loaded = await loadEditorProjectSession({
      loadProject: async () => snapshot(),
      loadRecovery: async () => {
        throw new Error("stale recovery");
      }
    });

    expect(loaded.snapshot.directory).toBe("C:/projects/echoes");
    expect(loaded.recovery).toBeNull();
  });

  it("does not touch recovery storage while the restore prompt is pending", async () => {
    const calls: string[] = [];
    const result = await syncEditorRecovery(
      {
        clearRecovery: async () => {
          calls.push("clear");
        },
        saveRecovery: async () => {
          calls.push("save");
        }
      },
      snapshot(),
      initializeEditorSession(snapshot()),
      { projectDirectory: "C:/projects/echoes", savedAt: "2026-07-14T00:00:00.000Z", session: initializeEditorSession(snapshot()) }
    );

    expect(result).toBe("skipped");
    expect(calls).toEqual([]);
  });

  it("hydrates history and stable resource selections from a project snapshot", () => {
    const hydrated = hydrateEditorProject(snapshot(), null);

    expect(hydrated.history.present.activeSceneId).toBe("scene-harbor");
    expect(hydrated.selectedAssetId).toBe("asset-harbor");
    expect(hydrated.selectedAnimationPackId).toBeNull();
    expect(hydrated.pendingRecovery).toBeNull();
  });

  it("makes recovery visible in the status message", () => {
    const recovery = { directory: "C:/projects/echoes", savedAt: "2026-07-14T00:00:00.000Z" } as never;
    expect(projectLoadStatusFor(snapshot(), recovery)).toContain("recovery available");
    expect(projectLoadStatusFor(snapshot(), null)).toBe("Loaded The Isle of Echoes");
  });

  it("preserves valid selections and falls back after resources are removed", () => {
    const current = snapshot();
    expect(projectAssetSelectionFor(current, "asset-harbor")).toBe("asset-harbor");
    expect(projectAssetSelectionFor(current, "removed-asset")).toBe("asset-harbor");
    expect(projectAnimationPackSelectionFor(current, "removed-pack")).toBeNull();
  });
});
