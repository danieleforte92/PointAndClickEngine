import type { EditorProjectSnapshot } from "../../../preload";

export interface ProjectOverviewModel {
  diagnosticCount: number;
  directory: string;
  title: string;
}

export function projectOverviewModel(snapshot: EditorProjectSnapshot | null): ProjectOverviewModel {
  return {
    diagnosticCount: snapshot?.diagnostics.length ?? 0,
    directory: snapshot?.directory ?? "",
    title: snapshot?.manifest.title ?? "No project loaded"
  };
}
