import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import path from "node:path";
import type {
  FlowDocument,
  Hotspot,
  ItemDocument,
  Layered2DScene,
  LocaleDocument,
  ScenePickup,
  ProjectBundle
} from "@pointclick/contracts";
import type { EditorRecoverySnapshot } from "./editor-session";
import type { EditorPreviewRequest } from "./preload";
import {
  applyProjectCommand,
  loadProjectFromDirectory,
  type EditorProjectCommand,
  validateProjectBundle
} from "@pointclick/project-io";
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";

let previewWindow: BrowserWindow | null = null;
let playerServer: Server | null = null;
let previewBundleServer: Server | null = null;
let playerUrl = process.env.POINTCLICK_PLAYER_URL ?? "http://127.0.0.1:5173";
let loadedProjectDirectory = path.resolve(__dirname, "../../../sample-game/project");
const previewSessions = new Map<string, ProjectBundle>();

const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
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
    previewBundleServer = createServer((request, response) => {
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

      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      const token = pathname.split("/").at(-1);
      if (!token || !previewSessions.has(token)) {
        response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "Preview bundle not found" }));
        return;
      }

      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(previewSessions.get(token)));
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

function registerPreviewBundle(bundle: ProjectBundle): string {
  const token = randomUUID();
  previewSessions.set(token, bundle);

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
    const token = registerPreviewBundle(request.bundle);
    url.searchParams.set("bundleUrl", `${serverUrl}/preview/${token}`);
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

function summarizeProject(projectDirectory: string, bundle: ProjectBundle) {
  const diagnostics = validateProjectBundle(bundle);
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

  return {
    activeFlowId: activeFlow?.id ?? null,
    activeHotspotId: activeHotspot?.id ?? null,
    activeItemId: activeItem?.id ?? null,
    activeLocale: activeLocale?.locale ?? null,
    activePickupId: activePickup?.id ?? null,
    activeSceneId: activeScene?.id ?? bundle.manifest.initialSceneId,
    directory: projectDirectory,
    diagnostics,
    flowCount: Object.keys(bundle.flows).length,
    flows: Object.values(bundle.flows),
    itemCount: Object.keys(bundle.items).length,
    items: Object.values(bundle.items),
    localeCount: Object.keys(bundle.locales).length,
    locales: Object.values(bundle.locales),
    manifest: bundle.manifest,
    sceneCount: Object.keys(bundle.scenes).length,
    scenes: Object.values(bundle.scenes),
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
  ipcMain.handle("project:command", async (_event, command: EditorProjectCommand) => {
    return applyEditorCommand(command);
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
