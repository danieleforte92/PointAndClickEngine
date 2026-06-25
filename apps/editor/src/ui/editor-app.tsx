import type {
  AssetDocument,
  CursorValue,
  FlowDocument,
  Hotspot,
  ItemDocument,
  Layered2DScene,
  LocaleDocument,
  PromptPackDocument,
  PromptPackGenerationTarget,
  Rect,
  SceneActor,
  SceneActorRole,
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
  buildActorFromDraft,
  buildHotspotFromDraft,
  buildFlowNodes,
  buildRecoverySnapshot,
  clampScenePoint,
  cloneSessionState,
  commitHistory,
  createActorDraft,
  createActorKey,
  createFlowDraft,
  createHistoryState,
  createHotspotDraft,
  createItemDraft,
  createNewFlowNode,
  createPickupDraft,
  createSceneDraft,
  createScenePlayerConfig,
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
import {
  buildPromptPackContext,
  promptProviderDescriptors,
  type PromptProviderId,
  type PromptProviderJob
} from "../prompt-pack-studio";
import {
  buildGuidedArtBrief,
  comfyOutputPresetById,
  comfyOutputPresets,
  defaultPromptPresetSelection,
  gameplayEmphasisPresets,
  moodPresets,
  palettePresets,
  sceneDirectionPresetById,
  sceneDirectionPresets,
  settingPresets,
  visualStylePresets
} from "../prompt-pack-presets";
import type { EditorProjectSnapshot } from "../preload";
import type { EditorValidationReport, EditorValidationRunState } from "../validation-report";
import { createValidationReport } from "../validation-report";

const emptyHistory = createHistoryState(
  initializeEditorSession({
    activeActorId: null,
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
const defaultSceneDirectionPreset =
  sceneDirectionPresetById(defaultPromptPresetSelection.sceneDirectionPreset) ?? sceneDirectionPresets[0]!;

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

function sceneBackgroundStyle(background: string, assetUrl?: string) {
  if (isHexColor(background)) {
    return { backgroundColor: background, backgroundImage: "none" };
  }
  return {
    backgroundColor: "#24384a",
    backgroundImage: assetUrl ? `url("${assetUrl}")` : "none",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "100% 100%"
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

  return {
    actors: [],
    background: "#24384a",
    hotspots: [],
    id: sceneId,
    name: "New Scene",
    player: {
      scaleFar: 0.62,
      scaleNear: 1.08,
      walkSpeed: 320
    },
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
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: height },
        { x: 0, y: height }
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

function nextActorId(scene: Layered2DScene): string {
  const existing = new Set(scene.actors.map((actor) => actor.id));
  let counter = 0;
  let candidate = "new-actor";
  while (existing.has(candidate)) {
    counter += 1;
    candidate = `new-actor-${counter}`;
  }
  return candidate;
}

function createDefaultHotspot(scene: Layered2DScene, hotspotId: string): Hotspot {
  const width = Math.max(80, Math.floor(scene.size.width * 0.12));
  const height = Math.max(80, Math.floor(scene.size.height * 0.14));
  const x = Math.floor(scene.size.width / 2 - width / 2);
  const y = Math.floor(scene.size.height * 0.45 - height / 2);
  return {
    actions: {
      useItemFlows: []
    },
    bounds: {
      x,
      y,
      width,
      height
    },
    cursor: "look",
    id: hotspotId,
    interactSpot: {
      x: Math.floor(x + width / 2),
      y: Math.floor(y + height + 24)
    },
    labelKey: `hotspot.${hotspotId}`,
    lookSpot: {
      x: Math.floor(x + width / 2),
      y: Math.floor(y)
    }
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

function createDefaultActor(scene: Layered2DScene, actorId: string): SceneActor {
  const width = Math.max(72, Math.floor(scene.size.width * 0.08));
  const height = Math.max(56, Math.floor(scene.size.height * 0.08));
  const x = Math.floor(scene.size.width / 2 - width / 2);
  const y = Math.floor(scene.size.height * 0.55 - height / 2);
  return {
    actions: {
      useItemFlows: []
    },
    bounds: { x, y, width, height },
    depth: 8,
    id: actorId,
    interactSpot: {
      x: Math.floor(x + width / 2),
      y: Math.floor(y + height + 24)
    },
    labelKey: `actor.${actorId}`,
    role: "prop"
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
  scene: Layered2DScene,
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

  if (!scenePointIsInside(hotspot.interactSpot, scene.size)) {
    blockingIssues.push("Interact spot is outside the scene.");
  }
  if (!scenePointIsInside(hotspot.lookSpot, scene.size)) {
    blockingIssues.push("Look spot is outside the scene.");
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

function scenePointIsInside(
  point: ScenePointDraftValue | undefined,
  size: { height: number; width: number }
): boolean {
  if (!point) return true;
  return point.x >= 0 && point.x <= size.width && point.y >= 0 && point.y <= size.height;
}

function summarizeActorViewportIssues(
  actor: SceneActor,
  scene: Layered2DScene,
  availableAssetIdsSet: Set<string>,
  availableAnimationPackIdsSet: Set<string>,
  availableFlowIdsSet: Set<string>,
  availableItemIdsSet: Set<string>,
  defaultLocaleId: string,
  defaultLocaleStrings: LocaleDocument["strings"] | null
) {
  const blockingIssues: string[] = [];
  const warningIssues: string[] = [];
  const labelKey = actor.labelKey.trim();

  if (actor.assetId && !availableAssetIdsSet.has(actor.assetId)) {
    blockingIssues.push(`Actor asset "${actor.assetId}" no longer exists.`);
  }

  if (actor.animationPackId && !availableAnimationPackIdsSet.has(actor.animationPackId)) {
    blockingIssues.push(`Actor animation pack "${actor.animationPackId}" no longer exists.`);
  }

  if (!labelKey) {
    blockingIssues.push("Actor label key is required.");
  } else if (!defaultLocaleStrings) {
    warningIssues.push(`Default locale "${defaultLocaleId}" is unavailable.`);
  } else if (!(labelKey in defaultLocaleStrings)) {
    warningIssues.push(`Label key "${labelKey}" is missing in ${defaultLocaleId}.`);
  }

  for (const [verb, flowId] of [
    ["Look", actor.actions.lookFlowId?.trim() ?? ""],
    ["Talk", actor.actions.talkFlowId?.trim() ?? ""],
    ["Use", actor.actions.useFlowId?.trim() ?? ""]
  ] as const) {
    if (flowId && !availableFlowIdsSet.has(flowId)) {
      blockingIssues.push(`${verb} flow "${flowId}" no longer exists.`);
    }
  }

  if (!actor.actions.lookFlowId && !actor.actions.talkFlowId && !actor.actions.useFlowId && actor.actions.useItemFlows.length === 0) {
    warningIssues.push("Actor has no action flow yet.");
  }

  actor.actions.useItemFlows.forEach((entry, index) => {
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

  if (!scenePointIsInside(actor.interactSpot, scene.size)) {
    blockingIssues.push("Interact spot is outside the scene.");
  }
  if (!scenePointIsInside(actor.lookSpot, scene.size)) {
    blockingIssues.push("Look spot is outside the scene.");
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
      kind: "actor" | "hotspot" | "pickup";
      mode: "move" | "resize";
      startPoint: ScenePointDraftValue;
      startRect: SceneRectDraftValue;
    }
  | {
      baseSession: EditorSessionState;
      kind: "actor-interact-spot" | "actor-look-spot" | "hotspot-interact-spot" | "hotspot-look-spot";
      startPoint: ScenePointDraftValue;
      startPosition: ScenePointDraftValue;
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

type SceneTool = "select" | "actor" | "hotspot" | "pickup" | "player-start" | "walk-area";

function sceneToolFromCapability(capabilityId: string): SceneTool | null {
  switch (capabilityId) {
    case "tool-select":
      return "select";
    case "tool-hotspot":
      return "hotspot";
    case "tool-actor":
      return "actor";
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
    case "actor":
      return "Actors";
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
      return "Click actors, hotspots, and pickups to inspect them without moving scene geometry.";
    case "hotspot":
      return "Drag the selected hotspot to move it, or use the lower-right handle to resize it.";
    case "actor":
      return "Drag the selected actor to move it, or use the lower-right handle to resize it.";
    case "pickup":
      return "Drag the selected pickup to move it, or use the lower-right handle to resize it.";
    case "player-start":
      return "Drag the character marker to choose the player start position.";
    case "walk-area":
      return "Drag walk points, click an edge to insert a point, or Shift-click a point to remove it.";
  }
}

function focusEditorField(element: HTMLInputElement | HTMLSelectElement | null) {
  if (!element) return;
  element.focus();
  element.scrollIntoView({ behavior: "smooth", block: "center" });
}

function promptForGenerationTarget(promptPack: PromptPackDocument, target: PromptPackGenerationTarget) {
  if (target.intendedUse === "scene-background") {
    return promptPack.outputs.sceneBackgroundPrompt;
  }

  if (target.intendedUse === "character-reference" || target.intendedUse === "animation-reference") {
    return (
      promptPack.outputs.characterReferencePrompts.find((prompt) => prompt.id === target.id)?.prompt ??
      promptPack.outputs.characterReferencePrompts.find((prompt) => target.id.startsWith(prompt.id))?.prompt ??
      promptPack.outputs.sceneBackgroundPrompt
    );
  }

  return (
    promptPack.outputs.propPrompts.find((prompt) => prompt.id === target.id)?.prompt ??
    promptPack.outputs.sceneBackgroundPrompt
  );
}

function dimensionsForGenerationTarget(target: PromptPackGenerationTarget) {
  const fallback = target.intendedUse === "scene-background" ? 1024 : 512;
  return {
    height: Math.max(64, Math.min(2048, target.height ?? fallback)),
    width: Math.max(64, Math.min(2048, target.width ?? fallback))
  };
}

function textList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string").join(" ")
    : typeof value === "string"
      ? value
      : "";
}

export function EditorApp() {
  const [workspace, setWorkspace] = useState<Workspace>("overview");
  const [status, setStatus] = useState("Loading project...");
  const [project, setProject] = useState<EditorProjectSnapshot | null>(null);
  const [history, setHistory] = useState<EditorHistoryState>(emptyHistory);
  const [pendingRecovery, setPendingRecovery] = useState<EditorRecoverySnapshot | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [assetPreviewUrls, setAssetPreviewUrls] = useState<Record<string, string>>({});
  const [assetPathDraft, setAssetPathDraft] = useState("");
  const [promptPackSceneId, setPromptPackSceneId] = useState("");
  const [sceneDirectionPresetId, setSceneDirectionPresetId] = useState(defaultSceneDirectionPreset.id);
  const [promptPackBrief, setPromptPackBrief] = useState(defaultSceneDirectionPreset.artBrief);
  const [promptPackJob, setPromptPackJob] = useState<PromptProviderJob | null>(null);
  const [promptPackGenerationState, setPromptPackGenerationState] = useState<"idle" | "running">("idle");
  const [promptProviderId, setPromptProviderId] = useState<PromptProviderId>("mock");
  const [openAiApiKey, setOpenAiApiKey] = useState("");
  const [openAiBaseUrl, setOpenAiBaseUrl] = useState("https://api.openai.com/v1");
  const [openAiModel, setOpenAiModel] = useState(
    promptProviderDescriptors.find((provider) => provider.id === "openai")?.defaultModel ?? "gpt-5.2"
  );
  const [lmStudioApiKey, setLmStudioApiKey] = useState("");
  const [lmStudioBaseUrl, setLmStudioBaseUrl] = useState("http://localhost:1234/v1");
  const [lmStudioModel, setLmStudioModel] = useState(
    promptProviderDescriptors.find((provider) => provider.id === "lmstudio")?.defaultModel ?? "local-model"
  );
  const [visualStylePresetId, setVisualStylePresetId] = useState(defaultPromptPresetSelection.visualStylePreset);
  const [moodPresetId, setMoodPresetId] = useState(defaultPromptPresetSelection.moodPreset);
  const [settingPresetId, setSettingPresetId] = useState(defaultPromptPresetSelection.settingPreset);
  const [palettePresetId, setPalettePresetId] = useState(defaultPromptPresetSelection.palettePreset);
  const [gameplayEmphasisPresetIds, setGameplayEmphasisPresetIds] = useState<string[]>(
    defaultPromptPresetSelection.gameplayEmphasisPresets
  );
  const [guidedSceneMood, setGuidedSceneMood] = useState("");
  const [guidedSceneSetting, setGuidedSceneSetting] = useState("");
  const [guidedSceneStyle, setGuidedSceneStyle] = useState("");
  const [guidedScenePalette, setGuidedScenePalette] = useState("");
  const [guidedSceneGameplayFocus, setGuidedSceneGameplayFocus] = useState("");
  const [comfyUiBaseUrl, setComfyUiBaseUrl] = useState("http://127.0.0.1:8188");
  const [comfyUiCheckpoint, setComfyUiCheckpoint] = useState("");
  const [comfyUiWorkflowPath, setComfyUiWorkflowPath] = useState("");
  const [comfyUiSeed, setComfyUiSeed] = useState("");
  const [comfyUiOutputPresetId, setComfyUiOutputPresetId] = useState(defaultPromptPresetSelection.comfyOutputPreset);
  const [comfyUiTimeoutMinutes, setComfyUiTimeoutMinutes] = useState(
    String(comfyOutputPresetById(defaultPromptPresetSelection.comfyOutputPreset).timeoutMinutes)
  );
  const [comfyUiGenerationStatus, setComfyUiGenerationStatus] = useState(
    "ComfyUI generation has not been queued yet."
  );
  const [selectedGenerationTargetId, setSelectedGenerationTargetId] = useState("");
  const [imageGenerationState, setImageGenerationState] = useState<"idle" | "running">("idle");
  const [selectedPromptPackId, setSelectedPromptPackId] = useState<string | null>(null);
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
  const actorLabelInputRef = useRef<HTMLInputElement | null>(null);
  const actorAssetRef = useRef<HTMLSelectElement | null>(null);
  const actorLookFlowRef = useRef<HTMLSelectElement | null>(null);
  const actorTalkFlowRef = useRef<HTMLSelectElement | null>(null);
  const actorUseFlowRef = useRef<HTMLSelectElement | null>(null);
  const pickupItemRef = useRef<HTMLSelectElement | null>(null);
  const pickupLabelRef = useRef<HTMLInputElement | null>(null);
  const pickupFlowRef = useRef<HTMLSelectElement | null>(null);

  const session = history.present;
  const scenes = project ? sceneItems(project.scenes) : [];
  const selectedScene =
    sceneFromSnapshot(project, session.activeSceneId) ?? project?.selectedScene ?? scenes[0] ?? null;
  const selectedHotspot =
    hotspotFromSnapshot(project, session.activeSceneId, session.activeHotspotId) ?? null;
  const selectedActor =
    project && session.activeSceneId && session.activeActorId
      ? sceneFromSnapshot(project, session.activeSceneId)?.actors.find((actor) => actor.id === session.activeActorId) ?? null
      : null;
  const selectedLocale = localeFromSnapshot(project, session.activeLocale) ?? null;
  const selectedFlow = flowFromSnapshot(project, session.activeFlowId) ?? null;
  const selectedItem = itemFromSnapshot(project, session.activeItemId) ?? project?.selectedItem ?? null;
  const selectedPickup =
    pickupFromSnapshot(project, session.activeSceneId, session.activePickupId) ?? null;
  const selectedAsset =
    assetFromSnapshot(project, selectedAssetId) ?? project?.selectedAsset ?? project?.assets[0] ?? null;
  const layeredScenes = scenes.filter((scene): scene is Layered2DScene => scene.type === "layered-2d");
  const promptPackScene =
    layeredScenes.find((scene) => scene.id === promptPackSceneId) ??
    (selectedScene?.type === "layered-2d" ? selectedScene : null) ??
    layeredScenes[0] ??
    null;
  const selectedPromptPack =
    project?.promptPacks.find((promptPack) => promptPack.id === selectedPromptPackId) ??
    project?.promptPacks[0] ??
    null;
  const promptPackCandidate = promptPackJob?.candidates[0] ?? null;
  const activeImagePromptPack = promptPackCandidate?.promptPack ?? selectedPromptPack;
  const selectedPromptProvider =
    promptProviderDescriptors.find((provider) => provider.id === promptProviderId) ?? promptProviderDescriptors[0]!;

  const currentSceneDraft = selectedScene
    ? session.sceneDrafts[selectedScene.id] ?? createSceneDraft(selectedScene)
    : createSceneDraft(null);
  const currentHotspotDraft = selectedHotspot
    ? session.hotspotDrafts[createHotspotKey(selectedScene?.id ?? "", selectedHotspot.id)] ??
      createHotspotDraft(selectedHotspot)
    : createHotspotDraft(null);
  const currentActorDraft =
    selectedScene && selectedActor
      ? session.actorDrafts[createActorKey(selectedScene.id, selectedActor.id)] ??
        createActorDraft(selectedActor)
      : createActorDraft(null);
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
  const imageAssets = useMemo(
    () => (project ? project.assets.filter((asset) => asset.kind === "image") : []),
    [project]
  );
  const dirtyState = useMemo(
    () =>
      project
        ? getDirtyState(project, session)
        : {
            actorKeys: new Set<string>(),
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
  const localeLabel = project?.manifest.defaultLocale ?? "n/a";
  const draftSceneWidth = parsePositiveNumber(currentSceneDraft.width);
  const draftSceneHeight = parsePositiveNumber(currentSceneDraft.height);
  const previewSceneSize = useMemo(
    () =>
      selectedScene
        ? {
            width: draftSceneWidth ?? selectedScene.size.width,
            height: draftSceneHeight ?? selectedScene.size.height
          }
        : { width: 1280, height: 720 },
    [draftSceneHeight, draftSceneWidth, selectedScene]
  );
  const sceneLabel = selectedScene
    ? `${previewSceneSize.width} x ${previewSceneSize.height}`
    : "No scene";
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
    return clampScenePoint({ x, y }, previewSceneSize);
  }, [
    currentSceneDraft.playerStartX,
    currentSceneDraft.playerStartY,
    previewSceneSize,
    selectedScene
  ]);
  const previewHotspots = useMemo(() => {
    if (!selectedScene || !selectedHotspot) {
      return selectedScene?.hotspots ?? [];
    }

    return selectedScene.hotspots.map((hotspot) =>
      hotspot.id === selectedHotspot.id ? buildHotspotFromDraft(hotspot, currentHotspotDraft) : hotspot
    );
  }, [currentHotspotDraft, selectedHotspot, selectedScene]);
  const previewSelectedHotspot =
    selectedHotspot ? previewHotspots.find((hotspot) => hotspot.id === selectedHotspot.id) ?? selectedHotspot : null;
  const previewActors = useMemo(() => {
    if (!selectedScene || !selectedActor) {
      return selectedScene?.actors ?? [];
    }

    return selectedScene.actors.map((actor) =>
      actor.id === selectedActor.id ? buildActorFromDraft(actor, currentActorDraft) : actor
    );
  }, [currentActorDraft, selectedActor, selectedScene]);
  const previewSelectedActor =
    selectedActor ? previewActors.find((actor) => actor.id === selectedActor.id) ?? selectedActor : null;
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
      previewSceneSize
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
  }, [currentPickupDraft, previewSceneSize, selectedPickup, selectedScene]);
  const workspaceCapability = workspaceCapabilities.find((item) => item.workspace === workspace) ?? workspaceCapabilities[0]!;
  const previewRequest = project
    ? {
        bundle: buildDraftProjectBundle(project, history.present),
        sceneId: selectedScene?.id ?? project.activeSceneId
      }
    : undefined;
  const guidedPromptPackBrief = useMemo(
    () =>
      buildGuidedArtBrief(promptPackBrief, {
        customGameplayFocus: guidedSceneGameplayFocus,
        customMood: guidedSceneMood,
        customPalette: guidedScenePalette,
        customSetting: guidedSceneSetting,
        customStyle: guidedSceneStyle,
        gameplayEmphasisPresetIds,
        moodPresetId,
        palettePresetId,
        settingPresetId,
        visualStylePresetId
      }),
    [
      gameplayEmphasisPresetIds,
      guidedSceneGameplayFocus,
      guidedSceneMood,
      guidedScenePalette,
      guidedSceneSetting,
      guidedSceneStyle,
      moodPresetId,
      palettePresetId,
      settingPresetId,
      visualStylePresetId,
      promptPackBrief
    ]
  );
  const promptPackContext = useMemo(() => {
    if (!project || !promptPackScene) return null;
    try {
      return buildPromptPackContext(
        buildDraftProjectBundle(project, history.present),
        promptPackScene.id,
        guidedPromptPackBrief
      );
    } catch {
      return null;
    }
  }, [guidedPromptPackBrief, history.present, project, promptPackScene?.id]);
  const imageGenerationTargets = activeImagePromptPack?.outputs.generationTargets ?? [];
  const selectedGenerationTarget =
    imageGenerationTargets.find((target) => target.id === selectedGenerationTargetId) ??
    imageGenerationTargets[0] ??
    null;
  const selectedComfyOutputPreset = comfyOutputPresetById(comfyUiOutputPresetId);
  const selectedGenerationPrompt =
    activeImagePromptPack && selectedGenerationTarget
      ? promptForGenerationTarget(activeImagePromptPack, selectedGenerationTarget)
      : "";
  const targetGenerationDimensions = selectedGenerationTarget
    ? dimensionsForGenerationTarget(selectedGenerationTarget)
    : { height: 512, width: 512 };
  const selectedGenerationDimensions =
    selectedComfyOutputPreset.id === "target_default"
      ? targetGenerationDimensions
      : { height: selectedComfyOutputPreset.height, width: selectedComfyOutputPreset.width };
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
  const previewSceneBackground = selectedScene
    ? currentSceneDraft.background.trim() || selectedScene.background
    : "";
  const previewSceneColor = isHexColor(previewSceneBackground) ? previewSceneBackground : "#24384a";
  const previewSceneBackgroundUrl = isHexColor(previewSceneBackground)
    ? undefined
    : assetPreviewUrls[previewSceneBackground];
  const assetPathById = useMemo(
    () => new Map((project?.assets ?? []).map((asset) => [asset.id, asset.path])),
    [project]
  );
  const previewPlayerConfig = useMemo(() => {
    const defaults = createScenePlayerConfig(selectedScene?.player);
    const scaleFar = parsePositiveNumber(currentSceneDraft.playerScaleFar);
    const scaleNear = parsePositiveNumber(currentSceneDraft.playerScaleNear);
    const walkSpeed = parsePositiveNumber(currentSceneDraft.playerWalkSpeed);
    return {
      ...(currentSceneDraft.playerAnimationPackId.trim()
        ? { animationPackId: currentSceneDraft.playerAnimationPackId.trim() }
        : {}),
      ...(currentSceneDraft.playerAssetId.trim()
        ? { assetId: currentSceneDraft.playerAssetId.trim() }
        : {}),
      scaleFar: scaleFar ?? defaults.scaleFar,
      scaleNear: scaleNear ?? defaults.scaleNear,
      walkSpeed: walkSpeed ?? defaults.walkSpeed
    };
  }, [
    currentSceneDraft.playerAnimationPackId,
    currentSceneDraft.playerAssetId,
    currentSceneDraft.playerScaleFar,
    currentSceneDraft.playerScaleNear,
    currentSceneDraft.playerWalkSpeed,
    selectedScene?.player
  ]);
  const previewPlayerAssetPath = previewPlayerConfig.assetId
    ? assetPathById.get(previewPlayerConfig.assetId)
    : undefined;
  const previewPlayerAssetUrl = previewPlayerAssetPath
    ? assetPreviewUrls[previewPlayerAssetPath]
    : undefined;
  const previewAssetPaths = useMemo(() => {
    const paths = new Set<string>();
    if (previewSceneBackground && !isHexColor(previewSceneBackground)) {
      paths.add(previewSceneBackground);
    }
    if (previewPlayerAssetPath) {
      paths.add(previewPlayerAssetPath);
    }
    for (const actor of previewActors) {
      const assetPath = actor.assetId ? assetPathById.get(actor.assetId) : null;
      if (assetPath) paths.add(assetPath);
    }
    return [...paths];
  }, [assetPathById, previewActors, previewPlayerAssetPath, previewSceneBackground]);

  useEffect(() => {
    if (imageGenerationTargets.length === 0) {
      if (selectedGenerationTargetId) setSelectedGenerationTargetId("");
      return;
    }

    if (!imageGenerationTargets.some((target) => target.id === selectedGenerationTargetId)) {
      setSelectedGenerationTargetId(imageGenerationTargets[0]?.id ?? "");
    }
  }, [imageGenerationTargets, selectedGenerationTargetId]);

  useEffect(() => {
    if (!project) return;
    const missingAssetPath = previewAssetPaths.find((assetPath) => !assetPreviewUrls[assetPath]);
    if (!missingAssetPath) return;

    let cancelled = false;
    window.pointClick
      .resolveAssetUrl(missingAssetPath)
      .then((url) => {
        if (cancelled) return;
        setAssetPreviewUrls((current) =>
          current[missingAssetPath]
            ? current
            : { ...current, [missingAssetPath]: url }
        );
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus(error instanceof Error ? error.message : "Asset could not be previewed");
      });

    return () => {
      cancelled = true;
    };
  }, [assetPreviewUrls, previewAssetPaths, project]);

  const defaultLocaleDocument = useMemo(
    () =>
      project?.locales.find((locale) => locale.locale === project.manifest.defaultLocale) ?? null,
    [project]
  );
  const defaultLocaleId = defaultLocaleDocument?.locale ?? project?.manifest.defaultLocale ?? "default locale";
  const defaultLocaleStrings = defaultLocaleDocument?.strings ?? null;
  const availableAssetIds = useMemo(() => (project ? project.assets.map((asset) => asset.id) : []), [project]);
  const availableAssetIdsSet = useMemo(() => new Set(availableAssetIds), [availableAssetIds]);
  const availableAnimationPackIds = useMemo(
    () => (project ? project.animationPacks.map((animationPack) => animationPack.id) : []),
    [project]
  );
  const availableAnimationPackIdsSet = useMemo(
    () => new Set(availableAnimationPackIds),
    [availableAnimationPackIds]
  );
  const availableFlowIdsSet = useMemo(() => new Set(availableFlowIds), [availableFlowIds]);
  const availableItemIdsSet = useMemo(() => new Set(availableItemIds), [availableItemIds]);
  const previewActorIssueMap = useMemo(
    () =>
      selectedScene
        ? Object.fromEntries(
            previewActors.map((actor) => [
              actor.id,
              summarizeActorViewportIssues(
                actor,
                selectedScene,
                availableAssetIdsSet,
                availableAnimationPackIdsSet,
                availableFlowIdsSet,
                availableItemIdsSet,
                defaultLocaleId,
                defaultLocaleStrings
              )
            ])
          )
        : {},
    [
      availableAssetIdsSet,
      availableAnimationPackIdsSet,
      availableFlowIdsSet,
      availableItemIdsSet,
      defaultLocaleId,
      defaultLocaleStrings,
      previewActors,
      selectedScene
    ]
  );
  const previewHotspotIssueMap = useMemo(
    () =>
      selectedScene
        ? Object.fromEntries(
            previewHotspots.map((hotspot) => [
              hotspot.id,
              summarizeHotspotViewportIssues(
                hotspot,
                selectedScene,
                availableFlowIdsSet,
                availableItemIdsSet,
                defaultLocaleId,
                defaultLocaleStrings
              )
            ])
          )
        : {},
    [
      availableFlowIdsSet,
      availableItemIdsSet,
      defaultLocaleId,
      defaultLocaleStrings,
      previewHotspots,
      selectedScene
    ]
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
    for (const node of currentFlowDraft.nodes) {
      if (node.type === "change-scene" && !sceneItems(project?.scenes ?? []).some((scene) => scene.id === node.targetSceneId.trim())) {
        warningIssues.push(`Node "${node.id}" changes to a scene that is not available.`);
      }
    }

    return buildGuardrail(
      [],
      warningIssues,
      "Locale coverage looks good",
      `All line text keys exist in ${defaultLocaleId}.`
    );
  }, [currentFlowDraft, defaultLocaleId, defaultLocaleStrings, project?.scenes]);
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

    const interactSpot =
      currentHotspotDraft.interactSpotEnabled &&
      parseNumber(currentHotspotDraft.interactSpotX) !== null &&
      parseNumber(currentHotspotDraft.interactSpotY) !== null
        ? {
            x: parseNumber(currentHotspotDraft.interactSpotX)!,
            y: parseNumber(currentHotspotDraft.interactSpotY)!
          }
        : undefined;
    const lookSpot =
      currentHotspotDraft.lookSpotEnabled &&
      parseNumber(currentHotspotDraft.lookSpotX) !== null &&
      parseNumber(currentHotspotDraft.lookSpotY) !== null
        ? {
            x: parseNumber(currentHotspotDraft.lookSpotX)!,
            y: parseNumber(currentHotspotDraft.lookSpotY)!
          }
        : undefined;

    if (currentHotspotDraft.interactSpotEnabled && !interactSpot) {
      blockingIssues.push("Interact spot must use valid X/Y numbers.");
    } else if (selectedScene && !scenePointIsInside(interactSpot, previewSceneSize)) {
      blockingIssues.push("Interact spot is outside the scene.");
    }
    if (currentHotspotDraft.lookSpotEnabled && !lookSpot) {
      blockingIssues.push("Look spot must use valid X/Y numbers.");
    } else if (selectedScene && !scenePointIsInside(lookSpot, previewSceneSize)) {
      blockingIssues.push("Look spot is outside the scene.");
    }

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
    currentHotspotDraft.interactSpotEnabled,
    currentHotspotDraft.interactSpotX,
    currentHotspotDraft.interactSpotY,
    currentHotspotDraft.lookFlowId,
    currentHotspotDraft.lookSpotEnabled,
    currentHotspotDraft.lookSpotX,
    currentHotspotDraft.lookSpotY,
    currentHotspotDraft.talkFlowId,
    currentHotspotDraft.useFlowId,
    currentHotspotDraft.useItemFlows,
    defaultLocaleId,
    defaultLocaleStrings,
    selectedScene
  ]);
  const actorGuardrail = useMemo(() => {
    const blockingIssues: string[] = [];
    const warningIssues: string[] = [];
    const labelKey = currentActorDraft.labelKey.trim();
    const assetId = currentActorDraft.assetId.trim();
    const animationPackId = currentActorDraft.animationPackId.trim();

    if (assetId && !availableAssetIdsSet.has(assetId)) {
      blockingIssues.push(`Actor asset "${assetId}" no longer exists.`);
    }
    if (animationPackId && !availableAnimationPackIdsSet.has(animationPackId)) {
      blockingIssues.push(`Actor animation pack "${animationPackId}" no longer exists.`);
    }

    if (!labelKey) {
      blockingIssues.push("Actor label key is required.");
    } else if (!defaultLocaleStrings) {
      warningIssues.push(`Default locale "${defaultLocaleId}" is unavailable.`);
    } else if (!(labelKey in defaultLocaleStrings)) {
      warningIssues.push(`Label key "${labelKey}" is missing in ${defaultLocaleId}.`);
    }

    for (const [verb, flowId] of [
      ["Look", currentActorDraft.lookFlowId.trim()],
      ["Talk", currentActorDraft.talkFlowId.trim()],
      ["Use", currentActorDraft.useFlowId.trim()]
    ] as const) {
      if (flowId && !availableFlowIdsSet.has(flowId)) {
        blockingIssues.push(`${verb} flow "${flowId}" no longer exists.`);
      }
    }

    currentActorDraft.useItemFlows.forEach((entry, index) => {
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

    const interactSpot =
      currentActorDraft.interactSpotEnabled &&
      parseNumber(currentActorDraft.interactSpotX) !== null &&
      parseNumber(currentActorDraft.interactSpotY) !== null
        ? {
            x: parseNumber(currentActorDraft.interactSpotX)!,
            y: parseNumber(currentActorDraft.interactSpotY)!
          }
        : undefined;
    const lookSpot =
      currentActorDraft.lookSpotEnabled &&
      parseNumber(currentActorDraft.lookSpotX) !== null &&
      parseNumber(currentActorDraft.lookSpotY) !== null
        ? {
            x: parseNumber(currentActorDraft.lookSpotX)!,
            y: parseNumber(currentActorDraft.lookSpotY)!
          }
        : undefined;

    if (currentActorDraft.interactSpotEnabled && !interactSpot) {
      blockingIssues.push("Interact spot must use valid X/Y numbers.");
    } else if (selectedScene && !scenePointIsInside(interactSpot, previewSceneSize)) {
      blockingIssues.push("Interact spot is outside the scene.");
    }
    if (currentActorDraft.lookSpotEnabled && !lookSpot) {
      blockingIssues.push("Look spot must use valid X/Y numbers.");
    } else if (selectedScene && !scenePointIsInside(lookSpot, previewSceneSize)) {
      blockingIssues.push("Look spot is outside the scene.");
    }

    if (
      !currentActorDraft.lookFlowId.trim() &&
      !currentActorDraft.talkFlowId.trim() &&
      !currentActorDraft.useFlowId.trim() &&
      currentActorDraft.useItemFlows.length === 0
    ) {
      warningIssues.push("Actor has no action flow yet.");
    }

    return buildGuardrail(
      blockingIssues,
      warningIssues,
      "Actor bindings look good",
      "Actor asset, locale, actions, and spots are ready to save."
    );
  }, [
    availableAssetIdsSet,
    availableAnimationPackIdsSet,
    availableFlowIdsSet,
    availableItemIdsSet,
    currentActorDraft.animationPackId,
    currentActorDraft.assetId,
    currentActorDraft.interactSpotEnabled,
    currentActorDraft.interactSpotX,
    currentActorDraft.interactSpotY,
    currentActorDraft.labelKey,
    currentActorDraft.lookFlowId,
    currentActorDraft.lookSpotEnabled,
    currentActorDraft.lookSpotX,
    currentActorDraft.lookSpotY,
    currentActorDraft.talkFlowId,
    currentActorDraft.useFlowId,
    currentActorDraft.useItemFlows,
    defaultLocaleId,
    defaultLocaleStrings,
    selectedScene
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
  const hotspotInteractSpotInvalid =
    currentHotspotDraft.interactSpotEnabled &&
    (parseNumber(currentHotspotDraft.interactSpotX) === null ||
      parseNumber(currentHotspotDraft.interactSpotY) === null ||
      (!!selectedScene &&
        !scenePointIsInside(
          {
            x: parseNumber(currentHotspotDraft.interactSpotX) ?? Number.NaN,
            y: parseNumber(currentHotspotDraft.interactSpotY) ?? Number.NaN
          },
          previewSceneSize
        )));
  const hotspotLookSpotInvalid =
    currentHotspotDraft.lookSpotEnabled &&
    (parseNumber(currentHotspotDraft.lookSpotX) === null ||
      parseNumber(currentHotspotDraft.lookSpotY) === null ||
      (!!selectedScene &&
        !scenePointIsInside(
          {
            x: parseNumber(currentHotspotDraft.lookSpotX) ?? Number.NaN,
            y: parseNumber(currentHotspotDraft.lookSpotY) ?? Number.NaN
          },
          previewSceneSize
        )));
  const hotspotOverrideIssues = currentHotspotDraft.useItemFlows.map((entry) => {
    const itemId = entry.itemId.trim();
    const flowId = entry.flowId.trim();
    return {
      missingFlow: !!flowId && !availableFlowIdsSet.has(flowId),
      missingItem: !!itemId && !availableItemIdsSet.has(itemId),
      incomplete: (!itemId && !!flowId) || (!!itemId && !flowId)
    };
  });
  const actorAssetMissing =
    !!currentActorDraft.assetId.trim() && !availableAssetIdsSet.has(currentActorDraft.assetId.trim());
  const actorAnimationPackMissing =
    !!currentActorDraft.animationPackId.trim() &&
    !availableAnimationPackIdsSet.has(currentActorDraft.animationPackId.trim());
  const playerAssetMissing =
    !!currentSceneDraft.playerAssetId.trim() && !availableAssetIdsSet.has(currentSceneDraft.playerAssetId.trim());
  const playerAnimationPackMissing =
    !!currentSceneDraft.playerAnimationPackId.trim() &&
    !availableAnimationPackIdsSet.has(currentSceneDraft.playerAnimationPackId.trim());
  const actorLabelMissing =
    currentActorDraft.labelKey.trim().length === 0 ||
    (!!defaultLocaleStrings && !(currentActorDraft.labelKey.trim() in defaultLocaleStrings));
  const actorLookFlowMissing =
    !!currentActorDraft.lookFlowId.trim() && !availableFlowIdsSet.has(currentActorDraft.lookFlowId.trim());
  const actorTalkFlowMissing =
    !!currentActorDraft.talkFlowId.trim() && !availableFlowIdsSet.has(currentActorDraft.talkFlowId.trim());
  const actorUseFlowMissing =
    !!currentActorDraft.useFlowId.trim() && !availableFlowIdsSet.has(currentActorDraft.useFlowId.trim());
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
          : hotspotInteractSpotInvalid
            ? { kind: "interact-spot" as const }
            : hotspotLookSpotInvalid
              ? { kind: "look-spot" as const }
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
      case "interact-spot":
      case "look-spot":
        setWorkspace("scene");
        setActiveSceneTool("hotspot");
        viewportRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
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
        x: ((clientX - rect.left) / rect.width) * previewSceneSize.width,
        y: ((clientY - rect.top) / rect.height) * previewSceneSize.height
      },
      previewSceneSize
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

  const setHotspotDraftSpot = (
    spot: "interact" | "look",
    point: ScenePointDraftValue
  ) => {
    if (!selectedScene || !selectedHotspot) return;
    const key = createHotspotKey(selectedScene.id, selectedHotspot.id);
    const xKey = spot === "interact" ? "interactSpotX" : "lookSpotX";
    const yKey = spot === "interact" ? "interactSpotY" : "lookSpotY";
    const enabledKey = spot === "interact" ? "interactSpotEnabled" : "lookSpotEnabled";

    updatePresentWithoutHistory((current) => ({
      ...current,
      hotspotDrafts: {
        ...current.hotspotDrafts,
        [key]: {
          ...(current.hotspotDrafts[key] ?? createHotspotDraft(selectedHotspot)),
          [enabledKey]: true,
          [xKey]: String(point.x),
          [yKey]: String(point.y)
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

  const setActorDraftBoundsFromRect = (bounds: Rect) => {
    if (!selectedScene || !selectedActor) return;
    const key = createActorKey(selectedScene.id, selectedActor.id);

    updatePresentWithoutHistory((current) => ({
      ...current,
      actorDrafts: {
        ...current.actorDrafts,
        [key]: {
          ...(current.actorDrafts[key] ?? createActorDraft(selectedActor)),
          height: String(bounds.height),
          width: String(bounds.width),
          x: String(bounds.x),
          y: String(bounds.y)
        }
      }
    }));
  };

  const setActorDraftSpot = (
    spot: "interact" | "look",
    point: ScenePointDraftValue
  ) => {
    if (!selectedScene || !selectedActor) return;
    const key = createActorKey(selectedScene.id, selectedActor.id);
    const xKey = spot === "interact" ? "interactSpotX" : "lookSpotX";
    const yKey = spot === "interact" ? "interactSpotY" : "lookSpotY";
    const enabledKey = spot === "interact" ? "interactSpotEnabled" : "lookSpotEnabled";

    updatePresentWithoutHistory((current) => ({
      ...current,
      actorDrafts: {
        ...current.actorDrafts,
        [key]: {
          ...(current.actorDrafts[key] ?? createActorDraft(selectedActor)),
          [enabledKey]: true,
          [xKey]: String(point.x),
          [yKey]: String(point.y)
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

  const startHotspotSpotInteraction = (
    spot: "interact" | "look",
    point: ScenePointDraftValue,
    event: ReactPointerEvent
  ) => {
    if (
      !selectedScene ||
      !canEditViewportScene ||
      activeSceneTool !== "hotspot" ||
      !selectedHotspot
    )
      return;

    const startPoint = scenePointFromClient(event.clientX, event.clientY);
    if (!startPoint) return;

    event.preventDefault();
    event.stopPropagation();
    setViewportInteraction({
      baseSession: cloneSessionState(history.present),
      kind: spot === "interact" ? "hotspot-interact-spot" : "hotspot-look-spot",
      startPoint,
      startPosition: point
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

  const startActorInteraction = (
    mode: "move" | "resize",
    actor: SceneActor,
    event: ReactPointerEvent
  ) => {
    if (
      !selectedScene ||
      !canEditViewportScene ||
      activeSceneTool !== "actor" ||
      selectedActor?.id !== actor.id
    )
      return;

    const startPoint = scenePointFromClient(event.clientX, event.clientY);
    if (!startPoint) return;

    event.preventDefault();
    event.stopPropagation();
    setViewportInteraction({
      baseSession: cloneSessionState(history.present),
      kind: "actor",
      mode,
      startPoint,
      startRect: {
        height: actor.bounds.height,
        width: actor.bounds.width,
        x: actor.bounds.x,
        y: actor.bounds.y
      }
    });
  };

  const startActorSpotInteraction = (
    spot: "interact" | "look",
    point: ScenePointDraftValue,
    event: ReactPointerEvent
  ) => {
    if (
      !selectedScene ||
      !canEditViewportScene ||
      activeSceneTool !== "actor" ||
      !selectedActor
    )
      return;

    const startPoint = scenePointFromClient(event.clientX, event.clientY);
    if (!startPoint) return;

    event.preventDefault();
    event.stopPropagation();
    setViewportInteraction({
      baseSession: cloneSessionState(history.present),
      kind: spot === "interact" ? "actor-interact-spot" : "actor-look-spot",
      startPoint,
      startPosition: point
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
    if (!project || promptPackSceneId) return;
    const nextSceneId =
      selectedScene?.type === "layered-2d"
        ? selectedScene.id
        : sceneItems(project.scenes).find((scene) => scene.type === "layered-2d")?.id;
    if (nextSceneId) {
      setPromptPackSceneId(nextSceneId);
    }
  }, [project, promptPackSceneId, selectedScene]);

  useEffect(() => {
    setPromptPackJob(null);
  }, [promptPackBrief, promptPackSceneId]);

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
          moveScenePoint(viewportInteraction.startPosition, delta, previewSceneSize)
        );
        return;
      }

      if (viewportInteraction.kind === "walk-area-point") {
        setWalkAreaPointDraft(
          viewportInteraction.pointIndex,
          moveScenePoint(viewportInteraction.startPosition, delta, previewSceneSize)
        );
        return;
      }

      if (viewportInteraction.kind === "actor-interact-spot") {
        setActorDraftSpot(
          "interact",
          moveScenePoint(viewportInteraction.startPosition, delta, previewSceneSize)
        );
        return;
      }

      if (viewportInteraction.kind === "actor-look-spot") {
        setActorDraftSpot(
          "look",
          moveScenePoint(viewportInteraction.startPosition, delta, previewSceneSize)
        );
        return;
      }

      if (viewportInteraction.kind === "hotspot-interact-spot") {
        setHotspotDraftSpot(
          "interact",
          moveScenePoint(viewportInteraction.startPosition, delta, previewSceneSize)
        );
        return;
      }

      if (viewportInteraction.kind === "hotspot-look-spot") {
        setHotspotDraftSpot(
          "look",
          moveScenePoint(viewportInteraction.startPosition, delta, previewSceneSize)
        );
        return;
      }

      if (
        viewportInteraction.kind === "hotspot" ||
        viewportInteraction.kind === "actor" ||
        viewportInteraction.kind === "pickup"
      ) {
        const nextRect =
          viewportInteraction.mode === "move"
            ? moveSceneRect(viewportInteraction.startRect, delta, previewSceneSize)
            : resizeSceneRectFromBottomRight(
                viewportInteraction.startRect,
                delta,
                previewSceneSize
              );

        if (viewportInteraction.kind === "hotspot") {
          setHotspotDraftBoundsFromRect(nextRect);
          return;
        }

        if (viewportInteraction.kind === "actor") {
          setActorDraftBoundsFromRect(nextRect);
          return;
        }

        setPickupDraftBoundsFromRect(nextRect);
      }
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
  }, [previewSceneSize, selectedScene, viewportInteraction]);

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

  const createBlankProject = async () => {
    setStatus("Choose an empty folder for the blank project...");
    try {
      const snapshot = await window.pointClick.createBlankProject();
      if (!snapshot) {
        setStatus(project ? `Loaded ${project.manifest.title}` : "Project creation cancelled");
        return;
      }
      await hydrateProject(snapshot);
      setWorkspace("overview");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Blank project could not be created");
    }
  };

  const createProjectFromStarter = async () => {
    setStatus("Choose an empty folder for the starter project...");
    try {
      const snapshot = await window.pointClick.createProjectFromStarter();
      if (!snapshot) {
        setStatus(project ? `Loaded ${project.manifest.title}` : "Project creation cancelled");
        return;
      }
      await hydrateProject(snapshot);
      setWorkspace("overview");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Starter project could not be created");
    }
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
          size: selectedScene.size,
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

  const applySceneDirectionPreset = (presetId: string) => {
    const preset = sceneDirectionPresetById(presetId);
    if (!preset) return;

    setSceneDirectionPresetId(preset.id);
    setPromptPackBrief(preset.artBrief);
    setVisualStylePresetId(preset.visualStylePreset);
    setMoodPresetId(preset.moodPreset);
    setSettingPresetId(preset.settingPreset);
    setPalettePresetId(preset.palettePreset);
    setGameplayEmphasisPresetIds(preset.gameplayEmphasis);
  };

  const toggleGameplayEmphasisPreset = (presetId: string) => {
    setGameplayEmphasisPresetIds((current) =>
      current.includes(presetId)
        ? current.filter((id) => id !== presetId)
        : [...current, presetId]
    );
  };

  const applyComfyOutputPreset = (presetId: string) => {
    const preset = comfyOutputPresetById(presetId);
    setComfyUiOutputPresetId(preset.id);
    setComfyUiTimeoutMinutes(String(preset.timeoutMinutes));
  };

  const generatePromptPack = async () => {
    if (!project || !promptPackScene) return;

    setPromptPackGenerationState("running");
    setStatus(
      promptProviderId === "openai"
        ? `Generating prompt pack with OpenAI ${openAiModel || selectedPromptProvider.defaultModel}...`
        : promptProviderId === "lmstudio"
          ? `Generating prompt pack with LM Studio ${lmStudioModel || selectedPromptProvider.defaultModel}...`
          : "Generating deterministic mock prompt pack..."
    );
    try {
      const job = await window.pointClick.generatePromptPack({
        bundle: buildDraftProjectBundle(project, history.present),
        providerId: promptProviderId,
        sceneId: promptPackScene.id,
        artBrief: guidedPromptPackBrief,
        ...(lmStudioApiKey.trim() ? { lmStudioApiKey: lmStudioApiKey.trim() } : {}),
        ...(lmStudioBaseUrl.trim() ? { lmStudioBaseUrl: lmStudioBaseUrl.trim() } : {}),
        ...(lmStudioModel.trim() ? { lmStudioModel: lmStudioModel.trim() } : {}),
        ...(openAiApiKey.trim() ? { openAiApiKey: openAiApiKey.trim() } : {}),
        ...(openAiBaseUrl.trim() ? { openAiBaseUrl: openAiBaseUrl.trim() } : {}),
        ...(openAiModel.trim() ? { openAiModel: openAiModel.trim() } : {})
      });
      const candidate = job.candidates[0] ?? null;
      setPromptPackJob(job);
      setSelectedPromptPackId(candidate?.promptPack.id ?? null);
      setStatus(
        candidate
          ? `Generated ${candidate.promptPack.id} with ${selectedPromptProvider.label}`
          : `${selectedPromptProvider.label} returned no prompt pack candidates`
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Prompt pack could not be generated");
    } finally {
      setPromptPackGenerationState("idle");
    }
  };

  const saveApprovedPromptPack = async () => {
    const promptPack = promptPackCandidate?.promptPack ?? null;
    if (!promptPack) return;

    setStatus(`Saving ${promptPack.id}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "prompt-pack/upsert",
        patch: { promptPack }
      });
      setProject(snapshot);
      setSelectedPromptPackId(promptPack.id);
      setStatus(`Saved prompt pack ${promptPack.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Prompt pack could not be saved");
    }
  };

  const generateImageAsset = async () => {
    if (!project) {
      setComfyUiGenerationStatus("Open or create a project before generating image assets.");
      setStatus("Open or create a project before generating image assets.");
      return;
    }
    if (!activeImagePromptPack) {
      setComfyUiGenerationStatus("Generate or select a prompt pack before queueing ComfyUI.");
      setStatus("Generate or select a prompt pack before queueing ComfyUI.");
      return;
    }
    if (!selectedGenerationTarget) {
      setComfyUiGenerationStatus("Select a prompt-pack generation target before queueing ComfyUI.");
      setStatus("Select a prompt-pack generation target before queueing ComfyUI.");
      return;
    }

    const checkpointName = comfyUiCheckpoint.trim();
    const workflowPath = comfyUiWorkflowPath.trim();
    if (!checkpointName && !workflowPath) {
      setComfyUiGenerationStatus("ComfyUI needs a checkpoint filename or a workflow API JSON path.");
      setStatus("ComfyUI needs a checkpoint filename or a workflow API JSON path.");
      return;
    }

    const seedText = comfyUiSeed.trim();
    const parsedSeed = seedText ? Number(seedText) : null;
    if (parsedSeed !== null && (!Number.isFinite(parsedSeed) || parsedSeed < 0)) {
      setComfyUiGenerationStatus("ComfyUI seed must be a positive number or empty for random.");
      setStatus("ComfyUI seed must be a positive number or empty for random.");
      return;
    }

    const timeoutMinutes = Number(comfyUiTimeoutMinutes.trim() || "20");
    if (!Number.isFinite(timeoutMinutes) || timeoutMinutes <= 0) {
      setComfyUiGenerationStatus("ComfyUI timeout must be a positive number of minutes.");
      setStatus("ComfyUI timeout must be a positive number of minutes.");
      return;
    }

    setImageGenerationState("running");
    const queuedStatus = `Queueing ${selectedGenerationTarget.id} with ComfyUI. Krea workflows can take several minutes.`;
    setComfyUiGenerationStatus(queuedStatus);
    setStatus(queuedStatus);
    try {
      const imageRequest = {
        height: selectedGenerationDimensions.height,
        negativePrompt: activeImagePromptPack.outputs.negativePrompt,
        prompt: selectedGenerationPrompt,
        providerId: "comfyui" as const,
        targetId: selectedGenerationTarget.id,
        width: selectedGenerationDimensions.width,
        ...(comfyUiBaseUrl.trim() ? { baseUrl: comfyUiBaseUrl.trim() } : {}),
        ...(checkpointName ? { checkpointName } : {}),
        ...(parsedSeed !== null ? { seed: parsedSeed } : {}),
        timeoutMs: Math.round(timeoutMinutes * 60_000),
        ...(workflowPath ? { workflowPath } : {})
      };
      const job = await window.pointClick.generateImageAsset(imageRequest);
      setProject(job.snapshot);
      setSelectedAssetId(job.assetId);
      const completedStatus = `Generated ${job.assetId} from ${job.targetId} with ComfyUI seed ${job.seed}`;
      setComfyUiGenerationStatus(completedStatus);
      setStatus(completedStatus);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Image asset could not be generated";
      setComfyUiGenerationStatus(message);
      setStatus(message);
    } finally {
      setImageGenerationState("idle");
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
        activeActorId: null,
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
            activeActorId: null,
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
      setActiveSceneTool("walk-area");
      updateSessionSelection((current) => ({
        ...current,
        activeActorId: null,
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
            activeActorId: null,
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
      setActiveSceneTool("hotspot");
      updateSessionSelection((current) => ({
        ...current,
        activeActorId: null,
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
            activeActorId: null,
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

        for (const key of Object.keys(nextPresent.actorDrafts)) {
          if (key.startsWith(`${deletedSceneId}::`)) {
            delete nextPresent.actorDrafts[key];
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
      setActiveSceneTool("pickup");
      updateSessionSelection((current) => ({
        ...current,
        activeActorId: null,
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
            activeActorId: null,
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
        activeActorId: null,
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
            activeActorId: null,
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

  const createActor = async () => {
    if (!project || !selectedScene) return;

    const actorId = nextActorId(selectedScene);
    setStatus(`Creating ${actorId}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        actor: createDefaultActor(selectedScene, actorId),
        sceneId: selectedScene.id,
        type: "actor/create"
      });
      setProject(snapshot);
      setWorkspace("scene");
      updateSessionSelection((current) => ({
        ...current,
        activeActorId: actorId,
        activeFlowId: null,
        activeHotspotId: null,
        activeItemId: null,
        activeLocale: null,
        activePickupId: null
      }));
      setActiveSceneTool("actor");
      setStatus(`Created ${actorId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create actor");
    }
  };

  const deleteSelectedActor = async () => {
    if (!selectedScene || !selectedActor) return;

    const deletedActorId = selectedActor.id;
    const draftKey = createActorKey(selectedScene.id, deletedActorId);
    setStatus(`Deleting ${deletedActorId}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        actorId: deletedActorId,
        sceneId: selectedScene.id,
        type: "actor/delete"
      });
      setProject(snapshot);
      setWorkspace("scene");
      setHistory((current) => ({
        ...current,
        present: discardSavedDraft(
          {
            ...current.present,
            activeActorId: null,
            activeFlowId: null,
            activeHotspotId: null,
            activeItemId: null,
            activeLocale: null,
            activePickupId: null
          },
          "actor",
          draftKey
        )
      }));
      setStatus(`Deleted ${deletedActorId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete actor");
    }
  };

  const selectScene = (sceneId: string) => {
    setWorkspace("scene");
    setActiveSceneTool("walk-area");
    updateSessionSelection((current) => ({
      ...current,
      activeActorId: null,
      activeFlowId: null,
      activeHotspotId: null,
      activeItemId: null,
      activeLocale: null,
      activePickupId: null,
      activeSceneId: sceneId
    }));
  };

  const selectPlayerScene = (sceneId: string) => {
    setWorkspace("player");
    updateSessionSelection((current) => ({
      ...current,
      activeActorId: null,
      activeFlowId: null,
      activeHotspotId: null,
      activeItemId: null,
      activeLocale: null,
      activePickupId: null,
      activeSceneId: sceneId
    }));
  };

  const selectHotspot = (hotspot: Hotspot) => {
    setWorkspace("scene");
    setActiveSceneTool("hotspot");
    updateSessionSelection((current) => ({
      ...current,
      activeActorId: null,
      activeFlowId: null,
      activeHotspotId: hotspot.id,
      activeItemId: null,
      activeLocale: null,
      activePickupId: null
    }));
  };

  const selectPickup = (pickup: ScenePickup) => {
    setWorkspace("scene");
    setActiveSceneTool("pickup");
    updateSessionSelection((current) => ({
      ...current,
      activeActorId: null,
      activeFlowId: null,
      activeHotspotId: null,
      activeItemId: null,
      activeLocale: null,
      activePickupId: pickup.id
    }));
  };

  const selectActor = (actor: SceneActor) => {
    setWorkspace("scene");
    setActiveSceneTool("actor");
    updateSessionSelection((current) => ({
      ...current,
      activeActorId: actor.id,
      activeFlowId: null,
      activeHotspotId: null,
      activeItemId: null,
      activeLocale: null,
      activePickupId: null
    }));
  };

  const selectLocale = (locale: LocaleDocument) => {
    updateSessionSelection((current) => ({
      ...current,
      activeActorId: null,
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
      activeActorId: null,
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
      activeActorId: null,
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

  const updateActorDraft = <K extends keyof typeof currentActorDraft>(
    field: K,
    value: (typeof currentActorDraft)[K]
  ) => {
    if (!selectedScene || !selectedActor) return;
    const key = createActorKey(selectedScene.id, selectedActor.id);
    updateDraftWithHistory((current) => ({
      ...current,
      actorDrafts: {
        ...current.actorDrafts,
        [key]: {
          ...(current.actorDrafts[key] ?? createActorDraft(selectedActor)),
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

  const applyActorChanges = async () => {
    if (!selectedScene || !selectedActor) return;

    const x = parseNumber(currentActorDraft.x);
    const y = parseNumber(currentActorDraft.y);
    const width = parsePositiveNumber(currentActorDraft.width);
    const height = parsePositiveNumber(currentActorDraft.height);
    const depth = parseNumber(currentActorDraft.depth);
    const labelKey = currentActorDraft.labelKey.trim();

    if (x === null || y === null || width === null || height === null) {
      setStatus("Actor bounds must be valid numbers, with width and height above zero");
      return;
    }
    if (depth === null) {
      setStatus("Actor depth must be a valid number");
      return;
    }
    if (!labelKey) {
      setStatus("Actor label key is required");
      return;
    }
    if (actorGuardrail.blockingIssues.length > 0) {
      setStatus(actorGuardrail.blockingIssues[0]!);
      return;
    }

    const patch = buildActorFromDraft(selectedActor, currentActorDraft);
    setStatus(`Saving ${selectedActor.id}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        actorId: selectedActor.id,
        patch,
        sceneId: selectedScene.id,
        type: "actor/update"
      });
      setProject(snapshot);
      setHistory((current) => ({
        ...current,
        present: discardSavedDraft(
          current.present,
          "actor",
          createActorKey(selectedScene.id, selectedActor.id)
        )
      }));
      setStatus(`Saved ${selectedActor.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save actor");
    }
  };

  const applyHotspotChanges = async () => {
    if (!selectedScene || !selectedHotspot) return;

    const x = parseNumber(currentHotspotDraft.x);
    const y = parseNumber(currentHotspotDraft.y);
    const width = parsePositiveNumber(currentHotspotDraft.width);
    const height = parsePositiveNumber(currentHotspotDraft.height);
    const labelKey = currentHotspotDraft.labelKey.trim();
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
      const nextHotspot = buildHotspotFromDraft(selectedHotspot, currentHotspotDraft);
      const patch = {
        actions: nextHotspot.actions,
        bounds: nextHotspot.bounds,
        interactSpot: currentHotspotDraft.interactSpotEnabled ? nextHotspot.interactSpot ?? null : null,
        labelKey: nextHotspot.labelKey,
        lookSpot: currentHotspotDraft.lookSpotEnabled ? nextHotspot.lookSpot ?? null : null
      };
      if (nextHotspot.cursor) {
        Object.assign(patch, { cursor: nextHotspot.cursor });
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
    const playerScaleFar = parsePositiveNumber(currentSceneDraft.playerScaleFar);
    const playerScaleNear = parsePositiveNumber(currentSceneDraft.playerScaleNear);
    const playerWalkSpeed = parsePositiveNumber(currentSceneDraft.playerWalkSpeed);
    const playerAnimationPackId = currentSceneDraft.playerAnimationPackId.trim();
    const playerAssetId = currentSceneDraft.playerAssetId.trim();
    const sceneWidth = parsePositiveNumber(currentSceneDraft.width);
    const sceneHeight = parsePositiveNumber(currentSceneDraft.height);
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
    if (playerAssetId && !availableAssetIdsSet.has(playerAssetId)) {
      setStatus(`Player asset "${playerAssetId}" no longer exists`);
      return;
    }
    if (playerAnimationPackId && !availableAnimationPackIdsSet.has(playerAnimationPackId)) {
      setStatus(`Player animation pack "${playerAnimationPackId}" no longer exists`);
      return;
    }
    if (playerScaleFar === null || playerScaleNear === null || playerWalkSpeed === null) {
      setStatus("Player scale and walk speed must use positive numbers");
      return;
    }
    if (sceneWidth === null || sceneHeight === null) {
      setStatus("Scene resolution must use positive numbers");
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
          player: {
            ...(playerAnimationPackId ? { animationPackId: playerAnimationPackId } : {}),
            ...(playerAssetId ? { assetId: playerAssetId } : {}),
            scaleFar: playerScaleFar,
            scaleNear: playerScaleNear,
            walkSpeed: playerWalkSpeed
          },
          playerStart: {
            x: playerStartX,
            y: playerStartY
          },
          size: {
            height: sceneHeight,
            width: sceneWidth
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
      if (node.type === "change-scene") {
        if (!node.targetSceneId.trim() || !node.next.trim()) {
          setStatus(`Change-scene node "${node.id}" is incomplete`);
          return;
        }
        if (!ids.includes(node.next.trim())) {
          setStatus(`Change-scene node "${node.id}" points to a missing next node`);
          return;
        }
        if (!sceneItems(project?.scenes ?? []).some((scene) => scene.id === node.targetSceneId.trim())) {
          setStatus(`Change-scene node "${node.id}" points to a missing scene`);
          return;
        }
        if (
          node.playerStartEnabled &&
          (parseNumber(node.playerStartX) === null || parseNumber(node.playerStartY) === null)
        ) {
          setStatus(`Change-scene node "${node.id}" needs valid player start coordinates`);
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
          <button className="secondary-action" type="button" onClick={createProjectFromStarter}>
            New From Starter
          </button>
          <button className="secondary-action" type="button" onClick={createBlankProject}>
            Blank Project
          </button>
          <button className="secondary-action" disabled={!project} type="button" onClick={openBrowser}>
            Open in Browser
          </button>
          <button className="play-action" disabled={!project} type="button" onClick={play}>
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

      {!project ? (
        <main className="project-start-screen">
          <section className="project-start-panel">
            <span className="overview-label">Project bootstrap</span>
            <strong>Create or open an adventure project</strong>
            <p>{status}</p>
            <div className="project-start-actions">
              <button className="play-action" type="button" onClick={createProjectFromStarter}>
                New From Starter
              </button>
              <button className="secondary-action" type="button" onClick={createBlankProject}>
                Blank Project
              </button>
              <button className="secondary-action" type="button" onClick={openProject}>
                Open Project
              </button>
            </div>
          </section>
          <section className="project-start-grid" aria-label="Project creation options">
            <article>
              <span>01</span>
              <strong>Starter</strong>
              <p>Copies the checked-in starter into an empty folder, then opens it ready for scene editing.</p>
            </article>
            <article>
              <span>02</span>
              <strong>Blank</strong>
              <p>Creates a valid minimal project with one layered scene, one locale, and empty asset libraries.</p>
            </article>
            <article>
              <span>03</span>
              <strong>Open</strong>
              <p>Loads any existing folder that contains an `adventure.project.json` manifest.</p>
            </article>
          </section>
        </main>
      ) : (
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
                className={`tree-item ${session.activeLocale === null && session.activeFlowId === null && !session.activeActorId && !session.activeHotspotId && !session.activePickupId && !session.activeItemId && selectedScene?.id === scene.id ? "selected" : ""}`}
                key={scene.id}
                type="button"
                onClick={() => selectScene(scene.id)}
              >
                <span className="scene-dot" /> {scene.name}
                {dirtyState.sceneIds.has(scene.id) ? <span className="dirty-mark">*</span> : null}
              </button>
            ))}
            {selectedScene ? (
              <button
                className={`tree-item tree-child ${workspace === "player" ? "selected" : ""}`}
                type="button"
                onClick={() => setWorkspace("player")}
              >
                <span className="scene-dot muted" /> Player
                {dirtyState.sceneIds.has(selectedScene.id) ? <span className="dirty-mark">*</span> : null}
              </button>
            ) : null}
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
            <div className="tree-group open">Actors ({selectedScene?.actors.length ?? 0})</div>
            {selectedScene ? (
              <button className="tree-item tree-child" type="button" onClick={createActor}>
                <span className="scene-dot muted" /> + New actor
              </button>
            ) : null}
            {selectedScene?.actors.map((actor) => (
              <button
                className={`tree-item tree-child ${session.activeActorId === actor.id ? "selected" : ""}`}
                key={actor.id}
                type="button"
                onClick={() => selectActor(actor)}
              >
                <span className="scene-dot muted" /> {actor.id}
                {dirtyState.actorKeys.has(createActorKey(selectedScene.id, actor.id)) ? (
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
            <div className="tree-group open">Prompt Packs ({project?.promptPackCount ?? 0})</div>
            {project?.promptPacks.map((promptPack) => (
              <button
                className={`tree-item ${
                  selectedPromptPack?.id === promptPack.id && workspace === "assets" ? "selected" : ""
                }`}
                key={promptPack.id}
                type="button"
                onClick={() => {
                  setSelectedPromptPackId(promptPack.id);
                  setPromptPackSceneId(promptPack.sceneId);
                  setWorkspace("assets");
                }}
              >
                <span className="scene-dot muted" /> {promptPack.id}
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
                    : workspace === "player" && selectedScene
                      ? `Player - ${selectedScene.name} - ${previewPlayerConfig.walkSpeed}px/s`
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
          ) : workspace === "player" ? (
            <div className="workspace-overview build-workspace player-workspace">
              <section className="overview-card player-hero-card">
                <span className="overview-label">Player setup</span>
                <strong>{selectedScene ? `${selectedScene.name} player` : "No scene selected"}</strong>
                <p>
                  Configure the playable character for the current scene. This saves into the scene
                  document so runtime and preview stay deterministic.
                </p>
                <div className="prompt-studio-controls">
                  <label className="prompt-studio-field">
                    Scene
                    <select
                      disabled={scenes.length === 0}
                      value={selectedScene?.id ?? ""}
                      onChange={(event) => selectPlayerScene(event.target.value)}
                    >
                      {scenes.map((scene) => (
                        <option key={`player-scene-${scene.id}`} value={scene.id}>
                          {scene.name} ({scene.id})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="build-actions">
                  <button
                    className="secondary-action"
                    disabled={!selectedScene}
                    type="button"
                    onClick={() => {
                      setWorkspace("scene");
                      setActiveSceneTool("player-start");
                    }}
                  >
                    Edit Start In Viewport
                  </button>
                  <button
                    className="play-action"
                    disabled={!selectedScene}
                    type="button"
                    onClick={applySceneChanges}
                  >
                    Apply Player Changes
                  </button>
                </div>
              </section>
              <section className="overview-card">
                <span className="overview-label">Visual identity</span>
                <strong>{previewPlayerConfig.assetId ?? "Generated marker"}</strong>
                <p>
                  Use a registered image asset or assign an animation pack from Character Gym.
                </p>
                <div className="prompt-studio-controls">
                  <label className="prompt-studio-field">
                    Player asset
                    <select
                      value={currentSceneDraft.playerAssetId}
                      onChange={(event) => updateSceneDraft("playerAssetId", event.target.value)}
                    >
                      <option value="">Generated marker</option>
                      {availableAssetIds.map((assetId) => (
                        <option key={`player-workspace-asset-${assetId}`} value={assetId}>
                          {assetId}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="prompt-studio-field">
                    Animation pack
                    <select
                      value={currentSceneDraft.playerAnimationPackId}
                      onChange={(event) => updateSceneDraft("playerAnimationPackId", event.target.value)}
                    >
                      <option value="">None</option>
                      {availableAnimationPackIds.map((animationPackId) => (
                        <option key={`player-workspace-animation-${animationPackId}`} value={animationPackId}>
                          {animationPackId}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>
              <section className="overview-card">
                <span className="overview-label">Start and movement</span>
                <strong>
                  {previewPlayerStart
                    ? `${Math.round(previewPlayerStart.x)}, ${Math.round(previewPlayerStart.y)}`
                    : "No player start"}
                </strong>
                <p>Set spawn point, walk speed, and scale interpolation for scene depth.</p>
                <div className="player-field-grid">
                  <label>
                    Start X
                    <input
                      value={currentSceneDraft.playerStartX}
                      onChange={(event) => updateSceneDraft("playerStartX", event.target.value)}
                    />
                  </label>
                  <label>
                    Start Y
                    <input
                      value={currentSceneDraft.playerStartY}
                      onChange={(event) => updateSceneDraft("playerStartY", event.target.value)}
                    />
                  </label>
                  <label>
                    Far scale
                    <input
                      value={currentSceneDraft.playerScaleFar}
                      onChange={(event) => updateSceneDraft("playerScaleFar", event.target.value)}
                    />
                  </label>
                  <label>
                    Near scale
                    <input
                      value={currentSceneDraft.playerScaleNear}
                      onChange={(event) => updateSceneDraft("playerScaleNear", event.target.value)}
                    />
                  </label>
                  <label className="player-field-wide">
                    Walk speed
                    <input
                      value={currentSceneDraft.playerWalkSpeed}
                      onChange={(event) => updateSceneDraft("playerWalkSpeed", event.target.value)}
                    />
                  </label>
                </div>
              </section>
              <section className="overview-card player-preview-card">
                <span className="overview-label">Preview</span>
                <strong>{previewPlayerConfig.animationPackId ?? "Static player"}</strong>
                <p>
                  Preview uses the current draft asset assignment and reflects the same marker shown
                  in the scene viewport.
                </p>
                <div className="player-stage">
                  <div
                    className={`player-stage-avatar ${previewPlayerAssetUrl ? "has-player-image" : ""}`}
                    style={{
                      backgroundImage: previewPlayerAssetUrl ? `url("${previewPlayerAssetUrl}")` : undefined
                    }}
                  >
                    <span />
                  </div>
                  <div className="player-stage-floor" />
                </div>
                <div className="diagnostic-list">
                  <div className={`diagnostic-item ${playerAssetMissing ? "error" : ""}`}>
                    <div>
                      <strong>{playerAssetMissing ? "Missing asset" : "Asset reference"}</strong>
                      <p>{currentSceneDraft.playerAssetId.trim() || "Generated marker fallback"}</p>
                    </div>
                  </div>
                  <div className={`diagnostic-item ${playerAnimationPackMissing ? "error" : ""}`}>
                    <div>
                      <strong>{playerAnimationPackMissing ? "Missing animation pack" : "Animation reference"}</strong>
                      <p>{currentSceneDraft.playerAnimationPackId.trim() || "No animation pack assigned"}</p>
                    </div>
                  </div>
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
          ) : workspace === "ai" ? (
            <div className="workspace-overview build-workspace ai-workspace">
              <section className="overview-card prompt-studio-card">
                <span className="overview-label">AI Prompt Pack Studio</span>
                <strong>{promptPackScene ? `${promptPackScene.name} brief` : "No layered scene"}</strong>
                <p>{selectedPromptProvider.detail}</p>
                <div className="prompt-studio-controls">
                  <label className="prompt-studio-field">
                    Provider
                    <select
                      value={promptProviderId}
                      onChange={(event) => setPromptProviderId(event.target.value as PromptProviderId)}
                    >
                      {promptProviderDescriptors.map((provider) => (
                        <option key={`ai-provider-${provider.id}`} value={provider.id}>
                          {provider.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {promptProviderId === "openai" ? (
                    <>
                      <label className="prompt-studio-field">
                        OpenAI API key
                        <input
                          placeholder="Uses OPENAI_API_KEY if empty"
                          type="password"
                          value={openAiApiKey}
                          onChange={(event) => setOpenAiApiKey(event.target.value)}
                        />
                      </label>
                      <label className="prompt-studio-field">
                        Model
                        <input
                          value={openAiModel}
                          onChange={(event) => setOpenAiModel(event.target.value)}
                        />
                      </label>
                      <label className="prompt-studio-field">
                        Base URL
                        <input
                          value={openAiBaseUrl}
                          onChange={(event) => setOpenAiBaseUrl(event.target.value)}
                        />
                      </label>
                    </>
                  ) : null}
                  {promptProviderId === "lmstudio" ? (
                    <>
                      <label className="prompt-studio-field">
                        LM Studio base URL
                        <input
                          value={lmStudioBaseUrl}
                          onChange={(event) => setLmStudioBaseUrl(event.target.value)}
                        />
                      </label>
                      <label className="prompt-studio-field">
                        Model
                        <input
                          placeholder="Use the model id shown by LM Studio"
                          value={lmStudioModel}
                          onChange={(event) => setLmStudioModel(event.target.value)}
                        />
                      </label>
                      <label className="prompt-studio-field">
                        API key
                        <input
                          placeholder="Optional; LM Studio usually accepts any value"
                          type="password"
                          value={lmStudioApiKey}
                          onChange={(event) => setLmStudioApiKey(event.target.value)}
                        />
                      </label>
                    </>
                  ) : null}
                  <label className="prompt-studio-field">
                    Scene
                    <select
                      disabled={!project || layeredScenes.length === 0}
                      value={promptPackScene?.id ?? ""}
                      onChange={(event) => setPromptPackSceneId(event.target.value)}
                    >
                      {layeredScenes.map((scene) => (
                        <option key={`ai-scene-${scene.id}`} value={scene.id}>
                          {scene.name} ({scene.id})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="prompt-studio-field">
                    Direction preset
                    <select
                      value={sceneDirectionPresetId}
                      onChange={(event) => applySceneDirectionPreset(event.target.value)}
                    >
                      {sceneDirectionPresets.map((preset) => (
                        <option key={`scene-direction-${preset.id}`} value={preset.id}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="prompt-studio-field">
                    Art brief
                    <textarea
                      value={promptPackBrief}
                      onChange={(event) => setPromptPackBrief(event.target.value)}
                    />
                  </label>
                  <label className="prompt-studio-field">
                    Visual style preset
                    <select
                      value={visualStylePresetId}
                      onChange={(event) => setVisualStylePresetId(event.target.value)}
                    >
                      {visualStylePresets.map((preset) => (
                        <option key={`visual-style-${preset.id}`} value={preset.id}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="prompt-studio-field">
                    Mood preset
                    <select value={moodPresetId} onChange={(event) => setMoodPresetId(event.target.value)}>
                      {moodPresets.map((preset) => (
                        <option key={`mood-${preset.id}`} value={preset.id}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="prompt-studio-field">
                    Setting preset
                    <select value={settingPresetId} onChange={(event) => setSettingPresetId(event.target.value)}>
                      {settingPresets.map((preset) => (
                        <option key={`setting-${preset.id}`} value={preset.id}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="prompt-studio-field">
                    Palette preset
                    <select value={palettePresetId} onChange={(event) => setPalettePresetId(event.target.value)}>
                      {palettePresets.map((preset) => (
                        <option key={`palette-${preset.id}`} value={preset.id}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="prompt-studio-field">
                    Gameplay emphasis
                    <div className="preset-checklist">
                      {gameplayEmphasisPresets.map((preset) => (
                        <label key={`gameplay-${preset.id}`}>
                          <input
                            checked={gameplayEmphasisPresetIds.includes(preset.id)}
                            type="checkbox"
                            onChange={() => toggleGameplayEmphasisPreset(preset.id)}
                          />
                          <span>{preset.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <label className="prompt-studio-field">
                    Custom mood
                    <input
                      placeholder="e.g. lonely, comic, eerie, cozy"
                      value={guidedSceneMood}
                      onChange={(event) => setGuidedSceneMood(event.target.value)}
                    />
                  </label>
                  <label className="prompt-studio-field">
                    Custom setting details
                    <input
                      placeholder="e.g. rain-soaked pier, abandoned lab"
                      value={guidedSceneSetting}
                      onChange={(event) => setGuidedSceneSetting(event.target.value)}
                    />
                  </label>
                  <label className="prompt-studio-field">
                    Custom visual style
                    <input
                      placeholder="e.g. hand-painted 90s adventure, clean pixel art"
                      value={guidedSceneStyle}
                      onChange={(event) => setGuidedSceneStyle(event.target.value)}
                    />
                  </label>
                  <label className="prompt-studio-field">
                    Custom palette
                    <input
                      placeholder="e.g. teal shadows, warm lantern accents"
                      value={guidedScenePalette}
                      onChange={(event) => setGuidedScenePalette(event.target.value)}
                    />
                  </label>
                  <label className="prompt-studio-field">
                    Gameplay emphasis
                    <textarea
                      placeholder="Objects, exits, clues, readable silhouettes, or puzzle-critical details to preserve."
                      value={guidedSceneGameplayFocus}
                      onChange={(event) => setGuidedSceneGameplayFocus(event.target.value)}
                    />
                  </label>
                </div>
                <div className="build-actions">
                  <button
                    className="play-action"
                    disabled={!project || !promptPackScene || promptPackGenerationState === "running"}
                    type="button"
                    onClick={generatePromptPack}
                  >
                    {promptPackGenerationState === "running" ? "Generating..." : "Generate Prompt Pack"}
                  </button>
                  <button
                    className="secondary-action"
                    disabled={!promptPackCandidate}
                    type="button"
                    onClick={saveApprovedPromptPack}
                  >
                    Save Approved Pack
                  </button>
                </div>
              </section>
              <section className="overview-card">
                <span className="overview-label">Provider boundary</span>
                <strong>{selectedPromptProvider.label}</strong>
                <p>
                  {promptProviderId === "openai"
                    ? "OpenAI calls run through the Electron main process. API keys are not saved to project files."
                    : promptProviderId === "lmstudio"
                      ? "LM Studio calls run against your local OpenAI-compatible server. Local URLs and keys are not saved to project files."
                      : "Mock generation is offline, deterministic, and safe for open-source contributors."}
                </p>
                <div className="diagnostic-list">
                  <div className="diagnostic-item">
                    <div>
                      <strong>ChatGPT Plus</strong>
                      <p>Plus/Codex subscriptions do not replace API platform billing for app calls.</p>
                    </div>
                  </div>
                  <div className="diagnostic-item">
                    <div>
                      <strong>Project mutation</strong>
                      <p>Generation never writes files until you approve and save the pack.</p>
                    </div>
                  </div>
                </div>
              </section>
              <section className="overview-card">
                <span className="overview-label">Extracted context</span>
                <strong>
                  {promptPackContext
                    ? `${promptPackContext.hotspots.length} hotspot(s), ${promptPackContext.pickups.length} pickup(s), ${promptPackContext.actors.length} actor(s)`
                    : "No context"}
                </strong>
                <p>
                  {promptPackContext
                    ? `${promptPackContext.sceneSize.width} x ${promptPackContext.sceneSize.height} - ${promptPackContext.locale}`
                    : "Choose a layered scene to inspect AI prompt context."}
                </p>
                {promptPackContext ? (
                  <div className="prompt-chip-list">
                    {Object.entries(promptPackContext.labels).map(([key, value]) => (
                      <span className="prompt-chip" key={`ai-context-${key}`} title={key}>
                        {value}
                      </span>
                    ))}
                  </div>
                ) : null}
              </section>
              <section className="overview-card">
                <span className="overview-label">Saved prompt packs</span>
                <strong>{project?.promptPackCount ?? 0} pack(s)</strong>
                <p>
                  {selectedPromptPack
                    ? `${selectedPromptPack.id} targets ${selectedPromptPack.sceneId}`
                    : "Approved packs will be written under project prompt-packs."}
                </p>
                {selectedPromptPack ? (
                  <div className="diagnostic-list">
                    <div className="diagnostic-item">
                      <div>
                        <strong>{selectedPromptPack.name}</strong>
                        <p>{selectedPromptPack.provenance.provider} - {selectedPromptPack.provenance.model}</p>
                      </div>
                      <span className="capability-badge good">
                        {selectedPromptPack.outputs.generationTargets.length} target(s)
                      </span>
                    </div>
                  </div>
                ) : null}
              </section>
              <section className="overview-card prompt-studio-card">
                <span className="overview-label">ComfyUI Image Generation</span>
                <strong>
                  {activeImagePromptPack
                    ? `${activeImagePromptPack.id} target`
                    : "Generate or save a prompt pack first"}
                </strong>
                <p>
                  Uses a local ComfyUI text-to-image workflow, imports the PNG into `assets/imported`,
                  and registers it as a project image asset.
                </p>
                <div className="prompt-studio-controls">
                  <label className="prompt-studio-field">
                    ComfyUI base URL
                    <input
                      value={comfyUiBaseUrl}
                      onChange={(event) => setComfyUiBaseUrl(event.target.value)}
                    />
                  </label>
                  <label className="prompt-studio-field">
                    Output preset
                    <select
                      value={comfyUiOutputPresetId}
                      onChange={(event) => applyComfyOutputPreset(event.target.value)}
                    >
                      {comfyOutputPresets.map((preset) => (
                        <option key={`comfy-output-${preset.id}`} value={preset.id}>
                          {preset.label} {preset.width > 0 ? `(${preset.width}x${preset.height})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="prompt-studio-field">
                    Workflow API JSON path
                    <input
                      placeholder="Optional, e.g. ImgGenSDXLTurbo.json or an absolute path"
                      value={comfyUiWorkflowPath}
                      onChange={(event) => setComfyUiWorkflowPath(event.target.value)}
                    />
                  </label>
                  <label className="prompt-studio-field">
                    Checkpoint filename / override
                    <input
                      placeholder="Required without workflow path; optional override with workflow path"
                      value={comfyUiCheckpoint}
                      onChange={(event) => setComfyUiCheckpoint(event.target.value)}
                    />
                  </label>
                  <label className="prompt-studio-field">
                    Target
                    <select
                      disabled={imageGenerationTargets.length === 0}
                      value={selectedGenerationTarget?.id ?? ""}
                      onChange={(event) => setSelectedGenerationTargetId(event.target.value)}
                    >
                      {imageGenerationTargets.map((target) => (
                        <option key={`comfy-target-${target.id}`} value={target.id}>
                          {target.id} ({target.intendedUse})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="prompt-studio-field">
                    Seed
                    <input
                      placeholder="Empty for random"
                      value={comfyUiSeed}
                      onChange={(event) => setComfyUiSeed(event.target.value)}
                    />
                  </label>
                  <label className="prompt-studio-field">
                    Timeout minutes
                    <input
                      value={comfyUiTimeoutMinutes}
                      onChange={(event) => setComfyUiTimeoutMinutes(event.target.value)}
                    />
                  </label>
                  <label className="prompt-studio-field">
                    Prompt preview
                    <textarea readOnly value={selectedGenerationPrompt} />
                  </label>
                </div>
                <div className="build-actions">
                  <button
                    className="play-action"
                    disabled={
                      !project ||
                      !activeImagePromptPack ||
                      !selectedGenerationTarget ||
                      imageGenerationState === "running"
                    }
                    type="button"
                    onClick={generateImageAsset}
                  >
                    {imageGenerationState === "running" ? "Generating..." : "Generate And Import Asset"}
                  </button>
                </div>
                <div className="diagnostic-list">
                  <div className={`diagnostic-item ${imageGenerationState === "running" ? "warning" : ""}`}>
                    <div>
                      <strong>ComfyUI status</strong>
                      <p>{comfyUiGenerationStatus}</p>
                    </div>
                  </div>
                </div>
                {selectedGenerationTarget ? (
                  <>
                    <p>
                      {selectedGenerationDimensions.width} x {selectedGenerationDimensions.height} /{" "}
                      {selectedGenerationTarget.transparent ? "transparent target" : "opaque target"}
                    </p>
                    <p>{selectedComfyOutputPreset.useCase}</p>
                    <p>
                      Custom workflow mode patches checkpoint, size, seed, save prefix, and prompt text. If no
                      `CLIPTextEncode` nodes exist, the provider injects positive/negative prompt nodes for standard
                      `KSampler` nodes.
                    </p>
                  </>
                ) : null}
              </section>
              <section className="overview-card prompt-output-card">
                <span className="overview-label">Candidate output</span>
                <strong>{promptPackCandidate?.promptPack.id ?? "No candidate generated"}</strong>
                <p>{promptPackCandidate?.summary ?? "Generate a prompt pack to review provider output."}</p>
                {promptPackCandidate ? (
                  <div className="prompt-output-list">
                    <div className="prompt-output-item">
                      <strong>Background</strong>
                      <p>{promptPackCandidate.promptPack.outputs.sceneBackgroundPrompt}</p>
                    </div>
                    {promptPackCandidate.promptPack.outputs.propPrompts.map((prompt) => (
                      <div className="prompt-output-item" key={`ai-prop-${prompt.id}`}>
                        <strong>Prop: {prompt.id}</strong>
                        <p>{prompt.prompt}</p>
                      </div>
                    ))}
                    {promptPackCandidate.promptPack.outputs.characterReferencePrompts.map((prompt) => (
                      <div className="prompt-output-item" key={`ai-character-${prompt.id}`}>
                        <strong>Character: {prompt.id}</strong>
                        <p>{prompt.prompt}</p>
                      </div>
                    ))}
                    <div className="prompt-output-item">
                      <strong>Animation notes</strong>
                      <p>{textList(promptPackCandidate.promptPack.outputs.animationNotes)}</p>
                    </div>
                    <div className="prompt-output-item">
                      <strong>Style notes</strong>
                      <p>{textList(promptPackCandidate.promptPack.outputs.styleNotes)}</p>
                    </div>
                    <div className="prompt-output-item">
                      <strong>Negative prompt</strong>
                      <p>{promptPackCandidate.promptPack.outputs.negativePrompt}</p>
                    </div>
                    <div className="prompt-output-item">
                      <strong>Generation targets</strong>
                      <p>
                        {promptPackCandidate.promptPack.outputs.generationTargets
                          .map((target) => `${target.id}:${target.intendedUse}`)
                          .join(", ")}
                      </p>
                    </div>
                    <div className="prompt-output-item">
                      <strong>Suggested actors</strong>
                      <p>
                        {promptPackCandidate.promptPack.suggestedActors.length
                          ? promptPackCandidate.promptPack.suggestedActors
                              .map((actor) => `${actor.id}:${actor.role}`)
                              .join(", ")
                          : "No actor suggestions for this scene."}
                      </p>
                    </div>
                    <div className="prompt-output-item">
                      <strong>Provenance</strong>
                      <p>
                        {promptPackCandidate.promptPack.provenance.provider} /{" "}
                        {promptPackCandidate.promptPack.provenance.model} /{" "}
                        {promptPackCandidate.promptPack.provenance.inputHash}
                      </p>
                    </div>
                  </div>
                ) : null}
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
              <section className="overview-card prompt-studio-card">
                <span className="overview-label">Prompt Pack Studio</span>
                <strong>{promptPackScene ? `${promptPackScene.name} AI brief` : "No layered scene"}</strong>
                <p>Generate a prompt pack from the current draft scene context.</p>
                <div className="prompt-studio-controls">
                  <label className="prompt-studio-field">
                    Provider
                    <select
                      value={promptProviderId}
                      onChange={(event) => setPromptProviderId(event.target.value as PromptProviderId)}
                    >
                      {promptProviderDescriptors.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {promptProviderId === "openai" ? (
                    <>
                      <label className="prompt-studio-field">
                        OpenAI API key
                        <input
                          placeholder="Uses OPENAI_API_KEY if empty"
                          type="password"
                          value={openAiApiKey}
                          onChange={(event) => setOpenAiApiKey(event.target.value)}
                        />
                      </label>
                      <label className="prompt-studio-field">
                        Model
                        <input
                          value={openAiModel}
                          onChange={(event) => setOpenAiModel(event.target.value)}
                        />
                      </label>
                    </>
                  ) : null}
                  {promptProviderId === "lmstudio" ? (
                    <>
                      <label className="prompt-studio-field">
                        LM Studio base URL
                        <input
                          value={lmStudioBaseUrl}
                          onChange={(event) => setLmStudioBaseUrl(event.target.value)}
                        />
                      </label>
                      <label className="prompt-studio-field">
                        Model
                        <input
                          value={lmStudioModel}
                          onChange={(event) => setLmStudioModel(event.target.value)}
                        />
                      </label>
                    </>
                  ) : null}
                  <label className="prompt-studio-field">
                    Scene
                    <select
                      disabled={!project || layeredScenes.length === 0}
                      value={promptPackScene?.id ?? ""}
                      onChange={(event) => setPromptPackSceneId(event.target.value)}
                    >
                      {layeredScenes.map((scene) => (
                        <option key={scene.id} value={scene.id}>
                          {scene.name} ({scene.id})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="prompt-studio-field">
                    Art brief
                    <textarea
                      value={promptPackBrief}
                      onChange={(event) => setPromptPackBrief(event.target.value)}
                    />
                  </label>
                </div>
                <div className="build-actions">
                  <button
                    className="play-action"
                    disabled={!project || !promptPackScene || promptPackGenerationState === "running"}
                    type="button"
                    onClick={generatePromptPack}
                  >
                    {promptPackGenerationState === "running" ? "Generating..." : "Generate Prompt Pack"}
                  </button>
                  <button
                    className="secondary-action"
                    disabled={!promptPackCandidate}
                    type="button"
                    onClick={saveApprovedPromptPack}
                  >
                    Save Approved Pack
                  </button>
                </div>
              </section>
              <section className="overview-card">
                <span className="overview-label">Extracted context</span>
                <strong>
                  {promptPackContext
                    ? `${promptPackContext.hotspots.length} hotspot(s), ${promptPackContext.pickups.length} pickup(s), ${promptPackContext.actors.length} actor(s)`
                    : "No context"}
                </strong>
                <p>
                  {promptPackContext
                    ? `${promptPackContext.sceneSize.width} x ${promptPackContext.sceneSize.height} - ${promptPackContext.locale}`
                    : "Choose a layered scene to inspect AI prompt context."}
                </p>
                {promptPackContext ? (
                  <div className="prompt-chip-list">
                    {Object.entries(promptPackContext.labels).map(([key, value]) => (
                      <span className="prompt-chip" key={key} title={key}>
                        {value}
                      </span>
                    ))}
                  </div>
                ) : null}
              </section>
              <section className="overview-card prompt-output-card">
                <span className="overview-label">Candidate output</span>
                <strong>{promptPackCandidate?.promptPack.id ?? "No candidate generated"}</strong>
                <p>{promptPackCandidate?.summary ?? "Generate a mock pack to review prompt outputs."}</p>
                {promptPackCandidate ? (
                  <div className="prompt-output-list">
                    <div className="prompt-output-item">
                      <strong>Background</strong>
                      <p>{promptPackCandidate.promptPack.outputs.sceneBackgroundPrompt}</p>
                    </div>
                    {promptPackCandidate.promptPack.outputs.propPrompts.map((prompt) => (
                      <div className="prompt-output-item" key={prompt.id}>
                        <strong>Prop: {prompt.id}</strong>
                        <p>{prompt.prompt}</p>
                      </div>
                    ))}
                    {promptPackCandidate.promptPack.outputs.characterReferencePrompts.map((prompt) => (
                      <div className="prompt-output-item" key={prompt.id}>
                        <strong>Character: {prompt.id}</strong>
                        <p>{prompt.prompt}</p>
                      </div>
                    ))}
                    <div className="prompt-output-item">
                      <strong>Animation notes</strong>
                      <p>{textList(promptPackCandidate.promptPack.outputs.animationNotes)}</p>
                    </div>
                    <div className="prompt-output-item">
                      <strong>Negative prompt</strong>
                      <p>{promptPackCandidate.promptPack.outputs.negativePrompt}</p>
                    </div>
                    <div className="prompt-output-item">
                      <strong>Provenance</strong>
                      <p>
                        {promptPackCandidate.promptPack.provenance.provider} /{" "}
                        {promptPackCandidate.promptPack.provenance.model} /{" "}
                        {promptPackCandidate.promptPack.provenance.inputHash}
                      </p>
                    </div>
                  </div>
                ) : null}
              </section>
              <section className="overview-card">
                <span className="overview-label">Saved prompt packs</span>
                <strong>{project?.promptPackCount ?? 0} pack(s)</strong>
                <p>
                  {selectedPromptPack
                    ? `${selectedPromptPack.id} targets ${selectedPromptPack.sceneId}`
                    : "Approved packs will be written under project prompt-packs."}
                </p>
                {selectedPromptPack ? (
                  <div className="diagnostic-list">
                    <div className="diagnostic-item">
                      <div>
                        <strong>{selectedPromptPack.name}</strong>
                        <p>{selectedPromptPack.provenance.provider} - {selectedPromptPack.provenance.model}</p>
                      </div>
                      <span className="capability-badge good">
                        {selectedPromptPack.outputs.generationTargets.length} target(s)
                      </span>
                    </div>
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
                  ? {
                      ...sceneBackgroundStyle(previewSceneBackground, previewSceneBackgroundUrl),
                      aspectRatio: `${previewSceneSize.width} / ${previewSceneSize.height}`
                    }
                  : { background: "#24384a" }
              }
            >
              {selectedScene && workspace === "scene" ? (
                <div className="viewport-instruction">
                  <strong>{selectedSceneToolLabel}</strong>
                  <span>{selectedSceneToolHint}</span>
                </div>
              ) : null}
              {selectedScene && workspace === "scene" ? (
                <div className="viewport-quick-actions">
                  <label className="viewport-color-control" title="Set color background draft">
                    <span>BG</span>
                    <input
                      aria-label="Scene background color"
                      type="color"
                      value={previewSceneColor}
                      onChange={(event) => updateSceneDraft("background", event.target.value)}
                    />
                  </label>
                  <select
                    aria-label="Scene background asset"
                    value={imageAssets.some((asset) => asset.path === previewSceneBackground) ? previewSceneBackground : ""}
                    onChange={(event) => {
                      if (event.target.value) {
                        updateSceneDraft("background", event.target.value);
                      }
                    }}
                  >
                    <option value="">Image background</option>
                    {imageAssets.map((asset) => (
                      <option key={`viewport-bg-${asset.id}`} value={asset.path}>
                        {asset.id}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setActiveSceneTool("walk-area")}>
                    Walk
                  </button>
                  <button type="button" onClick={createHotspot}>
                    + Hotspot
                  </button>
                  <button type="button" onClick={createActor}>
                    + Actor
                  </button>
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
                      height: `${(shape.bounds.height / previewSceneSize.height) * 100}%`,
                      left: `${(shape.bounds.x / previewSceneSize.width) * 100}%`,
                      top: `${(shape.bounds.y / previewSceneSize.height) * 100}%`,
                      width: `${(shape.bounds.width / previewSceneSize.width) * 100}%`,
                      zIndex: shape.depth
                    }}
                  />
                ))}
                {previewWalkArea ? (
                  <svg
                    className="walk-region"
                    viewBox={`0 0 ${previewSceneSize.width} ${previewSceneSize.height}`}
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
                {previewActors.map((actor) => (
                  (() => {
                    const actorIssues = previewActorIssueMap[actor.id];
                    const actorAssetPath = actor.assetId ? assetPathById.get(actor.assetId) : null;
                    const actorAssetUrl = actorAssetPath ? assetPreviewUrls[actorAssetPath] : undefined;
                    return (
                  <button
                    className={`actor-box ${selectedActor?.id === actor.id ? "selected" : ""} ${actorIssues?.hasIssues ? `has-issues ${actorIssues.tone}` : ""}`}
                    key={actor.id}
                    type="button"
                    onClick={() => selectActor(actor)}
                    onPointerDown={(event) => startActorInteraction("move", actor, event)}
                    style={{
                      height: `${(actor.bounds.height / previewSceneSize.height) * 100}%`,
                      left: `${(actor.bounds.x / previewSceneSize.width) * 100}%`,
                      top: `${(actor.bounds.y / previewSceneSize.height) * 100}%`,
                      width: `${(actor.bounds.width / previewSceneSize.width) * 100}%`,
                      backgroundImage: actorAssetUrl ? `url("${actorAssetUrl}")` : undefined,
                      backgroundPosition: actorAssetUrl ? "center" : undefined,
                      backgroundRepeat: actorAssetUrl ? "no-repeat" : undefined,
                      backgroundSize: actorAssetUrl ? "100% 100%" : undefined,
                      zIndex: actor.depth
                    }}
                    title={
                      actorIssues?.hasIssues
                        ? actorIssues.detail
                        : activeSceneTool === "actor"
                        ? "Click to inspect, drag to move"
                        : "Switch to Actors to move or resize"
                    }
                  >
                    <span className="viewport-label">
                      actor: {actor.id}
                      {actorIssues?.hasIssues ? (
                        <span className={`viewport-issue-badge ${actorIssues.tone}`}>
                          {actorIssues.issueCount}
                        </span>
                      ) : null}
                    </span>
                    {selectedActor?.id === actor.id ? (
                      <span
                        className="viewport-resize-handle"
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => startActorInteraction("resize", actor, event)}
                      />
                    ) : null}
                  </button>
                    );
                  })()
                ))}
                {previewSelectedActor?.interactSpot ? (
                  <button
                    className="viewport-spot actor-interact-spot"
                    type="button"
                    style={{
                      left: `${(previewSelectedActor.interactSpot.x / previewSceneSize.width) * 100}%`,
                      top: `${(previewSelectedActor.interactSpot.y / previewSceneSize.height) * 100}%`
                    }}
                    title="Actor interact spot"
                    onPointerDown={(event) =>
                      startActorSpotInteraction("interact", previewSelectedActor.interactSpot!, event)
                    }
                  >
                    I
                  </button>
                ) : null}
                {previewSelectedActor?.lookSpot ? (
                  <button
                    className="viewport-spot actor-look-spot"
                    type="button"
                    style={{
                      left: `${(previewSelectedActor.lookSpot.x / previewSceneSize.width) * 100}%`,
                      top: `${(previewSelectedActor.lookSpot.y / previewSceneSize.height) * 100}%`
                    }}
                    title="Actor look spot"
                    onPointerDown={(event) =>
                      startActorSpotInteraction("look", previewSelectedActor.lookSpot!, event)
                    }
                  >
                    L
                  </button>
                ) : null}
                <div
                  className={`character ${previewPlayerAssetUrl ? "has-player-asset" : ""}`}
                  onPointerDown={startPlayerStartInteraction}
                    style={{
                      backgroundImage: previewPlayerAssetUrl ? `url("${previewPlayerAssetUrl}")` : undefined,
                      backgroundPosition: previewPlayerAssetUrl ? "center bottom" : undefined,
                      backgroundRepeat: previewPlayerAssetUrl ? "no-repeat" : undefined,
                      backgroundSize: previewPlayerAssetUrl ? "contain" : undefined,
                      left: `${((previewPlayerStart ?? selectedScene.playerStart).x / previewSceneSize.width) * 100}%`,
                      top: `${((previewPlayerStart ?? selectedScene.playerStart).y / previewSceneSize.height) * 100}%`
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
                      height: `${(hotspot.bounds.height / previewSceneSize.height) * 100}%`,
                      left: `${(hotspot.bounds.x / previewSceneSize.width) * 100}%`,
                      top: `${(hotspot.bounds.y / previewSceneSize.height) * 100}%`,
                      width: `${(hotspot.bounds.width / previewSceneSize.width) * 100}%`
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
                {previewSelectedHotspot?.interactSpot ? (
                  <button
                    className="viewport-spot hotspot-interact-spot"
                    type="button"
                    style={{
                      left: `${(previewSelectedHotspot.interactSpot.x / previewSceneSize.width) * 100}%`,
                      top: `${(previewSelectedHotspot.interactSpot.y / previewSceneSize.height) * 100}%`
                    }}
                    title="Hotspot interact spot"
                    onPointerDown={(event) =>
                      startHotspotSpotInteraction("interact", previewSelectedHotspot.interactSpot!, event)
                    }
                  >
                    I
                  </button>
                ) : null}
                {previewSelectedHotspot?.lookSpot ? (
                  <button
                    className="viewport-spot hotspot-look-spot"
                    type="button"
                    style={{
                      left: `${(previewSelectedHotspot.lookSpot.x / previewSceneSize.width) * 100}%`,
                      top: `${(previewSelectedHotspot.lookSpot.y / previewSceneSize.height) * 100}%`
                    }}
                    title="Hotspot look spot"
                    onPointerDown={(event) =>
                      startHotspotSpotInteraction("look", previewSelectedHotspot.lookSpot!, event)
                    }
                  >
                    L
                  </button>
                ) : null}
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
                      height: `${(pickup.bounds.height / previewSceneSize.height) * 100}%`,
                      left: `${(pickup.bounds.x / previewSceneSize.width) * 100}%`,
                      top: `${(pickup.bounds.y / previewSceneSize.height) * 100}%`,
                      width: `${(pickup.bounds.width / previewSceneSize.width) * 100}%`
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
                  : workspace === "ai"
                    ? "AI"
                  : workspace === "player"
                    ? "Player"
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
            ) : workspace === "player" ? (
              <div className="workspace-placeholder compact">
                <span className={`capability-badge ${playerAssetMissing || playerAnimationPackMissing ? "error" : "good"}`}>
                  Player
                </span>
                <strong>{selectedScene ? `${selectedScene.name} player` : "No scene"}</strong>
                <p>{workspaceCapability.detail}</p>
                <p className="inspector-copy">
                  Asset: {currentSceneDraft.playerAssetId.trim() || "generated marker"}
                </p>
                <p className="inspector-copy">
                  Animation pack: {currentSceneDraft.playerAnimationPackId.trim() || "none"}
                </p>
                <p className="inspector-copy">
                  Start: {currentSceneDraft.playerStartX}, {currentSceneDraft.playerStartY}
                </p>
                <p className="inspector-copy">
                  {selectedScene && dirtyState.sceneIds.has(selectedScene.id)
                    ? "Scene player settings have unapplied draft changes."
                    : "Player settings match the saved scene."}
                </p>
              </div>
            ) : workspace === "ai" ? (
              <div className="workspace-placeholder compact">
                <span className={`capability-badge ${promptProviderId === "openai" ? "warn" : "good"}`}>
                  AI
                </span>
                <strong>{selectedPromptProvider.label}</strong>
                <p>{selectedPromptProvider.detail}</p>
                <p className="inspector-copy">Scene: {promptPackScene?.id ?? "none"}</p>
                <p className="inspector-copy">Candidate: {promptPackCandidate?.promptPack.id ?? "none"}</p>
                <p className="inspector-copy">Saved packs: {project?.promptPackCount ?? 0}</p>
                <p className="inspector-copy">
                  {promptProviderId === "openai"
                    ? "OpenAI requires an API platform key; ChatGPT Plus billing is separate."
                    : "Mock output is deterministic and does not require network access."}
                </p>
              </div>
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
                      {node.type === "change-scene" ? (
                        <>
                          <label>
                            Target scene
                            <select
                              value={node.targetSceneId}
                              onChange={(event) =>
                                updateFlowNode(index, (current) =>
                                  current.type === "change-scene"
                                    ? { ...current, targetSceneId: event.target.value }
                                    : current
                                )
                              }
                            >
                              <option value="">Select scene</option>
                              {sceneItems(project?.scenes ?? []).map((scene) => (
                                <option key={`change-scene-${scene.id}`} value={scene.id}>
                                  {scene.id}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="checkbox-field">
                            <input
                              checked={node.playerStartEnabled}
                              type="checkbox"
                              onChange={(event) =>
                                updateFlowNode(index, (current) =>
                                  current.type === "change-scene"
                                    ? { ...current, playerStartEnabled: event.target.checked }
                                    : current
                                )
                              }
                            />
                            Set player start
                          </label>
                          <div className="four-fields">
                            <input
                              aria-label="Transition player X"
                              disabled={!node.playerStartEnabled}
                              value={node.playerStartX}
                              onChange={(event) =>
                                updateFlowNode(index, (current) =>
                                  current.type === "change-scene"
                                    ? { ...current, playerStartX: event.target.value }
                                    : current
                                )
                              }
                            />
                            <input
                              aria-label="Transition player Y"
                              disabled={!node.playerStartEnabled}
                              value={node.playerStartY}
                              onChange={(event) =>
                                updateFlowNode(index, (current) =>
                                  current.type === "change-scene"
                                    ? { ...current, playerStartY: event.target.value }
                                    : current
                                )
                              }
                            />
                          </div>
                          <label>
                            Next
                            <select
                              value={node.next}
                              onChange={(event) =>
                                updateFlowNode(index, (current) =>
                                  current.type === "change-scene"
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
                    <button type="button" onClick={() => addFlowNode("change-scene")}>
                      Add transition
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
            ) : selectedActor ? (
              <>
                <label>
                  Actor
                  <input value={selectedActor.id} readOnly />
                </label>
                <label>
                  Role
                  <select
                    value={currentActorDraft.role}
                    onChange={(event) =>
                      updateActorDraft("role", event.target.value as SceneActorRole)
                    }
                  >
                    <option value="prop">Prop</option>
                    <option value="pickup">Pickup</option>
                    <option value="npc">NPC</option>
                    <option value="exit">Exit</option>
                    <option value="decoration">Decoration</option>
                  </select>
                </label>
                <label>
                  Display label
                  <input
                    className={actorLabelMissing ? "field-input-invalid" : ""}
                    ref={actorLabelInputRef}
                    value={currentActorDraft.labelKey}
                    onChange={(event) => updateActorDraft("labelKey", event.target.value)}
                  />
                  {actorLabelMissing ? (
                    <small className="field-hint error">
                      {currentActorDraft.labelKey.trim().length === 0
                        ? "Actor label key is required."
                        : `Label key is missing in ${defaultLocaleId}.`}
                    </small>
                  ) : null}
                </label>
                <label>
                  Asset
                  <select
                    className={actorAssetMissing ? "field-input-invalid" : ""}
                    ref={actorAssetRef}
                    value={currentActorDraft.assetId}
                    onChange={(event) => updateActorDraft("assetId", event.target.value)}
                  >
                    <option value="">Debug bounds only</option>
                    {availableAssetIds.map((assetId) => (
                      <option key={`actor-asset-${assetId}`} value={assetId}>
                        {assetId}
                      </option>
                    ))}
                  </select>
                  {actorAssetMissing ? (
                    <small className="field-hint error">Selected actor asset no longer exists.</small>
                  ) : null}
                </label>
                <label>
                  Animation pack
                  <select
                    className={actorAnimationPackMissing ? "field-input-invalid" : ""}
                    value={currentActorDraft.animationPackId}
                    onChange={(event) => updateActorDraft("animationPackId", event.target.value)}
                  >
                    <option value="">None</option>
                    {availableAnimationPackIds.map((animationPackId) => (
                      <option key={`actor-animation-pack-${animationPackId}`} value={animationPackId}>
                        {animationPackId}
                      </option>
                    ))}
                  </select>
                  {actorAnimationPackMissing ? (
                    <small className="field-hint error">Selected actor animation pack no longer exists.</small>
                  ) : null}
                </label>
                <div className="field-group">
                  <span>Bounds and depth</span>
                  <div className="four-fields">
                    <input
                      aria-label="Actor X"
                      value={currentActorDraft.x}
                      onChange={(event) => updateActorDraft("x", event.target.value)}
                    />
                    <input
                      aria-label="Actor Y"
                      value={currentActorDraft.y}
                      onChange={(event) => updateActorDraft("y", event.target.value)}
                    />
                    <input
                      aria-label="Actor Width"
                      value={currentActorDraft.width}
                      onChange={(event) => updateActorDraft("width", event.target.value)}
                    />
                    <input
                      aria-label="Actor Height"
                      value={currentActorDraft.height}
                      onChange={(event) => updateActorDraft("height", event.target.value)}
                    />
                  </div>
                  <input
                    aria-label="Actor depth"
                    value={currentActorDraft.depth}
                    onChange={(event) => updateActorDraft("depth", event.target.value)}
                  />
                </div>
                <div className="field-group">
                  <span>Interaction spots</span>
                  <label className="checkbox-line">
                    <input
                      checked={currentActorDraft.interactSpotEnabled}
                      type="checkbox"
                      onChange={(event) =>
                        updateActorDraft("interactSpotEnabled", event.target.checked)
                      }
                    />
                    Interact spot
                  </label>
                  <div className="four-fields">
                    <input
                      aria-label="Interact spot X"
                      disabled={!currentActorDraft.interactSpotEnabled}
                      value={currentActorDraft.interactSpotX}
                      onChange={(event) => updateActorDraft("interactSpotX", event.target.value)}
                    />
                    <input
                      aria-label="Interact spot Y"
                      disabled={!currentActorDraft.interactSpotEnabled}
                      value={currentActorDraft.interactSpotY}
                      onChange={(event) => updateActorDraft("interactSpotY", event.target.value)}
                    />
                  </div>
                  <label className="checkbox-line">
                    <input
                      checked={currentActorDraft.lookSpotEnabled}
                      type="checkbox"
                      onChange={(event) =>
                        updateActorDraft("lookSpotEnabled", event.target.checked)
                      }
                    />
                    Look spot
                  </label>
                  <div className="four-fields">
                    <input
                      aria-label="Look spot X"
                      disabled={!currentActorDraft.lookSpotEnabled}
                      value={currentActorDraft.lookSpotX}
                      onChange={(event) => updateActorDraft("lookSpotX", event.target.value)}
                    />
                    <input
                      aria-label="Look spot Y"
                      disabled={!currentActorDraft.lookSpotEnabled}
                      value={currentActorDraft.lookSpotY}
                      onChange={(event) => updateActorDraft("lookSpotY", event.target.value)}
                    />
                  </div>
                </div>
                <label>
                  Look flow
                  <select
                    className={actorLookFlowMissing ? "field-input-invalid" : ""}
                    ref={actorLookFlowRef}
                    value={currentActorDraft.lookFlowId}
                    onChange={(event) => updateActorDraft("lookFlowId", event.target.value)}
                  >
                    <option value="">None</option>
                    {availableFlowIds.map((flowId) => (
                      <option key={`actor-look-${flowId}`} value={flowId}>
                        {flowId}
                      </option>
                    ))}
                  </select>
                  {actorLookFlowMissing ? (
                    <small className="field-hint error">Selected look flow no longer exists.</small>
                  ) : null}
                </label>
                <label>
                  Talk flow
                  <select
                    className={actorTalkFlowMissing ? "field-input-invalid" : ""}
                    ref={actorTalkFlowRef}
                    value={currentActorDraft.talkFlowId}
                    onChange={(event) => updateActorDraft("talkFlowId", event.target.value)}
                  >
                    <option value="">None</option>
                    {availableFlowIds.map((flowId) => (
                      <option key={`actor-talk-${flowId}`} value={flowId}>
                        {flowId}
                      </option>
                    ))}
                  </select>
                  {actorTalkFlowMissing ? (
                    <small className="field-hint error">Selected talk flow no longer exists.</small>
                  ) : null}
                </label>
                <label>
                  Use flow
                  <select
                    className={actorUseFlowMissing ? "field-input-invalid" : ""}
                    ref={actorUseFlowRef}
                    value={currentActorDraft.useFlowId}
                    onChange={(event) => updateActorDraft("useFlowId", event.target.value)}
                  >
                    <option value="">None</option>
                    {availableFlowIds.map((flowId) => (
                      <option key={`actor-use-${flowId}`} value={flowId}>
                        {flowId}
                      </option>
                    ))}
                  </select>
                  {actorUseFlowMissing ? (
                    <small className="field-hint error">Selected use flow no longer exists.</small>
                  ) : null}
                </label>
                <div className="flow-link">
                  <span>Reference guardrails</span>
                  <div className="flow-status-line">
                    <span className={`capability-badge ${actorGuardrail.tone}`}>{actorGuardrail.badge}</span>
                  </div>
                  <strong>{actorGuardrail.summary}</strong>
                  <p className="inspector-copy">{actorGuardrail.detail}</p>
                </div>
                <div className="flow-link">
                  <span>Scene actor</span>
                  <strong>
                    {currentActorDraft.role} / depth {currentActorDraft.depth || "0"}
                    {selectedScene && dirtyState.actorKeys.has(createActorKey(selectedScene.id, selectedActor.id))
                      ? " - unsaved draft"
                      : ""}
                  </strong>
                  <button type="button" onClick={deleteSelectedActor}>
                    Delete actor
                  </button>
                  <button type="button" onClick={applyActorChanges}>
                    Apply changes -&gt;
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
                <div className="field-group">
                  <span>Interaction spots</span>
                  <label className="checkbox-line">
                    <input
                      checked={currentHotspotDraft.interactSpotEnabled}
                      type="checkbox"
                      onChange={(event) =>
                        updateHotspotDraft("interactSpotEnabled", event.target.checked)
                      }
                    />
                    Interact spot
                  </label>
                  <div className="four-fields">
                    <input
                      aria-label="Hotspot interact spot X"
                      disabled={!currentHotspotDraft.interactSpotEnabled}
                      value={currentHotspotDraft.interactSpotX}
                      onChange={(event) => updateHotspotDraft("interactSpotX", event.target.value)}
                    />
                    <input
                      aria-label="Hotspot interact spot Y"
                      disabled={!currentHotspotDraft.interactSpotEnabled}
                      value={currentHotspotDraft.interactSpotY}
                      onChange={(event) => updateHotspotDraft("interactSpotY", event.target.value)}
                    />
                  </div>
                  <label className="checkbox-line">
                    <input
                      checked={currentHotspotDraft.lookSpotEnabled}
                      type="checkbox"
                      onChange={(event) =>
                        updateHotspotDraft("lookSpotEnabled", event.target.checked)
                      }
                    />
                    Look spot
                  </label>
                  <div className="four-fields">
                    <input
                      aria-label="Hotspot look spot X"
                      disabled={!currentHotspotDraft.lookSpotEnabled}
                      value={currentHotspotDraft.lookSpotX}
                      onChange={(event) => updateHotspotDraft("lookSpotX", event.target.value)}
                    />
                    <input
                      aria-label="Hotspot look spot Y"
                      disabled={!currentHotspotDraft.lookSpotEnabled}
                      value={currentHotspotDraft.lookSpotY}
                      onChange={(event) => updateHotspotDraft("lookSpotY", event.target.value)}
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
                  <span>Scene resolution</span>
                  <div className="four-fields">
                    <input
                      aria-label="Scene width"
                      value={currentSceneDraft.width}
                      onChange={(event) => updateSceneDraft("width", event.target.value)}
                    />
                    <input
                      aria-label="Scene height"
                      value={currentSceneDraft.height}
                      onChange={(event) => updateSceneDraft("height", event.target.value)}
                    />
                  </div>
                </div>
                <div className="field-group">
                  <span>Player</span>
                  <label>
                    Player asset
                    <select
                      value={currentSceneDraft.playerAssetId}
                      onChange={(event) => updateSceneDraft("playerAssetId", event.target.value)}
                    >
                      <option value="">Generated marker</option>
                      {availableAssetIds.map((assetId) => (
                        <option key={`player-asset-${assetId}`} value={assetId}>
                          {assetId}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Player animation pack
                    <select
                      value={currentSceneDraft.playerAnimationPackId}
                      onChange={(event) => updateSceneDraft("playerAnimationPackId", event.target.value)}
                    >
                      <option value="">None</option>
                      {availableAnimationPackIds.map((animationPackId) => (
                        <option key={`player-animation-pack-${animationPackId}`} value={animationPackId}>
                          {animationPackId}
                        </option>
                      ))}
                    </select>
                  </label>
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
                  <div className="four-fields">
                    <input
                      aria-label="Player far scale"
                      value={currentSceneDraft.playerScaleFar}
                      onChange={(event) => updateSceneDraft("playerScaleFar", event.target.value)}
                    />
                    <input
                      aria-label="Player near scale"
                      value={currentSceneDraft.playerScaleNear}
                      onChange={(event) => updateSceneDraft("playerScaleNear", event.target.value)}
                    />
                  </div>
                  <input
                    aria-label="Player walk speed"
                    value={currentSceneDraft.playerWalkSpeed}
                    onChange={(event) => updateSceneDraft("playerWalkSpeed", event.target.value)}
                  />
                  <p className="inspector-copy">
                    Far scale applies near the top of the walk area; near scale applies near the
                    bottom. Walk speed is measured in scene pixels per second.
                  </p>
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
                  <button type="button" onClick={createActor}>
                    Add actor
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
      )}
    </div>
  );
}
