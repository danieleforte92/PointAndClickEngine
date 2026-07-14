import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { stat } from "node:fs/promises";
import path from "node:path";
import { BrowserWindow, shell } from "electron";
import type { ProjectBundle, RuntimeDebugSnapshot, RuntimeInputAction } from "@pointclick/contracts";
import { safeProjectPath, validateProjectBundle } from "@pointclick/project-io";
import type {
  EditorPreviewRequest,
  EditorPreviewSessionDescriptor,
  EditorPreviewTelemetry
} from "./preload";
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
  sessionTtlMs?: number;
}

interface PreviewSession {
  bundle: ProjectBundle;
  browserUrl?: string;
  expiresAt: number;
  projectDirectory: string;
  tracks: Record<RuntimeTelemetrySource, RuntimeTelemetryTrack>;
}

type RuntimeTelemetrySource = "embedded" | "browser";

interface RuntimeTelemetryTrack {
  actions: RuntimeInputAction[];
  snapshots: RuntimeDebugSnapshot[];
}

function telemetrySource(value: unknown): RuntimeTelemetrySource | null {
  return value === "embedded" || value === "browser" ? value : null;
}

async function readRequestBody(request: IncomingMessage, maxBytes: number): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.byteLength;
    if (size > maxBytes) throw new Error("Telemetry payload is too large.");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString("utf8");
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
    const previewUrl = (await this.buildSessionDescriptor(request)).embeddedUrl;

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
    const previewUrl = (await this.buildSessionDescriptor(request)).browserUrl;
    assertAllowedExternalUrl(previewUrl);
    await shell.openExternal(previewUrl);
  }

  async createSession(request: EditorPreviewRequest): Promise<EditorPreviewSessionDescriptor> {
    return this.buildSessionDescriptor(request);
  }

  async openSessionInBrowser(sessionId: string): Promise<void> {
    const session = this.requireSession(sessionId);
    if (!session.browserUrl) throw new Error("Preview session URL is unavailable.");
    assertAllowedExternalUrl(session.browserUrl);
    await shell.openExternal(session.browserUrl);
  }

  closeSession(sessionId: string): void {
    this.previewSessions.delete(sessionId);
  }

  readTelemetry(sessionId: string): EditorPreviewTelemetry {
    const session = this.requireSession(sessionId);
    return {
      actions: [...session.tracks.embedded.actions],
      browserActions: [...session.tracks.browser.actions],
      browserSnapshots: [...session.tracks.browser.snapshots],
      snapshots: [...session.tracks.embedded.snapshots]
    };
  }

  close(): void {
    this.playerServer?.close();
    this.playerServer = null;
    this.previewBundleServer?.close();
    this.previewBundleServer = null;
    this.previewWindow = null;
    this.previewSessions.clear();
  }

  private async buildSessionDescriptor(request?: EditorPreviewRequest): Promise<EditorPreviewSessionDescriptor> {
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
      url.searchParams.set("telemetryUrl", `${serverUrl}/telemetry/${token}`);
      url.searchParams.set("previewSession", token);
      const embeddedUrl = new URL(url);
      embeddedUrl.searchParams.set("runtimeTarget", "embedded");
      const browserUrl = new URL(url);
      browserUrl.searchParams.set("runtimeTarget", "browser");
      browserUrl.searchParams.set("replayUrl", `${serverUrl}/trace/${token}?source=embedded`);
      const session = this.previewSessions.get(token)!;
      session.browserUrl = browserUrl.toString();
      return {
        browserUrl: browserUrl.toString(),
        embeddedUrl: embeddedUrl.toString(),
        expiresAt: new Date(session.expiresAt).toISOString(),
        id: token
      };
    }

    const id = randomUUID();
    return {
      browserUrl: url.toString(),
      embeddedUrl: url.toString(),
      expiresAt: new Date(Date.now() + (this.options.sessionTtlMs ?? 30 * 60_000)).toISOString(),
      id
    };
  }

  private async ensurePreviewBundleServer(): Promise<string> {
    if (!this.previewBundleServer) {
      this.previewBundleServer = createServer(async (request, response) => {
        let allowedOrigin: string;
        try {
          allowedOrigin = new URL(this.options.getPlayerUrl()).origin;
        } catch {
          response.writeHead(500);
          response.end("Preview origin is invalid");
          return;
        }
        const requestOrigin = request.headers.origin;
        if (requestOrigin && requestOrigin !== allowedOrigin) {
          response.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
          response.end(JSON.stringify({ error: "Preview origin is not allowed" }));
          return;
        }
        response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
        response.setHeader("Vary", "Origin");
        response.setHeader("Cache-Control", "no-store");

        if (request.method === "OPTIONS") {
          response.writeHead(204, {
            "Access-Control-Allow-Headers": "content-type",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
          });
          response.end();
          return;
        }

        const requestUrl = new URL(request.url ?? "/", "http://localhost");
        const pathname = decodeURIComponent(requestUrl.pathname);
        const segments = pathname.split("/").filter(Boolean);
        const token = segments[1];
        const previewSession = token ? this.previewSessions.get(token) : null;
        if (!token || !previewSession) {
          response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
          response.end(JSON.stringify({ error: "Preview bundle not found" }));
          return;
        }
        if (previewSession.expiresAt <= Date.now()) {
          this.previewSessions.delete(token);
          response.writeHead(410, { "Content-Type": "application/json; charset=utf-8" });
          response.end(JSON.stringify({ error: "Preview session expired" }));
          return;
        }

        if (segments[0] === "telemetry") {
          if (request.method === "GET") {
            response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
            response.end(JSON.stringify({
              embedded: previewSession.tracks.embedded,
              browser: previewSession.tracks.browser
            }));
            return;
          }
          if (request.method !== "POST") {
            response.writeHead(405);
            response.end("Method not allowed");
            return;
          }
          try {
            const payload = JSON.parse(await readRequestBody(request, 256 * 1024)) as {
              action?: RuntimeInputAction;
              source?: unknown;
              version?: unknown;
              snapshot?: RuntimeDebugSnapshot;
            };
            const source = telemetrySource(payload.source);
            if (payload.version !== 1 || !source || (!payload.snapshot && !payload.action)) {
              throw new Error("Telemetry message is invalid.");
            }
            const track = previewSession.tracks[source];
            if (payload.snapshot) {
              if (typeof payload.snapshot.sequence !== "number") throw new Error("Telemetry snapshot is invalid.");
              const previous = track.snapshots.at(-1);
              if (!previous || JSON.stringify(previous) !== JSON.stringify(payload.snapshot)) {
                track.snapshots.push(payload.snapshot);
              }
              if (track.snapshots.length > 2_000) track.snapshots.shift();
            }
            if (payload.action) {
              if (typeof payload.action.sequence !== "number" || typeof payload.action.type !== "string") {
                throw new Error("Telemetry action is invalid.");
              }
              track.actions.push(payload.action);
              if (track.actions.length > 2_000) track.actions.shift();
            }
            response.writeHead(202, { "Content-Type": "application/json; charset=utf-8" });
            response.end(JSON.stringify({ accepted: true }));
          } catch (error) {
            response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
            response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Invalid telemetry" }));
          }
          return;
        }

        if (segments[0] === "trace") {
          if (request.method !== "GET") {
            response.writeHead(405);
            response.end("Method not allowed");
            return;
          }
          const source = telemetrySource(requestUrl.searchParams.get("source"));
          if (!source) {
            response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
            response.end(JSON.stringify({ error: "Trace source is invalid" }));
            return;
          }
          response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          response.end(JSON.stringify({ version: 1, actions: previewSession.tracks[source].actions }));
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
    this.previewSessions.set(token, {
      bundle,
      expiresAt: Date.now() + (this.options.sessionTtlMs ?? 30 * 60_000),
      projectDirectory,
      tracks: {
        browser: { actions: [], snapshots: [] },
        embedded: { actions: [], snapshots: [] }
      }
    });

    if (this.previewSessions.size > 8) {
      const oldestToken = this.previewSessions.keys().next().value;
      if (oldestToken) this.previewSessions.delete(oldestToken);
    }

    return token;
  }

  private requireSession(sessionId: string): PreviewSession {
    const session = this.previewSessions.get(sessionId);
    if (!session) throw new Error("Preview session was not found.");
    if (session.expiresAt <= Date.now()) {
      this.previewSessions.delete(sessionId);
      throw new Error("Preview session expired.");
    }
    return session;
  }
}
