import { describe, expect, it } from "vitest";
import {
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
});
