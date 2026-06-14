import { contextBridge, ipcRenderer } from "electron";
import type { Hotspot, Layered2DScene, ProjectManifest, SceneDocument } from "@pointclick/contracts";
import type { EditorProjectCommand } from "@pointclick/project-io";

export interface EditorProjectSnapshot {
  activeHotspotId: string | null;
  activeSceneId: string;
  directory: string;
  flowCount: number;
  localeCount: number;
  manifest: ProjectManifest;
  sceneCount: number;
  scenes: SceneDocument[];
  selectedHotspot: Hotspot | null;
  selectedScene: Layered2DScene | null;
}

export interface PointClickEditorApi {
  applyCommand(command: EditorProjectCommand): Promise<EditorProjectSnapshot>;
  loadProject(projectDirectory?: string): Promise<EditorProjectSnapshot>;
  openPreview(sceneId?: string): Promise<void>;
  openInBrowser(): Promise<void>;
  pickProject(): Promise<EditorProjectSnapshot | null>;
}

const api: PointClickEditorApi = {
  applyCommand: (command) => ipcRenderer.invoke("project:command", command),
  loadProject: (projectDirectory) => ipcRenderer.invoke("project:load", projectDirectory),
  openPreview: (sceneId) => ipcRenderer.invoke("preview:open", sceneId),
  openInBrowser: () => ipcRenderer.invoke("preview:browser"),
  pickProject: () => ipcRenderer.invoke("project:pick")
};

contextBridge.exposeInMainWorld("pointClick", api);
