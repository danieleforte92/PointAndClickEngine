import type { EditorValidationReport } from "../../../validation-report";

export interface BuildReadinessModel {
  detail: string;
  tone: "good" | "warn" | "error";
}

export function buildReadinessModel(report: EditorValidationReport | null): BuildReadinessModel {
  if (!report) return { detail: "Validation has not run", tone: "warn" };
  if (report.summary.errorCount > 0) return { detail: `${report.summary.errorCount} error(s) require attention`, tone: "error" };
  return report.summary.warningCount > 0
    ? { detail: `${report.summary.warningCount} warning(s) remain`, tone: "warn" }
    : { detail: "Project is ready to build", tone: "good" };
}
