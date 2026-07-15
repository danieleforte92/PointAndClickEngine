import { describe, expect, it } from "vitest";
import { createAiStudioController } from "./ai-studio-controller";
import { initialAiStudioState } from "./ai-studio-state";

describe("AI Studio controller", () => {
  it("keeps workflow state transitions pure and typed", () => {
    const controller = createAiStudioController();
    const next = controller.reduce(initialAiStudioState, { type: "step/select", step: "generate" });
    expect(next.step).toBe("generate");
    expect(initialAiStudioState.step).toBe("brief");
    expect(controller.canGenerate(next, true)).toBe(true);
  });
});
