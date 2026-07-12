import path from "node:path";
import { createServer, type ViteDevServer } from "vite";

const baseUrl = "http://127.0.0.1:5173";
const editorBaseUrl = "http://127.0.0.1:5174";

async function existingServerIsReady() {
  try {
    const response = await fetch(baseUrl);
    return response.ok;
  } catch {
    return false;
  }
}

async function existingEditorServerIsReady() {
  try {
    const response = await fetch(editorBaseUrl);
    return response.ok;
  } catch {
    return false;
  }
}

export default async function globalSetup() {
  const servers: ViteDevServer[] = [];

  if (process.env.CI || !(await existingServerIsReady())) {
    const playerServer = await createServer({
      configFile: path.resolve("apps/player-web/vite.config.ts"),
      root: path.resolve("apps/player-web"),
      server: {
        host: "127.0.0.1",
        port: 5173,
        strictPort: true
      }
    });
    await playerServer.listen();
    servers.push(playerServer);
  }

  if (process.env.CI || !(await existingEditorServerIsReady())) {
    const editorServer = await createServer({
      configFile: path.resolve("apps/editor/vite.renderer.config.ts"),
      root: path.resolve("apps/editor"),
      server: {
        host: "127.0.0.1",
        port: 5174,
        strictPort: true
      }
    });
    await editorServer.listen();
    servers.push(editorServer);
  }

  return async () => {
    await Promise.all(servers.map((server) => server.close()));
  };
}
