import type {
  CursorValue,
  FlowDocument,
  FlowNode,
  Hotspot,
  Layered2DScene,
  LocaleDocument,
  SceneDocument
} from "@pointclick/contracts";

export type Workspace = "scene" | "narrative" | "assets" | "build";
export type FlagValueKind = "string" | "number" | "boolean";
export type DraftNodeType = "line" | "set-flag" | "end";

export interface HotspotDraft {
  actionFlowId: string;
  cursor: string;
  height: string;
  labelKey: string;
  width: string;
  x: string;
  y: string;
}

export interface SceneDraft {
  background: string;
  name: string;
  playerStartX: string;
  playerStartY: string;
  walkAreaHeight: string;
  walkAreaWidth: string;
  walkAreaX: string;
  walkAreaY: string;
}

export interface FlowLineDraftNode {
  id: string;
  next: string;
  speakerId: string;
  textKey: string;
  type: "line";
}

export interface FlowFlagDraftNode {
  id: string;
  key: string;
  next: string;
  type: "set-flag";
  value: string;
  valueKind: FlagValueKind;
}

export interface FlowEndDraftNode {
  id: string;
  type: "end";
}

export type FlowDraftNode = FlowLineDraftNode | FlowFlagDraftNode | FlowEndDraftNode;

export interface FlowDraft {
  id: string;
  name: string;
  nodes: FlowDraftNode[];
  startNodeId: string;
}

export interface LocaleEntryDraft {
  key: string;
  value: string;
}

export interface EditorProjectData {
  activeFlowId: string | null;
  activeHotspotId: string | null;
  activeLocale: string | null;
  activeSceneId: string;
  directory: string;
  flows: FlowDocument[];
  locales: LocaleDocument[];
  scenes: SceneDocument[];
}

export interface EditorSessionState {
  activeFlowId: string | null;
  activeHotspotId: string | null;
  activeLocale: string | null;
  activeSceneId: string | null;
  flowDrafts: Record<string, FlowDraft>;
  hotspotDrafts: Record<string, HotspotDraft>;
  localeDrafts: Record<string, Record<string, string>>;
  localeEntryDrafts: Record<string, LocaleEntryDraft>;
  sceneDrafts: Record<string, SceneDraft>;
}

export interface EditorHistoryState {
  future: EditorSessionState[];
  past: EditorSessionState[];
  present: EditorSessionState;
}

export interface EditorRecoverySnapshot {
  projectDirectory: string;
  savedAt: string;
  session: EditorSessionState;
}

export interface DirtyState {
  count: number;
  flowIds: Set<string>;
  hotspotKeys: Set<string>;
  localeIds: Set<string>;
  sceneIds: Set<string>;
}

export const cursorOptions: CursorValue[] = ["look", "talk", "use", "enter"];
export const hexColorPattern = /^#[0-9a-fA-F]{6}$/;

export function sceneItems(scenes: SceneDocument[]) {
  return scenes.filter((scene): scene is Layered2DScene => scene.type === "layered-2d");
}

export function createHotspotDraft(hotspot: Hotspot | null): HotspotDraft {
  return {
    actionFlowId: hotspot?.actionFlowId ?? "",
    cursor: hotspot?.cursor ?? "",
    height: hotspot ? String(hotspot.bounds.height) : "",
    labelKey: hotspot?.labelKey ?? "",
    width: hotspot ? String(hotspot.bounds.width) : "",
    x: hotspot ? String(hotspot.bounds.x) : "",
    y: hotspot ? String(hotspot.bounds.y) : ""
  };
}

export function createSceneDraft(scene: Layered2DScene | null): SceneDraft {
  return {
    background: scene?.background ?? "",
    name: scene?.name ?? "",
    playerStartX: scene ? String(scene.playerStart.x) : "",
    playerStartY: scene ? String(scene.playerStart.y) : "",
    walkAreaHeight: scene ? String(scene.walkArea.height) : "",
    walkAreaWidth: scene ? String(scene.walkArea.width) : "",
    walkAreaX: scene ? String(scene.walkArea.x) : "",
    walkAreaY: scene ? String(scene.walkArea.y) : ""
  };
}

export function inferFlagValueKind(value: string | number | boolean): FlagValueKind {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  return "string";
}

export function createFlowDraft(flow: FlowDocument | null): FlowDraft | null {
  if (!flow) return null;
  return {
    id: flow.id,
    name: flow.name,
    nodes: flow.nodes.map((node) => {
      if (node.type === "line") {
        return {
          id: node.id,
          next: node.next,
          speakerId: node.speakerId,
          textKey: node.textKey,
          type: "line"
        };
      }
      if (node.type === "set-flag") {
        return {
          id: node.id,
          key: node.key,
          next: node.next,
          type: "set-flag",
          value: String(node.value),
          valueKind: inferFlagValueKind(node.value)
        };
      }
      return {
        id: node.id,
        type: "end"
      };
    }),
    startNodeId: flow.startNodeId
  };
}

export function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function parseNumber(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export function nextNodeTarget(nodes: FlowDraftNode[]): string {
  return nodes.find((node) => node.type === "end")?.id ?? nodes[0]?.id ?? "";
}

export function generateNodeId(nodes: FlowDraftNode[], prefix: string): string {
  const ids = new Set(nodes.map((node) => node.id));
  for (let index = 1; index < nodes.length + 10; index += 1) {
    const candidate = `${prefix}-${index}`;
    if (!ids.has(candidate)) {
      return candidate;
    }
  }
  return `${prefix}-${Date.now()}`;
}

export function createNewFlowNode(type: DraftNodeType, nodes: FlowDraftNode[]): FlowDraftNode {
  if (type === "line") {
    return {
      id: generateNodeId(nodes, "line"),
      next: nextNodeTarget(nodes),
      speakerId: "speaker",
      textKey: "dialogue.new-line",
      type: "line"
    };
  }
  if (type === "set-flag") {
    return {
      id: generateNodeId(nodes, "flag"),
      key: "story.flag",
      next: nextNodeTarget(nodes),
      type: "set-flag",
      value: "true",
      valueKind: "boolean"
    };
  }
  return {
    id: generateNodeId(nodes, "end"),
    type: "end"
  };
}

export function buildFlowNodes(nodes: FlowDraftNode[]): FlowNode[] {
  return nodes.map((node) => {
    if (node.type === "line") {
      return {
        id: node.id.trim(),
        next: node.next.trim(),
        speakerId: node.speakerId.trim(),
        textKey: node.textKey.trim(),
        type: "line"
      };
    }
    if (node.type === "set-flag") {
      let value: string | number | boolean = node.value;
      if (node.valueKind === "boolean") {
        value = node.value.trim().toLowerCase() === "true";
      } else if (node.valueKind === "number") {
        value = Number(node.value);
      }
      return {
        id: node.id.trim(),
        key: node.key.trim(),
        next: node.next.trim(),
        type: "set-flag",
        value
      };
    }
    return {
      id: node.id.trim(),
      type: "end"
    };
  });
}

export function cloneSessionState(state: EditorSessionState): EditorSessionState {
  return JSON.parse(JSON.stringify(state)) as EditorSessionState;
}

export function sessionEquals(left: EditorSessionState, right: EditorSessionState): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function initializeEditorSession(project: EditorProjectData): EditorSessionState {
  return {
    activeFlowId: null,
    activeHotspotId: project.activeHotspotId,
    activeLocale: null,
    activeSceneId: project.activeSceneId,
    flowDrafts: {},
    hotspotDrafts: {},
    localeDrafts: {},
    localeEntryDrafts: {},
    sceneDrafts: {}
  };
}

export function createHistoryState(session: EditorSessionState): EditorHistoryState {
  return {
    future: [],
    past: [],
    present: cloneSessionState(session)
  };
}

export function commitHistory(
  history: EditorHistoryState,
  nextSession: EditorSessionState,
  limit = 100
): EditorHistoryState {
  if (sessionEquals(history.present, nextSession)) {
    return history;
  }

  const past = [...history.past, cloneSessionState(history.present)];
  return {
    future: [],
    past: past.slice(-limit),
    present: cloneSessionState(nextSession)
  };
}

export function undoHistory(history: EditorHistoryState): EditorHistoryState {
  const previous = history.past.at(-1);
  if (!previous) return history;

  return {
    future: [cloneSessionState(history.present), ...history.future],
    past: history.past.slice(0, -1),
    present: cloneSessionState(previous)
  };
}

export function redoHistory(history: EditorHistoryState): EditorHistoryState {
  const next = history.future[0];
  if (!next) return history;

  return {
    future: history.future.slice(1),
    past: [...history.past, cloneSessionState(history.present)],
    present: cloneSessionState(next)
  };
}

function findScene(project: EditorProjectData, sceneId: string | null): Layered2DScene | null {
  if (!sceneId) return null;
  return sceneItems(project.scenes).find((scene) => scene.id === sceneId) ?? null;
}

function findHotspot(
  project: EditorProjectData,
  sceneId: string | null,
  hotspotId: string | null
): Hotspot | null {
  const scene = findScene(project, sceneId);
  if (!scene || !hotspotId) return null;
  return scene.hotspots.find((hotspot) => hotspot.id === hotspotId) ?? null;
}

function findLocale(project: EditorProjectData, localeId: string | null): LocaleDocument | null {
  if (!localeId) return null;
  return project.locales.find((locale) => locale.locale === localeId) ?? null;
}

function findFlow(project: EditorProjectData, flowId: string | null): FlowDocument | null {
  if (!flowId) return null;
  return project.flows.find((flow) => flow.id === flowId) ?? null;
}

function hotspotKey(sceneId: string, hotspotId: string): string {
  return `${sceneId}::${hotspotId}`;
}

function localeEntriesEqual(left: Record<string, string>, right: Record<string, string>): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
}

export function getDirtyState(project: EditorProjectData, session: EditorSessionState): DirtyState {
  const flowIds = new Set<string>();
  const hotspotKeys = new Set<string>();
  const localeIds = new Set<string>();
  const sceneIds = new Set<string>();

  for (const [sceneId, draft] of Object.entries(session.sceneDrafts)) {
    const scene = findScene(project, sceneId);
    if (scene && JSON.stringify(draft) !== JSON.stringify(createSceneDraft(scene))) {
      sceneIds.add(sceneId);
    }
  }

  for (const [key, draft] of Object.entries(session.hotspotDrafts)) {
    const [sceneId, hotspotId] = key.split("::");
    if (!sceneId || !hotspotId) continue;
    const hotspot = findHotspot(project, sceneId, hotspotId);
    if (hotspot && JSON.stringify(draft) !== JSON.stringify(createHotspotDraft(hotspot))) {
      hotspotKeys.add(key);
    }
  }

  for (const [localeId, draft] of Object.entries(session.localeDrafts)) {
    const locale = findLocale(project, localeId);
    if (locale && !localeEntriesEqual(draft, locale.strings)) {
      localeIds.add(localeId);
    }
  }

  for (const [localeId, entryDraft] of Object.entries(session.localeEntryDrafts)) {
    if (entryDraft.key.trim() || entryDraft.value.trim()) {
      localeIds.add(localeId);
    }
  }

  for (const [flowId, draft] of Object.entries(session.flowDrafts)) {
    const flow = findFlow(project, flowId);
    if (flow && JSON.stringify(draft) !== JSON.stringify(createFlowDraft(flow))) {
      flowIds.add(flowId);
    }
  }

  return {
    count: flowIds.size + hotspotKeys.size + localeIds.size + sceneIds.size,
    flowIds,
    hotspotKeys,
    localeIds,
    sceneIds
  };
}

export function buildRecoverySnapshot(
  projectDirectory: string,
  project: EditorProjectData,
  session: EditorSessionState
): EditorRecoverySnapshot | null {
  const dirty = getDirtyState(project, session);
  if (dirty.count === 0) return null;

  const recoverySession: EditorSessionState = {
    activeFlowId: session.activeFlowId,
    activeHotspotId: session.activeHotspotId,
    activeLocale: session.activeLocale,
    activeSceneId: session.activeSceneId,
    flowDrafts: {},
    hotspotDrafts: {},
    localeDrafts: {},
    localeEntryDrafts: {},
    sceneDrafts: {}
  };

  for (const flowId of dirty.flowIds) {
    recoverySession.flowDrafts[flowId] = cloneSessionState({
      ...initializeEditorSession(project),
      flowDrafts: { [flowId]: session.flowDrafts[flowId]! }
    }).flowDrafts[flowId]!;
  }

  for (const key of dirty.hotspotKeys) {
    recoverySession.hotspotDrafts[key] = cloneSessionState({
      ...initializeEditorSession(project),
      hotspotDrafts: { [key]: session.hotspotDrafts[key]! }
    }).hotspotDrafts[key]!;
  }

  for (const localeId of dirty.localeIds) {
    if (session.localeDrafts[localeId]) {
      recoverySession.localeDrafts[localeId] = {
        ...session.localeDrafts[localeId]
      };
    }
    if (session.localeEntryDrafts[localeId]) {
      recoverySession.localeEntryDrafts[localeId] = {
        ...session.localeEntryDrafts[localeId]
      };
    }
  }

  for (const sceneId of dirty.sceneIds) {
    recoverySession.sceneDrafts[sceneId] = cloneSessionState({
      ...initializeEditorSession(project),
      sceneDrafts: { [sceneId]: session.sceneDrafts[sceneId]! }
    }).sceneDrafts[sceneId]!;
  }

  return {
    projectDirectory,
    savedAt: new Date().toISOString(),
    session: recoverySession
  };
}

export function restoreSessionFromRecovery(
  project: EditorProjectData,
  recovery: EditorRecoverySnapshot
): EditorSessionState {
  const base = initializeEditorSession(project);
  return {
    ...base,
    activeFlowId: recovery.session.activeFlowId ?? base.activeFlowId,
    activeHotspotId: recovery.session.activeHotspotId ?? base.activeHotspotId,
    activeLocale: recovery.session.activeLocale ?? base.activeLocale,
    activeSceneId: recovery.session.activeSceneId ?? base.activeSceneId,
    flowDrafts: { ...recovery.session.flowDrafts },
    hotspotDrafts: { ...recovery.session.hotspotDrafts },
    localeDrafts: { ...recovery.session.localeDrafts },
    localeEntryDrafts: { ...recovery.session.localeEntryDrafts },
    sceneDrafts: { ...recovery.session.sceneDrafts }
  };
}

export function discardSavedDraft(
  session: EditorSessionState,
  kind: "flow" | "hotspot" | "locale" | "scene",
  id: string
): EditorSessionState {
  const next = cloneSessionState(session);
  if (kind === "flow") delete next.flowDrafts[id];
  if (kind === "hotspot") delete next.hotspotDrafts[id];
  if (kind === "locale") {
    delete next.localeDrafts[id];
    delete next.localeEntryDrafts[id];
  }
  if (kind === "scene") delete next.sceneDrafts[id];
  return next;
}

export function createHotspotKey(sceneId: string, hotspotId: string): string {
  return hotspotKey(sceneId, hotspotId);
}
