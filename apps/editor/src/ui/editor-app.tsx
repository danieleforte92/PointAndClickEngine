import type {
  AssetDocument,
  CursorValue,
  FlowDocument,
  Hotspot,
  ItemDocument,
  Layered2DScene,
  LocaleDocument,
  Rect,
  SceneDocument,
  ScenePickup
} from "@pointclick/contracts";
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";
import {
  capabilityBadgeLabel,
  capabilityStatusTone,
  toolCapabilities,
  workspaceCapabilities
} from "../editor-capabilities";
import {
  buildHotspotUseItemFlows,
  buildFlowNodes,
  buildRecoverySnapshot,
  clampScenePoint,
  cloneSessionState,
  commitHistory,
  createFlowDraft,
  createHistoryState,
  createHotspotDraft,
  createItemDraft,
  createNewFlowNode,
  createPickupDraft,
  createSceneDraft,
  createHotspotKey,
  createPickupKey,
  cursorOptions,
  discardSavedDraft,
  getDirtyState,
  hexColorPattern,
  initializeEditorSession,
  insertDraftPointAfter,
  moveScenePoint,
  moveSceneRect,
  parseNumber,
  parsePositiveNumber,
  polygonArea,
  redoHistory,
  resizeSceneRectFromBottomRight,
  restoreSessionFromRecovery,
  sceneItems,
  type DraftNodeType,
  type EditorHistoryState,
  type EditorRecoverySnapshot,
  type EditorSessionState,
  type FlowDraft,
  type FlowDraftNode,
  type ScenePointDraftValue,
  type SceneRectDraftValue,
  sessionEquals,
  undoHistory,
  type Workspace
} from "../editor-session";
import { buildDraftProjectBundle } from "../preview-session";
import type { EditorProjectSnapshot } from "../preload";
import type { EditorValidationReport, EditorValidationRunState } from "../validation-report";
import { createValidationReport } from "../validation-report";

const emptyHistory = createHistoryState(
  initializeEditorSession({
    activeFlowId: null,
    activeHotspotId: null,
    activeItemId: null,
    activeLocale: null,
    activePickupId: null,
    activeSceneId: "",
    directory: "",
    flows: [],
    items: [],
    locales: [],
    scenes: []
  })
);

const emptyLocaleEntry = { key: "", value: "" };

function sceneFromSnapshot(snapshot: EditorProjectSnapshot | null, sceneId: string | null) {
  if (!snapshot || !sceneId) return null;
  return sceneItems(snapshot.scenes).find((scene) => scene.id === sceneId) ?? null;
}

function hotspotFromSnapshot(
  snapshot: EditorProjectSnapshot | null,
  sceneId: string | null,
  hotspotId: string | null
) {
  const scene = sceneFromSnapshot(snapshot, sceneId);
  if (!scene || !hotspotId) return null;
  return scene.hotspots.find((hotspot) => hotspot.id === hotspotId) ?? null;
}

function localeFromSnapshot(snapshot: EditorProjectSnapshot | null, localeId: string | null) {
  if (!snapshot || !localeId) return null;
  return snapshot.locales.find((locale) => locale.locale === localeId) ?? null;
}

function flowFromSnapshot(snapshot: EditorProjectSnapshot | null, flowId: string | null) {
  if (!snapshot || !flowId) return null;
  return snapshot.flows.find((flow) => flow.id === flowId) ?? null;
}

function itemFromSnapshot(snapshot: EditorProjectSnapshot | null, itemId: string | null) {
  if (!snapshot || !itemId) return null;
  return snapshot.items.find((item) => item.id === itemId) ?? null;
}

function pickupFromSnapshot(
  snapshot: EditorProjectSnapshot | null,
  sceneId: string | null,
  pickupId: string | null
) {
  const scene = sceneFromSnapshot(snapshot, sceneId);
  if (!scene || !pickupId) return null;
  return scene.pickups.find((pickup) => pickup.id === pickupId) ?? null;
}

function assetFromSnapshot(snapshot: EditorProjectSnapshot | null, assetId: string | null) {
  if (!snapshot || !assetId) return null;
  return snapshot.assets.find((asset) => asset.id === assetId) ?? null;
}

function isHexColor(value: string): boolean {
  return hexColorPattern.test(value);
}

function sceneBackgroundStyle(background: string, assetBase = "") {
  if (isHexColor(background)) {
    return { background };
  }
  const normalizedBase = assetBase.replace(/\\/g, "/").replace(/\/?$/, "/");
  const assetUrl = assetBase
    ? normalizedBase.startsWith("http")
      ? `${normalizedBase}${background}`
      : `file:///${normalizedBase}${background}`
    : background;
  return {
    actors: [],
    background: "#24384a",
    backgroundImage: `url("${assetUrl}")`,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover"
  };
}

function assetUsage(asset: AssetDocument, snapshot: EditorProjectSnapshot | null) {
  if (!snapshot) return [];
  return sceneItems(snapshot.scenes)
    .filter((scene) => scene.background === asset.path)
    .map((scene) => ({ sceneId: scene.id, sceneName: scene.name }));
}

function assetHealth(asset: AssetDocument, snapshot: EditorProjectSnapshot | null) {
  if (!snapshot) return "available";
  return snapshot.diagnostics.some(
    (diagnostic) =>
      diagnostic.code === "asset.file-missing" && diagnostic.documentId === asset.id
  )
    ? "missing"
    : "available";
}

function parseWalkAreaDraft(
  walkAreaPoints: Array<{ x: string; y: string }>
): { points: Array<{ x: number; y: number }> } | null {
  const points = walkAreaPoints.map((point) => {
    const x = parseNumber(point.x);
    const y = parseNumber(point.y);
    return x === null || y === null ? null : { x, y };
  });

  if (points.some((point) => point === null)) {
    return null;
  }

  return {
    points: points as Array<{ x: number; y: number }>
  };
}

function healthSummary(
  diagnostics: EditorProjectSnapshot["diagnostics"],
  dirtyDraftCount: number
) {
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warningCount = diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;

  if (errorCount > 0) {
    return {
      detail: `${dirtyDraftCount} dirty draft(s)`,
      label: `${errorCount} error(s), ${warningCount} warning(s)`,
      tone: "error" as const
    };
  }
  if (warningCount > 0 || dirtyDraftCount > 0) {
    return {
      detail: `${dirtyDraftCount} dirty draft(s)`,
      label: `${warningCount} warning(s), project needs review`,
      tone: "warn" as const
    };
  }
  return {
    detail: "No draft changes pending",
    label: "Project ready for preview",
    tone: "good" as const
  };
}

function formatValidationTimestamp(timestamp: string | null): string {
  if (!timestamp) return "Not run yet";
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) return timestamp;
  return value.toLocaleString("it-IT", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function validationTone(report: EditorValidationReport | null): "good" | "warn" | "error" | "muted" {
  if (!report) return "muted";
  if (report.summary.errorCount > 0) return "error";
  if (report.summary.warningCount > 0) return "warn";
  return "good";
}

function nextFlowId(snapshot: EditorProjectSnapshot): string {
  const existing = new Set(snapshot.flows.map((flow) => flow.id));
  let counter = 0;
  let candidate = "new-flow";
  while (existing.has(candidate)) {
    counter += 1;
    candidate = `new-flow-${counter}`;
  }
  return candidate;
}

function createDefaultFlowDocument(flowId: string): FlowDocument {
  return {
    id: flowId,
    name: "New Flow",
    nodes: [
      {
        id: "line-1",
        next: "end-1",
        speakerId: "speaker",
        textKey: `dialogue.${flowId}.01`,
        type: "line"
      },
      {
        id: "end-1",
        type: "end"
      }
    ],
    schemaVersion: 1,
    startNodeId: "line-1"
  };
}

function nextItemId(snapshot: EditorProjectSnapshot): string {
  const existing = new Set(snapshot.items.map((item) => item.id));
  let counter = 0;
  let candidate = "new-item";
  while (existing.has(candidate)) {
    counter += 1;
    candidate = `new-item-${counter}`;
  }
  return candidate;
}

function nextSceneId(snapshot: EditorProjectSnapshot): string {
  const existing = new Set(snapshot.scenes.map((scene) => scene.id));
  let counter = 0;
  let candidate = "new-scene";
  while (existing.has(candidate)) {
    counter += 1;
    candidate = `new-scene-${counter}`;
  }
  return candidate;
}

function createDefaultSceneDocument(snapshot: EditorProjectSnapshot, sceneId: string): Layered2DScene {
  const width = snapshot.manifest.viewport.width;
  const height = snapshot.manifest.viewport.height;
  const insetX = Math.max(40, Math.floor(width * 0.08));
  const insetTop = Math.max(80, Math.floor(height * 0.55));
  const insetBottom = Math.max(40, Math.floor(height * 0.06));

  return {
    actors: [],
    background: "#24384a",
    hotspots: [],
    id: sceneId,
    name: "New Scene",
    playerStart: {
      x: Math.floor(width / 2),
      y: Math.floor(height * 0.8)
    },
    pickups: [],
    schemaVersion: 1,
    shapes: [],
    size: { width, height },
    type: "layered-2d",
    walkArea: {
      points: [
        { x: insetX, y: insetTop },
        { x: width - insetX, y: insetTop },
        { x: width - insetX, y: height - insetBottom },
        { x: insetX, y: height - insetBottom }
      ]
    }
  };
}

function nextHotspotId(scene: Layered2DScene): string {
  const existing = new Set(scene.hotspots.map((hotspot) => hotspot.id));
  let counter = 0;
  let candidate = "new-hotspot";
  while (existing.has(candidate)) {
    counter += 1;
    candidate = `new-hotspot-${counter}`;
  }
  return candidate;
}

function nextPickupId(scene: Layered2DScene): string {
  const existing = new Set(scene.pickups.map((pickup) => pickup.id));
  let counter = 0;
  let candidate = "new-pickup";
  while (existing.has(candidate)) {
    counter += 1;
    candidate = `new-pickup-${counter}`;
  }
  return candidate;
}

function createDefaultHotspot(scene: Layered2DScene, hotspotId: string): Hotspot {
  const width = Math.max(80, Math.floor(scene.size.width * 0.12));
  const height = Math.max(80, Math.floor(scene.size.height * 0.14));
  return {
    actions: {
      useItemFlows: []
    },
    bounds: {
      x: Math.floor(scene.size.width / 2 - width / 2),
      y: Math.floor(scene.size.height * 0.45 - height / 2),
      width,
      height
    },
    cursor: "look",
    id: hotspotId,
    labelKey: `hotspot.${hotspotId}`
  };
}

function createDefaultPickup(scene: Layered2DScene, pickupId: string, itemId: string): ScenePickup {
  const width = Math.max(48, Math.floor(scene.size.width * 0.06));
  const height = Math.max(40, Math.floor(scene.size.height * 0.06));
  return {
    bounds: {
      x: Math.floor(scene.size.width / 2 - width / 2),
      y: Math.floor(scene.size.height * 0.78 - height / 2),
      width,
      height
    },
    id: pickupId,
    itemId,
    labelKey: `pickup.${pickupId}`
  };
}

function validationSummaryLabel(report: EditorValidationReport | null): string {
  if (!report) return "No validation run yet";
  if (report.summary.errorCount > 0) {
    return `${report.summary.errorCount} error(s), ${report.summary.warningCount} warning(s)`;
  }
  if (report.summary.warningCount > 0) {
    return `${report.summary.warningCount} warning(s), review recommended`;
  }
  return "Validation passed";
}

function buildGuardrail(
  blockingIssues: string[],
  warningIssues: string[],
  readySummary: string,
  readyDetail: string
) {
  return {
    badge: blockingIssues.length > 0 ? "blocking" : warningIssues.length > 0 ? "review" : "ready",
    blockingIssues,
    detail: [...blockingIssues, ...warningIssues][0] ?? readyDetail,
    summary:
      blockingIssues.length > 0
        ? `${blockingIssues.length} blocking issue(s)`
        : warningIssues.length > 0
          ? `${warningIssues.length} warning(s)`
          : readySummary,
    tone:
      blockingIssues.length > 0
        ? ("error" as const)
        : warningIssues.length > 0
          ? ("warn" as const)
          : ("good" as const),
    warningIssues
  };
}

function summarizeHotspotViewportIssues(
  hotspot: Hotspot,
  availableFlowIdsSet: Set<string>,
  availableItemIdsSet: Set<string>,
  defaultLocaleId: string,
  defaultLocaleStrings: LocaleDocument["strings"] | null
) {
  const blockingIssues: string[] = [];
  const warningIssues: string[] = [];
  const labelKey = hotspot.labelKey.trim();

  if (!labelKey) {
    blockingIssues.push("Display label is required.");
  } else if (!defaultLocaleStrings) {
    warningIssues.push(`Default locale "${defaultLocaleId}" is unavailable.`);
  } else if (!(labelKey in defaultLocaleStrings)) {
    warningIssues.push(`Label key "${labelKey}" is missing in ${defaultLocaleId}.`);
  }

  for (const [verb, flowId] of [
    ["Look", hotspot.actions.lookFlowId?.trim() ?? ""],
    ["Talk", hotspot.actions.talkFlowId?.trim() ?? ""],
    ["Use", hotspot.actions.useFlowId?.trim() ?? ""]
  ] as const) {
    if (flowId && !availableFlowIdsSet.has(flowId)) {
      blockingIssues.push(`${verb} flow "${flowId}" no longer exists.`);
    }
  }

  hotspot.actions.useItemFlows.forEach((entry, index) => {
    const itemId = entry.itemId.trim();
    const flowId = entry.flowId.trim();
    if (!itemId || !flowId) {
      blockingIssues.push(`Override ${index + 1} must include both an item and a flow.`);
      return;
    }
    if (!availableItemIdsSet.has(itemId)) {
      blockingIssues.push(`Override ${index + 1} item "${itemId}" no longer exists.`);
    }
    if (!availableFlowIdsSet.has(flowId)) {
      blockingIssues.push(`Override ${index + 1} flow "${flowId}" no longer exists.`);
    }
  });

  return {
    detail: [...blockingIssues, ...warningIssues][0] ?? "Ready to save.",
    hasIssues: blockingIssues.length > 0 || warningIssues.length > 0,
    issueCount: blockingIssues.length + warningIssues.length,
    tone:
      blockingIssues.length > 0
        ? ("error" as const)
        : warningIssues.length > 0
          ? ("warn" as const)
          : ("good" as const)
  };
}

function summarizePickupViewportIssues(
  pickup: ScenePickup,
  availableFlowIdsSet: Set<string>,
  availableItemIdsSet: Set<string>,
  defaultLocaleId: string,
  defaultLocaleStrings: LocaleDocument["strings"] | null
) {
  const blockingIssues: string[] = [];
  const warningIssues: string[] = [];
  const itemId = pickup.itemId.trim();
  const labelKey = pickup.labelKey.trim();
  const pickupFlowId = pickup.pickupFlowId?.trim() ?? "";

  if (!itemId) {
    blockingIssues.push("Pickup item is required.");
  } else if (!availableItemIdsSet.has(itemId)) {
    blockingIssues.push(`Pickup item "${itemId}" no longer exists.`);
  }

  if (pickupFlowId && !availableFlowIdsSet.has(pickupFlowId)) {
    blockingIssues.push(`Pickup flow "${pickupFlowId}" no longer exists.`);
  }

  if (!labelKey) {
    blockingIssues.push("Pickup label key is required.");
  } else if (!defaultLocaleStrings) {
    warningIssues.push(`Default locale "${defaultLocaleId}" is unavailable.`);
  } else if (!(labelKey in defaultLocaleStrings)) {
    warningIssues.push(`Label key "${labelKey}" is missing in ${defaultLocaleId}.`);
  }

  return {
    detail: [...blockingIssues, ...warningIssues][0] ?? "Ready to save.",
    hasIssues: blockingIssues.length > 0 || warningIssues.length > 0,
    issueCount: blockingIssues.length + warningIssues.length,
    tone:
      blockingIssues.length > 0
        ? ("error" as const)
        : warningIssues.length > 0
          ? ("warn" as const)
          : ("good" as const)
  };
}

type ViewportInteraction =
  | {
      baseSession: EditorSessionState;
      kind: "hotspot" | "pickup";
      mode: "move" | "resize";
      startPoint: ScenePointDraftValue;
      startRect: SceneRectDraftValue;
    }
  | {
      baseSession: EditorSessionState;
      kind: "player-start";
      startPoint: ScenePointDraftValue;
      startPosition: ScenePointDraftValue;
    }
  | {
      baseSession: EditorSessionState;
      kind: "walk-area-point";
      pointIndex: number;
      startPoint: ScenePointDraftValue;
      startPosition: ScenePointDraftValue;
    };

type SceneTool = "select" | "hotspot" | "pickup" | "player-start" | "walk-area";

function sceneToolFromCapability(capabilityId: string): SceneTool | null {
  switch (capabilityId) {
    case "tool-select":
      return "select";
    case "tool-hotspot":
      return "hotspot";
    case "tool-pickup":
      return "pickup";
    case "tool-player-start":
      return "player-start";
    case "tool-walk-area":
      return "walk-area";
    default:
      return null;
  }
}

function sceneToolLabel(tool: SceneTool): string {
  switch (tool) {
    case "select":
      return "Select";
    case "hotspot":
      return "Hotspot";
    case "pickup":
      return "Pickup";
    case "player-start":
      return "Player Start";
    case "walk-area":
      return "Walk Area";
  }
}

function sceneToolHint(tool: SceneTool): string {
  switch (tool) {
    case "select":
      return "Click hotspots and pickups to inspect them without moving the scene.";
    case "hotspot":
      return "Drag the selected hotspot to move it, or use the lower-right handle to resize it.";
    case "pickup":
      return "Drag the selected pickup to move it, or use the lower-right handle to resize it.";
    case "player-start":
      return "Drag the character marker to choose the player start position.";
    case "walk-area":
      return "Drag walk points to reshape the polygon, or click an edge to insert a new point.";
  }
}

function focusEditorField(element: HTMLInputElement | HTMLSelectElement | null) {
  if (!element) return;
  element.focus();
  element.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function EditorApp() {
  const [workspace, setWorkspace] = useState<Workspace>("overview");
  const [status, setStatus] = useState("Loading project...");
  const [project, setProject] = useState<EditorProjectSnapshot | null>(null);
  const [history, setHistory] = useState<EditorHistoryState>(emptyHistory);
  const [pendingRecovery, setPendingRecovery] = useState<EditorRecoverySnapshot | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [assetPathDraft, setAssetPathDraft] = useState("");
  const [validationRunState, setValidationRunState] = useState<EditorValidationRunState>("idle");
  const [validationReport, setValidationReport] = useState<EditorValidationReport | null>(null);
  const [validationStatus, setValidationStatus] = useState("Validation uses saved project files.");
  const [viewportInteraction, setViewportInteraction] = useState<ViewportInteraction | null>(null);
  const [activeSceneTool, setActiveSceneTool] = useState<SceneTool>("select");
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const hotspotLabelInputRef = useRef<HTMLInputElement | null>(null);
  const hotspotLookFlowRef = useRef<HTMLSelectElement | null>(null);
  const hotspotTalkFlowRef = useRef<HTMLSelectElement | null>(null);
  const hotspotUseFlowRef = useRef<HTMLSelectElement | null>(null);
  const hotspotOverrideItemRefs = useRef<Array<HTMLSelectElement | null>>([]);
  const hotspotOverrideFlowRefs = useRef<Array<HTMLSelectElement | null>>([]);
  const pickupItemRef = useRef<HTMLSelectElement | null>(null);
  const pickupLabelRef = useRef<HTMLInputElement | null>(null);
  const pickupFlowRef = useRef<HTMLSelectElement | null>(null);

  const session = history.present;
  const scenes = project ? sceneItems(project.scenes) : [];
  const selectedScene =
    sceneFromSnapshot(project, session.activeSceneId) ?? project?.selectedScene ?? scenes[0] ?? null;
  const selectedHotspot =
    hotspotFromSnapshot(project, session.activeSceneId, session.activeHotspotId) ?? null;
  const selectedLocale = localeFromSnapshot(project, session.activeLocale) ?? null;
  const selectedFlow = flowFromSnapshot(project, session.activeFlowId) ?? null;
  const selectedItem = itemFromSnapshot(project, session.activeItemId) ?? project?.selectedItem ?? null;
  const selectedPickup =
    pickupFromSnapshot(project, session.activeSceneId, session.activePickupId) ?? null;
  const selectedAsset =
    assetFromSnapshot(project, selectedAssetId) ?? project?.selectedAsset ?? project?.assets[0] ?? null;

  const currentSceneDraft = selectedScene
    ? session.sceneDrafts[selectedScene.id] ?? createSceneDraft(selectedScene)
    : createSceneDraft(null);
  const currentHotspotDraft = selectedHotspot
    ? session.hotspotDrafts[createHotspotKey(selectedScene?.id ?? "", selectedHotspot.id)] ??
      createHotspotDraft(selectedHotspot)
    : createHotspotDraft(null);
  const currentLocaleDraft = selectedLocale
    ? session.localeDrafts[selectedLocale.locale] ?? selectedLocale.strings
    : {};
  const currentLocaleEntryDraft = selectedLocale
    ? session.localeEntryDrafts[selectedLocale.locale] ?? emptyLocaleEntry
    : emptyLocaleEntry;
  const currentFlowDraft = selectedFlow
    ? session.flowDrafts[selectedFlow.id] ?? createFlowDraft(selectedFlow)
    : null;
  const currentItemDraft = selectedItem
    ? session.itemDrafts[selectedItem.id] ?? createItemDraft(selectedItem)
    : createItemDraft(null);
  const currentPickupDraft =
    selectedScene && selectedPickup
      ? session.pickupDrafts[createPickupKey(selectedScene.id, selectedPickup.id)] ??
        createPickupDraft(selectedPickup)
      : createPickupDraft(null);

  const localeEntries = useMemo(
    () => Object.entries(currentLocaleDraft).sort(([left], [right]) => left.localeCompare(right)),
    [currentLocaleDraft]
  );
  const flowNodeIds = useMemo(
    () => (currentFlowDraft ? currentFlowDraft.nodes.map((node) => node.id) : []),
    [currentFlowDraft]
  );
  const availableFlowIds = useMemo(
    () => (project ? project.flows.map((flow) => flow.id) : []),
    [project]
  );
  const availableItemIds = useMemo(
    () => (project ? project.items.map((item) => item.id) : []),
    [project]
  );
  const dirtyState = useMemo(
    () =>
      project
        ? getDirtyState(project, session)
        : {
            count: 0,
            flowIds: new Set<string>(),
            hotspotKeys: new Set<string>(),
            itemIds: new Set<string>(),
            localeIds: new Set<string>(),
            pickupKeys: new Set<string>(),
            sceneIds: new Set<string>()
          },
    [project, session]
  );
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const sceneLabel = selectedScene
    ? `${selectedScene.size.width} x ${selectedScene.size.height}`
    : "No scene";
  const localeLabel = project?.manifest.defaultLocale ?? "n/a";
  const draftWalkArea = parseWalkAreaDraft(currentSceneDraft.walkAreaPoints);
  const previewWalkArea = draftWalkArea ?? selectedScene?.walkArea ?? null;
  const previewWalkAreaPoints = previewWalkArea
    ? previewWalkArea.points.map((point) => `${point.x},${point.y}`).join(" ")
    : "";
  const previewPlayerStart = useMemo(() => {
    if (!selectedScene) return null;
    const x = parseNumber(currentSceneDraft.playerStartX);
    const y = parseNumber(currentSceneDraft.playerStartY);
    if (x === null || y === null) {
      return selectedScene.playerStart;
    }
    return clampScenePoint({ x, y }, selectedScene.size);
  }, [currentSceneDraft.playerStartX, currentSceneDraft.playerStartY, selectedScene]);
  const previewHotspots = useMemo(() => {
    if (!selectedScene || !selectedHotspot) {
      return selectedScene?.hotspots ?? [];
    }

    const x = parseNumber(currentHotspotDraft.x);
    const y = parseNumber(currentHotspotDraft.y);
    const width = parsePositiveNumber(currentHotspotDraft.width);
    const height = parsePositiveNumber(currentHotspotDraft.height);
    if (x === null || y === null || width === null || height === null) {
      return selectedScene.hotspots;
    }

    const bounds = moveSceneRect(
      { x, y, width, height },
      { x: 0, y: 0 },
      selectedScene.size
    );

    return selectedScene.hotspots.map((hotspot) =>
      hotspot.id === selectedHotspot.id
        ? (() => {
            const cursor = currentHotspotDraft.cursor.trim();
            return {
              ...hotspot,
              ...(cursor ? { cursor: cursor as CursorValue } : {}),
              bounds,
              labelKey: currentHotspotDraft.labelKey
            };
          })()
        : hotspot
    );
  }, [currentHotspotDraft, selectedHotspot, selectedScene]);
  const previewPickups = useMemo(() => {
    if (!selectedScene || !selectedPickup) {
      return selectedScene?.pickups ?? [];
    }

    const x = parseNumber(currentPickupDraft.x);
    const y = parseNumber(currentPickupDraft.y);
    const width = parsePositiveNumber(currentPickupDraft.width);
    const height = parsePositiveNumber(currentPickupDraft.height);
    if (x === null || y === null || width === null || height === null) {
      return selectedScene.pickups;
    }

    const bounds = moveSceneRect(
      { x, y, width, height },
      { x: 0, y: 0 },
      selectedScene.size
    );

    return selectedScene.pickups.map((pickup) =>
      pickup.id === selectedPickup.id
        ? {
            ...pickup,
            ...(currentPickupDraft.pickupFlowId
              ? { pickupFlowId: currentPickupDraft.pickupFlowId }
              : {}),
            bounds,
            itemId: currentPickupDraft.itemId,
            labelKey: currentPickupDraft.labelKey
          }
        : pickup
    );
  }, [currentPickupDraft, selectedPickup, selectedScene]);
  const workspaceCapability = workspaceCapabilities.find((item) => item.workspace === workspace) ?? workspaceCapabilities[0]!;
  const previewRequest = project
    ? {
        bundle: buildDraftProjectBundle(project, history.present),
        sceneId: selectedScene?.id ?? project.activeSceneId
      }
    : undefined;
  const projectHealth = project ? healthSummary(project.diagnostics, dirtyState.count) : null;
  const currentValidationReport =
    validationReport ??
    (project ? createValidationReport(project.directory, project.diagnostics, "") : null);
  const previewReadinessLabel =
    currentValidationReport?.summary.errorCount
      ? "Preview blocked for saved project content"
      : currentValidationReport?.summary.warningCount
        ? "Preview available, but saved project needs review"
        : dirtyState.count > 0
          ? "Preview can include unsaved drafts"
          : "Preview aligned with saved project";
  const selectedAssetUsage = selectedAsset ? assetUsage(selectedAsset, project) : [];
  const selectedAssetHealth = selectedAsset ? assetHealth(selectedAsset, project) : "available";
  const canEditViewportScene = workspace === "scene" && !!selectedScene;
  const selectedSceneToolLabel = sceneToolLabel(activeSceneTool);
  const selectedSceneToolHint = sceneToolHint(activeSceneTool);
  const defaultLocaleDocument = useMemo(
    () =>
      project?.locales.find((locale) => locale.locale === project.manifest.defaultLocale) ?? null,
    [project]
  );
  const defaultLocaleId = defaultLocaleDocument?.locale ?? project?.manifest.defaultLocale ?? "default locale";
  const defaultLocaleStrings = defaultLocaleDocument?.strings ?? null;
  const availableFlowIdsSet = useMemo(() => new Set(availableFlowIds), [availableFlowIds]);
  const availableItemIdsSet = useMemo(() => new Set(availableItemIds), [availableItemIds]);
  const previewHotspotIssueMap = useMemo(
    () =>
      Object.fromEntries(
        previewHotspots.map((hotspot) => [
          hotspot.id,
          summarizeHotspotViewportIssues(
            hotspot,
            availableFlowIdsSet,
            availableItemIdsSet,
            defaultLocaleId,
            defaultLocaleStrings
          )
        ])
      ),
    [availableFlowIdsSet, availableItemIdsSet, defaultLocaleId, defaultLocaleStrings, previewHotspots]
  );
  const previewPickupIssueMap = useMemo(
    () =>
      Object.fromEntries(
        previewPickups.map((pickup) => [
          pickup.id,
          summarizePickupViewportIssues(
            pickup,
            availableFlowIdsSet,
            availableItemIdsSet,
            defaultLocaleId,
            defaultLocaleStrings
          )
        ])
      ),
    [availableFlowIdsSet, availableItemIdsSet, defaultLocaleId, defaultLocaleStrings, previewPickups]
  );
  const flowGuardrail = useMemo(() => {
    if (!currentFlowDraft) {
      return buildGuardrail([], [], "No flow selected", "Select a flow to inspect locale coverage.");
    }

    const warningIssues: string[] = [];
    if (!defaultLocaleStrings) {
      warningIssues.push(`Default locale "${defaultLocaleId}" is unavailable.`);
    } else {
      for (const node of currentFlowDraft.nodes) {
        if (node.type !== "line") continue;
        const textKey = node.textKey.trim();
        if (textKey && !(textKey in defaultLocaleStrings)) {
          warningIssues.push(`Node "${node.id}" text key "${textKey}" is missing in ${defaultLocaleId}.`);
        }
      }
    }

    return buildGuardrail(
      [],
      warningIssues,
      "Locale coverage looks good",
      `All line text keys exist in ${defaultLocaleId}.`
    );
  }, [currentFlowDraft, defaultLocaleId, defaultLocaleStrings]);
  const hotspotGuardrail = useMemo(() => {
    const blockingIssues: string[] = [];
    const warningIssues: string[] = [];
    const labelKey = currentHotspotDraft.labelKey.trim();

    if (!labelKey) {
      blockingIssues.push("Display label is required.");
    } else if (!defaultLocaleStrings) {
      warningIssues.push(`Default locale "${defaultLocaleId}" is unavailable.`);
    } else if (!(labelKey in defaultLocaleStrings)) {
      warningIssues.push(`Label key "${labelKey}" is missing in ${defaultLocaleId}.`);
    }

    for (const [verb, flowId] of [
      ["Look", currentHotspotDraft.lookFlowId.trim()],
      ["Talk", currentHotspotDraft.talkFlowId.trim()],
      ["Use", currentHotspotDraft.useFlowId.trim()]
    ] as const) {
      if (flowId && !availableFlowIdsSet.has(flowId)) {
        blockingIssues.push(`${verb} flow "${flowId}" no longer exists.`);
      }
    }

    currentHotspotDraft.useItemFlows.forEach((entry, index) => {
      const itemId = entry.itemId.trim();
      const flowId = entry.flowId.trim();
      if (!itemId && !flowId) {
        return;
      }
      if (!itemId || !flowId) {
        blockingIssues.push(`Override ${index + 1} must include both an item and a flow.`);
        return;
      }
      if (!availableItemIdsSet.has(itemId)) {
        blockingIssues.push(`Override ${index + 1} item "${itemId}" no longer exists.`);
      }
      if (!availableFlowIdsSet.has(flowId)) {
        blockingIssues.push(`Override ${index + 1} flow "${flowId}" no longer exists.`);
      }
    });

    return buildGuardrail(
      blockingIssues,
      warningIssues,
      "Reference guardrails look good",
      "Hotspot label and action references are ready to save."
    );
  }, [
    availableFlowIdsSet,
    availableItemIdsSet,
    currentHotspotDraft.labelKey,
    currentHotspotDraft.lookFlowId,
    currentHotspotDraft.talkFlowId,
    currentHotspotDraft.useFlowId,
    currentHotspotDraft.useItemFlows,
    defaultLocaleId,
    defaultLocaleStrings
  ]);
  const pickupGuardrail = useMemo(() => {
    const blockingIssues: string[] = [];
    const warningIssues: string[] = [];
    const itemId = currentPickupDraft.itemId.trim();
    const labelKey = currentPickupDraft.labelKey.trim();
    const pickupFlowId = currentPickupDraft.pickupFlowId.trim();

    if (!itemId) {
      blockingIssues.push("Pickup item is required.");
    } else if (!availableItemIdsSet.has(itemId)) {
      blockingIssues.push(`Pickup item "${itemId}" no longer exists.`);
    }

    if (pickupFlowId && !availableFlowIdsSet.has(pickupFlowId)) {
      blockingIssues.push(`Pickup flow "${pickupFlowId}" no longer exists.`);
    }

    if (!labelKey) {
      blockingIssues.push("Pickup label key is required.");
    } else if (!defaultLocaleStrings) {
      warningIssues.push(`Default locale "${defaultLocaleId}" is unavailable.`);
    } else if (!(labelKey in defaultLocaleStrings)) {
      warningIssues.push(`Label key "${labelKey}" is missing in ${defaultLocaleId}.`);
    }

    return buildGuardrail(
      blockingIssues,
      warningIssues,
      "Pickup bindings look good",
      "Pickup item, flow, and locale references are ready to save."
    );
  }, [
    availableFlowIdsSet,
    availableItemIdsSet,
    currentPickupDraft.itemId,
    currentPickupDraft.labelKey,
    currentPickupDraft.pickupFlowId,
    defaultLocaleId,
    defaultLocaleStrings
  ]);
  const itemGuardrail = useMemo(() => {
    const blockingIssues: string[] = [];
    const warningIssues: string[] = [];
    const labelKey = currentItemDraft.labelKey.trim();

    if (!labelKey) {
      blockingIssues.push("Item label key is required.");
    } else if (!defaultLocaleStrings) {
      warningIssues.push(`Default locale "${defaultLocaleId}" is unavailable.`);
    } else if (!(labelKey in defaultLocaleStrings)) {
      warningIssues.push(`Label key "${labelKey}" is missing in ${defaultLocaleId}.`);
    }

    return buildGuardrail(
      blockingIssues,
      warningIssues,
      "Item locale coverage looks good",
      "The item label key exists in the default locale."
    );
  }, [currentItemDraft.labelKey, defaultLocaleId, defaultLocaleStrings]);
  const hotspotLabelMissing =
    currentHotspotDraft.labelKey.trim().length === 0 ||
    (!!defaultLocaleStrings && !(currentHotspotDraft.labelKey.trim() in defaultLocaleStrings));
  const hotspotLookFlowMissing =
    !!currentHotspotDraft.lookFlowId.trim() && !availableFlowIdsSet.has(currentHotspotDraft.lookFlowId.trim());
  const hotspotTalkFlowMissing =
    !!currentHotspotDraft.talkFlowId.trim() && !availableFlowIdsSet.has(currentHotspotDraft.talkFlowId.trim());
  const hotspotUseFlowMissing =
    !!currentHotspotDraft.useFlowId.trim() && !availableFlowIdsSet.has(currentHotspotDraft.useFlowId.trim());
  const hotspotOverrideIssues = currentHotspotDraft.useItemFlows.map((entry) => {
    const itemId = entry.itemId.trim();
    const flowId = entry.flowId.trim();
    return {
      missingFlow: !!flowId && !availableFlowIdsSet.has(flowId),
      missingItem: !!itemId && !availableItemIdsSet.has(itemId),
      incomplete: (!itemId && !!flowId) || (!!itemId && !flowId)
    };
  });
  const pickupItemMissing =
    currentPickupDraft.itemId.trim().length === 0 ||
    !availableItemIdsSet.has(currentPickupDraft.itemId.trim());
  const pickupLabelMissing =
    currentPickupDraft.labelKey.trim().length === 0 ||
    (!!defaultLocaleStrings && !(currentPickupDraft.labelKey.trim() in defaultLocaleStrings));
  const pickupFlowMissing =
    !!currentPickupDraft.pickupFlowId.trim() && !availableFlowIdsSet.has(currentPickupDraft.pickupFlowId.trim());
  const firstHotspotOverrideIssueIndex = hotspotOverrideIssues.findIndex(
    (issue) => issue.incomplete || issue.missingItem || issue.missingFlow
  );
  const firstHotspotOverrideIssue =
    firstHotspotOverrideIssueIndex >= 0 ? hotspotOverrideIssues[firstHotspotOverrideIssueIndex] : null;
  const firstHotspotIssueTarget = hotspotLabelMissing
    ? { kind: "label" as const }
    : hotspotLookFlowMissing
      ? { kind: "look-flow" as const }
      : hotspotTalkFlowMissing
        ? { kind: "talk-flow" as const }
        : hotspotUseFlowMissing
          ? { kind: "use-flow" as const }
          : firstHotspotOverrideIssue
            ? {
                kind: firstHotspotOverrideIssue.missingItem || firstHotspotOverrideIssue.incomplete
                  ? ("override-item" as const)
                  : ("override-flow" as const),
                index: firstHotspotOverrideIssueIndex
              }
            : null;
  const firstPickupIssueTarget = pickupItemMissing
    ? { kind: "item" as const }
    : pickupLabelMissing
      ? { kind: "label" as const }
      : pickupFlowMissing
        ? { kind: "flow" as const }
        : null;

  const focusFirstHotspotIssue = () => {
    if (!firstHotspotIssueTarget) return;

    switch (firstHotspotIssueTarget.kind) {
      case "label":
        focusEditorField(hotspotLabelInputRef.current);
        return;
      case "look-flow":
        focusEditorField(hotspotLookFlowRef.current);
        return;
      case "talk-flow":
        focusEditorField(hotspotTalkFlowRef.current);
        return;
      case "use-flow":
        focusEditorField(hotspotUseFlowRef.current);
        return;
      case "override-item":
        focusEditorField(hotspotOverrideItemRefs.current[firstHotspotIssueTarget.index] ?? null);
        return;
      case "override-flow":
        focusEditorField(hotspotOverrideFlowRefs.current[firstHotspotIssueTarget.index] ?? null);
        return;
    }
  };

  const focusFirstPickupIssue = () => {
    if (!firstPickupIssueTarget) return;

    switch (firstPickupIssueTarget.kind) {
      case "item":
        focusEditorField(pickupItemRef.current);
        return;
      case "label":
        focusEditorField(pickupLabelRef.current);
        return;
      case "flow":
        focusEditorField(pickupFlowRef.current);
        return;
    }
  };

  const replaceSession = (recipe: (current: EditorHistoryState) => EditorHistoryState) => {
    setHistory((current) => recipe(current));
  };

  const updateSessionSelection = (
    recipe: (current: EditorHistoryState["present"]) => EditorHistoryState["present"]
  ) => {
    setHistory((current) => ({
      ...current,
      present: recipe(current.present)
    }));
  };

  const updateDraftWithHistory = (
    recipe: (current: EditorHistoryState["present"]) => EditorHistoryState["present"]
  ) => {
    setHistory((current) => commitHistory(current, recipe(current.present)));
  };

  const updatePresentWithoutHistory = (
    recipe: (current: EditorHistoryState["present"]) => EditorHistoryState["present"]
  ) => {
    setHistory((current) => ({
      ...current,
      present: recipe(current.present)
    }));
  };

  const scenePointFromClient = (clientX: number, clientY: number): ScenePointDraftValue | null => {
    if (!selectedScene || !viewportRef.current) return null;

    const rect = viewportRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    return clampScenePoint(
      {
        x: ((clientX - rect.left) / rect.width) * selectedScene.size.width,
        y: ((clientY - rect.top) / rect.height) * selectedScene.size.height
      },
      selectedScene.size
    );
  };

  const setHotspotDraftBoundsFromRect = (bounds: Rect) => {
    if (!selectedScene || !selectedHotspot) return;
    const key = createHotspotKey(selectedScene.id, selectedHotspot.id);

    updatePresentWithoutHistory((current) => ({
      ...current,
      hotspotDrafts: {
        ...current.hotspotDrafts,
        [key]: {
          ...(current.hotspotDrafts[key] ?? createHotspotDraft(selectedHotspot)),
          height: String(bounds.height),
          width: String(bounds.width),
          x: String(bounds.x),
          y: String(bounds.y)
        }
      }
    }));
  };

  const setPickupDraftBoundsFromRect = (bounds: Rect) => {
    if (!selectedScene || !selectedPickup) return;
    const key = createPickupKey(selectedScene.id, selectedPickup.id);

    updatePresentWithoutHistory((current) => ({
      ...current,
      pickupDrafts: {
        ...current.pickupDrafts,
        [key]: {
          ...(current.pickupDrafts[key] ?? createPickupDraft(selectedPickup)),
          height: String(bounds.height),
          width: String(bounds.width),
          x: String(bounds.x),
          y: String(bounds.y)
        }
      }
    }));
  };

  const setSceneDraftPlayerStart = (point: ScenePointDraftValue) => {
    if (!selectedScene) return;

    updatePresentWithoutHistory((current) => ({
      ...current,
      sceneDrafts: {
        ...current.sceneDrafts,
        [selectedScene.id]: {
          ...(current.sceneDrafts[selectedScene.id] ?? createSceneDraft(selectedScene)),
          playerStartX: String(point.x),
          playerStartY: String(point.y)
        }
      }
    }));
  };

  const setWalkAreaPointDraft = (index: number, point: ScenePointDraftValue) => {
    if (!selectedScene) return;

    updatePresentWithoutHistory((current) => {
      const sceneDraft = current.sceneDrafts[selectedScene.id] ?? createSceneDraft(selectedScene);
      const walkAreaPoints = sceneDraft.walkAreaPoints.map((currentPoint, pointIndex) =>
        pointIndex === index
          ? { x: String(point.x), y: String(point.y) }
          : currentPoint
      );

      return {
        ...current,
        sceneDrafts: {
          ...current.sceneDrafts,
          [selectedScene.id]: {
            ...sceneDraft,
            walkAreaPoints
          }
        }
      };
    });
  };

  const insertWalkAreaPointAfter = (afterIndex: number, point: ScenePointDraftValue) => {
    if (!selectedScene) return;

    updateDraftWithHistory((current) => {
      const sceneDraft = current.sceneDrafts[selectedScene.id] ?? createSceneDraft(selectedScene);
      const walkAreaPoints = insertDraftPointAfter(sceneDraft.walkAreaPoints, afterIndex, {
        x: String(point.x),
        y: String(point.y)
      });

      return {
        ...current,
        sceneDrafts: {
          ...current.sceneDrafts,
          [selectedScene.id]: {
            ...sceneDraft,
            walkAreaPoints
          }
        }
      };
    });
  };

  const startHotspotInteraction = (
    mode: "move" | "resize",
    hotspot: Hotspot,
    event: ReactPointerEvent
  ) => {
    if (
      !selectedScene ||
      !canEditViewportScene ||
      activeSceneTool !== "hotspot" ||
      selectedHotspot?.id !== hotspot.id
    )
      return;

    const startPoint = scenePointFromClient(event.clientX, event.clientY);
    if (!startPoint) return;

    event.preventDefault();
    event.stopPropagation();
    setViewportInteraction({
      baseSession: cloneSessionState(history.present),
      kind: "hotspot",
      mode,
      startPoint,
      startRect: {
        height: hotspot.bounds.height,
        width: hotspot.bounds.width,
        x: hotspot.bounds.x,
        y: hotspot.bounds.y
      }
    });
  };

  const startPickupInteraction = (
    mode: "move" | "resize",
    pickup: ScenePickup,
    event: ReactPointerEvent
  ) => {
    if (
      !selectedScene ||
      !canEditViewportScene ||
      activeSceneTool !== "pickup" ||
      selectedPickup?.id !== pickup.id
    )
      return;

    const startPoint = scenePointFromClient(event.clientX, event.clientY);
    if (!startPoint) return;

    event.preventDefault();
    event.stopPropagation();
    setViewportInteraction({
      baseSession: cloneSessionState(history.present),
      kind: "pickup",
      mode,
      startPoint,
      startRect: {
        height: pickup.bounds.height,
        width: pickup.bounds.width,
        x: pickup.bounds.x,
        y: pickup.bounds.y
      }
    });
  };

  const startPlayerStartInteraction = (event: ReactPointerEvent) => {
    if (!selectedScene || !previewPlayerStart || !canEditViewportScene || activeSceneTool !== "player-start") return;

    const startPoint = scenePointFromClient(event.clientX, event.clientY);
    if (!startPoint) return;

    event.preventDefault();
    event.stopPropagation();
    setViewportInteraction({
      baseSession: cloneSessionState(history.present),
      kind: "player-start",
      startPoint,
      startPosition: previewPlayerStart
    });
  };

  const startWalkAreaPointInteraction = (
    pointIndex: number,
    point: ScenePointDraftValue,
    event: ReactPointerEvent
  ) => {
    if (!selectedScene || !canEditViewportScene || activeSceneTool !== "walk-area") return;

    if (event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      removeWalkAreaPoint(pointIndex);
      return;
    }

    const startPoint = scenePointFromClient(event.clientX, event.clientY);
    if (!startPoint) return;

    event.preventDefault();
    event.stopPropagation();
    setViewportInteraction({
      baseSession: cloneSessionState(history.present),
      kind: "walk-area-point",
      pointIndex,
      startPoint,
      startPosition: point
    });
  };

  const insertWalkAreaPointFromEvent = (afterIndex: number, event: ReactPointerEvent) => {
    if (!selectedScene || !canEditViewportScene || activeSceneTool !== "walk-area") return;

    const point = scenePointFromClient(event.clientX, event.clientY);
    if (!point) return;

    event.preventDefault();
    event.stopPropagation();
    insertWalkAreaPointAfter(afterIndex, point);
  };

  const loadRecoveryForProject = async (projectDirectory: string) => {
    try {
      return await window.pointClick.loadRecovery(projectDirectory);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Recovery snapshot could not be loaded");
      return null;
    }
  };

  const hydrateProject = async (snapshot: EditorProjectSnapshot) => {
    const baseHistory = createHistoryState(initializeEditorSession(snapshot));
    const recovery = await loadRecoveryForProject(snapshot.directory);

    startTransition(() => {
      setProject(snapshot);
      setHistory(baseHistory);
      setPendingRecovery(recovery);
      setSelectedAssetId(snapshot.selectedAsset?.id ?? snapshot.assets[0]?.id ?? null);
      setValidationRunState("idle");
      setValidationReport(null);
      setValidationStatus("Validation uses saved project files.");
    });

    if (recovery) {
      setStatus(`Loaded ${snapshot.manifest.title} - recovery available`);
    } else {
      setStatus(`Loaded ${snapshot.manifest.title}`);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function loadInitialProject() {
      try {
        const snapshot = await window.pointClick.loadProject();
        if (cancelled) return;
        await hydrateProject(snapshot);
      } catch (error) {
        if (cancelled) return;
        setStatus(error instanceof Error ? error.message : "Failed to load project");
      }
    }

    void loadInitialProject();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey) return;
      const wantsCommand = event.ctrlKey || event.metaKey;
      if (!wantsCommand) return;

      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        replaceSession((current) => undoHistory(current));
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        replaceSession((current) => redoHistory(current));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!project || pendingRecovery) return;

    const timeout = window.setTimeout(async () => {
      try {
        const snapshot = buildRecoverySnapshot(project.directory, project, history.present);
        if (snapshot) {
          await window.pointClick.saveRecovery(snapshot);
        } else {
          await window.pointClick.clearRecovery(project.directory);
        }
      } catch {
        // Recovery issues should not block normal editing.
      }
    }, 800);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [history.present, pendingRecovery, project]);

  useEffect(() => {
    setAssetPathDraft(selectedAsset?.path ?? "");
  }, [selectedAsset?.id, selectedAsset?.path]);

  useEffect(() => {
    if (!viewportInteraction || !selectedScene) return;

    const handlePointerMove = (event: PointerEvent) => {
      const point = scenePointFromClient(event.clientX, event.clientY);
      if (!point) return;

      const delta = {
        x: point.x - viewportInteraction.startPoint.x,
        y: point.y - viewportInteraction.startPoint.y
      };

      if (viewportInteraction.kind === "player-start") {
        setSceneDraftPlayerStart(
          moveScenePoint(viewportInteraction.startPosition, delta, selectedScene.size)
        );
        return;
      }

      if (viewportInteraction.kind === "walk-area-point") {
        setWalkAreaPointDraft(
          viewportInteraction.pointIndex,
          moveScenePoint(viewportInteraction.startPosition, delta, selectedScene.size)
        );
        return;
      }

      const nextRect =
        viewportInteraction.mode === "move"
          ? moveSceneRect(viewportInteraction.startRect, delta, selectedScene.size)
          : resizeSceneRectFromBottomRight(
              viewportInteraction.startRect,
              delta,
              selectedScene.size
            );

      if (viewportInteraction.kind === "hotspot") {
        setHotspotDraftBoundsFromRect(nextRect);
        return;
      }

      setPickupDraftBoundsFromRect(nextRect);
    };

    const finishInteraction = () => {
      setHistory((current) => {
        if (sessionEquals(viewportInteraction.baseSession, current.present)) {
          return current;
        }

        return commitHistory(
          {
            ...current,
            present: viewportInteraction.baseSession
          },
          current.present
        );
      });
      setViewportInteraction(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishInteraction);
    window.addEventListener("pointercancel", finishInteraction);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishInteraction);
      window.removeEventListener("pointercancel", finishInteraction);
    };
  }, [selectedScene, viewportInteraction]);

  const restoreRecovery = () => {
    if (!project || !pendingRecovery) return;
    startTransition(() => {
      setHistory(createHistoryState(restoreSessionFromRecovery(project, pendingRecovery)));
      setPendingRecovery(null);
    });
    setStatus("Restored unapplied drafts");
  };

  const discardRecovery = async () => {
    if (!project) return;
    await window.pointClick.clearRecovery(project.directory);
    setPendingRecovery(null);
    setStatus(`Loaded ${project.manifest.title}`);
  };

  const play = async () => {
    setStatus("Opening isolated preview...");
    await window.pointClick.openPreview(previewRequest);
    setStatus("Preview connected to the current project");
  };

  const openBrowser = async () => {
    await window.pointClick.openInBrowser(previewRequest);
    setStatus("Browser preview opened with the current project");
  };

  const openProject = async () => {
    setStatus("Waiting for a project folder...");
    const snapshot = await window.pointClick.pickProject();
    if (!snapshot) {
      setStatus(project ? `Loaded ${project.manifest.title}` : "Project selection cancelled");
      return;
    }
    await hydrateProject(snapshot);
  };

  const importAssets = async () => {
    setStatus("Importing assets...");
    try {
      const snapshot = await window.pointClick.importAssets();
      if (!snapshot) {
        setStatus(project ? `Loaded ${project.manifest.title}` : "Asset import cancelled");
        return;
      }
      setProject(snapshot);
      setSelectedAssetId(snapshot.selectedAsset?.id ?? snapshot.assets.at(-1)?.id ?? null);
      setWorkspace("assets");
      setStatus(`Imported asset library now contains ${snapshot.assetCount} asset(s)`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Assets could not be imported");
    }
  };

  const assignAssetBackground = async () => {
    if (!selectedScene || !selectedAsset) return;
    setStatus(`Assigning ${selectedAsset.id} to ${selectedScene.id}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "scene/update",
        patch: {
          background: selectedAsset.path,
          name: selectedScene.name,
          playerStart: selectedScene.playerStart,
          walkArea: selectedScene.walkArea
        },
        sceneId: selectedScene.id
      });
      setProject(snapshot);
      setStatus(`Assigned ${selectedAsset.id} as the background for ${selectedScene.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Asset background could not be assigned");
    }
  };

  const applyAssetRelink = async () => {
    if (!selectedAsset) return;

    const nextPath = assetPathDraft.trim();
    if (!nextPath) {
      setStatus("Asset path cannot be empty");
      return;
    }
    if (nextPath === selectedAsset.path) {
      setStatus(`Asset ${selectedAsset.id} is already linked to that path`);
      return;
    }

    setStatus(`Relinking ${selectedAsset.id}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "asset/relink",
        assetId: selectedAsset.id,
        patch: {
          path: nextPath
        }
      });
      setProject(snapshot);
      setStatus(`Relinked ${selectedAsset.id} to ${nextPath}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Asset relink could not be completed");
    }
  };

  const deleteSelectedAsset = async () => {
    if (!selectedAsset) return;

    setStatus(`Deleting ${selectedAsset.id}...`);
    try {
      const deletedAssetId = selectedAsset.id;
      const snapshot = await window.pointClick.applyCommand({
        type: "asset/delete",
        assetId: deletedAssetId
      });
      setProject(snapshot);
      setSelectedAssetId(snapshot.assets[0]?.id ?? null);
      setStatus(`Deleted ${deletedAssetId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Asset delete could not be completed");
    }
  };

  const runValidation = async () => {
    if (!project) return;
    setValidationRunState("running");
    setValidationStatus("Validating saved project files...");
    try {
      const report = await window.pointClick.runValidation();
      setValidationReport(report);
      setValidationRunState("completed");
      setValidationStatus(
        report.summary.errorCount > 0
          ? "Validation completed with blocking errors."
          : report.summary.warningCount > 0
            ? "Validation completed with warnings."
            : "Validation completed successfully."
      );
    } catch (error) {
      setValidationRunState("failed-to-run");
      setValidationStatus(error instanceof Error ? error.message : "Validation could not be completed");
    }
  };

  const createFlow = async () => {
    if (!project) return;

    const flowId = nextFlowId(project);
    setStatus(`Creating ${flowId}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "flow/create",
        flow: createDefaultFlowDocument(flowId)
      });
      setProject(snapshot);
      setWorkspace("narrative");
      updateSessionSelection((current) => ({
        ...current,
        activeFlowId: flowId,
        activeHotspotId: null,
        activeItemId: null,
        activeLocale: null,
        activePickupId: null
      }));
      setStatus(`Created ${flowId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create flow");
    }
  };

  const deleteSelectedFlow = async () => {
    if (!selectedFlow) return;

    const deletedFlowId = selectedFlow.id;
    setStatus(`Deleting ${deletedFlowId}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "flow/delete",
        flowId: deletedFlowId
      });
      const nextActiveFlowId = snapshot.flows[0]?.id ?? null;
      setProject(snapshot);
      setHistory((current) => ({
        ...current,
        present: discardSavedDraft(
          {
            ...current.present,
            activeFlowId: nextActiveFlowId,
            activeHotspotId: null,
            activeItemId: null,
            activeLocale: null,
            activePickupId: null
          },
          "flow",
          deletedFlowId
        )
      }));
      setWorkspace("narrative");
      setStatus(nextActiveFlowId ? `Deleted ${deletedFlowId}; selected ${nextActiveFlowId}` : `Deleted ${deletedFlowId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete flow");
    }
  };

  const createItem = async () => {
    if (!project) return;

    const itemId = nextItemId(project);
    setStatus(`Creating ${itemId}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "item/create",
        item: {
          id: itemId,
          labelKey: `item.${itemId}`,
          name: "New Item",
          schemaVersion: 1
        }
      });
      setProject(snapshot);
      setWorkspace("scene");
      updateSessionSelection((current) => ({
        ...current,
        activeFlowId: null,
        activeHotspotId: null,
        activeItemId: itemId,
        activeLocale: null,
        activePickupId: null
      }));
      setStatus(`Created ${itemId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create item");
    }
  };

  const deleteSelectedItem = async () => {
    if (!selectedItem) return;

    const deletedItemId = selectedItem.id;
    setStatus(`Deleting ${deletedItemId}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "item/delete",
        itemId: deletedItemId
      });
      const nextActiveItemId = snapshot.items[0]?.id ?? null;
      setProject(snapshot);
      setWorkspace("scene");
      setHistory((current) => ({
        ...current,
        present: discardSavedDraft(
          {
            ...current.present,
            activeFlowId: null,
            activeHotspotId: null,
            activeItemId: nextActiveItemId,
            activeLocale: null,
            activePickupId: null
          },
          "item",
          deletedItemId
        )
      }));
      setStatus(nextActiveItemId ? `Deleted ${deletedItemId}; selected ${nextActiveItemId}` : `Deleted ${deletedItemId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete item");
    }
  };

  const createScene = async () => {
    if (!project) return;

    const sceneId = nextSceneId(project);
    setStatus(`Creating ${sceneId}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "scene/create",
        scene: createDefaultSceneDocument(project, sceneId)
      });
      setProject(snapshot);
      setWorkspace("scene");
      updateSessionSelection((current) => ({
        ...current,
        activeFlowId: null,
        activeHotspotId: null,
        activeItemId: null,
        activeLocale: null,
        activePickupId: null,
        activeSceneId: sceneId
      }));
      setStatus(`Created ${sceneId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create scene");
    }
  };

  const deleteSelectedScene = async () => {
    if (!selectedScene || !project) return;

    const deletedSceneId = selectedScene.id;
    setStatus(`Deleting ${deletedSceneId}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "scene/delete",
        sceneId: deletedSceneId
      });
      const nextActiveSceneId = sceneItems(snapshot.scenes)[0]?.id ?? snapshot.manifest.initialSceneId;
      setProject(snapshot);
      setWorkspace("scene");
      setHistory((current) => {
        const nextPresent = discardSavedDraft(
          {
            ...current.present,
            activeFlowId: null,
            activeHotspotId: null,
            activeItemId: null,
            activeLocale: null,
            activePickupId: null,
            activeSceneId: nextActiveSceneId
          },
          "scene",
          deletedSceneId
        );

        for (const key of Object.keys(nextPresent.hotspotDrafts)) {
          if (key.startsWith(`${deletedSceneId}::`)) {
            delete nextPresent.hotspotDrafts[key];
          }
        }

        for (const key of Object.keys(nextPresent.pickupDrafts)) {
          if (key.startsWith(`${deletedSceneId}::`)) {
            delete nextPresent.pickupDrafts[key];
          }
        }

        return {
          ...current,
          present: nextPresent
        };
      });
      setStatus(
        nextActiveSceneId
          ? `Deleted ${deletedSceneId}; selected ${nextActiveSceneId}`
          : `Deleted ${deletedSceneId}`
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete scene");
    }
  };

  const createHotspot = async () => {
    if (!project || !selectedScene) return;

    const hotspotId = nextHotspotId(selectedScene);
    setStatus(`Creating ${hotspotId}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "hotspot/create",
        hotspot: createDefaultHotspot(selectedScene, hotspotId),
        sceneId: selectedScene.id
      });
      setProject(snapshot);
      setWorkspace("scene");
      updateSessionSelection((current) => ({
        ...current,
        activeFlowId: null,
        activeHotspotId: hotspotId,
        activeItemId: null,
        activeLocale: null,
        activePickupId: null
      }));
      setStatus(`Created ${hotspotId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create hotspot");
    }
  };

  const deleteSelectedHotspot = async () => {
    if (!selectedScene || !selectedHotspot) return;

    const deletedHotspotId = selectedHotspot.id;
    const draftKey = createHotspotKey(selectedScene.id, deletedHotspotId);
    setStatus(`Deleting ${deletedHotspotId}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "hotspot/delete",
        hotspotId: deletedHotspotId,
        sceneId: selectedScene.id
      });
      setProject(snapshot);
      setWorkspace("scene");
      setHistory((current) => ({
        ...current,
        present: discardSavedDraft(
          {
            ...current.present,
            activeFlowId: null,
            activeHotspotId: null,
            activeItemId: null,
            activeLocale: null,
            activePickupId: null
          },
          "hotspot",
          draftKey
        )
      }));
      setStatus(`Deleted ${deletedHotspotId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete hotspot");
    }
  };

  const createPickup = async () => {
    if (!project || !selectedScene) return;
    const defaultItemId = selectedItem?.id ?? project.items[0]?.id ?? null;
    if (!defaultItemId) {
      setStatus("Create an item before adding pickups");
      return;
    }

    const pickupId = nextPickupId(selectedScene);
    setStatus(`Creating ${pickupId}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "pickup/create",
        pickup: createDefaultPickup(selectedScene, pickupId, defaultItemId),
        sceneId: selectedScene.id
      });
      setProject(snapshot);
      setWorkspace("scene");
      updateSessionSelection((current) => ({
        ...current,
        activeFlowId: null,
        activeHotspotId: null,
        activeItemId: null,
        activeLocale: null,
        activePickupId: pickupId
      }));
      setStatus(`Created ${pickupId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create pickup");
    }
  };

  const deleteSelectedPickup = async () => {
    if (!selectedScene || !selectedPickup) return;

    const deletedPickupId = selectedPickup.id;
    const draftKey = createPickupKey(selectedScene.id, deletedPickupId);
    setStatus(`Deleting ${deletedPickupId}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "pickup/delete",
        pickupId: deletedPickupId,
        sceneId: selectedScene.id
      });
      setProject(snapshot);
      setWorkspace("scene");
      setHistory((current) => ({
        ...current,
        present: discardSavedDraft(
          {
            ...current.present,
            activeFlowId: null,
            activeHotspotId: null,
            activeItemId: null,
            activeLocale: null,
            activePickupId: null
          },
          "pickup",
          draftKey
        )
      }));
      setStatus(`Deleted ${deletedPickupId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete pickup");
    }
  };

  const selectScene = (sceneId: string) => {
    updateSessionSelection((current) => ({
      ...current,
      activeFlowId: null,
      activeHotspotId: null,
      activeItemId: null,
      activeLocale: null,
      activePickupId: null,
      activeSceneId: sceneId
    }));
  };

  const selectHotspot = (hotspot: Hotspot) => {
    updateSessionSelection((current) => ({
      ...current,
      activeFlowId: null,
      activeHotspotId: hotspot.id,
      activeItemId: null,
      activeLocale: null,
      activePickupId: null
    }));
  };

  const selectPickup = (pickup: ScenePickup) => {
    updateSessionSelection((current) => ({
      ...current,
      activeFlowId: null,
      activeHotspotId: null,
      activeItemId: null,
      activeLocale: null,
      activePickupId: pickup.id
    }));
  };

  const selectLocale = (locale: LocaleDocument) => {
    updateSessionSelection((current) => ({
      ...current,
      activeFlowId: null,
      activeHotspotId: null,
      activeItemId: null,
      activeLocale: locale.locale,
      activePickupId: null
    }));
  };

  const selectFlow = (flow: FlowDocument) => {
    updateSessionSelection((current) => ({
      ...current,
      activeFlowId: flow.id,
      activeHotspotId: null,
      activeItemId: null,
      activeLocale: null,
      activePickupId: null
    }));
  };

  const selectItem = (item: ItemDocument) => {
    updateSessionSelection((current) => ({
      ...current,
      activeFlowId: null,
      activeHotspotId: null,
      activeItemId: item.id,
      activeLocale: null,
      activePickupId: null
    }));
  };

  const updateHotspotDraft = <K extends keyof typeof currentHotspotDraft>(
    field: K,
    value: (typeof currentHotspotDraft)[K]
  ) => {
    if (!selectedScene || !selectedHotspot) return;
    const key = createHotspotKey(selectedScene.id, selectedHotspot.id);
    updateDraftWithHistory((current) => ({
      ...current,
      hotspotDrafts: {
        ...current.hotspotDrafts,
        [key]: {
          ...(current.hotspotDrafts[key] ?? createHotspotDraft(selectedHotspot)),
          [field]: value
        }
      }
    }));
  };

  const updateSceneDraft = (field: keyof typeof currentSceneDraft, value: string) => {
    if (!selectedScene) return;
    updateDraftWithHistory((current) => ({
      ...current,
      sceneDrafts: {
        ...current.sceneDrafts,
        [selectedScene.id]: {
          ...(current.sceneDrafts[selectedScene.id] ?? createSceneDraft(selectedScene)),
          [field]: value
        }
      }
    }));
  };

  const updatePickupDraft = <K extends keyof typeof currentPickupDraft>(
    field: K,
    value: (typeof currentPickupDraft)[K]
  ) => {
    if (!selectedScene || !selectedPickup) return;
    const key = createPickupKey(selectedScene.id, selectedPickup.id);
    updateDraftWithHistory((current) => ({
      ...current,
      pickupDrafts: {
        ...current.pickupDrafts,
        [key]: {
          ...(current.pickupDrafts[key] ?? createPickupDraft(selectedPickup)),
          [field]: value
        }
      }
    }));
  };

  const updateItemDraft = <K extends keyof typeof currentItemDraft>(
    field: K,
    value: (typeof currentItemDraft)[K]
  ) => {
    if (!selectedItem) return;
    updateDraftWithHistory((current) => ({
      ...current,
      itemDrafts: {
        ...current.itemDrafts,
        [selectedItem.id]: {
          ...(current.itemDrafts[selectedItem.id] ?? createItemDraft(selectedItem)),
          [field]: value
        }
      }
    }));
  };

  const updateWalkAreaPoint = (index: number, axis: "x" | "y", value: string) => {
    if (!selectedScene) return;
    updateDraftWithHistory((current) => {
      const sceneDraft = current.sceneDrafts[selectedScene.id] ?? createSceneDraft(selectedScene);
      const walkAreaPoints = sceneDraft.walkAreaPoints.map((point, pointIndex) =>
        pointIndex === index ? { ...point, [axis]: value } : point
      );
      return {
        ...current,
        sceneDrafts: {
          ...current.sceneDrafts,
          [selectedScene.id]: {
            ...sceneDraft,
            walkAreaPoints
          }
        }
      };
    });
  };

  const addWalkAreaPoint = () => {
    if (!selectedScene) return;
    updateDraftWithHistory((current) => {
      const sceneDraft = current.sceneDrafts[selectedScene.id] ?? createSceneDraft(selectedScene);
      const lastPoint =
        sceneDraft.walkAreaPoints[sceneDraft.walkAreaPoints.length - 1] ?? { x: "0", y: "0" };
      return {
        ...current,
        sceneDrafts: {
          ...current.sceneDrafts,
          [selectedScene.id]: {
            ...sceneDraft,
            walkAreaPoints: insertDraftPointAfter(
              sceneDraft.walkAreaPoints,
              sceneDraft.walkAreaPoints.length - 1,
              { x: lastPoint.x, y: lastPoint.y }
            )
          }
        }
      };
    });
  };

  const removeWalkAreaPoint = (index: number) => {
    if (!selectedScene || currentSceneDraft.walkAreaPoints.length <= 3) return;
    updateDraftWithHistory((current) => {
      const sceneDraft = current.sceneDrafts[selectedScene.id] ?? createSceneDraft(selectedScene);
      return {
        ...current,
        sceneDrafts: {
          ...current.sceneDrafts,
          [selectedScene.id]: {
            ...sceneDraft,
            walkAreaPoints: sceneDraft.walkAreaPoints.filter((_, pointIndex) => pointIndex !== index)
          }
        }
      };
    });
  };

  const updateLocaleValue = (key: string, value: string) => {
    if (!selectedLocale) return;
    updateDraftWithHistory((current) => ({
      ...current,
      localeDrafts: {
        ...current.localeDrafts,
        [selectedLocale.locale]: {
          ...(current.localeDrafts[selectedLocale.locale] ?? selectedLocale.strings),
          [key]: value
        }
      }
    }));
  };

  const updateLocaleEntryDraft = (field: "key" | "value", value: string) => {
    if (!selectedLocale) return;
    updateDraftWithHistory((current) => ({
      ...current,
      localeEntryDrafts: {
        ...current.localeEntryDrafts,
        [selectedLocale.locale]: {
          ...(current.localeEntryDrafts[selectedLocale.locale] ?? emptyLocaleEntry),
          [field]: value
        }
      }
    }));
  };

  const updateFlowDraft = (recipe: (current: FlowDraft) => FlowDraft) => {
    if (!selectedFlow || !currentFlowDraft) return;
    updateDraftWithHistory((current) => ({
      ...current,
      flowDrafts: {
        ...current.flowDrafts,
        [selectedFlow.id]: recipe(current.flowDrafts[selectedFlow.id] ?? currentFlowDraft)
      }
    }));
  };

  const updateFlowNode = (index: number, recipe: (node: FlowDraftNode) => FlowDraftNode) => {
    updateFlowDraft((current) => {
      const nodes = [...current.nodes];
      nodes[index] = recipe(nodes[index]!);
      return { ...current, nodes };
    });
  };

  const addFlowNode = (type: DraftNodeType) => {
    updateFlowDraft((current) => ({
      ...current,
      nodes: [...current.nodes, createNewFlowNode(type, current.nodes)]
    }));
  };

  const removeFlowNode = (index: number) => {
    updateFlowDraft((current) => {
      const nodeId = current.nodes[index]?.id;
      if (!nodeId) return current;
      const nodes = current.nodes.filter((_, nodeIndex) => nodeIndex !== index);
      const nextStartNodeId =
        current.startNodeId === nodeId ? nodes[0]?.id ?? current.startNodeId : current.startNodeId;
      return {
        ...current,
        nodes,
        startNodeId: nextStartNodeId
      };
    });
  };

  const applyHotspotChanges = async () => {
    if (!selectedScene || !selectedHotspot) return;

    const x = parseNumber(currentHotspotDraft.x);
    const y = parseNumber(currentHotspotDraft.y);
    const width = parsePositiveNumber(currentHotspotDraft.width);
    const height = parsePositiveNumber(currentHotspotDraft.height);
    const labelKey = currentHotspotDraft.labelKey.trim();
    const lookFlowId = currentHotspotDraft.lookFlowId.trim();
    const talkFlowId = currentHotspotDraft.talkFlowId.trim();
    const useFlowId = currentHotspotDraft.useFlowId.trim();
    const cursor = currentHotspotDraft.cursor.trim();

    if (x === null || y === null || width === null || height === null) {
      setStatus("Bounds must be valid numbers, with width and height above zero");
      return;
    }
    if (!labelKey) {
      setStatus("Label key is required");
      return;
    }
    if (cursor && !cursorOptions.includes(cursor as CursorValue)) {
      setStatus("Cursor must be blank, look, talk, use, or enter");
      return;
    }
    if (hotspotGuardrail.blockingIssues.length > 0) {
      setStatus(hotspotGuardrail.blockingIssues[0]!);
      return;
    }

    setStatus(`Saving ${selectedHotspot.id}...`);
    try {
      const patch = {
        actions: {
          lookFlowId: lookFlowId || undefined,
          talkFlowId: talkFlowId || undefined,
          useFlowId: useFlowId || undefined,
          useItemFlows: buildHotspotUseItemFlows(currentHotspotDraft.useItemFlows)
        },
        bounds: { x, y, width, height },
        labelKey
      } as {
        actions: {
          lookFlowId?: string;
          talkFlowId?: string;
          useFlowId?: string;
          useItemFlows: Array<{ itemId: string; flowId: string }>;
        };
        bounds: { x: number; y: number; width: number; height: number };
        cursor?: CursorValue;
        labelKey: string;
      };
      if (cursor !== "") {
        patch.cursor = cursor as CursorValue;
      }

      const snapshot = await window.pointClick.applyCommand({
        type: "hotspot/update",
        hotspotId: selectedHotspot.id,
        patch,
        sceneId: selectedScene.id
      });
      setProject(snapshot);
      setHistory((current) =>
        ({
          ...current,
          present: discardSavedDraft(
            current.present,
            "hotspot",
            createHotspotKey(selectedScene.id, selectedHotspot.id)
          )
        })
      );
      setStatus(`Saved ${selectedHotspot.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save hotspot");
    }
  };

  const applySceneChanges = async () => {
    if (!selectedScene) return;

    const playerStartX = parseNumber(currentSceneDraft.playerStartX);
    const playerStartY = parseNumber(currentSceneDraft.playerStartY);
    const name = currentSceneDraft.name.trim();
    const background = currentSceneDraft.background.trim();
    const walkArea = parseWalkAreaDraft(currentSceneDraft.walkAreaPoints);

    if (!name) {
      setStatus("Scene name is required");
      return;
    }
    if (!background) {
      setStatus("Background is required");
      return;
    }
    if (background.startsWith("#") && !hexColorPattern.test(background)) {
      setStatus("Background color must be a valid #RRGGBB value");
      return;
    }
    if (playerStartX === null || playerStartY === null) {
      setStatus("Scene coordinates must be valid numbers");
      return;
    }
    if (currentSceneDraft.walkAreaPoints.length < 3) {
      setStatus("Walk area needs at least three points");
      return;
    }
    if (!walkArea) {
      setStatus("Walk area points must be valid numbers");
      return;
    }
    if (polygonArea(walkArea) <= 0) {
      setStatus("Walk area must enclose a non-zero area");
      return;
    }

    setStatus(`Saving ${selectedScene.id}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "scene/update",
        patch: {
          background,
          name,
          playerStart: {
            x: playerStartX,
            y: playerStartY
          },
          walkArea
        },
        sceneId: selectedScene.id
      });
      setProject(snapshot);
      setHistory((current) => ({
        ...current,
        present: discardSavedDraft(current.present, "scene", selectedScene.id)
      }));
      setStatus(`Saved ${selectedScene.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save scene");
    }
  };

  const applyPickupChanges = async () => {
    if (!selectedScene || !selectedPickup) return;

    const x = parseNumber(currentPickupDraft.x);
    const y = parseNumber(currentPickupDraft.y);
    const width = parsePositiveNumber(currentPickupDraft.width);
    const height = parsePositiveNumber(currentPickupDraft.height);
    const itemId = currentPickupDraft.itemId.trim();
    const labelKey = currentPickupDraft.labelKey.trim();
    const pickupFlowId = currentPickupDraft.pickupFlowId.trim();

    if (x === null || y === null || width === null || height === null) {
      setStatus("Pickup bounds must be valid numbers, with width and height above zero");
      return;
    }
    if (!itemId) {
      setStatus("Pickup item id is required");
      return;
    }
    if (!labelKey) {
      setStatus("Pickup label key is required");
      return;
    }
    if (pickupGuardrail.blockingIssues.length > 0) {
      setStatus(pickupGuardrail.blockingIssues[0]!);
      return;
    }

    setStatus(`Saving ${selectedPickup.id}...`);
    try {
      const patch = {
        bounds: { x, y, width, height },
        itemId,
        labelKey
      } as {
        bounds: { x: number; y: number; width: number; height: number };
        itemId: string;
        labelKey: string;
        pickupFlowId?: string;
      };
      if (pickupFlowId) {
        patch.pickupFlowId = pickupFlowId;
      }

      const snapshot = await window.pointClick.applyCommand({
        type: "pickup/update",
        pickupId: selectedPickup.id,
        patch,
        sceneId: selectedScene.id
      });
      setProject(snapshot);
      setHistory((current) => ({
        ...current,
        present: discardSavedDraft(
          current.present,
          "pickup",
          createPickupKey(selectedScene.id, selectedPickup.id)
        )
      }));
      setStatus(`Saved ${selectedPickup.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save pickup");
    }
  };

  const applyItemChanges = async () => {
    if (!selectedItem) return;

    const name = currentItemDraft.name.trim();
    const labelKey = currentItemDraft.labelKey.trim();

    if (!name) {
      setStatus("Item name is required");
      return;
    }
    if (!labelKey) {
      setStatus("Item label key is required");
      return;
    }

    setStatus(`Saving ${selectedItem.id}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "item/update",
        itemId: selectedItem.id,
        patch: {
          labelKey,
          name
        }
      });
      setProject(snapshot);
      setHistory((current) => ({
        ...current,
        present: discardSavedDraft(current.present, "item", selectedItem.id)
      }));
      setStatus(`Saved ${selectedItem.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save item");
    }
  };

  const applyLocaleUpsert = async (key: string, value: string) => {
    if (!selectedLocale) return;

    const normalizedKey = key.trim();
    if (!normalizedKey) {
      setStatus("Locale keys cannot be empty");
      return;
    }

    setStatus(`Saving ${normalizedKey}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "locale/upsert",
        locale: selectedLocale.locale,
        patch: {
          key: normalizedKey,
          value
        }
      });
      setProject(snapshot);
      setHistory((current) => ({
        ...current,
        present: discardSavedDraft(current.present, "locale", selectedLocale.locale)
      }));
      setStatus(`Saved ${normalizedKey}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save locale string");
    }
  };

  const applyLocaleDelete = async (key: string) => {
    if (!selectedLocale) return;

    const normalizedKey = key.trim();
    if (!normalizedKey) {
      setStatus("Locale keys cannot be empty");
      return;
    }

    setStatus(`Deleting ${normalizedKey}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "locale/delete",
        key: normalizedKey,
        locale: selectedLocale.locale
      });
      setProject(snapshot);
      setHistory((current) => ({
        ...current,
        present: discardSavedDraft(current.present, "locale", selectedLocale.locale)
      }));
      setStatus(`Deleted ${normalizedKey}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete locale string");
    }
  };

  const applyFlowChanges = async () => {
    if (!selectedFlow || !currentFlowDraft) return;

    const name = currentFlowDraft.name.trim();
    const startNodeId = currentFlowDraft.startNodeId.trim();
    const ids = currentFlowDraft.nodes.map((node) => node.id.trim());

    if (!name) {
      setStatus("Flow name is required");
      return;
    }
    if (currentFlowDraft.nodes.length === 0) {
      setStatus("A flow must contain at least one node");
      return;
    }
    if (ids.some((id) => id.length === 0)) {
      setStatus("Each node needs a non-empty id");
      return;
    }
    if (new Set(ids).size !== ids.length) {
      setStatus("Node ids must be unique");
      return;
    }
    if (!ids.includes(startNodeId)) {
      setStatus("Start node must reference an existing node id");
      return;
    }
    if (!currentFlowDraft.nodes.some((node) => node.type === "end")) {
      setStatus("A flow must contain at least one end node");
      return;
    }
    for (const node of currentFlowDraft.nodes) {
      if (node.type === "line") {
        if (!node.speakerId.trim() || !node.textKey.trim() || !node.next.trim()) {
          setStatus(`Line node "${node.id}" is incomplete`);
          return;
        }
        if (!ids.includes(node.next.trim())) {
          setStatus(`Line node "${node.id}" points to a missing next node`);
          return;
        }
      }
      if (node.type === "set-flag") {
        if (!node.key.trim() || !node.next.trim() || node.value.trim() === "") {
          setStatus(`Set-flag node "${node.id}" is incomplete`);
          return;
        }
        if (!ids.includes(node.next.trim())) {
          setStatus(`Set-flag node "${node.id}" points to a missing next node`);
          return;
        }
        if (node.valueKind === "number" && Number.isNaN(Number(node.value))) {
          setStatus(`Set-flag node "${node.id}" needs a valid numeric value`);
          return;
        }
      }
    }

    setStatus(`Saving ${selectedFlow.id}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "flow/update",
        flowId: selectedFlow.id,
        patch: {
          name,
          nodes: buildFlowNodes(currentFlowDraft.nodes),
          startNodeId
        }
      });
      setProject(snapshot);
      setHistory((current) => ({
        ...current,
        present: discardSavedDraft(current.present, "flow", selectedFlow.id)
      }));
      setStatus(`Saved ${selectedFlow.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save flow");
    }
  };

  return (
    <div className="studio-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">P/C</span>
          <div>
            <strong>Point & Click Studio</strong>
            <small>{project?.manifest.title ?? "Loading project..."}</small>
          </div>
        </div>

        <nav className="workspace-tabs" aria-label="Workspaces">
          {workspaceCapabilities.map((item) => (
            <button
              className={workspace === item.workspace ? "active" : ""}
              key={item.id}
              title={item.detail}
              type="button"
              onClick={() => setWorkspace(item.workspace)}
            >
              <span>{item.label}</span>
              <span className={`capability-badge ${capabilityStatusTone(item.status)}`}>
                {capabilityBadgeLabel(item.status)}
              </span>
            </button>
          ))}
        </nav>

        <div className="preview-actions">
          <button
            className="secondary-action"
            disabled={!canUndo}
            type="button"
            onClick={() => replaceSession((current) => undoHistory(current))}
          >
            Undo
          </button>
          <button
            className="secondary-action"
            disabled={!canRedo}
            type="button"
            onClick={() => replaceSession((current) => redoHistory(current))}
          >
            Redo
          </button>
          <button className="secondary-action" type="button" onClick={openProject}>
            Open Project
          </button>
          <button className="secondary-action" type="button" onClick={openBrowser}>
            Open in Browser
          </button>
          <button className="play-action" type="button" onClick={play}>
            <span>&#9654;</span> {dirtyState.count > 0 ? "Play Draft Preview" : "Play Project"}
          </button>
        </div>
      </header>

      {pendingRecovery ? (
        <div className="recovery-banner">
          <div>
            <strong>Recovered draft available</strong>
            <small>We found unapplied local edits for this project.</small>
          </div>
          <div className="recovery-actions">
            <button className="secondary-action" type="button" onClick={discardRecovery}>
              Discard
            </button>
            <button className="play-action" type="button" onClick={restoreRecovery}>
              Restore drafts
            </button>
          </div>
        </div>
      ) : null}

      <div className="workspace-grid">
        <aside className="project-panel panel">
          <div className="panel-heading">
            <span>Project</span>
            <button type="button" aria-label="Open project" onClick={openProject}>
              Open
            </button>
          </div>
          <div className="tree">
            <div className="tree-group open">Scenes</div>
            {project ? (
              <button className="tree-item tree-child" type="button" onClick={createScene}>
                <span className="scene-dot muted" /> + New scene
              </button>
            ) : null}
            {scenes.map((scene) => (
              <button
                className={`tree-item ${session.activeLocale === null && session.activeFlowId === null && !session.activeHotspotId && !session.activePickupId && !session.activeItemId && selectedScene?.id === scene.id ? "selected" : ""}`}
                key={scene.id}
                type="button"
                onClick={() => selectScene(scene.id)}
              >
                <span className="scene-dot" /> {scene.name}
                {dirtyState.sceneIds.has(scene.id) ? <span className="dirty-mark">*</span> : null}
              </button>
            ))}
            <div className="tree-group open">Hotspots ({selectedScene?.hotspots.length ?? 0})</div>
            {selectedScene ? (
              <button className="tree-item tree-child" type="button" onClick={createHotspot}>
                <span className="scene-dot muted" /> + New hotspot
              </button>
            ) : null}
            {selectedScene?.hotspots.map((hotspot) => (
              <button
                className={`tree-item tree-child ${session.activeHotspotId === hotspot.id ? "selected" : ""}`}
                key={hotspot.id}
                type="button"
                onClick={() => selectHotspot(hotspot)}
              >
                <span className="scene-dot muted" /> {hotspot.id}
                {dirtyState.hotspotKeys.has(createHotspotKey(selectedScene.id, hotspot.id)) ? (
                  <span className="dirty-mark">*</span>
                ) : null}
              </button>
            ))}
            <div className="tree-group open">Pickups ({selectedScene?.pickups.length ?? 0})</div>
            {selectedScene ? (
              <button className="tree-item tree-child" type="button" onClick={createPickup}>
                <span className="scene-dot muted" /> + New pickup
              </button>
            ) : null}
            {selectedScene?.pickups.map((pickup) => (
              <button
                className={`tree-item tree-child ${session.activePickupId === pickup.id ? "selected" : ""}`}
                key={pickup.id}
                type="button"
                onClick={() => selectPickup(pickup)}
              >
                <span className="scene-dot muted" /> {pickup.id}
                {dirtyState.pickupKeys.has(createPickupKey(selectedScene.id, pickup.id)) ? (
                  <span className="dirty-mark">*</span>
                ) : null}
              </button>
            ))}
            <div className="tree-group open">Flows ({project?.flowCount ?? 0})</div>
            {project ? (
              <button className="tree-item tree-child" type="button" onClick={createFlow}>
                <span className="scene-dot muted" /> + New flow
              </button>
            ) : null}
            {project?.flows.map((flow) => (
              <button
                className={`tree-item ${session.activeFlowId === flow.id ? "selected" : ""}`}
                key={flow.id}
                type="button"
                onClick={() => selectFlow(flow)}
              >
                <span className="scene-dot muted" /> {flow.id}
                {dirtyState.flowIds.has(flow.id) ? <span className="dirty-mark">*</span> : null}
              </button>
            ))}
            <div className="tree-group open">Items ({project?.itemCount ?? 0})</div>
            {project ? (
              <button className="tree-item tree-child" type="button" onClick={createItem}>
                <span className="scene-dot muted" /> + New item
              </button>
            ) : null}
            {project?.items.map((item) => (
              <button
                className={`tree-item ${session.activeItemId === item.id ? "selected" : ""}`}
                key={item.id}
                type="button"
                onClick={() => selectItem(item)}
              >
                <span className="scene-dot muted" /> {item.id}
                {dirtyState.itemIds.has(item.id) ? <span className="dirty-mark">*</span> : null}
              </button>
            ))}
            <div className="tree-group open">Assets ({project?.assetCount ?? 0})</div>
            {project?.assets.map((asset) => (
              <button
                className={`tree-item ${selectedAsset?.id === asset.id && workspace === "assets" ? "selected" : ""}`}
                key={asset.id}
                type="button"
                onClick={() => {
                  setSelectedAssetId(asset.id);
                  setWorkspace("assets");
                }}
              >
                <span className="scene-dot muted" /> {asset.id}
                {assetHealth(asset, project) === "missing" ? <span className="dirty-mark">!</span> : null}
              </button>
            ))}
            <div className="tree-group open">Locales ({project?.localeCount ?? 0})</div>
            {project?.locales.map((locale) => (
              <button
                className={`tree-item ${session.activeLocale === locale.locale ? "selected" : ""}`}
                key={locale.locale}
                type="button"
                onClick={() => selectLocale(locale)}
              >
                <span className="scene-dot muted" /> {locale.locale}
                {dirtyState.localeIds.has(locale.locale) ? <span className="dirty-mark">*</span> : null}
              </button>
            ))}
          </div>
          <div className="project-health">
            <span className={`health-light ${projectHealth?.tone ?? "warn"}`} />
            <div>
              <strong>{projectHealth?.label ?? "Loading project health..."}</strong>
              <small>
                {projectHealth ? `${projectHealth.detail} - ${localeLabel}` : status}
              </small>
            </div>
          </div>
        </aside>

        <section className="canvas-panel panel">
          <div className="canvas-toolbar">
            <div className="toolset">
              {toolCapabilities.map((tool) => (
                <button
                  className={
                    sceneToolFromCapability(tool.id) === activeSceneTool && workspace === "scene" ? "active" : ""
                  }
                  disabled={tool.status === "planned" || !selectedScene || workspace !== "scene"}
                  key={tool.id}
                  title={`${capabilityBadgeLabel(tool.status)}: ${tool.detail}`}
                  type="button"
                  onClick={() => {
                    const nextTool = sceneToolFromCapability(tool.id);
                    if (nextTool) {
                      setActiveSceneTool(nextTool);
                    }
                  }}
                >
                  {tool.label}
                </button>
              ))}
            </div>
            <div className="canvas-meta">
              {workspace === "overview"
                ? "Editor overview and capability status"
                : workspace === "scene" && selectedScene
                  ? `Layered 2D - ${sceneLabel} - ${selectedScene.hotspots.length} hotspot(s) - ${selectedScene.pickups.length} pickup(s) - Tool: ${selectedSceneToolLabel}`
                  : workspace === "narrative"
                    ? "Structured flow and locale editing"
                    : workspaceCapability.summary}
            </div>
          </div>

          {workspace === "overview" ? (
            <div className="workspace-overview">
              <section className="overview-card">
                <span className="overview-label">Project health</span>
                <strong>{projectHealth?.label ?? "Loading project..."}</strong>
                <p>{status}</p>
              </section>
              <section className="overview-card">
                <span className="overview-label">Preview target</span>
                <strong>{dirtyState.count > 0 ? "Draft bundle" : "Saved project bundle"}</strong>
                <p>
                  {selectedScene
                    ? `Preview starts from ${selectedScene.id} in the currently opened project.`
                    : "Open a project to prepare a preview bundle."}
                </p>
              </section>
              <section className="overview-card">
                <span className="overview-label">Viewport authoring</span>
                <strong>{selectedScene ? "Direct manipulation is live" : "Open a scene to author visually"}</strong>
                <p>
                  {selectedScene
                    ? "Hotspots, pickups, player start, and walk points can be edited directly from the scene viewport."
                    : "Scene tools appear once a layered 2D scene is selected."}
                </p>
              </section>
              <section className="overview-card">
                <span className="overview-label">Capabilities</span>
                <div className="capability-list">
                  {workspaceCapabilities.map((item) => (
                    <div className="capability-card" key={item.id}>
                      <div>
                        <strong>{item.label}</strong>
                        <p>{item.summary}</p>
                      </div>
                      <span className={`capability-badge ${capabilityStatusTone(item.status)}`}>
                        {capabilityBadgeLabel(item.status)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
              <section className="overview-card">
                <span className="overview-label">Diagnostics</span>
                <div className="diagnostic-list">
                  {project?.diagnostics.length ? (
                    project.diagnostics.slice(0, 6).map((diagnostic, index) => (
                      <div className={`diagnostic-item ${diagnostic.severity}`} key={`${diagnostic.code}-${index}`}>
                        <strong>{diagnostic.code}</strong>
                        <p>{diagnostic.message}</p>
                      </div>
                    ))
                  ) : (
                    <p>No project diagnostics right now.</p>
                  )}
                </div>
              </section>
            </div>
          ) : workspace === "build" ? (
            <div className="workspace-overview build-workspace">
              <section className="overview-card">
                <span className="overview-label">Project validation</span>
                <strong>{validationSummaryLabel(currentValidationReport)}</strong>
                <p>{validationStatus}</p>
                <div className="build-actions">
                  <button
                    className="play-action"
                    disabled={!project || validationRunState === "running"}
                    type="button"
                    onClick={runValidation}
                  >
                    {validationRunState === "running" ? "Validating..." : "Validate Project"}
                  </button>
                </div>
              </section>
              <section className="overview-card">
                <span className="overview-label">Last validation</span>
                <strong>{formatValidationTimestamp(validationReport?.ranAt ?? null)}</strong>
                <p>Saved target: {project?.directory ?? "No project loaded"}</p>
              </section>
              <section className="overview-card">
                <span className="overview-label">Preview readiness</span>
                <strong>{previewReadinessLabel}</strong>
                <p>
                  {dirtyState.count > 0
                    ? `${dirtyState.count} draft change(s) exist outside saved-file validation.`
                    : "Saved validation and preview target currently match."}
                </p>
              </section>
              <section className="overview-card">
                <span className="overview-label">Diagnostics</span>
                <div className="diagnostic-list">
                  {currentValidationReport?.diagnostics.length ? (
                    currentValidationReport.diagnostics.map((diagnostic, index) => (
                      <div className={`diagnostic-item ${diagnostic.severity}`} key={`${diagnostic.code}-${index}`}>
                        <div>
                          <strong>{diagnostic.code}</strong>
                          <p>{diagnostic.message}</p>
                          {diagnostic.path ? <p className="diagnostic-meta">{diagnostic.path}</p> : null}
                        </div>
                        <span
                          className={`capability-badge ${
                            diagnostic.severity === "error" ? "warn" : "muted"
                          }`}
                        >
                          {diagnostic.severity}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p>No diagnostics found for the saved project.</p>
                  )}
                </div>
              </section>
            </div>
          ) : workspace === "assets" ? (
            <div className="workspace-overview build-workspace">
              <section className="overview-card">
                <span className="overview-label">Project library</span>
                <strong>{project?.assetCount ?? 0} registered asset(s)</strong>
                <p>{selectedAsset ? `${selectedAsset.id} selected` : "Import images into the project library."}</p>
                <div className="build-actions">
                  <button className="play-action" disabled={!project} type="button" onClick={importAssets}>
                    Import Assets
                  </button>
                </div>
              </section>
              <section className="overview-card">
                <span className="overview-label">Selected asset</span>
                <strong>{selectedAsset?.id ?? "No asset selected"}</strong>
                <p>
                  {selectedAsset
                    ? `${selectedAsset.kind} - ${selectedAsset.path}`
                    : "Choose an asset from the project tree to inspect it."}
                </p>
                {selectedAsset ? (
                  <div className="asset-path-editor">
                    <label>
                      Asset path
                      <input
                        value={assetPathDraft}
                        onChange={(event) => setAssetPathDraft(event.target.value)}
                      />
                    </label>
                    <div className="build-actions">
                      <button className="secondary-action" type="button" onClick={applyAssetRelink}>
                        Relink Asset
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>
              <section className="overview-card">
                <span className="overview-label">Usage</span>
                <strong>{selectedAssetUsage.length} scene reference(s)</strong>
                <div className="diagnostic-list">
                  {selectedAssetUsage.length ? (
                    selectedAssetUsage.map((usage) => (
                      <div className="diagnostic-item" key={usage.sceneId}>
                        <div>
                          <strong>{usage.sceneId}</strong>
                          <p>{usage.sceneName}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p>No scene background is using this asset yet.</p>
                  )}
                </div>
              </section>
              <section className="overview-card">
                <span className="overview-label">Health</span>
                <strong>{selectedAsset ? selectedAssetHealth : "n/a"}</strong>
                <p>
                  {selectedAssetHealth === "missing"
                    ? "The asset is registered, but its file is missing on disk."
                    : "The asset file is available to the project."}
                </p>
                {selectedAsset ? (
                  <div className="build-actions">
                    <button
                      className="secondary-action"
                      disabled={!selectedScene || selectedAsset.kind !== "image" || selectedAssetHealth === "missing"}
                      type="button"
                      onClick={assignAssetBackground}
                    >
                      Set As Scene Background
                    </button>
                    <button
                      className="secondary-action"
                      disabled={selectedAssetUsage.length > 0}
                      type="button"
                      onClick={deleteSelectedAsset}
                    >
                      Delete Unused Asset
                    </button>
                  </div>
                ) : null}
              </section>
            </div>
          ) : (
            <div
              className="scene-viewport"
              ref={viewportRef}
              style={
                selectedScene
                  ? sceneBackgroundStyle(selectedScene.background, project?.directory ?? "")
                  : { background: "#24384a" }
              }
            >
              {selectedScene && workspace === "scene" ? (
                <div className="viewport-instruction">
                  <strong>{selectedSceneToolLabel}</strong>
                  <span>{selectedSceneToolHint}</span>
                </div>
              ) : null}
              {selectedScene ? (
              <>
                {selectedScene.shapes.map((shape) => (
                  <div
                    className={`scene-shape ${shape.shape}`}
                    key={shape.id}
                    style={{
                      background: shape.fill,
                      height: `${(shape.bounds.height / selectedScene.size.height) * 100}%`,
                      left: `${(shape.bounds.x / selectedScene.size.width) * 100}%`,
                      top: `${(shape.bounds.y / selectedScene.size.height) * 100}%`,
                      width: `${(shape.bounds.width / selectedScene.size.width) * 100}%`,
                      zIndex: shape.depth
                    }}
                  />
                ))}
                {previewWalkArea ? (
                  <svg
                    className="walk-region"
                    viewBox={`0 0 ${selectedScene.size.width} ${selectedScene.size.height}`}
                    preserveAspectRatio="none"
                  >
                    <polygon className="walk-region-fill" points={previewWalkAreaPoints} />
                    <polygon className="walk-region-outline" points={previewWalkAreaPoints} />
                    {canEditViewportScene
                      ? previewWalkArea.points.map((point, index) => {
                          const nextPoint =
                            previewWalkArea.points[(index + 1) % previewWalkArea.points.length]!;
                          return (
                            <line
                              className="walk-region-edge-hit"
                              key={`walk-edge-hit-${index}`}
                              x1={point.x}
                              x2={nextPoint.x}
                              y1={point.y}
                              y2={nextPoint.y}
                              onPointerDown={(event) => insertWalkAreaPointFromEvent(index, event)}
                            />
                          );
                        })
                      : null}
                    {previewWalkArea.points.map((point, index) => (
                      <g key={`walk-point-${index}`}>
                        <circle
                          className={`walk-region-point ${canEditViewportScene ? "editable" : ""}`}
                          cx={point.x}
                          cy={point.y}
                          r="7"
                          onPointerDown={(event) =>
                            startWalkAreaPointInteraction(index, point, event)
                          }
                        />
                        <text className="walk-region-label" x={point.x + 10} y={point.y - 10}>
                          {index + 1}
                        </text>
                      </g>
                    ))}
                  </svg>
                ) : null}
                <div
                  className="character"
                  onPointerDown={startPlayerStartInteraction}
                    style={{
                      left: `${((previewPlayerStart ?? selectedScene.playerStart).x / selectedScene.size.width) * 100}%`,
                      top: `${((previewPlayerStart ?? selectedScene.playerStart).y / selectedScene.size.height) * 100}%`
                    }}
                    title={
                      activeSceneTool === "player-start"
                        ? "Drag to move player start"
                        : "Switch to Player Start to move the marker"
                    }
                  >
                    <span />
                </div>
                {previewHotspots.map((hotspot) => (
                  (() => {
                    const hotspotIssues = previewHotspotIssueMap[hotspot.id];
                    return (
                  <button
                    className={`hotspot-box ${selectedHotspot?.id === hotspot.id ? "selected" : ""} ${hotspotIssues?.hasIssues ? `has-issues ${hotspotIssues.tone}` : ""}`}
                    key={hotspot.id}
                    type="button"
                    onClick={() => selectHotspot(hotspot)}
                    onPointerDown={(event) => startHotspotInteraction("move", hotspot, event)}
                    style={{
                      height: `${(hotspot.bounds.height / selectedScene.size.height) * 100}%`,
                      left: `${(hotspot.bounds.x / selectedScene.size.width) * 100}%`,
                      top: `${(hotspot.bounds.y / selectedScene.size.height) * 100}%`,
                      width: `${(hotspot.bounds.width / selectedScene.size.width) * 100}%`
                    }}
                    title={
                      hotspotIssues?.hasIssues
                        ? hotspotIssues.detail
                        : activeSceneTool === "hotspot"
                          ? "Click to inspect, drag to move"
                          : "Switch to Hotspot to move or resize"
                    }
                  >
                    <span className="viewport-label">
                      {hotspot.id}
                      {hotspotIssues?.hasIssues ? (
                        <span className={`viewport-issue-badge ${hotspotIssues.tone}`}>
                          {hotspotIssues.issueCount}
                        </span>
                      ) : null}
                    </span>
                    {selectedHotspot?.id === hotspot.id ? (
                      <span
                        className="viewport-resize-handle"
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => startHotspotInteraction("resize", hotspot, event)}
                      />
                    ) : null}
                  </button>
                    );
                  })()
                ))}
                {previewPickups.map((pickup) => (
                  (() => {
                    const pickupIssues = previewPickupIssueMap[pickup.id];
                    return (
                  <button
                    className={`pickup-box ${selectedPickup?.id === pickup.id ? "selected" : ""} ${pickupIssues?.hasIssues ? `has-issues ${pickupIssues.tone}` : ""}`}
                    key={pickup.id}
                    type="button"
                    onClick={() => selectPickup(pickup)}
                    onPointerDown={(event) => startPickupInteraction("move", pickup, event)}
                    style={{
                      height: `${(pickup.bounds.height / selectedScene.size.height) * 100}%`,
                      left: `${(pickup.bounds.x / selectedScene.size.width) * 100}%`,
                      top: `${(pickup.bounds.y / selectedScene.size.height) * 100}%`,
                      width: `${(pickup.bounds.width / selectedScene.size.width) * 100}%`
                    }}
                    title={
                      pickupIssues?.hasIssues
                        ? pickupIssues.detail
                        : activeSceneTool === "pickup"
                          ? "Click to inspect, drag to move"
                          : "Switch to Pickup to move or resize"
                    }
                  >
                    <span className="viewport-label">
                      {pickup.id}
                      {pickupIssues?.hasIssues ? (
                        <span className={`viewport-issue-badge ${pickupIssues.tone}`}>
                          {pickupIssues.issueCount}
                        </span>
                      ) : null}
                    </span>
                    {selectedPickup?.id === pickup.id ? (
                      <span
                        className="viewport-resize-handle"
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => startPickupInteraction("resize", pickup, event)}
                      />
                    ) : null}
                  </button>
                    );
                  })()
                ))}
              </>
            ) : (
              <div className="empty-scene">Open a project to inspect a scene.</div>
            )}
            </div>
          )}

          <div className="timeline-strip">
            <span>Project</span>
            <div className="timeline-node selected">{project?.sceneCount ?? 0} scene(s)</div>
            <div className="timeline-node">{project?.flowCount ?? 0} flow(s)</div>
            <div className="timeline-node">{project?.itemCount ?? 0} item(s)</div>
            <div className="timeline-node">{project?.localeCount ?? 0} locale(s)</div>
            <div className="timeline-node">{project?.diagnostics.length ?? 0} diagnostic(s)</div>
            <div className="timeline-node">{project?.directory ?? "No folder"}</div>
          </div>
        </section>

        <aside className="inspector-panel panel">
          <div className="panel-heading">
            <span>Inspector</span>
            <small>
              {workspace === "overview"
                ? "Status"
                : workspace === "assets"
                  ? "Library"
                  : workspace === "build"
                    ? "Validation"
                  : selectedFlow
                ? "Flow"
                : selectedLocale
                  ? "Locale"
                  : selectedHotspot
                    ? "Hotspot"
                    : selectedPickup
                      ? "Pickup"
                      : selectedItem
                        ? "Item"
                    : selectedScene
                      ? "Scene"
                      : ""}
            </small>
          </div>
          <div className="inspector-content">
            {workspace === "overview" ? (
              <>
                <div className="flow-link">
                  <span>Current workspace</span>
                  <strong>{workspaceCapability.label}</strong>
                  <p className="inspector-copy">{workspaceCapability.detail}</p>
                </div>
                <div className="flow-link">
                  <span>Project diagnostics</span>
                  <strong>{project?.diagnostics.length ?? 0} total</strong>
                  <p className="inspector-copy">
                    {project?.diagnostics.filter((item) => item.severity === "error").length ?? 0} error(s),{" "}
                    {project?.diagnostics.filter((item) => item.severity === "warning").length ?? 0} warning(s)
                  </p>
                </div>
                <div className="flow-link">
                  <span>Draft status</span>
                  <strong>{dirtyState.count} dirty draft(s)</strong>
                  <p className="inspector-copy">
                    {dirtyState.count > 0
                      ? "Preview will use a temporary validated draft bundle."
                      : "Preview will use the saved project bundle."}
                  </p>
                </div>
              </>
            ) : workspace === "assets" ? (
              <div className="workspace-placeholder compact">
                <span className={`capability-badge ${selectedAssetHealth === "missing" ? "error" : "good"}`}>
                  {selectedAsset ? selectedAsset.kind : "Library"}
                </span>
                <strong>{selectedAsset?.id ?? workspaceCapability.summary}</strong>
                <p>{selectedAsset?.path ?? workspaceCapability.detail}</p>
                {selectedAsset ? (
                  <>
                    <p className="inspector-copy">Source: {selectedAsset.source}</p>
                    <p className="inspector-copy">Usage: {selectedAssetUsage.length} scene reference(s)</p>
                    <p className="inspector-copy">Health: {selectedAssetHealth}</p>
                  </>
                ) : null}
              </div>
            ) : workspace === "build" ? (
              <div className="workspace-placeholder compact">
                <span className={`capability-badge ${validationTone(currentValidationReport)}`}>
                  {validationRunState === "running" ? "Running" : "Validation"}
                </span>
                <strong>{validationSummaryLabel(currentValidationReport)}</strong>
                <p>{validationStatus}</p>
                <p className="inspector-copy">
                  Last run: {formatValidationTimestamp(validationReport?.ranAt ?? null)}
                </p>
                <p className="inspector-copy">Preview note: {previewReadinessLabel}</p>
              </div>
            ) : selectedFlow && currentFlowDraft ? (
              <>
                <label>
                  Flow
                  <input value={currentFlowDraft.id} readOnly />
                </label>
                <label>
                  Name
                  <input
                    value={currentFlowDraft.name}
                    onChange={(event) =>
                      updateFlowDraft((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Start node
                  <select
                    value={currentFlowDraft.startNodeId}
                    onChange={(event) =>
                      updateFlowDraft((current) => ({ ...current, startNodeId: event.target.value }))
                    }
                  >
                    {flowNodeIds.map((nodeId) => (
                      <option key={nodeId} value={nodeId}>
                        {nodeId}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flow-nodes">
                  {currentFlowDraft.nodes.map((node, index) => (
                    <div className="flow-node-card" key={`${node.type}-${index}-${node.id}`}>
                      <div className="flow-node-header">
                        <strong>{node.type}</strong>
                        <button type="button" onClick={() => removeFlowNode(index)}>
                          Remove
                        </button>
                      </div>
                      <label>
                        Node id
                        <input
                          value={node.id}
                          onChange={(event) =>
                            updateFlowNode(index, (current) => ({ ...current, id: event.target.value }))
                          }
                        />
                      </label>
                      {node.type === "line" ? (
                        <>
                          <label>
                            Speaker id
                            <input
                              value={node.speakerId}
                              onChange={(event) =>
                                updateFlowNode(index, (current) =>
                                  current.type === "line"
                                    ? { ...current, speakerId: event.target.value }
                                    : current
                                )
                              }
                            />
                          </label>
                          <label>
                            Text key
                            <input
                              value={node.textKey}
                              onChange={(event) =>
                                updateFlowNode(index, (current) =>
                                  current.type === "line"
                                    ? { ...current, textKey: event.target.value }
                                    : current
                                )
                              }
                            />
                          </label>
                          <label>
                            Next
                            <select
                              value={node.next}
                              onChange={(event) =>
                                updateFlowNode(index, (current) =>
                                  current.type === "line" ? { ...current, next: event.target.value } : current
                                )
                              }
                            >
                              {flowNodeIds.map((nodeId) => (
                                <option key={nodeId} value={nodeId}>
                                  {nodeId}
                                </option>
                              ))}
                            </select>
                          </label>
                        </>
                      ) : null}
                      {node.type === "set-flag" ? (
                        <>
                          <label>
                            Flag key
                            <input
                              value={node.key}
                              onChange={(event) =>
                                updateFlowNode(index, (current) =>
                                  current.type === "set-flag" ? { ...current, key: event.target.value } : current
                                )
                              }
                            />
                          </label>
                          <label>
                            Value type
                            <select
                              value={node.valueKind}
                              onChange={(event) =>
                                updateFlowNode(index, (current) =>
                                  current.type === "set-flag"
                                    ? { ...current, valueKind: event.target.value as "string" | "number" | "boolean" }
                                    : current
                                )
                              }
                            >
                              <option value="boolean">boolean</option>
                              <option value="number">number</option>
                              <option value="string">string</option>
                            </select>
                          </label>
                          <label>
                            Value
                            <input
                              value={node.value}
                              onChange={(event) =>
                                updateFlowNode(index, (current) =>
                                  current.type === "set-flag" ? { ...current, value: event.target.value } : current
                                )
                              }
                            />
                          </label>
                          <label>
                            Next
                            <select
                              value={node.next}
                              onChange={(event) =>
                                updateFlowNode(index, (current) =>
                                  current.type === "set-flag"
                                    ? { ...current, next: event.target.value }
                                    : current
                                )
                              }
                            >
                              {flowNodeIds.map((nodeId) => (
                                <option key={nodeId} value={nodeId}>
                                  {nodeId}
                                </option>
                              ))}
                            </select>
                          </label>
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="flow-link">
                  <span>Locale coverage</span>
                  <div className="flow-status-line">
                    <span className={`capability-badge ${flowGuardrail.tone}`}>{flowGuardrail.badge}</span>
                  </div>
                  <strong>{flowGuardrail.summary}</strong>
                  <p className="inspector-copy">{flowGuardrail.detail}</p>
                </div>
                <div className="flow-link">
                  <span>Add node</span>
                  <strong>
                    {currentFlowDraft.nodes.length} node(s)
                    {dirtyState.flowIds.has(selectedFlow.id) ? " - unsaved draft" : ""}
                  </strong>
                  <div className="flow-actions">
                    <button type="button" onClick={() => addFlowNode("line")}>
                      Add line
                    </button>
                    <button type="button" onClick={() => addFlowNode("set-flag")}>
                      Add set-flag
                    </button>
                    <button type="button" onClick={() => addFlowNode("end")}>
                      Add end
                    </button>
                    <button type="button" onClick={deleteSelectedFlow}>
                      Delete flow
                    </button>
                    <button type="button" onClick={applyFlowChanges}>
                      Apply changes -&gt;
                    </button>
                  </div>
                </div>
              </>
            ) : selectedLocale ? (
              <>
                <label>
                  Locale
                  <input value={selectedLocale.locale} readOnly />
                </label>
                <div className="locale-strings">
                  {localeEntries.map(([key, value]) => (
                    <div className="locale-entry" key={key}>
                      <label>
                        Key
                        <input value={key} readOnly />
                      </label>
                      <label>
                        Value
                        <input
                          value={value}
                          onChange={(event) => updateLocaleValue(key, event.target.value)}
                        />
                      </label>
                      <div className="flow-actions">
                        <button type="button" onClick={() => applyLocaleUpsert(key, currentLocaleDraft[key] ?? "")}>
                          Save string
                        </button>
                        <button type="button" onClick={() => applyLocaleDelete(key)}>
                          Delete string
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flow-link">
                  <span>Add string</span>
                  <input
                    placeholder="key.path"
                    value={currentLocaleEntryDraft.key}
                    onChange={(event) => updateLocaleEntryDraft("key", event.target.value)}
                  />
                  <textarea
                    placeholder="Localized text"
                    value={currentLocaleEntryDraft.value}
                    onChange={(event) => updateLocaleEntryDraft("value", event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      applyLocaleUpsert(currentLocaleEntryDraft.key, currentLocaleEntryDraft.value)
                    }
                  >
                    Add or update
                  </button>
                </div>
              </>
            ) : selectedHotspot ? (
              <>
                <label>
                  Name
                  <input value={selectedHotspot.id} readOnly />
                </label>
                <label>
                  Display label
                  <input
                    className={hotspotLabelMissing ? "field-input-invalid" : ""}
                    ref={hotspotLabelInputRef}
                    value={currentHotspotDraft.labelKey}
                    onChange={(event) => updateHotspotDraft("labelKey", event.target.value)}
                  />
                  {hotspotLabelMissing ? (
                    <small className="field-hint error">
                      {currentHotspotDraft.labelKey.trim().length === 0
                        ? "Display label is required."
                        : `Label key is missing in ${defaultLocaleId}.`}
                    </small>
                  ) : null}
                </label>
                <div className="field-group">
                  <span>Bounds</span>
                  <div className="four-fields">
                    <input
                      aria-label="X"
                      value={currentHotspotDraft.x}
                      onChange={(event) => updateHotspotDraft("x", event.target.value)}
                    />
                    <input
                      aria-label="Y"
                      value={currentHotspotDraft.y}
                      onChange={(event) => updateHotspotDraft("y", event.target.value)}
                    />
                    <input
                      aria-label="Width"
                      value={currentHotspotDraft.width}
                      onChange={(event) => updateHotspotDraft("width", event.target.value)}
                    />
                    <input
                      aria-label="Height"
                      value={currentHotspotDraft.height}
                      onChange={(event) => updateHotspotDraft("height", event.target.value)}
                    />
                  </div>
                </div>
                <label>
                  Cursor
                  <select
                    value={currentHotspotDraft.cursor}
                    onChange={(event) => updateHotspotDraft("cursor", event.target.value)}
                  >
                    <option value="">Default</option>
                    <option value="enter">Enter</option>
                    <option value="look">Look</option>
                    <option value="talk">Talk</option>
                    <option value="use">Use</option>
                  </select>
                </label>
                <label>
                  Look flow
                  <select
                    className={hotspotLookFlowMissing ? "field-input-invalid" : ""}
                    ref={hotspotLookFlowRef}
                    value={currentHotspotDraft.lookFlowId}
                    onChange={(event) => updateHotspotDraft("lookFlowId", event.target.value)}
                  >
                    <option value="">None</option>
                    {availableFlowIds.map((flowId) => (
                      <option key={`hotspot-look-${flowId}`} value={flowId}>
                        {flowId}
                      </option>
                    ))}
                  </select>
                  {hotspotLookFlowMissing ? (
                    <small className="field-hint error">Selected look flow no longer exists.</small>
                  ) : null}
                </label>
                <label>
                  Talk flow
                  <select
                    className={hotspotTalkFlowMissing ? "field-input-invalid" : ""}
                    ref={hotspotTalkFlowRef}
                    value={currentHotspotDraft.talkFlowId}
                    onChange={(event) => updateHotspotDraft("talkFlowId", event.target.value)}
                  >
                    <option value="">None</option>
                    {availableFlowIds.map((flowId) => (
                      <option key={`hotspot-talk-${flowId}`} value={flowId}>
                        {flowId}
                      </option>
                    ))}
                  </select>
                  {hotspotTalkFlowMissing ? (
                    <small className="field-hint error">Selected talk flow no longer exists.</small>
                  ) : null}
                </label>
                <label>
                  Use flow
                  <select
                    className={hotspotUseFlowMissing ? "field-input-invalid" : ""}
                    ref={hotspotUseFlowRef}
                    value={currentHotspotDraft.useFlowId}
                    onChange={(event) => updateHotspotDraft("useFlowId", event.target.value)}
                  >
                    <option value="">None</option>
                    {availableFlowIds.map((flowId) => (
                      <option key={`hotspot-use-${flowId}`} value={flowId}>
                        {flowId}
                      </option>
                    ))}
                  </select>
                  {hotspotUseFlowMissing ? (
                    <small className="field-hint error">Selected use flow no longer exists.</small>
                  ) : null}
                </label>
                <div className="field-group">
                  <span>Use item overrides</span>
                  <div className="use-item-flows">
                    {currentHotspotDraft.useItemFlows.map((entry, index) => (
                      <div
                        className={`use-item-flow-card ${
                          hotspotOverrideIssues[index]?.missingFlow ||
                          hotspotOverrideIssues[index]?.missingItem ||
                          hotspotOverrideIssues[index]?.incomplete
                            ? "invalid"
                            : ""
                        }`}
                        key={`use-item-flow-${index}`}
                      >
                        <div className="four-fields">
                          <select
                            className={
                              hotspotOverrideIssues[index]?.missingItem || hotspotOverrideIssues[index]?.incomplete
                                ? "field-input-invalid"
                                : ""
                            }
                            ref={(element) => {
                              hotspotOverrideItemRefs.current[index] = element;
                            }}
                            aria-label={`Use item ${index + 1}`}
                            value={entry.itemId}
                            onChange={(event) => {
                              const next = [...currentHotspotDraft.useItemFlows];
                              next[index] = { ...entry, itemId: event.target.value };
                              updateHotspotDraft("useItemFlows", next);
                            }}
                          >
                            <option value="">Select item</option>
                            {availableItemIds.map((itemId) => (
                              <option key={`use-item-${index}-${itemId}`} value={itemId}>
                                {itemId}
                              </option>
                            ))}
                          </select>
                          <select
                            className={
                              hotspotOverrideIssues[index]?.missingFlow || hotspotOverrideIssues[index]?.incomplete
                                ? "field-input-invalid"
                                : ""
                            }
                            ref={(element) => {
                              hotspotOverrideFlowRefs.current[index] = element;
                            }}
                            aria-label={`Use flow ${index + 1}`}
                            value={entry.flowId}
                            onChange={(event) => {
                              const next = [...currentHotspotDraft.useItemFlows];
                              next[index] = { ...entry, flowId: event.target.value };
                              updateHotspotDraft("useItemFlows", next);
                            }}
                          >
                            <option value="">Select flow</option>
                            {availableFlowIds.map((flowId) => (
                              <option key={`use-flow-${index}-${flowId}`} value={flowId}>
                                {flowId}
                              </option>
                            ))}
                          </select>
                        </div>
                        {hotspotOverrideIssues[index]?.incomplete ? (
                          <small className="field-hint error">Each override needs both an item and a flow.</small>
                        ) : hotspotOverrideIssues[index]?.missingItem ? (
                          <small className="field-hint error">Selected override item no longer exists.</small>
                        ) : hotspotOverrideIssues[index]?.missingFlow ? (
                          <small className="field-hint error">Selected override flow no longer exists.</small>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateHotspotDraft(
                        "useItemFlows",
                        [...currentHotspotDraft.useItemFlows, { itemId: "", flowId: "" }]
                      )
                    }
                  >
                    Add item override
                  </button>
                </div>
                <div className="flow-link">
                  <span>Reference guardrails</span>
                  <div className="flow-status-line">
                    <span className={`capability-badge ${hotspotGuardrail.tone}`}>{hotspotGuardrail.badge}</span>
                  </div>
                  <strong>{hotspotGuardrail.summary}</strong>
                  <p className="inspector-copy">{hotspotGuardrail.detail}</p>
                  {firstHotspotIssueTarget ? (
                    <div className="inspector-actions-inline">
                      <button type="button" onClick={focusFirstHotspotIssue}>
                        Jump to first issue
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="flow-link">
                  <span>Verb-aware hotspot</span>
                  <strong>
                    {currentHotspotDraft.useFlowId || currentHotspotDraft.lookFlowId || currentHotspotDraft.talkFlowId || "missing"}
                    {selectedScene && dirtyState.hotspotKeys.has(createHotspotKey(selectedScene.id, selectedHotspot.id))
                      ? " - unsaved draft"
                      : ""}
                  </strong>
                  <button type="button" onClick={deleteSelectedHotspot}>
                    Delete hotspot
                  </button>
                  <button type="button" onClick={applyHotspotChanges}>
                    Apply changes -&gt;
                  </button>
                </div>
              </>
            ) : selectedPickup ? (
              <>
                <label>
                  Pickup
                  <input value={selectedPickup.id} readOnly />
                </label>
                <label>
                  Item id
                  <select
                    className={pickupItemMissing ? "field-input-invalid" : ""}
                    ref={pickupItemRef}
                    value={currentPickupDraft.itemId}
                    onChange={(event) => updatePickupDraft("itemId", event.target.value)}
                  >
                    <option value="">Select item</option>
                    {availableItemIds.map((itemId) => (
                      <option key={`pickup-item-${itemId}`} value={itemId}>
                        {itemId}
                      </option>
                    ))}
                  </select>
                  {pickupItemMissing ? (
                    <small className="field-hint error">
                      {currentPickupDraft.itemId.trim().length === 0
                        ? "Pickup item is required."
                        : "Selected pickup item no longer exists."}
                    </small>
                  ) : null}
                </label>
                <label>
                  Display label
                  <input
                    className={pickupLabelMissing ? "field-input-invalid" : ""}
                    ref={pickupLabelRef}
                    value={currentPickupDraft.labelKey}
                    onChange={(event) => updatePickupDraft("labelKey", event.target.value)}
                  />
                  {pickupLabelMissing ? (
                    <small className="field-hint error">
                      {currentPickupDraft.labelKey.trim().length === 0
                        ? "Pickup label key is required."
                        : `Label key is missing in ${defaultLocaleId}.`}
                    </small>
                  ) : null}
                </label>
                <label>
                  Pickup flow
                  <select
                    className={pickupFlowMissing ? "field-input-invalid" : ""}
                    ref={pickupFlowRef}
                    value={currentPickupDraft.pickupFlowId}
                    onChange={(event) => updatePickupDraft("pickupFlowId", event.target.value)}
                  >
                    <option value="">None</option>
                    {availableFlowIds.map((flowId) => (
                      <option key={`pickup-flow-${flowId}`} value={flowId}>
                        {flowId}
                      </option>
                    ))}
                  </select>
                  {pickupFlowMissing ? (
                    <small className="field-hint error">Selected pickup flow no longer exists.</small>
                  ) : null}
                </label>
                <div className="field-group">
                  <span>Bounds</span>
                  <div className="four-fields">
                    <input
                      aria-label="Pickup X"
                      value={currentPickupDraft.x}
                      onChange={(event) => updatePickupDraft("x", event.target.value)}
                    />
                    <input
                      aria-label="Pickup Y"
                      value={currentPickupDraft.y}
                      onChange={(event) => updatePickupDraft("y", event.target.value)}
                    />
                    <input
                      aria-label="Pickup Width"
                      value={currentPickupDraft.width}
                      onChange={(event) => updatePickupDraft("width", event.target.value)}
                    />
                    <input
                      aria-label="Pickup Height"
                      value={currentPickupDraft.height}
                      onChange={(event) => updatePickupDraft("height", event.target.value)}
                    />
                  </div>
                </div>
                <div className="flow-link">
                  <span>Reference guardrails</span>
                  <div className="flow-status-line">
                    <span className={`capability-badge ${pickupGuardrail.tone}`}>{pickupGuardrail.badge}</span>
                  </div>
                  <strong>{pickupGuardrail.summary}</strong>
                  <p className="inspector-copy">{pickupGuardrail.detail}</p>
                  {firstPickupIssueTarget ? (
                    <div className="inspector-actions-inline">
                      <button type="button" onClick={focusFirstPickupIssue}>
                        Jump to first issue
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="flow-link">
                  <span>Scene pickup</span>
                  <strong>
                    {currentPickupDraft.itemId || "unbound item"}
                    {selectedScene &&
                    dirtyState.pickupKeys.has(createPickupKey(selectedScene.id, selectedPickup.id))
                      ? " - unsaved draft"
                      : ""}
                  </strong>
                  <button type="button" onClick={deleteSelectedPickup}>
                    Delete pickup
                  </button>
                  <button type="button" onClick={applyPickupChanges}>
                    Apply changes -&gt;
                  </button>
                </div>
              </>
            ) : selectedItem ? (
              <>
                <label>
                  Item
                  <input value={selectedItem.id} readOnly />
                </label>
                <label>
                  Name
                  <input
                    value={currentItemDraft.name}
                    onChange={(event) => updateItemDraft("name", event.target.value)}
                  />
                </label>
                <label>
                  Label key
                  <input
                    value={currentItemDraft.labelKey}
                    onChange={(event) => updateItemDraft("labelKey", event.target.value)}
                  />
                </label>
                <div className="flow-link">
                  <span>Locale coverage</span>
                  <div className="flow-status-line">
                    <span className={`capability-badge ${itemGuardrail.tone}`}>{itemGuardrail.badge}</span>
                  </div>
                  <strong>{itemGuardrail.summary}</strong>
                  <p className="inspector-copy">{itemGuardrail.detail}</p>
                </div>
                <div className="flow-link">
                  <span>Inventory item</span>
                  <strong>
                    {currentItemDraft.name || "unnamed item"}
                    {dirtyState.itemIds.has(selectedItem.id) ? " - unsaved draft" : ""}
                  </strong>
                  <button type="button" onClick={deleteSelectedItem}>
                    Delete item
                  </button>
                  <button type="button" onClick={applyItemChanges}>
                    Apply changes -&gt;
                  </button>
                </div>
              </>
            ) : selectedScene ? (
              <>
                <label>
                  Scene
                  <input value={selectedScene.id} readOnly />
                </label>
                <label>
                  Name
                  <input
                    value={currentSceneDraft.name}
                    onChange={(event) => updateSceneDraft("name", event.target.value)}
                  />
                </label>
                <label>
                  Background
                  <input
                    value={currentSceneDraft.background}
                    onChange={(event) => updateSceneDraft("background", event.target.value)}
                  />
                </label>
                <p className="inspector-copy">
                  Use `#RRGGBB` for color backgrounds or a registered asset path such as
                  `assets/imported/example.png`.
                </p>
                <div className="field-group">
                  <span>Player start</span>
                  <div className="four-fields">
                    <input
                      aria-label="Player start X"
                      value={currentSceneDraft.playerStartX}
                      onChange={(event) => updateSceneDraft("playerStartX", event.target.value)}
                    />
                    <input
                      aria-label="Player start Y"
                      value={currentSceneDraft.playerStartY}
                      onChange={(event) => updateSceneDraft("playerStartY", event.target.value)}
                    />
                  </div>
                </div>
                <div className="field-group">
                  <span>Walk area</span>
                  <p className="inspector-copy">
                    Drag points in the viewport to reshape the polygon. Click an edge to insert a
                    point, or Shift-click a point to remove it.
                  </p>
                  <div className="walk-points">
                    {currentSceneDraft.walkAreaPoints.map((point, index) => (
                      <div className="walk-point-card" key={`walk-point-editor-${index}`}>
                        <strong>Point {index + 1}</strong>
                        <div className="four-fields">
                          <input
                            aria-label={`Walk area point ${index + 1} X`}
                            value={point.x}
                            onChange={(event) => updateWalkAreaPoint(index, "x", event.target.value)}
                          />
                          <input
                            aria-label={`Walk area point ${index + 1} Y`}
                            value={point.y}
                            onChange={(event) => updateWalkAreaPoint(index, "y", event.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          disabled={currentSceneDraft.walkAreaPoints.length <= 3}
                          onClick={() => removeWalkAreaPoint(index)}
                        >
                          Remove point
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addWalkAreaPoint}>
                    Add point
                  </button>
                </div>
                <div className="flow-link">
                  <span>Layered 2D scene</span>
                  <strong>
                    {selectedScene.name}
                    {dirtyState.sceneIds.has(selectedScene.id) ? " - unsaved draft" : ""}
                  </strong>
                  <button type="button" onClick={deleteSelectedScene}>
                    Delete scene
                  </button>
                  <button type="button" onClick={applySceneChanges}>
                    Apply changes -&gt;
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-inspector">No project loaded.</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
