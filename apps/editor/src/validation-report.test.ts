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
      }
    ]);

    expect(issues.map((issue) => issue.target)).toEqual([
      { kind: "player", sceneId: "intro" },
      { kind: "hotspot", sceneId: "intro", hotspotId: "door" },
      { kind: "actor", sceneId: "intro", actorId: "captain" },
      { kind: "asset", assetId: "hero-sheet" }
    ]);
    expect(issues.map((issue) => issue.actionLabel)).toEqual([
      "Open player setup",
      "Open hotspot",
      "Open actor",
      "Open asset"
    ]);
  });
});
