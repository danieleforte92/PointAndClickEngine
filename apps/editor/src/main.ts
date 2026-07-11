import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import path from "node:path";
import type {
  AssetDocument,
  AnimationPackDocument,
  FlowDocument,
  Hotspot,
  ItemDocument,
  Layered2DScene,
  LocaleDocument,
  PromptPackDocument,
  SceneActor,
  ScenePickup,
  ProjectBundle,
  StyleBibleDocument,
  WorkflowTemplateDocument,
  AssetGenerationRecipeDocument
} from "@pointclick/contracts";
import type { EditorRecoverySnapshot } from "./editor-session";
import { generateComfyUIImage } from "./comfyui-image-provider";
import { GoogleImageProvider } from "./google-image-provider";
import { mockAuthoringProvider } from "@pointclick/authoring";
import {
  bitmapHasAlphaPixels,
  generatedImageParentAssetIds,
  generatedImageOutputWarning,
  type ImageGenerationProviderResult,
  type GenerateImageAssetRequest
} from "./image-generation";
import { generateLMStudioPromptPack } from "./lmstudio-prompt-provider";
import { generateOpenAIPromptPack } from "./openai-prompt-provider";
import { OpenAIImageProvider } from "./openai-image-provider";
import { isTrustedEditorIpcSender } from "./ipc-security";
import { assertProviderEndpointConsent } from "./provider-security";
import type { EditorPreviewRequest } from "./preload";
import { mockPromptPackProvider, type GeneratePromptPackRequest, type PromptProviderId } from "./prompt-pack-studio";
import { createValidationReport } from "./validation-report";
import { workflowPresetById } from "./workflow-presets";
import {
  applyProjectCommand,
  atomicWriteFile,
  createBlankProject,
  createProjectFromTemplate,
  loadProjectHistory,
  loadProjectFromDirectory,
  safeProjectPath,
  serializeJsonDocument,
  type EditorProjectCommand,
  validateProjectBundle,
  validateProjectFiles
} from "@pointclick/project-io";
import { app, BrowserWindow, dialog, ipcMain, nativeImage, shell, type IpcMainInvokeEvent } from "electron";

let editorWindow: BrowserWindow | null = null;
let previewWindow: BrowserWindow | null = null;
let playerServer: Server | null = null;
let previewBundleServer: Server | null = null;
let playerUrl = process.env.POINTCLICK_PLAYER_URL ?? "http://127.0.0.1:5173";
let loadedProjectDirectory = starterProjectPath();
const previewSessions = new Map<string, { bundle: ProjectBundle; projectDirectory: string }>();

function starterProjectPath(): string {
  return path.resolve(__dirname, "../../../starter-game/project");
}

const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
  ".bmp": "image/bmp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function isPathInside(rootDirectory: string, candidatePath: string): boolean {
  const relativePath = path.relative(path.resolve(rootDirectory), path.resolve(candidatePath));
  return (
    relativePath === "" ||
    (!relativePath.startsWith(`..${path.sep}`) && relativePath !== ".." && !path.isAbsolute(relativePath))
  );
}

async function startBundledPlayerServer(): Promise<string> {
  const root = path.resolve(process.resourcesPath, "dist");
  const indexPath = path.join(root, "index.html");

  playerServer = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
      const candidate = path.resolve(root, `.${pathname}`);
      const requestedPath = isPathInside(root, candidate) ? candidate : indexPath;
      const filePath = (await stat(requestedPath)).isFile() ? requestedPath : indexPath;
      response.writeHead(200, {
        "Content-Type": mimeTypes[path.extname(filePath)] ?? "application/octet-stream",
        "Cache-Control": filePath === indexPath ? "no-cache" : "public, max-age=31536000, immutable"
      });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  await new Promise<void>((resolve, reject) => {
    playerServer?.once("error", reject);
    playerServer?.listen(0, "127.0.0.1", resolve);
  });

  const address = playerServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to determine bundled player server address");
  }
  return `http://127.0.0.1:${address.port}`;
}

async function ensurePreviewBundleServer(): Promise<string> {
  if (!previewBundleServer) {
    previewBundleServer = createServer(async (request, response) => {
      response.setHeader("Access-Control-Allow-Origin", "*");
      response.setHeader("Cache-Control", "no-store");

      if (request.method === "OPTIONS") {
        response.writeHead(204, {
          "Access-Control-Allow-Headers": "content-type",
          "Access-Control-Allow-Methods": "GET, OPTIONS"
        });
        response.end();
        return;
      }

      const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
      const segments = pathname.split("/").filter(Boolean);
      const token = segments[1];
      const previewSession = token ? previewSessions.get(token) : null;
      if (!token || !previewSession) {
        response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "Preview bundle not found" }));
        return;
      }

      if (segments[0] === "preview") {
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(previewSession.bundle));
        return;
      }

      if (segments[0] === "asset") {
        const relativeAssetPath = segments.slice(2).join("/");
        let candidate: string;
        try {
          candidate = safeProjectPath(previewSession.projectDirectory, relativeAssetPath, "Preview asset path");
        } catch {
          response.writeHead(404);
          response.end("Not found");
          return;
        }

        try {
          const fileStat = await stat(candidate);
          if (!fileStat.isFile()) {
            response.writeHead(404);
            response.end("Not found");
            return;
          }
          response.writeHead(200, {
            "Content-Type": mimeTypes[path.extname(candidate)] ?? "application/octet-stream"
          });
          createReadStream(candidate).pipe(response);
          return;
        } catch {
          response.writeHead(404);
          response.end("Not found");
          return;
        }
      }

      response.writeHead(404);
      response.end("Not found");
    });

    await new Promise<void>((resolve, reject) => {
      previewBundleServer?.once("error", reject);
      previewBundleServer?.listen(0, "127.0.0.1", resolve);
    });
  }

  const address = previewBundleServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to determine preview bundle server address");
  }
  return `http://127.0.0.1:${address.port}`;
}

function registerPreviewBundle(bundle: ProjectBundle, projectDirectory: string): string {
  const token = randomUUID();
  previewSessions.set(token, { bundle, projectDirectory });

  if (previewSessions.size > 8) {
    const oldestToken = previewSessions.keys().next().value;
    if (oldestToken) previewSessions.delete(oldestToken);
  }

  return token;
}

function createEditorWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1540,
    height: 960,
    minWidth: 1050,
    minHeight: 700,
    backgroundColor: "#111820",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  editorWindow = window;
  window.on("closed", () => {
    if (editorWindow === window) editorWindow = null;
  });

  return window;
}

function requireTrustedEditorWindow(event: IpcMainInvokeEvent): BrowserWindow {
  if (!isTrustedEditorIpcSender(event.sender, editorWindow)) {
    throw new Error("Blocked privileged IPC from an untrusted renderer.");
  }
  return editorWindow!;
}

function handleTrustedIpc<Args extends unknown[], Result>(
  channel: string,
  handler: (window: BrowserWindow, ...args: Args) => Result | Promise<Result>
): void {
  ipcMain.handle(channel, (event, ...args: Args) => handler(requireTrustedEditorWindow(event), ...args));
}

async function buildPreviewUrl(request?: EditorPreviewRequest): Promise<string> {
  const url = new URL(playerUrl);
  url.searchParams.set("host", "electron");
  if (request?.sceneId) {
    url.searchParams.set("scene", request.sceneId);
  }

  if (request?.bundle) {
    const diagnostics = validateProjectBundle(request.bundle).filter(
      (diagnostic) => diagnostic.severity === "error"
    );
    if (diagnostics.length > 0) {
      const summary = diagnostics
        .slice(0, 5)
        .map((diagnostic) => diagnostic.message)
        .join(" ");
      throw new Error(`Preview blocked by project errors. ${summary}`);
    }

    const serverUrl = await ensurePreviewBundleServer();
    const token = registerPreviewBundle(request.bundle, currentProjectPath());
    url.searchParams.set("bundleUrl", `${serverUrl}/preview/${token}`);
    url.searchParams.set("assetBaseUrl", `${serverUrl}/asset/${token}/`);
  }

  return url.toString();
}

async function openPreview(request?: EditorPreviewRequest): Promise<void> {
  const previewUrl = await buildPreviewUrl(request);

  if (previewWindow && !previewWindow.isDestroyed()) {
    void previewWindow.loadURL(previewUrl);
    previewWindow.show();
    previewWindow.focus();
    return;
  }

  previewWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 520,
    backgroundColor: "#071019",
    title: "Point & Click Preview",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  previewWindow.on("closed", () => {
    previewWindow = null;
  });
  void previewWindow.loadURL(previewUrl);
}

async function openPreviewInBrowser(request?: EditorPreviewRequest): Promise<void> {
  const previewUrl = await buildPreviewUrl(request);
  await shell.openExternal(previewUrl);
}

async function resolveProjectAssetUrl(assetPath: string): Promise<string> {
  const projectDirectory = currentProjectPath();
  const absolutePath = safeProjectPath(projectDirectory, assetPath, "Asset path");

  const mimeType = mimeTypes[path.extname(absolutePath).toLowerCase()] ?? "application/octet-stream";
  const data = await readFile(absolutePath);
  return `data:${mimeType};base64,${data.toString("base64")}`;
}

function currentProjectPath(): string {
  return loadedProjectDirectory;
}

function recoveryDirectory(): string {
  return path.join(app.getPath("userData"), "draft-recovery");
}

function recoveryFilePath(projectDirectory: string): string {
  const hash = createHash("sha256").update(path.resolve(projectDirectory)).digest("hex");
  return path.join(recoveryDirectory(), `${hash}.json`);
}

async function loadRecoverySnapshot(projectDirectory: string): Promise<EditorRecoverySnapshot | null> {
  try {
    const filePath = recoveryFilePath(projectDirectory);
    const value = JSON.parse(await readFile(filePath, "utf8")) as EditorRecoverySnapshot;
    return value.projectDirectory === projectDirectory ? value : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function saveRecoverySnapshot(snapshot: EditorRecoverySnapshot): Promise<void> {
  await atomicWriteFile(recoveryFilePath(snapshot.projectDirectory), serializeJsonDocument(snapshot));
}

async function clearRecoverySnapshot(projectDirectory: string): Promise<void> {
  await rm(recoveryFilePath(projectDirectory), { force: true });
}

function assetKindFromExtension(filePath: string): "image" {
  const extension = path.extname(filePath).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg"].includes(extension)) {
    return "image";
  }
  return "image";
}

const supportedImageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg"]);

function assertSupportedImagePath(filePath: string, label: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (!supportedImageExtensions.has(extension)) {
    throw new Error(`${label} must be a supported image file.`);
  }
}

function assertStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${label} must be a list of file paths.`);
  }
  return value;
}

function assertProcessedImageRequest(value: unknown): { dataUrl: string; filenameHint: string } {
  if (
    typeof value !== "object" ||
    value === null ||
    typeof (value as { dataUrl?: unknown }).dataUrl !== "string" ||
    typeof (value as { filenameHint?: unknown }).filenameHint !== "string"
  ) {
    throw new Error("Processed image save request must include a PNG data URL and filename hint.");
  }
  return value as { dataUrl: string; filenameHint: string };
}

function slugifyAssetId(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "asset";
}

async function uniquePath(basePath: string): Promise<string> {
  const extension = path.extname(basePath);
  const stem = basePath.slice(0, basePath.length - extension.length);
  let candidate = basePath;
  let index = 1;
  while (true) {
    try {
      await stat(candidate);
      candidate = `${stem}-${index}${extension}`;
      index += 1;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return candidate;
      }
      throw error;
    }
  }
}

interface ImportImageSource {
  filename: string;
  writeTo(targetPath: string): Promise<void>;
}

async function importImageSources(projectDirectory: string, sources: ImportImageSource[]) {
  if (sources.length === 0) {
    throw new Error("No image files were provided for import.");
  }

  const importedAssetsDirectory = path.join(projectDirectory, "assets", "imported");
  await mkdir(importedAssetsDirectory, { recursive: true });

  const existing = await loadProjectFromDirectory(projectDirectory);
  const existingAssetIds = new Set(Object.keys(existing.bundle.assets));
  const assets = [];
  const assetIds: string[] = [];

  for (const source of sources) {
    assertSupportedImagePath(source.filename, "Imported asset");
    const sourceName = path.basename(source.filename);
    const targetPath = await uniquePath(path.join(importedAssetsDirectory, sourceName));
    const relativeFilePath = path.relative(projectDirectory, targetPath).replace(/\\/g, "/");
    const baseId = slugifyAssetId(path.basename(targetPath, path.extname(targetPath)));
    let assetId = baseId;
    let counter = 1;
    while (existingAssetIds.has(assetId)) {
      assetId = `${baseId}-${counter}`;
      counter += 1;
    }
    existingAssetIds.add(assetId);
    assetIds.push(assetId);

    await source.writeTo(targetPath);

    assets.push({
      documentPath: `assets/${assetId}.asset.json`,
      filePath: relativeFilePath,
      id: assetId,
      kind: assetKindFromExtension(targetPath),
      source: "imported" as const
    });
  }

  const loaded = await applyProjectCommand(projectDirectory, {
    type: "asset/import",
    assets
  });
  loadedProjectDirectory = loaded.directory;
  return {
    assetIds,
    snapshot: await summarizeProject(loaded.directory, loaded.bundle)
  };
}

async function importProjectAssetFiles(filePaths: unknown) {
  const imageFilePaths = assertStringArray(filePaths, "Imported assets");
  const projectDirectory = currentProjectPath();
  return importImageSources(
    projectDirectory,
    imageFilePaths.map((sourcePath) => ({
      filename: sourcePath,
      writeTo: (targetPath) => copyFile(sourcePath, targetPath)
    }))
  );
}

async function saveProcessedImageAsset(requestValue: unknown) {
  const request = assertProcessedImageRequest(requestValue);
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(request.dataUrl.trim());
  if (!match) {
    throw new Error("Processed image must be a PNG data URL.");
  }
  const filename = path.basename(request.filenameHint.trim() || "processed-alpha.png");
  const filenameWithExtension = path.extname(filename).toLowerCase() === ".png" ? filename : `${filename}.png`;
  const bytes = Buffer.from(match[1]!, "base64");
  if (bytes.byteLength === 0) {
    throw new Error("Processed image PNG is empty.");
  }

  return importImageSources(currentProjectPath(), [
    {
      filename: filenameWithExtension,
      writeTo: (targetPath) => writeFile(targetPath, bytes)
    }
  ]);
}

async function summarizeProject(projectDirectory: string, bundle: ProjectBundle) {
  const history = await loadProjectHistory(projectDirectory);
  const diagnostics = [
    ...validateProjectBundle(bundle),
    ...(await validateProjectFiles({ directory: projectDirectory, bundle }))
  ];
  const initialScene = bundle.scenes[bundle.manifest.initialSceneId];
  const activeScene =
    initialScene && initialScene.type === "layered-2d"
      ? initialScene
      : Object.values(bundle.scenes).find(
          (scene): scene is Layered2DScene => scene.type === "layered-2d"
        ) ?? null;
  const activeHotspot: Hotspot | null = activeScene?.hotspots[0] ?? null;
  const activeActor: SceneActor | null = activeScene?.actors[0] ?? null;
  const activeLocale: LocaleDocument | null =
    bundle.locales[bundle.manifest.defaultLocale] ??
    Object.values(bundle.locales)[0] ??
    null;
  const activeFlow: FlowDocument | null = Object.values(bundle.flows)[0] ?? null;
  const activePickup: ScenePickup | null = activeScene?.pickups[0] ?? null;
  const activeItem: ItemDocument | null = Object.values(bundle.items)[0] ?? null;
  const activeAsset: AssetDocument | null = Object.values(bundle.assets)[0] ?? null;
  const activeAnimationPack: AnimationPackDocument | null = Object.values(bundle.animationPacks)[0] ?? null;
  const promptPacks: PromptPackDocument[] = Object.values(bundle.promptPacks);
  const animationPacks: AnimationPackDocument[] = Object.values(bundle.animationPacks);
  const styleBibles: StyleBibleDocument[] = Object.values(bundle.styleBibles);
  const workflowTemplates: WorkflowTemplateDocument[] = Object.values(bundle.workflowTemplates);
  const generationRecipes: AssetGenerationRecipeDocument[] = Object.values(bundle.generationRecipes);

  return {
    activeActorId: activeActor?.id ?? null,
    activeAssetId: activeAsset?.id ?? null,
    activeFlowId: activeFlow?.id ?? null,
    activeHotspotId: activeHotspot?.id ?? null,
    activeItemId: activeItem?.id ?? null,
    activeLocale: activeLocale?.locale ?? null,
    activePickupId: activePickup?.id ?? null,
    activeSceneId: activeScene?.id ?? bundle.manifest.initialSceneId,
    assetCount: Object.keys(bundle.assets).length,
    assets: Object.values(bundle.assets),
    animationPackCount: animationPacks.length,
    animationPacks,
    directory: projectDirectory,
    diagnostics,
    flowCount: Object.keys(bundle.flows).length,
    flows: Object.values(bundle.flows),
    itemCount: Object.keys(bundle.items).length,
    items: Object.values(bundle.items),
    localeCount: Object.keys(bundle.locales).length,
    locales: Object.values(bundle.locales),
    manifest: bundle.manifest,
    promptPackCount: promptPacks.length,
    promptPacks,
    sceneCount: Object.keys(bundle.scenes).length,
    scenes: Object.values(bundle.scenes),
    selectedAsset: activeAsset,
    selectedActor: activeActor,
    selectedAnimationPack: activeAnimationPack,
    selectedFlow: activeFlow,
    selectedHotspot: activeHotspot,
    selectedItem: activeItem,
    selectedLocale: activeLocale,
    selectedPickup: activePickup,
    selectedScene: activeScene,
    styleBibleCount: styleBibles.length,
    styleBibles,
    workflowTemplateCount: workflowTemplates.length,
    workflowTemplates,
    generationRecipeCount: generationRecipes.length,
    generationRecipes,
    historyRecords: history.records.slice(-12).reverse(),
    historyRecordCount: history.records.length
  };
}

async function readEditorProject(projectDirectory = currentProjectPath()) {
  const loaded = await loadProjectFromDirectory(projectDirectory);
  loadedProjectDirectory = loaded.directory;
  return summarizeProject(loaded.directory, loaded.bundle);
}

async function applyEditorCommand(command: EditorProjectCommand) {
  const loaded = await applyProjectCommand(currentProjectPath(), command);
  loadedProjectDirectory = loaded.directory;
  return summarizeProject(loaded.directory, loaded.bundle);
}

async function installWorkflowPreset(presetId: string) {
  const preset = workflowPresetById(presetId);
  if (!preset) {
    throw new Error(`Unknown workflow preset "${presetId}"`);
  }

  const projectDirectory = currentProjectPath();
  const workflowPath = safeProjectPath(projectDirectory, preset.template.workflowPath, "Workflow preset path");
  await atomicWriteFile(workflowPath, serializeJsonDocument(preset.workflowJson));

  const loaded = await applyProjectCommand(projectDirectory, {
    type: "workflow-template/upsert",
    patch: {
      workflowTemplate: preset.template
    }
  });
  loadedProjectDirectory = loaded.directory;
  return summarizeProject(loaded.directory, loaded.bundle);
}

async function runEditorValidation() {
  const loaded = await loadProjectFromDirectory(currentProjectPath());
  loadedProjectDirectory = loaded.directory;
  return createValidationReport(
    loaded.directory,
    [
      ...validateProjectBundle(loaded.bundle),
      ...(await validateProjectFiles(loaded))
    ]
  );
}

async function importProjectAssets(browserWindow: BrowserWindow) {
  const result = await dialog.showOpenDialog(browserWindow, {
    defaultPath: currentProjectPath(),
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"] }],
    properties: ["openFile", "multiSelections"]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return (await importProjectAssetFiles(result.filePaths)).snapshot;
}

async function promptForProjectDirectory(browserWindow: BrowserWindow) {
  const result = await dialog.showOpenDialog(browserWindow, {
    defaultPath: currentProjectPath(),
    properties: ["openDirectory"]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return readEditorProject(result.filePaths[0]);
}

async function promptForNewProjectDirectory(browserWindow: BrowserWindow, title: string) {
  const result = await dialog.showOpenDialog(browserWindow, {
    title,
    defaultPath: app.getPath("documents"),
    properties: ["openDirectory", "createDirectory"]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
}

async function createBlankEditorProject(browserWindow: BrowserWindow) {
  const projectDirectory = await promptForNewProjectDirectory(browserWindow, "Create Blank Project");
  if (!projectDirectory) return null;

  const loaded = await createBlankProject(projectDirectory);
  loadedProjectDirectory = loaded.directory;
  return summarizeProject(loaded.directory, loaded.bundle);
}

async function createEditorProjectFromStarter(browserWindow: BrowserWindow) {
  const projectDirectory = await promptForNewProjectDirectory(browserWindow, "Create Project From Starter");
  if (!projectDirectory) return null;

  const loaded = await createProjectFromTemplate(starterProjectPath(), projectDirectory);
  loadedProjectDirectory = loaded.directory;
  return summarizeProject(loaded.directory, loaded.bundle);
}

async function generatePromptPack(
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
) {
  if (request.providerId === "mock") {
    return mockPromptPackProvider.generate(request);
  }

  if (request.providerId === "lmstudio") {
    assertProviderEndpointConsent({
      allowRemoteProvider: request.allowRemoteProvider,
      baseUrl: request.lmStudioBaseUrl,
      defaultBaseUrl: "http://localhost:1234/v1",
      providerLabel: "LM Studio"
    });
    return generateLMStudioPromptPack(request, {
      ...(request.lmStudioApiKey ? { apiKey: request.lmStudioApiKey } : {}),
      ...(request.lmStudioBaseUrl ? { baseUrl: request.lmStudioBaseUrl } : {}),
      ...(request.lmStudioModel ? { model: request.lmStudioModel } : {})
    });
  }

  assertProviderEndpointConsent({
    allowRemoteProvider: request.allowRemoteProvider,
    baseUrl: request.openAiBaseUrl,
    defaultBaseUrl: "https://api.openai.com/v1",
    providerLabel: "OpenAI"
  });
  return generateOpenAIPromptPack(request, {
    ...(request.openAiApiKey ? { apiKey: request.openAiApiKey } : {}),
    ...(request.openAiBaseUrl ? { baseUrl: request.openAiBaseUrl } : {}),
    ...(request.openAiModel ? { model: request.openAiModel } : {})
  });
}

async function readComfyWorkflowJson(projectDirectory: string, workflowPath: string) {
  const trimmedPath = workflowPath.trim();
  if (!trimmedPath) return undefined;
  if (path.isAbsolute(trimmedPath)) {
    throw new Error("ComfyUI workflow path must be relative to the loaded project.");
  }

  const workflowFile = safeProjectPath(projectDirectory, trimmedPath, "ComfyUI workflow path");
  try {
    const contents = await readFile(workflowFile, "utf8");
    return JSON.parse(contents) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : "";
    throw new Error(
      `Unable to read ComfyUI workflow API JSON at "${trimmedPath}" inside the loaded project "${projectDirectory}". ` +
        `Workflow paths are project-relative for Creator Alpha; copy the workflow into the project, for example "workflows/${path.basename(trimmedPath)}", and use that relative path.${detail}`
    );
  }
}

async function readAssetUploadInput(projectDirectory: string, bundle: ProjectBundle, assetId: string) {
  const asset = bundle.assets[assetId];
  if (!asset) {
    throw new Error(`ComfyUI input asset "${assetId}" is not registered in the loaded project.`);
  }

  const assetPath = safeProjectPath(projectDirectory, asset.path, `ComfyUI input asset "${assetId}"`);
  const bytes = await readFile(assetPath);
  return {
    bytes,
    filename: path.basename(assetPath),
    mimeType: path.extname(assetPath).toLowerCase() === ".png" ? "image/png" : "application/octet-stream"
  };
}

async function generateImageAsset(request: GenerateImageAssetRequest) {
  const providerId = request.providerId === "comfyui" ? "comfyui-local" : request.providerId;
  if (!["comfyui-local", "openai-image", "google-image"].includes(providerId)) {
    throw new Error(`Unsupported image provider "${request.providerId}"`);
  }

  if (providerId === "comfyui-local") {
    assertProviderEndpointConsent({
      allowRemoteProvider: request.allowRemoteProvider,
      baseUrl: request.baseUrl,
      defaultBaseUrl: "http://127.0.0.1:8188",
      providerLabel: "ComfyUI"
    });
  } else if (providerId === "openai-image") {
    assertProviderEndpointConsent({
      allowRemoteProvider: request.allowRemoteProvider,
      baseUrl: request.openAiBaseUrl,
      defaultBaseUrl: "https://api.openai.com/v1",
      providerLabel: "OpenAI image"
    });
  } else {
    const googleDefaultBaseUrl =
      request.googleProvider === "vertex-ai"
        ? `https://${request.googleLocation?.trim() || "us-central1"}-aiplatform.googleapis.com/v1`
        : "https://generativelanguage.googleapis.com/v1beta";
    assertProviderEndpointConsent({
      allowRemoteProvider: request.allowRemoteProvider,
      baseUrl: request.googleBaseUrl,
      defaultBaseUrl: googleDefaultBaseUrl,
      providerLabel: request.googleProvider === "vertex-ai" ? "Vertex AI image" : "Gemini image"
    });
  }

  const projectDirectory = currentProjectPath();
  const projectBeforeGeneration = await loadProjectFromDirectory(projectDirectory);
  const recipe = request.recipeId ? projectBeforeGeneration.bundle.generationRecipes[request.recipeId] : undefined;
  if (request.recipeId && !recipe) {
    throw new Error(`Generation recipe "${request.recipeId}" was not found in the loaded project.`);
  }
  const workflowId = request.workflowId ?? recipe?.workflowId;
  const workflowTemplate = workflowId ? projectBeforeGeneration.bundle.workflowTemplates[workflowId] : undefined;
  if (workflowId && !workflowTemplate) {
    throw new Error(`Workflow template "${workflowId}" was not found in the loaded project.`);
  }
  if (workflowTemplate && request.maskAssetId && !workflowTemplate.supportedInputs.includes("mask-image")) {
    throw new Error(`Workflow template "${workflowTemplate.id}" does not support mask-image input.`);
  }
  const referenceImages = await Promise.all(
    (request.referenceAssetIds ?? []).map((assetId) =>
      readAssetUploadInput(projectDirectory, projectBeforeGeneration.bundle, assetId)
    )
  );
  const maskImage = request.maskAssetId
    ? await readAssetUploadInput(projectDirectory, projectBeforeGeneration.bundle, request.maskAssetId)
    : undefined;

  let result: ImageGenerationProviderResult;
  if (providerId === "comfyui-local") {
    const workflowPath = workflowTemplate?.workflowPath ?? request.workflowPath;
    const workflowJson = workflowPath ? await readComfyWorkflowJson(projectDirectory, workflowPath) : undefined;
    console.info(
      `[ComfyUI] Queueing ${request.targetId} at ${request.baseUrl ?? "http://127.0.0.1:8188"} using ${
        workflowTemplate
          ? `workflow template ${workflowTemplate.id}`
          : request.workflowPath
            ? `legacy workflow ${request.workflowPath}`
            : `checkpoint ${request.checkpointName}`
      }`
    );
    const comfyResult = await generateComfyUIImage(
      {
        height: request.height,
        prompt: request.prompt,
        targetId: request.targetId,
        width: request.width,
        ...(request.negativePrompt ? { negativePrompt: request.negativePrompt } : {}),
        ...(request.seed !== undefined ? { seed: request.seed } : {})
      },
      {
        ...(request.baseUrl ? { baseUrl: request.baseUrl } : {}),
        ...(request.checkpointName ? { checkpointName: request.checkpointName } : {}),
        ...(referenceImages.length ? { referenceImages } : {}),
        ...(maskImage ? { maskImage } : {}),
        ...(workflowTemplate ? { outputNodeId: request.outputNodeId ?? workflowTemplate.output.nodeId } : {}),
        ...(request.timeoutMs ? { timeoutMs: request.timeoutMs } : {}),
        ...(workflowTemplate ? { workflowBindings: workflowTemplate.bindings } : {}),
        ...(workflowJson ? { workflowJson } : {})
      }
    );
    result = {
      bytes: comfyResult.bytes,
      filename: comfyResult.filename,
      height: comfyResult.height,
      mimeType: comfyResult.mimeType,
      model: comfyResult.model,
      providerId,
      providerJobId: comfyResult.promptId,
      seed: comfyResult.seed,
      targetId: comfyResult.targetId,
      width: comfyResult.width
    };
  } else if (providerId === "openai-image") {
    result = await new OpenAIImageProvider({
      ...(request.openAiApiKey ? { apiKey: request.openAiApiKey } : {}),
      ...(request.openAiBaseUrl ? { baseUrl: request.openAiBaseUrl } : {}),
      ...(request.openAiMode ? { mode: request.openAiMode } : {}),
      ...(request.openAiModel ? { model: request.openAiModel } : {})
    }).generate({
      height: request.height,
      ...(request.negativePrompt ? { negativePrompt: request.negativePrompt } : {}),
      output: {
        expectedAlpha: request.expectedAlpha ?? false,
        mode: request.backgroundMode
      },
      prompt: request.prompt,
      providerConfig: {},
      ...(request.recipeId ? { recipeId: request.recipeId } : {}),
      ...(maskImage ? { maskAsset: { ...maskImage, id: request.maskAssetId! } } : {}),
      ...(referenceImages.length
        ? {
            referenceAssets: referenceImages.map((referenceImage, index) => ({
              ...referenceImage,
              id: request.referenceAssetIds![index]!
            }))
          }
        : {}),
      ...(request.seed !== undefined ? { seed: request.seed } : {}),
      targetId: request.targetId,
      ...(request.timeoutMs ? { timeoutMs: request.timeoutMs } : {}),
      width: request.width,
      ...(request.workflowFamily ? { workflowFamily: request.workflowFamily } : {}),
      ...(workflowId ? { workflowId } : {})
    });
  } else {
    result = await new GoogleImageProvider({
      ...(request.googleAccessToken ? { accessToken: request.googleAccessToken } : {}),
      ...(request.googleApiKey ? { apiKey: request.googleApiKey } : {}),
      ...(request.googleBaseUrl ? { baseUrl: request.googleBaseUrl } : {}),
      ...(request.googleLocation ? { location: request.googleLocation } : {}),
      ...(request.googleModel ? { model: request.googleModel } : {}),
      ...(request.googleProjectId ? { projectId: request.googleProjectId } : {}),
      ...(request.googleProvider ? { provider: request.googleProvider } : {})
    }).generate({
      height: request.height,
      ...(request.negativePrompt ? { negativePrompt: request.negativePrompt } : {}),
      output: {
        expectedAlpha: request.expectedAlpha ?? false,
        mode: request.backgroundMode
      },
      prompt: request.prompt,
      providerConfig: {},
      ...(request.recipeId ? { recipeId: request.recipeId } : {}),
      ...(maskImage ? { maskAsset: { ...maskImage, id: request.maskAssetId! } } : {}),
      ...(referenceImages.length
        ? {
            referenceAssets: referenceImages.map((referenceImage, index) => ({
              ...referenceImage,
              id: request.referenceAssetIds![index]!
            }))
          }
        : {}),
      ...(request.seed !== undefined ? { seed: request.seed } : {}),
      targetId: request.targetId,
      ...(request.timeoutMs ? { timeoutMs: request.timeoutMs } : {}),
      width: request.width,
      ...(request.workflowFamily ? { workflowFamily: request.workflowFamily } : {}),
      ...(workflowId ? { workflowId } : {})
    });
  }
  const image = nativeImage.createFromBuffer(Buffer.from(result.bytes));
  const hasAlphaPixels = bitmapHasAlphaPixels(image.toBitmap());
  const expectedAlpha = request.expectedAlpha ?? false;
  const outputWarning = generatedImageOutputWarning({
    backgroundMode: request.backgroundMode,
    expectedAlpha,
    hasAlphaPixels
  });

  const importedAssetsDirectory = path.join(projectDirectory, "assets", "imported");
  await mkdir(importedAssetsDirectory, { recursive: true });

  const safeFilename = `${slugifyAssetId(request.targetId)}-${result.providerJobId.slice(0, 8)}.png`;
  const targetPath = await uniquePath(path.join(importedAssetsDirectory, safeFilename));
  await writeFile(targetPath, Buffer.from(result.bytes));

  const existing = await loadProjectFromDirectory(projectDirectory);
  const existingAssetIds = new Set(Object.keys(existing.bundle.assets));
  const savedPromptPack = request.promptPackId ? existing.bundle.promptPacks[request.promptPackId] : undefined;
  const savedTarget =
    savedPromptPack && savedPromptPack.outputs.generationTargets.some((target) => target.id === request.targetId);
  const parentAssetIds = generatedImageParentAssetIds({
    maskAssetId: request.maskAssetId,
    referenceAssetIds: request.referenceAssetIds
  });
  const provenanceWorkflowFamily = request.workflowFamily ?? workflowTemplate?.family;
  const baseAssetId = slugifyAssetId(path.basename(targetPath, path.extname(targetPath)));
  let assetId = baseAssetId;
  let counter = 1;
  while (existingAssetIds.has(assetId)) {
    assetId = `${baseAssetId}-${counter}`;
    counter += 1;
  }

  const relativeFilePath = path.relative(projectDirectory, targetPath).replace(/\\/g, "/");
  const loaded = await applyProjectCommand(projectDirectory, {
    type: "asset/import",
    assets: [
      {
        documentPath: `assets/${assetId}.asset.json`,
        filePath: relativeFilePath,
        id: assetId,
        kind: "image",
        source: "generated",
        generation: {
          provider: result.providerId,
          providerJobId: result.providerJobId,
          ...(result.model ? { model: result.model } : {}),
          ...(result.seed !== undefined ? { seed: result.seed } : {}),
          ...(result.latencyMs !== undefined ? { latencyMs: result.latencyMs } : {}),
          ...(result.costUsd !== undefined ? { costUsd: result.costUsd } : {}),
          ...(workflowTemplate ? { workflowId: workflowTemplate.id } : {}),
          ...(request.recipeId ? { recipeId: request.recipeId } : {}),
          ...(provenanceWorkflowFamily ? { workflowFamily: provenanceWorkflowFamily } : {}),
          prompt: {
            positive: request.prompt,
            ...(request.negativePrompt ? { negative: request.negativePrompt } : {})
          },
          dimensions: {
            width: result.width,
            height: result.height
          },
          ...(savedPromptPack ? { promptPackId: savedPromptPack.id } : {}),
          ...(savedPromptPack && savedTarget ? { targetId: request.targetId } : {}),
          ...(parentAssetIds.length ? { parentAssetIds } : {}),
          ...(request.referenceAssetIds?.length ? { referenceAssetIds: request.referenceAssetIds } : {}),
          ...(request.maskAssetId ? { maskAssetId: request.maskAssetId } : {}),
          ...(request.guideIds?.length ? { guideIds: request.guideIds } : {}),
          ...(outputWarning || result.warnings?.length ? { warnings: [...(result.warnings ?? []), ...(outputWarning ? [outputWarning] : [])] } : {})
        }
      }
    ]
  });
  loadedProjectDirectory = loaded.directory;

  return {
    assetId,
    assetPath: relativeFilePath,
    expectedAlpha,
    hasAlphaPixels,
    model: result.model ?? result.providerId,
    ...(request.backgroundMode ? { backgroundMode: request.backgroundMode } : {}),
    ...(outputWarning ? { outputWarning } : {}),
    promptId: result.providerJobId,
    provider: result.providerId,
    seed: result.seed ?? request.seed ?? 0,
    snapshot: await summarizeProject(loaded.directory, loaded.bundle),
    status: "completed" as const,
    targetId: result.targetId
  };
}

app.whenReady().then(() => {
  if (app.isPackaged) {
    return startBundledPlayerServer();
  }
  return playerUrl;
}).then((resolvedPlayerUrl) => {
  playerUrl = resolvedPlayerUrl;
  handleTrustedIpc("preview:open", async (_window, request?: EditorPreviewRequest) => openPreview(request));
  handleTrustedIpc("preview:browser", async (_window, request?: EditorPreviewRequest) => {
    await openPreviewInBrowser(request);
  });
  handleTrustedIpc("project:load", async (_window, projectDirectory?: string) => {
    return readEditorProject(projectDirectory);
  });
  handleTrustedIpc("project:pick", async (window) => {
    return promptForProjectDirectory(window);
  });
  handleTrustedIpc("project:create-blank", async (window) => {
    return createBlankEditorProject(window);
  });
  handleTrustedIpc("project:create-from-starter", async (window) => {
    return createEditorProjectFromStarter(window);
  });
  handleTrustedIpc("project:import-assets", async (window) => {
    return importProjectAssets(window);
  });
  handleTrustedIpc("project:import-asset-files", async (_window, filePaths: unknown) => {
    return importProjectAssetFiles(filePaths);
  });
  handleTrustedIpc(
    "project:save-processed-image-asset",
    async (_window, request: unknown) => {
      return saveProcessedImageAsset(request);
    }
  );
  handleTrustedIpc("ai:prompt-pack", async (_window, request: Parameters<typeof generatePromptPack>[0]) => {
    return generatePromptPack(request);
  });
  handleTrustedIpc("ai:authoring-suggestions", async (_window, request?: { sceneId?: string }) => {
    const loaded = await loadProjectFromDirectory(currentProjectPath());
    return mockAuthoringProvider.suggest({ bundle: loaded.bundle, ...(request?.sceneId ? { sceneId: request.sceneId } : {}) });
  });
  handleTrustedIpc("ai:image-asset", async (_window, request: GenerateImageAssetRequest) => {
    return generateImageAsset(request);
  });
  handleTrustedIpc("workflow-preset:install", async (_window, presetId: string) => {
    return installWorkflowPreset(presetId);
  });
  handleTrustedIpc("project:command", async (_window, command: EditorProjectCommand) => {
    return applyEditorCommand(command);
  });
  handleTrustedIpc("project:validate", async () => {
    return runEditorValidation();
  });
  handleTrustedIpc("project:asset-url", async (_window, assetPath: string) => {
    return resolveProjectAssetUrl(assetPath);
  });
  handleTrustedIpc("recovery:load", async (_window, projectDirectory: string) => {
    return loadRecoverySnapshot(projectDirectory);
  });
  handleTrustedIpc("recovery:save", async (_window, snapshot: EditorRecoverySnapshot) => {
    await saveRecoverySnapshot(snapshot);
  });
  handleTrustedIpc("recovery:clear", async (_window, projectDirectory: string) => {
    await clearRecoverySnapshot(projectDirectory);
  });

  createEditorWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createEditorWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  playerServer?.close();
  playerServer = null;
  previewBundleServer?.close();
  previewBundleServer = null;
  previewSessions.clear();
});
