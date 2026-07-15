import { describe, expect, it, vi } from "vitest";
import { createEditorFeatureController, type EditorFeatureControllerGateway } from "./editor-feature-controller";

describe("editor feature controller", () => {
  it("keeps feature operations behind the injectable gateway boundary", async () => {
    const gateway: EditorFeatureControllerGateway = {
      applyAssetCandidate: vi.fn().mockResolvedValue({}),
      cancelImageGeneration: vi.fn().mockResolvedValue(undefined),
      closePreviewSession: vi.fn().mockResolvedValue(undefined),
      createBlankProject: vi.fn().mockResolvedValue(null),
      createPreviewSession: vi.fn().mockResolvedValue({ id: "preview-1" }),
      createProjectFromStarter: vi.fn().mockResolvedValue(null),
      discardAssetCandidate: vi.fn().mockResolvedValue(undefined),
      exportWebBuild: vi.fn().mockResolvedValue(null),
      generateAuthoringSuggestions: vi.fn().mockResolvedValue([]),
      generatePromptPack: vi.fn().mockResolvedValue({}),
      importAssetFiles: vi.fn().mockResolvedValue({}),
      importAssets: vi.fn().mockResolvedValue(null),
      installWorkflowPreset: vi.fn().mockResolvedValue({}),
      onImageGenerationEvent: vi.fn().mockReturnValue(() => undefined),
      openInBrowser: vi.fn().mockResolvedValue(undefined),
      openPreview: vi.fn().mockResolvedValue(undefined),
      openPreviewInBrowser: vi.fn().mockResolvedValue(undefined),
      pickProject: vi.fn().mockResolvedValue(null),
      readPreviewTelemetry: vi.fn().mockResolvedValue({}),
      runValidation: vi.fn().mockResolvedValue({}),
      saveProcessedImageAsset: vi.fn().mockResolvedValue({}),
      startImageGeneration: vi.fn().mockResolvedValue({})
    } as unknown as EditorFeatureControllerGateway;
    const controller = createEditorFeatureController(gateway);

    await controller.createBlankProject();
    await controller.generateAuthoringSuggestions({ sceneId: "scene-1" });

    expect(gateway.createBlankProject).toHaveBeenCalledOnce();
    expect(gateway.generateAuthoringSuggestions).toHaveBeenCalledWith({ sceneId: "scene-1" });
  });
});
