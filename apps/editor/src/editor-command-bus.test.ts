import { describe, expect, it, vi } from "vitest";
import type { EditorProjectCommand } from "@pointclick/project-io";
import { createEditorCommandBus } from "./editor-command-bus";
import type { EditorGateway } from "./editor-gateway";
import type { EditorProjectSnapshot } from "./preload";

describe("editor command bus", () => {
  it("delegates the typed authoring command through the injected gateway", async () => {
    const snapshot = { manifest: { title: "Test" } } as unknown as EditorProjectSnapshot;
    const command = { type: "project/update-settings", patch: { title: "Test" } } as EditorProjectCommand;
    const applyCommand = vi.fn().mockResolvedValue(snapshot);
    const gateway = { applyCommand } as unknown as EditorGateway;

    const result = await createEditorCommandBus(gateway).apply(command);

    expect(result).toBe(snapshot);
    expect(applyCommand).toHaveBeenCalledWith(command);
  });
});
