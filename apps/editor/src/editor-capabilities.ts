import type { Workspace } from "./editor-session";

export type CapabilityStatus = "available" | "beta" | "in-development" | "planned";

export interface EditorCapability {
  id: string;
  label: string;
  status: CapabilityStatus;
  workspace: Workspace;
  summary: string;
  detail: string;
}

export const workspaceCapabilities: EditorCapability[] = [
  {
    id: "overview",
    label: "Project",
    status: "available",
    workspace: "overview",
    summary: "Game settings, structure, health, drafts, and capability status.",
    detail: "Use Project as the editor home to understand the game, jump to workspaces, and review readiness."
  },
  {
    id: "scene",
    label: "Scenes",
    status: "beta",
    workspace: "scene",
    summary: "Edit scenes, player setup, hotspots, actors, pickups, and walk areas.",
    detail:
      "Scene authoring supports direct viewport editing and keeps player setup in the scene inspector."
  },
  {
    id: "narrative",
    label: "Narrative",
    status: "beta",
    workspace: "narrative",
    summary: "Structured editing for flows and locale strings.",
    detail: "Narrative authoring supports the current linear flow model and localized strings, not graph editing yet."
  },
  {
    id: "assets",
    label: "Asset Studio",
    status: "beta",
    workspace: "assets",
    summary: "Project asset import, Character Gym, health, usage, and scene background assignment.",
    detail:
      "The asset library is wired for import, generated image imports, scene usage, Character Gym animation packs, health, and usage review today; provenance and versioning remain later milestones."
  },
  {
    id: "ai",
    label: "AI Studio",
    status: "beta",
    workspace: "ai",
    summary: "Generate prompt packs and local image assets.",
    detail:
      "AI authoring supports mock, OpenAI, and LM Studio prompt-pack drafts plus ComfyUI image generation and asset import."
  },
  {
    id: "build",
    label: "Build",
    status: "beta",
    workspace: "build",
    summary: "Saved-project validation and preview readiness checks.",
    detail:
      "The build workspace can validate saved project content today; packaging and export workflows still live in later milestones."
  }
];

export const toolCapabilities: EditorCapability[] = [
  {
    id: "tool-select",
    label: "Select",
    status: "available",
    workspace: "scene",
    summary: "Inspect scene entities without moving them.",
    detail: "Use Select to review the scene, click entities, and keep the viewport in inspection mode."
  },
  {
    id: "tool-hotspot",
    label: "Hotspot",
    status: "beta",
    workspace: "scene",
    summary: "Create or reshape hotspots directly in the viewport.",
    detail: "Hotspots can already be selected, dragged, and resized directly in the viewport."
  },
  {
    id: "tool-actor",
    label: "Actors",
    status: "beta",
    workspace: "scene",
    summary: "Place visible props and actor-style scene objects.",
    detail: "Actors can be selected, dragged, resized, and previewed as scene objects."
  },
  {
    id: "tool-pickup",
    label: "Pickup",
    status: "beta",
    workspace: "scene",
    summary: "Reposition and resize pickups in the viewport.",
    detail: "Pickups can be selected, dragged, and resized directly in the scene preview."
  },
  {
    id: "tool-player-start",
    label: "Player Start",
    status: "beta",
    workspace: "scene",
    summary: "Move the player start marker visually.",
    detail: "The player start anchor can be dragged in the viewport for the current scene."
  },
  {
    id: "tool-walk-area",
    label: "Walk area",
    status: "beta",
    workspace: "scene",
    summary: "Edit polygon walk areas visually.",
    detail: "Walk points can be moved directly and new points can be inserted from the viewport."
  },
  {
    id: "tool-occluder",
    label: "Occluder",
    status: "planned",
    workspace: "scene",
    summary: "Author occluders and depth helpers.",
    detail: "There is no runtime or project format support for occluders yet."
  }
];

export function capabilityBadgeLabel(status: CapabilityStatus): string {
  switch (status) {
    case "available":
      return "Available";
    case "beta":
      return "Beta";
    case "in-development":
      return "In development";
    case "planned":
      return "Planned";
  }
}

export function capabilityStatusTone(status: CapabilityStatus): "good" | "warn" | "muted" {
  switch (status) {
    case "available":
      return "good";
    case "beta":
      return "warn";
    case "in-development":
    case "planned":
      return "muted";
  }
}
