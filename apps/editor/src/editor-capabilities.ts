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
    label: "Overview",
    status: "available",
    workspace: "overview",
    summary: "Project health, diagnostics, drafts, and capability status.",
    detail: "Use this as the editor home to understand what is ready, limited, or still under construction."
  },
  {
    id: "scene",
    label: "Scene",
    status: "beta",
    workspace: "scene",
    summary: "Edit existing scenes, hotspots, pickups, and items.",
    detail: "Scene editing is usable for existing documents, but viewport tools are still inspector-driven."
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
    summary: "Project asset import, health, usage, and scene background assignment.",
    detail:
      "The asset library is wired for import and scene usage today; provenance, versioning, and AI generation remain future milestones."
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
    summary: "Select existing scene entities in the viewport.",
    detail: "Selection is currently the only direct viewport interaction fully supported."
  },
  {
    id: "tool-hotspot",
    label: "Hotspot",
    status: "in-development",
    workspace: "scene",
    summary: "Create or reshape hotspots directly in the viewport.",
    detail: "Hotspots can be edited in the inspector, but there is no direct-manipulation tool yet."
  },
  {
    id: "tool-walk-area",
    label: "Walk area",
    status: "in-development",
    workspace: "scene",
    summary: "Edit polygon walk areas visually.",
    detail: "Walk areas are editable numerically in the inspector; viewport editing is not implemented yet."
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
