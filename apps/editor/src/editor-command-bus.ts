import type { EditorProjectCommand } from "@pointclick/project-io";
import type { EditorGateway } from "./editor-gateway";
import type { EditorProjectSnapshot } from "./preload";

/**
 * The single authoring command seam used by editor presentation code.
 * Controllers can add reconciliation and status policy here without exposing
 * the preload gateway to every feature component.
 */
export interface EditorCommandBus {
  apply(command: EditorProjectCommand): Promise<EditorProjectSnapshot>;
}

export function createEditorCommandBus(gateway: EditorGateway): EditorCommandBus {
  return {
    apply: (command) => gateway.applyCommand(command)
  };
}
