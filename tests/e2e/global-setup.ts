import path from "node:path";
import { createServer, type ViteDevServer } from "vite";

const baseUrl = "http://127.0.0.1:5173";

async function existingServerIsReady() {
  try {
    const response = await fetch(baseUrl);
    return response.ok;
  } catch {
    return false;
  }
}

export default async function globalSetup() {
  if (!process.env.CI && (await existingServerIsReady())) {
    return;
  }

  let server: ViteDevServer | null = await createServer({
    configFile: path.resolve("apps/player-web/vite.config.ts"),
    root: path.resolve("apps/player-web"),
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true
    }
  });

  await server.listen();

  return async () => {
    await server?.close();
    server = null;
  };
}
