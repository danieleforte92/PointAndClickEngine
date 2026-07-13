import type { BrowserWindow } from "electron";
import type { EditorPreviewRequest } from "./preload";

type RegisterIpc = <Args extends unknown[], Result>(
  channel: string,
  handler: (window: BrowserWindow, ...args: Args) => Result | Promise<Result>
) => void;

export interface EditorIpcHandlers {
  openPreview: (request?: EditorPreviewRequest) => unknown;
  openPreviewInBrowser: (request?: EditorPreviewRequest) => unknown;
  loadProject: (projectDirectory?: string) => unknown;
  pickProject: (window: BrowserWindow) => unknown;
  createBlankProject: (window: BrowserWindow) => unknown;
  createProjectFromStarter: (window: BrowserWindow) => unknown;
  importAssets: (window: BrowserWindow) => unknown;
  importAssetFiles: (filePaths: unknown) => unknown;
  saveProcessedImageAsset: (request: unknown) => unknown;
  promptPack: (request: unknown) => unknown;
  authoringSuggestions: (request?: { sceneId?: string }) => unknown;
  imageAsset: (request: unknown) => unknown;
  installWorkflowPreset: (presetId: string) => unknown;
  applyProjectCommand: (command: unknown) => unknown;
  validateProject: () => unknown;
  resolveAssetUrl: (assetPath: string) => unknown;
  loadRecovery: (projectDirectory: string) => unknown;
  saveRecovery: (snapshot: unknown) => unknown;
  clearRecovery: (projectDirectory: string) => unknown;
}

export function registerEditorIpcHandlers(register: RegisterIpc, handlers: EditorIpcHandlers): void {
  register("preview:open", async (_window, request?: EditorPreviewRequest) => handlers.openPreview(request));
  register("preview:browser", async (_window, request?: EditorPreviewRequest) => handlers.openPreviewInBrowser(request));
  register("project:load", async (_window, projectDirectory?: string) => handlers.loadProject(projectDirectory));
  register("project:pick", async (window) => handlers.pickProject(window));
  register("project:create-blank", async (window) => handlers.createBlankProject(window));
  register("project:create-from-starter", async (window) => handlers.createProjectFromStarter(window));
  register("project:import-assets", async (window) => handlers.importAssets(window));
  register("project:import-asset-files", async (_window, filePaths: unknown) => handlers.importAssetFiles(filePaths));
  register("project:save-processed-image-asset", async (_window, request: unknown) => handlers.saveProcessedImageAsset(request));
  register("ai:prompt-pack", async (_window, request: unknown) => handlers.promptPack(request));
  register("ai:authoring-suggestions", async (_window, request?: { sceneId?: string }) => handlers.authoringSuggestions(request));
  register("ai:image-asset", async (_window, request: unknown) => handlers.imageAsset(request));
  register("workflow-preset:install", async (_window, presetId: string) => handlers.installWorkflowPreset(presetId));
  register("project:command", async (_window, command: unknown) => handlers.applyProjectCommand(command));
  register("project:validate", async () => handlers.validateProject());
  register("project:asset-url", async (_window, assetPath: string) => handlers.resolveAssetUrl(assetPath));
  register("recovery:load", async (_window, projectDirectory: string) => handlers.loadRecovery(projectDirectory));
  register("recovery:save", async (_window, snapshot: unknown) => handlers.saveRecovery(snapshot));
  register("recovery:clear", async (_window, projectDirectory: string) => handlers.clearRecovery(projectDirectory));
}
