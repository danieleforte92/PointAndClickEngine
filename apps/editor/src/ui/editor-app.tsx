import type {
  AnimationPackDocument,
  AssetDocument,
  CursorValue,
  FlowDocument,
  Hotspot,
  ItemDocument,
  Layered2DScene,
  LocaleDocument,
  AssetGenerationRecipeDocument,
  PromptPackDocument,
  PromptPackGenerationTarget,
  Rect,
  SceneActor,
  SceneActorRole,
  SceneDocument,
  SceneGenerationGuide,
  SceneGenerationGuideRole,
  SceneGenerationGuideShape,
  SceneLayer,
  ScenePickup,
  WorkflowTemplateDocument
} from "@pointclick/contracts";
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import {
  CheckCircle2,
  Crosshair,
  Eraser,
  ExternalLink,
  FilePlus2,
  Image,
  Package,
  Plus,
  Scissors,
  Trash2,
  UserRound,
  WandSparkles
} from "lucide-react";
import {
  bezierCropPathBounds,
  buildBezierCropSegmentSvgPath,
  buildBezierCropSvgPath,
  createCompositeGuideMask,
  createDefaultBezierCropPath,
  createGuideMask,
  insertBezierCropNodeAfter,
  moveBezierCropHandle,
  moveBezierCropNode,
  removeBezierCropNode,
  setBezierCropNodeMode,
  type BezierCropNode,
  type BezierCropNodeMode,
  type ImagePixelData
} from "../asset-processing";
import {
  applyChromaKeyToImageData,
  parseHexColor,
  rgbToHex,
  type ChromaKeySummary
} from "../chroma-key";
import {
  capabilityBadgeLabel,
  capabilityStatusTone,
  workspaceCapabilities
} from "../editor-capabilities";
import {
  AiContextSummary,
  AiProviderBoundary,
  AssetStudioSidebar,
  BuildWorkspace,
  iconSize,
  InspectorPanel,
  ProjectMapPanel,
  RecoveryBanner,
  SavedPromptPacksCard,
  ProjectStartScreen,
  StudioTopbar,
  WorkspaceOverview,
  WorkspaceStagePanel,
  WorkspaceStageToolbar,
  WorkspaceTimeline,
  WorkflowTemplateSummary
} from "./editor-shell";
import {
  buildActorFromDraft,
  buildHotspotFromDraft,
  buildNarrativeRelationIndex,
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
  type ActorDraft,
  type EditorHistoryState,
  type EditorRecoverySnapshot,
  type EditorSessionState,
  type FlowDraft,
  type FlowDraftNode,
  type SceneDraft,
  type SceneLayerDraft,
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
  animationPreviewIssue,
  buildAnimationClipPreviewState,
  buildAnimationFrameSliceCells,
  chooseAnimationPreviewClip,
  describeImageTargetWorkflow,
  parsePreviewFrameList
} from "../character-gym-preview";
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
import {
  composeTargetNegativePrompt,
  composeTargetPositivePrompt,
  resolvePromptForGenerationTarget
} from "../prompt-pack-targets";
import { estimateImageWorkflowFamily } from "../image-generation";
import { workflowPresets } from "../workflow-presets";
import type { EditorProjectSnapshot } from "../preload";
import type {
  BuildReadinessIssue,
  BuildReadinessTarget,
  EditorValidationReport,
  EditorValidationRunState
} from "../validation-report";
import { createBuildReadinessIssues, createValidationReport } from "../validation-report";

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
const defaultAnimationClipIds = ["idle", "walk", "talk"] as const;

interface AnimationClipDraft {
  fps: string;
  frames: string;
  id: string;
  loop: boolean;
}

interface AnimationPackDraft {
  assetId: string;
  defaultFacing: "right" | "left";
  footOriginX: string;
  footOriginY: string;
  frameHeight: string;
  frameWidth: string;
  gridColumns: string;
  gridRows: string;
  id: string;
  name: string;
  clips: AnimationClipDraft[];
}

type ImageGenerationEntityKind = "scene-background" | "actor" | "pickup" | "player" | "asset";
type EntityAssetTargetKind = "scene-background" | "player" | "actor" | "pickup";
type TargetBackgroundMode = NonNullable<PromptPackGenerationTarget["backgroundMode"]>;

const targetBackgroundModeOptions: Array<{ label: string; value: TargetBackgroundMode }> = [
  { label: "Opaque scene", value: "opaque-scene" },
  { label: "Transparent alpha", value: "transparent-alpha" },
  { label: "Chroma blue", value: "chroma-blue" },
  { label: "Chroma green", value: "chroma-green" },
  { label: "Reference only", value: "reference-only" }
];

interface TargetPromptDraft {
  backgroundMode?: TargetBackgroundMode;
  customNegativePrompt?: string;
  customPositivePrompt?: string;
  safetyNegativePrompt?: string;
}

type AssetTool = "info" | "chroma" | "crop" | "guide" | "animation";

interface ImageGenerationSceneContext {
  entityId?: string;
  entityKind: ImageGenerationEntityKind;
  intendedUse: PromptPackGenerationTarget["intendedUse"];
  sceneId: string;
  targetId: string;
}

interface GeneratedAssetHandoff extends ImageGenerationSceneContext {
  assetId: string;
  assetPath: string;
  backgroundMode?: PromptPackGenerationTarget["backgroundMode"];
  expectedAlpha: boolean;
  hasAlphaPixels: boolean;
  outputWarning?: string;
  seed: number;
}

interface BackgroundCleanupTarget {
  assetId: string;
  assetPath: string;
  assetUrl: string;
  entityId?: string | undefined;
  filenameHint: string;
  sceneId?: string | undefined;
  targetKind: EntityAssetTargetKind;
}

interface EntityAssetDropZoneProps {
  assetId?: string | undefined;
  assetPath?: string | undefined;
  assetUrl?: string | undefined;
  label: string;
  missing?: boolean | undefined;
  onEditAsset?: () => void;
  onDropFiles: (filePaths: string[]) => void;
  onImportClick: () => void;
  onOpenAsset?: () => void;
}

function createAnimationPackDraft(
  animationPack: AnimationPackDocument | null,
  fallbackAssetId = ""
): AnimationPackDraft {
  const clips: AnimationClipDraft[] = defaultAnimationClipIds.map((clipId, index) => {
    const existing = animationPack?.clips.find((clip) => clip.id === clipId);
    return {
      id: clipId,
      frames: existing?.frames.join(", ") ?? String(index),
      fps: String(existing?.fps ?? (clipId === "walk" ? 8 : 4)),
      loop: existing?.loop ?? true
    };
  });

  for (const clip of animationPack?.clips ?? []) {
    if (defaultAnimationClipIds.some((clipId) => clipId === clip.id)) continue;
    clips.push({
      id: clip.id,
      frames: clip.frames.join(", "),
      fps: String(clip.fps),
      loop: clip.loop
    });
  }

  return {
    assetId: animationPack?.assetId ?? fallbackAssetId,
    defaultFacing: animationPack?.defaultFacing ?? "right",
    footOriginX: String(animationPack?.footOrigin.x ?? 32),
    footOriginY: String(animationPack?.footOrigin.y ?? 63),
    frameHeight: String(animationPack?.frame.height ?? 64),
    frameWidth: String(animationPack?.frame.width ?? 64),
    gridColumns: String(animationPack?.grid.columns ?? 3),
    gridRows: String(animationPack?.grid.rows ?? 2),
    id: animationPack?.id ?? "new-animation-pack",
    name: animationPack?.name ?? "New Animation Pack",
    clips
  };
}

function nextAnimationPackId(snapshot: EditorProjectSnapshot | null): string {
  const existing = new Set(snapshot?.animationPacks.map((animationPack) => animationPack.id) ?? []);
  let counter = 0;
  let candidate = "new-animation-pack";
  while (existing.has(candidate)) {
    counter += 1;
    candidate = `new-animation-pack-${counter}`;
  }
  return candidate;
}

function parseFrameList(value: string): number[] | null {
  const frames = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => Number(entry));
  if (frames.length === 0 || frames.some((frame) => !Number.isInteger(frame) || frame < 0)) {
    return null;
  }
  return frames;
}

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
  const usage: Array<{ detail: string; sceneId?: string; sceneName?: string; type: string }> = [];
  for (const scene of sceneItems(snapshot.scenes)) {
    if (scene.background === asset.path) {
      usage.push({ detail: "Scene background", sceneId: scene.id, sceneName: scene.name, type: "scene" });
    }
    if (scene.player?.assetId === asset.id) {
      usage.push({ detail: "Player asset", sceneId: scene.id, sceneName: scene.name, type: "player" });
    }
    for (const actor of scene.actors) {
      if (actor.assetId === asset.id) {
        usage.push({ detail: `Actor ${actor.id}`, sceneId: scene.id, sceneName: scene.name, type: "actor" });
      }
    }
    for (const pickup of scene.pickups) {
      if (pickup.assetId === asset.id) {
        usage.push({ detail: `Pickup ${pickup.id}`, sceneId: scene.id, sceneName: scene.name, type: "pickup" });
      }
    }
  }
  for (const animationPack of snapshot.animationPacks) {
    if (animationPack.assetId === asset.id) {
      usage.push({ detail: `Animation pack ${animationPack.id}`, type: "animation" });
    }
  }
  for (const promptPack of snapshot.promptPacks) {
    for (const target of promptPack.outputs.generationTargets) {
      if (target.referenceAssetId === asset.id) {
        usage.push({ detail: `Reference for ${promptPack.id}/${target.id}`, type: "prompt" });
      }
      if (target.maskAssetId === asset.id) {
        usage.push({ detail: `Mask for ${promptPack.id}/${target.id}`, type: "prompt" });
      }
    }
  }
  return usage;
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

interface InspectorDetailState {
  hasSelectedFlow: boolean;
  hasSelectedHotspot: boolean;
  hasSelectedItem: boolean;
  hasSelectedLocale: boolean;
  hasSelectedPickup: boolean;
  hasSelectedScene: boolean;
  isPlayerInspectorSelected: boolean;
  workspace: Workspace;
}

type WorkspaceCapability = (typeof workspaceCapabilities)[number];

interface StageToolbarModelState {
  hasSelectedScene: boolean;
  selectedSceneActorCount: number;
  selectedSceneHotspotCount: number;
  selectedScenePickupCount: number;
  selectedSceneToolLabel: string;
  sceneLabel: string;
  workspace: Workspace;
  workspaceCapability: WorkspaceCapability;
}

interface StageToolbarModel {
  badgeLabel: string;
  badgeTone: "good" | "warn" | "error" | "muted";
  detail: string;
  primaryLabel: string;
}

function inspectorDetailFor({
  hasSelectedFlow,
  hasSelectedHotspot,
  hasSelectedItem,
  hasSelectedLocale,
  hasSelectedPickup,
  hasSelectedScene,
  isPlayerInspectorSelected,
  workspace
}: InspectorDetailState): string {
  if (workspace === "overview") return "Project";
  if (workspace === "assets") return "Library";
  if (workspace === "ai") return "AI";
  if (workspace === "build") return "Validation";
  if (hasSelectedFlow) return "Flow";
  if (hasSelectedLocale) return "Locale";
  if (isPlayerInspectorSelected) return "Player";
  if (hasSelectedHotspot) return "Hotspot";
  if (hasSelectedPickup) return "Pickup";
  if (hasSelectedItem) return "Item";
  if (hasSelectedScene) return "Scene";
  return "";
}

function stageToolbarModelFor({
  hasSelectedScene,
  selectedSceneActorCount,
  selectedSceneHotspotCount,
  selectedScenePickupCount,
  selectedSceneToolLabel,
  sceneLabel,
  workspace,
  workspaceCapability
}: StageToolbarModelState): StageToolbarModel {
  if (workspace === "scene") {
    return {
      badgeLabel: selectedSceneToolLabel,
      badgeTone: "warn",
      detail: hasSelectedScene
        ? `${selectedSceneHotspotCount} hotspot(s) / ${selectedScenePickupCount} pickup(s) / ${selectedSceneActorCount} actor(s)`
        : workspaceCapability.summary,
      primaryLabel: hasSelectedScene ? sceneLabel : workspaceCapability.label
    };
  }

  return {
    badgeLabel: capabilityBadgeLabel(workspaceCapability.status),
    badgeTone: capabilityStatusTone(workspaceCapability.status),
    detail:
      workspace === "overview"
        ? "Project command center and readiness"
        : workspace === "narrative"
          ? "Structured flow and locale editing"
          : workspaceCapability.summary,
    primaryLabel: workspaceCapability.label
  };
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

function buildSceneLayersFromDraft(
  drafts: SceneLayerDraft[],
  availableAssetIdsSet: Set<string>
): { layers: SceneLayer[]; error: string | null } {
  const layers: SceneLayer[] = [];
  const ids = new Set<string>();

  for (const [index, draft] of drafts.entries()) {
    const label = draft.name.trim() || draft.id.trim() || `Layer ${index + 1}`;
    const id = draft.id.trim();
    const name = draft.name.trim();
    const assetId = draft.assetId.trim();
    const depth = parseNumber(draft.depth);
    const opacity = parseNumber(draft.opacity);
    const x = parseNumber(draft.x);
    const y = parseNumber(draft.y);
    const width = parsePositiveNumber(draft.width);
    const height = parsePositiveNumber(draft.height);

    if (!id) return { layers, error: `${label}: layer id is required` };
    if (ids.has(id)) return { layers, error: `${label}: layer id must be unique` };
    if (!name) return { layers, error: `${label}: layer name is required` };
    if (!assetId) return { layers, error: `${label}: asset is required` };
    if (!availableAssetIdsSet.has(assetId)) return { layers, error: `${label}: asset "${assetId}" no longer exists` };
    if (depth === null) return { layers, error: `${label}: depth must be a number` };
    if (opacity === null || opacity < 0 || opacity > 1) return { layers, error: `${label}: opacity must be between 0 and 1` };
    if (x === null || y === null || width === null || height === null) {
      return { layers, error: `${label}: bounds must use valid positive numbers` };
    }

    ids.add(id);
    layers.push({
      assetId,
      bounds: { x, y, width, height },
      depth,
      id,
      locked: draft.locked,
      name,
      opacity,
      visible: draft.visible
    });
  }

  return { layers, error: null };
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
    }
  | {
      baseSession: EditorSessionState;
      guideId: string;
      kind: "generation-guide-shape";
      mode: "move" | "resize";
      startPoint: ScenePointDraftValue;
      startShape: SceneGenerationGuideShape;
    }
  | {
      baseSession: EditorSessionState;
      guideId: string;
      kind: "generation-guide-point";
      pointIndex: number;
      startPoint: ScenePointDraftValue;
      startPosition: ScenePointDraftValue;
    };

type AssetCropInteraction =
  | {
      handle: "inHandle" | "outHandle";
      kind: "handle";
      nodeIndex: number;
    }
  | {
      kind: "node";
      nodeIndex: number;
    };

type SceneTool = "select" | "actor" | "hotspot" | "pickup" | "player-start" | "walk-area";
type SceneInspectorTarget = "scene" | "player";

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

const generationGuideRoles: SceneGenerationGuideRole[] = [
  "background",
  "foreground",
  "layer",
  "prop",
  "pickup",
  "actor",
  "npc",
  "player",
  "hotspot",
  "context",
  "mask"
];

const generationGuideRoleColors: Record<SceneGenerationGuideRole, string> = {
  actor: "#ff9f43",
  background: "#54a0ff",
  context: "#8395a7",
  foreground: "#48dbfb",
  hotspot: "#feca57",
  layer: "#00d2d3",
  mask: "#ffffff",
  npc: "#ff6b6b",
  pickup: "#1dd1a1",
  player: "#5f27cd",
  prop: "#10ac84"
};

function boundsForGenerationGuideShape(shape: SceneGenerationGuideShape): Rect {
  if (shape.type !== "polygon") return shape.bounds;
  const xs = shape.points.map((point) => point.x);
  const ys = shape.points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY)
  };
}

function constrainedDeltaForBounds(
  bounds: Rect,
  delta: ScenePointDraftValue,
  size: { height: number; width: number }
): ScenePointDraftValue {
  return {
    x: Math.round(Math.min(Math.max(delta.x, -bounds.x), size.width - (bounds.x + bounds.width))),
    y: Math.round(Math.min(Math.max(delta.y, -bounds.y), size.height - (bounds.y + bounds.height)))
  };
}

function moveGenerationGuideShape(
  shape: SceneGenerationGuideShape,
  delta: ScenePointDraftValue,
  size: { height: number; width: number }
): SceneGenerationGuideShape {
  const constrainedDelta = constrainedDeltaForBounds(boundsForGenerationGuideShape(shape), delta, size);
  if (shape.type === "polygon") {
    return {
      type: "polygon",
      points: shape.points.map((point) => ({
        x: Math.round(point.x + constrainedDelta.x),
        y: Math.round(point.y + constrainedDelta.y)
      }))
    };
  }
  return {
    ...shape,
    bounds: moveSceneRect(shape.bounds, constrainedDelta, size)
  };
}

function resizeGenerationGuideShape(
  shape: SceneGenerationGuideShape,
  delta: ScenePointDraftValue,
  size: { height: number; width: number }
): SceneGenerationGuideShape {
  if (shape.type === "polygon") return shape;
  return {
    ...shape,
    bounds: resizeSceneRectFromBottomRight(shape.bounds, delta, size)
  };
}

function generationGuideShapeLabel(shape: SceneGenerationGuideShape): string {
  return shape.type === "polygon" ? `polygon (${shape.points.length})` : shape.type;
}

function generationGuideColor(guide: SceneGenerationGuide) {
  return guide.color ?? generationGuideRoleColors[guide.role];
}

function targetMatchesGenerationGuide(target: PromptPackGenerationTarget, guide: SceneGenerationGuide): boolean {
  if (target.guideIds?.includes(guide.id)) return true;
  const source = guide.source;
  if (source?.kind && target.sourceEntityKind && source.kind === target.sourceEntityKind) {
    return source.id ? source.id === target.sourceEntityId : true;
  }
  if (target.sourceEntityKind === "actor" && (guide.role === "actor" || guide.role === "npc")) return true;
  if (target.sourceEntityKind === "pickup" && guide.role === "pickup") return true;
  if (target.sourceEntityKind === "player" && guide.role === "player") return true;
  if (target.intendedUse === "scene-background" && (guide.role === "background" || guide.role === "context")) return true;
  if (target.intendedUse === "prop" && (guide.role === "prop" || guide.role === "pickup")) return true;
  if (
    (target.intendedUse === "character-reference" || target.intendedUse === "animation-reference" || target.intendedUse === "sprite-sheet") &&
    (guide.role === "actor" || guide.role === "npc" || guide.role === "player")
  ) {
    return true;
  }
  return guide.role === "mask";
}

function suggestedGenerationGuideIds(
  target: PromptPackGenerationTarget | null,
  guides: SceneGenerationGuide[]
): string[] {
  if (!target) return [];
  return guides.filter((guide) => targetMatchesGenerationGuide(target, guide)).map((guide) => guide.id);
}

function focusEditorField(element: HTMLInputElement | HTMLSelectElement | null) {
  if (!element) return;
  element.focus();
  element.scrollIntoView({ behavior: "smooth", block: "center" });
}

function imageGenerationContextForTarget(
  target: PromptPackGenerationTarget,
  scene: Layered2DScene
): ImageGenerationSceneContext {
  if (target.intendedUse === "scene-background") {
    return {
      entityKind: "scene-background",
      intendedUse: target.intendedUse,
      sceneId: scene.id,
      targetId: target.id
    };
  }

  const pickup = scene.pickups.find((entry) => entry.id === target.id);
  if (pickup) {
    return {
      entityId: pickup.id,
      entityKind: "pickup",
      intendedUse: target.intendedUse,
      sceneId: scene.id,
      targetId: target.id
    };
  }

  const actor = scene.actors.find((entry) => target.id === entry.id || target.id.startsWith(`${entry.id}-`));
  if (actor) {
    return {
      entityId: actor.id,
      entityKind: "actor",
      intendedUse: target.intendedUse,
      sceneId: scene.id,
      targetId: target.id
    };
  }

  return {
    entityKind: "asset",
    intendedUse: target.intendedUse,
    sceneId: scene.id,
    targetId: target.id
  };
}

function dimensionsForGenerationTarget(target: PromptPackGenerationTarget) {
  const fallback = target.intendedUse === "scene-background" ? 1024 : 512;
  return {
    height: Math.max(64, Math.min(2048, target.height ?? fallback)),
    width: Math.max(64, Math.min(2048, target.width ?? fallback))
  };
}

function expectedAlphaForBackgroundMode(
  backgroundMode: PromptPackGenerationTarget["backgroundMode"],
  fallback: boolean
) {
  return backgroundMode === "transparent-alpha" ? true : backgroundMode ? false : fallback;
}

function assetTypeForGenerationTarget(
  target: PromptPackGenerationTarget
): AssetGenerationRecipeDocument["assetType"] {
  if (target.intendedUse === "scene-background") return "background";
  if (target.intendedUse === "prop") return "prop";
  if (target.intendedUse === "character-reference") return "character";
  if (target.intendedUse === "sprite-sheet") return "sprite-sheet";
  if (target.intendedUse === "animation-reference") return "animation";
  return "prop";
}

function recipeIdForTarget(targetId: string, workflowId: string) {
  return `${targetId}-${workflowId}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function workflowTemplateSupportsTarget(
  template: WorkflowTemplateDocument,
  target: PromptPackGenerationTarget | null,
  workflowFamily: string
) {
  if (template.family !== workflowFamily) return false;
  if (target?.maskAssetId && !template.supportedInputs.includes("mask-image")) return false;
  if (target?.referenceAssetId && !template.supportedInputs.includes("reference-image") && template.family !== "prop_isolated_alpha_or_chroma") {
    return false;
  }
  return true;
}

function workflowTemplatePriority(template: WorkflowTemplateDocument) {
  if (template.id === "pc-background-16x9-sdxl-standard") return 0;
  if (template.id === "pc-background-16x9-t2i") return 10;
  if (template.id === "pc-background-16x9-sdxl-turbo") return 20;
  return 5;
}

function sortWorkflowTemplatesForTarget(templates: WorkflowTemplateDocument[]) {
  return [...templates].sort((left, right) => {
    const priorityDelta = workflowTemplatePriority(left) - workflowTemplatePriority(right);
    return priorityDelta || left.name.localeCompare(right.name);
  });
}

function targetWithPromptDraft(
  target: PromptPackGenerationTarget,
  draft: TargetPromptDraft | undefined
): PromptPackGenerationTarget {
  if (!draft) return target;

  const backgroundMode = draft.backgroundMode ?? target.backgroundMode;
  const expectedAlpha = expectedAlphaForBackgroundMode(
    backgroundMode,
    target.expectedAlpha ?? target.transparent ?? false
  );
  const nextTarget: PromptPackGenerationTarget = {
    ...target,
    expectedAlpha,
    transparent: expectedAlpha
  };

  delete nextTarget.backgroundMode;
  delete nextTarget.chromaColor;
  delete nextTarget.customNegativePrompt;
  delete nextTarget.customPositivePrompt;
  delete nextTarget.safetyNegativePrompt;

  if (backgroundMode) nextTarget.backgroundMode = backgroundMode;
  if (backgroundMode === "chroma-blue") nextTarget.chromaColor = "#00A2FF";
  if (backgroundMode === "chroma-green") nextTarget.chromaColor = "#00FF00";

  const customPositivePrompt = draft.customPositivePrompt?.trim() ?? target.customPositivePrompt?.trim();
  const customNegativePrompt = draft.customNegativePrompt?.trim() ?? target.customNegativePrompt?.trim();
  const safetyNegativePrompt = draft.safetyNegativePrompt?.trim() ?? target.safetyNegativePrompt?.trim();
  if (customPositivePrompt) nextTarget.customPositivePrompt = customPositivePrompt;
  if (customNegativePrompt) nextTarget.customNegativePrompt = customNegativePrompt;
  if (safetyNegativePrompt) nextTarget.safetyNegativePrompt = safetyNegativePrompt;

  return nextTarget;
}

function promptPackWithUpdatedTarget(
  promptPack: PromptPackDocument,
  targetId: string,
  nextTarget: PromptPackGenerationTarget
): PromptPackDocument {
  return {
    ...promptPack,
    outputs: {
      ...promptPack.outputs,
      generationTargets: promptPack.outputs.generationTargets.map((target) =>
        target.id === targetId ? nextTarget : target
      )
    }
  };
}

function droppedFilePaths(event: ReactDragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer.files)
    .map((file) => (file as File & { path?: string }).path)
    .filter((filePath): filePath is string => Boolean(filePath));
}

function EntityAssetDropZone({
  assetId,
  assetPath,
  assetUrl,
  label,
  missing,
  onEditAsset,
  onDropFiles,
  onImportClick,
  onOpenAsset
}: EntityAssetDropZoneProps) {
  const handleDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const filePaths = droppedFilePaths(event);
    onDropFiles(filePaths);
  };

  return (
    <div
      className={`entity-asset-drop-zone ${missing ? "missing" : ""} ${assetUrl ? "has-preview" : ""}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <div
        className="entity-asset-preview"
        style={assetUrl ? { backgroundImage: `url("${assetUrl}")` } : undefined}
        aria-hidden="true"
      >
        {assetUrl ? null : <Image size={24} />}
      </div>
      <div className="entity-asset-drop-copy">
        <span className="overview-label">{label}</span>
        <strong>{assetId || "No asset assigned"}</strong>
        <p>{missing ? "Missing registered asset" : assetPath || "Drop an image here or import one."}</p>
      </div>
      <div className="entity-asset-actions">
        <button className="secondary-action compact-action" type="button" onClick={onImportClick}>
          <FilePlus2 size={iconSize} /> Import
        </button>
        <button
          className="secondary-action compact-action"
          disabled={!assetUrl || !onEditAsset}
          type="button"
          onClick={onEditAsset}
        >
          <Eraser size={iconSize} /> Edit Asset
        </button>
        <button
          className="secondary-action compact-action"
          disabled={!assetId || !onOpenAsset}
          type="button"
          onClick={onOpenAsset}
        >
          <ExternalLink size={iconSize} /> Open Asset
        </button>
      </div>
    </div>
  );
}

function textList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string").join(" ")
    : typeof value === "string"
      ? value
      : "";
}

function imagePixelDataToPngDataUrl(imageData: ImagePixelData) {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is unavailable for image processing.");
  }
  const output = context.createImageData(imageData.width, imageData.height);
  output.data.set(imageData.data);
  context.putImageData(output, 0, 0);
  return canvas.toDataURL("image/png");
}

async function loadImageElement(assetUrl: string) {
  const image = new window.Image();
  image.decoding = "async";
  image.src = assetUrl;
  await image.decode();
  return image;
}

function traceBezierCropPath(
  context: CanvasRenderingContext2D,
  nodes: BezierCropNode[],
  offset: { x: number; y: number } = { x: 0, y: 0 }
) {
  if (nodes.length < 3) return;
  const first = nodes[0]!;
  context.moveTo(first.x - offset.x, first.y - offset.y);
  for (let index = 0; index < nodes.length; index += 1) {
    const current = nodes[index]!;
    const next = nodes[(index + 1) % nodes.length]!;
    const outHandle = current.outHandle ?? { x: current.x, y: current.y };
    const inHandle = next.inHandle ?? { x: next.x, y: next.y };
    context.bezierCurveTo(
      outHandle.x - offset.x,
      outHandle.y - offset.y,
      inHandle.x - offset.x,
      inHandle.y - offset.y,
      next.x - offset.x,
      next.y - offset.y
    );
  }
  context.closePath();
}

export function EditorApp() {
  const [workspace, setWorkspace] = useState<Workspace>("overview");
  const [status, setStatus] = useState("Loading project...");
  const [project, setProject] = useState<EditorProjectSnapshot | null>(null);
  const [projectSettingsDraft, setProjectSettingsDraft] = useState({
    defaultLocale: "",
    initialSceneId: "",
    title: "",
    viewportHeight: "",
    viewportWidth: ""
  });
  const [history, setHistory] = useState<EditorHistoryState>(emptyHistory);
  const [pendingRecovery, setPendingRecovery] = useState<EditorRecoverySnapshot | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [activeAssetTool, setActiveAssetTool] = useState<AssetTool>("info");
  const [assetEditTarget, setAssetEditTarget] = useState<BackgroundCleanupTarget | null>(null);
  const cropImageFrameRef = useRef<HTMLDivElement | null>(null);
  const [cropImageSize, setCropImageSize] = useState({ width: 256, height: 256 });
  const [cropInteraction, setCropInteraction] = useState<AssetCropInteraction | null>(null);
  const [cropPath, setCropPath] = useState<BezierCropNode[]>(() =>
    createDefaultBezierCropPath({ width: 256, height: 256 }, 16)
  );
  const [selectedCropNodeIndex, setSelectedCropNodeIndex] = useState(0);
  const [cropStatus, setCropStatus] = useState("Adjust the bezier cut path, then save a new transparent PNG asset.");
  const [guideSourceId, setGuideSourceId] = useState("");
  const [guideShape, setGuideShape] = useState<"rect" | "ellipse">("rect");
  const [guideStatus, setGuideStatus] = useState("Choose a saved prompt target and a scene guide source.");
  const [selectedAnimationPackId, setSelectedAnimationPackId] = useState<string | null>(null);
  const [selectedAnimationClipPreviewId, setSelectedAnimationClipPreviewId] = useState<string | null>(null);
  const [animationPreviewElapsedMs, setAnimationPreviewElapsedMs] = useState(0);
  const [animationPackDraft, setAnimationPackDraft] = useState<AnimationPackDraft>(
    createAnimationPackDraft(null)
  );
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
  const [selectedWorkflowPresetId, setSelectedWorkflowPresetId] = useState(workflowPresets[0]?.id ?? "");
  const [selectedWorkflowTemplateId, setSelectedWorkflowTemplateId] = useState("");
  const [comfyUiTimeoutMinutes, setComfyUiTimeoutMinutes] = useState(
    String(comfyOutputPresetById(defaultPromptPresetSelection.comfyOutputPreset).timeoutMinutes)
  );
  const [comfyUiGenerationStatus, setComfyUiGenerationStatus] = useState(
    "ComfyUI generation has not been queued yet."
  );
  const [selectedGenerationTargetId, setSelectedGenerationTargetId] = useState("");
  const [imageGenerationState, setImageGenerationState] = useState<"idle" | "running">("idle");
  const [activeImageGenerationContext, setActiveImageGenerationContext] =
    useState<ImageGenerationSceneContext | null>(null);
  const [lastGeneratedImageAsset, setLastGeneratedImageAsset] = useState<GeneratedAssetHandoff | null>(null);
  const [targetPromptDrafts, setTargetPromptDrafts] = useState<Record<string, TargetPromptDraft>>({});
  const [backgroundCleanupTarget, setBackgroundCleanupTarget] = useState<BackgroundCleanupTarget | null>(null);
  const [cleanupKeyColor, setCleanupKeyColor] = useState("#00A2FF");
  const [cleanupTolerance, setCleanupTolerance] = useState("28");
  const [cleanupFeather, setCleanupFeather] = useState("18");
  const [cleanupSpillReduction, setCleanupSpillReduction] = useState(true);
  const [cleanupPreviewUrl, setCleanupPreviewUrl] = useState<string | null>(null);
  const [cleanupSummary, setCleanupSummary] = useState<ChromaKeySummary | null>(null);
  const [cleanupStatus, setCleanupStatus] = useState("Pick a key color or adjust tolerance.");
  const [selectedPromptPackId, setSelectedPromptPackId] = useState<string | null>(null);
  const [validationRunState, setValidationRunState] = useState<EditorValidationRunState>("idle");
  const [validationReport, setValidationReport] = useState<EditorValidationReport | null>(null);
  const [validationStatus, setValidationStatus] = useState("Validation uses saved project files.");
  const [viewportInteraction, setViewportInteraction] = useState<ViewportInteraction | null>(null);
  const [activeSceneTool, setActiveSceneTool] = useState<SceneTool>("select");
  const [sceneInspectorTarget, setSceneInspectorTarget] = useState<SceneInspectorTarget>("scene");
  const [selectedSceneLayerId, setSelectedSceneLayerId] = useState<string | null>(null);
  const [selectedGenerationGuideId, setSelectedGenerationGuideId] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const cleanupSourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cleanupOutputCanvasRef = useRef<HTMLCanvasElement | null>(null);
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
  useEffect(() => {
    if (!project) {
      setProjectSettingsDraft({
        defaultLocale: "",
        initialSceneId: "",
        title: "",
        viewportHeight: "",
        viewportWidth: ""
      });
      return;
    }

    setProjectSettingsDraft({
      defaultLocale: project.manifest.defaultLocale,
      initialSceneId: project.manifest.initialSceneId,
      title: project.manifest.title,
      viewportHeight: String(project.manifest.viewport.height),
      viewportWidth: String(project.manifest.viewport.width)
    });
  }, [
    project?.manifest.defaultLocale,
    project?.manifest.initialSceneId,
    project?.manifest.title,
    project?.manifest.viewport.height,
    project?.manifest.viewport.width
  ]);

  const narrativeRelationIndex = useMemo(
    () => buildNarrativeRelationIndex(project?.scenes ?? [], project?.flows ?? []),
    [project?.flows, project?.scenes]
  );
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
  const selectedAnimationPack =
    selectedAnimationPackId && project
      ? project.animationPacks.find((animationPack) => animationPack.id === selectedAnimationPackId) ?? null
      : null;
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
  const activeStyleBible = project?.styleBibles[0] ?? null;
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
            ...(currentPickupDraft.assetId.trim() ? { assetId: currentPickupDraft.assetId.trim() } : {}),
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
  const selectedTargetPromptDraftKey =
    activeImagePromptPack && selectedGenerationTarget
      ? `${activeImagePromptPack.id}:${selectedGenerationTarget.id}`
      : "";
  const selectedTargetPromptDraft = selectedTargetPromptDraftKey
    ? targetPromptDrafts[selectedTargetPromptDraftKey]
    : undefined;
  const selectedEffectiveGenerationTarget = selectedGenerationTarget
    ? targetWithPromptDraft(selectedGenerationTarget, selectedTargetPromptDraft)
    : null;
  const selectedImageGenerationContext =
    selectedEffectiveGenerationTarget && promptPackScene
      ? imageGenerationContextForTarget(selectedEffectiveGenerationTarget, promptPackScene)
      : null;
  const selectedComfyOutputPreset = comfyOutputPresetById(comfyUiOutputPresetId);
  const selectedGenerationPromptResolution =
    activeImagePromptPack && selectedEffectiveGenerationTarget
      ? resolvePromptForGenerationTarget(activeImagePromptPack, selectedEffectiveGenerationTarget)
      : null;
  const selectedGenerationBasePrompt = selectedGenerationPromptResolution?.prompt ?? "";
  const selectedGenerationPrompt = selectedEffectiveGenerationTarget
    ? composeTargetPositivePrompt(selectedGenerationBasePrompt, selectedEffectiveGenerationTarget, activeStyleBible)
    : "";
  const selectedGenerationNegativePrompt =
    activeImagePromptPack && selectedEffectiveGenerationTarget
      ? composeTargetNegativePrompt(activeImagePromptPack, selectedEffectiveGenerationTarget, activeStyleBible)
      : "";
  const targetGenerationDimensions = selectedEffectiveGenerationTarget
    ? dimensionsForGenerationTarget(selectedEffectiveGenerationTarget)
    : { height: 512, width: 512 };
  const selectedGenerationDimensions =
    selectedComfyOutputPreset.id === "target_default"
      ? targetGenerationDimensions
      : { height: selectedComfyOutputPreset.height, width: selectedComfyOutputPreset.width };
  const selectedImageTargetWorkflow = describeImageTargetWorkflow(
    selectedEffectiveGenerationTarget,
    selectedComfyOutputPreset,
    selectedGenerationPrompt
  );
  const selectedImageWorkflowFamily = estimateImageWorkflowFamily(selectedEffectiveGenerationTarget);
  const compatibleWorkflowTemplates = project
    ? sortWorkflowTemplatesForTarget(
        project.workflowTemplates.filter((template) =>
          workflowTemplateSupportsTarget(template, selectedEffectiveGenerationTarget, selectedImageWorkflowFamily)
        )
      )
    : [];
  const selectedWorkflowTemplate =
    compatibleWorkflowTemplates.find((template) => template.id === selectedWorkflowTemplateId) ??
    compatibleWorkflowTemplates[0] ??
    null;
  const selectedRecipeId =
    selectedEffectiveGenerationTarget && selectedWorkflowTemplate
      ? recipeIdForTarget(selectedEffectiveGenerationTarget.id, selectedWorkflowTemplate.id)
      : "";
  const selectedGenerationRecipe = selectedRecipeId
    ? project?.generationRecipes.find((recipe) => recipe.id === selectedRecipeId) ?? null
    : null;
  const selectedImageInputWorkflowWarning =
    selectedEffectiveGenerationTarget?.referenceAssetId || selectedEffectiveGenerationTarget?.maskAssetId
      ? selectedWorkflowTemplate || comfyUiWorkflowPath.trim()
        ? null
        : "Linked reference or mask assets require an installed compatible workflow template or a legacy workflow API JSON path."
      : null;
  const selectedImageTargetWorkflowTone =
    selectedImageInputWorkflowWarning || selectedImageTargetWorkflow.mode === "inpaint"
      ? "warn"
      : selectedImageTargetWorkflow.mode === "chroma" || selectedImageTargetWorkflow.mode === "reference"
      ? "info"
      : selectedImageTargetWorkflow.mode === "transparent"
        ? "warn"
        : "good";
  const projectHealth = project ? healthSummary(project.diagnostics, dirtyState.count) : null;
  const projectSceneOptions = useMemo(
    () => scenes.map((scene) => ({ id: scene.id, label: `${scene.name} (${scene.id})` })),
    [scenes]
  );
  const projectLocaleOptions = useMemo(
    () => (project?.locales ?? []).map((locale) => ({ id: locale.locale, label: locale.locale })),
    [project?.locales]
  );
  const hasProjectSettingsChanges = !!project && (
    projectSettingsDraft.title !== project.manifest.title ||
    projectSettingsDraft.initialSceneId !== project.manifest.initialSceneId ||
    projectSettingsDraft.defaultLocale !== project.manifest.defaultLocale ||
    projectSettingsDraft.viewportWidth !== String(project.manifest.viewport.width) ||
    projectSettingsDraft.viewportHeight !== String(project.manifest.viewport.height)
  );
  const currentValidationReport =
    validationReport ??
    (project ? createValidationReport(project.directory, project.diagnostics, "") : null);
  const buildReadinessIssues = useMemo(
    () => createBuildReadinessIssues(currentValidationReport?.diagnostics ?? []),
    [currentValidationReport]
  );
  const buildBlockingIssues = buildReadinessIssues.filter((issue) => issue.severity === "error");
  const buildWarningIssues = buildReadinessIssues.filter((issue) => issue.severity === "warning");
  const buildReadinessTone =
    buildBlockingIssues.length > 0 ? "error" : buildWarningIssues.length > 0 || dirtyState.count > 0 ? "warn" : "good";
  const buildReadinessSummary =
    buildBlockingIssues.length > 0
      ? `${buildBlockingIssues.length} blocker(s) before preview`
      : buildWarningIssues.length > 0
        ? `${buildWarningIssues.length} warning(s) to review`
        : dirtyState.count > 0
          ? `${dirtyState.count} unsaved draft change(s)`
          : "Preview ready";
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
  const selectedAssetUrl = selectedAsset ? assetPreviewUrls[selectedAsset.path] : undefined;
  const cropSvgPath = buildBezierCropSvgPath(cropPath);
  const selectedCropNode = cropPath[selectedCropNodeIndex] ?? cropPath[0] ?? null;
  const cropPreviewBounds = bezierCropPathBounds(cropPath, cropImageSize);
  const cropControlRadius = Math.max(8, Math.round(Math.min(cropImageSize.width, cropImageSize.height) * 0.012));
  const currentGenerationGuides = currentSceneDraft.generationGuides;
  const selectedGenerationGuide =
    currentGenerationGuides.find((guide) => guide.id === selectedGenerationGuideId) ??
    currentGenerationGuides[0] ??
    null;
  const savedPromptPackTargets = selectedPromptPack?.outputs.generationTargets ?? [];
  const selectedSavedGenerationTarget =
    savedPromptPackTargets.find((target) => target.id === selectedGenerationTargetId) ??
    savedPromptPackTargets[0] ??
    null;
  const promptPackGuideScene =
    selectedPromptPack && project ? sceneFromSnapshot(project, selectedPromptPack.sceneId) : promptPackScene;
  const savedPromptPackGuides = promptPackGuideScene?.generationGuides ?? [];
  const selectedTargetGuideIds =
    selectedEffectiveGenerationTarget?.guideIds ??
    suggestedGenerationGuideIds(selectedEffectiveGenerationTarget, savedPromptPackGuides);
  const selectedTargetGuides = savedPromptPackGuides.filter((guide) => selectedTargetGuideIds.includes(guide.id));
  const guideSourceOptions = useMemo(() => {
    if (!selectedScene) return [];
    return [
      {
        bounds: { x: 0, y: 0, width: selectedScene.size.width, height: selectedScene.size.height },
        id: `${selectedScene.id}:scene`,
        label: `${selectedScene.name} full scene`,
        shape: "rect" as const
      },
      ...selectedScene.actors.map((actor) => ({
        bounds: actor.bounds,
        id: `${selectedScene.id}:actor:${actor.id}`,
        label: `Actor ${actor.id}`,
        shape: "rect" as const
      })),
      ...selectedScene.pickups.map((pickup) => ({
        bounds: pickup.bounds,
        id: `${selectedScene.id}:pickup:${pickup.id}`,
        label: `Pickup ${pickup.id}`,
        shape: "rect" as const
      })),
      ...selectedScene.shapes.map((shape) => ({
        bounds: shape.bounds,
        id: `${selectedScene.id}:shape:${shape.id}`,
        label: `Shape ${shape.id}`,
        shape: shape.shape
      }))
    ];
  }, [selectedScene]);
  const selectedGuideSource =
    guideSourceOptions.find((option) => option.id === guideSourceId) ?? guideSourceOptions[0] ?? null;
  const canEditViewportScene = workspace === "scene" && !!selectedScene;
  const selectedSceneToolLabel = sceneToolLabel(activeSceneTool);
  const selectedSceneToolHint = sceneToolHint(activeSceneTool);
  const isPlayerInspectorSelected =
    workspace === "scene" &&
    sceneInspectorTarget === "player" &&
    !selectedSceneLayerId &&
    !selectedActor &&
    !selectedHotspot &&
    !selectedPickup &&
    !selectedFlow &&
    !selectedLocale &&
    !selectedItem;
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
  const previewSceneBackgroundAsset = imageAssets.find((asset) => asset.path === previewSceneBackground) ?? null;
  const animationPreviewClip = chooseAnimationPreviewClip(
    animationPackDraft.clips,
    selectedAnimationClipPreviewId
  );
  const animationPreviewAssetPath = animationPackDraft.assetId.trim()
    ? assetPathById.get(animationPackDraft.assetId.trim())
    : undefined;
  const animationPreviewAssetUrl = animationPreviewAssetPath
    ? assetPreviewUrls[animationPreviewAssetPath]
    : undefined;
  const animationPreviewState = buildAnimationClipPreviewState(
    animationPackDraft,
    animationPreviewClip,
    animationPreviewElapsedMs
  );
  const animationSliceCells = useMemo(
    () => buildAnimationFrameSliceCells(animationPackDraft),
    [animationPackDraft.gridColumns, animationPackDraft.gridRows]
  );
  const animationPreviewClipFrameSet = useMemo(
    () => new Set(animationPreviewClip ? parsePreviewFrameList(animationPreviewClip.frames) ?? [] : []),
    [animationPreviewClip?.frames]
  );
  const animationPreviewStatus =
    animationPreviewIssue(animationPackDraft, animationPreviewClip, animationPreviewAssetUrl) ??
    animationPreviewState?.status ??
    "Clip preview is ready.";
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
  const currentActorAssetId = currentActorDraft.assetId.trim();
  const currentActorAsset = project?.assets.find((asset) => asset.id === currentActorAssetId) ?? null;
  const currentActorAssetPath = currentActorAssetId ? assetPathById.get(currentActorAssetId) : undefined;
  const currentActorAssetUrl = currentActorAssetPath ? assetPreviewUrls[currentActorAssetPath] : undefined;
  const currentPickupAssetId = currentPickupDraft.assetId.trim();
  const currentPickupAsset = project?.assets.find((asset) => asset.id === currentPickupAssetId) ?? null;
  const currentPickupAssetPath = currentPickupAssetId ? assetPathById.get(currentPickupAssetId) : undefined;
  const currentPickupAssetUrl = currentPickupAssetPath ? assetPreviewUrls[currentPickupAssetPath] : undefined;
  const currentPlayerAsset =
    project?.assets.find((asset) => asset.id === currentSceneDraft.playerAssetId.trim()) ?? null;
  const previewAssetPaths = useMemo(() => {
    const paths = new Set<string>();
    if (selectedAsset?.path) {
      paths.add(selectedAsset.path);
    }
    if (previewSceneBackground && !isHexColor(previewSceneBackground)) {
      paths.add(previewSceneBackground);
    }
    if (previewPlayerAssetPath) {
      paths.add(previewPlayerAssetPath);
    }
    if (animationPreviewAssetPath) {
      paths.add(animationPreviewAssetPath);
    }
    for (const layer of currentSceneDraft.layers) {
      const assetPath = layer.assetId.trim() ? assetPathById.get(layer.assetId.trim()) : null;
      if (assetPath) paths.add(assetPath);
    }
    for (const actor of previewActors) {
      const assetPath = actor.assetId ? assetPathById.get(actor.assetId) : null;
      if (assetPath) paths.add(assetPath);
    }
    for (const pickup of previewPickups) {
      const assetPath = pickup.assetId ? assetPathById.get(pickup.assetId) : null;
      if (assetPath) paths.add(assetPath);
    }
    return [...paths];
  }, [
    animationPreviewAssetPath,
    assetPathById,
    currentSceneDraft.layers,
    previewActors,
    previewPickups,
    previewPlayerAssetPath,
    previewSceneBackground,
    selectedAsset?.path
  ]);

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
    if (compatibleWorkflowTemplates.length === 0) {
      if (selectedWorkflowTemplateId) setSelectedWorkflowTemplateId("");
      return;
    }
    if (!compatibleWorkflowTemplates.some((template) => template.id === selectedWorkflowTemplateId)) {
      setSelectedWorkflowTemplateId(compatibleWorkflowTemplates[0]?.id ?? "");
    }
  }, [compatibleWorkflowTemplates, selectedWorkflowTemplateId]);

  useEffect(() => {
    if (!guideSourceOptions.length) {
      if (guideSourceId) setGuideSourceId("");
      return;
    }
    if (!guideSourceOptions.some((option) => option.id === guideSourceId)) {
      setGuideSourceId(guideSourceOptions[0]!.id);
    }
  }, [guideSourceId, guideSourceOptions]);

  useEffect(() => {
    if (!currentGenerationGuides.length) {
      if (selectedGenerationGuideId) setSelectedGenerationGuideId(null);
      return;
    }
    if (!selectedGenerationGuideId || !currentGenerationGuides.some((guide) => guide.id === selectedGenerationGuideId)) {
      setSelectedGenerationGuideId(currentGenerationGuides[0]!.id);
    }
  }, [currentGenerationGuides, selectedGenerationGuideId]);

  useEffect(() => {
    setCropInteraction(null);
    setSelectedCropNodeIndex(0);
    if (!selectedAssetUrl) {
      const fallbackSize = { width: 256, height: 256 };
      setCropImageSize(fallbackSize);
      setCropPath(createDefaultBezierCropPath(fallbackSize, 16));
      setCropStatus("Select a previewable image asset before cropping.");
      setGuideStatus("Choose a saved prompt target and a scene guide source.");
      return;
    }

    let cancelled = false;
    loadImageElement(selectedAssetUrl)
      .then((image) => {
        if (cancelled) return;
        const size = { width: image.naturalWidth, height: image.naturalHeight };
        setCropImageSize(size);
        setCropPath(createDefaultBezierCropPath(size, Math.round(Math.min(size.width, size.height) * 0.04)));
        setCropStatus("Adjust the bezier cut path, then save a new transparent PNG asset.");
      })
      .catch((error) => {
        if (cancelled) return;
        setCropStatus(error instanceof Error ? error.message : "Asset preview could not be loaded for cropping.");
      });
    setGuideStatus("Choose a saved prompt target and a scene guide source.");

    return () => {
      cancelled = true;
    };
  }, [selectedAsset?.id, selectedAssetUrl]);

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

  useEffect(() => {
    if (!backgroundCleanupTarget) return;
    void renderBackgroundCleanupPreview();
  }, [
    backgroundCleanupTarget?.assetUrl,
    cleanupFeather,
    cleanupKeyColor,
    cleanupSpillReduction,
    cleanupTolerance
  ]);

  useEffect(() => {
    if (workspace !== "assets" || activeAssetTool !== "chroma" || !selectedAsset || !selectedAssetUrl) return;
    openBackgroundCleanup({
      assetId: selectedAsset.id,
      assetPath: selectedAsset.path,
      assetUrl: selectedAssetUrl,
      filenameHint: `${selectedAsset.id}-alpha.png`,
      targetKind: assetEditTarget?.targetKind ?? "scene-background",
      ...(assetEditTarget?.entityId ? { entityId: assetEditTarget.entityId } : {}),
      ...(assetEditTarget?.sceneId ? { sceneId: assetEditTarget.sceneId } : selectedScene ? { sceneId: selectedScene.id } : {})
    });
  }, [activeAssetTool, selectedAsset?.id, selectedAssetUrl, workspace]);

  useEffect(() => {
    if (!cropInteraction) return;

    const handlePointerMove = (event: PointerEvent) => {
      const point = cropPointFromClient(event.clientX, event.clientY);
      if (!point) return;
      setCropPath((current) =>
        cropInteraction.kind === "node"
          ? moveBezierCropNode(current, cropInteraction.nodeIndex, point, cropImageSize)
          : moveBezierCropHandle(current, cropInteraction.nodeIndex, cropInteraction.handle, point, cropImageSize)
      );
    };

    const handlePointerUp = () => {
      setCropInteraction(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [cropImageSize, cropInteraction]);

  useEffect(() => {
    if (workspace !== "assets" || !animationPreviewClip) {
      setAnimationPreviewElapsedMs(0);
      return;
    }

    const startedAt = performance.now();
    setAnimationPreviewElapsedMs(0);
    const interval = window.setInterval(() => {
      setAnimationPreviewElapsedMs(performance.now() - startedAt);
    }, 100);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    animationPreviewClip?.fps,
    animationPreviewClip?.frames,
    animationPreviewClip?.id,
    animationPreviewClip?.loop,
    workspace
  ]);

  const defaultLocaleDocument = useMemo(
    () =>
      project?.locales.find((locale) => locale.locale === project.manifest.defaultLocale) ?? null,
    [project]
  );
  const defaultLocaleId = defaultLocaleDocument?.locale ?? project?.manifest.defaultLocale ?? "default locale";
  const defaultLocaleStrings = defaultLocaleDocument?.strings ?? null;
  const availableAssetIds = useMemo(() => (project ? project.assets.map((asset) => asset.id) : []), [project]);
  const availableAssetIdsSet = useMemo(() => new Set(availableAssetIds), [availableAssetIds]);
  const previewSceneLayers = useMemo(() => {
    const built = buildSceneLayersFromDraft(currentSceneDraft.layers, availableAssetIdsSet);
    return built.layers.map((layer) => {
      const assetPath = assetPathById.get(layer.assetId);
      return {
        ...layer,
        assetUrl: assetPath ? assetPreviewUrls[assetPath] : undefined
      };
    });
  }, [assetPathById, assetPreviewUrls, availableAssetIdsSet, currentSceneDraft.layers]);
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
    const assetId = currentPickupDraft.assetId.trim();

    if (!itemId) {
      blockingIssues.push("Pickup item is required.");
    } else if (!availableItemIdsSet.has(itemId)) {
      blockingIssues.push(`Pickup item "${itemId}" no longer exists.`);
    }

    if (pickupFlowId && !availableFlowIdsSet.has(pickupFlowId)) {
      blockingIssues.push(`Pickup flow "${pickupFlowId}" no longer exists.`);
    }

    if (assetId && !availableAssetIdsSet.has(assetId)) {
      blockingIssues.push(`Pickup asset "${assetId}" no longer exists.`);
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
    availableAssetIdsSet,
    availableItemIdsSet,
    currentPickupDraft.assetId,
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
  const pickupAssetMissing =
    !!currentPickupDraft.assetId.trim() && !availableAssetIdsSet.has(currentPickupDraft.assetId.trim());
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

  const setGenerationGuideShapeDraft = (guideId: string, shape: SceneGenerationGuideShape) => {
    if (!selectedScene) return;

    updatePresentWithoutHistory((current) => {
      const sceneDraft = current.sceneDrafts[selectedScene.id] ?? createSceneDraft(selectedScene);
      return {
        ...current,
        sceneDrafts: {
          ...current.sceneDrafts,
          [selectedScene.id]: {
            ...sceneDraft,
            generationGuides: sceneDraft.generationGuides.map((guide) =>
              guide.id === guideId ? { ...guide, shape } : guide
            )
          }
        }
      };
    });
  };

  const setGenerationGuidePolygonPointDraft = (
    guideId: string,
    pointIndex: number,
    point: ScenePointDraftValue
  ) => {
    if (!selectedScene) return;

    updatePresentWithoutHistory((current) => {
      const sceneDraft = current.sceneDrafts[selectedScene.id] ?? createSceneDraft(selectedScene);
      return {
        ...current,
        sceneDrafts: {
          ...current.sceneDrafts,
          [selectedScene.id]: {
            ...sceneDraft,
            generationGuides: sceneDraft.generationGuides.map((guide) =>
              guide.id === guideId && guide.shape.type === "polygon"
                ? {
                    ...guide,
                    shape: {
                      type: "polygon",
                      points: guide.shape.points.map((currentPoint, index) =>
                        index === pointIndex ? { x: point.x, y: point.y } : currentPoint
                      )
                    }
                  }
                : guide
            )
          }
        }
      };
    });
  };

  const insertGenerationGuidePolygonPointAfter = (
    guideId: string,
    afterIndex: number,
    point: ScenePointDraftValue
  ) => {
    if (!selectedScene) return;

    updateDraftWithHistory((current) => {
      const sceneDraft = current.sceneDrafts[selectedScene.id] ?? createSceneDraft(selectedScene);
      return {
        ...current,
        sceneDrafts: {
          ...current.sceneDrafts,
          [selectedScene.id]: {
            ...sceneDraft,
            generationGuides: sceneDraft.generationGuides.map((guide) =>
              guide.id === guideId && guide.shape.type === "polygon"
                ? {
                    ...guide,
                    shape: {
                      type: "polygon",
                      points: insertDraftPointAfter(guide.shape.points, afterIndex, point)
                    }
                  }
                : guide
            )
          }
        }
      };
    });
  };

  const removeGenerationGuidePolygonPoint = (guideId: string, pointIndex: number) => {
    if (!selectedScene) return;

    updateDraftWithHistory((current) => {
      const sceneDraft = current.sceneDrafts[selectedScene.id] ?? createSceneDraft(selectedScene);
      return {
        ...current,
        sceneDrafts: {
          ...current.sceneDrafts,
          [selectedScene.id]: {
            ...sceneDraft,
            generationGuides: sceneDraft.generationGuides.map((guide) =>
              guide.id === guideId && guide.shape.type === "polygon" && guide.shape.points.length > 3
                ? {
                    ...guide,
                    shape: {
                      type: "polygon",
                      points: guide.shape.points.filter((_, index) => index !== pointIndex)
                    }
                  }
                : guide
            )
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
    selectPlayerInScene();
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

  const canEditGenerationGuideInViewport = (guide: SceneGenerationGuide) =>
    !!selectedScene && canEditViewportScene && selectedGenerationGuide?.id === guide.id && !guide.locked;

  const startGenerationGuideShapeInteraction = (
    guide: SceneGenerationGuide,
    mode: "move" | "resize",
    event: ReactPointerEvent
  ) => {
    if (!canEditGenerationGuideInViewport(guide)) return;
    if (mode === "resize" && guide.shape.type === "polygon") return;

    const startPoint = scenePointFromClient(event.clientX, event.clientY);
    if (!startPoint) return;

    event.preventDefault();
    event.stopPropagation();
    setSelectedGenerationGuideId(guide.id);
    setSceneInspectorTarget("scene");
    setViewportInteraction({
      baseSession: cloneSessionState(history.present),
      guideId: guide.id,
      kind: "generation-guide-shape",
      mode,
      startPoint,
      startShape: guide.shape
    });
  };

  const startGenerationGuidePointInteraction = (
    guide: SceneGenerationGuide,
    pointIndex: number,
    point: ScenePointDraftValue,
    event: ReactPointerEvent
  ) => {
    if (!canEditGenerationGuideInViewport(guide) || guide.shape.type !== "polygon") return;

    if (event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      removeGenerationGuidePolygonPoint(guide.id, pointIndex);
      return;
    }

    const startPoint = scenePointFromClient(event.clientX, event.clientY);
    if (!startPoint) return;

    event.preventDefault();
    event.stopPropagation();
    setViewportInteraction({
      baseSession: cloneSessionState(history.present),
      guideId: guide.id,
      kind: "generation-guide-point",
      pointIndex,
      startPoint,
      startPosition: point
    });
  };

  const insertGenerationGuidePointFromEvent = (
    guide: SceneGenerationGuide,
    afterIndex: number,
    event: ReactPointerEvent
  ) => {
    if (!canEditGenerationGuideInViewport(guide) || guide.shape.type !== "polygon") return;

    const point = scenePointFromClient(event.clientX, event.clientY);
    if (!point) return;

    event.preventDefault();
    event.stopPropagation();
    insertGenerationGuidePolygonPointAfter(guide.id, afterIndex, point);
  };

  const cropPointFromClient = (clientX: number, clientY: number): ScenePointDraftValue | null => {
    const frame = cropImageFrameRef.current;
    if (!frame || cropImageSize.width <= 0 || cropImageSize.height <= 0) return null;
    const rect = frame.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const imageAspect = cropImageSize.width / cropImageSize.height;
    const frameAspect = rect.width / rect.height;
    const displayWidth = frameAspect > imageAspect ? rect.height * imageAspect : rect.width;
    const displayHeight = frameAspect > imageAspect ? rect.height : rect.width / imageAspect;
    const displayLeft = rect.left + (rect.width - displayWidth) / 2;
    const displayTop = rect.top + (rect.height - displayHeight) / 2;

    return {
      x: Math.round(Math.min(Math.max(((clientX - displayLeft) / displayWidth) * cropImageSize.width, 0), cropImageSize.width)),
      y: Math.round(Math.min(Math.max(((clientY - displayTop) / displayHeight) * cropImageSize.height, 0), cropImageSize.height))
    };
  };

  const startCropNodeInteraction = (nodeIndex: number, event: ReactPointerEvent) => {
    if (activeAssetTool !== "crop" || !selectedAssetUrl) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.shiftKey) {
      setCropPath((current) => removeBezierCropNode(current, nodeIndex));
      setSelectedCropNodeIndex((current) => Math.min(current, Math.max(0, cropPath.length - 2)));
      return;
    }
    setSelectedCropNodeIndex(nodeIndex);
    setCropInteraction({ kind: "node", nodeIndex });
  };

  const startCropHandleInteraction = (
    nodeIndex: number,
    handle: "inHandle" | "outHandle",
    event: ReactPointerEvent
  ) => {
    if (activeAssetTool !== "crop" || !selectedAssetUrl) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedCropNodeIndex(nodeIndex);
    setCropInteraction({ handle, kind: "handle", nodeIndex });
  };

  const insertCropNodeFromEvent = (afterIndex: number, event: ReactPointerEvent) => {
    if (activeAssetTool !== "crop" || !selectedAssetUrl) return;
    const point = cropPointFromClient(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    setCropPath((current) => insertBezierCropNodeAfter(current, afterIndex, point, cropImageSize));
    setSelectedCropNodeIndex(afterIndex + 1);
  };

  const updateCropNodePosition = (nodeIndex: number, axis: "x" | "y", value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    setCropPath((current) => {
      const node = current[nodeIndex];
      if (!node) return current;
      return moveBezierCropNode(current, nodeIndex, { x: axis === "x" ? parsed : node.x, y: axis === "y" ? parsed : node.y }, cropImageSize);
    });
  };

  const updateCropNodeMode = (nodeIndex: number, mode: BezierCropNodeMode) => {
    setCropPath((current) => setBezierCropNodeMode(current, nodeIndex, mode, cropImageSize));
  };

  const resetCropPath = () => {
    setSelectedCropNodeIndex(0);
    setCropPath(createDefaultBezierCropPath(cropImageSize, Math.round(Math.min(cropImageSize.width, cropImageSize.height) * 0.04)));
    setCropStatus("Crop path reset.");
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
      setSelectedAnimationPackId(snapshot.selectedAnimationPack?.id ?? snapshot.animationPacks[0]?.id ?? null);
      setAnimationPackDraft(
        createAnimationPackDraft(
          snapshot.selectedAnimationPack ?? snapshot.animationPacks[0] ?? null,
          snapshot.assets.find((asset) => asset.kind === "image")?.id ?? ""
        )
      );
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
    if (!project) {
      setSelectedAnimationPackId(null);
      setAnimationPackDraft(createAnimationPackDraft(null));
      return;
    }

    const fallbackAssetId = project.assets.find((asset) => asset.kind === "image")?.id ?? "";
    if (!selectedAnimationPackId) return;

    const selected = project.animationPacks.find((animationPack) => animationPack.id === selectedAnimationPackId) ?? null;
    if (!selected) {
      setSelectedAnimationPackId(null);
      setAnimationPackDraft(createAnimationPackDraft(null, fallbackAssetId));
      return;
    }
    setAnimationPackDraft(createAnimationPackDraft(selected, fallbackAssetId));
  }, [project, selectedAnimationPackId]);

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

      if (viewportInteraction.kind === "generation-guide-point") {
        setGenerationGuidePolygonPointDraft(
          viewportInteraction.guideId,
          viewportInteraction.pointIndex,
          moveScenePoint(viewportInteraction.startPosition, delta, previewSceneSize)
        );
        return;
      }

      if (viewportInteraction.kind === "generation-guide-shape") {
        setGenerationGuideShapeDraft(
          viewportInteraction.guideId,
          viewportInteraction.mode === "move"
            ? moveGenerationGuideShape(viewportInteraction.startShape, delta, previewSceneSize)
            : resizeGenerationGuideShape(viewportInteraction.startShape, delta, previewSceneSize)
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

  const updateProjectSettingsDraft = (
    field: keyof typeof projectSettingsDraft,
    value: string
  ) => {
    setProjectSettingsDraft((current) => ({
      ...current,
      [field]: value
    }));
  };

  const saveProjectSettings = async () => {
    if (!project) return;

    const title = projectSettingsDraft.title.trim();
    const viewportWidth = Number(projectSettingsDraft.viewportWidth);
    const viewportHeight = Number(projectSettingsDraft.viewportHeight);

    if (!title) {
      setStatus("Project title is required.");
      return;
    }
    if (!Number.isFinite(viewportWidth) || viewportWidth < 320) {
      setStatus("Project viewport width must be at least 320.");
      return;
    }
    if (!Number.isFinite(viewportHeight) || viewportHeight < 180) {
      setStatus("Project viewport height must be at least 180.");
      return;
    }

    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "project/update-settings",
        patch: {
          defaultLocale: projectSettingsDraft.defaultLocale,
          initialSceneId: projectSettingsDraft.initialSceneId,
          title,
          viewport: {
            height: Math.round(viewportHeight),
            width: Math.round(viewportWidth)
          }
        }
      });
      setProject(snapshot);
      setStatus(`Updated project settings for ${snapshot.manifest.title}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Project settings could not be saved");
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

  const assignAssetToTargetDraft = (
    targetKind: EntityAssetTargetKind,
    asset: AssetDocument,
    target?: BackgroundCleanupTarget | null
  ) => {
    if (targetKind === "scene-background") {
      updateSceneDraft("background", asset.path);
      setStatus(`Assigned ${asset.id} as the scene background draft. Apply Scene Changes to save.`);
      return;
    }
    if (targetKind === "player") {
      updateSceneDraft("playerAssetId", asset.id);
      setStatus(`Assigned ${asset.id} to the player draft. Apply Scene Changes to save.`);
      return;
    }
    if (targetKind === "actor") {
      const sceneId = target?.sceneId ?? selectedScene?.id;
      const actorId = target?.entityId ?? selectedActor?.id;
      if (!sceneId || !actorId) return;
      updateActorDraftById(sceneId, actorId, { assetId: asset.id });
      setStatus(`Assigned ${asset.id} to actor ${actorId}. Apply Actor Changes to save.`);
      return;
    }
    if (targetKind === "pickup") {
      const sceneId = target?.sceneId ?? selectedScene?.id;
      const pickupId = target?.entityId ?? selectedPickup?.id;
      if (!sceneId || !pickupId) return;
      updatePickupDraftById(sceneId, pickupId, { assetId: asset.id });
      setStatus(`Assigned ${asset.id} to pickup ${pickupId}. Apply Pickup Changes to save.`);
    }
  };

  const importAssetFilesForTarget = async (filePaths: string[], targetKind: EntityAssetTargetKind) => {
    if (!project) {
      setStatus("Open or create a project before importing assets.");
      return;
    }
    if (filePaths.length === 0) {
      setStatus("Dropped file paths are unavailable. Use Import instead.");
      return;
    }

    setStatus(`Importing ${filePaths.length} asset file(s)...`);
    try {
      const result = await window.pointClick.importAssetFiles(filePaths);
      const assetId = result.assetIds[0];
      const asset = assetId ? result.snapshot.assets.find((entry) => entry.id === assetId) : null;
      setProject(result.snapshot);
      if (asset) {
        setSelectedAssetId(asset.id);
        assignAssetToTargetDraft(targetKind, asset);
        setStatus(
          `Imported ${result.assetIds.length} asset(s); assigned ${asset.id}. Apply changes to save the entity.`
        );
      } else {
        setStatus(`Imported ${result.assetIds.length} asset(s).`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Dropped assets could not be imported");
    }
  };

  const importPickedAssetForTarget = async (targetKind: EntityAssetTargetKind) => {
    if (!project) {
      setStatus("Open or create a project before importing assets.");
      return;
    }
    const beforeIds = new Set(project.assets.map((asset) => asset.id));
    setStatus("Importing asset...");
    try {
      const snapshot = await window.pointClick.importAssets();
      if (!snapshot) {
        setStatus("Asset import cancelled");
        return;
      }
      const asset = snapshot.assets.find((entry) => !beforeIds.has(entry.id)) ?? snapshot.assets.at(-1) ?? null;
      setProject(snapshot);
      if (asset) {
        setSelectedAssetId(asset.id);
        assignAssetToTargetDraft(targetKind, asset);
        return;
      }
      setStatus("No new asset was imported.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Asset could not be imported");
    }
  };

  const openAssetStudioForAsset = (
    targetKind: EntityAssetTargetKind,
    asset: AssetDocument | null | undefined,
    assetUrl: string | undefined,
    entityId?: string,
    tool: AssetTool = "info"
  ) => {
    if (!asset || !assetUrl) {
      setStatus("Assign a previewable image asset before opening Asset Studio.");
      return;
    }
    const target = {
      assetId: asset.id,
      assetPath: asset.path,
      assetUrl,
      entityId,
      filenameHint: `${asset.id}-alpha.png`,
      sceneId: selectedScene?.id,
      targetKind
    };
    setSelectedAssetId(asset.id);
    setActiveAssetTool(tool);
    setAssetEditTarget(target);
    setWorkspace("assets");
    if (tool === "chroma") {
      openBackgroundCleanup(target);
    }
    setStatus(`Opened ${asset.id} in Asset Studio.`);
  };

  const createAnimationPackDraftFromSelection = () => {
    const nextId = nextAnimationPackId(project);
    const fallbackAssetId = project?.assets.find((asset) => asset.kind === "image")?.id ?? "";
    setSelectedAnimationPackId(null);
    setAnimationPackDraft({
      ...createAnimationPackDraft(null, fallbackAssetId),
      id: nextId,
      name: "New Animation Pack"
    });
    setWorkspace("assets");
    setStatus(`Drafting animation pack ${nextId}`);
  };

  const updateAnimationPackDraft = <K extends keyof AnimationPackDraft>(
    field: K,
    value: AnimationPackDraft[K]
  ) => {
    setAnimationPackDraft((current) => ({ ...current, [field]: value }));
  };

  const updateAnimationClipDraft = (index: number, patch: Partial<AnimationClipDraft>) => {
    setAnimationPackDraft((current) => ({
      ...current,
      clips: current.clips.map((clip, clipIndex) =>
        clipIndex === index ? { ...clip, ...patch } : clip
      )
    }));
  };

  const appendFrameToAnimationClip = (frame: number) => {
    const clipId = animationPreviewClip?.id ?? animationPackDraft.clips[0]?.id ?? null;
    if (!clipId) {
      setStatus("Add a clip before selecting frames from the spritesheet.");
      return;
    }

    setSelectedAnimationClipPreviewId(clipId);
    setAnimationPackDraft((current) => ({
      ...current,
      clips: current.clips.map((clip) => {
        if (clip.id !== clipId) return clip;
        const frames = parsePreviewFrameList(clip.frames);
        return {
          ...clip,
          frames: frames ? [...frames, frame].join(", ") : String(frame)
        };
      })
    }));
    setStatus(`Added frame ${frame} to clip ${clipId}.`);
  };

  const buildAnimationPackFromDraft = (): AnimationPackDocument | null => {
    const id = animationPackDraft.id.trim();
    const name = animationPackDraft.name.trim();
    const assetId = animationPackDraft.assetId.trim();
    const frameWidth = parsePositiveNumber(animationPackDraft.frameWidth);
    const frameHeight = parsePositiveNumber(animationPackDraft.frameHeight);
    const gridColumns = parsePositiveNumber(animationPackDraft.gridColumns);
    const gridRows = parsePositiveNumber(animationPackDraft.gridRows);
    const footOriginX = parseNumber(animationPackDraft.footOriginX);
    const footOriginY = parseNumber(animationPackDraft.footOriginY);

    if (!id || !name) {
      setStatus("Animation pack id and name are required.");
      return null;
    }
    if (!assetId || !availableAssetIdsSet.has(assetId)) {
      setStatus("Animation pack must reference an existing image asset.");
      return null;
    }
    if (
      frameWidth === null ||
      frameHeight === null ||
      gridColumns === null ||
      gridRows === null ||
      !Number.isInteger(frameWidth) ||
      !Number.isInteger(frameHeight) ||
      !Number.isInteger(gridColumns) ||
      !Number.isInteger(gridRows)
    ) {
      setStatus("Frame size and grid must use positive whole numbers.");
      return null;
    }
    if (footOriginX === null || footOriginY === null) {
      setStatus("Foot origin must use valid X/Y numbers.");
      return null;
    }

    const frameCount = gridColumns * gridRows;
    const clips = [];
    for (const clipDraft of animationPackDraft.clips) {
      const clipId = clipDraft.id.trim();
      const fps = parsePositiveNumber(clipDraft.fps);
      const frames = parseFrameList(clipDraft.frames);
      if (!clipId) {
        setStatus("Animation clips need an id.");
        return null;
      }
      if (fps === null) {
        setStatus(`Clip "${clipId}" fps must be a positive number.`);
        return null;
      }
      if (!frames) {
        setStatus(`Clip "${clipId}" needs comma-separated frame numbers.`);
        return null;
      }
      if (frames.some((frame) => frame >= frameCount)) {
        setStatus(`Clip "${clipId}" references a frame outside the ${frameCount} frame grid.`);
        return null;
      }
      clips.push({
        id: clipId,
        frames,
        fps,
        loop: clipDraft.loop
      });
    }

    return {
      schemaVersion: 1,
      id,
      name,
      assetId,
      frame: {
        width: frameWidth,
        height: frameHeight
      },
      grid: {
        columns: gridColumns,
        rows: gridRows
      },
      footOrigin: {
        x: footOriginX,
        y: footOriginY
      },
      defaultFacing: animationPackDraft.defaultFacing,
      clips
    };
  };

  const saveAnimationPackDraft = async () => {
    const animationPack = buildAnimationPackFromDraft();
    if (!animationPack) return;

    setStatus(`Saving animation pack ${animationPack.id}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "animation-pack/upsert",
        patch: { animationPack }
      });
      setProject(snapshot);
      setSelectedAnimationPackId(animationPack.id);
      setStatus(`Saved animation pack ${animationPack.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Animation pack could not be saved");
    }
  };

  const assignAnimationPackToPlayerDraft = () => {
    const animationPackId = animationPackDraft.id.trim();
    if (!animationPackId) {
      setStatus("Save or name an animation pack before assigning it to the player.");
      return;
    }
    updateSceneDraft("playerAnimationPackId", animationPackId);
    setWorkspace("scene");
    setSceneInspectorTarget("player");
    setActiveSceneTool("player-start");
    setStatus(`Assigned ${animationPackId} to the current player draft. Apply player changes to save.`);
  };

  const assignAnimationPackToActorDraft = () => {
    const animationPackId = animationPackDraft.id.trim();
    if (!selectedActor) {
      setStatus("Select an actor before assigning an animation pack.");
      return;
    }
    if (!animationPackId) {
      setStatus("Save or name an animation pack before assigning it to an actor.");
      return;
    }
    updateActorDraft("animationPackId", animationPackId);
    setWorkspace("scene");
    setStatus(`Assigned ${animationPackId} to actor ${selectedActor.id}. Apply Actor Changes to save.`);
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

  const activateAssetTool = (tool: AssetTool) => {
    setActiveAssetTool(tool);
    if (tool === "chroma" && selectedAsset && selectedAssetUrl) {
      openBackgroundCleanup({
        assetId: selectedAsset.id,
        assetPath: selectedAsset.path,
        assetUrl: selectedAssetUrl,
        filenameHint: `${selectedAsset.id}-alpha.png`,
        targetKind: assetEditTarget?.targetKind ?? "scene-background",
        ...(assetEditTarget?.entityId ? { entityId: assetEditTarget.entityId } : {}),
        ...(assetEditTarget?.sceneId ? { sceneId: assetEditTarget.sceneId } : selectedScene ? { sceneId: selectedScene.id } : {})
      });
    }
  };

  const saveCroppedAsset = async () => {
    if (!selectedAsset || !selectedAssetUrl) {
      setCropStatus("Select a previewable image asset before cropping.");
      return;
    }
    if (cropPath.length < 3) {
      setCropStatus("Crop path needs at least three nodes.");
      return;
    }

    setCropStatus("Clipping and saving a new transparent PNG asset...");
    try {
      const image = await loadImageElement(selectedAssetUrl);
      const crop = bezierCropPathBounds(cropPath, { width: image.naturalWidth, height: image.naturalHeight });
      const canvas = document.createElement("canvas");
      canvas.width = crop.width;
      canvas.height = crop.height;
      const context = canvas.getContext("2d");
      if (!context) {
        setCropStatus("Canvas is unavailable for crop.");
        return;
      }
      context.clearRect(0, 0, crop.width, crop.height);
      context.save();
      context.beginPath();
      traceBezierCropPath(context, cropPath, { x: crop.x, y: crop.y });
      context.clip();
      context.drawImage(image, -crop.x, -crop.y, image.naturalWidth, image.naturalHeight);
      context.restore();
      const result = await window.pointClick.saveProcessedImageAsset({
        dataUrl: canvas.toDataURL("image/png"),
        filenameHint: `${selectedAsset.id}-cutout.png`
      });
      const assetId = result.assetIds[0];
      const asset = assetId ? result.snapshot.assets.find((entry) => entry.id === assetId) : null;
      setProject(result.snapshot);
      if (asset) {
        setSelectedAssetId(asset.id);
        if (assetEditTarget) {
          assignAssetToTargetDraft(assetEditTarget.targetKind, asset, assetEditTarget);
        }
        setCropStatus(`Saved cutout asset ${asset.id}.`);
      } else {
        setCropStatus("Crop was saved, but no asset id was returned.");
      }
    } catch (error) {
      setCropStatus(error instanceof Error ? error.message : "Crop could not be saved.");
    }
  };

  const saveGuideMaskAsset = async () => {
    if (!project || !selectedAsset || !selectedScene || !selectedPromptPack || !selectedSavedGenerationTarget) {
      setGuideStatus("Select an asset, scene, saved prompt pack, and generation target before saving a guide.");
      return;
    }
    if (!selectedGuideSource) {
      setGuideStatus("Choose a scene guide source before saving a mask.");
      return;
    }

    setGuideStatus("Saving guide mask and updating prompt target...");
    try {
      const mask = createGuideMask({
        bounds: selectedGuideSource.bounds,
        height: selectedScene.size.height,
        shape: guideShape,
        width: selectedScene.size.width
      });
      const maskResult = await window.pointClick.saveProcessedImageAsset({
        dataUrl: imagePixelDataToPngDataUrl(mask),
        filenameHint: `${selectedSavedGenerationTarget.id}-mask.png`
      });
      const maskAssetId = maskResult.assetIds[0];
      const maskAsset = maskAssetId ? maskResult.snapshot.assets.find((entry) => entry.id === maskAssetId) : null;
      if (!maskAsset) {
        setProject(maskResult.snapshot);
        setGuideStatus("Mask was saved, but no asset id was returned.");
        return;
      }

      const updatedPromptPack = promptPackWithUpdatedTarget(selectedPromptPack, selectedSavedGenerationTarget.id, {
        ...selectedSavedGenerationTarget,
        guideBounds: selectedGuideSource.bounds,
        guideShape,
        maskAssetId: maskAsset.id,
        referenceAssetId: selectedAsset.id
      });
      const snapshot = await window.pointClick.applyCommand({
        type: "prompt-pack/upsert",
        patch: { promptPack: updatedPromptPack }
      });
      setProject(snapshot);
      setSelectedAssetId(maskAsset.id);
      setSelectedPromptPackId(updatedPromptPack.id);
      setGuideStatus(`Saved ${maskAsset.id} and linked it to ${updatedPromptPack.id}/${selectedSavedGenerationTarget.id}.`);
    } catch (error) {
      setGuideStatus(error instanceof Error ? error.message : "Guide mask could not be saved.");
    }
  };

  const drawGenerationGuidePath = (context: CanvasRenderingContext2D, guide: SceneGenerationGuide) => {
    context.beginPath();
    if (guide.shape.type === "polygon") {
      const firstPoint = guide.shape.points[0];
      if (!firstPoint) return;
      context.moveTo(firstPoint.x, firstPoint.y);
      for (const point of guide.shape.points.slice(1)) {
        context.lineTo(point.x, point.y);
      }
      context.closePath();
      return;
    }

    const bounds = guide.shape.bounds;
    if (guide.shape.type === "ellipse") {
      context.ellipse(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
        bounds.width / 2,
        bounds.height / 2,
        0,
        0,
        Math.PI * 2
      );
      return;
    }
    context.rect(bounds.x, bounds.y, bounds.width, bounds.height);
  };

  const drawGenerationGuideOverlay = (
    context: CanvasRenderingContext2D,
    guide: SceneGenerationGuide,
    label = true
  ) => {
    const color = generationGuideColor(guide);
    const bounds = boundsForGenerationGuideShape(guide.shape);
    context.save();
    context.globalAlpha = 0.18;
    context.fillStyle = color;
    drawGenerationGuidePath(context, guide);
    context.fill();
    context.globalAlpha = 0.95;
    context.strokeStyle = color;
    context.lineWidth = 3;
    drawGenerationGuidePath(context, guide);
    context.stroke();
    if (label) {
      context.font = "18px sans-serif";
      context.fillStyle = "#0b1118";
      context.fillRect(bounds.x, Math.max(0, bounds.y - 24), Math.max(80, guide.name.length * 9), 22);
      context.fillStyle = "#ffffff";
      context.fillText(guide.name, bounds.x + 6, Math.max(18, bounds.y - 7));
    }
    context.restore();
  };

  const createGuideReferenceDataUrl = async (scene: Layered2DScene, guides: SceneGenerationGuide[]) => {
    const canvas = document.createElement("canvas");
    canvas.width = scene.size.width;
    canvas.height = scene.size.height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas is unavailable for guide reference.");
    }

    context.fillStyle = isHexColor(scene.background) ? scene.background : "#24384a";
    context.fillRect(0, 0, canvas.width, canvas.height);

    if (!isHexColor(scene.background)) {
      const backgroundUrl = assetPreviewUrls[scene.background];
      if (backgroundUrl) {
        const image = await loadImageElement(backgroundUrl);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
      }
    }

    const drawAsset = async (assetId: string | undefined, bounds: Rect, opacity = 1) => {
      if (!assetId) return;
      const assetPath = assetPathById.get(assetId);
      const assetUrl = assetPath ? assetPreviewUrls[assetPath] : undefined;
      if (!assetUrl) return;
      const image = await loadImageElement(assetUrl);
      context.save();
      context.globalAlpha = opacity;
      context.drawImage(image, bounds.x, bounds.y, bounds.width, bounds.height);
      context.restore();
    };

    const drawableLayers = [...(scene.layers ?? [])].sort((left, right) => left.depth - right.depth);
    for (const layer of drawableLayers) {
      if (layer.visible === false) continue;
      const bounds = layer.bounds ?? { x: 0, y: 0, width: scene.size.width, height: scene.size.height };
      await drawAsset(layer.assetId, bounds, layer.opacity ?? 1);
    }
    for (const actor of scene.actors) {
      await drawAsset(actor.assetId, actor.bounds);
    }
    for (const pickup of scene.pickups) {
      await drawAsset(pickup.assetId, pickup.bounds);
    }

    for (const guide of guides) {
      if (guide.visible === false) continue;
      drawGenerationGuideOverlay(context, guide);
    }

    return canvas.toDataURL("image/png");
  };

  const updateSelectedTargetGuideSet = async (guideIds: string[]) => {
    if (!selectedPromptPack || !selectedSavedGenerationTarget) return;
    const updatedPromptPack = promptPackWithUpdatedTarget(selectedPromptPack, selectedSavedGenerationTarget.id, {
      ...selectedSavedGenerationTarget,
      guideIds
    });
    const snapshot = await window.pointClick.applyCommand({
      type: "prompt-pack/upsert",
      patch: { promptPack: updatedPromptPack }
    });
    setProject(snapshot);
    setSelectedPromptPackId(updatedPromptPack.id);
  };

  const toggleSelectedTargetGuide = async (guideId: string, checked: boolean) => {
    if (!selectedPromptPack || !selectedSavedGenerationTarget) return;
    const nextGuideIds = checked
      ? Array.from(new Set([...selectedTargetGuideIds, guideId]))
      : selectedTargetGuideIds.filter((id) => id !== guideId);
    setGuideStatus(`Updating guide set for ${selectedSavedGenerationTarget.id}...`);
    try {
      await updateSelectedTargetGuideSet(nextGuideIds);
      setGuideStatus(`Guide set updated for ${selectedSavedGenerationTarget.id}.`);
    } catch (error) {
      setGuideStatus(error instanceof Error ? error.message : "Guide set could not be updated.");
    }
  };

  const compileSelectedTargetGuideAssets = async () => {
    if (!selectedPromptPack || !selectedSavedGenerationTarget || !promptPackGuideScene) {
      setGuideStatus("Select a saved prompt pack, target, and layered scene before compiling guides.");
      return;
    }
    if (selectedTargetGuides.length === 0) {
      setGuideStatus("Select at least one generation guide for this target.");
      return;
    }

    setGuideStatus("Compiling guide reference and mask assets...");
    try {
      const referenceDataUrl = await createGuideReferenceDataUrl(promptPackGuideScene, selectedTargetGuides);
      const mask = createCompositeGuideMask({
        guides: selectedTargetGuides,
        height: promptPackGuideScene.size.height,
        width: promptPackGuideScene.size.width
      });
      const referenceResult = await window.pointClick.saveProcessedImageAsset({
        dataUrl: referenceDataUrl,
        filenameHint: `${selectedSavedGenerationTarget.id}-guide-reference.png`
      });
      const referenceAssetId = referenceResult.assetIds[0];
      const referenceAsset = referenceAssetId
        ? referenceResult.snapshot.assets.find((entry) => entry.id === referenceAssetId)
        : null;
      if (!referenceAsset) {
        setProject(referenceResult.snapshot);
        setGuideStatus("Reference was saved, but no asset id was returned.");
        return;
      }

      setProject(referenceResult.snapshot);
      const maskResult = await window.pointClick.saveProcessedImageAsset({
        dataUrl: imagePixelDataToPngDataUrl(mask),
        filenameHint: `${selectedSavedGenerationTarget.id}-guide-mask.png`
      });
      const maskAssetId = maskResult.assetIds[0];
      const maskAsset = maskAssetId ? maskResult.snapshot.assets.find((entry) => entry.id === maskAssetId) : null;
      if (!maskAsset) {
        setProject(maskResult.snapshot);
        setGuideStatus("Mask was saved, but no asset id was returned.");
        return;
      }

      const latestPromptPack = maskResult.snapshot.promptPacks.find((pack) => pack.id === selectedPromptPack.id) ?? selectedPromptPack;
      const latestTarget =
        latestPromptPack.outputs.generationTargets.find((target) => target.id === selectedSavedGenerationTarget.id) ??
        selectedSavedGenerationTarget;
      const guideIds = selectedTargetGuides.map((guide) => guide.id);
      const updatedPromptPack = promptPackWithUpdatedTarget(latestPromptPack, latestTarget.id, {
        ...latestTarget,
        guideIds,
        referenceAssetId: referenceAsset.id,
        maskAssetId: maskAsset.id
      });
      const snapshot = await window.pointClick.applyCommand({
        type: "prompt-pack/upsert",
        patch: { promptPack: updatedPromptPack }
      });
      setProject(snapshot);
      setSelectedAssetId(referenceAsset.id);
      setSelectedPromptPackId(updatedPromptPack.id);
      setGuideStatus(
        `Compiled reference ${referenceAsset.id} and mask ${maskAsset.id}. Current ComfyUI text-to-image workflow may not consume them.`
      );
    } catch (error) {
      setGuideStatus(error instanceof Error ? error.message : "Guide assets could not be compiled.");
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

  const updateTargetPromptDraft = (patch: TargetPromptDraft) => {
    if (!selectedTargetPromptDraftKey) return;
    setTargetPromptDrafts((current) => ({
      ...current,
      [selectedTargetPromptDraftKey]: {
        ...current[selectedTargetPromptDraftKey],
        ...patch
      }
    }));
  };

  const saveTargetPromptSettings = async () => {
    if (!activeImagePromptPack || !selectedGenerationTarget || !selectedEffectiveGenerationTarget) return;
    const updatedPromptPack = promptPackWithUpdatedTarget(
      activeImagePromptPack,
      selectedGenerationTarget.id,
      selectedEffectiveGenerationTarget
    );

    if (promptPackCandidate?.promptPack.id === activeImagePromptPack.id) {
      if (promptPackJob) {
        setPromptPackJob({
          ...promptPackJob,
          candidates: promptPackJob.candidates.map((candidate) =>
            candidate.promptPack.id === activeImagePromptPack.id
              ? { ...candidate, promptPack: updatedPromptPack }
              : candidate
          )
        });
      }
      setTargetPromptDrafts((current) => {
        const next = { ...current };
        delete next[selectedTargetPromptDraftKey];
        return next;
      });
      setStatus(`Updated target settings for ${selectedGenerationTarget.id}. Save the prompt pack to persist them.`);
      return;
    }

    setStatus(`Saving target settings for ${selectedGenerationTarget.id}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "prompt-pack/upsert",
        patch: { promptPack: updatedPromptPack }
      });
      setProject(snapshot);
      setSelectedPromptPackId(updatedPromptPack.id);
      setTargetPromptDrafts((current) => {
        const next = { ...current };
        delete next[selectedTargetPromptDraftKey];
        return next;
      });
      setStatus(`Saved target settings for ${selectedGenerationTarget.id}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Target prompt settings could not be saved");
    }
  };

  const installSelectedWorkflowPreset = async () => {
    if (!project || !selectedWorkflowPresetId) return;
    setStatus(`Installing workflow preset ${selectedWorkflowPresetId}...`);
    try {
      const snapshot = await window.pointClick.installWorkflowPreset(selectedWorkflowPresetId);
      setProject(snapshot);
      setSelectedWorkflowTemplateId(selectedWorkflowPresetId);
      setStatus(`Installed workflow preset ${selectedWorkflowPresetId}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Workflow preset could not be installed");
    }
  };

  const saveSelectedGenerationRecipe = async () => {
    if (!project || !selectedPromptPack || !selectedEffectiveGenerationTarget || !selectedWorkflowTemplate) {
      setStatus("Save a prompt pack and install a compatible workflow template before saving a recipe.");
      return;
    }

    const seedText = comfyUiSeed.trim();
    const parsedSeed = seedText ? Number(seedText) : null;
    if (parsedSeed !== null && (!Number.isFinite(parsedSeed) || parsedSeed < 0)) {
      setStatus("Recipe seed must be a positive number or empty for random.");
      return;
    }

    const inputs = {
      ...(selectedEffectiveGenerationTarget.referenceAssetId
        ? { referenceAssetIds: [selectedEffectiveGenerationTarget.referenceAssetId] }
        : {}),
      ...(selectedEffectiveGenerationTarget.maskAssetId
        ? { maskAssetId: selectedEffectiveGenerationTarget.maskAssetId }
        : {}),
      ...(selectedEffectiveGenerationTarget.guideIds?.length
        ? { guideIds: selectedEffectiveGenerationTarget.guideIds }
        : {})
    };
    const generationRecipe: AssetGenerationRecipeDocument = {
      schemaVersion: 1,
      id: recipeIdForTarget(selectedEffectiveGenerationTarget.id, selectedWorkflowTemplate.id),
      sceneId: selectedPromptPack.sceneId,
      promptPackId: selectedPromptPack.id,
      targetId: selectedEffectiveGenerationTarget.id,
      assetType: assetTypeForGenerationTarget(selectedEffectiveGenerationTarget),
      workflowFamily: selectedWorkflowTemplate.family,
      workflowId: selectedWorkflowTemplate.id,
      ...(activeStyleBible ? { styleBibleId: activeStyleBible.id } : {}),
      resolution: selectedGenerationDimensions,
      prompt: {
        positive: selectedGenerationPrompt,
        ...(selectedGenerationNegativePrompt ? { negative: selectedGenerationNegativePrompt } : {})
      },
      ...(Object.keys(inputs).length ? { inputs } : {}),
      generation: {
        ...(parsedSeed !== null ? { seed: parsedSeed } : {}),
        ...(comfyUiCheckpoint.trim() ? { model: comfyUiCheckpoint.trim() } : {})
      }
    };

    setStatus(`Saving recipe ${generationRecipe.id}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "generation-recipe/upsert",
        patch: { generationRecipe }
      });
      setProject(snapshot);
      setStatus(`Saved recipe ${generationRecipe.id}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Generation recipe could not be saved");
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
    if (!selectedEffectiveGenerationTarget) {
      setComfyUiGenerationStatus("Select a prompt-pack generation target before queueing ComfyUI.");
      setStatus("Select a prompt-pack generation target before queueing ComfyUI.");
      return;
    }

    const checkpointName = comfyUiCheckpoint.trim();
    const workflowPath = comfyUiWorkflowPath.trim();
    if (!checkpointName && !workflowPath && !selectedWorkflowTemplate) {
      setComfyUiGenerationStatus("ComfyUI needs a checkpoint filename, an installed workflow template, or a legacy workflow API JSON path.");
      setStatus("ComfyUI needs a checkpoint filename, an installed workflow template, or a legacy workflow API JSON path.");
      return;
    }
    if (
      !workflowPath &&
      !selectedWorkflowTemplate &&
      (selectedEffectiveGenerationTarget.referenceAssetId || selectedEffectiveGenerationTarget.maskAssetId)
    ) {
      const workflowInputStatus =
        "Linked reference or mask assets require a compatible workflow template or legacy workflow API JSON path before queueing.";
      setComfyUiGenerationStatus(workflowInputStatus);
      setStatus(workflowInputStatus);
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
    setActiveImageGenerationContext(selectedImageGenerationContext);
    setLastGeneratedImageAsset(null);
    const queuedStatus = `Queueing ${selectedGenerationTarget.id} with ComfyUI (${selectedImageTargetWorkflow.label}). Krea workflows can take several minutes.`;
    setComfyUiGenerationStatus(queuedStatus);
    setStatus(queuedStatus);
    try {
      const imageRequest = {
        expectedAlpha:
          selectedEffectiveGenerationTarget.expectedAlpha ?? selectedEffectiveGenerationTarget.transparent ?? false,
        guideIds: selectedEffectiveGenerationTarget.guideIds ?? [],
        height: selectedGenerationDimensions.height,
        ...(selectedEffectiveGenerationTarget.maskAssetId
          ? { maskAssetId: selectedEffectiveGenerationTarget.maskAssetId }
          : {}),
        negativePrompt: selectedGenerationNegativePrompt,
        prompt: selectedGenerationPrompt,
        ...(selectedPromptPack?.id === activeImagePromptPack.id ? { promptPackId: selectedPromptPack.id } : {}),
        providerId: "comfyui" as const,
        ...(selectedEffectiveGenerationTarget.referenceAssetId
          ? { referenceAssetIds: [selectedEffectiveGenerationTarget.referenceAssetId] }
          : {}),
        targetId: selectedEffectiveGenerationTarget.id,
        width: selectedGenerationDimensions.width,
        workflowFamily: selectedImageWorkflowFamily,
        ...(selectedEffectiveGenerationTarget.backgroundMode
          ? { backgroundMode: selectedEffectiveGenerationTarget.backgroundMode }
          : {}),
        ...(comfyUiBaseUrl.trim() ? { baseUrl: comfyUiBaseUrl.trim() } : {}),
        ...(checkpointName ? { checkpointName } : {}),
        ...(parsedSeed !== null ? { seed: parsedSeed } : {}),
        timeoutMs: Math.round(timeoutMinutes * 60_000),
        ...(selectedWorkflowTemplate ? { workflowId: selectedWorkflowTemplate.id } : {}),
        ...(selectedGenerationRecipe ? { recipeId: selectedGenerationRecipe.id } : {}),
        ...(selectedWorkflowTemplate ? { outputNodeId: selectedWorkflowTemplate.output.nodeId } : {}),
        ...(workflowPath ? { workflowPath } : {})
      };
      const job = await window.pointClick.generateImageAsset(imageRequest);
      setProject(job.snapshot);
      setSelectedAssetId(job.assetId);
      setLastGeneratedImageAsset(
        selectedImageGenerationContext
          ? {
              ...selectedImageGenerationContext,
              assetId: job.assetId,
              assetPath: job.assetPath,
              expectedAlpha: job.expectedAlpha,
              hasAlphaPixels: job.hasAlphaPixels,
              ...(job.backgroundMode ? { backgroundMode: job.backgroundMode } : {}),
              ...(job.outputWarning ? { outputWarning: job.outputWarning } : {}),
              seed: job.seed
            }
          : null
      );
      const completedStatus = job.outputWarning
        ? `Generated ${job.assetId}, but alpha contract needs review.`
        : `Generated ${job.assetId} from ${job.targetId} with ComfyUI seed ${job.seed}`;
      setComfyUiGenerationStatus(completedStatus);
      setStatus(completedStatus);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Image asset could not be generated";
      setComfyUiGenerationStatus(message);
      setStatus(message);
    } finally {
      setImageGenerationState("idle");
      setActiveImageGenerationContext(null);
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
    setActiveSceneTool("select");
    setSceneInspectorTarget("scene");
    setSelectedSceneLayerId(null);
    setSelectedGenerationGuideId(null);
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

  const selectPlayerInScene = () => {
    if (!selectedScene) return;
    setWorkspace("scene");
    setActiveSceneTool("player-start");
    setSceneInspectorTarget("player");
    setSelectedSceneLayerId(null);
    setSelectedGenerationGuideId(null);
    updateSessionSelection((current) => ({
      ...current,
      activeActorId: null,
      activeFlowId: null,
      activeHotspotId: null,
      activeItemId: null,
      activeLocale: null,
      activePickupId: null,
      activeSceneId: selectedScene.id
    }));
  };

  const selectHotspot = (hotspot: Hotspot) => {
    setWorkspace("scene");
    setActiveSceneTool("hotspot");
    setSceneInspectorTarget("scene");
    setSelectedSceneLayerId(null);
    setSelectedGenerationGuideId(null);
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
    setSceneInspectorTarget("scene");
    setSelectedSceneLayerId(null);
    setSelectedGenerationGuideId(null);
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
    setSceneInspectorTarget("scene");
    setSelectedSceneLayerId(null);
    setSelectedGenerationGuideId(null);
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
    setSceneInspectorTarget("scene");
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
    setSceneInspectorTarget("scene");
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
    setSceneInspectorTarget("scene");
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

  const canOpenBuildReadinessTarget = (target: BuildReadinessTarget | undefined): boolean => {
    if (!project || !target) return false;
    switch (target.kind) {
      case "scene":
      case "player":
        return project.scenes.some((scene) => scene.id === target.sceneId);
      case "hotspot": {
        const scene = project.scenes.find((entry) => entry.id === target.sceneId);
        return !!scene?.hotspots.some((hotspot) => hotspot.id === target.hotspotId);
      }
      case "pickup": {
        const scene = project.scenes.find((entry) => entry.id === target.sceneId);
        return scene?.type === "layered-2d" && scene.pickups.some((pickup) => pickup.id === target.pickupId);
      }
      case "actor": {
        const scene = project.scenes.find((entry) => entry.id === target.sceneId);
        return scene?.type === "layered-2d" && scene.actors.some((actor) => actor.id === target.actorId);
      }
      case "flow":
        return project.flows.some((flow) => flow.id === target.flowId);
      case "item":
        return project.items.some((item) => item.id === target.itemId);
      case "asset":
        return project.assets.some((asset) => asset.id === target.assetId);
      case "animation-pack":
        return project.animationPacks.some((animationPack) => animationPack.id === target.animationPackId);
    }
  };

  const openBuildReadinessIssue = (issue: BuildReadinessIssue) => {
    const target = issue.target;
    if (!project || !target || !canOpenBuildReadinessTarget(target)) return;

    if (target.kind === "asset") {
      setWorkspace("assets");
      setSelectedAssetId(target.assetId);
      setStatus(`Opened asset ${target.assetId} from build readiness.`);
      return;
    }

    if (target.kind === "animation-pack") {
      setWorkspace("assets");
      setSelectedAnimationPackId(target.animationPackId);
      setStatus(`Opened animation pack ${target.animationPackId} from build readiness.`);
      return;
    }

    if (target.kind === "flow") {
      setWorkspace("narrative");
      setSceneInspectorTarget("scene");
      updateSessionSelection((current) => ({
        ...current,
        activeActorId: null,
        activeFlowId: target.flowId,
        activeHotspotId: null,
        activeItemId: null,
        activeLocale: null,
        activePickupId: null
      }));
      setStatus(`Opened flow ${target.flowId} from build readiness.`);
      return;
    }

    if (target.kind === "item") {
      setWorkspace("narrative");
      setSceneInspectorTarget("scene");
      updateSessionSelection((current) => ({
        ...current,
        activeActorId: null,
        activeFlowId: null,
        activeHotspotId: null,
        activeItemId: target.itemId,
        activeLocale: null,
        activePickupId: null
      }));
      setStatus(`Opened item ${target.itemId} from build readiness.`);
      return;
    }

    setWorkspace("scene");
    setSceneInspectorTarget(target.kind === "player" ? "player" : "scene");
    setActiveSceneTool(
      target.kind === "player"
        ? "player-start"
        : target.kind === "hotspot"
          ? "hotspot"
          : target.kind === "pickup"
            ? "pickup"
            : target.kind === "actor"
              ? "actor"
              : "walk-area"
    );
    updateSessionSelection((current) => ({
      ...current,
      activeActorId: target.kind === "actor" ? target.actorId : null,
      activeFlowId: null,
      activeHotspotId: target.kind === "hotspot" ? target.hotspotId : null,
      activeItemId: null,
      activeLocale: null,
      activePickupId: target.kind === "pickup" ? target.pickupId : null,
      activeSceneId: "sceneId" in target ? target.sceneId : current.activeSceneId
    }));
    setStatus(`Opened ${issue.code} from build readiness.`);
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

  const updateSceneGenerationGuides = (
    updater: (guides: SceneGenerationGuide[]) => SceneGenerationGuide[]
  ) => {
    if (!selectedScene) return;
    updateDraftWithHistory((current) => {
      const sceneDraft = current.sceneDrafts[selectedScene.id] ?? createSceneDraft(selectedScene);
      return {
        ...current,
        sceneDrafts: {
          ...current.sceneDrafts,
          [selectedScene.id]: {
            ...sceneDraft,
            generationGuides: updater(sceneDraft.generationGuides)
          }
        }
      };
    });
  };

  const nextGenerationGuideId = (prefix = "guide") => {
    const ids = new Set(currentGenerationGuides.map((guide) => guide.id));
    for (let index = 1; index < 1000; index += 1) {
      const candidate = `${prefix}-${index}`;
      if (!ids.has(candidate)) return candidate;
    }
    return `${prefix}-${Date.now()}`;
  };

  const createGenerationGuide = (
    name: string,
    role: SceneGenerationGuideRole,
    shape: SceneGenerationGuideShape,
    source?: SceneGenerationGuide["source"]
  ) => {
    if (!selectedScene) return;
    const id = nextGenerationGuideId(role === "mask" ? "mask-guide" : `${role}-guide`);
    const guide: SceneGenerationGuide = {
      id,
      name,
      role,
      shape,
      visible: true,
      locked: false,
      color: generationGuideRoleColors[role],
      ...(source ? { source } : {})
    };
    updateSceneGenerationGuides((guides) => [...guides, guide]);
    setSelectedGenerationGuideId(id);
    setSceneInspectorTarget("scene");
    setStatus(`Created generation guide ${id}.`);
  };

  const createGenerationGuideFromBounds = (
    name: string,
    role: SceneGenerationGuideRole,
    bounds: Rect,
    source?: SceneGenerationGuide["source"],
    shapeType: "rect" | "ellipse" = "rect"
  ) => {
    createGenerationGuide(name, role, { type: shapeType, bounds }, source);
  };

  const createBlankGenerationGuide = (shapeType: "rect" | "ellipse" | "polygon") => {
    if (!selectedScene) return;
    const bounds = {
      x: Math.round(selectedScene.size.width * 0.35),
      y: Math.round(selectedScene.size.height * 0.3),
      width: Math.round(selectedScene.size.width * 0.3),
      height: Math.round(selectedScene.size.height * 0.35)
    };
    if (shapeType === "polygon") {
      createGenerationGuide("Polygon Guide", "mask", {
        type: "polygon",
        points: [
          { x: bounds.x, y: bounds.y + bounds.height },
          { x: bounds.x + bounds.width / 2, y: bounds.y },
          { x: bounds.x + bounds.width, y: bounds.y + bounds.height }
        ]
      });
      return;
    }
    createGenerationGuide(`${shapeType === "ellipse" ? "Ellipse" : "Rect"} Guide`, "mask", {
      type: shapeType,
      bounds
    });
  };

  const updateSelectedGenerationGuide = (patch: Partial<SceneGenerationGuide>) => {
    if (!selectedGenerationGuide) return;
    updateSceneGenerationGuides((guides) =>
      guides.map((guide) => (guide.id === selectedGenerationGuide.id ? { ...guide, ...patch } : guide))
    );
  };

  const clearSelectedGenerationGuideSource = () => {
    if (!selectedGenerationGuide) return;
    updateSceneGenerationGuides((guides) =>
      guides.map((guide) => {
        if (guide.id !== selectedGenerationGuide.id) return guide;
        const { source: _source, ...nextGuide } = guide;
        return nextGuide;
      })
    );
  };

  const updateSelectedGenerationGuideShape = (shape: SceneGenerationGuideShape) => {
    updateSelectedGenerationGuide({ shape });
  };

  const deleteSelectedGenerationGuide = () => {
    if (!selectedGenerationGuide) return;
    const deletedId = selectedGenerationGuide.id;
    updateSceneGenerationGuides((guides) => guides.filter((guide) => guide.id !== deletedId));
    setSelectedGenerationGuideId(null);
    setStatus(`Deleted generation guide ${deletedId}.`);
  };

  const nextSceneLayerId = () => {
    const ids = new Set(currentSceneDraft.layers.map((layer) => layer.id));
    for (let index = 1; index < 1000; index += 1) {
      const candidate = `layer-${index}`;
      if (!ids.has(candidate)) return candidate;
    }
    return `layer-${Date.now()}`;
  };

  const createSceneLayer = () => {
    if (!selectedScene) return;
    const asset = selectedAsset?.kind === "image" ? selectedAsset : imageAssets[0] ?? null;
    if (!asset) {
      setStatus("Import an image asset before adding a scene layer");
      return;
    }

    const layerId = nextSceneLayerId();
    updateDraftWithHistory((current) => {
      const sceneDraft = current.sceneDrafts[selectedScene.id] ?? createSceneDraft(selectedScene);
      return {
        ...current,
        activeActorId: null,
        activeFlowId: null,
        activeHotspotId: null,
        activeItemId: null,
        activeLocale: null,
        activePickupId: null,
        sceneDrafts: {
          ...current.sceneDrafts,
          [selectedScene.id]: {
            ...sceneDraft,
            layers: [
              ...sceneDraft.layers,
              {
                assetId: asset.id,
                depth: "40",
                height: String(previewSceneSize.height),
                id: layerId,
                locked: false,
                name: "Scene Layer",
                opacity: "1",
                visible: true,
                width: String(previewSceneSize.width),
                x: "0",
                y: "0"
              }
            ]
          }
        }
      };
    });
    setWorkspace("scene");
    setActiveSceneTool("select");
    setSceneInspectorTarget("scene");
    setSelectedSceneLayerId(layerId);
    setStatus(`Added ${layerId} from ${asset.id}`);
  };

  const updateSceneLayerDraft = <K extends keyof SceneLayerDraft>(
    layerId: string,
    field: K,
    value: SceneLayerDraft[K]
  ) => {
    if (!selectedScene) return;
    updateDraftWithHistory((current) => {
      const sceneDraft = current.sceneDrafts[selectedScene.id] ?? createSceneDraft(selectedScene);
      return {
        ...current,
        sceneDrafts: {
          ...current.sceneDrafts,
          [selectedScene.id]: {
            ...sceneDraft,
            layers: sceneDraft.layers.map((layer) =>
              layer.id === layerId ? { ...layer, [field]: value } : layer
            )
          }
        }
      };
    });
    if (field === "id" && typeof value === "string") {
      setSelectedSceneLayerId(value);
    }
  };

  const deleteSceneLayerDraft = (layerId: string) => {
    if (!selectedScene) return;
    updateDraftWithHistory((current) => {
      const sceneDraft = current.sceneDrafts[selectedScene.id] ?? createSceneDraft(selectedScene);
      return {
        ...current,
        sceneDrafts: {
          ...current.sceneDrafts,
          [selectedScene.id]: {
            ...sceneDraft,
            layers: sceneDraft.layers.filter((layer) => layer.id !== layerId)
          }
        }
      };
    });
    if (selectedSceneLayerId === layerId) {
      setSelectedSceneLayerId(null);
    }
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

  const updateSceneDraftBySceneId = (sceneId: string, patch: Partial<SceneDraft>) => {
    const scene = project?.scenes.find((entry) => entry.id === sceneId);
    if (!scene || scene.type !== "layered-2d") return false;
    updateDraftWithHistory((current) => ({
      ...current,
      sceneDrafts: {
        ...current.sceneDrafts,
        [scene.id]: {
          ...(current.sceneDrafts[scene.id] ?? createSceneDraft(scene)),
          ...patch
        }
      }
    }));
    return true;
  };

  const updateActorDraftById = (sceneId: string, actorId: string, patch: Partial<ActorDraft>) => {
    const scene = project?.scenes.find((entry) => entry.id === sceneId);
    if (!scene || scene.type !== "layered-2d") return false;
    const actor = scene.actors.find((entry) => entry.id === actorId);
    if (!actor) return false;
    const key = createActorKey(scene.id, actor.id);
    updateDraftWithHistory((current) => ({
      ...current,
      actorDrafts: {
        ...current.actorDrafts,
        [key]: {
          ...(current.actorDrafts[key] ?? createActorDraft(actor)),
          ...patch
        }
      }
    }));
    return true;
  };

  const updatePickupDraftById = (sceneId: string, pickupId: string, patch: Partial<typeof currentPickupDraft>) => {
    const scene = project?.scenes.find((entry) => entry.id === sceneId);
    if (!scene || scene.type !== "layered-2d") return false;
    const pickup = scene.pickups.find((entry) => entry.id === pickupId);
    if (!pickup) return false;
    const key = createPickupKey(scene.id, pickup.id);
    updateDraftWithHistory((current) => ({
      ...current,
      pickupDrafts: {
        ...current.pickupDrafts,
        [key]: {
          ...(current.pickupDrafts[key] ?? createPickupDraft(pickup)),
          ...patch
        }
      }
    }));
    return true;
  };

  const selectSceneEntityFromHandoff = (
    sceneId: string,
    selection: { actorId?: string; pickupId?: string; player?: boolean } = {}
  ) => {
    setWorkspace("scene");
    setSceneInspectorTarget(selection.player ? "player" : "scene");
    setActiveSceneTool(
      selection.player ? "player-start" : selection.actorId ? "actor" : selection.pickupId ? "pickup" : "walk-area"
    );
    updateSessionSelection((current) => ({
      ...current,
      activeActorId: selection.actorId ?? null,
      activeFlowId: null,
      activeHotspotId: null,
      activeItemId: null,
      activeLocale: null,
      activePickupId: selection.pickupId ?? null,
      activeSceneId: sceneId
    }));
  };

  const openBackgroundCleanup = (target: BackgroundCleanupTarget) => {
    setBackgroundCleanupTarget(target);
    setCleanupKeyColor("#00A2FF");
    setCleanupTolerance("28");
    setCleanupFeather("18");
    setCleanupSpillReduction(true);
    setCleanupPreviewUrl(null);
    setCleanupSummary(null);
    setCleanupStatus("Loading image for chroma cleanup...");
  };

  const renderBackgroundCleanupPreview = async () => {
    if (!backgroundCleanupTarget) return;
    const keyColor = parseHexColor(cleanupKeyColor);
    if (!keyColor) {
      setCleanupStatus("Key color must be a valid hex color.");
      return;
    }
    const tolerance = Number(cleanupTolerance);
    const feather = Number(cleanupFeather);
    if (!Number.isFinite(tolerance) || tolerance < 0 || !Number.isFinite(feather) || feather < 0) {
      setCleanupStatus("Tolerance and feather must be positive numbers.");
      return;
    }

    try {
      const image = await loadImageElement(backgroundCleanupTarget.assetUrl);

      const sourceCanvas = cleanupSourceCanvasRef.current;
      const outputCanvas = cleanupOutputCanvasRef.current;
      if (!sourceCanvas || !outputCanvas) return;
      sourceCanvas.width = image.naturalWidth;
      sourceCanvas.height = image.naturalHeight;
      outputCanvas.width = image.naturalWidth;
      outputCanvas.height = image.naturalHeight;

      const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
      const outputContext = outputCanvas.getContext("2d");
      if (!sourceContext || !outputContext) {
        setCleanupStatus("Canvas is unavailable for background cleanup.");
        return;
      }
      sourceContext.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
      sourceContext.drawImage(image, 0, 0);
      const sourceImageData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
      const result = applyChromaKeyToImageData(sourceImageData, {
        feather,
        keyColor,
        spillReduction: cleanupSpillReduction,
        tolerance
      });
      const outputImageData = outputContext.createImageData(result.imageData.width, result.imageData.height);
      outputImageData.data.set(result.imageData.data);
      outputContext.putImageData(outputImageData, 0, 0);
      setCleanupPreviewUrl(outputCanvas.toDataURL("image/png"));
      setCleanupSummary(result.summary);
      setCleanupStatus(
        result.summary.transparentPixels === 0 && result.summary.alphaPixels === 0
          ? "No background pixels matched the current key settings."
          : `Removed ${result.summary.transparentPixels} pixel(s); softened ${result.summary.alphaPixels} edge pixel(s).`
      );
    } catch (error) {
      setCleanupStatus(error instanceof Error ? error.message : "Background cleanup preview failed.");
    }
  };

  const pickCleanupColor = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = cleanupSourceCanvasRef.current;
    const context = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !context) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width)));
    const y = Math.max(
      0,
      Math.min(canvas.height - 1, Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height))
    );
    const pixel = context.getImageData(x, y, 1, 1).data;
    setCleanupKeyColor(rgbToHex({ r: pixel[0]!, g: pixel[1]!, b: pixel[2]! }));
  };

  const saveBackgroundCleanupAsset = async () => {
    if (!backgroundCleanupTarget) return;
    const outputCanvas = cleanupOutputCanvasRef.current;
    const dataUrl = outputCanvas?.toDataURL("image/png") ?? cleanupPreviewUrl;
    if (!dataUrl) {
      setCleanupStatus("Generate a cleanup preview before saving.");
      return;
    }

    setCleanupStatus("Saving processed PNG asset...");
    try {
      const result = await window.pointClick.saveProcessedImageAsset({
        dataUrl,
        filenameHint: backgroundCleanupTarget.filenameHint
      });
      const assetId = result.assetIds[0];
      const asset = assetId ? result.snapshot.assets.find((entry) => entry.id === assetId) : null;
      setProject(result.snapshot);
      if (asset) {
        setSelectedAssetId(asset.id);
        if (assetEditTarget) {
          assignAssetToTargetDraft(assetEditTarget.targetKind, asset, assetEditTarget);
        }
        setCleanupStatus(`Saved ${asset.id}.`);
        setBackgroundCleanupTarget(null);
      } else {
        setCleanupStatus("Processed asset was saved, but no asset id was returned.");
      }
    } catch (error) {
      setCleanupStatus(error instanceof Error ? error.message : "Processed image could not be saved.");
    }
  };

  const openImageGenerationForSceneTarget = (targetId: string) => {
    if (!selectedScene) return;
    setPromptPackSceneId(selectedScene.id);
    setSelectedGenerationTargetId(targetId);
    setWorkspace("ai");
    setStatus(`Prepared AI generation target ${targetId}.`);
  };

  const assignGeneratedAssetToBackgroundDraft = () => {
    if (!lastGeneratedImageAsset) return;
    if (!updateSceneDraftBySceneId(lastGeneratedImageAsset.sceneId, { background: lastGeneratedImageAsset.assetPath })) {
      setStatus("Generated asset could not be assigned to the scene background draft.");
      return;
    }
    selectSceneEntityFromHandoff(lastGeneratedImageAsset.sceneId);
    setStatus(`Set ${lastGeneratedImageAsset.assetId} as the background draft. Apply Scene Changes to save.`);
  };

  const assignGeneratedAssetToPlayerDraft = () => {
    if (!lastGeneratedImageAsset) return;
    if (!updateSceneDraftBySceneId(lastGeneratedImageAsset.sceneId, { playerAssetId: lastGeneratedImageAsset.assetId })) {
      setStatus("Generated asset could not be assigned to the player draft.");
      return;
    }
    selectSceneEntityFromHandoff(lastGeneratedImageAsset.sceneId, { player: true });
    setStatus(`Assigned ${lastGeneratedImageAsset.assetId} to the player draft. Apply player changes to save.`);
  };

  const assignGeneratedAssetToActorDraft = () => {
    if (!lastGeneratedImageAsset || lastGeneratedImageAsset.entityKind !== "actor" || !lastGeneratedImageAsset.entityId) {
      setStatus("Generate an actor target before assigning the asset to an actor draft.");
      return;
    }
    if (
      !updateActorDraftById(lastGeneratedImageAsset.sceneId, lastGeneratedImageAsset.entityId, {
        assetId: lastGeneratedImageAsset.assetId
      })
    ) {
      setStatus("Generated asset could not be assigned to the actor draft.");
      return;
    }
    selectSceneEntityFromHandoff(lastGeneratedImageAsset.sceneId, { actorId: lastGeneratedImageAsset.entityId });
    setStatus(
      `Assigned ${lastGeneratedImageAsset.assetId} to actor ${lastGeneratedImageAsset.entityId}. Apply Actor Changes to save.`
    );
  };

  const useGeneratedAssetAsAnimationSheet = () => {
    if (!lastGeneratedImageAsset) return;
    const nextId = nextAnimationPackId(project);
    setSelectedAnimationPackId(null);
    setAnimationPackDraft({
      ...createAnimationPackDraft(null, lastGeneratedImageAsset.assetId),
      id: nextId,
      name:
        lastGeneratedImageAsset.entityKind === "actor" && lastGeneratedImageAsset.entityId
          ? `${lastGeneratedImageAsset.entityId} Animation Pack`
          : "Generated Animation Pack"
    });
    setSelectedAssetId(lastGeneratedImageAsset.assetId);
    setActiveAssetTool("animation");
    setWorkspace("assets");
    setStatus(`Opened ${lastGeneratedImageAsset.assetId} in Character Gym as a spritesheet draft.`);
  };

  const openGeneratedAsset = () => {
    if (!lastGeneratedImageAsset) return;
    setSelectedAssetId(lastGeneratedImageAsset.assetId);
    setActiveAssetTool("info");
    setWorkspace("assets");
    setStatus(`Opened generated asset ${lastGeneratedImageAsset.assetId}.`);
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
    const layerResult = buildSceneLayersFromDraft(currentSceneDraft.layers, availableAssetIdsSet);

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
    if (layerResult.error) {
      setStatus(layerResult.error);
      return;
    }

    setStatus(`Saving ${selectedScene.id}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "scene/update",
        patch: {
          background,
          generationGuides: currentSceneDraft.generationGuides,
          layers: layerResult.layers,
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
    const assetId = currentPickupDraft.assetId.trim();

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
        assetId?: string;
        pickupFlowId?: string;
      };
      if (assetId) {
        patch.assetId = assetId;
      }
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

  const changeWorkspace = (nextWorkspace: Workspace) => {
    setWorkspace(nextWorkspace);

    if (nextWorkspace === "scene") {
      setSceneInspectorTarget("scene");
      setActiveSceneTool("walk-area");
      updateSessionSelection((current) => ({
        ...current,
        activeFlowId: null,
        activeItemId: null,
        activeLocale: null
      }));
      return;
    }

    if (nextWorkspace === "narrative") {
      setSceneInspectorTarget("scene");
      updateSessionSelection((current) => {
        const activeFlowId =
          current.activeFlowId && project?.flows.some((flow) => flow.id === current.activeFlowId)
            ? current.activeFlowId
            : project?.flows[0]?.id ?? null;
        const activeLocale =
          !activeFlowId && current.activeLocale && project?.locales.some((locale) => locale.locale === current.activeLocale)
            ? current.activeLocale
            : !activeFlowId
              ? project?.locales[0]?.locale ?? null
              : null;
        const activeItemId =
          !activeFlowId && !activeLocale && current.activeItemId && project?.items.some((item) => item.id === current.activeItemId)
            ? current.activeItemId
            : !activeFlowId && !activeLocale
              ? project?.items[0]?.id ?? null
              : null;

        return {
          ...current,
          activeActorId: null,
          activeFlowId,
          activeHotspotId: null,
          activeItemId,
          activeLocale,
          activePickupId: null
        };
      });
    }
  };

  const renderContextualTree = () => {
    if (!project) {
      return <div className="tree-item tree-meta">No project loaded</div>;
    }

    if (workspace === "scene") {
      return (
        <>
          <div className="tree-section-label">Scenes</div>
          <div className="tree-group open">Scenes ({scenes.length})</div>
          <button className="tree-item tree-child" type="button" onClick={createScene}>
            <span className="scene-dot muted" /> + New scene
          </button>
          {scenes.map((scene) => {
            const isActiveScene = selectedScene?.id === scene.id;
            const isSceneRootSelected =
              session.activeLocale === null &&
              session.activeFlowId === null &&
              !session.activeActorId &&
              !session.activeHotspotId &&
              !session.activePickupId &&
              !session.activeItemId &&
              isActiveScene &&
              !isPlayerInspectorSelected &&
              !selectedSceneLayerId &&
              !selectedGenerationGuideId &&
              activeSceneTool === "select";

            return (
              <div className={`scene-tree-branch ${isActiveScene ? "open" : ""}`} key={scene.id}>
                <button
                  className={`tree-item scene-tree-root ${isSceneRootSelected ? "selected" : ""}`}
                  type="button"
                  onClick={() => selectScene(scene.id)}
                >
                  <span className="scene-dot" /> {scene.name}
                  {dirtyState.sceneIds.has(scene.id) ? <span className="dirty-mark">*</span> : null}
                </button>
                {isActiveScene && selectedScene ? (
                  <div className="scene-tree-children">
                    <button
                      className={`tree-item tree-child ${isSceneRootSelected ? "selected" : ""}`}
                      type="button"
                      onClick={() => selectScene(scene.id)}
                    >
                      <span className="scene-dot muted" /> Background
                    </button>
                    <div className="tree-group open">Layers ({currentSceneDraft.layers.length})</div>
                    <button className="tree-item tree-child" type="button" onClick={createSceneLayer}>
                      <span className="scene-dot muted" /> + New layer
                    </button>
                    {currentSceneDraft.layers.map((layer) => (
                      <button
                        className={`tree-item tree-child ${selectedSceneLayerId === layer.id ? "selected" : ""}`}
                        key={`scene-layer-tree-${layer.id}`}
                        type="button"
                        onClick={() => {
                          setWorkspace("scene");
                          setActiveSceneTool("select");
                          setSceneInspectorTarget("scene");
                          setSelectedSceneLayerId(layer.id);
                          setSelectedGenerationGuideId(null);
                          updateSessionSelection((current) => ({
                            ...current,
                            activeActorId: null,
                            activeFlowId: null,
                            activeHotspotId: null,
                            activeItemId: null,
                            activeLocale: null,
                            activePickupId: null,
                            activeSceneId: selectedScene.id
                          }));
                        }}
                      >
                        <span className="scene-dot muted" /> {layer.name || layer.id}
                        {dirtyState.sceneIds.has(selectedScene.id) ? <span className="dirty-mark">*</span> : null}
                      </button>
                    ))}
                    <button
                      className={`tree-item tree-child ${activeSceneTool === "walk-area" ? "selected" : ""}`}
                      type="button"
                      onClick={() => {
                        selectScene(scene.id);
                        setActiveSceneTool("walk-area");
                      }}
                    >
                      <span className="scene-dot muted" /> Walk area
                    </button>
                    <button
                      className={`tree-item tree-child ${isPlayerInspectorSelected ? "selected" : ""}`}
                      type="button"
                      onClick={selectPlayerInScene}
                    >
                      <span className="scene-dot muted" /> Player start
                      {dirtyState.sceneIds.has(selectedScene.id) ? <span className="dirty-mark">*</span> : null}
                    </button>
                    <div className="tree-group open">Actors ({selectedScene.actors.length})</div>
                    <button className="tree-item tree-child" type="button" onClick={createActor}>
                      <span className="scene-dot muted" /> + New actor
                    </button>
                    {selectedScene.actors.map((actor) => (
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
                    <div className="tree-group open">Pickups ({selectedScene.pickups.length})</div>
                    <button className="tree-item tree-child" type="button" onClick={createPickup}>
                      <span className="scene-dot muted" /> + New pickup
                    </button>
                    {selectedScene.pickups.map((pickup) => (
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
                    <div className="tree-group open">Hotspots ({selectedScene.hotspots.length})</div>
                    <button className="tree-item tree-child" type="button" onClick={createHotspot}>
                      <span className="scene-dot muted" /> + New hotspot
                    </button>
                    {selectedScene.hotspots.map((hotspot) => (
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
                    <div className="tree-group open">Guides / AI masks ({currentGenerationGuides.length})</div>
                    <button
                      className="tree-item tree-child"
                      type="button"
                      onClick={() => createBlankGenerationGuide("rect")}
                    >
                      <span className="scene-dot muted" /> + New guide
                    </button>
                    {currentGenerationGuides.map((guide) => (
                      <button
                        className={`tree-item tree-child ${selectedGenerationGuide?.id === guide.id ? "selected" : ""}`}
                        key={`scene-guide-tree-${guide.id}`}
                        type="button"
                        onClick={() => {
                          setWorkspace("scene");
                          setActiveSceneTool("select");
                          setSceneInspectorTarget("scene");
                          setSelectedGenerationGuideId(guide.id);
                          setSelectedSceneLayerId(null);
                          updateSessionSelection((current) => ({
                            ...current,
                            activeActorId: null,
                            activeFlowId: null,
                            activeHotspotId: null,
                            activeItemId: null,
                            activeLocale: null,
                            activePickupId: null,
                            activeSceneId: selectedScene.id
                          }));
                        }}
                      >
                        <span
                          className="scene-dot muted"
                          style={{ backgroundColor: generationGuideColor(guide) }}
                        />{" "}
                        {guide.name || guide.id}
                        {dirtyState.sceneIds.has(selectedScene.id) ? <span className="dirty-mark">*</span> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
          {selectedScene ? null : (
            <div className="tree-item tree-meta">Select a scene to show player and scene entities.</div>
          )}
        </>
      );
    }

    if (workspace === "narrative") {
      return (
        <>
          <div className="tree-section-label">Narrative</div>
          <div className="tree-group open">Scene-linked flows</div>
          <button className="tree-item tree-child" type="button" onClick={createFlow}>
            <span className="scene-dot muted" /> + New flow
          </button>
          {narrativeRelationIndex.sceneGroups.map((group) => (
            <div className="narrative-tree-group" key={`narrative-scene-${group.sceneId}`}>
              <button
                className={`tree-item scene-tree-root ${session.activeSceneId === group.sceneId && !session.activeFlowId ? "selected" : ""}`}
                type="button"
                onClick={() => selectScene(group.sceneId)}
              >
                <span className="scene-dot" /> {group.sceneName}
              </button>
              <div className="scene-tree-children">
                {group.references.length ? (
                  group.references.map((reference, index) => {
                    const flow = flowFromSnapshot(project, reference.flowId);
                    return (
                      <button
                        className={`tree-item tree-child ${session.activeFlowId === reference.flowId ? "selected" : ""}`}
                        disabled={!flow}
                        key={`narrative-reference-${group.sceneId}-${reference.entityKind}-${reference.entityId}-${reference.action}-${index}`}
                        title={
                          flow
                            ? `${reference.entityKind} ${reference.entityId} ${reference.action}`
                            : `Missing flow ${reference.flowId}`
                        }
                        type="button"
                        onClick={() => {
                          if (flow) selectFlow(flow);
                        }}
                      >
                        <span className="scene-dot muted" />
                        {reference.entityKind} {reference.entityId} / {reference.action}: {reference.flowId}
                        {reference.flowExists ? null : <span className="dirty-mark">!</span>}
                        {dirtyState.flowIds.has(reference.flowId) ? <span className="dirty-mark">*</span> : null}
                      </button>
                    );
                  })
                ) : (
                  <div className="tree-item tree-meta">No linked flows in this scene.</div>
                )}
              </div>
            </div>
          ))}
          <div className="tree-group open">Global / unlinked flows ({narrativeRelationIndex.unlinkedFlows.length})</div>
          {narrativeRelationIndex.unlinkedFlows.length ? (
            narrativeRelationIndex.unlinkedFlows.map((flow) => (
              <button
                className={`tree-item ${session.activeFlowId === flow.id ? "selected" : ""}`}
                key={flow.id}
                type="button"
                onClick={() => selectFlow(flow)}
              >
                <span className="scene-dot muted" /> {flow.id}
                {dirtyState.flowIds.has(flow.id) ? <span className="dirty-mark">*</span> : null}
              </button>
            ))
          ) : (
            <div className="tree-item tree-meta">All saved flows are linked from scene entities.</div>
          )}
          {narrativeRelationIndex.missingReferences.length ? (
            <>
              <div className="tree-group open">Broken flow links ({narrativeRelationIndex.missingReferences.length})</div>
              {narrativeRelationIndex.missingReferences.map((reference, index) => (
                <div
                  className="tree-item tree-meta"
                  key={`missing-narrative-reference-${reference.sceneId}-${reference.entityId}-${reference.flowId}-${index}`}
                >
                  {reference.sceneName} / {reference.entityKind} {reference.entityId}: {reference.flowId}
                </div>
              ))}
            </>
          ) : null}
          <div className="tree-group open">Locales ({project.localeCount})</div>
          {project.locales.map((locale) => (
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
          <div className="tree-group open">Items ({project.itemCount})</div>
          <button className="tree-item tree-child" type="button" onClick={createItem}>
            <span className="scene-dot muted" /> + New item
          </button>
          {project.items.map((item) => (
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
        </>
      );
    }

    if (workspace === "assets") {
      return (
        <>
          <div className="tree-section-label">Asset Studio</div>
          <div className="tree-group open">Assets ({project.assetCount})</div>
          <button className="tree-item tree-child" type="button" onClick={importAssets}>
            <span className="scene-dot muted" /> + Import assets
          </button>
          {project.assets.map((asset) => (
            <button
              className={`tree-item ${selectedAsset?.id === asset.id ? "selected" : ""}`}
              key={asset.id}
              type="button"
              onClick={() => {
                setSelectedAssetId(asset.id);
                setActiveAssetTool("info");
              }}
            >
              <span className="scene-dot muted" /> {asset.id}
              {assetHealth(asset, project) === "missing" ? <span className="dirty-mark">!</span> : null}
            </button>
          ))}
          <div className="tree-group open">Animation Packs ({project.animationPackCount})</div>
          <button className="tree-item tree-child" type="button" onClick={createAnimationPackDraftFromSelection}>
            <span className="scene-dot muted" /> + New animation pack
          </button>
          {project.animationPacks.map((animationPack) => (
            <button
              className={`tree-item ${selectedAnimationPack?.id === animationPack.id ? "selected" : ""}`}
              key={animationPack.id}
              type="button"
              onClick={() => {
                setSelectedAnimationPackId(animationPack.id);
                setActiveAssetTool("animation");
              }}
            >
              <span className="scene-dot muted" /> {animationPack.id}
            </button>
          ))}
          <div className="tree-group open">Prompt Packs ({project.promptPackCount})</div>
          {project.promptPacks.map((promptPack) => (
            <button
              className={`tree-item ${selectedPromptPack?.id === promptPack.id ? "selected" : ""}`}
              key={promptPack.id}
              type="button"
              onClick={() => {
                setSelectedPromptPackId(promptPack.id);
                setPromptPackSceneId(promptPack.sceneId);
                setActiveAssetTool("guide");
              }}
            >
              <span className="scene-dot muted" /> {promptPack.id}
            </button>
          ))}
        </>
      );
    }

    if (workspace === "ai") {
      const targetGroups = savedPromptPackTargets.reduce<Record<string, typeof savedPromptPackTargets>>(
        (groups, target) => {
          const key = target.intendedUse;
          groups[key] = [...(groups[key] ?? []), target];
          return groups;
        },
        {}
      );

      return (
        <>
          <div className="tree-section-label">AI Studio</div>
          <div className="tree-group open">Target workflow</div>
          <div className="tree-item tree-meta">1. Brief</div>
          <div className="tree-item tree-meta">2. Context</div>
          <div className="tree-item tree-meta">3. Recipe</div>
          <div className="tree-item tree-meta">4. Generate</div>
          <div className="tree-item tree-meta">5. Review & Apply</div>
          <div className="tree-group open">Prompt Packs ({project.promptPackCount})</div>
          {project.promptPacks.map((promptPack) => (
            <button
              className={`tree-item ${selectedPromptPack?.id === promptPack.id ? "selected" : ""}`}
              key={promptPack.id}
              type="button"
              onClick={() => {
                setSelectedPromptPackId(promptPack.id);
                setPromptPackSceneId(promptPack.sceneId);
              }}
            >
              <span className="scene-dot muted" /> {promptPack.id}
            </button>
          ))}
          <div className="tree-group open">Game targets ({savedPromptPackTargets.length})</div>
          {savedPromptPackTargets.length ? Object.entries(targetGroups).map(([intendedUse, targets]) => (
            <div className="narrative-tree-group" key={`ai-target-group-${intendedUse}`}>
              <div className="tree-item tree-meta">{intendedUse}</div>
              <div className="scene-tree-children">
                {targets.map((target) => (
                  <button
                    className={`tree-item tree-child ${
                      selectedSavedGenerationTarget?.id === target.id ? "selected" : ""
                    }`}
                    key={target.id}
                    type="button"
                    onClick={() => setSelectedGenerationTargetId(target.id)}
                  >
                    <span className="scene-dot muted" /> {target.id}
                    {target.maskAssetId || target.referenceAssetId ? <span className="dirty-mark">*</span> : null}
                  </button>
                ))}
              </div>
            </div>
          )) : (
            <div className="tree-item tree-meta">Select or generate a prompt pack.</div>
          )}
          <div className="tree-group open">Context</div>
          <div className="tree-item tree-meta">Provider: {selectedPromptProvider.label}</div>
          <div className="tree-item tree-meta">Scene: {promptPackScene?.id ?? "none"}</div>
        </>
      );
    }

    if (workspace === "build") {
      return (
        <>
          <div className="tree-section-label">Build</div>
          <div className="tree-group open">Validation</div>
          <div className="tree-item tree-meta">Status: {validationRunState}</div>
          <div className="tree-item tree-meta">Last: {formatValidationTimestamp(validationReport?.ranAt ?? null)}</div>
          <button
            className="tree-item tree-child"
            disabled={validationRunState === "running"}
            type="button"
            onClick={runValidation}
          >
            <span className="scene-dot muted" /> {validationRunState === "running" ? "Running..." : "Run validation"}
          </button>
          <div className="tree-group open">Draft state</div>
          {dirtyState.count > 0 ? (
            <div className="tree-item tree-meta">{dirtyState.count} unsaved draft change(s)</div>
          ) : (
            <div className="tree-item tree-meta">No draft changes outside saved validation.</div>
          )}
          <div className="tree-group open">Blocking issues ({buildBlockingIssues.length})</div>
          {buildBlockingIssues.length ? (
            buildBlockingIssues.map((issue) => (
              <button
                className="tree-item"
                disabled={!canOpenBuildReadinessTarget(issue.target)}
                key={`tree-blocking-${issue.id}`}
                type="button"
                onClick={() => openBuildReadinessIssue(issue)}
              >
                <span className="scene-dot muted" /> {issue.actionLabel ?? issue.code}
                <span className="dirty-mark">!</span>
              </button>
            ))
          ) : (
            <div className="tree-item tree-meta">No blocking saved-project issues.</div>
          )}
          <div className="tree-group open">Warnings ({buildWarningIssues.length})</div>
          {buildWarningIssues.length ? (
            buildWarningIssues.map((issue) => (
              <button
                className="tree-item"
                disabled={!canOpenBuildReadinessTarget(issue.target)}
                key={`tree-warning-${issue.id}`}
                type="button"
                onClick={() => openBuildReadinessIssue(issue)}
              >
                <span className="scene-dot muted" /> {issue.actionLabel ?? issue.code}
                <span className="dirty-mark">*</span>
              </button>
            ))
          ) : (
            <div className="tree-item tree-meta">No saved-project warnings.</div>
          )}
        </>
      );
    }

    return (
      <>
        <div className="tree-section-label">Project</div>
        <div className="tree-item tree-meta">{project.sceneCount} scene(s)</div>
        <div className="tree-item tree-meta">{project.assetCount} asset(s)</div>
        <div className="tree-item tree-meta">{project.diagnostics.length} diagnostic(s)</div>
      </>
    );
  };

  const stageToolbarModel = stageToolbarModelFor({
    hasSelectedScene: !!selectedScene,
    sceneLabel,
    selectedSceneActorCount: selectedScene?.actors.length ?? 0,
    selectedSceneHotspotCount: selectedScene?.hotspots.length ?? 0,
    selectedScenePickupCount: selectedScene?.pickups.length ?? 0,
    selectedSceneToolLabel,
    workspace,
    workspaceCapability
  });

  const stageToolbar = (
    <WorkspaceStageToolbar
      activeSceneTool={activeSceneTool}
      badgeLabel={stageToolbarModel.badgeLabel}
      badgeTone={stageToolbarModel.badgeTone}
      canUseSceneTools={!!selectedScene}
      detail={stageToolbarModel.detail}
      isSceneWorkspace={workspace === "scene"}
      primaryLabel={stageToolbarModel.primaryLabel}
      onSceneToolChange={(tool) => setActiveSceneTool(tool as SceneTool)}
    />
  );

  const stageTimeline = (
    <WorkspaceTimeline
      diagnosticsCount={project?.diagnostics.length ?? 0}
      directory={project?.directory ?? null}
      flowCount={project?.flowCount ?? 0}
      itemCount={project?.itemCount ?? 0}
      localeCount={project?.localeCount ?? 0}
      sceneCount={project?.sceneCount ?? 0}
    />
  );

  return (
    <div className="studio-shell">
      <StudioTopbar
        activeWorkspace={workspace}
        canRedo={canRedo}
        canUndo={canUndo}
        hasProject={!!project}
        isDirty={dirtyState.count > 0}
        projectTitle={project?.manifest.title ?? "Loading project..."}
        onCreateBlankProject={createBlankProject}
        onCreateProjectFromStarter={createProjectFromStarter}
        onOpenBrowser={openBrowser}
        onOpenProject={openProject}
        onPlay={play}
        onRedo={() => replaceSession((current) => redoHistory(current))}
        onUndo={() => replaceSession((current) => undoHistory(current))}
        onWorkspaceChange={changeWorkspace}
      />

      {pendingRecovery ? <RecoveryBanner onDiscard={discardRecovery} onRestore={restoreRecovery} /> : null}

      {!project ? (
        <ProjectStartScreen
          status={status}
          onCreateBlankProject={createBlankProject}
          onCreateProjectFromStarter={createProjectFromStarter}
          onOpenProject={openProject}
        />
      ) : (
      <>
      <div className="workspace-grid">
        <ProjectMapPanel
          healthDetail={projectHealth ? `${projectHealth.detail} - ${localeLabel}` : status}
          healthLabel={projectHealth?.label ?? "Loading project health..."}
          healthTone={projectHealth?.tone ?? "warn"}
          onOpenProject={openProject}
        >
          {renderContextualTree()}
        </ProjectMapPanel>

        <WorkspaceStagePanel toolbar={stageToolbar} timeline={stageTimeline}>

          {workspace === "overview" ? (
            <WorkspaceOverview
              assetCount={project.assets.length}
              diagnostics={project.diagnostics}
              flowCount={project.flowCount}
              hasProjectSettingsChanges={hasProjectSettingsChanges}
              localeOptions={projectLocaleOptions}
              sceneCount={project.sceneCount}
              onOpenAi={() => changeWorkspace("ai")}
              onOpenAssets={() => changeWorkspace("assets")}
              onOpenBuild={() => changeWorkspace("build")}
              onOpenNarrative={() => changeWorkspace("narrative")}
              onOpenScenes={() => changeWorkspace("scene")}
              onProjectSettingsChange={updateProjectSettingsDraft}
              onSaveProjectSettings={saveProjectSettings}
              previewDescription={
                selectedScene
                  ? `Preview starts from ${selectedScene.id} in the currently opened project.`
                  : "Open a project to prepare a preview bundle."
              }
              previewLabel={dirtyState.count > 0 ? "Draft bundle" : "Saved project bundle"}
              projectSettings={projectSettingsDraft}
              projectHealthLabel={projectHealth?.label ?? "Loading project..."}
              promptPackCount={project.promptPacks.length}
              sceneOptions={projectSceneOptions}
              status={status}
              viewportDescription={
                selectedScene
                  ? "Hotspots, pickups, player start, and walk points can be edited directly from the scene viewport."
                  : "Scene tools appear once a layered 2D scene is selected."
              }
              viewportLabel={selectedScene ? "Direct manipulation is live" : "Open a scene to author visually"}
            />
          ) : workspace === "build" ? (
            <BuildWorkspace
              blockingIssueCount={buildBlockingIssues.length}
              dirtyDraftCount={dirtyState.count}
              issues={buildReadinessIssues.map((issue) => ({
                actionLabel: issue.actionLabel,
                canOpen: canOpenBuildReadinessTarget(issue.target),
                code: issue.code,
                id: issue.id,
                message: issue.message,
                onOpen: () => openBuildReadinessIssue(issue),
                path: issue.path,
                severity: issue.severity
              }))}
              onRunValidation={runValidation}
              previewReadinessLabel={previewReadinessLabel}
              readinessSummary={buildReadinessSummary}
              readinessTone={buildReadinessTone}
              savedTarget={project.directory}
              validationLastRunLabel={formatValidationTimestamp(validationReport?.ranAt ?? null)}
              validationRunState={validationRunState}
              validationStatus={validationStatus}
              validationSummary={validationSummaryLabel(currentValidationReport)}
              warningIssueCount={buildWarningIssues.length}
            />
          ) : workspace === "ai" ? (
            <div className="workspace-overview build-workspace ai-workspace">
              <section className="overview-card prompt-studio-card">
                <span className="overview-label">Brief & Context</span>
                <strong>{promptPackScene ? `${promptPackScene.name} target brief` : "No layered scene"}</strong>
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
              <AiProviderBoundary
                description={
                  promptProviderId === "openai"
                    ? "OpenAI calls run through the Electron main process. API keys are not saved to project files."
                    : promptProviderId === "lmstudio"
                      ? "LM Studio calls run against your local OpenAI-compatible server. Local URLs and keys are not saved to project files."
                      : "Mock generation is offline, deterministic, and safe for open-source contributors."
                }
                providerLabel={selectedPromptProvider.label}
              />
              <AiContextSummary
                detail={
                  promptPackContext
                    ? `${promptPackContext.sceneSize.width} x ${promptPackContext.sceneSize.height} - ${promptPackContext.locale}`
                    : "Choose a layered scene to inspect AI prompt context."
                }
                labels={promptPackContext?.labels ?? null}
                summary={
                  promptPackContext
                    ? `${promptPackContext.hotspots.length} hotspot(s), ${promptPackContext.pickups.length} pickup(s), ${promptPackContext.actors.length} actor(s)`
                    : "No context"
                }
              />
              <SavedPromptPacksCard
                packCount={project.promptPackCount}
                selectedPromptPack={
                  selectedPromptPack
                    ? {
                        id: selectedPromptPack.id,
                        model: selectedPromptPack.provenance.model,
                        name: selectedPromptPack.name,
                        provider: selectedPromptPack.provenance.provider,
                        sceneId: selectedPromptPack.sceneId,
                        targetCount: selectedPromptPack.outputs.generationTargets.length
                      }
                    : null
                }
              />
              <section className="overview-card prompt-studio-card">
                <span className="overview-label">Recipe, Generate, Review</span>
                <strong>
                  {activeImagePromptPack
                    ? `${activeImagePromptPack.id} target`
                    : "Generate or save a prompt pack first"}
                </strong>
                <p>
                  Choose a game target, save a recipe, generate through ComfyUI, then review and
                  import the output as a normal project asset.
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
                    Install preset
                    <select
                      value={selectedWorkflowPresetId}
                      onChange={(event) => setSelectedWorkflowPresetId(event.target.value)}
                    >
                      {workflowPresets.map((preset) => (
                        <option key={`workflow-preset-${preset.id}`} value={preset.id}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="build-actions inline-actions">
                    <button
                      className="secondary-action compact-action"
                      disabled={!project || !selectedWorkflowPresetId}
                      type="button"
                      onClick={installSelectedWorkflowPreset}
                    >
                      Install Preset
                    </button>
                  </div>
                  <label className="prompt-studio-field">
                    Installed workflow template
                    <select
                      disabled={compatibleWorkflowTemplates.length === 0}
                      value={selectedWorkflowTemplate?.id ?? ""}
                      onChange={(event) => setSelectedWorkflowTemplateId(event.target.value)}
                    >
                      {compatibleWorkflowTemplates.length ? (
                        compatibleWorkflowTemplates.map((template) => (
                          <option key={`workflow-template-${template.id}`} value={template.id}>
                            {template.name} ({template.outputMode})
                          </option>
                        ))
                      ) : (
                        <option value="">No compatible template installed</option>
                      )}
                    </select>
                  </label>
                  {selectedWorkflowTemplate ? (
                    <WorkflowTemplateSummary
                      family={selectedWorkflowTemplate.family}
                      hardwareProfile={selectedWorkflowTemplate.hardwareProfile ?? "custom hardware"}
                      notes={
                        selectedWorkflowTemplate.notes?.join(" ") ??
                        "Template bindings will patch prompt, seed, size, and output prefix before queueing."
                      }
                      outputNodeId={selectedWorkflowTemplate.output.nodeId}
                    />
                  ) : null}
                  <label className="prompt-studio-field">
                    Workflow API JSON path (legacy/advanced)
                    <input
                      placeholder="Optional project-relative path, e.g. workflows/image_krea2_turbo_t2i.json"
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
                  <div className="target-customization-panel">
                    <div className="target-customization-heading">
                      <div>
                        <span className="overview-label">Target prompting</span>
                        <strong>{selectedEffectiveGenerationTarget?.id ?? "No target selected"}</strong>
                      </div>
                      <button
                        className="secondary-action"
                        disabled={!selectedEffectiveGenerationTarget}
                        type="button"
                        onClick={saveTargetPromptSettings}
                      >
                        Save Target Settings
                      </button>
                    </div>
                    <div className="target-customization-grid">
                      <label className="prompt-studio-field">
                        Background mode
                        <select
                          disabled={!selectedEffectiveGenerationTarget}
                          value={selectedEffectiveGenerationTarget?.backgroundMode ?? "opaque-scene"}
                          onChange={(event) =>
                            updateTargetPromptDraft({
                              backgroundMode: event.target.value as TargetBackgroundMode
                            })
                          }
                        >
                          {targetBackgroundModeOptions.map((option) => (
                            <option key={`target-bg-${option.value}`} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="prompt-studio-field">
                        Safety negative prompt
                        <textarea
                          disabled={!selectedEffectiveGenerationTarget}
                          value={selectedEffectiveGenerationTarget?.safetyNegativePrompt ?? ""}
                          onChange={(event) =>
                            updateTargetPromptDraft({ safetyNegativePrompt: event.target.value })
                          }
                        />
                      </label>
                      <label className="prompt-studio-field">
                        Custom positive prompt
                        <textarea
                          disabled={!selectedEffectiveGenerationTarget}
                          placeholder="Add provider-agnostic target details, e.g. exact costume, material, silhouette."
                          value={selectedEffectiveGenerationTarget?.customPositivePrompt ?? ""}
                          onChange={(event) =>
                            updateTargetPromptDraft({ customPositivePrompt: event.target.value })
                          }
                        />
                      </label>
                      <label className="prompt-studio-field">
                        Custom negative prompt
                        <textarea
                          disabled={!selectedEffectiveGenerationTarget}
                          placeholder="Exclude target-specific mistakes, e.g. floor, room background, extra limbs."
                          value={selectedEffectiveGenerationTarget?.customNegativePrompt ?? ""}
                          onChange={(event) =>
                            updateTargetPromptDraft({ customNegativePrompt: event.target.value })
                          }
                        />
                      </label>
                    </div>
                    {selectedEffectiveGenerationTarget?.backgroundMode?.startsWith("chroma-") ? (
                      <p className="target-customization-note">
                        Chroma targets are imported as opaque images; use chroma-key cleanup or a provider workflow
                        before treating them as transparent-ready assets.
                      </p>
                    ) : null}
                    <div className="guide-set-panel">
                      <div className="target-customization-heading">
                        <div>
                          <span className="overview-label">Guide Set</span>
                          <strong>{selectedTargetGuideIds.length} selected</strong>
                        </div>
                        <button
                          className="play-action compact-action"
                          disabled={!selectedPromptPack || !selectedSavedGenerationTarget || selectedTargetGuides.length === 0}
                          type="button"
                          onClick={compileSelectedTargetGuideAssets}
                        >
                          <Crosshair size={iconSize} /> Compile Reference + Mask
                        </button>
                      </div>
                      {savedPromptPackGuides.length ? (
                        <div className="guide-set-list">
                          {savedPromptPackGuides.map((guide) => (
                            <label className="guide-set-row" key={`target-guide-${guide.id}`}>
                              <input
                                checked={selectedTargetGuideIds.includes(guide.id)}
                                type="checkbox"
                                onChange={(event) => {
                                  void toggleSelectedTargetGuide(guide.id, event.target.checked);
                                }}
                              />
                              <span
                                className="generation-guide-swatch"
                                style={{ backgroundColor: generationGuideColor(guide) }}
                                aria-hidden="true"
                              />
                              <strong>{guide.name}</strong>
                              <span>{guide.role}</span>
                              <span>{generationGuideShapeLabel(guide.shape)}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="target-customization-note">
                          No generation guides are saved in scene {promptPackGuideScene?.id ?? "none"}.
                        </p>
                      )}
                      <p className="target-customization-note">{guideStatus}</p>
                    </div>
                    {selectedEffectiveGenerationTarget?.referenceAssetId || selectedEffectiveGenerationTarget?.maskAssetId ? (
                      <p className="target-customization-note">
                        Guide assets linked: reference {selectedEffectiveGenerationTarget.referenceAssetId ?? "none"},
                        mask {selectedEffectiveGenerationTarget.maskAssetId ?? "none"}. Custom ComfyUI workflows with
                        LoadImage/LoadImageMask nodes receive these files before queueing; the default text-to-image
                        workflow ignores them.
                      </p>
                    ) : null}
                    {selectedImageInputWorkflowWarning ? (
                      <div className="contract-warning-card">
                        <strong>Image input workflow required</strong>
                        <p>{selectedImageInputWorkflowWarning}</p>
                      </div>
                    ) : null}
                  </div>
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
                  <div className="target-customization-panel">
                    <div className="target-customization-heading">
                      <div>
                        <span className="overview-label">Generation recipe</span>
                        <strong>{selectedRecipeId || "No recipe target"}</strong>
                      </div>
                      <button
                        className="secondary-action compact-action"
                        disabled={!selectedPromptPack || !selectedEffectiveGenerationTarget || !selectedWorkflowTemplate}
                        type="button"
                        onClick={saveSelectedGenerationRecipe}
                      >
                        Save Recipe
                      </button>
                    </div>
                    <p className="target-customization-note">
                      {selectedGenerationRecipe
                        ? "Recipe ready. Generate will include recipeId and workflowId in asset provenance."
                        : "Save a recipe to make the prompt, target, workflow, seed, dimensions, references, and masks reviewable before generation."}
                    </p>
                  </div>
                  <label className="prompt-studio-field">
                    Positive prompt preview
                    <textarea readOnly value={selectedGenerationPrompt} />
                  </label>
                  <label className="prompt-studio-field">
                    Negative prompt preview
                    <textarea readOnly value={selectedGenerationNegativePrompt} />
                  </label>
                  {selectedGenerationPromptResolution?.warning ? (
                    <div className="contract-warning-card">
                      <strong>Prompt routing warning</strong>
                      <p>{selectedGenerationPromptResolution.warning}</p>
                    </div>
                  ) : null}
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
                {lastGeneratedImageAsset ? (
                  <div className="generation-handoff-card">
                    <div>
                      <span className="overview-label">Generated asset handoff</span>
                      <strong>{lastGeneratedImageAsset.assetId}</strong>
                      <p>
                        Target {lastGeneratedImageAsset.targetId} imported from ComfyUI seed{" "}
                        {lastGeneratedImageAsset.seed}. Assign it now, inspect it in Asset Studio, or send
                        animation targets to Character Gym.
                      </p>
                      <div
                        className={`alpha-contract-strip ${
                          lastGeneratedImageAsset.hasAlphaPixels ? "has-alpha" : "is-opaque"
                        }`}
                      >
                        <span className="alpha-checkerboard" aria-hidden="true" />
                        <span>
                          {lastGeneratedImageAsset.backgroundMode ?? "legacy target"} ·{" "}
                          {lastGeneratedImageAsset.hasAlphaPixels ? "alpha pixels detected" : "opaque bitmap"}
                        </span>
                      </div>
                      {lastGeneratedImageAsset.outputWarning ? (
                        <div className="contract-warning-card strong-warning">
                          <strong>Alpha contract warning</strong>
                          <p>{lastGeneratedImageAsset.outputWarning}</p>
                        </div>
                      ) : null}
                    </div>
                    <div className="generation-handoff-actions">
                      <button className="secondary-action compact-action" type="button" onClick={openGeneratedAsset}>
                        Open In Asset Studio
                      </button>
                      {lastGeneratedImageAsset.entityKind === "scene-background" ? (
                        <button
                          className="secondary-action compact-action"
                          type="button"
                          onClick={assignGeneratedAssetToBackgroundDraft}
                        >
                          Set Background Draft
                        </button>
                      ) : null}
                      <button
                        className="secondary-action compact-action"
                        type="button"
                        onClick={assignGeneratedAssetToPlayerDraft}
                      >
                        Assign To Player
                      </button>
                      {lastGeneratedImageAsset.entityKind === "actor" ? (
                        <button
                          className="secondary-action compact-action"
                          type="button"
                          onClick={assignGeneratedAssetToActorDraft}
                        >
                          Assign To Actor
                        </button>
                      ) : null}
                      {lastGeneratedImageAsset.intendedUse === "animation-reference" ||
                      lastGeneratedImageAsset.intendedUse === "sprite-sheet" ||
                      lastGeneratedImageAsset.entityKind === "actor" ? (
                        <button
                          className="secondary-action compact-action"
                          type="button"
                          onClick={useGeneratedAssetAsAnimationSheet}
                        >
                          Open In Character Gym
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {selectedGenerationTarget ? (
                  <>
                    <div className="prompt-chip-list">
                      <span className={`target-mode-pill ${selectedImageTargetWorkflowTone}`}>
                        {selectedImageTargetWorkflow.label}
                      </span>
                      <span className="prompt-chip">{selectedImageWorkflowFamily}</span>
                      {activeStyleBible ? <span className="prompt-chip">style {activeStyleBible.id}</span> : null}
                      <span className="prompt-chip">
                        {selectedGenerationDimensions.width} x {selectedGenerationDimensions.height}
                      </span>
                    </div>
                    <p>{selectedImageTargetWorkflow.detail}</p>
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
            <div className="workspace-overview build-workspace asset-workspace">
              <section className="overview-card asset-studio-shell">
                <AssetStudioSidebar
                  activeTool={activeAssetTool}
                  assetCount={project.assetCount}
                  canImport={!!project}
                  selectedAssetId={selectedAsset?.id ?? null}
                  onImportAssets={importAssets}
                  onToolChange={activateAssetTool}
                />
                <div className="asset-studio-preview">
                  <div
                    className={`asset-studio-image ${selectedAssetUrl ? "has-preview" : ""} ${activeAssetTool === "crop" ? "crop-editor-active" : ""}`}
                    ref={activeAssetTool === "crop" ? cropImageFrameRef : undefined}
                    style={selectedAssetUrl ? { backgroundImage: `url("${selectedAssetUrl}")` } : undefined}
                    aria-label={selectedAsset ? `${selectedAsset.id} preview` : "No asset preview"}
                    role="img"
                  >
                    {selectedAssetUrl && activeAssetTool === "crop" ? (
                      <svg
                        className="asset-crop-overlay"
                        viewBox={`0 0 ${cropImageSize.width} ${cropImageSize.height}`}
                        preserveAspectRatio="xMidYMid meet"
                      >
                        <path className="asset-crop-mask" d={cropSvgPath} />
                        <path className="asset-crop-outline" d={cropSvgPath} />
                        {cropPath.map((_, index) => (
                          <path
                            className="asset-crop-segment-hit"
                            d={buildBezierCropSegmentSvgPath(cropPath, index)}
                            key={`crop-segment-${index}`}
                            onPointerDown={(event) => insertCropNodeFromEvent(index, event)}
                          />
                        ))}
                        {cropPath.map((node, index) => {
                          const inHandle = node.inHandle;
                          const outHandle = node.outHandle;
                          const selected = selectedCropNodeIndex === index;
                          return (
                            <g className={`asset-crop-node-group ${selected ? "selected" : ""}`} key={`crop-node-${index}`}>
                              {inHandle ? (
                                <>
                                  <line className="asset-crop-handle-line" x1={node.x} x2={inHandle.x} y1={node.y} y2={inHandle.y} />
                                  <circle
                                    className="asset-crop-handle in"
                                    cx={inHandle.x}
                                    cy={inHandle.y}
                                    r={Math.max(6, cropControlRadius * 0.75)}
                                    onPointerDown={(event) => startCropHandleInteraction(index, "inHandle", event)}
                                  />
                                </>
                              ) : null}
                              {outHandle ? (
                                <>
                                  <line className="asset-crop-handle-line" x1={node.x} x2={outHandle.x} y1={node.y} y2={outHandle.y} />
                                  <circle
                                    className="asset-crop-handle out"
                                    cx={outHandle.x}
                                    cy={outHandle.y}
                                    r={Math.max(6, cropControlRadius * 0.75)}
                                    onPointerDown={(event) => startCropHandleInteraction(index, "outHandle", event)}
                                  />
                                </>
                              ) : null}
                              <circle
                                className={`asset-crop-node ${node.mode}`}
                                cx={node.x}
                                cy={node.y}
                                r={cropControlRadius}
                                onPointerDown={(event) => startCropNodeInteraction(index, event)}
                              />
                              <text className="asset-crop-node-label" x={node.x + cropControlRadius + 6} y={node.y - cropControlRadius}>
                                {index + 1}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    ) : selectedAssetUrl ? null : (
                      <Image size={32} />
                    )}
                  </div>
                  <div className="asset-studio-meta">
                    <span className={`target-mode-pill ${selectedAssetHealth === "missing" ? "warn" : "good"}`}>
                      {selectedAsset ? selectedAssetHealth : "no asset"}
                    </span>
                    <span>{selectedAsset?.kind ?? "image"}</span>
                    <span>{selectedAsset?.path ?? "No path"}</span>
                  </div>
                </div>
                <div className="asset-studio-tool-panel">
                  {activeAssetTool === "info" ? (
                    <>
                      <span className="overview-label">Selected asset</span>
                      <strong>{selectedAsset?.id ?? "No asset selected"}</strong>
                      <p>{selectedAsset ? `${selectedAsset.kind} - ${selectedAsset.path}` : "Choose an asset from the project tree."}</p>
                      {selectedAsset ? (
                        <div className="asset-path-editor">
                          <label>
                            Asset path
                            <input value={assetPathDraft} onChange={(event) => setAssetPathDraft(event.target.value)} />
                          </label>
                          <div className="build-actions">
                            <button className="secondary-action compact-action" type="button" onClick={applyAssetRelink}>
                              <ExternalLink size={iconSize} /> Relink
                            </button>
                            <button
                              className="secondary-action compact-action"
                              disabled={!selectedScene || selectedAsset.kind !== "image" || selectedAssetHealth === "missing"}
                              type="button"
                              onClick={assignAssetBackground}
                            >
                              <Image size={iconSize} /> Set Background
                            </button>
                            <button
                              className="secondary-action compact-action"
                              disabled={selectedAssetUsage.length > 0}
                              type="button"
                              onClick={deleteSelectedAsset}
                            >
                              <Trash2 size={iconSize} /> Delete Unused
                            </button>
                          </div>
                        </div>
                      ) : null}
                      <div className="diagnostic-list">
                        {selectedAssetUsage.length ? (
                          selectedAssetUsage.map((usage, index) => (
                            <div className="diagnostic-item" key={`asset-usage-${index}-${usage.detail}`}>
                              <div>
                                <strong>{usage.detail}</strong>
                                <p>{usage.sceneName ? `${usage.sceneName} (${usage.sceneId})` : usage.type}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p>No saved reference uses this asset yet.</p>
                        )}
                      </div>
                    </>
                  ) : activeAssetTool === "chroma" ? (
                    <>
                      <span className="overview-label">Chroma Key</span>
                      <strong>{selectedAsset?.id ?? "Select an asset"}</strong>
                      <div className="cleanup-preview-grid compact">
                        <div className="cleanup-preview-pane">
                          <span>Source</span>
                          <canvas ref={cleanupSourceCanvasRef} className="cleanup-canvas" onPointerDown={pickCleanupColor} />
                        </div>
                        <div className="cleanup-preview-pane checkerboard-pane">
                          <span>Preview</span>
                          <canvas ref={cleanupOutputCanvasRef} className="cleanup-canvas" />
                        </div>
                      </div>
                      <div className="cleanup-controls">
                        <label>Key color<input value={cleanupKeyColor} onChange={(event) => setCleanupKeyColor(event.target.value)} /></label>
                        <label>Tolerance<input min="0" max="255" type="range" value={cleanupTolerance} onChange={(event) => setCleanupTolerance(event.target.value)} /><small>{cleanupTolerance}</small></label>
                        <label>Feather<input min="0" max="120" type="range" value={cleanupFeather} onChange={(event) => setCleanupFeather(event.target.value)} /><small>{cleanupFeather}</small></label>
                        <label className="checkbox-field"><input checked={cleanupSpillReduction} type="checkbox" onChange={(event) => setCleanupSpillReduction(event.target.checked)} />Reduce spill</label>
                      </div>
                      <div className="cleanup-status-row"><p>{cleanupStatus}</p></div>
                      <div className="build-actions">
                        <button className="secondary-action compact-action" disabled={!backgroundCleanupTarget} type="button" onClick={renderBackgroundCleanupPreview}>Refresh</button>
                        <button className="play-action compact-action" disabled={!backgroundCleanupTarget} type="button" onClick={saveBackgroundCleanupAsset}>Save New PNG</button>
                      </div>
                    </>
                  ) : activeAssetTool === "crop" ? (
                    <>
                      <span className="overview-label">Crop</span>
                      <strong>{selectedAsset?.id ?? "Select an asset"}</strong>
                      <div className="crop-stats-grid">
                        <div><span>Image</span><strong>{cropImageSize.width} x {cropImageSize.height}</strong></div>
                        <div><span>Output</span><strong>{cropPreviewBounds.width} x {cropPreviewBounds.height}</strong></div>
                        <div><span>Nodes</span><strong>{cropPath.length}</strong></div>
                        <div><span>Mode</span><strong>{selectedCropNode?.mode ?? "corner"}</strong></div>
                      </div>
                      {selectedCropNode ? (
                        <div className="crop-node-editor">
                          <div className="crop-node-editor-header">
                            <strong>Node {selectedCropNodeIndex + 1}</strong>
                            <div className="crop-mode-toggle" role="group" aria-label="Crop node mode">
                              {(["corner", "smooth"] as const).map((mode) => (
                                <button
                                  className={selectedCropNode.mode === mode ? "active" : ""}
                                  key={`crop-node-mode-${mode}`}
                                  type="button"
                                  onClick={() => updateCropNodeMode(selectedCropNodeIndex, mode)}
                                >
                                  {mode}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="player-field-grid">
                            <label>
                              X
                              <input
                                value={String(selectedCropNode.x)}
                                onChange={(event) => updateCropNodePosition(selectedCropNodeIndex, "x", event.target.value)}
                              />
                            </label>
                            <label>
                              Y
                              <input
                                value={String(selectedCropNode.y)}
                                onChange={(event) => updateCropNodePosition(selectedCropNodeIndex, "y", event.target.value)}
                              />
                            </label>
                          </div>
                        </div>
                      ) : null}
                      <div className="crop-node-list">
                        {cropPath.map((node, index) => (
                          <button
                            className={selectedCropNodeIndex === index ? "active" : ""}
                            key={`crop-node-select-${index}`}
                            type="button"
                            onClick={() => setSelectedCropNodeIndex(index)}
                          >
                            {index + 1}
                            <span>{node.mode}</span>
                          </button>
                        ))}
                      </div>
                      <p>{cropStatus}</p>
                      <div className="build-actions">
                        <button className="play-action compact-action" disabled={!selectedAssetUrl} type="button" onClick={saveCroppedAsset}>
                          <Scissors size={iconSize} /> Save Cutout PNG
                        </button>
                        <button className="secondary-action compact-action" disabled={!selectedAssetUrl} type="button" onClick={resetCropPath}>
                          Reset Path
                        </button>
                      </div>
                    </>
                  ) : activeAssetTool === "guide" ? (
                    <>
                      <span className="overview-label">Generation Guide</span>
                      <strong>{selectedSavedGenerationTarget?.id ?? "No saved target"}</strong>
                      <p>Creates reusable reference and mask assets for custom ComfyUI workflows with LoadImage/LoadImageMask nodes.</p>
                      <div className="prompt-studio-controls">
                        <label className="prompt-studio-field">Saved prompt pack<select value={selectedPromptPack?.id ?? ""} onChange={(event) => setSelectedPromptPackId(event.target.value || null)}><option value="">Select pack</option>{project?.promptPacks.map((pack) => <option key={`guide-pack-${pack.id}`} value={pack.id}>{pack.id}</option>)}</select></label>
                        <label className="prompt-studio-field">Target<select value={selectedSavedGenerationTarget?.id ?? ""} onChange={(event) => setSelectedGenerationTargetId(event.target.value)}><option value="">Select target</option>{savedPromptPackTargets.map((target) => <option key={`guide-target-${target.id}`} value={target.id}>{target.id} ({target.intendedUse})</option>)}</select></label>
                        <label className="prompt-studio-field">Scene source<select value={selectedGuideSource?.id ?? ""} onChange={(event) => setGuideSourceId(event.target.value)}>{guideSourceOptions.map((source) => <option key={`guide-source-${source.id}`} value={source.id}>{source.label}</option>)}</select></label>
                        <label className="prompt-studio-field">Mask shape<select value={guideShape} onChange={(event) => setGuideShape(event.target.value === "ellipse" ? "ellipse" : "rect")}><option value="rect">rect</option><option value="ellipse">ellipse</option></select></label>
                      </div>
                      <p>{guideStatus}</p>
                      <div className="build-actions">
                        <button className="play-action compact-action" disabled={!selectedAsset || !selectedPromptPack || !selectedSavedGenerationTarget || !selectedGuideSource} type="button" onClick={saveGuideMaskAsset}>
                          <Crosshair size={iconSize} /> Save Mask And Link Target
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              </section>
              {activeAssetTool === "animation" ? (
              <section className="overview-card prompt-studio-card character-gym-card">
                <span className="overview-label">Character Gym</span>
                <strong>{selectedAnimationPack?.id ?? animationPackDraft.id}</strong>
                <p>
                  Build a reusable spritesheet animation pack, then assign it to the current scene player or
                  selected actor.
                </p>
                <div className="prompt-studio-controls">
                  <label className="prompt-studio-field">
                    Existing pack
                    <select
                      value={selectedAnimationPack?.id ?? ""}
                      onChange={(event) => {
                        setSelectedAnimationPackId(event.target.value || null);
                      }}
                    >
                      <option value="">New draft</option>
                      {project?.animationPacks.map((animationPack) => (
                        <option key={`gym-pack-${animationPack.id}`} value={animationPack.id}>
                          {animationPack.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="prompt-studio-field">
                    Pack id
                    <input
                      value={animationPackDraft.id}
                      onChange={(event) => updateAnimationPackDraft("id", event.target.value)}
                    />
                  </label>
                  <label className="prompt-studio-field">
                    Name
                    <input
                      value={animationPackDraft.name}
                      onChange={(event) => updateAnimationPackDraft("name", event.target.value)}
                    />
                  </label>
                  <label className="prompt-studio-field">
                    Spritesheet asset
                    <select
                      value={animationPackDraft.assetId}
                      onChange={(event) => updateAnimationPackDraft("assetId", event.target.value)}
                    >
                      <option value="">Select image asset</option>
                      {project?.assets
                        .filter((asset) => asset.kind === "image")
                        .map((asset) => (
                          <option key={`gym-asset-${asset.id}`} value={asset.id}>
                            {asset.id}
                          </option>
                        ))}
                    </select>
                  </label>
                  <div className="player-field-grid">
                    <label>
                      Frame W
                      <input
                        value={animationPackDraft.frameWidth}
                        onChange={(event) => updateAnimationPackDraft("frameWidth", event.target.value)}
                      />
                    </label>
                    <label>
                      Frame H
                      <input
                        value={animationPackDraft.frameHeight}
                        onChange={(event) => updateAnimationPackDraft("frameHeight", event.target.value)}
                      />
                    </label>
                    <label>
                      Columns
                      <input
                        value={animationPackDraft.gridColumns}
                        onChange={(event) => updateAnimationPackDraft("gridColumns", event.target.value)}
                      />
                    </label>
                    <label>
                      Rows
                      <input
                        value={animationPackDraft.gridRows}
                        onChange={(event) => updateAnimationPackDraft("gridRows", event.target.value)}
                      />
                    </label>
                    <label>
                      Foot X
                      <input
                        value={animationPackDraft.footOriginX}
                        onChange={(event) => updateAnimationPackDraft("footOriginX", event.target.value)}
                      />
                    </label>
                    <label>
                      Foot Y
                      <input
                        value={animationPackDraft.footOriginY}
                        onChange={(event) => updateAnimationPackDraft("footOriginY", event.target.value)}
                      />
                    </label>
                    <label className="player-field-wide">
                      Default facing
                      <select
                        value={animationPackDraft.defaultFacing}
                        onChange={(event) =>
                          updateAnimationPackDraft(
                            "defaultFacing",
                            event.target.value === "left" ? "left" : "right"
                          )
                        }
                      >
                        <option value="right">right</option>
                        <option value="left">left</option>
                      </select>
                    </label>
                  </div>
                  <div className="character-gym-preview-panel">
                    <div className="character-gym-preview-header">
                      <div>
                        <span className="overview-label">Clip preview</span>
                        <strong>{animationPreviewClip?.id ?? "No clip"}</strong>
                      </div>
                      <span className={`target-mode-pill ${animationPreviewState ? "good" : "warn"}`}>
                        {animationPreviewState ? `Frame ${animationPreviewState.frame.frame}` : "Draft check"}
                      </span>
                    </div>
                    <div className="character-gym-preview-stage">
                      {animationPreviewAssetUrl && animationPreviewState ? (
                        <div
                          aria-label={`${animationPreviewClip?.id ?? "clip"} animation preview`}
                          className="character-gym-preview-sprite"
                          role="img"
                          style={{
                            aspectRatio: `${animationPreviewState.width} / ${animationPreviewState.height}`,
                            backgroundImage: `url("${animationPreviewAssetUrl}")`,
                            backgroundPosition: animationPreviewState.backgroundPosition,
                            backgroundSize: animationPreviewState.backgroundSize
                          }}
                        />
                      ) : (
                        <div className="character-gym-preview-empty">No frame</div>
                      )}
                    </div>
                    <p>{animationPreviewStatus}</p>
                  </div>
                  <div className="character-gym-slicer-panel">
                    <div className="character-gym-preview-header">
                      <div>
                        <span className="overview-label">Frame slicing</span>
                        <strong>{animationSliceCells.length} frame(s)</strong>
                      </div>
                      <span className={`target-mode-pill ${animationPreviewAssetUrl ? "good" : "warn"}`}>
                        {animationPreviewAssetUrl ? "Click to append" : "No sheet"}
                      </span>
                    </div>
                    {animationPreviewAssetUrl && animationSliceCells.length ? (
                      <div
                        className="character-gym-slicer-grid"
                        style={{
                          gridTemplateColumns: `repeat(${Math.max(
                            1,
                            Number(animationPackDraft.gridColumns) || 1
                          )}, minmax(42px, 1fr))`
                        }}
                      >
                        {animationSliceCells.map((cell) => (
                          <button
                            className={`character-gym-slice-cell ${
                              animationPreviewClipFrameSet.has(cell.frame) ? "is-in-clip" : ""
                            } ${animationPreviewState?.frame.frame === cell.frame ? "is-current" : ""}`}
                            key={`slice-frame-${cell.frame}`}
                            title={`Add frame ${cell.frame} to ${animationPreviewClip?.id ?? "clip"}`}
                            type="button"
                            onClick={() => appendFrameToAnimationClip(cell.frame)}
                          >
                            <span
                              aria-hidden="true"
                              className="character-gym-slice-thumb"
                              style={{
                                aspectRatio: `${Math.max(
                                  1,
                                  animationPreviewState?.width ?? (Number(animationPackDraft.frameWidth) || 1)
                                )} / ${Math.max(
                                  1,
                                  animationPreviewState?.height ?? (Number(animationPackDraft.frameHeight) || 1)
                                )}`,
                                backgroundImage: `url("${animationPreviewAssetUrl}")`,
                                backgroundPosition: cell.backgroundPosition,
                                backgroundSize: cell.backgroundSize
                              }}
                            />
                            <span>{cell.frame}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="character-gym-preview-empty">Select a spritesheet and grid</div>
                    )}
                    <p>
                      Click a frame to append it to the focused clip sequence. Repeated clicks keep repeated
                      animation frames.
                    </p>
                  </div>
                  <div className="clip-editor-list">
                    {animationPackDraft.clips.map((clip, index) => (
                      <div
                        className={`clip-editor-row ${
                          animationPreviewClip === clip ? "is-previewing" : ""
                        }`}
                        key={`clip-${index}-${clip.id}`}
                        onFocusCapture={() => setSelectedAnimationClipPreviewId(clip.id)}
                      >
                        <label className="prompt-studio-field">
                          Clip
                          <input
                            value={clip.id}
                            onChange={(event) => {
                              setSelectedAnimationClipPreviewId(event.target.value);
                              updateAnimationClipDraft(index, { id: event.target.value });
                            }}
                          />
                        </label>
                        <label className="prompt-studio-field">
                          Frames
                          <input
                            placeholder="0, 1, 2"
                            value={clip.frames}
                            onChange={(event) => {
                              setSelectedAnimationClipPreviewId(clip.id);
                              updateAnimationClipDraft(index, { frames: event.target.value });
                            }}
                          />
                        </label>
                        <label className="prompt-studio-field">
                          FPS
                          <input
                            value={clip.fps}
                            onChange={(event) => {
                              setSelectedAnimationClipPreviewId(clip.id);
                              updateAnimationClipDraft(index, { fps: event.target.value });
                            }}
                          />
                        </label>
                        <label className="checkbox-field clip-loop-field">
                          <input
                            checked={clip.loop}
                            type="checkbox"
                            onChange={(event) => {
                              setSelectedAnimationClipPreviewId(clip.id);
                              updateAnimationClipDraft(index, { loop: event.target.checked });
                            }}
                          />
                          Loop
                        </label>
                        <button
                          className="secondary-action"
                          disabled={defaultAnimationClipIds.some((clipId) => clipId === clip.id)}
                          type="button"
                          onClick={() =>
                            setAnimationPackDraft((current) => ({
                              ...current,
                              clips: current.clips.filter((_, clipIndex) => clipIndex !== index)
                            }))
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="build-actions character-gym-actions">
                  <button className="secondary-action compact-action" type="button" onClick={createAnimationPackDraftFromSelection}>
                    <FilePlus2 size={iconSize} /> New Pack
                  </button>
                  <button className="secondary-action compact-action" type="button" onClick={() =>
                    setAnimationPackDraft((current) => ({
                      ...current,
                      clips: [
                        ...current.clips,
                        {
                          id: `clip-${current.clips.length + 1}`,
                          frames: "0",
                          fps: "4",
                          loop: true
                        }
                      ]
                    }))
                  }>
                    <Plus size={iconSize} /> Add Clip
                  </button>
                  <button className="play-action compact-action" disabled={!project} type="button" onClick={saveAnimationPackDraft}>
                    <CheckCircle2 size={iconSize} /> Save Pack
                  </button>
                  <button
                    className="secondary-action compact-action"
                    disabled={!selectedScene}
                    type="button"
                    onClick={assignAnimationPackToPlayerDraft}
                  >
                    <UserRound size={iconSize} /> Assign Player
                  </button>
                  <button
                    className="secondary-action compact-action"
                    disabled={!selectedActor}
                    type="button"
                    onClick={assignAnimationPackToActorDraft}
                  >
                    <Package size={iconSize} /> Assign Actor
                  </button>
                </div>
              </section>
              ) : null}
            </div>
          ) : (
            <div
              className={`scene-viewport ${
                selectedScene &&
                activeImageGenerationContext?.entityKind === "scene-background" &&
                activeImageGenerationContext.sceneId === selectedScene.id
                  ? "is-generating-background"
                  : ""
              }`}
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
              {selectedScene &&
              activeImageGenerationContext?.entityKind === "scene-background" &&
              activeImageGenerationContext.sceneId === selectedScene.id ? (
                <div className="viewport-generation-banner">
                  <span className="viewport-generation-spinner" aria-hidden="true" />
                  <strong>Generating background</strong>
                </div>
              ) : null}
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
                  <button type="button" onClick={createSceneLayer}>
                    + Layer
                  </button>
                </div>
              ) : null}
              {selectedScene ? (
              <>
                {previewSceneLayers.map((layer) =>
                  layer.visible !== false && layer.assetUrl && layer.bounds ? (
                    <div
                      className={`scene-layer-plane ${selectedSceneLayerId === layer.id ? "selected" : ""}`}
                      key={`scene-layer-preview-${layer.id}`}
                      style={{
                        backgroundImage: `url("${layer.assetUrl}")`,
                        height: `${(layer.bounds.height / previewSceneSize.height) * 100}%`,
                        left: `${(layer.bounds.x / previewSceneSize.width) * 100}%`,
                        opacity: layer.opacity ?? 1,
                        top: `${(layer.bounds.y / previewSceneSize.height) * 100}%`,
                        width: `${(layer.bounds.width / previewSceneSize.width) * 100}%`,
                        zIndex: layer.depth
                      }}
                    />
                  ) : null
                )}
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
                {currentGenerationGuides.length ? (
                  <svg
                    className="generation-guide-overlay"
                    viewBox={`0 0 ${previewSceneSize.width} ${previewSceneSize.height}`}
                    preserveAspectRatio="none"
                  >
                    {currentGenerationGuides
                      .filter((guide) => guide.visible !== false)
                      .map((guide) => {
                        const bounds = boundsForGenerationGuideShape(guide.shape);
                        const color = generationGuideColor(guide);
                        const selected = selectedGenerationGuide?.id === guide.id;
                        return (
                          <g
                            className={`generation-guide-mark ${selected ? "selected" : ""}`}
                            key={`generation-guide-${guide.id}`}
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              setSelectedGenerationGuideId(guide.id);
                              setSceneInspectorTarget("scene");
                            }}
                          >
                            {guide.shape.type === "polygon" ? (
                              <>
                                <polygon
                                  className="generation-guide-shape-hit"
                                  fill={color}
                                  points={guide.shape.points.map((point) => `${point.x},${point.y}`).join(" ")}
                                  stroke={color}
                                  onPointerDown={(event) => startGenerationGuideShapeInteraction(guide, "move", event)}
                                />
                                {selected
                                  ? guide.shape.points.map((point, index) => {
                                      const nextPoint = guide.shape.type === "polygon"
                                        ? guide.shape.points[(index + 1) % guide.shape.points.length]!
                                        : point;
                                      return (
                                        <line
                                          className="generation-guide-edge-hit"
                                          key={`generation-guide-edge-${guide.id}-${index}`}
                                          x1={point.x}
                                          x2={nextPoint.x}
                                          y1={point.y}
                                          y2={nextPoint.y}
                                          onPointerDown={(event) => insertGenerationGuidePointFromEvent(guide, index, event)}
                                        />
                                      );
                                    })
                                  : null}
                                {selected
                                  ? guide.shape.points.map((point, index) => (
                                      <g key={`generation-guide-point-${guide.id}-${index}`}>
                                        <circle
                                          className="generation-guide-point"
                                          cx={point.x}
                                          cy={point.y}
                                          r="7"
                                          onPointerDown={(event) =>
                                            startGenerationGuidePointInteraction(guide, index, point, event)
                                          }
                                        />
                                        <text className="generation-guide-point-label" x={point.x + 10} y={point.y - 10}>
                                          {index + 1}
                                        </text>
                                      </g>
                                    ))
                                  : null}
                              </>
                            ) : guide.shape.type === "ellipse" ? (
                              <ellipse
                                className="generation-guide-shape-hit"
                                cx={bounds.x + bounds.width / 2}
                                cy={bounds.y + bounds.height / 2}
                                fill={color}
                                rx={bounds.width / 2}
                                ry={bounds.height / 2}
                                stroke={color}
                                onPointerDown={(event) => startGenerationGuideShapeInteraction(guide, "move", event)}
                              />
                            ) : (
                              <rect
                                className="generation-guide-shape-hit"
                                fill={color}
                                height={bounds.height}
                                stroke={color}
                                width={bounds.width}
                                x={bounds.x}
                                y={bounds.y}
                                onPointerDown={(event) => startGenerationGuideShapeInteraction(guide, "move", event)}
                              />
                            )}
                            {selected && guide.shape.type !== "polygon" ? (
                              <rect
                                className="generation-guide-resize-handle"
                                height="14"
                                width="14"
                                x={bounds.x + bounds.width - 7}
                                y={bounds.y + bounds.height - 7}
                                onPointerDown={(event) => startGenerationGuideShapeInteraction(guide, "resize", event)}
                              />
                            ) : null}
                            <text x={bounds.x + 8} y={Math.max(18, bounds.y - 8)}>
                              {guide.name}
                            </text>
                          </g>
                        );
                      })}
                  </svg>
                ) : null}
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
                    const actorIsGenerating =
                      activeImageGenerationContext?.entityKind === "actor" &&
                      activeImageGenerationContext.sceneId === selectedScene.id &&
                      activeImageGenerationContext.entityId === actor.id;
                    return (
                  <button
                    className={`actor-box ${selectedActor?.id === actor.id ? "selected" : ""} ${actorIssues?.hasIssues ? `has-issues ${actorIssues.tone}` : ""} ${actorIsGenerating ? "is-generating" : ""}`}
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
                    {actorIsGenerating ? (
                      <span className="viewport-generation-indicator">
                        <span className="viewport-generation-spinner" aria-hidden="true" />
                        Generating
                      </span>
                    ) : null}
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
                {(() => {
                  const playerIsGenerating =
                    activeImageGenerationContext?.entityKind === "player" &&
                    activeImageGenerationContext.sceneId === selectedScene.id;
                  return (
                <div
                  className={`character ${previewPlayerAssetUrl ? "has-player-asset" : ""} ${
                    isPlayerInspectorSelected ? "selected" : ""
                  } ${playerIsGenerating ? "is-generating" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={selectPlayerInScene}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectPlayerInScene();
                    }
                  }}
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
                    {playerIsGenerating ? (
                      <span className="viewport-generation-indicator player-generation-indicator">
                        <span className="viewport-generation-spinner" aria-hidden="true" />
                        Generating
                      </span>
                    ) : null}
                </div>
                  );
                })()}
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
                    const pickupAssetPath = pickup.assetId ? assetPathById.get(pickup.assetId) : null;
                    const pickupAssetUrl = pickupAssetPath ? assetPreviewUrls[pickupAssetPath] : undefined;
                    const pickupIsGenerating =
                      activeImageGenerationContext?.entityKind === "pickup" &&
                      activeImageGenerationContext.sceneId === selectedScene.id &&
                      activeImageGenerationContext.entityId === pickup.id;
                    return (
                  <button
                    className={`pickup-box ${selectedPickup?.id === pickup.id ? "selected" : ""} ${pickupIssues?.hasIssues ? `has-issues ${pickupIssues.tone}` : ""} ${pickupIsGenerating ? "is-generating" : ""}`}
                    key={pickup.id}
                    type="button"
                    onClick={() => selectPickup(pickup)}
                    onPointerDown={(event) => startPickupInteraction("move", pickup, event)}
                    style={{
                      height: `${(pickup.bounds.height / previewSceneSize.height) * 100}%`,
                      left: `${(pickup.bounds.x / previewSceneSize.width) * 100}%`,
                      top: `${(pickup.bounds.y / previewSceneSize.height) * 100}%`,
                      width: `${(pickup.bounds.width / previewSceneSize.width) * 100}%`,
                      backgroundImage: pickupAssetUrl ? `url("${pickupAssetUrl}")` : undefined,
                      backgroundPosition: pickupAssetUrl ? "center" : undefined,
                      backgroundRepeat: pickupAssetUrl ? "no-repeat" : undefined,
                      backgroundSize: pickupAssetUrl ? "100% 100%" : undefined
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
                    {pickupIsGenerating ? (
                      <span className="viewport-generation-indicator">
                        <span className="viewport-generation-spinner" aria-hidden="true" />
                        Generating
                      </span>
                    ) : null}
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

        </WorkspaceStagePanel>

        <InspectorPanel
          detail={inspectorDetailFor({
            hasSelectedFlow: !!selectedFlow,
            hasSelectedHotspot: !!selectedHotspot,
            hasSelectedItem: !!selectedItem,
            hasSelectedLocale: !!selectedLocale,
            hasSelectedPickup: !!selectedPickup,
            hasSelectedScene: !!selectedScene,
            isPlayerInspectorSelected,
            workspace
          })}
        >
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
            ) : isPlayerInspectorSelected ? (
              <>
                <div className="context-setup-card">
                  <span className={`capability-badge ${playerAssetMissing || playerAnimationPackMissing ? "error" : "good"}`}>
                    Player setup
                  </span>
                  <strong>{selectedScene ? `${selectedScene.name} player` : "Scene player"}</strong>
                  <p>
                    Configure the playable character without leaving Scene. Player animation packs should include
                    `idle` and `walk`; `talk` is useful for dialogue scenes.
                  </p>
                  <div className="context-action-row">
                    <button type="button" onClick={() => setActiveSceneTool("player-start")}>
                      Edit start in viewport
                    </button>
                    <button type="button" onClick={createAnimationPackDraftFromSelection}>
                      Create player pack
                    </button>
                  </div>
                </div>
                <label>
                  Player asset
                  <select
                    className={playerAssetMissing ? "field-input-invalid" : ""}
                    value={currentSceneDraft.playerAssetId}
                    onChange={(event) => updateSceneDraft("playerAssetId", event.target.value)}
                  >
                    <option value="">Generated marker</option>
                    {availableAssetIds.map((assetId) => (
                      <option key={`scene-player-asset-${assetId}`} value={assetId}>
                        {assetId}
                      </option>
                    ))}
                  </select>
                  {playerAssetMissing ? (
                    <small className="field-hint error">Selected player asset no longer exists.</small>
                  ) : null}
                </label>
                <EntityAssetDropZone
                  assetId={currentSceneDraft.playerAssetId.trim()}
                  assetPath={previewPlayerAssetPath}
                  assetUrl={previewPlayerAssetUrl}
                  label="Player image"
                  missing={playerAssetMissing}
                  onEditAsset={() =>
                    openAssetStudioForAsset("player", currentPlayerAsset, previewPlayerAssetUrl, undefined, "info")
                  }
                  onDropFiles={(filePaths) => importAssetFilesForTarget(filePaths, "player")}
                  onImportClick={() => importPickedAssetForTarget("player")}
                  onOpenAsset={() => {
                    if (!currentSceneDraft.playerAssetId.trim()) return;
                    setSelectedAssetId(currentSceneDraft.playerAssetId.trim());
                    setWorkspace("assets");
                  }}
                />
                <label>
                  Player animation pack
                  <select
                    className={playerAnimationPackMissing ? "field-input-invalid" : ""}
                    value={currentSceneDraft.playerAnimationPackId}
                    onChange={(event) => updateSceneDraft("playerAnimationPackId", event.target.value)}
                  >
                    <option value="">None</option>
                    {project?.animationPacks.map((animationPack) => {
                      const clipIds = new Set(animationPack.clips.map((clip) => clip.id));
                      const suffix = clipIds.has("idle") && clipIds.has("walk") ? " - player ready" : "";
                      return (
                        <option key={`scene-player-pack-${animationPack.id}`} value={animationPack.id}>
                          {animationPack.id}
                          {suffix}
                        </option>
                      );
                    })}
                  </select>
                  {playerAnimationPackMissing ? (
                    <small className="field-hint error">Selected player animation pack no longer exists.</small>
                  ) : null}
                </label>
                <div className="field-group">
                  <span>Start and movement</span>
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
                </div>
                <div className="flow-link">
                  <span>Playable character</span>
                  <strong>
                    {currentSceneDraft.playerAnimationPackId.trim() || currentSceneDraft.playerAssetId.trim() || "debug marker"}
                    {selectedScene && dirtyState.sceneIds.has(selectedScene.id) ? " - unsaved draft" : ""}
                  </strong>
                  <button type="button" onClick={applySceneChanges}>
                    Apply player changes -&gt;
                  </button>
                </div>
              </>
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
                <div className="context-setup-card">
                  <span className={`capability-badge ${actorAssetMissing || actorAnimationPackMissing ? "error" : "good"}`}>
                    {currentActorDraft.role}
                  </span>
                  <strong>{selectedActor.id}</strong>
                  <p>
                    {currentActorDraft.role === "npc"
                      ? "NPCs usually need an asset, an optional animation pack with idle/talk clips, and dialogue flows."
                      : currentActorDraft.role === "prop" || currentActorDraft.role === "decoration"
                        ? "Props and decorations can stay static; add an animation pack only when the object should move."
                        : "Assign visual and interaction references for this scene actor."}
                  </p>
                  <div className="context-action-row">
                    <button type="button" onClick={() => setActiveSceneTool("actor")}>
                      Edit in viewport
                    </button>
                    <button type="button" onClick={createAnimationPackDraftFromSelection}>
                      Create actor pack
                    </button>
                    <button type="button" onClick={() => openImageGenerationForSceneTarget(selectedActor.id)}>
                      Generate asset
                    </button>
                    {selectedActor.role === "npc" ? (
                      <button
                        type="button"
                        onClick={() => openImageGenerationForSceneTarget(`${selectedActor.id}-sprite-sheet`)}
                      >
                        Generate sheet ref
                      </button>
                    ) : null}
                  </div>
                </div>
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
                <EntityAssetDropZone
                  assetId={currentActorAssetId}
                  assetPath={currentActorAssetPath}
                  assetUrl={currentActorAssetUrl}
                  label="Actor image"
                  missing={actorAssetMissing}
                  onEditAsset={() =>
                    openAssetStudioForAsset("actor", currentActorAsset, currentActorAssetUrl, selectedActor.id, "info")
                  }
                  onDropFiles={(filePaths) => importAssetFilesForTarget(filePaths, "actor")}
                  onImportClick={() => importPickedAssetForTarget("actor")}
                  onOpenAsset={() => {
                    if (!currentActorAssetId) return;
                    setSelectedAssetId(currentActorAssetId);
                    setWorkspace("assets");
                  }}
                />
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
                <div className="context-setup-card">
                  <span className={`capability-badge ${hotspotGuardrail.tone}`}>Hotspot</span>
                  <strong>{selectedHotspot.id}</strong>
                  <p>
                    Hotspots are interaction areas, so asset and animation setup stays out of the critical path.
                    Bind label, cursor, spots, and verb flows here.
                  </p>
                  <div className="context-action-row">
                    <button type="button" onClick={() => setActiveSceneTool("hotspot")}>
                      Edit bounds
                    </button>
                    {firstHotspotIssueTarget ? (
                      <button type="button" onClick={focusFirstHotspotIssue}>
                        Jump to issue
                      </button>
                    ) : null}
                  </div>
                </div>
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
                <div className="context-setup-card">
                  <span className={`capability-badge ${pickupGuardrail.tone}`}>Pickup</span>
                  <strong>{selectedPickup.id}</strong>
                  <p>
                    Pickups bind scene geometry to an inventory item and pickup flow. Visual sprite assignment is
                    handled by the scene pickup bounds in this data model.
                  </p>
                  <div className="context-action-row">
                    <button type="button" onClick={() => setActiveSceneTool("pickup")}>
                      Edit pickup bounds
                    </button>
                    <button type="button" onClick={() => openImageGenerationForSceneTarget(selectedPickup.id)}>
                      Generate prop
                    </button>
                    {firstPickupIssueTarget ? (
                      <button type="button" onClick={focusFirstPickupIssue}>
                        Jump to issue
                      </button>
                    ) : null}
                  </div>
                </div>
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
                  Asset
                  <select
                    className={pickupAssetMissing ? "field-input-invalid" : ""}
                    value={currentPickupDraft.assetId}
                    onChange={(event) => updatePickupDraft("assetId", event.target.value)}
                  >
                    <option value="">Debug bounds only</option>
                    {availableAssetIds.map((assetId) => (
                      <option key={`pickup-asset-${assetId}`} value={assetId}>
                        {assetId}
                      </option>
                    ))}
                  </select>
                  {pickupAssetMissing ? (
                    <small className="field-hint error">Selected pickup asset no longer exists.</small>
                  ) : null}
                </label>
                <EntityAssetDropZone
                  assetId={currentPickupAssetId}
                  assetPath={currentPickupAssetPath}
                  assetUrl={currentPickupAssetUrl}
                  label="Pickup image"
                  missing={pickupAssetMissing}
                  onEditAsset={() =>
                    openAssetStudioForAsset("pickup", currentPickupAsset, currentPickupAssetUrl, selectedPickup.id, "info")
                  }
                  onDropFiles={(filePaths) => importAssetFilesForTarget(filePaths, "pickup")}
                  onImportClick={() => importPickedAssetForTarget("pickup")}
                  onOpenAsset={() => {
                    if (!currentPickupAssetId) return;
                    setSelectedAssetId(currentPickupAssetId);
                    setWorkspace("assets");
                  }}
                />
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
                <EntityAssetDropZone
                  assetId={previewSceneBackgroundAsset?.id}
                  assetPath={!isHexColor(previewSceneBackground) ? previewSceneBackground : undefined}
                  assetUrl={previewSceneBackgroundUrl}
                  label="Scene background image"
                  missing={!isHexColor(previewSceneBackground) && !previewSceneBackgroundAsset}
                  onEditAsset={() =>
                    openAssetStudioForAsset("scene-background", previewSceneBackgroundAsset, previewSceneBackgroundUrl, undefined, "info")
                  }
                  onDropFiles={(filePaths) => importAssetFilesForTarget(filePaths, "scene-background")}
                  onImportClick={() => importPickedAssetForTarget("scene-background")}
                  onOpenAsset={() => {
                    if (!previewSceneBackgroundAsset) return;
                    setSelectedAssetId(previewSceneBackgroundAsset.id);
                    setWorkspace("assets");
                  }}
                />
                <div className="field-group">
                  <span>Visual layers</span>
                  <div className="layer-stack-header">
                    <strong>{currentSceneDraft.layers.length} layer(s)</strong>
                    <button type="button" onClick={createSceneLayer} disabled={imageAssets.length === 0}>
                      Add layer
                    </button>
                  </div>
                  {imageAssets.length === 0 ? (
                    <p className="inspector-copy">Import an image asset before creating scene layers.</p>
                  ) : null}
                  <div className="scene-layer-stack">
                    {currentSceneDraft.layers.length === 0 ? (
                      <div className="empty-inspector compact">No visual layers.</div>
                    ) : null}
                    {currentSceneDraft.layers.map((layer) => {
                      const missingLayerAsset = !!layer.assetId.trim() && !availableAssetIdsSet.has(layer.assetId.trim());
                      const isSelectedLayer = selectedSceneLayerId === layer.id;
                      return (
                        <div
                          className={`scene-layer-card ${isSelectedLayer ? "selected" : ""}`}
                          key={`scene-layer-editor-${layer.id}`}
                          onFocusCapture={() => setSelectedSceneLayerId(layer.id)}
                        >
                          <div className="scene-layer-card-header">
                            <button
                              type="button"
                              onClick={() => {
                                setSceneInspectorTarget("scene");
                                setSelectedSceneLayerId(layer.id);
                              }}
                            >
                              {layer.name || layer.id}
                            </button>
                            <label className="inline-toggle">
                              <input
                                checked={layer.visible}
                                type="checkbox"
                                onChange={(event) => updateSceneLayerDraft(layer.id, "visible", event.target.checked)}
                              />
                              Visible
                            </label>
                          </div>
                          <div className="four-fields">
                            <input
                              aria-label={`${layer.id} id`}
                              value={layer.id}
                              onChange={(event) => updateSceneLayerDraft(layer.id, "id", event.target.value)}
                            />
                            <input
                              aria-label={`${layer.id} name`}
                              value={layer.name}
                              onChange={(event) => updateSceneLayerDraft(layer.id, "name", event.target.value)}
                            />
                          </div>
                          <label>
                            Asset
                            <select
                              value={layer.assetId}
                              onChange={(event) => updateSceneLayerDraft(layer.id, "assetId", event.target.value)}
                            >
                              <option value="">Select asset</option>
                              {imageAssets.map((asset) => (
                                <option key={`layer-${layer.id}-asset-${asset.id}`} value={asset.id}>
                                  {asset.id}
                                </option>
                              ))}
                            </select>
                          </label>
                          {missingLayerAsset ? (
                            <p className="field-hint error">Layer asset no longer exists.</p>
                          ) : null}
                          <div className="four-fields">
                            <input
                              aria-label={`${layer.id} depth`}
                              value={layer.depth}
                              onChange={(event) => updateSceneLayerDraft(layer.id, "depth", event.target.value)}
                            />
                            <input
                              aria-label={`${layer.id} opacity`}
                              value={layer.opacity}
                              onChange={(event) => updateSceneLayerDraft(layer.id, "opacity", event.target.value)}
                            />
                          </div>
                          <div className="four-fields">
                            <input
                              aria-label={`${layer.id} X`}
                              value={layer.x}
                              onChange={(event) => updateSceneLayerDraft(layer.id, "x", event.target.value)}
                            />
                            <input
                              aria-label={`${layer.id} Y`}
                              value={layer.y}
                              onChange={(event) => updateSceneLayerDraft(layer.id, "y", event.target.value)}
                            />
                            <input
                              aria-label={`${layer.id} width`}
                              value={layer.width}
                              onChange={(event) => updateSceneLayerDraft(layer.id, "width", event.target.value)}
                            />
                            <input
                              aria-label={`${layer.id} height`}
                              value={layer.height}
                              onChange={(event) => updateSceneLayerDraft(layer.id, "height", event.target.value)}
                            />
                          </div>
                          <div className="layer-action-row">
                            <label className="inline-toggle">
                              <input
                                checked={layer.locked}
                                type="checkbox"
                                onChange={(event) => updateSceneLayerDraft(layer.id, "locked", event.target.checked)}
                              />
                              Locked
                            </label>
                            <button
                              className="danger"
                              type="button"
                              disabled={layer.locked}
                              onClick={() => deleteSceneLayerDraft(layer.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="field-group generation-guide-editor">
                  <span>Generation Guides</span>
                  <div className="layer-stack-header">
                    <strong>{currentGenerationGuides.length} guide(s)</strong>
                    <div className="inspector-actions-inline">
                      <button type="button" onClick={() => createBlankGenerationGuide("rect")}>
                        Rect
                      </button>
                      <button type="button" onClick={() => createBlankGenerationGuide("ellipse")}>
                        Ellipse
                      </button>
                      <button type="button" onClick={() => createBlankGenerationGuide("polygon")}>
                        Polygon
                      </button>
                    </div>
                  </div>
                  <div className="generation-guide-shortcuts">
                    <button
                      type="button"
                      onClick={() =>
                        createGenerationGuideFromBounds(
                          "Background",
                          "background",
                          { x: 0, y: 0, width: selectedScene.size.width, height: selectedScene.size.height },
                          { kind: "background" }
                        )
                      }
                    >
                      Background
                    </button>
                    {(selectedScene.layers ?? []).map((layer) => (
                      <button
                        key={`guide-layer-shortcut-${layer.id}`}
                        type="button"
                        onClick={() =>
                          createGenerationGuideFromBounds(
                            layer.name,
                            "layer",
                            layer.bounds ?? {
                              x: 0,
                              y: 0,
                              width: selectedScene.size.width,
                              height: selectedScene.size.height
                            },
                            { kind: "layer", id: layer.id }
                          )
                        }
                      >
                        Layer {layer.id}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        createGenerationGuideFromBounds(
                          "Player",
                          "player",
                          {
                            x: (previewPlayerStart ?? selectedScene.playerStart).x - 48,
                            y: (previewPlayerStart ?? selectedScene.playerStart).y - 128,
                            width: 96,
                            height: 128
                          },
                          { kind: "player" }
                        )
                      }
                    >
                      Player
                    </button>
                    {selectedScene.actors.map((actor) => (
                      <button
                        key={`guide-actor-shortcut-${actor.id}`}
                        type="button"
                        onClick={() =>
                          createGenerationGuideFromBounds(
                            actor.id,
                            actor.role === "npc" ? "npc" : "actor",
                            actor.bounds,
                            { kind: "actor", id: actor.id }
                          )
                        }
                      >
                        Actor {actor.id}
                      </button>
                    ))}
                    {selectedScene.pickups.map((pickup) => (
                      <button
                        key={`guide-pickup-shortcut-${pickup.id}`}
                        type="button"
                        onClick={() =>
                          createGenerationGuideFromBounds(pickup.id, "pickup", pickup.bounds, {
                            kind: "pickup",
                            id: pickup.id
                          })
                        }
                      >
                        Pickup {pickup.id}
                      </button>
                    ))}
                    {selectedScene.hotspots.map((hotspot) => (
                      <button
                        key={`guide-hotspot-shortcut-${hotspot.id}`}
                        type="button"
                        onClick={() =>
                          createGenerationGuideFromBounds(hotspot.id, "hotspot", hotspot.bounds, {
                            kind: "hotspot",
                            id: hotspot.id
                          })
                        }
                      >
                        Hotspot {hotspot.id}
                      </button>
                    ))}
                  </div>
                  <div className="scene-layer-stack">
                    {currentGenerationGuides.length === 0 ? (
                      <div className="empty-inspector compact">No generation guides.</div>
                    ) : null}
                    {currentGenerationGuides.map((guide) => (
                      <button
                        className={`generation-guide-row ${
                          selectedGenerationGuide?.id === guide.id ? "selected" : ""
                        }`}
                        key={`guide-row-${guide.id}`}
                        type="button"
                        onClick={() => setSelectedGenerationGuideId(guide.id)}
                      >
                        <span
                          className="generation-guide-swatch"
                          style={{ backgroundColor: generationGuideColor(guide) }}
                          aria-hidden="true"
                        />
                        <strong>{guide.name}</strong>
                        <span>{guide.role}</span>
                        <span>{generationGuideShapeLabel(guide.shape)}</span>
                      </button>
                    ))}
                  </div>
                  {selectedGenerationGuide ? (
                    <div className="generation-guide-detail">
                      <div className="four-fields">
                        <label>
                          ID
                          <input
                            value={selectedGenerationGuide.id}
                            onChange={(event) => updateSelectedGenerationGuide({ id: event.target.value })}
                          />
                        </label>
                        <label>
                          Name
                          <input
                            value={selectedGenerationGuide.name}
                            onChange={(event) => updateSelectedGenerationGuide({ name: event.target.value })}
                          />
                        </label>
                      </div>
                      <div className="four-fields">
                        <label>
                          Role
                          <select
                            value={selectedGenerationGuide.role}
                            onChange={(event) =>
                              updateSelectedGenerationGuide({
                                role: event.target.value as SceneGenerationGuideRole
                              })
                            }
                          >
                            {generationGuideRoles.map((role) => (
                              <option key={`generation-guide-role-${role}`} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Color
                          <input
                            type="color"
                            value={selectedGenerationGuide.color ?? generationGuideColor(selectedGenerationGuide)}
                            onChange={(event) => updateSelectedGenerationGuide({ color: event.target.value })}
                          />
                        </label>
                      </div>
                      <label>
                        Tags
                        <input
                          value={(selectedGenerationGuide.tags ?? []).join(", ")}
                          onChange={(event) =>
                            updateSelectedGenerationGuide({
                              tags: event.target.value
                                .split(",")
                                .map((tag) => tag.trim())
                                .filter(Boolean)
                            })
                          }
                        />
                      </label>
                      <div className="four-fields">
                        <label className="inline-toggle">
                          <input
                            checked={selectedGenerationGuide.visible !== false}
                            type="checkbox"
                            onChange={(event) => updateSelectedGenerationGuide({ visible: event.target.checked })}
                          />
                          Visible
                        </label>
                        <label className="inline-toggle">
                          <input
                            checked={selectedGenerationGuide.locked ?? false}
                            type="checkbox"
                            onChange={(event) => updateSelectedGenerationGuide({ locked: event.target.checked })}
                          />
                          Locked
                        </label>
                      </div>
                      <label>
                        Source
                        <input
                          value={
                            selectedGenerationGuide.source
                              ? `${selectedGenerationGuide.source.kind}${selectedGenerationGuide.source.id ? `:${selectedGenerationGuide.source.id}` : ""}`
                              : ""
                          }
                          onChange={(event) => {
                            const [kind, id] = event.target.value.split(":");
                            if (!kind) {
                              clearSelectedGenerationGuideSource();
                              return;
                            }
                            updateSelectedGenerationGuide({
                              source: {
                                kind: kind as NonNullable<SceneGenerationGuide["source"]>["kind"],
                                ...(id ? { id } : {})
                              }
                            });
                          }}
                        />
                      </label>
                      <label>
                        Shape
                        <select
                          value={selectedGenerationGuide.shape.type}
                          onChange={(event) => {
                            const shapeType = event.target.value as SceneGenerationGuideShape["type"];
                            const bounds = boundsForGenerationGuideShape(selectedGenerationGuide.shape);
                            updateSelectedGenerationGuideShape(
                              shapeType === "polygon"
                                ? {
                                    type: "polygon",
                                    points: [
                                      { x: bounds.x, y: bounds.y + bounds.height },
                                      { x: bounds.x + bounds.width / 2, y: bounds.y },
                                      { x: bounds.x + bounds.width, y: bounds.y + bounds.height }
                                    ]
                                  }
                                : { type: shapeType, bounds }
                            );
                          }}
                        >
                          <option value="rect">rect</option>
                          <option value="ellipse">ellipse</option>
                          <option value="polygon">polygon</option>
                        </select>
                      </label>
                      {(() => {
                        const guideShape = selectedGenerationGuide.shape;
                        if (guideShape.type === "polygon") {
                          return (
                            <div className="generation-guide-points">
                              {guideShape.points.map((point, index) => (
                                <div className="four-fields" key={`generation-guide-point-${index}`}>
                                  <input
                                    aria-label={`Guide point ${index + 1} x`}
                                    value={String(point.x)}
                                    onChange={(event) => {
                                      const nextPoints = [...guideShape.points];
                                      nextPoints[index] = { ...point, x: Number(event.target.value) };
                                      updateSelectedGenerationGuideShape({ type: "polygon", points: nextPoints });
                                    }}
                                  />
                                  <input
                                    aria-label={`Guide point ${index + 1} y`}
                                    value={String(point.y)}
                                    onChange={(event) => {
                                      const nextPoints = [...guideShape.points];
                                      nextPoints[index] = { ...point, y: Number(event.target.value) };
                                      updateSelectedGenerationGuideShape({ type: "polygon", points: nextPoints });
                                    }}
                                  />
                                  <button
                                    type="button"
                                    disabled={guideShape.points.length <= 3}
                                    onClick={() =>
                                      updateSelectedGenerationGuideShape({
                                        type: "polygon",
                                        points: guideShape.points.filter((_, pointIndex) => pointIndex !== index)
                                      })
                                    }
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() => {
                                  const lastPoint = guideShape.points.at(-1) ?? { x: 0, y: 0 };
                                  updateSelectedGenerationGuideShape({
                                    type: "polygon",
                                    points: [...guideShape.points, { x: lastPoint.x + 16, y: lastPoint.y + 16 }]
                                  });
                                }}
                              >
                                Add point
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div className="four-fields">
                            {(["x", "y", "width", "height"] as const).map((field) => (
                              <input
                                aria-label={`Guide ${field}`}
                                key={`generation-guide-bounds-${field}`}
                                value={String(guideShape.bounds[field])}
                                onChange={(event) =>
                                  updateSelectedGenerationGuideShape({
                                    ...guideShape,
                                    bounds: {
                                      ...guideShape.bounds,
                                      [field]: Number(event.target.value)
                                    }
                                  })
                                }
                              />
                            ))}
                          </div>
                        );
                      })()}
                      <div className="layer-action-row">
                        <button
                          className="danger"
                          type="button"
                          disabled={selectedGenerationGuide.locked}
                          onClick={deleteSelectedGenerationGuide}
                        >
                          Delete guide
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
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
        </InspectorPanel>
      </div>
      </>
      )}
    </div>
  );
}
