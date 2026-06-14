import { contextBridge, ipcRenderer } from "electron";
import type {
  FlowDocument,
  Hotspot,
  Layered2DScene,
  LocaleDocument,
  ProjectManifest,
  SceneDocument
} from "@pointclick/contracts";
import type { EditorRecoverySnapshot } from "./editor-session";
import type { EditorProjectCommand } from "@pointclick/project-io";

export interface EditorProjectSnapshot {
  activeFlowId: string | null;
  activeHotspotId: string | null;
  activeLocale: string | null;
  activeSceneId: string;
  directory: string;
  flowCount: number;
  flows: FlowDocument[];
  localeCount: number;
  locales: LocaleDocument[];
  manifest: ProjectManifest;
  sceneCount: number;
  scenes: SceneDocument[];
  selectedFlow: FlowDocument | null;
  selectedHotspot: Hotspot | null;
  selectedLocale: LocaleDocument | null;
  selectedScene: Layered2DScene | null;
}

export interface PointClickEditorApi {
  applyCommand(command: EditorProjectCommand): Promise<EditorProjectSnapshot>;
  clearRecovery(projectDirectory: string): Promise<void>;
  loadProject(projectDirectory?: string): Promise<EditorProjectSnapshot>;
  loadRecovery(projectDirectory: string): Promise<EditorRecoverySnapshot | null>;
  openPreview(sceneId?: string): Promise<void>;
  openInBrowser(): Promise<void>;
  pickProject(): Promise<EditorProjectSnapshot | null>;
  saveRecovery(snapshot: EditorRecoverySnapshot): Promise<void>;
}

const api: PointClickEditorApi = {
  applyCommand: (command) => ipcRenderer.invoke("project:command", command),
  clearRecovery: (projectDirectory) => ipcRenderer.invoke("recovery:clear", projectDirectory),
  loadProject: (projectDirectory) => ipcRenderer.invoke("project:load", projectDirectory),
  loadRecovery: (projectDirectory) => ipcRenderer.invoke("recovery:load", projectDirectory),
  openPreview: (sceneId) => ipcRenderer.invoke("preview:open", sceneId),
  openInBrowser: () => ipcRenderer.invoke("preview:browser"),
  pickProject: () => ipcRenderer.invoke("project:pick"),
  saveRecovery: (snapshot) => ipcRenderer.invoke("recovery:save", snapshot)
};

contextBridge.exposeInMainWorld("pointClick", api);
