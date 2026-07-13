import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { createServer, type Server } from "node:http";
import { stat } from "node:fs/promises";
import path from "node:path";
import { BrowserWindow, shell } from "electron";
import type { ProjectBundle } from "@pointclick/contracts";
import { safeProjectPath, validateProjectBundle } from "@pointclick/project-io";
import type { EditorPreviewRequest } from "./preload";
import {
  assertAllowedExternalUrl,
  installWindowSecurity,
  playerCsp
} from "./security";

export interface PreviewManagerOptions {
  attachDiagnostics: (window: BrowserWindow) => void;
  getPlayerUrl: () => string;
  getProjectDirectory: () => string;
  mimeTypes: Readonly<Record<string, string>>;
  resourcesPath: string;
}

interface PreviewSession {
  bundle: ProjectBundle;
  projectDirectory: string;
}

function isPathInside(rootDirectory: string, candidatePath: string): boolean {
  const relativePath = path.relative(path.resolve(rootDirectory), path.resolve(candidatePath));
  return (
    relativePath === "" ||
    (!relativePath.startsWith(`..${path.sep}`) && relativePath !== ".." && !path.isAbsolute(relativePath))
  );
}

export class PreviewManager {
  private playerServer: Server | null = null;
  private previewBundleServer: Server | null = null;
  private previewWindow: BrowserWindow | null = null;
  private readonly previewSessions = new Map<string, PreviewSession>();

  constructor(private readonly options: PreviewManagerOptions) {}

  async startBundledPlayerServer(): Promise<string> {
    const root = path.resolve(this.options.resourcesPath, "dist");
    const indexPath = path.join(root, "index.html");

    this.playerServer = createServer(async (request, response) => {
      try {
        const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
        const candidate = path.resolve(root, `.${pathname}`);
        const requestedPath = isPathInside(root, candidate) ? candidate : indexPath;
        const filePath = (await stat(requestedPath)).isFile() ? requestedPath : indexPath;
        response.writeHead(200, {
          "Content-Type": this.options.mimeTypes[path.extname(filePath)] ?? "application/octet-stream",
          "Cache-Control": filePath === indexPath ? "no-cache" : "public, max-age=31536000, immutable",
          ...(filePath === indexPath ? { "Content-Security-Policy": playerCsp } : {})
        });
        createReadStream(filePath).pipe(response);
      } catch {
        response.writeHead(404);
        response.end("Not found");
      }
    });

    await new Promise<void>((resolve, reject) => {
      this.playerServer?.once("error", reject);
      this.playerServer?.listen(0, "127.0.0.1", resolve);
    });

    const address = this.playerServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to determine bundled player server address");
    }
    return `http://127.0.0.1:${address.port}`;
  }

  async open(request?: EditorPreviewRequest): Promise<void> {
    const previewUrl = await this.buildUrl(request);

    if (this.previewWindow && !this.previewWindow.isDestroyed()) {
      void this.previewWindow.loadURL(previewUrl);
      this.previewWindow.show();
      this.previewWindow.focus();
      return;
    }

    this.previewWindow = new BrowserWindow({
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
        sandbox: !process.argv.includes("--no-sandbox")
      }
    });
    installWindowSecurity(this.previewWindow, () => {
      try {
        return [new URL(this.options.getPlayerUrl()).origin];
      } catch {
        return [];
      }
    });
    this.options.attachDiagnostics(this.previewWindow);
    this.previewWindow.on("closed", () => {
      this.previewWindow = null;
    });
    void this.previewWindow.loadURL(previewUrl);
  }

  async openInBrowser(request?: EditorPreviewRequest): Promise<void> {
    const previewUrl = await this.buildUrl(request);
    assertAllowedExternalUrl(previewUrl);
    await shell.openExternal(previewUrl);
  }

  close(): void {
    this.playerServer?.close();
    this.playerServer = null;
    this.previewBundleServer?.close();
    this.previewBundleServer = null;
    this.previewWindow = null;
    this.previewSessions.clear();
  }

  private async buildUrl(request?: EditorPreviewRequest): Promise<string> {
    const url = new URL(this.options.getPlayerUrl());
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

      const serverUrl = await this.ensurePreviewBundleServer();
      const token = this.registerPreviewBundle(request.bundle, this.options.getProjectDirectory());
      url.searchParams.set("bundleUrl", `${serverUrl}/preview/${token}`);
      url.searchParams.set("assetBaseUrl", `${serverUrl}/asset/${token}/`);
    }

    return url.toString();
  }

  private async ensurePreviewBundleServer(): Promise<string> {
    if (!this.previewBundleServer) {
      this.previewBundleServer = createServer(async (request, response) => {
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
        const previewSession = token ? this.previewSessions.get(token) : null;
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
              "Content-Type": this.options.mimeTypes[path.extname(candidate)] ?? "application/octet-stream"
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
        this.previewBundleServer?.once("error", reject);
        this.previewBundleServer?.listen(0, "127.0.0.1", resolve);
      });
    }

    const address = this.previewBundleServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to determine preview bundle server address");
    }
    return `http://127.0.0.1:${address.port}`;
  }

  private registerPreviewBundle(bundle: ProjectBundle, projectDirectory: string): string {
    const token = randomUUID();
    this.previewSessions.set(token, { bundle, projectDirectory });

    if (this.previewSessions.size > 8) {
      const oldestToken = this.previewSessions.keys().next().value;
      if (oldestToken) this.previewSessions.delete(oldestToken);
    }

    return token;
  }
}
