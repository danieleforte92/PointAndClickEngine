import { describe, expect, it } from "vitest";
import { createCreatorPathSteps, type CreatorPathInput } from "./creator-path";

const readyInput: CreatorPathInput = {
  dirtyDraftCount: 0,
  flowCount: 2,
  generationRecipeCount: 0,
  hasProjectSettingsChanges: false,
  missingNarrativeLinkCount: 0,
  promptPackCount: 0,
  sceneCount: 3,
  validationErrorCount: 0,
  validationRan: true,
  validationWarningCount: 0
};

function stepState(input: CreatorPathInput, id: string) {
  const step = createCreatorPathSteps(input).find((candidate) => candidate.id === id);
  if (!step) throw new Error(`Missing creator path step ${id}`);
  return step.state;
}

describe("createCreatorPathSteps", () => {
  it("marks the core path complete when project, scenes, narrative, and build are ready", () => {
    const steps = createCreatorPathSteps(readyInput);

    expect(steps.map((step) => [step.id, step.state])).toEqual([
      ["project", "complete"],
      ["scenes", "complete"],
      ["narrative", "complete"],
      ["ai", "optional"],
      ["build", "complete"]
    ]);
  });

  it("surfaces unapplied project settings as the project setup warning", () => {
    expect(stepState({ ...readyInput, hasProjectSettingsChanges: true }, "project")).toBe("warning");
  });

  it("blocks the scene step until at least one scene exists", () => {
    expect(stepState({ ...readyInput, sceneCount: 0 }, "scenes")).toBe("blocked");
  });

  it("prioritizes missing narrative links over empty or healthy flow counts", () => {
    const steps = createCreatorPathSteps({
      ...readyInput,
      flowCount: 0,
      missingNarrativeLinkCount: 2
    });

    expect(steps.find((step) => step.id === "narrative")).toMatchObject({
      state: "warning",
      workspace: "narrative"
    });
  });

  it("treats AI Studio as optional until prompts or recipes make it actionable", () => {
    expect(stepState({ ...readyInput, promptPackCount: 1 }, "ai")).toBe("warning");
    expect(stepState({ ...readyInput, generationRecipeCount: 1, promptPackCount: 1 }, "ai")).toBe("complete");
  });

  it("orders build validation states from blockers to pending and complete", () => {
    expect(stepState({ ...readyInput, validationErrorCount: 1 }, "build")).toBe("blocked");
    expect(stepState({ ...readyInput, dirtyDraftCount: 1 }, "build")).toBe("warning");
    expect(stepState({ ...readyInput, validationWarningCount: 1 }, "build")).toBe("warning");
    expect(stepState({ ...readyInput, validationRan: false }, "build")).toBe("pending");
  });
});
