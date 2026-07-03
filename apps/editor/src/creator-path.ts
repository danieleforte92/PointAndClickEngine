import type { Workspace } from "./editor-session";

export type CreatorPathStepId = "project" | "scenes" | "narrative" | "ai" | "build";
export type CreatorPathStepState = "complete" | "warning" | "blocked" | "pending" | "optional";

export interface CreatorPathStep {
  actionLabel: string;
  detail: string;
  id: CreatorPathStepId;
  label: string;
  optional?: boolean;
  state: CreatorPathStepState;
  workspace: Workspace;
}

export interface CreatorPathInput {
  dirtyDraftCount: number;
  flowCount: number;
  generationRecipeCount: number;
  hasProjectSettingsChanges: boolean;
  missingNarrativeLinkCount: number;
  promptPackCount: number;
  sceneCount: number;
  validationErrorCount: number;
  validationRan: boolean;
  validationWarningCount: number;
}

export function createCreatorPathSteps(input: CreatorPathInput): CreatorPathStep[] {
  return [
    createProjectSetupStep(input),
    createScenesStep(input),
    createNarrativeStep(input),
    createAiStep(input),
    createBuildStep(input)
  ];
}

function createProjectSetupStep(input: CreatorPathInput): CreatorPathStep {
  if (input.hasProjectSettingsChanges) {
    return {
      actionLabel: "Review settings",
      detail: "Project settings have draft changes that still need to be applied.",
      id: "project",
      label: "Project setup",
      state: "warning",
      workspace: "overview"
    };
  }

  return {
    actionLabel: "Review settings",
    detail: "Title, entry scene, default locale, and viewport are saved.",
    id: "project",
    label: "Project setup",
    state: "complete",
    workspace: "overview"
  };
}

function createScenesStep(input: CreatorPathInput): CreatorPathStep {
  if (input.sceneCount === 0) {
    return {
      actionLabel: "Create scene",
      detail: "Create the first scene before wiring gameplay, narrative, or build validation.",
      id: "scenes",
      label: "Scenes",
      state: "blocked",
      workspace: "scene"
    };
  }

  return {
    actionLabel: "Open scenes",
    detail: `${input.sceneCount} scene(s) available for layers, hotspots, actors, pickups, and player setup.`,
    id: "scenes",
    label: "Scenes",
    state: "complete",
    workspace: "scene"
  };
}

function createNarrativeStep(input: CreatorPathInput): CreatorPathStep {
  if (input.missingNarrativeLinkCount > 0) {
    return {
      actionLabel: "Repair links",
      detail: `${input.missingNarrativeLinkCount} scene trigger(s) reference missing narrative flows.`,
      id: "narrative",
      label: "Narrative",
      state: "warning",
      workspace: "narrative"
    };
  }

  if (input.flowCount === 0) {
    return {
      actionLabel: "Open Narrative",
      detail: "No narrative flows have been created yet.",
      id: "narrative",
      label: "Narrative",
      state: "pending",
      workspace: "narrative"
    };
  }

  return {
    actionLabel: "Open Narrative",
    detail: `${input.flowCount} flow(s) available and linked scene references are healthy.`,
    id: "narrative",
    label: "Narrative",
    state: "complete",
    workspace: "narrative"
  };
}

function createAiStep(input: CreatorPathInput): CreatorPathStep {
  if (input.generationRecipeCount > 0) {
    return {
      actionLabel: "Open AI Studio",
      detail: `${input.generationRecipeCount} generation recipe(s) saved for repeatable asset production.`,
      id: "ai",
      label: "AI Studio",
      optional: true,
      state: "complete",
      workspace: "ai"
    };
  }

  if (input.promptPackCount > 0) {
    return {
      actionLabel: "Save recipe",
      detail: `${input.promptPackCount} prompt pack(s) saved, but no repeatable generation recipes yet.`,
      id: "ai",
      label: "AI Studio",
      optional: true,
      state: "warning",
      workspace: "ai"
    };
  }

  return {
    actionLabel: "Open AI Studio",
    detail: "Optional: use prompt packs and generation recipes when AI-assisted asset production is needed.",
    id: "ai",
    label: "AI Studio",
    optional: true,
    state: "optional",
    workspace: "ai"
  };
}

function createBuildStep(input: CreatorPathInput): CreatorPathStep {
  if (input.validationErrorCount > 0) {
    return {
      actionLabel: "Open Build",
      detail: `${input.validationErrorCount} blocking validation error(s) must be resolved before handoff.`,
      id: "build",
      label: "Build validation",
      state: "blocked",
      workspace: "build"
    };
  }

  if (input.dirtyDraftCount > 0) {
    return {
      actionLabel: "Review drafts",
      detail: `${input.dirtyDraftCount} draft change(s) are not reflected in saved-project validation.`,
      id: "build",
      label: "Build validation",
      state: "warning",
      workspace: "build"
    };
  }

  if (input.validationWarningCount > 0) {
    return {
      actionLabel: "Open Build",
      detail: `${input.validationWarningCount} validation warning(s) should be reviewed before handoff.`,
      id: "build",
      label: "Build validation",
      state: "warning",
      workspace: "build"
    };
  }

  if (!input.validationRan) {
    return {
      actionLabel: "Validate project",
      detail: "Run saved-project validation before treating the project as ready.",
      id: "build",
      label: "Build validation",
      state: "pending",
      workspace: "build"
    };
  }

  return {
    actionLabel: "Open Build",
    detail: "Saved-project validation is clean and current.",
    id: "build",
    label: "Build validation",
    state: "complete",
    workspace: "build"
  };
}
