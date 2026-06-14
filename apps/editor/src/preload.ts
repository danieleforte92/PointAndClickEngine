import { contextBridge, ipcRenderer } from "electron";

export interface PointClickEditorApi {
  openPreview(sceneId?: string): Promise<void>;
  openInBrowser(): Promise<void>;
}

const api: PointClickEditorApi = {
  openPreview: (sceneId) => ipcRenderer.invoke("preview:open", sceneId),
  openInBrowser: () => ipcRenderer.invoke("preview:browser")
};

contextBridge.exposeInMainWorld("pointClick", api);

