import type { PointClickEditorApi } from "./preload";

/**
 * Injectable boundary between renderer workspaces and Electron's preload API.
 * Tests can provide an in-memory implementation without installing globals.
 */
export type EditorGateway = PointClickEditorApi;

export function createBrowserEditorGateway(): EditorGateway {
  if (typeof window === "undefined" || !window.pointClick) {
    throw new Error("The Point & Click editor preload API is not available.");
  }
  const api = window.pointClick as Partial<PointClickEditorApi> & PointClickEditorApi;
  return {
    ...api,
    applyAssetCandidate: api.applyAssetCandidate ?? (async () => {
      throw new Error("Asset candidates are not supported by this host.");
    }),
    cancelImageGeneration: api.cancelImageGeneration ?? (async () => undefined),
    closePreviewSession: api.closePreviewSession ?? (async () => undefined),
    createPreviewSession: api.createPreviewSession ?? (async () => {
      throw new Error("Test Lab sessions are not supported by this host.");
    }),
    discardAssetCandidate: api.discardAssetCandidate ?? (async () => undefined),
    exportWebBuild: api.exportWebBuild ?? (async () => null),
    onImageGenerationEvent: api.onImageGenerationEvent ?? (() => () => undefined),
    openPreviewInBrowser: api.openPreviewInBrowser ?? (async () => undefined),
    readPreviewTelemetry: api.readPreviewTelemetry ?? (async () => ({
      actions: [],
      browserActions: [],
      browserSnapshots: [],
      snapshots: []
    })),
    startImageGeneration: api.startImageGeneration ?? (async (request) => {
      await api.generateImageAsset?.(request);
      return {
        candidateIds: [],
        completed: 0,
        id: `legacy-${Date.now()}`,
        requested: request.batchSize ?? 1,
        status: "completed"
      };
    })
  } as EditorGateway;
}
