import type { EditorValidationReport } from "../../../validation-report";
import { buildReadinessModel, type BuildReadinessModel } from "./build-model";

export interface BuildController {
  readiness(report: EditorValidationReport | null): BuildReadinessModel;
  canExport(report: EditorValidationReport | null): boolean;
}

export function createBuildController(): BuildController {
  return {
    readiness: buildReadinessModel,
    canExport: (report) => !!report && report.summary.errorCount === 0
  };
}
