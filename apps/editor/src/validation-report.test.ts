import { describe, expect, it } from "vitest";
import {
  createBuildReadinessIssues,
  createValidationReport,
  summarizeDiagnostics,
  validationStatusFromDiagnostics
} from "./validation-report";

describe("validation-report helpers", () => {
  it("summarizes warning and error counts", () => {
    const summary = summarizeDiagnostics([
      {
        code: "scene.hotspot-use-missing-flow",
        message: "Missing flow",
        severity: "error"
      },
      {
        code: "locale.missing-hotspot-label",
        message: "Missing locale key",
        severity: "warning"
      },
      {
        code: "locale.missing-pickup-label",
        message: "Missing pickup label",
        severity: "warning"
      }
    ]);

    expect(summary).toEqual({ errorCount: 1, warningCount: 2 });
    expect(
      validationStatusFromDiagnostics([
        {
          code: "scene.hotspot-use-missing-flow",
          message: "Missing flow",
          severity: "error"
        }
      ])
    ).toBe("failure");
  });

  it("creates a stable validation report shape", () => {
    const report = createValidationReport(
      "D:/Work/PointAndClickEngine/apps/sample-game/project",
      [],
      "2026-06-15T20:30:00.000Z"
    );

    expect(report).toEqual({
      diagnostics: [],
      projectDirectory: "D:/Work/PointAndClickEngine/apps/sample-game/project",
      ranAt: "2026-06-15T20:30:00.000Z",
      status: "success",
      summary: {
        errorCount: 0,
        warningCount: 0
      }
    });
  });

  it("maps diagnostics to actionable build readiness targets", () => {
    const issues = createBuildReadinessIssues([
      {
        code: "scene.player-asset-missing",
        message: "Player asset is missing",
        path: "scenes/intro/player/assetId",
        severity: "error"
      },
      {
        code: "locale.missing-hotspot-label",
        message: "Hotspot label is missing",
        path: "scenes/intro/hotspots/door/labelKey",
        severity: "warning"
      },
      {
        code: "scene.actor-animation-pack-missing",
        message: "Actor animation pack is missing",
        path: "scenes/intro/actors/captain/animationPackId",
        severity: "error"
      },
      {
        code: "asset.file-missing",
        documentId: "hero-sheet",
        message: "Asset file is missing",
        path: "assets/hero-sheet/path",
        severity: "error"
      },
      {
        code: "prompt-pack.generation-guide-missing",
        documentId: "mock-intro-art",
        message: "Prompt target guide is missing",
        path: "prompt-packs/mock-intro-art/generationTargets/door/guideIds/door-mask",
        severity: "error"
      },
      {
        code: "generation-recipe.workflow-missing",
        documentId: "door-sdxl",
        message: "Recipe workflow is missing",
        path: "generation-recipes/door-sdxl/workflowId",
        severity: "error"
      },
      {
        code: "workflow-template.file-missing",
        documentId: "sdxl-background",
        message: "Workflow file is missing",
        path: "workflow-templates/sdxl-background/workflowPath",
        severity: "error"
      },
      {
        code: "style-bible.reference-asset-missing",
        documentId: "main-style",
        message: "Style bible reference is missing",
        path: "style-bibles/main-style/referenceAssetIds/missing-ref",
        severity: "error"
      }
    ]);

    expect(issues.map((issue) => issue.target)).toEqual([
      { kind: "player", sceneId: "intro" },
      { kind: "hotspot", sceneId: "intro", hotspotId: "door" },
      { kind: "actor", sceneId: "intro", actorId: "captain" },
      { kind: "asset", assetId: "hero-sheet" },
      { kind: "prompt-pack", promptPackId: "mock-intro-art", targetId: "door" },
      { kind: "generation-recipe", generationRecipeId: "door-sdxl" },
      { kind: "workflow-template", workflowTemplateId: "sdxl-background" },
      { kind: "style-bible", styleBibleId: "main-style" }
    ]);
    expect(issues.map((issue) => issue.actionLabel)).toEqual([
      "Open player setup",
      "Open hotspot",
      "Open actor",
      "Open asset",
      "Open prompt target",
      "Open generation recipe",
      "Open workflow template",
      "Open style bible"
    ]);
  });
});
