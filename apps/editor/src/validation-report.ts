import type { ProjectDiagnostic } from "@pointclick/project-io";

export type BuildReadinessTarget =
  | { kind: "scene"; sceneId: string }
  | { kind: "player"; sceneId: string }
  | { kind: "hotspot"; sceneId: string; hotspotId: string }
  | { kind: "pickup"; sceneId: string; pickupId: string }
  | { kind: "actor"; sceneId: string; actorId: string }
  | { kind: "flow"; flowId: string }
  | { kind: "item"; itemId: string }
  | { kind: "asset"; assetId: string }
  | { kind: "animation-pack"; animationPackId: string }
  | { kind: "prompt-pack"; promptPackId: string; targetId?: string }
  | { kind: "generation-recipe"; generationRecipeId: string }
  | { kind: "workflow-template"; workflowTemplateId: string }
  | { kind: "style-bible"; styleBibleId: string };

export interface BuildReadinessIssue {
  actionLabel?: string;
  code: string;
  documentId?: string;
  id: string;
  message: string;
  path?: string;
  severity: ProjectDiagnostic["severity"];
  target?: BuildReadinessTarget;
}

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

function matchPath(path: string | undefined, pattern: RegExp): RegExpMatchArray | null {
  return path?.match(pattern) ?? null;
}

function readinessTargetFromDiagnostic(diagnostic: ProjectDiagnostic): BuildReadinessTarget | undefined {
  const sceneMatch = matchPath(diagnostic.path, /^scenes\/([^/]+)/);
  if (sceneMatch) {
    const sceneId = sceneMatch[1]!;
    if (diagnostic.path?.startsWith(`scenes/${sceneId}/player/`)) {
      return { kind: "player", sceneId };
    }

    const hotspotMatch = matchPath(diagnostic.path, /^scenes\/([^/]+)\/hotspots\/([^/]+)/);
    if (hotspotMatch) {
      return { kind: "hotspot", sceneId, hotspotId: hotspotMatch[2]! };
    }

    const pickupMatch = matchPath(diagnostic.path, /^scenes\/([^/]+)\/pickups\/([^/]+)/);
    if (pickupMatch) {
      return { kind: "pickup", sceneId, pickupId: pickupMatch[2]! };
    }

    const actorMatch = matchPath(diagnostic.path, /^scenes\/([^/]+)\/actors\/([^/]+)/);
    if (actorMatch) {
      return { kind: "actor", sceneId, actorId: actorMatch[2]! };
    }

    return { kind: "scene", sceneId };
  }

  const flowMatch = matchPath(diagnostic.path, /^flows\/([^/]+)/);
  if (flowMatch) {
    return { kind: "flow", flowId: flowMatch[1]! };
  }

  const itemMatch = matchPath(diagnostic.path, /^items\/([^/]+)/);
  if (itemMatch) {
    return { kind: "item", itemId: itemMatch[1]! };
  }

  const assetMatch = matchPath(diagnostic.path, /^assets\/([^/]+)/);
  if (assetMatch) {
    return { kind: "asset", assetId: assetMatch[1]! };
  }

  const animationPackMatch = matchPath(diagnostic.path, /^animation-packs\/([^/]+)/);
  if (animationPackMatch) {
    return { kind: "animation-pack", animationPackId: animationPackMatch[1]! };
  }

  const promptPackTargetMatch = matchPath(diagnostic.path, /^prompt-packs\/([^/]+)\/generationTargets\/([^/]+)/);
  if (promptPackTargetMatch) {
    return { kind: "prompt-pack", promptPackId: promptPackTargetMatch[1]!, targetId: promptPackTargetMatch[2]! };
  }

  const promptPackMatch = matchPath(diagnostic.path, /^prompt-packs\/([^/]+)/);
  if (promptPackMatch) {
    return { kind: "prompt-pack", promptPackId: promptPackMatch[1]! };
  }

  const generationRecipeMatch = matchPath(diagnostic.path, /^generation-recipes\/([^/]+)/);
  if (generationRecipeMatch) {
    return { kind: "generation-recipe", generationRecipeId: generationRecipeMatch[1]! };
  }

  const workflowTemplateMatch = matchPath(diagnostic.path, /^workflow-templates\/([^/]+)/);
  if (workflowTemplateMatch) {
    return { kind: "workflow-template", workflowTemplateId: workflowTemplateMatch[1]! };
  }

  const styleBibleMatch = matchPath(diagnostic.path, /^style-bibles\/([^/]+)/);
  if (styleBibleMatch) {
    return { kind: "style-bible", styleBibleId: styleBibleMatch[1]! };
  }

  if (diagnostic.code === "flow.invalid-references" && diagnostic.documentId) {
    return { kind: "flow", flowId: diagnostic.documentId };
  }
  if (diagnostic.code === "asset.file-missing" && diagnostic.documentId) {
    return { kind: "asset", assetId: diagnostic.documentId };
  }

  return undefined;
}

function actionLabelForTarget(target: BuildReadinessTarget | undefined): string | undefined {
  if (!target) return undefined;
  switch (target.kind) {
    case "player":
      return "Open player setup";
    case "hotspot":
      return "Open hotspot";
    case "pickup":
      return "Open pickup";
    case "actor":
      return "Open actor";
    case "scene":
      return "Open scene";
    case "flow":
      return "Open flow";
    case "item":
      return "Open item";
    case "asset":
      return "Open asset";
    case "animation-pack":
      return "Open animation pack";
    case "prompt-pack":
      return target.targetId ? "Open prompt target" : "Open prompt pack";
    case "generation-recipe":
      return "Open generation recipe";
    case "workflow-template":
      return "Open workflow template";
    case "style-bible":
      return "Open style bible";
  }
}

export function createBuildReadinessIssues(diagnostics: ProjectDiagnostic[]): BuildReadinessIssue[] {
  return diagnostics.map((diagnostic, index) => {
    const target = readinessTargetFromDiagnostic(diagnostic);
    const actionLabel = actionLabelForTarget(target);
    return {
      code: diagnostic.code,
      id: `${diagnostic.code}-${diagnostic.path ?? diagnostic.documentId ?? index}`,
      message: diagnostic.message,
      severity: diagnostic.severity,
      ...(actionLabel ? { actionLabel } : {}),
      ...(diagnostic.documentId ? { documentId: diagnostic.documentId } : {}),
      ...(diagnostic.path ? { path: diagnostic.path } : {}),
      ...(target ? { target } : {})
    };
  });
}
