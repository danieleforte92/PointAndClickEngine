import type { BrowserWindow, Session } from "electron";

export const editorCsp = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "frame-src http://127.0.0.1:* http://localhost:*",
  "script-src 'self' file:",
  "style-src 'self' 'unsafe-inline' file:",
  "img-src 'self' data: blob: file:",
  "font-src 'self' data: file:",
  "worker-src 'self' blob:",
  "connect-src 'self' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:*"
].join("; ");

export const playerCsp = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'self' http://127.0.0.1:* http://localhost:* file:",
  "script-src 'self' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: http://127.0.0.1:*",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:*"
].join("; ");

function originOf(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isAllowedNavigationUrl(value: string, allowedOrigins: readonly string[]): boolean {
  if (value.startsWith("file://")) {
    try {
      return allowedOrigins.includes("file://") && new URL(value).hostname === "";
    } catch {
      return false;
    }
  }

  const origin = originOf(value);
  return origin !== null && allowedOrigins.includes(origin);
}

export function isAllowedExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.protocol === "javascript:" || url.protocol === "data:") {
      return false;
    }
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function assertAllowedExternalUrl(value: string): void {
  if (!isAllowedExternalUrl(value)) {
    throw new Error("External URL blocked by the application security policy.");
  }
}

export function installWindowSecurity(
  window: BrowserWindow,
  allowedOrigins: () => readonly string[]
): void {
  window.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigationUrl(url, allowedOrigins())) {
      event.preventDefault();
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
}

export function installPermissionDenyPolicy(targetSession: Session): void {
  targetSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  targetSession.setPermissionCheckHandler(() => false);
}
