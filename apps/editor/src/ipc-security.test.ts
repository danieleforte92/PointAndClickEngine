import { describe, expect, it } from "vitest";
import { isTrustedEditorIpcSender, type IpcSenderIdentity, type IpcWindowIdentity } from "./ipc-security";

function sender(id: number, destroyed = false): IpcSenderIdentity {
  return { id, isDestroyed: () => destroyed };
}

function windowWith(senderIdentity: IpcSenderIdentity, destroyed = false): IpcWindowIdentity {
  return { isDestroyed: () => destroyed, webContents: senderIdentity };
}

describe("trusted Electron IPC sender policy", () => {
  it("accepts only the current editor window webContents", () => {
    const editorSender = sender(101);
    expect(isTrustedEditorIpcSender(editorSender, windowWith(editorSender))).toBe(true);
    expect(isTrustedEditorIpcSender(sender(202), windowWith(editorSender))).toBe(false);
  });

  it("rejects destroyed or unavailable windows and senders", () => {
    const editorSender = sender(101);
    expect(isTrustedEditorIpcSender(editorSender, null)).toBe(false);
    expect(isTrustedEditorIpcSender(editorSender, windowWith(editorSender, true))).toBe(false);
    expect(isTrustedEditorIpcSender(sender(101, true), windowWith(editorSender))).toBe(false);
  });
});
