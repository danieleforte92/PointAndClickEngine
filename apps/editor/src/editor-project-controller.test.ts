import { describe, expect, it, vi } from "vitest";
import type { EditorProjectCommand } from "@pointclick/project-io";
import {
  createEditorProjectController,
  type EditorProjectControllerGateway
} from "./editor-project-controller";
import type {
  EditorProjectData,
  EditorRecoverySnapshot,
  EditorSessionState
} from "./editor-session";
import type { EditorProjectSnapshot } from "./preload";

function snapshot(): EditorProjectSnapshot {
  const asset = { id: "asset-harbor", kind: "image", path: "harbor.png", source: "generated" };
  return {
    directory: "C:/projects/echoes",
    assets: [asset],
    selectedAsset: asset,
    animationPacks: [],
    selectedAnimationPack: null,
    manifest: { title: "The Isle of Echoes" }
  } as unknown as EditorProjectSnapshot;
}

describe("editor project controller", () => {
  it("routes project commands and session-bound recovery through the narrow gateway", async () => {
    const loadedSnapshot = snapshot();
    const command = {
      type: "project/update-settings",
      patch: { title: "Updated" }
    } as EditorProjectCommand;
    const gateway: EditorProjectControllerGateway = {
      applyCommand: vi.fn().mockResolvedValue(loadedSnapshot),
      clearRecovery: vi.fn().mockResolvedValue(undefined),
      loadProject: vi.fn().mockResolvedValue(loadedSnapshot),
      loadRecovery: vi.fn().mockResolvedValue(null),
      saveRecovery: vi.fn().mockResolvedValue(undefined)
    };
    const controller = createEditorProjectController(gateway);

    await expect(controller.applyCommand(command)).resolves.toBe(loadedSnapshot);
    await expect(controller.loadSession()).resolves.toEqual({
      recovery: null,
      snapshot: loadedSnapshot
    });
    await controller.clearRecovery(loadedSnapshot.directory);

    expect(gateway.applyCommand).toHaveBeenCalledWith(command);
    expect(gateway.loadProject).toHaveBeenCalledOnce();
    expect(gateway.loadRecovery).toHaveBeenCalledWith(loadedSnapshot.directory);
    expect(gateway.clearRecovery).toHaveBeenCalledWith(loadedSnapshot.directory);
  });

  it("keeps stable resource selection and status policy behind the controller seam", () => {
    const project = snapshot();
    const gateway = {
      applyCommand: vi.fn(),
      clearRecovery: vi.fn(),
      loadProject: vi.fn(),
      loadRecovery: vi.fn(),
      saveRecovery: vi.fn()
    } as unknown as EditorProjectControllerGateway;
    const controller = createEditorProjectController(gateway);

    expect(controller.projectAssetSelectionFor(project, "asset-harbor")).toBe("asset-harbor");
    expect(controller.projectAssetSelectionFor(project, "removed-asset")).toBe("asset-harbor");
    expect(controller.projectAnimationPackSelectionFor(project, "removed-pack")).toBeNull();
    expect(controller.projectLoadStatusFor(project, null)).toBe("Loaded The Isle of Echoes");
    expect(
      controller.reconcileSnapshot(project, {
        selectedAnimationPackId: "removed-pack",
        selectedAssetId: "removed-asset"
      })
    ).toEqual({
      selectedAnimationPackId: null,
      selectedAssetId: "asset-harbor"
    });
  });

  it("does not persist while recovery remains unresolved", async () => {
    const gateway: EditorProjectControllerGateway = {
      applyCommand: vi.fn(),
      clearRecovery: vi.fn(),
      loadProject: vi.fn(),
      loadRecovery: vi.fn(),
      saveRecovery: vi.fn()
    } as unknown as EditorProjectControllerGateway;
    const controller = createEditorProjectController(gateway);
    const pendingRecovery = {
      projectDirectory: "C:/projects/echoes",
      savedAt: "2026-07-14T00:00:00.000Z"
    } as unknown as EditorRecoverySnapshot;

    await expect(
      controller.syncRecovery(
        {} as EditorProjectData,
        {} as EditorSessionState,
        pendingRecovery
      )
    ).resolves.toBe("skipped");
    expect(gateway.saveRecovery).not.toHaveBeenCalled();
    expect(gateway.clearRecovery).not.toHaveBeenCalled();
  });
});
