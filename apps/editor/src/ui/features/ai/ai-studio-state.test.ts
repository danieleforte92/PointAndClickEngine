import { describe, expect, it } from "vitest";
import { aiStudioReducer, initialAiStudioState } from "./ai-studio-state";

describe("ai studio state", () => {
  it("updates workflow state without mutating the previous slice", () => {
    const next = aiStudioReducer(initialAiStudioState, { type: "step/select", step: "context" });

    expect(next.step).toBe("context");
    expect(initialAiStudioState.step).toBe("brief");
  });

  it("keeps target and provider selection in the AI-owned slice", () => {
    const selected = aiStudioReducer(
      aiStudioReducer(initialAiStudioState, { type: "prompt-pack/select", promptPackId: "pack-1" }),
      { type: "generation-target/select", targetId: "scene-1-background" }
    );

    expect(selected).toMatchObject({
      selectedGenerationTargetId: "scene-1-background",
      selectedPromptPackId: "pack-1"
    });
  });

  it("supports controlled details disclosure", () => {
    expect(aiStudioReducer(initialAiStudioState, { type: "advanced/toggle", open: true }).advancedOpen).toBe(true);
    expect(
      aiStudioReducer(
        { ...initialAiStudioState, advancedOpen: true },
        { type: "advanced/toggle" }
      ).advancedOpen
    ).toBe(false);
  });
});
