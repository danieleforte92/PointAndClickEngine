import { contextBridge, ipcRenderer } from "electron";
import type { AuthoringSuggestion } from "@pointclick/authoring";
import type {
  AssetDocument,
  AssetProcessingMetadata,
  AnimationPackDocument,
  FlowDocument,
  Hotspot,
  ItemDocument,
  Layered2DScene,
  LocaleDocument,
  PromptPackDocument,
  ProjectChangeRecord,
  ProjectBundle,
  SceneActor,
  ScenePickup,
  ProjectManifest,
  SceneDocument,
  RuntimeInputAction,
  RuntimeDebugSnapshot,
  StyleBibleDocument,
  WorkflowTemplateDocument,
  AssetGenerationRecipeDocument
} from "@pointclick/contracts";
import type { EditorRecoverySnapshot } from "./editor-session";
import type {
  AppliedImageCandidate,
  GeneratedImageAssetJob,
  GenerateImageAssetRequest,
  ImageGenerationEvent,
  ImageGenerationQueueJob,
  StartImageGenerationRequest
} from "./image-generation";
import type {
  GeneratePromptPackRequest,
  PromptProviderId,
  PromptProviderJob
} from "./prompt-pack-studio";
import type { EditorProjectCommand, ProjectDiagnostic } from "@pointclick/project-io";
import type { EditorValidationReport } from "./validation-report";

export interface EditorPreviewRequest {
  bundle: ProjectBundle;
  sceneId?: string;
}

export interface EditorPreviewSessionDescriptor {
  browserUrl: string;
  embeddedUrl: string;
  expiresAt: string;
  id: string;
}

export interface EditorPreviewTelemetry {
  actions: RuntimeInputAction[];
  browserActions: RuntimeInputAction[];
  browserSnapshots: RuntimeDebugSnapshot[];
  snapshots: RuntimeDebugSnapshot[];
}

export interface EditorProjectSnapshot {
  activeActorId: string | null;
  activeAssetId: string | null;
  activeFlowId: string | null;
  activeHotspotId: string | null;
  activeItemId: string | null;
  activeLocale: string | null;
  activePickupId: string | null;
  activeSceneId: string;
  assetCount: number;
  assets: AssetDocument[];
  animationPackCount: number;
  animationPacks: AnimationPackDocument[];
  directory: string;
  flowCount: number;
  flows: FlowDocument[];
  itemCount: number;
  items: ItemDocument[];
  diagnostics: ProjectDiagnostic[];
  localeCount: number;
  locales: LocaleDocument[];
  manifest: ProjectManifest;
  promptPackCount: number;
  promptPacks: PromptPackDocument[];
  sceneCount: number;
  scenes: SceneDocument[];
  selectedAsset: AssetDocument | null;
  selectedActor: SceneActor | null;
  selectedAnimationPack: AnimationPackDocument | null;
  selectedFlow: FlowDocument | null;
  selectedHotspot: Hotspot | null;
  selectedItem: ItemDocument | null;
  selectedLocale: LocaleDocument | null;
  selectedPickup: ScenePickup | null;
  selectedScene: Layered2DScene | null;
  styleBibleCount: number;
  styleBibles: StyleBibleDocument[];
  workflowTemplateCount: number;
  workflowTemplates: WorkflowTemplateDocument[];
  generationRecipeCount: number;
  generationRecipes: AssetGenerationRecipeDocument[];
  historyRecordCount: number;
  historyRecords: ProjectChangeRecord[];
}

export interface ImportedAssetResult {
  assetIds: string[];
  snapshot: EditorProjectSnapshot;
}

export interface WebBuildExportResult {
  assetCount: number;
  outputDirectory: string;
}

export interface SaveProcessedImageAssetRequest {
  dataUrl: string;
  filenameHint: string;
  processing?: AssetProcessingMetadata;
}

export interface PointClickEditorApi {
  applyAssetCandidate(candidateId: string): Promise<AppliedImageCandidate>;
  applyCommand(command: EditorProjectCommand): Promise<EditorProjectSnapshot>;
  cancelImageGeneration(jobId: string): Promise<void>;
  clearRecovery(projectDirectory: string): Promise<void>;
  createBlankProject(): Promise<EditorProjectSnapshot | null>;
  createProjectFromStarter(): Promise<EditorProjectSnapshot | null>;
  createPreviewSession(request: EditorPreviewRequest): Promise<EditorPreviewSessionDescriptor>;
  closePreviewSession(sessionId: string): Promise<void>;
  discardAssetCandidate(candidateId: string): Promise<void>;
  exportWebBuild(): Promise<WebBuildExportResult | null>;
  importAssetFiles(filePaths: string[]): Promise<ImportedAssetResult>;
  importAssets(): Promise<EditorProjectSnapshot | null>;
  generatePromptPack(
    request: GeneratePromptPackRequest & {
      providerId: PromptProviderId;
      allowRemoteProvider?: boolean;
      lmStudioApiKey?: string;
      lmStudioBaseUrl?: string;
      lmStudioModel?: string;
      openAiApiKey?: string;
      openAiBaseUrl?: string;
      openAiModel?: string;
    }
  ): Promise<PromptProviderJob>;
  generateAuthoringSuggestions(request?: { sceneId?: string }): Promise<AuthoringSuggestion[]>;
  generateImageAsset(request: GenerateImageAssetRequest): Promise<GeneratedImageAssetJob>;
  onImageGenerationEvent(listener: (event: ImageGenerationEvent) => void): () => void;
  installWorkflowPreset(presetId: string): Promise<EditorProjectSnapshot>;
  loadProject(projectDirectory?: string): Promise<EditorProjectSnapshot>;
  loadRecovery(projectDirectory: string): Promise<EditorRecoverySnapshot | null>;
  openPreview(request?: EditorPreviewRequest): Promise<void>;
  openPreviewInBrowser(sessionId: string): Promise<void>;
  openInBrowser(request?: EditorPreviewRequest): Promise<void>;
  pickProject(): Promise<EditorProjectSnapshot | null>;
  saveProcessedImageAsset(request: SaveProcessedImageAssetRequest): Promise<ImportedAssetResult>;
  resolveAssetUrl(assetPath: string): Promise<string>;
  runValidation(): Promise<EditorValidationReport>;
  readPreviewTelemetry(sessionId: string): Promise<EditorPreviewTelemetry>;
  saveRecovery(snapshot: EditorRecoverySnapshot): Promise<void>;
  startImageGeneration(request: StartImageGenerationRequest): Promise<ImageGenerationQueueJob>;
}

const api: PointClickEditorApi = {
  applyAssetCandidate: (candidateId) => ipcRenderer.invoke("ai:apply-asset-candidate", candidateId),
  applyCommand: (command) => ipcRenderer.invoke("project:command", command),
  cancelImageGeneration: (jobId) => ipcRenderer.invoke("ai:cancel-image-generation", jobId),
  clearRecovery: (projectDirectory) => ipcRenderer.invoke("recovery:clear", projectDirectory),
  createBlankProject: () => ipcRenderer.invoke("project:create-blank"),
  createProjectFromStarter: () => ipcRenderer.invoke("project:create-from-starter"),
  createPreviewSession: (request) => ipcRenderer.invoke("preview:create-session", request),
  closePreviewSession: (sessionId) => ipcRenderer.invoke("preview:close-session", sessionId),
  discardAssetCandidate: (candidateId) => ipcRenderer.invoke("ai:discard-asset-candidate", candidateId),
  exportWebBuild: () => ipcRenderer.invoke("build:export-web"),
  generatePromptPack: (request) => ipcRenderer.invoke("ai:prompt-pack", request),
  generateAuthoringSuggestions: (request) => ipcRenderer.invoke("ai:authoring-suggestions", request),
  generateImageAsset: (request) => ipcRenderer.invoke("ai:image-asset", request),
  onImageGenerationEvent: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, value: ImageGenerationEvent) => listener(value);
    ipcRenderer.on("ai:image-generation-event", handler);
    return () => ipcRenderer.removeListener("ai:image-generation-event", handler);
  },
  installWorkflowPreset: (presetId) => ipcRenderer.invoke("workflow-preset:install", presetId),
  importAssetFiles: (filePaths) => ipcRenderer.invoke("project:import-asset-files", filePaths),
  importAssets: () => ipcRenderer.invoke("project:import-assets"),
  loadProject: (projectDirectory) => ipcRenderer.invoke("project:load", projectDirectory),
  loadRecovery: (projectDirectory) => ipcRenderer.invoke("recovery:load", projectDirectory),
  openPreview: (request) => ipcRenderer.invoke("preview:open", request),
  openPreviewInBrowser: (sessionId) => ipcRenderer.invoke("preview:open-session-browser", sessionId),
  openInBrowser: (request) => ipcRenderer.invoke("preview:browser", request),
  pickProject: () => ipcRenderer.invoke("project:pick"),
  saveProcessedImageAsset: (request) => ipcRenderer.invoke("project:save-processed-image-asset", request),
  resolveAssetUrl: (assetPath) => ipcRenderer.invoke("project:asset-url", assetPath),
  runValidation: () => ipcRenderer.invoke("project:validate"),
  readPreviewTelemetry: (sessionId) => ipcRenderer.invoke("preview:telemetry", sessionId),
  saveRecovery: (snapshot) => ipcRenderer.invoke("recovery:save", snapshot),
  startImageGeneration: (request) => ipcRenderer.invoke("ai:start-image-generation", request)
};

contextBridge.exposeInMainWorld("pointClick", api);
