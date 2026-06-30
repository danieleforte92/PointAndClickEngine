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
import {
  bitmapHasAlphaPixels,
  generatedImageOutputWarning,
  type GenerateImageAssetRequest
} from "./image-generation";
import { generateLMStudioPromptPack } from "./lmstudio-prompt-provider";
import { generateOpenAIPromptPack } from "./openai-prompt-provider";
import type { EditorPreviewRequest } from "./preload";
import { mockPromptPackProvider, type GeneratePromptPackRequest, type PromptProviderId } from "./prompt-pack-studio";
import { createValidationReport } from "./validation-report";
import {
  applyProjectCommand,
  createBlankProject,
  createProjectFromTemplate,
  loadProjectFromDirectory,
  safeProjectPath,
  type EditorProjectCommand,
  validateProjectBundle,
  validateProjectFiles
} from "@pointclick/project-io";
import { app, BrowserWindow, dialog, ipcMain, nativeImage, shell } from "electron";

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

  return window;
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
  await mkdir(recoveryDirectory(), { recursive: true });
  await writeFile(
    recoveryFilePath(snapshot.projectDirectory),
    `${JSON.stringify(snapshot, null, 2)}\n`,
    "utf8"
  );
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
    generationRecipes
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
    return generateLMStudioPromptPack(request, {
      ...(request.lmStudioApiKey ? { apiKey: request.lmStudioApiKey } : {}),
      ...(request.lmStudioBaseUrl ? { baseUrl: request.lmStudioBaseUrl } : {}),
      ...(request.lmStudioModel ? { model: request.lmStudioModel } : {})
    });
  }

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
  if (request.providerId !== "comfyui") {
    throw new Error(`Unsupported image provider "${request.providerId}"`);
  }

  const projectDirectory = currentProjectPath();
  const projectBeforeGeneration = await loadProjectFromDirectory(projectDirectory);
  const workflowJson = request.workflowPath
    ? await readComfyWorkflowJson(projectDirectory, request.workflowPath)
    : undefined;
  const referenceImages = await Promise.all(
    (request.referenceAssetIds ?? []).map((assetId) =>
      readAssetUploadInput(projectDirectory, projectBeforeGeneration.bundle, assetId)
    )
  );
  const maskImage = request.maskAssetId
    ? await readAssetUploadInput(projectDirectory, projectBeforeGeneration.bundle, request.maskAssetId)
    : undefined;
  console.info(
    `[ComfyUI] Queueing ${request.targetId} at ${request.baseUrl ?? "http://127.0.0.1:8188"} using ${
      request.workflowPath ? `workflow ${request.workflowPath}` : `checkpoint ${request.checkpointName}`
    }`
  );
  const result = await generateComfyUIImage(
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
      ...(request.timeoutMs ? { timeoutMs: request.timeoutMs } : {}),
      ...(workflowJson ? { workflowJson } : {})
    }
  );
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

  const safeFilename = `${slugifyAssetId(request.targetId)}-${result.promptId.slice(0, 8)}.png`;
  const targetPath = await uniquePath(path.join(importedAssetsDirectory, safeFilename));
  await writeFile(targetPath, Buffer.from(result.bytes));

  const existing = await loadProjectFromDirectory(projectDirectory);
  const existingAssetIds = new Set(Object.keys(existing.bundle.assets));
  const savedPromptPack = request.promptPackId ? existing.bundle.promptPacks[request.promptPackId] : undefined;
  const savedTarget =
    savedPromptPack && savedPromptPack.outputs.generationTargets.some((target) => target.id === request.targetId);
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
          provider: "comfyui",
          model: result.model,
          seed: result.seed,
          ...(request.workflowFamily ? { workflowFamily: request.workflowFamily } : {}),
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
          ...(request.referenceAssetIds?.length ? { referenceAssetIds: request.referenceAssetIds } : {}),
          ...(request.maskAssetId ? { maskAssetId: request.maskAssetId } : {}),
          ...(request.guideIds?.length ? { guideIds: request.guideIds } : {}),
          ...(outputWarning ? { warnings: [outputWarning] } : {})
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
    model: result.model,
    ...(request.backgroundMode ? { backgroundMode: request.backgroundMode } : {}),
    ...(outputWarning ? { outputWarning } : {}),
    promptId: result.promptId,
    provider: "comfyui" as const,
    seed: result.seed,
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
  ipcMain.handle("preview:open", async (_event, request?: EditorPreviewRequest) => openPreview(request));
  ipcMain.handle("preview:browser", async (_event, request?: EditorPreviewRequest) => {
    await openPreviewInBrowser(request);
  });
  ipcMain.handle("project:load", async (_event, projectDirectory?: string) => {
    return readEditorProject(projectDirectory);
  });
  ipcMain.handle("project:pick", async (event) => {
    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    if (!browserWindow) {
      throw new Error("Unable to resolve editor window");
    }
    return promptForProjectDirectory(browserWindow);
  });
  ipcMain.handle("project:create-blank", async (event) => {
    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    if (!browserWindow) {
      throw new Error("Unable to resolve editor window");
    }
    return createBlankEditorProject(browserWindow);
  });
  ipcMain.handle("project:create-from-starter", async (event) => {
    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    if (!browserWindow) {
      throw new Error("Unable to resolve editor window");
    }
    return createEditorProjectFromStarter(browserWindow);
  });
  ipcMain.handle("project:import-assets", async (event) => {
    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    if (!browserWindow) {
      throw new Error("Unable to resolve editor window");
    }
    return importProjectAssets(browserWindow);
  });
  ipcMain.handle("project:import-asset-files", async (_event, filePaths: unknown) => {
    return importProjectAssetFiles(filePaths);
  });
  ipcMain.handle(
    "project:save-processed-image-asset",
    async (_event, request: unknown) => {
      return saveProcessedImageAsset(request);
    }
  );
  ipcMain.handle("ai:prompt-pack", async (_event, request) => {
    return generatePromptPack(request);
  });
  ipcMain.handle("ai:image-asset", async (_event, request) => {
    return generateImageAsset(request);
  });
  ipcMain.handle("project:command", async (_event, command: EditorProjectCommand) => {
    return applyEditorCommand(command);
  });
  ipcMain.handle("project:validate", async () => {
    return runEditorValidation();
  });
  ipcMain.handle("project:asset-url", async (_event, assetPath: string) => {
    return resolveProjectAssetUrl(assetPath);
  });
  ipcMain.handle("recovery:load", async (_event, projectDirectory: string) => {
    return loadRecoverySnapshot(projectDirectory);
  });
  ipcMain.handle("recovery:save", async (_event, snapshot: EditorRecoverySnapshot) => {
    await saveRecoverySnapshot(snapshot);
  });
  ipcMain.handle("recovery:clear", async (_event, projectDirectory: string) => {
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
