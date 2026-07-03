import { describe, expect, it } from "vitest";
import { createProjectSummary } from "./project-summary";

describe("createProjectSummary", () => {
  it("derives project workspace counts from the current document lists", () => {
    expect(
      createProjectSummary({
        assets: [{}, {}],
        diagnostics: [{ severity: "error" }, { severity: "warning" }, { severity: "info" }],
        flows: [{}],
        generationRecipes: [{}, {}],
        items: [{}, {}, {}],
        locales: [{}, {}],
        promptPacks: [{}],
        scenes: [{}, {}]
      })
    ).toEqual({
      assetCount: 2,
      diagnosticCount: 3,
      errorCount: 1,
      flowCount: 1,
      generationRecipeCount: 2,
      itemCount: 3,
      localeCount: 2,
      promptPackCount: 1,
      sceneCount: 2,
      warningCount: 1
    });
  });

  it("keeps empty projects readable", () => {
    expect(
      createProjectSummary({
        assets: [],
        diagnostics: [],
        flows: [],
        generationRecipes: [],
        items: [],
        locales: [],
        promptPacks: [],
        scenes: []
      })
    ).toMatchObject({
      assetCount: 0,
      diagnosticCount: 0,
      errorCount: 0,
      sceneCount: 0,
      warningCount: 0
    });
  });
});
