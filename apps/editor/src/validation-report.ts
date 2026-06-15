import type { ProjectDiagnostic } from "@pointclick/project-io";

export type EditorValidationStatus = "success" | "failure";
export type EditorValidationRunState = "idle" | "running" | "completed" | "failed-to-run";

export interface EditorValidationSummary {
  errorCount: number;
  warningCount: number;
}

export interface EditorValidationReport {
  diagnostics: ProjectDiagnostic[];
  projectDirectory: string;
  ranAt: string;
  status: EditorValidationStatus;
  summary: EditorValidationSummary;
}

export function summarizeDiagnostics(
  diagnostics: ProjectDiagnostic[]
): EditorValidationSummary {
  return diagnostics.reduce(
    (summary, diagnostic) => {
      if (diagnostic.severity === "error") {
        summary.errorCount += 1;
      } else if (diagnostic.severity === "warning") {
        summary.warningCount += 1;
      }
      return summary;
    },
    { errorCount: 0, warningCount: 0 }
  );
}

export function validationStatusFromDiagnostics(
  diagnostics: ProjectDiagnostic[]
): EditorValidationStatus {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error")
    ? "failure"
    : "success";
}

export function createValidationReport(
  projectDirectory: string,
  diagnostics: ProjectDiagnostic[],
  ranAt = new Date().toISOString()
): EditorValidationReport {
  return {
    diagnostics,
    projectDirectory,
    ranAt,
    status: validationStatusFromDiagnostics(diagnostics),
    summary: summarizeDiagnostics(diagnostics)
  };
}
