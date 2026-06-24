import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import path from "node:path";
import type {
  AssetDocument,
  FlowDocument,
  Hotspot,
  ItemDocument,
  Layered2DScene,
  LocaleDocument,
  PromptPackDocument,
  ScenePickup,
  ProjectBundle
} from "@pointclick/contracts";
import type { EditorRecoverySnapshot } from "./editor-session";
import type { EditorPreviewRequest } from "./preload";
import { createValidationReport } from "./validation-report";
import {
  applyProjectCommand,
  loadProjectFromDirectory,
  type EditorProjectCommand,
  validateProjectBundle,
  validateProjectFiles
} from "@pointclick/project-io";
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";

let previewWindow: BrowserWindow | null = null;
let playerServer: Server | null = null;
let previewBundleServer: Server | null = null;
let playerUrl = process.env.POINTCLICK_PLAYER_URL ?? "http://127.0.0.1:5173";
let loadedProjectDirectory = path.resolve(__dirname, "../../../sample-game/project");
const previewSessions = new Map<string, { bundle: ProjectBundle; projectDirectory: string }>();

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

async function startBundledPlayerServer(): Promise<string> {
  const root = path.resolve(process.resourcesPath, "dist");
  const indexPath = path.join(root, "index.html");

  playerServer = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
      const candidate = path.resolve(root, `.${pathname}`);
      const requestedPath = candidate.startsWith(root) ? candidate : indexPath;
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
        const candidate = path.resolve(previewSession.projectDirectory, relativeAssetPath);
        if (
          !relativeAssetPath ||
          !candidate.startsWith(previewSession.projectDirectory)
        ) {
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
  const activeLocale: LocaleDocument | null =
    bundle.locales[bundle.manifest.defaultLocale] ??
    Object.values(bundle.locales)[0] ??
    null;
  const activeFlow: FlowDocument | null = Object.values(bundle.flows)[0] ?? null;
  const activePickup: ScenePickup | null = activeScene?.pickups[0] ?? null;
  const activeItem: ItemDocument | null = Object.values(bundle.items)[0] ?? null;
  const activeAsset: AssetDocument | null = Object.values(bundle.assets)[0] ?? null;
  const promptPacks: PromptPackDocument[] = Object.values(bundle.promptPacks);

  return {
    activeAssetId: activeAsset?.id ?? null,
    activeFlowId: activeFlow?.id ?? null,
    activeHotspotId: activeHotspot?.id ?? null,
    activeItemId: activeItem?.id ?? null,
    activeLocale: activeLocale?.locale ?? null,
    activePickupId: activePickup?.id ?? null,
    activeSceneId: activeScene?.id ?? bundle.manifest.initialSceneId,
    assetCount: Object.keys(bundle.assets).length,
    assets: Object.values(bundle.assets),
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
    selectedFlow: activeFlow,
    selectedHotspot: activeHotspot,
    selectedItem: activeItem,
    selectedLocale: activeLocale,
    selectedPickup: activePickup,
    selectedScene: activeScene
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

  const projectDirectory = currentProjectPath();
  const importedAssetsDirectory = path.join(projectDirectory, "assets", "imported");
  await mkdir(importedAssetsDirectory, { recursive: true });

  const existing = await loadProjectFromDirectory(projectDirectory);
  const existingAssetIds = new Set(Object.keys(existing.bundle.assets));
  const assets = [];

  for (const sourcePath of result.filePaths) {
    const sourceName = path.basename(sourcePath);
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

    await copyFile(sourcePath, targetPath);

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
  return summarizeProject(loaded.directory, loaded.bundle);
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
  ipcMain.handle("project:import-assets", async (event) => {
    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    if (!browserWindow) {
      throw new Error("Unable to resolve editor window");
    }
    return importProjectAssets(browserWindow);
  });
  ipcMain.handle("project:command", async (_event, command: EditorProjectCommand) => {
    return applyEditorCommand(command);
  });
  ipcMain.handle("project:validate", async () => {
    return runEditorValidation();
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
