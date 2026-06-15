import { contextBridge, ipcRenderer } from "electron";
import type {
  AssetDocument,
  FlowDocument,
  Hotspot,
  ItemDocument,
  Layered2DScene,
  LocaleDocument,
  ProjectBundle,
  ScenePickup,
  ProjectManifest,
  SceneDocument
} from "@pointclick/contracts";
import type { EditorRecoverySnapshot } from "./editor-session";
import type { EditorProjectCommand, ProjectDiagnostic } from "@pointclick/project-io";
import type { EditorValidationReport } from "./validation-report";

export interface EditorPreviewRequest {
  bundle: ProjectBundle;
  sceneId?: string;
}

export interface EditorProjectSnapshot {
  activeAssetId: string | null;
  activeFlowId: string | null;
  activeHotspotId: string | null;
  activeItemId: string | null;
  activeLocale: string | null;
  activePickupId: string | null;
  activeSceneId: string;
  assetCount: number;
  assets: AssetDocument[];
  directory: string;
  flowCount: number;
  flows: FlowDocument[];
  itemCount: number;
  items: ItemDocument[];
  diagnostics: ProjectDiagnostic[];
  localeCount: number;
  locales: LocaleDocument[];
  manifest: ProjectManifest;
  sceneCount: number;
  scenes: SceneDocument[];
  selectedAsset: AssetDocument | null;
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
  importAssets(): Promise<EditorProjectSnapshot | null>;
  loadProject(projectDirectory?: string): Promise<EditorProjectSnapshot>;
  loadRecovery(projectDirectory: string): Promise<EditorRecoverySnapshot | null>;
  openPreview(request?: EditorPreviewRequest): Promise<void>;
  openInBrowser(request?: EditorPreviewRequest): Promise<void>;
  pickProject(): Promise<EditorProjectSnapshot | null>;
  runValidation(): Promise<EditorValidationReport>;
  saveRecovery(snapshot: EditorRecoverySnapshot): Promise<void>;
}

const api: PointClickEditorApi = {
  applyCommand: (command) => ipcRenderer.invoke("project:command", command),
  clearRecovery: (projectDirectory) => ipcRenderer.invoke("recovery:clear", projectDirectory),
  importAssets: () => ipcRenderer.invoke("project:import-assets"),
  loadProject: (projectDirectory) => ipcRenderer.invoke("project:load", projectDirectory),
  loadRecovery: (projectDirectory) => ipcRenderer.invoke("recovery:load", projectDirectory),
  openPreview: (request) => ipcRenderer.invoke("preview:open", request),
  openInBrowser: (request) => ipcRenderer.invoke("preview:browser", request),
  pickProject: () => ipcRenderer.invoke("project:pick"),
  runValidation: () => ipcRenderer.invoke("project:validate"),
  saveRecovery: (snapshot) => ipcRenderer.invoke("recovery:save", snapshot)
};

contextBridge.exposeInMainWorld("pointClick", api);
