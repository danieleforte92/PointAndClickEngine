import type { EditorNavigationTarget, Workspace } from "./editor-session";

export type EditorMode = "authoring" | "test-lab";
export type EditorPanelId = "navigation" | "inspector";

export interface EditorPanelPreferences {
  inspectorOpen: boolean;
  inspectorWidth: number;
  navigationOpen: boolean;
  navigationWidth: number;
}
export interface EditorNavigationState {
  mode: EditorMode;
  panelPreferences: EditorPanelPreferences;
  returnTarget: EditorNavigationTarget | null;
  target: EditorNavigationTarget;
}

export type EditorNavigationAction =
  | { type: "navigate"; target: EditorNavigationTarget }
  | { type: "workspace/change"; workspace: Workspace }
  | { type: "test-lab/open" }
  | { type: "test-lab/close" }
  | { type: "panel/toggle"; panel: EditorPanelId }
  | { type: "panel/resize"; panel: EditorPanelId; width: number };

export const defaultPanelPreferences: EditorPanelPreferences = {
  inspectorOpen: true,
  inspectorWidth: 336,
  navigationOpen: true,
  navigationWidth: 264
};

const panelWidthLimits: Record<EditorPanelId, { min: number; max: number }> = {
  inspector: { min: 280, max: 520 },
  navigation: { min: 220, max: 420 }
};

function clampPanelWidth(panel: EditorPanelId, width: number): number {
  const limits = panelWidthLimits[panel];
  return Math.round(Math.min(limits.max, Math.max(limits.min, width)));
}

export function createEditorNavigationState(
  panelPreferences: Partial<EditorPanelPreferences> = {}
): EditorNavigationState {
  return {
    mode: "authoring",
    panelPreferences: {
      ...defaultPanelPreferences,
      ...panelPreferences,
      inspectorWidth: clampPanelWidth(
        "inspector",
        panelPreferences.inspectorWidth ?? defaultPanelPreferences.inspectorWidth
      ),
      navigationWidth: clampPanelWidth(
        "navigation",
        panelPreferences.navigationWidth ?? defaultPanelPreferences.navigationWidth
      )
    },
    returnTarget: null,
    target: { workspace: "overview" }
  };
}

export function editorNavigationReducer(
  state: EditorNavigationState,
  action: EditorNavigationAction
): EditorNavigationState {
  switch (action.type) {
    case "navigate":
      return state.mode === "test-lab" ? state : { ...state, target: action.target };
    case "workspace/change":
      return state.mode === "test-lab"
        ? state
        : { ...state, target: { workspace: action.workspace } as EditorNavigationTarget };
    case "test-lab/open":
      return state.mode === "test-lab"
        ? state
        : { ...state, mode: "test-lab", returnTarget: state.target };
    case "test-lab/close":
      return state.mode === "authoring"
        ? state
        : {
            ...state,
            mode: "authoring",
            target: state.returnTarget ?? state.target,
            returnTarget: null
          };
    case "panel/toggle":
      return {
        ...state,
        panelPreferences: {
          ...state.panelPreferences,
          ...(action.panel === "navigation"
            ? { navigationOpen: !state.panelPreferences.navigationOpen }
            : { inspectorOpen: !state.panelPreferences.inspectorOpen })
        }
      };
    case "panel/resize":
      return {
        ...state,
        panelPreferences: {
          ...state.panelPreferences,
          ...(action.panel === "navigation"
            ? { navigationWidth: clampPanelWidth("navigation", action.width) }
            : { inspectorWidth: clampPanelWidth("inspector", action.width) })
        }
      };
  }
}

export const editorPreferencesStorageKey = "pointclick.editor.preferences.v1";

export function parseEditorPanelPreferences(value: string | null): EditorPanelPreferences {
  if (!value) return defaultPanelPreferences;
  try {
    const parsed = JSON.parse(value) as Partial<EditorPanelPreferences>;
    return createEditorNavigationState(parsed).panelPreferences;
  } catch {
    return defaultPanelPreferences;
  }
}
