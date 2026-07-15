import { describe, expect, it } from "vitest";
import { createNarrativeController } from "./narrative-controller";

describe("Narrative controller", () => {
  it("falls back to the flow start when selection is stale", () => {
    const controller = createNarrativeController();
    const draft = { id: "flow", name: "Flow", startNodeId: "start", nodes: [{ id: "start", type: "end" }] } as never;
    expect(controller.selectedNodeId(draft, "missing")).toBe("start");
    expect(controller.shouldShowDiagnostics(1)).toBe(true);
  });
});
