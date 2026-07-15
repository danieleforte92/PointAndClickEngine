import type { FlowGraphDiagnostic } from "@pointclick/authoring";
import type { FlowDraftNode } from "../../../editor-session";

export type NarrativeNodeTone = "narrative" | "endpoint" | "diagnostic";

export function narrativeNodeTone(node: FlowDraftNode, diagnosticCount = 0): NarrativeNodeTone {
  if (diagnosticCount > 0) return "diagnostic";
  return node.type === "end" ? "endpoint" : "narrative";
}

export function narrativeDiagnosticsSummary(diagnostics: FlowGraphDiagnostic[]): string {
  if (diagnostics.length === 0) return "Graph is ready";
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  return errors > 0 ? `${errors} error(s) in graph` : `${diagnostics.length} warning(s) in graph`;
}
