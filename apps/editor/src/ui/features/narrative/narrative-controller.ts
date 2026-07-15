import type { FlowDraft } from "../../../editor-session";

export interface NarrativeController {
  selectedNodeId(draft: FlowDraft, requestedId: string | null): string;
  shouldShowDiagnostics(count: number): boolean;
}

export function createNarrativeController(): NarrativeController {
  return {
    selectedNodeId: (draft, requestedId) =>
      requestedId && draft.nodes.some((node) => node.id === requestedId) ? requestedId : draft.startNodeId,
    shouldShowDiagnostics: (count) => count > 0
  };
}
