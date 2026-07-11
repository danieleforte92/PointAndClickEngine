export interface IpcSenderIdentity {
  id: number;
  isDestroyed(): boolean;
}

export interface IpcWindowIdentity {
  isDestroyed(): boolean;
  webContents: IpcSenderIdentity;
}

export function isTrustedEditorIpcSender(
  sender: IpcSenderIdentity,
  editorWindow: IpcWindowIdentity | null
): boolean {
  return Boolean(
    editorWindow &&
      !editorWindow.isDestroyed() &&
      !sender.isDestroyed() &&
      editorWindow.webContents.id === sender.id
  );
}
