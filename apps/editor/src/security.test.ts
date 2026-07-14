import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertAllowedExternalUrl,
  editorCsp,
  installPermissionDenyPolicy,
  installWindowSecurity,
  isAllowedExternalUrl,
  isAllowedNavigationUrl,
  playerCsp
} from "./security";

describe("Electron security policy", () => {
  it("allows only trusted editor and preview origins", () => {
    expect(isAllowedNavigationUrl("file:///editor/index.html", ["file://"])).toBe(true);
    expect(isAllowedNavigationUrl("file://untrusted.example/editor.html", ["file://"])).toBe(false);
    expect(isAllowedNavigationUrl("http://127.0.0.1:5173/", ["http://127.0.0.1:5173"])).toBe(true);
    expect(isAllowedNavigationUrl("https://evil.example/", ["http://127.0.0.1:5173"])).toBe(false);
    expect(isAllowedNavigationUrl("javascript:alert(1)", ["http://127.0.0.1:5173"])).toBe(false);
  });

  it("allows HTTPS and loopback HTTP external links only", () => {
    expect(isAllowedExternalUrl("https://example.com/docs")).toBe(true);
    expect(isAllowedExternalUrl("http://127.0.0.1:5173/preview")).toBe(true);
    expect(isAllowedExternalUrl("http://192.168.1.10/preview")).toBe(false);
    expect(isAllowedExternalUrl("file:///etc/passwd")).toBe(false);
    expect(isAllowedExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedExternalUrl("https://user:password@example.com")).toBe(false);
    expect(() => assertAllowedExternalUrl("data:text/html,blocked")).toThrow(/blocked/);
  });

  it("declares restrictive CSPs for editor and player surfaces", () => {
    for (const policy of [editorCsp, playerCsp]) {
      expect(policy).toContain("object-src 'none'");
      expect(policy).toContain("script-src 'self'");
    }
    expect(editorCsp).toContain("frame-src http://127.0.0.1:*");
    expect(editorCsp).toContain("frame-ancestors 'none'");
    expect(playerCsp).toContain("frame-ancestors 'self' http://127.0.0.1:*");
  });

  it("allows the local player frame in the CSP applied by the editor document", () => {
    const editorHtml = readFileSync(path.resolve(__dirname, "../index.html"), "utf8");

    expect(editorHtml).toContain("frame-src http://127.0.0.1:* http://localhost:*");
  });

  it("blocks untrusted navigation and popup requests", () => {
    let navigationHandler: ((event: { preventDefault(): void }, url: string) => void) | undefined;
    let popupHandler: (() => { action: string }) | undefined;
    const window = {
      webContents: {
        on(event: string, handler: typeof navigationHandler) {
          if (event === "will-navigate") navigationHandler = handler;
        },
        setWindowOpenHandler(handler: () => { action: string }) {
          popupHandler = handler;
        }
      }
    } as never;

    installWindowSecurity(window, () => ["http://127.0.0.1:5173"]);
    let prevented = false;
    navigationHandler?.({ preventDefault: () => { prevented = true; } }, "https://evil.example");

    expect(prevented).toBe(true);
    expect(popupHandler?.()).toEqual({ action: "deny" });
  });

  it("denies permission requests and checks by default", () => {
    let requestHandler: ((webContents: unknown, permission: string, callback: (allowed: boolean) => void) => void) | undefined;
    let checkHandler: ((webContents: unknown, permission: string) => boolean) | undefined;
    const targetSession = {
      setPermissionRequestHandler(handler: typeof requestHandler) {
        requestHandler = handler;
      },
      setPermissionCheckHandler(handler: typeof checkHandler) {
        checkHandler = handler;
      }
    } as never;

    installPermissionDenyPolicy(targetSession);
    let allowed = true;
    requestHandler?.({}, "media", (value) => { allowed = value; });

    expect(allowed).toBe(false);
    expect(checkHandler?.({}, "geolocation")).toBe(false);
  });
});
