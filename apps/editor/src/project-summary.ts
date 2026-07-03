export interface ProjectSummarySource {
  assets: readonly unknown[];
  diagnostics: ReadonlyArray<{ severity: string }>;
  flows: readonly unknown[];
  generationRecipes: readonly unknown[];
  items: readonly unknown[];
  locales: readonly unknown[];
  promptPacks: readonly unknown[];
  scenes: readonly unknown[];
}

export interface ProjectSummary {
  assetCount: number;
  diagnosticCount: number;
  errorCount: number;
  flowCount: number;
  generationRecipeCount: number;
  itemCount: number;
  localeCount: number;
  promptPackCount: number;
  sceneCount: number;
  warningCount: number;
}

export function createProjectSummary(project: ProjectSummarySource): ProjectSummary {
  return {
    assetCount: project.assets.length,
    diagnosticCount: project.diagnostics.length,
    errorCount: project.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length,
    flowCount: project.flows.length,
    generationRecipeCount: project.generationRecipes.length,
    itemCount: project.items.length,
    localeCount: project.locales.length,
    promptPackCount: project.promptPacks.length,
    sceneCount: project.scenes.length,
    warningCount: project.diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length
  };
}
