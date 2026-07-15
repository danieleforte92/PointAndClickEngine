import type { EditorProjectSnapshot } from "../../../preload";
import { projectOverviewModel, type ProjectOverviewModel } from "./project-model";

export interface ProjectController {
  overview(snapshot: EditorProjectSnapshot | null): ProjectOverviewModel;
  canSave(title: string, viewport: { width: number; height: number }): boolean;
}

export function createProjectController(): ProjectController {
  return {
    overview: projectOverviewModel,
    canSave: (title, viewport) => title.trim().length > 0 && viewport.width >= 320 && viewport.height >= 180
  };
}
