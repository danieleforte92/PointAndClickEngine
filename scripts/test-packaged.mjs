import { access, cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { execFileSync, spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const executablePath = path.resolve(
  process.env.POINTCLICK_PACKAGED_EXE ??
    "apps/editor/out/PointClickStudio-win32-x64/pointclick-studio.exe"
);
const sourceProject = path.resolve("apps/starter-game/project");
const resultsDirectory = path.resolve("test-results/packaged");
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "pointclick-packaged-"));
const projectDirectory = path.join(temporaryDirectory, "project");
const userDataDirectory = path.join(temporaryDirectory, "user-data");

let child = null;
let cdp = null;
let editorSession = null;
let previewSession = null;
let packagedStdout = "";
let packagedStderr = "";

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a local CDP port."));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForCdp(port, timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const pages = await response.json();
        if (Array.isArray(pages) && pages.some((page) => page?.type === "page")) return;
      }
    } catch {
      // The packaged process needs a few seconds to expose its debugging endpoint.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Packaged editor did not expose CDP on port ${port}.`);
}

class CdpConnection {
  #socket;
  #nextId = 0;
  #pending = new Map();
  #events = [];

  constructor(socket) {
    this.#socket = socket;
    socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(String(data));
      if (message.id === undefined) {
        this.#events.push(message);
        return;
      }
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(`${message.error.message} (${message.error.code})`));
      } else {
        pending.resolve(message.result);
      }
    });
  }

  static async connect(port) {
    const version = await fetch(`http://127.0.0.1:${port}/json/version`).then((response) => response.json());
    const socket = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    return new CdpConnection(socket);
  }

  call(method, params = {}, sessionId) {
    const id = ++this.#nextId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 15_000);
      this.#pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });
      this.#socket.send(JSON.stringify({
        id,
        method,
        params,
        ...(sessionId ? { sessionId } : {})
      }));
    });
  }

  async attach(targetId) {
    const result = await this.call("Target.attachToTarget", { targetId, flatten: true });
    return result.sessionId;
  }

  async startTrace() {
    await this.call("Tracing.start", {
      categories: "devtools.timeline,disabled-by-default-devtools.screenshot",
      transferMode: "ReportEvents"
    });
  }

  async saveTrace(filePath) {
    await this.call("Tracing.end").catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const traceEvents = this.#events
      .filter((event) => event.method === "Tracing.dataCollected")
      .flatMap((event) => event.params?.value ?? []);
    await writeFile(filePath, `${JSON.stringify({ traceEvents }, null, 2)}\n`, "utf8");
  }

  async evaluate(expression, sessionId) {
    const result = await this.call(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true },
      sessionId
    );
    if (result?.exceptionDetails) {
      throw new Error(`Renderer evaluation failed: ${result.exceptionDetails.text ?? "unknown error"}`);
    }
    return result?.result?.value;
  }

  async screenshot(sessionId, filePath) {
    const result = await this.call("Page.captureScreenshot", { format: "png" }, sessionId);
    if (result?.data) await writeFile(filePath, Buffer.from(result.data, "base64"));
  }

  close() {
    this.#socket.close();
    for (const pending of this.#pending.values()) pending.reject(new Error("CDP connection closed."));
    this.#pending.clear();
  }
}

async function waitForEvaluation(expression, sessionId, timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const value = await cdp.evaluate(expression, sessionId);
      if (value) return value;
    } catch {
      // The target can exist a little before its document is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for renderer condition: ${expression}`);
}

async function targets() {
  const result = await cdp.call("Target.getTargets");
  return result.targetInfos ?? [];
}

async function waitForPreviewTarget(editorTargetId, timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const preview = (await targets()).find(
      (target) =>
        target.type === "page" &&
        target.targetId !== editorTargetId &&
        target.url.startsWith("http://127.0.0.1:")
    );
    if (preview) return preview;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Packaged editor did not open an embedded preview target.");
}

async function waitForTargetGone(targetId, timeoutMs = 10_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!(await targets()).some((target) => target.targetId === targetId)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Embedded preview target ${targetId} remained after close.`);
}

async function stopChild() {
  if (!child || child.killed) return;
  const pid = child.pid;
  let exited = child.exitCode !== null || child.signalCode !== null;
  const exitPromise = new Promise((resolve) => child.once("exit", () => { exited = true; resolve(); }));
  if (process.platform === "win32" && pid) {
    child.kill();
    try {
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    } catch {
      // The main process can already have exited after its last window closed.
    }
  } else {
    child.kill("SIGTERM");
  }
  await Promise.race([exitPromise, new Promise((resolve) => setTimeout(resolve, 1_500))]);
  if (pid && process.platform === "win32") {
    if (!exited) {
      try {
        const output = execFileSync("tasklist", ["/FI", `PID eq ${pid}`, "/NH"], { encoding: "utf8" });
        if (output.includes(String(pid))) {
          throw new Error(`Packaged editor process ${pid} remained after shutdown.`);
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("remained after shutdown")) throw error;
        // Some locked-down Windows runners deny tasklist inspection; taskkill and the exit event remain authoritative.
      }
    }
  }
  child = null;
}

async function launchPackagedEditor() {
  const port = await freePort();
  child = spawn(
    executablePath,
    [
      "--no-sandbox",
      `--remote-debugging-port=${port}`,
      "--remote-allow-origins=*",
      "--disable-gpu",
      "--disable-gpu-compositing",
      "--in-process-gpu",
      "--enable-unsafe-swiftshader",
      `--user-data-dir=${userDataDirectory}`,
      "--project",
      projectDirectory
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env: { ...process.env, POINTCLICK_USER_DATA_DIR: userDataDirectory }
    }
  );
  child.stderr?.on("data", (chunk) => {
    packagedStderr += String(chunk);
    process.stderr.write(`[packaged] ${chunk}`);
  });
  child.stdout?.on("data", (chunk) => {
    packagedStdout += String(chunk);
    process.stdout.write(`[packaged] ${chunk}`);
  });
  await waitForCdp(port);
  cdp = await CdpConnection.connect(port);
  await cdp.startTrace();
  const editorTarget = (await targets()).find((target) => target.type === "page");
  if (!editorTarget) throw new Error("Packaged editor did not expose an editor page target.");
  editorSession = await cdp.attach(editorTarget.targetId);
  await waitForEvaluation("document.body.innerText.includes('Project command center')", editorSession);
  return editorTarget.targetId;
}

const editorTitle = JSON.stringify("Packaged Smoke Adventure");

try {
  await access(executablePath);
  await cp(sourceProject, projectDirectory, { recursive: true });
  await mkdir(resultsDirectory, { recursive: true });

  let editorTargetId = await launchPackagedEditor();
  await waitForEvaluation(
    `Boolean(document.querySelector('.project-settings-grid input'))`,
    editorSession
  );
  await cdp.evaluate(
    `(() => { const input = document.querySelector('.project-settings-grid input'); if (!input) return false; input.focus(); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, ${editorTitle}); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); return input.value; })()`,
    editorSession
  );
  await cdp.evaluate(
    `([...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Apply settings'))?.click()`,
    editorSession
  );
  await waitForEvaluation(
    `document.querySelector('.project-settings-grid input')?.value === ${editorTitle}`,
    editorSession
  );

  await cdp.evaluate(
    `([...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Play Project'))?.click()`,
    editorSession
  );
  const previewTarget = await waitForPreviewTarget(editorTargetId);
  previewSession = await cdp.attach(previewTarget.targetId);
  try {
    await waitForEvaluation("Boolean(document.querySelector('canvas'))", previewSession);
  } catch (error) {
    const previewText = await cdp.evaluate("document.body?.innerText ?? ''", previewSession).catch(() => "<unavailable>");
    const previewResponse = await fetch(previewTarget.url).then(async (response) => `${response.status} ${await response.text()}`).catch(() => "<fetch failed>");
    throw new Error(`${error instanceof Error ? error.message : String(error)} Preview target ${previewTarget.url}: ${previewText} HTTP: ${previewResponse.slice(0, 500)}`);
  }
  await cdp.call("Target.closeTarget", { targetId: previewTarget.targetId });
  await waitForTargetGone(previewTarget.targetId);
  previewSession = null;

  await cdp.saveTrace(path.join(resultsDirectory, "packaged-trace.json"));
  cdp.close();
  cdp = null;
  editorSession = null;
  await stopChild();

  editorTargetId = await launchPackagedEditor();
  await waitForEvaluation(
    `document.querySelector('.project-settings-grid input')?.value === ${editorTitle}`,
    editorSession
  );

  await cdp.saveTrace(path.join(resultsDirectory, "packaged-trace.json"));

  console.log(`Packaged Windows smoke passed: ${executablePath}`);
} catch (error) {
  await mkdir(resultsDirectory, { recursive: true });
  if (cdp && editorSession) {
    await cdp.screenshot(editorSession, path.join(resultsDirectory, "editor-failure.png")).catch(() => undefined);
  }
  await writeFile(
    path.join(resultsDirectory, "error.txt"),
    error instanceof Error ? `${error.stack ?? error.message}\n` : `${String(error)}\n`,
    "utf8"
  );
  await writeFile(path.join(resultsDirectory, "packaged-stdout.log"), packagedStdout, "utf8");
  await writeFile(path.join(resultsDirectory, "packaged-stderr.log"), packagedStderr, "utf8");
  if (cdp) {
    await cdp.saveTrace(path.join(resultsDirectory, "packaged-trace.json")).catch(() => undefined);
  }
  if (cdp && previewSession) {
    await cdp.screenshot(previewSession, path.join(resultsDirectory, "preview-failure.png")).catch(() => undefined);
  }
  throw error;
} finally {
  cdp?.close();
  await stopChild().catch(() => undefined);
  await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => undefined);
}
