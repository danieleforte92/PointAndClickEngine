import { contextBridge, ipcRenderer } from "electron";
import type {
  AssetDocument,
  AnimationPackDocument,
  FlowDocument,
  Hotspot,
  ItemDocument,
  Layered2DScene,
  LocaleDocument,
  PromptPackDocument,
  ProjectBundle,
  SceneActor,
  ScenePickup,
  ProjectManifest,
  SceneDocument
} from "@pointclick/contracts";
import type { EditorRecoverySnapshot } from "./editor-session";
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
}

export interface PointClickEditorApi {
  applyCommand(command: EditorProjectCommand): Promise<EditorProjectSnapshot>;
  clearRecovery(projectDirectory: string): Promise<void>;
  createBlankProject(): Promise<EditorProjectSnapshot | null>;
  createProjectFromStarter(): Promise<EditorProjectSnapshot | null>;
  importAssets(): Promise<EditorProjectSnapshot | null>;
  generatePromptPack(
    request: GeneratePromptPackRequest & {
      providerId: PromptProviderId;
      openAiApiKey?: string;
      openAiBaseUrl?: string;
      openAiModel?: string;
    }
  ): Promise<PromptProviderJob>;
  loadProject(projectDirectory?: string): Promise<EditorProjectSnapshot>;
  loadRecovery(projectDirectory: string): Promise<EditorRecoverySnapshot | null>;
  openPreview(request?: EditorPreviewRequest): Promise<void>;
  openInBrowser(request?: EditorPreviewRequest): Promise<void>;
  pickProject(): Promise<EditorProjectSnapshot | null>;
  resolveAssetUrl(assetPath: string): Promise<string>;
  runValidation(): Promise<EditorValidationReport>;
  saveRecovery(snapshot: EditorRecoverySnapshot): Promise<void>;
}

const api: PointClickEditorApi = {
  applyCommand: (command) => ipcRenderer.invoke("project:command", command),
  clearRecovery: (projectDirectory) => ipcRenderer.invoke("recovery:clear", projectDirectory),
  createBlankProject: () => ipcRenderer.invoke("project:create-blank"),
  createProjectFromStarter: () => ipcRenderer.invoke("project:create-from-starter"),
  generatePromptPack: (request) => ipcRenderer.invoke("ai:prompt-pack", request),
  importAssets: () => ipcRenderer.invoke("project:import-assets"),
  loadProject: (projectDirectory) => ipcRenderer.invoke("project:load", projectDirectory),
  loadRecovery: (projectDirectory) => ipcRenderer.invoke("recovery:load", projectDirectory),
  openPreview: (request) => ipcRenderer.invoke("preview:open", request),
  openInBrowser: (request) => ipcRenderer.invoke("preview:browser", request),
  pickProject: () => ipcRenderer.invoke("project:pick"),
  resolveAssetUrl: (assetPath) => ipcRenderer.invoke("project:asset-url", assetPath),
  runValidation: () => ipcRenderer.invoke("project:validate"),
  saveRecovery: (snapshot) => ipcRenderer.invoke("recovery:save", snapshot)
};

contextBridge.exposeInMainWorld("pointClick", api);
