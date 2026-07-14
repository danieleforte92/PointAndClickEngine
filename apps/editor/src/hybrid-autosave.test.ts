import { afterEach, describe, expect, it, vi } from "vitest";
import { HybridAutosaveController } from "./hybrid-autosave";

afterEach(() => vi.useRealTimers());

describe("hybrid autosave", () => {
  it("recovers immediately and coalesces valid document writes", async () => {
    vi.useFakeTimers();
    const recovered: string[] = [];
    const persisted: string[] = [];
    const controller = new HybridAutosaveController<string>({
      recover: (_id, value) => { recovered.push(value); },
      persist: async (_id, value) => void persisted.push(value),
      validate: () => []
    });

    controller.update("flow:door", "one");
    controller.update("flow:door", "two");
    expect(recovered).toEqual(["one", "two"]);
    await vi.advanceTimersByTimeAsync(800);
    expect(persisted).toEqual(["two"]);
  });

  it("keeps invalid drafts local until they become valid", async () => {
    vi.useFakeTimers();
    const persisted: string[] = [];
    const statuses: string[] = [];
    const controller = new HybridAutosaveController<string>({
      recover: () => undefined,
      persist: async (_id, value) => void persisted.push(value),
      validate: (_id, value) => (value ? [] : ["Required"]),
      onStatusChange: (_id, state) => statuses.push(state.status)
    });

    controller.update("scene:dock", "");
    await vi.advanceTimersByTimeAsync(1000);
    expect(persisted).toEqual([]);
    expect(statuses).toContain("draft-invalid");

    controller.update("scene:dock", "valid");
    await vi.advanceTimersByTimeAsync(800);
    expect(persisted).toEqual(["valid"]);
  });
});
