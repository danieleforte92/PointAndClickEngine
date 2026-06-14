import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import path from "node:path";
import type { Hotspot, Layered2DScene, LocaleDocument, ProjectBundle } from "@pointclick/contracts";
import { applyProjectCommand, loadProjectFromDirectory, type EditorProjectCommand } from "@pointclick/project-io";
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";

let previewWindow: BrowserWindow | null = null;
let playerServer: Server | null = null;
let playerUrl = process.env.POINTCLICK_PLAYER_URL ?? "http://127.0.0.1:5173";
let loadedProjectDirectory = path.resolve(__dirname, "../../../sample-game/project");

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

function openPreview(sceneId?: string): void {
  const url = new URL(playerUrl);
  url.searchParams.set("host", "electron");
  if (sceneId) url.searchParams.set("scene", sceneId);

  if (previewWindow && !previewWindow.isDestroyed()) {
    void previewWindow.loadURL(url.toString());
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
  void previewWindow.loadURL(url.toString());
}

function currentProjectPath(): string {
  return loadedProjectDirectory;
}

function summarizeProject(projectDirectory: string, bundle: ProjectBundle) {
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

  return {
    activeHotspotId: activeHotspot?.id ?? null,
    activeLocale: activeLocale?.locale ?? null,
    activeSceneId: activeScene?.id ?? bundle.manifest.initialSceneId,
    directory: projectDirectory,
    flowCount: Object.keys(bundle.flows).length,
    localeCount: Object.keys(bundle.locales).length,
    locales: Object.values(bundle.locales),
    manifest: bundle.manifest,
    sceneCount: Object.keys(bundle.scenes).length,
    scenes: Object.values(bundle.scenes),
    selectedHotspot: activeHotspot,
    selectedLocale: activeLocale,
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
  ipcMain.handle("preview:open", (_event, sceneId?: string) => openPreview(sceneId));
  ipcMain.handle("preview:browser", async () => {
    await shell.openExternal(playerUrl);
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
});
