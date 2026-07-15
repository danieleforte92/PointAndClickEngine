import type { EditorGateway } from "./editor-gateway";

/**
 * Renderer-facing feature boundary for operations that are not project
 * commands or session recovery. Views receive this controller through props;
 * they never need to know which preload method implements the operation.
 */
export type EditorFeatureControllerGateway = Pick<
  EditorGateway,
  | "applyAssetCandidate"
  | "cancelImageGeneration"
  | "closePreviewSession"
  | "createBlankProject"
  | "createPreviewSession"
  | "createProjectFromStarter"
  | "discardAssetCandidate"
  | "exportWebBuild"
  | "generateAuthoringSuggestions"
  | "generatePromptPack"
  | "importAssetFiles"
  | "importAssets"
  | "installWorkflowPreset"
  | "onImageGenerationEvent"
  | "openInBrowser"
  | "openPreview"
  | "openPreviewInBrowser"
  | "pickProject"
  | "readPreviewTelemetry"
  | "runValidation"
  | "saveProcessedImageAsset"
  | "startImageGeneration"
>;

export interface EditorFeatureController extends EditorFeatureControllerGateway {}

export function createEditorFeatureController(
  gateway: EditorFeatureControllerGateway
): EditorFeatureController {
  return {
    applyAssetCandidate: (candidateId) => gateway.applyAssetCandidate(candidateId),
    cancelImageGeneration: (jobId) => gateway.cancelImageGeneration(jobId),
    closePreviewSession: (sessionId) => gateway.closePreviewSession(sessionId),
    createBlankProject: () => gateway.createBlankProject(),
    createPreviewSession: (request) => gateway.createPreviewSession(request),
    createProjectFromStarter: () => gateway.createProjectFromStarter(),
    discardAssetCandidate: (candidateId) => gateway.discardAssetCandidate(candidateId),
    exportWebBuild: () => gateway.exportWebBuild(),
    generateAuthoringSuggestions: (request) => gateway.generateAuthoringSuggestions(request),
    generatePromptPack: (request) => gateway.generatePromptPack(request),
    importAssetFiles: (filePaths) => gateway.importAssetFiles(filePaths),
    importAssets: () => gateway.importAssets(),
    installWorkflowPreset: (presetId) => gateway.installWorkflowPreset(presetId),
    onImageGenerationEvent: (listener) => gateway.onImageGenerationEvent(listener),
    openInBrowser: (request) => gateway.openInBrowser(request),
    openPreview: (request) => gateway.openPreview(request),
    openPreviewInBrowser: (sessionId) => gateway.openPreviewInBrowser(sessionId),
    pickProject: () => gateway.pickProject(),
    readPreviewTelemetry: (sessionId) => gateway.readPreviewTelemetry(sessionId),
    runValidation: () => gateway.runValidation(),
    saveProcessedImageAsset: (request) => gateway.saveProcessedImageAsset(request),
    startImageGeneration: (request) => gateway.startImageGeneration(request)
  };
}
