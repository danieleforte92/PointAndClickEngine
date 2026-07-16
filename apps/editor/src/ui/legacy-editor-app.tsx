import type {
  AnimationPackDocument,
  AssetDocument,
  CursorValue,
  FlowDocument,
  FlowNode,
  Hotspot,
  ItemDocument,
  Layered2DScene,
  LocaleDocument,
  AssetGenerationRecipeDocument,
  GameplayGraphLayout,
  PromptPackDocument,
  PromptPackGenerationTarget,
  Rect,
  RuntimeDebugSnapshot,
  RuntimeInputAction,
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
  buildFlowGraph,
  validateFlowGraph,
  type AuthoringSuggestion
} from "@pointclick/authoring";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
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
  Settings2,
  Trash2,
  UserRound,
  X,
  WandSparkles
} from "lucide-react";
import {
  alphaContentBounds,
  bezierCropPathBounds,
  buildBezierCropSegmentSvgPath,
  buildBezierCropSvgPath,
  createCompositeGuideMask,
  createDefaultBezierCropPath,
  createGuideMask,
  insertBezierCropNodeAfter,
  imageOptimizePreset,
  imageOptimizePresets,
  moveBezierCropHandle,
  moveBezierCropNode,
  removeBezierCropNode,
  setBezierCropNodeMode,
  type BezierCropNode,
  type BezierCropNodeMode,
  type ImageOptimizePresetId,
  type ImagePixelData
} from "../asset-processing";
import {
  applyChromaKeyToImageData,
  parseHexColor,
  rgbToHex,
  type ChromaKeySummary
} from "../chroma-key";
import {
  workspaceCapabilities
} from "../editor-capabilities";
import { stageToolbarModelFor } from "../editor-workspace-model";
import { createCreatorPathSteps, type CreatorPathStep } from "../creator-path";
import {
  AiContextSummary,
  AiProviderBoundary,
  BuildWorkspace,
  CollapsedPanelRail,
  iconSize,
  InspectorPanel,
  PanelResizeHandle,
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
  sceneSelectionTargetFor,
  sceneItems,
  type DraftNodeType,
  type ActorDraft,
  type EditorHistoryState,
  type EditorRecoverySnapshot,
  type EditorSessionState,
  type FlowDraft,
  type FlowDraftNode,
  type NarrativeFlowReference,
  type SceneDraft,
  type SceneLayerDraft,
  type SceneSelectionTool,
  type SceneSelectionTarget,
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
import { createProjectSummary } from "../project-summary";
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
  buildGuardrail,
  buildSceneLayersFromDraft,
  createDefaultActor,
  createDefaultFlowDocument,
  createDefaultHotspot,
  createDefaultPickup,
  createDefaultSceneDocument,
  nextActorId,
  nextAnimationPackId,
  nextFlowId,
  nextHotspotId,
  nextItemId,
  nextPickupId,
  nextSceneId,
  scenePointIsInside,
  summarizeActorViewportIssues,
  summarizeHotspotViewportIssues,
  summarizePickupViewportIssues
} from "../editor-authoring-model";
import {
  composeTargetNegativePrompt,
  composeTargetPositivePrompt,
  resolvePromptForGenerationTarget
} from "../prompt-pack-targets";
import {
  estimateImageWorkflowFamily,
  type ImageGenerationCandidate,
  type ImageGenerationProviderId,
  type ImageGenerationQueueJob,
  type StartImageGenerationRequest
} from "../image-generation";
import {
  aiStudioSteps,
  assetTypeForGenerationTarget,
  dimensionsForGenerationTarget,
  expectedAlphaForBackgroundMode,
  imageGenerationContextForTarget,
  suggestedGenerationGuideIds,
  type AiStudioStep,
  type CandidateHandoffContext,
  type GeneratedAssetHandoff,
  type ImageGenerationEntityKind,
  type ImageGenerationSceneContext
} from "./features/ai/ai-studio-model";
import { workflowPresets } from "../workflow-presets";
import { createBrowserEditorGateway, type EditorGateway } from "../editor-gateway";
import { createEditorFeatureController } from "../editor-feature-controller";
import { createEditorProjectController } from "../editor-project-controller";
import { formatEditorError } from "../editor-status-policy";
import {
  emptyProjectSettingsDraft
} from "../editor-project-session";
import {
  createEditorNavigationState,
  editorNavigationReducer,
  editorPreferencesStorageKey,
  parseEditorPanelPreferences,
  type EditorPanelId
} from "../editor-state";
import type { EditorPreviewSessionDescriptor, EditorProjectSnapshot } from "../preload";
import type {
  BuildReadinessIssue,
  BuildReadinessTarget,
  EditorValidationReport,
  EditorValidationRunState
} from "../validation-report";
import { createBuildReadinessIssues, createValidationReport } from "../validation-report";
import { NarrativeGraph } from "./narrative-graph";
import { FlowsWorkspace } from "./features/flows/flows-workspace";
import type { GameplayTransitionDraft } from "./features/flows/gameplay-graph";
import { FlowNodeFields } from "./flow-node-fields";
import { TestLab } from "./test-lab";
import { aiStudioReducer, initialAiStudioState } from "./features/ai/ai-studio-state";
import { AiStudioSteps } from "./features/ai/ai-studio-steps";
import { AiStudioWorkspace } from "./features/ai/ai-studio-workspace";
import { assetStudioReducer, initialAssetStudioState, type AssetStudioTool } from "./features/assets/asset-studio-state";
import { AssetStudioLaunchpad } from "./features/assets/asset-studio-launchpad";
import { ResourceDock } from "./features/assets/resource-dock";
import { initialSceneStudioState, sceneStudioReducer } from "./features/scenes/scene-studio-state";
import { SceneTreeLaunchpad, ScenesLaunchpad } from "./features/scenes/scenes-launchpad";
import {
  buildProjectResourceIndex,
  filterProjectResources,
  type ProjectResourceDescriptor,
  type ProjectResourceHealth,
  type ProjectResourceKind
} from "../project-resources";
import {
  assetHealth,
  assetFromSnapshot,
  assetUsage,
  fallbackFlowLineText,
  flowFromSnapshot,
  formatValidationTimestamp,
  healthSummary,
  hotspotFromSnapshot,
  inspectorDetailFor,
  isHexColor,
  itemFromSnapshot,
  localeFromSnapshot,
  parseWalkAreaDraft,
  pickupFromSnapshot,
  promptPackTargetLookup,
  sceneBackgroundStyle,
  sceneFromSnapshot,
  sceneSelectionKindLabel,
  sceneSelectionSummary,
  validationTone
} from "../editor-ui-model";

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

type EntityAssetTargetKind = "scene-background" | "layer" | "player" | "actor" | "pickup";
type TargetBackgroundMode = NonNullable<PromptPackGenerationTarget["backgroundMode"]>;
type FreePromptTargetKind = "scene-background" | "layer" | "player" | "hotspot" | "pickup" | "actor";

const targetBackgroundModeOptions: Array<{ label: string; value: TargetBackgroundMode }> = [
  { label: "Opaque scene", value: "opaque-scene" },
  { label: "Transparent alpha", value: "transparent-alpha" },
  { label: "Chroma blue", value: "chroma-blue" },
  { label: "Chroma green", value: "chroma-green" },
  { label: "Reference only", value: "reference-only" }
];

const freePromptOutputPresets: Array<{
  detail: string;
  label: string;
  value: TargetBackgroundMode;
}> = [
  {
    detail: "Full scene or layer artwork with no alpha requirement.",
    label: "Opaque scene/layer",
    value: "opaque-scene"
  },
  {
    detail: "Transparent PNG contract for providers or workflows that can emit alpha.",
    label: "Transparent alpha",
    value: "transparent-alpha"
  },
  {
    detail: "Flat #00A2FF background for Asset Studio chroma cleanup.",
    label: "Chroma blue",
    value: "chroma-blue"
  },
  {
    detail: "Flat #00FF00 background for green-screen cleanup.",
    label: "Chroma green",
    value: "chroma-green"
  }
];

interface PromptProviderConfigValues {
  lmStudioApiKey: string;
  lmStudioBaseUrl: string;
  lmStudioModel: string;
  openAiApiKey: string;
  openAiBaseUrl: string;
  openAiModel: string;
  remoteProviderConsent: boolean;
}

interface ImageProviderConfigValues {
  comfyUiBaseUrl: string;
  comfyUiCheckpoint: string;
  comfyUiSeed: string;
  comfyUiTimeoutMinutes: string;
  comfyUiWorkflowPath: string;
  googleImageAccessToken: string;
  googleImageApiKey: string;
  googleImageBaseUrl: string;
  googleImageLocation: string;
  googleImageModel: string;
  googleImageProjectId: string;
  googleImageProvider: "gemini-api" | "vertex-ai";
  openAiImageApiKey: string;
  openAiImageBaseUrl: string;
  openAiImageMode: "images-api" | "responses-api";
  openAiImageModel: string;
  remoteProviderConsent: boolean;
}

const imageProviderOptions: Array<{ detail: string; label: string; value: ImageGenerationProviderId }> = [
  {
    detail: "Local ComfyUI queue with workflow templates, reference uploads, masks, and 8GB presets.",
    label: "ComfyUI local",
    value: "comfyui-local"
  },
  {
    detail: "Optional OpenAI Image API or Responses image tool. Keys stay outside project JSON.",
    label: "OpenAI image",
    value: "openai-image"
  },
  {
    detail: "Optional Gemini API or Vertex AI Imagen path. Keys and cloud project settings stay outside project JSON.",
    label: "Google image",
    value: "google-image"
  }
];

interface TargetPromptDraft {
  backgroundMode?: TargetBackgroundMode;
  customNegativePrompt?: string;
  customPositivePrompt?: string;
  safetyNegativePrompt?: string;
}

interface FreePromptTarget {
  entityId?: string;
  kind: FreePromptTargetKind;
  sceneId: string;
}

type AssetTool = AssetStudioTool;

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

interface ProviderBoundaryStatus {
  detail: string;
  label: string;
  tone: "good" | "warn" | "error" | "muted";
}

function providerBoundaryStatus(
  providerId: string,
  baseUrl: string,
  defaultBaseUrl: string,
  remoteProviderConsent = false
): ProviderBoundaryStatus {
  if (providerId === "mock") {
    return {
      detail: "Offline deterministic output. No network request is made.",
      label: "Offline",
      tone: "good"
    };
  }

  const configuredUrl = baseUrl.trim() || defaultBaseUrl;
  try {
    const endpoint = new URL(configuredUrl);
    const hostname = endpoint.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const isLoopback = hostname === "localhost" || hostname === "::1" || /^127(?:\.\d{1,3}){3}$/.test(hostname);
    if (isLoopback) {
      return {
        detail: `Local endpoint ${endpoint.origin}.`,
        label: "Local",
        tone: "good"
      };
    }
    return {
      detail: remoteProviderConsent
        ? `Remote endpoint ${endpoint.origin}. Consent is enabled for this session.`
        : `Remote endpoint ${endpoint.origin}. Explicit consent is required before sending project context.`,
      label: remoteProviderConsent ? "Remote · allowed" : "Remote · consent",
      tone: remoteProviderConsent ? "good" : "warn"
    };
  } catch {
    return {
      detail: "The endpoint must be an absolute HTTP(S) URL.",
      label: "Check URL",
      tone: "error"
    };
  }
}

interface ProviderConfigDialogShellProps {
  children: React.ReactNode;
  description: string;
  onApply: () => void;
  onCancel: () => void;
  title: string;
}

function ProviderConfigDialogShell({
  children,
  description,
  onApply,
  onCancel,
  title
}: ProviderConfigDialogShellProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const titleId = `provider-config-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusableSelector =
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
    focusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;

      const elements = focusable();
      if (elements.length === 0) return;
      const first = elements[0]!;
      const last = elements[elements.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", handleKeyDown);
    return () => dialog.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="provider-config-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-modal="true"
        className="provider-config-modal"
        role="dialog"
        tabIndex={-1}
      >
        <header className="provider-config-header">
          <div>
            <span className="overview-label">Provider configuration</span>
            <h2 id={titleId}>{title}</h2>
            <p>{description}</p>
          </div>
          <button className="icon-action" type="button" aria-label={`Close ${title}`} onClick={onCancel}>
            <X size={iconSize} />
          </button>
        </header>
        <div className="provider-config-body">{children}</div>
        <footer className="provider-config-footer">
          <p>Changes are kept in this editor session and never written to project JSON.</p>
          <div className="build-actions">
            <button className="secondary-action compact-action" type="button" onClick={onCancel}>
              Cancel
            </button>
            <button className="play-action compact-action" type="button" onClick={onApply}>
              Apply
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

interface PromptProviderConfigDialogProps {
  provider: PromptProviderId;
  values: PromptProviderConfigValues;
  onApply: (values: PromptProviderConfigValues) => void;
  onCancel: () => void;
}

function PromptProviderConfigDialog({ provider, values, onApply, onCancel }: PromptProviderConfigDialogProps) {
  const [draft, setDraft] = useState(values);
  const descriptor = promptProviderDescriptors.find((item) => item.id === provider) ?? promptProviderDescriptors[0]!;

  return (
    <ProviderConfigDialogShell
      description={descriptor.detail}
      onApply={() => onApply(draft)}
      onCancel={onCancel}
      title={descriptor.label}
    >
      {provider === "mock" ? (
        <div className="provider-config-note">
          <strong>Ready offline</strong>
          <p>Mock deterministic generates a reproducible prompt pack without credentials or network access.</p>
        </div>
      ) : provider === "lmstudio" ? (
        <>
          <label className="prompt-studio-field">
            LM Studio base URL
            <input
              value={draft.lmStudioBaseUrl}
              onChange={(event) => setDraft((current) => ({ ...current, lmStudioBaseUrl: event.target.value }))}
            />
          </label>
          <label className="prompt-studio-field">
            Model
            <input
              placeholder="Use the model id shown by LM Studio"
              value={draft.lmStudioModel}
              onChange={(event) => setDraft((current) => ({ ...current, lmStudioModel: event.target.value }))}
            />
          </label>
          <label className="prompt-studio-field">
            API key
            <input
              placeholder="Optional; LM Studio usually accepts any value"
              type="password"
              value={draft.lmStudioApiKey}
              onChange={(event) => setDraft((current) => ({ ...current, lmStudioApiKey: event.target.value }))}
            />
          </label>
        </>
      ) : (
        <>
          <label className="prompt-studio-field">
            OpenAI API key
            <input
              placeholder="Uses OPENAI_API_KEY if empty"
              type="password"
              value={draft.openAiApiKey}
              onChange={(event) => setDraft((current) => ({ ...current, openAiApiKey: event.target.value }))}
            />
          </label>
          <label className="prompt-studio-field">
            Model
            <input
              value={draft.openAiModel}
              onChange={(event) => setDraft((current) => ({ ...current, openAiModel: event.target.value }))}
            />
          </label>
          <label className="prompt-studio-field">
            Base URL
            <input
              value={draft.openAiBaseUrl}
              onChange={(event) => setDraft((current) => ({ ...current, openAiBaseUrl: event.target.value }))}
            />
          </label>
        </>
      )}
      {provider !== "mock" ? (
        <label className="prompt-studio-field provider-consent-field">
          Remote provider consent
          <span>
            <input
              checked={draft.remoteProviderConsent}
              type="checkbox"
              onChange={(event) => setDraft((current) => ({ ...current, remoteProviderConsent: event.target.checked }))}
            />{" "}
            I allow AI Studio to send project prompts to a remote endpoint.
          </span>
        </label>
      ) : null}
    </ProviderConfigDialogShell>
  );
}

interface ImageProviderConfigDialogProps {
  provider: ImageGenerationProviderId;
  values: ImageProviderConfigValues;
  onApply: (values: ImageProviderConfigValues) => void;
  onCancel: () => void;
}

function ImageProviderConfigDialog({ provider, values, onApply, onCancel }: ImageProviderConfigDialogProps) {
  const [draft, setDraft] = useState(values);
  const descriptor = imageProviderOptions.find((item) => item.value === provider) ?? imageProviderOptions[0]!;

  return (
    <ProviderConfigDialogShell
      description={descriptor.detail}
      onApply={() => onApply(draft)}
      onCancel={onCancel}
      title={descriptor.label}
    >
      {provider === "comfyui-local" ? (
        <>
          <label className="prompt-studio-field">
            ComfyUI base URL
            <input
              value={draft.comfyUiBaseUrl}
              onChange={(event) => setDraft((current) => ({ ...current, comfyUiBaseUrl: event.target.value }))}
            />
          </label>
          <label className="prompt-studio-field">
            Checkpoint filename / override
            <input
              placeholder="Optional when a workflow provides the checkpoint"
              value={draft.comfyUiCheckpoint}
              onChange={(event) => setDraft((current) => ({ ...current, comfyUiCheckpoint: event.target.value }))}
            />
          </label>
          <label className="prompt-studio-field">
            Workflow API JSON path
            <input
              placeholder="Optional project-relative path"
              value={draft.comfyUiWorkflowPath}
              onChange={(event) => setDraft((current) => ({ ...current, comfyUiWorkflowPath: event.target.value }))}
            />
          </label>
          <label className="prompt-studio-field">
            Seed
            <input
              placeholder="Empty for random"
              value={draft.comfyUiSeed}
              onChange={(event) => setDraft((current) => ({ ...current, comfyUiSeed: event.target.value }))}
            />
          </label>
          <label className="prompt-studio-field">
            Timeout (minutes)
            <input
              min={1}
              step={1}
              type="number"
              value={draft.comfyUiTimeoutMinutes}
              onChange={(event) => setDraft((current) => ({ ...current, comfyUiTimeoutMinutes: event.target.value }))}
            />
          </label>
        </>
      ) : provider === "openai-image" ? (
        <>
          <label className="prompt-studio-field">
            OpenAI image API key
            <input
              placeholder="Uses OPENAI_API_KEY if empty"
              type="password"
              value={draft.openAiImageApiKey}
              onChange={(event) => setDraft((current) => ({ ...current, openAiImageApiKey: event.target.value }))}
            />
          </label>
          <label className="prompt-studio-field">
            OpenAI image model
            <input
              value={draft.openAiImageModel}
              onChange={(event) => setDraft((current) => ({ ...current, openAiImageModel: event.target.value }))}
            />
          </label>
          <label className="prompt-studio-field">
            OpenAI path
            <select
              value={draft.openAiImageMode}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  openAiImageMode: event.target.value as ImageProviderConfigValues["openAiImageMode"]
                }))
              }
            >
              <option value="images-api">Images API</option>
              <option value="responses-api">Responses image tool</option>
            </select>
          </label>
          <label className="prompt-studio-field">
            OpenAI base URL
            <input
              value={draft.openAiImageBaseUrl}
              onChange={(event) => setDraft((current) => ({ ...current, openAiImageBaseUrl: event.target.value }))}
            />
          </label>
        </>
      ) : (
        <>
          <label className="prompt-studio-field">
            Google path
            <select
              value={draft.googleImageProvider}
              onChange={(event) => {
                const nextProvider = event.target.value as ImageProviderConfigValues["googleImageProvider"];
                setDraft((current) => ({
                  ...current,
                  googleImageModel: nextProvider === "vertex-ai" ? "imagen-4.0-generate-preview" : "gemini-2.5-flash-image",
                  googleImageProvider: nextProvider
                }));
              }}
            >
              <option value="gemini-api">Gemini API</option>
              <option value="vertex-ai">Vertex AI Imagen</option>
            </select>
          </label>
          {draft.googleImageProvider === "gemini-api" ? (
            <label className="prompt-studio-field">
              Gemini API key
              <input
                placeholder="Uses GEMINI_API_KEY if empty"
                type="password"
                value={draft.googleImageApiKey}
                onChange={(event) => setDraft((current) => ({ ...current, googleImageApiKey: event.target.value }))}
              />
            </label>
          ) : (
            <>
              <label className="prompt-studio-field">
                Vertex access token
                <input
                  placeholder="Uses GOOGLE_VERTEX_ACCESS_TOKEN if empty"
                  type="password"
                  value={draft.googleImageAccessToken}
                  onChange={(event) => setDraft((current) => ({ ...current, googleImageAccessToken: event.target.value }))}
                />
              </label>
              <label className="prompt-studio-field">
                Google Cloud project
                <input
                  value={draft.googleImageProjectId}
                  onChange={(event) => setDraft((current) => ({ ...current, googleImageProjectId: event.target.value }))}
                />
              </label>
            </>
          )}
          <label className="prompt-studio-field">
            Google image model
            <input
              value={draft.googleImageModel}
              onChange={(event) => setDraft((current) => ({ ...current, googleImageModel: event.target.value }))}
            />
          </label>
          <label className="prompt-studio-field">
            Location
            <input
              value={draft.googleImageLocation}
              onChange={(event) => setDraft((current) => ({ ...current, googleImageLocation: event.target.value }))}
            />
          </label>
          <label className="prompt-studio-field">
            Base URL override
            <input
              placeholder="Optional provider API root"
              value={draft.googleImageBaseUrl}
              onChange={(event) => setDraft((current) => ({ ...current, googleImageBaseUrl: event.target.value }))}
            />
          </label>
        </>
      )}
      {provider !== "comfyui-local" ? (
        <label className="prompt-studio-field provider-consent-field">
          Remote provider consent
          <span>
            <input
              checked={draft.remoteProviderConsent}
              type="checkbox"
              onChange={(event) => setDraft((current) => ({ ...current, remoteProviderConsent: event.target.checked }))}
            />{" "}
            I allow AI Studio to send prompts and selected input assets to a remote endpoint.
          </span>
        </label>
      ) : null}
    </ProviderConfigDialogShell>
  );
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

type SceneTool = SceneSelectionTool;
type SceneInspectorTarget = "scene" | "player";

interface SceneViewPreferences {
  fit: boolean;
  gridVisible: boolean;
  minimapVisible: boolean;
  overlaysVisible: boolean;
  zoom: number;
}

const sceneViewPreferencesStorageKey = "pointclick.editor.scene-view.v1";
const resourceDockPreferencesStorageKey = "pointclick.editor.resource-dock.v1";
const defaultSceneViewPreferences: SceneViewPreferences = {
  fit: true,
  gridVisible: false,
  minimapVisible: false,
  overlaysVisible: true,
  zoom: 1
};

function loadSceneViewPreferences(): SceneViewPreferences {
  if (typeof window === "undefined") return defaultSceneViewPreferences;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(sceneViewPreferencesStorageKey) ?? "{}") as Partial<SceneViewPreferences>;
    return {
      fit: parsed.fit ?? true,
      gridVisible: parsed.gridVisible ?? false,
      minimapVisible: parsed.minimapVisible ?? false,
      overlaysVisible: parsed.overlaysVisible ?? true,
      zoom: typeof parsed.zoom === "number" ? Math.min(4, Math.max(0.25, parsed.zoom)) : 1
    };
  } catch {
    return defaultSceneViewPreferences;
  }
}

function loadResourceDockPreferences(): { height: number; isOpen: boolean; query: string; viewMode: "grid" | "list" } {
  if (typeof window === "undefined") return { height: 220, isOpen: true, query: "", viewMode: "grid" };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(resourceDockPreferencesStorageKey) ?? "{}") as Partial<ReturnType<typeof loadResourceDockPreferences>>;
    return {
      height: typeof parsed.height === "number" ? Math.min(360, Math.max(150, parsed.height)) : 220,
      isOpen: parsed.isOpen ?? true,
      query: parsed.query ?? "",
      viewMode: parsed.viewMode === "list" ? "list" : "grid"
    };
  } catch {
    return { height: 220, isOpen: true, query: "", viewMode: "grid" };
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
      return "Click an object to inspect it, or drag it to auto-select the right transform tool.";
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

function focusEditorField(element: HTMLInputElement | HTMLSelectElement | null) {
  if (!element) return;
  element.focus();
  element.scrollIntoView({ behavior: "smooth", block: "center" });
}

function freePromptTargetId(target: FreePromptTarget): string {
  if (target.kind === "scene-background") return `${target.sceneId}-background`;
  if (target.kind === "player") return "player";
  return `${target.entityId ?? target.kind}-${target.kind}`;
}

function freePromptLabel(target: FreePromptTarget, scene: Layered2DScene): string {
  if (target.kind === "scene-background") return `${scene.name} background`;
  if (target.kind === "player") return "Player";
  const entityId = target.entityId ?? target.kind;
  if (target.kind === "layer") {
    const layer = (scene.layers ?? []).find((entry) => entry.id === entityId);
    return layer?.name || entityId;
  }
  return entityId;
}

function freePromptTargetBounds(target: FreePromptTarget, scene: Layered2DScene): Rect {
  if (target.kind === "scene-background") {
    return { x: 0, y: 0, width: scene.size.width, height: scene.size.height };
  }
  if (target.kind === "player") {
    return { x: scene.playerStart.x - 48, y: scene.playerStart.y - 128, width: 96, height: 128 };
  }
  const entityId = target.entityId ?? "";
  if (target.kind === "layer") {
    const layer = (scene.layers ?? []).find((entry) => entry.id === entityId);
    return layer?.bounds ?? { x: 0, y: 0, width: scene.size.width, height: scene.size.height };
  }
  if (target.kind === "actor") {
    return scene.actors.find((entry) => entry.id === entityId)?.bounds ?? { x: 0, y: 0, width: 256, height: 256 };
  }
  if (target.kind === "pickup") {
    return scene.pickups.find((entry) => entry.id === entityId)?.bounds ?? { x: 0, y: 0, width: 256, height: 256 };
  }
  if (target.kind === "hotspot") {
    return scene.hotspots.find((entry) => entry.id === entityId)?.bounds ?? { x: 0, y: 0, width: 256, height: 256 };
  }
  return { x: 0, y: 0, width: 256, height: 256 };
}

function freePromptIntendedUse(target: FreePromptTarget, scene: Layered2DScene): PromptPackGenerationTarget["intendedUse"] {
  if (target.kind === "scene-background" || target.kind === "layer") return "scene-background";
  if (target.kind === "player") return "character-reference";
  if (target.kind === "actor") {
    const actor = scene.actors.find((entry) => entry.id === target.entityId);
    return actor?.role === "npc" ? "character-reference" : "prop";
  }
  return "prop";
}

function freePromptSourceKind(target: FreePromptTarget): NonNullable<PromptPackGenerationTarget["sourceEntityKind"]> {
  if (target.kind === "scene-background") return "scene";
  return target.kind;
}

function buildFreeGenerationTarget(
  target: FreePromptTarget,
  scene: Layered2DScene,
  backgroundMode: TargetBackgroundMode
): PromptPackGenerationTarget {
  const bounds = freePromptTargetBounds(target, scene);
  const intendedUse = freePromptIntendedUse(target, scene);
  const expectedAlpha = backgroundMode === "transparent-alpha";
  return {
    id: freePromptTargetId(target),
    backgroundMode,
    ...(backgroundMode === "chroma-blue" ? { chromaColor: "#00A2FF" as const } : {}),
    ...(backgroundMode === "chroma-green" ? { chromaColor: "#00FF00" as const } : {}),
    expectedAlpha,
    intendedUse,
    marginPercent: intendedUse === "scene-background" ? 0 : 8,
    safetyNegativePrompt:
      intendedUse === "scene-background"
        ? "characters, people, portraits, UI text, watermark, logo"
        : "scene background, floor plane, cast shadow, contact shadow, multiple subjects, cropped subject",
    ...(target.kind === "scene-background" || target.entityId ? { sourceEntityId: target.kind === "scene-background" ? scene.id : target.entityId } : {}),
    sourceEntityKind: freePromptSourceKind(target),
    width: Math.max(64, Math.round(bounds.width)),
    height: Math.max(64, Math.round(bounds.height)),
    transparent: expectedAlpha
  };
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

function buildFreePromptPack(options: {
  artStyle: string;
  backgroundMode: TargetBackgroundMode;
  negativePrompt: string;
  prompt: string;
  scene: Layered2DScene;
  target: FreePromptTarget;
}): PromptPackDocument {
  const generationTarget = buildFreeGenerationTarget(options.target, options.scene, options.backgroundMode);
  const label = freePromptLabel(options.target, options.scene);
  const artStyle = options.artStyle.trim();
  const prompt = [
    options.prompt.trim() || `Create game-ready point-and-click artwork for ${label}.`,
    artStyle ? `Shared art style: ${artStyle}` : ""
  ]
    .filter(Boolean)
    .join(" ");
  const negativePrompt = [
    options.negativePrompt.trim(),
    "watermark, logo, unreadable text, low contrast, blurry details"
  ]
    .filter(Boolean)
    .join(", ");
  const promptEntry = { id: generationTarget.id, prompt };
  const sceneBackgroundPrompt =
    generationTarget.intendedUse === "scene-background"
      ? prompt
      : `Scene context for ${options.scene.name}. Keep style consistent with: ${artStyle || "the project art direction"}.`;

  return {
    schemaVersion: 1,
    id: `free-${generationTarget.id}-prompt-pack`,
    name: `${label} Free Prompt`,
    sceneId: options.scene.id,
    artBrief: artStyle || "Free per-target prompt",
    context: {
      projectTitle: "Current project",
      sceneId: options.scene.id,
      sceneName: options.scene.name,
      sceneSize: options.scene.size,
      artBrief: artStyle || "Free per-target prompt",
      locale: "editor",
      labels: {},
      hotspots: options.scene.hotspots.map((hotspot) => ({ id: hotspot.id, labelKey: hotspot.labelKey })),
      actors: options.scene.actors.map((actor) => ({ id: actor.id, role: actor.role, labelKey: actor.labelKey })),
      pickups: options.scene.pickups.map((pickup) => ({ id: pickup.id, itemId: pickup.itemId, labelKey: pickup.labelKey })),
      items: []
    },
    outputs: {
      sceneBackgroundPrompt,
      propPrompts: generationTarget.intendedUse === "prop" ? [promptEntry] : [],
      characterReferencePrompts: generationTarget.intendedUse === "character-reference" ? [promptEntry] : [],
      animationNotes: [],
      negativePrompt,
      styleNotes: artStyle ? [artStyle] : [],
      generationTargets: [generationTarget]
    },
    suggestedActors: [],
    provenance: {
      provider: "mock",
      model: "free-prompt",
      generatedAt: new Date().toISOString(),
      inputHash: generationTarget.id,
      jobId: `free-${generationTarget.id}`,
      seed: "free"
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

interface ImageOptimizationPreview {
  dataUrl: string;
  height: number;
  hasAlpha: boolean;
  outputBytes: number;
  sourceBytes: number;
  sourceHasAlpha: boolean;
  width: number;
}

function dataUrlByteLength(dataUrl: string): number {
  const separator = dataUrl.indexOf(",");
  if (separator < 0) return new TextEncoder().encode(dataUrl).byteLength;
  const header = dataUrl.slice(0, separator);
  const payload = dataUrl.slice(separator + 1);
  if (!header.includes(";base64")) return new TextEncoder().encode(decodeURIComponent(payload)).byteLength;
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

function formatAssetBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function imageDataHasAlpha(imageData: ImageData): boolean {
  for (let index = 3; index < imageData.data.length; index += 4) {
    if (imageData.data[index]! < 255) return true;
  }
  return false;
}

async function createImageOptimizationPreview(options: {
  assetUrl: string;
  height: string;
  presetId: ImageOptimizePresetId;
  width: string;
}): Promise<ImageOptimizationPreview> {
  const preset = imageOptimizePreset(options.presetId);
  const image = await loadImageElement(options.assetUrl);
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = image.naturalWidth;
  sourceCanvas.height = image.naturalHeight;
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) throw new Error("Canvas is unavailable for optimization preview.");
  sourceContext.drawImage(image, 0, 0);
  const sourceImage = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const trimmed = preset.trimAlpha ? alphaContentBounds(sourceImage) : null;
  const sourceBounds = trimmed ?? { x: 0, y: 0, width: sourceCanvas.width, height: sourceCanvas.height };
  const output = document.createElement("canvas");
  output.width = Math.round(parsePositiveNumber(options.width) ?? sourceBounds.width);
  output.height = Math.round(parsePositiveNumber(options.height) ?? sourceBounds.height);
  const outputContext = output.getContext("2d", { willReadFrequently: true });
  if (!outputContext) throw new Error("Canvas is unavailable for optimization preview.");
  outputContext.imageSmoothingEnabled = preset.resize !== "nearest-neighbor";
  outputContext.drawImage(
    sourceCanvas,
    sourceBounds.x,
    sourceBounds.y,
    sourceBounds.width,
    sourceBounds.height,
    0,
    0,
    output.width,
    output.height
  );
  const mime = preset.format === "jpeg" ? "image/jpeg" : `image/${preset.format}`;
  const dataUrl = output.toDataURL(mime, preset.quality ? preset.quality / 100 : undefined);
  const outputImage = outputContext.getImageData(0, 0, output.width, output.height);
  return {
    dataUrl,
    height: output.height,
    hasAlpha: imageDataHasAlpha(outputImage),
    outputBytes: dataUrlByteLength(dataUrl),
    sourceBytes: dataUrlByteLength(options.assetUrl),
    sourceHasAlpha: imageDataHasAlpha(sourceImage),
    width: output.width
  };
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

export interface EditorAppProps {
  gateway?: EditorGateway;
}

export function LegacyEditorApp({ gateway: injectedGateway }: EditorAppProps = {}) {
  const gateway = useMemo<EditorGateway>(() => injectedGateway ?? createBrowserEditorGateway(), [injectedGateway]);
  const featureController = useMemo(() => createEditorFeatureController(gateway), [gateway]);
  const projectController = useMemo(() => createEditorProjectController(gateway), [gateway]);
  const [navigationState, dispatchNavigation] = useReducer(
    editorNavigationReducer,
    undefined,
    () =>
      createEditorNavigationState(
        parseEditorPanelPreferences(window.localStorage.getItem(editorPreferencesStorageKey))
      )
  );
  const workspace = navigationState.target.workspace;
  const setWorkspace = useCallback((nextWorkspace: Workspace) => {
    dispatchNavigation({ type: "workspace/change", workspace: nextWorkspace });
  }, []);
  const [status, setStatus] = useState("Loading project...");
  const reportEditorError = useCallback((error: unknown, fallback: string) => {
    setStatus(formatEditorError(error, fallback));
  }, []);
  const [project, setProjectState] = useState<EditorProjectSnapshot | null>(null);
  const [projectSettingsDraft, setProjectSettingsDraft] = useState(emptyProjectSettingsDraft);
  const [history, setHistory] = useState<EditorHistoryState>(emptyHistory);
  const [pendingRecovery, setPendingRecovery] = useState<EditorRecoverySnapshot | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [resourceDockPreferences, setResourceDockPreferences] = useState(loadResourceDockPreferences);
  const [resourceDockWorkspaceOpen, setResourceDockWorkspaceOpen] = useState<Workspace | null>(null);
  const [assetStudioState, dispatchAssetStudio] = useReducer(assetStudioReducer, initialAssetStudioState);
  const { activeTool: activeAssetTool, resourceHealth, resourceKind, resourceQuery, resourceViewMode } = assetStudioState;
  const setActiveAssetTool = useCallback((tool: AssetTool) => dispatchAssetStudio({ type: "tool/select", tool }), []);
  const setResourceHealth = useCallback(
    (health: "all" | ProjectResourceHealth) => dispatchAssetStudio({ type: "filter/health", health }),
    []
  );
  const setResourceKind = useCallback(
    (kind: "all" | ProjectResourceKind) => dispatchAssetStudio({ type: "filter/kind", kind }),
    []
  );
  const setResourceQuery = useCallback((query: string) => dispatchAssetStudio({ type: "filter/query", query }), []);
  const setResourceViewMode = useCallback(
    (mode: "grid" | "list") => dispatchAssetStudio({ type: "view-mode/select", mode }),
    []
  );
  const [assetEditTarget, setAssetEditTarget] = useState<BackgroundCleanupTarget | null>(null);
  const cropImageFrameRef = useRef<HTMLDivElement | null>(null);
  const [cropImageSize, setCropImageSize] = useState({ width: 256, height: 256 });
  const [cropInteraction, setCropInteraction] = useState<AssetCropInteraction | null>(null);
  const [cropPath, setCropPath] = useState<BezierCropNode[]>(() =>
    createDefaultBezierCropPath({ width: 256, height: 256 }, 16)
  );
  const [selectedCropNodeIndex, setSelectedCropNodeIndex] = useState(0);
  const [cropStatus, setCropStatus] = useState("Adjust the bezier cut path, then save a new transparent PNG asset.");
  const [optimizePresetId, setOptimizePresetId] = useState<ImageOptimizePresetId>("background-web");
  const [optimizeWidth, setOptimizeWidth] = useState("");
  const [optimizeHeight, setOptimizeHeight] = useState("");
  const [optimizePreview, setOptimizePreview] = useState<ImageOptimizationPreview | null>(null);
  const [optimizeStatus, setOptimizeStatus] = useState("Choose a safe preset, compare dimensions, then apply as a derived asset.");
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
  const [aiStudioState, dispatchAiStudio] = useReducer(aiStudioReducer, initialAiStudioState);
  const { advancedOpen: aiAdvancedOpen, selectedGenerationTargetId, selectedPromptPackId, step: aiStep } = aiStudioState;
  const setAiStep = useCallback((step: AiStudioStep) => dispatchAiStudio({ type: "step/select", step }), []);
  const setAiAdvancedOpen = useCallback(
    (open: boolean) => dispatchAiStudio({ type: "advanced/toggle", open }),
    []
  );
  const [sceneDirectionPresetId, setSceneDirectionPresetId] = useState(defaultSceneDirectionPreset.id);
  const [promptPackBrief, setPromptPackBrief] = useState(defaultSceneDirectionPreset.artBrief);
  const [promptPackJob, setPromptPackJob] = useState<PromptProviderJob | null>(null);
  const [promptPackGenerationState, setPromptPackGenerationState] = useState<"idle" | "running">("idle");
  const [authoringSuggestions, setAuthoringSuggestions] = useState<AuthoringSuggestion[]>([]);
  const [authoringSuggestionState, setAuthoringSuggestionState] = useState<"idle" | "running">("idle");
  const [promptProviderId, setPromptProviderId] = useState<PromptProviderId>("mock");
  const [remoteProviderConsent, setRemoteProviderConsent] = useState(false);
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
  const [imageProviderId, setImageProviderId] = useState<ImageGenerationProviderId>("comfyui-local");
  const [openAiImageApiKey, setOpenAiImageApiKey] = useState("");
  const [openAiImageBaseUrl, setOpenAiImageBaseUrl] = useState("https://api.openai.com/v1");
  const [openAiImageModel, setOpenAiImageModel] = useState("gpt-image-2");
  const [openAiImageMode, setOpenAiImageMode] = useState<"images-api" | "responses-api">("images-api");
  const [googleImageApiKey, setGoogleImageApiKey] = useState("");
  const [googleImageAccessToken, setGoogleImageAccessToken] = useState("");
  const [googleImageBaseUrl, setGoogleImageBaseUrl] = useState("");
  const [googleImageLocation, setGoogleImageLocation] = useState("us-central1");
  const [googleImageModel, setGoogleImageModel] = useState("gemini-2.5-flash-image");
  const [googleImageProjectId, setGoogleImageProjectId] = useState("");
  const [googleImageProvider, setGoogleImageProvider] = useState<"gemini-api" | "vertex-ai">("gemini-api");
  const [promptProviderConfigOpen, setPromptProviderConfigOpen] = useState(false);
  const [imageProviderConfigOpen, setImageProviderConfigOpen] = useState(false);
  const [comfyUiOutputPresetId, setComfyUiOutputPresetId] = useState(defaultPromptPresetSelection.comfyOutputPreset);
  const [selectedWorkflowPresetId, setSelectedWorkflowPresetId] = useState(workflowPresets[0]?.id ?? "");
  const [selectedWorkflowTemplateId, setSelectedWorkflowTemplateId] = useState("");
  const [comfyUiTimeoutMinutes, setComfyUiTimeoutMinutes] = useState(
    String(comfyOutputPresetById(defaultPromptPresetSelection.comfyOutputPreset).timeoutMinutes)
  );
  const [comfyUiGenerationStatus, setComfyUiGenerationStatus] = useState(
    "ComfyUI generation has not been queued yet."
  );
  const setSelectedGenerationTargetId = useCallback(
    (targetId: string) => dispatchAiStudio({ type: "generation-target/select", targetId }),
    []
  );
  const [imageGenerationState, setImageGenerationState] = useState<"idle" | "running">("idle");
  const [activeImageGenerationContext, setActiveImageGenerationContext] =
    useState<ImageGenerationSceneContext | null>(null);
  const [imageGenerationJob, setImageGenerationJob] = useState<ImageGenerationQueueJob | null>(null);
  const [imageGenerationCandidates, setImageGenerationCandidates] = useState<ImageGenerationCandidate[]>([]);
  const [selectedImageCandidateId, setSelectedImageCandidateId] = useState<string | null>(null);
  const [imageGenerationBatchSize, setImageGenerationBatchSize] = useState<1 | 2 | 3 | 4>(1);
  const [candidateHandoffContext, setCandidateHandoffContext] = useState<CandidateHandoffContext | null>(null);
  const [lastGeneratedImageAsset, setLastGeneratedImageAsset] = useState<GeneratedAssetHandoff | null>(null);
  const [targetPromptDrafts, setTargetPromptDrafts] = useState<Record<string, TargetPromptDraft>>({});
  const [freePromptTarget, setFreePromptTarget] = useState<FreePromptTarget | null>(null);
  const [freePromptText, setFreePromptText] = useState("");
  const [freePromptNegative, setFreePromptNegative] = useState("");
  const [freePromptStylePresetId, setFreePromptStylePresetId] = useState(defaultPromptPresetSelection.visualStylePreset);
  const [freePromptCustomStyle, setFreePromptCustomStyle] = useState("");
  const [freePromptOutputPreset, setFreePromptOutputPreset] = useState<TargetBackgroundMode>("chroma-blue");
  const [contextualGenerationModalOpen, setContextualGenerationModalOpen] = useState(false);
  const [backgroundCleanupTarget, setBackgroundCleanupTarget] = useState<BackgroundCleanupTarget | null>(null);
  const [cleanupKeyColor, setCleanupKeyColor] = useState("#00A2FF");
  const [cleanupTolerance, setCleanupTolerance] = useState("28");
  const [cleanupFeather, setCleanupFeather] = useState("18");
  const [cleanupSpillReduction, setCleanupSpillReduction] = useState(true);
  const [cleanupPreviewUrl, setCleanupPreviewUrl] = useState<string | null>(null);
  const [cleanupSummary, setCleanupSummary] = useState<ChromaKeySummary | null>(null);
  const [cleanupStatus, setCleanupStatus] = useState("Pick a key color or adjust tolerance.");
  const setSelectedPromptPackId = useCallback(
    (promptPackId: string | null) => dispatchAiStudio({ type: "prompt-pack/select", promptPackId }),
    []
  );
  const [validationRunState, setValidationRunState] = useState<EditorValidationRunState>("idle");
  const [validationReport, setValidationReport] = useState<EditorValidationReport | null>(null);
  const [validationStatus, setValidationStatus] = useState("Validation uses saved project files.");
  const [webExportState, setWebExportState] = useState<"idle" | "running">("idle");
  const [webExportStatus, setWebExportStatus] = useState(
    "Validate the saved project, then choose an empty destination folder."
  );
  const [previewSession, setPreviewSession] = useState<EditorPreviewSessionDescriptor | null>(null);
  const [previewTelemetry, setPreviewTelemetry] = useState<RuntimeDebugSnapshot[]>([]);
  const [browserPreviewTelemetry, setBrowserPreviewTelemetry] = useState<RuntimeDebugSnapshot[]>([]);
  const [previewActions, setPreviewActions] = useState<RuntimeInputAction[]>([]);
  const [browserPreviewActions, setBrowserPreviewActions] = useState<RuntimeInputAction[]>([]);
  const [viewportInteraction, setViewportInteraction] = useState<ViewportInteraction | null>(null);
  const [sceneViewPreferences, setSceneViewPreferences] = useState<SceneViewPreferences>(loadSceneViewPreferences);
  const [sceneStudioState, dispatchSceneStudio] = useReducer(sceneStudioReducer, initialSceneStudioState);
  const {
    activeTool: activeSceneTool,
    inspectorTarget: sceneInspectorTarget,
    selectedGenerationGuideId,
    selectedLayerId: selectedSceneLayerId
  } = sceneStudioState;
  const setActiveSceneTool = useCallback((tool: SceneTool) => dispatchSceneStudio({ type: "tool/select", tool }), []);
  const setSceneInspectorTarget = useCallback(
    (target: SceneInspectorTarget) => dispatchSceneStudio({ type: "inspector/select", target }),
    []
  );
  const setSelectedSceneLayerId = useCallback(
    (layerId: string | null) => dispatchSceneStudio({ type: "layer/select", layerId }),
    []
  );
  const setSelectedGenerationGuideId = useCallback(
    (guideId: string | null) => dispatchSceneStudio({ type: "guide/select", guideId }),
    []
  );
  const [selectedFlowNodeId, setSelectedFlowNodeId] = useState<string | null>(null);
  const [flowWorkspaceMode, setFlowWorkspaceMode] = useState<"gameplay" | "narrative">("gameplay");
  const [gameplayGraphLayout, setGameplayGraphLayout] = useState<GameplayGraphLayout | undefined>(undefined);
  const [sceneInspectorTab, setSceneInspectorTab] = useState<"inspector" | "layers">("inspector");
  const [sceneInspectorView, setSceneInspectorView] = useState<"general" | "transform" | "interactions" | "advanced">("general");
  const setProject = useCallback((snapshot: EditorProjectSnapshot) => {
    setProjectState(snapshot);
    setSelectedAssetId((current) =>
      projectController.reconcileSnapshot(snapshot, {
        selectedAnimationPackId: null,
        selectedAssetId: current
      }).selectedAssetId
    );
    setSelectedAnimationPackId((current) =>
      projectController.reconcileSnapshot(snapshot, {
        selectedAnimationPackId: current,
        selectedAssetId: null
      }).selectedAnimationPackId
    );
  }, [projectController]);
  const promptProviderConfigReturnFocusRef = useRef<HTMLButtonElement | null>(null);
  const imageProviderConfigReturnFocusRef = useRef<HTMLButtonElement | null>(null);
  const aiWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const aiAdvancedSectionRef = useRef<HTMLDetailsElement | null>(null);
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

  useEffect(
    () =>
      featureController.onImageGenerationEvent((event) => {
        setImageGenerationJob(event.job);
        if (event.type === "candidate") {
          setImageGenerationCandidates((current) =>
            current.some((candidate) => candidate.id === event.candidate.id)
              ? current
              : [...current, event.candidate]
          );
          setSelectedImageCandidateId((current) => current ?? event.candidate.id);
          setComfyUiGenerationStatus(
            `Candidate ${event.job.completed} of ${event.job.requested} is ready for review.`
          );
          return;
        }
        if (event.type === "failed") {
          setImageGenerationState("idle");
          setActiveImageGenerationContext(null);
          setComfyUiGenerationStatus(event.message);
          setStatus(event.message);
          return;
        }
        if (event.type === "completed") {
          setImageGenerationState("idle");
          setActiveImageGenerationContext(null);
          const message = `${event.job.completed} candidate(s) ready. The project is unchanged until Apply.`;
          setComfyUiGenerationStatus(message);
          setStatus(message);
          return;
        }
        if (event.type === "cancelled") {
          setImageGenerationState("idle");
          setActiveImageGenerationContext(null);
          setComfyUiGenerationStatus("Image generation cancelled. Existing candidates remain available for review.");
          return;
        }
        setImageGenerationState("running");
      }),
    [featureController]
  );

  const session = history.present;
  const scenes = project ? sceneItems(project.scenes) : [];
  useEffect(() => {
    setProjectSettingsDraft(projectController.projectSettingsDraftFor(project));
  }, [project]);

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
  const selectedFlowReferences = useMemo(() => {
    if (!selectedFlow) return [];
    return narrativeRelationIndex.sceneGroups.flatMap((group) =>
      group.references.filter((reference) => reference.flowId === selectedFlow.id)
    );
  }, [narrativeRelationIndex.sceneGroups, selectedFlow]);
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
  const activeStyleBible = project?.styleBibles[0] ?? null;
  const selectedPromptProvider =
    promptProviderDescriptors.find((provider) => provider.id === promptProviderId) ?? promptProviderDescriptors[0]!;
  const selectedImageProvider =
    imageProviderOptions.find((provider) => provider.value === imageProviderId) ?? imageProviderOptions[0]!;
  const promptProviderBoundary = providerBoundaryStatus(
    promptProviderId,
    promptProviderId === "lmstudio" ? lmStudioBaseUrl : openAiBaseUrl,
    promptProviderId === "lmstudio" ? "http://localhost:1234/v1" : "https://api.openai.com/v1",
    remoteProviderConsent
  );
  const imageProviderBoundary = providerBoundaryStatus(
    imageProviderId,
    imageProviderId === "comfyui-local"
      ? comfyUiBaseUrl
      : imageProviderId === "openai-image"
        ? openAiImageBaseUrl
        : googleImageBaseUrl,
    imageProviderId === "comfyui-local"
      ? "http://127.0.0.1:8188"
      : imageProviderId === "openai-image"
        ? "https://api.openai.com/v1"
        : googleImageProvider === "vertex-ai"
          ? `https://${googleImageLocation || "us-central1"}-aiplatform.googleapis.com/v1`
          : "https://generativelanguage.googleapis.com/v1beta",
    remoteProviderConsent
  );
  const freePromptStylePreset =
    visualStylePresets.find((preset) => preset.id === freePromptStylePresetId) ??
    visualStylePresets.find((preset) => preset.id === defaultPromptPresetSelection.visualStylePreset) ??
    visualStylePresets[0] ??
    null;

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
  const flowGraph = useMemo(
    () =>
      selectedFlow && currentFlowDraft
        ? buildFlowGraph({
            ...selectedFlow,
            name: currentFlowDraft.name,
            nodes: buildFlowNodes(currentFlowDraft.nodes),
            startNodeId: currentFlowDraft.startNodeId
          })
        : null,
    [currentFlowDraft, selectedFlow]
  );
  const flowGraphDiagnostics = useMemo(() => {
    if (!selectedFlow || !currentFlowDraft) return [];
    const flowLookup = Object.fromEntries((project?.flows ?? []).map((flow) => [flow.id, flow]));
    return validateFlowGraph(
      {
        ...selectedFlow,
        name: currentFlowDraft.name,
        nodes: buildFlowNodes(currentFlowDraft.nodes),
        startNodeId: currentFlowDraft.startNodeId
      },
      flowLookup
    );
  }, [currentFlowDraft, project?.flows, selectedFlow]);
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
  const projectResources = useMemo(
    () => (project ? buildProjectResourceIndex(project) : []),
    [project]
  );
  const filteredProjectResources = useMemo(
    () =>
      filterProjectResources(
        projectResources,
        resourceQuery,
        resourceKind === "all" ? new Set<ProjectResourceKind>() : new Set([resourceKind])
      ).filter((resource) => resourceHealth === "all" || resource.health === resourceHealth),
    [projectResources, resourceHealth, resourceKind, resourceQuery]
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
  const freePromptPack = useMemo(() => {
    if (!freePromptTarget || !promptPackScene || freePromptTarget.sceneId !== promptPackScene.id) return null;
    return buildFreePromptPack({
      artStyle: [freePromptStylePreset?.value ?? freePromptStylePreset?.label ?? "", freePromptCustomStyle]
        .filter(Boolean)
        .join(". "),
      backgroundMode: freePromptOutputPreset,
      negativePrompt: freePromptNegative,
      prompt: freePromptText,
      scene: promptPackScene,
      target: freePromptTarget
    });
  }, [
    freePromptCustomStyle,
    freePromptNegative,
    freePromptOutputPreset,
    freePromptStylePreset?.label,
    freePromptStylePreset?.value,
    freePromptTarget,
    freePromptText,
    promptPackScene
  ]);
  const activeImagePromptPack = freePromptPack ?? promptPackCandidate?.promptPack ?? selectedPromptPack;
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
    imageProviderId !== "comfyui-local" &&
    (selectedEffectiveGenerationTarget?.referenceAssetId || selectedEffectiveGenerationTarget?.maskAssetId)
      ? "Cloud image providers currently support text-to-image only in this beta path. Use ComfyUI local for reference or mask targets."
      : selectedEffectiveGenerationTarget?.referenceAssetId || selectedEffectiveGenerationTarget?.maskAssetId
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
  const aiWorkflowReady =
    imageProviderId === "comfyui-local" ? !!selectedWorkflowTemplate || !!comfyUiWorkflowPath.trim() : true;
  const aiRecipeReady = imageProviderId === "comfyui-local" ? !!selectedGenerationRecipe : !!selectedEffectiveGenerationTarget;
  const aiNextAction = !activeImagePromptPack
    ? "Generate a prompt pack or open a free target prompt from the scene."
    : !selectedEffectiveGenerationTarget
      ? "Select a generation target."
      : selectedImageInputWorkflowWarning
        ? "Install a workflow template that supports linked image inputs."
        : !aiWorkflowReady
          ? "Install a compatible workflow template or set a legacy workflow path."
          : !aiRecipeReady
            ? "Save the generation recipe for this target."
            : "Generate, review, and apply the imported asset.";
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
  const projectSummary = useMemo(() => (project ? createProjectSummary(project) : null), [project]);
  const previewReadinessLabel =
    currentValidationReport?.summary.errorCount
      ? "Preview blocked for saved project content"
      : currentValidationReport?.summary.warningCount
        ? "Preview available, but saved project needs review"
        : dirtyState.count > 0
          ? "Preview can include unsaved drafts"
          : "Preview aligned with saved project";
  const creatorPathSteps = useMemo(
    () =>
      createCreatorPathSteps({
        dirtyDraftCount: dirtyState.count,
        flowCount: projectSummary?.flowCount ?? 0,
        generationRecipeCount: projectSummary?.generationRecipeCount ?? 0,
        hasProjectSettingsChanges,
        missingNarrativeLinkCount: narrativeRelationIndex.missingReferences.length,
        promptPackCount: projectSummary?.promptPackCount ?? 0,
        sceneCount: projectSummary?.sceneCount ?? 0,
        validationErrorCount: currentValidationReport?.summary.errorCount ?? 0,
        validationRan: validationReport !== null,
        validationWarningCount: currentValidationReport?.summary.warningCount ?? 0
      }),
    [
      currentValidationReport?.summary.errorCount,
      currentValidationReport?.summary.warningCount,
      dirtyState.count,
      hasProjectSettingsChanges,
      narrativeRelationIndex.missingReferences.length,
      projectSummary?.flowCount,
      projectSummary?.generationRecipeCount,
      projectSummary?.promptPackCount,
      projectSummary?.sceneCount,
      validationReport
    ]
  );
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
  const selectedSceneLayer =
    selectedSceneLayerId ? currentSceneDraft.layers.find((layer) => layer.id === selectedSceneLayerId) ?? null : null;
  const sceneSelectionTarget = sceneSelectionTargetFor({
    activeActorId: session.activeActorId,
    activeHotspotId: session.activeHotspotId,
    activePickupId: session.activePickupId,
    activeSceneId: selectedScene?.id ?? session.activeSceneId,
    activeSceneTool,
    playerSelected: sceneInspectorTarget === "player",
    selectedGenerationGuideId,
    selectedSceneLayerId: selectedSceneLayer?.id ?? null
  });
  const sceneSelection = sceneSelectionSummary({
    selectedActor,
    selectedGenerationGuide,
    selectedHotspot,
    selectedPickup,
    selectedScene: selectedScene?.type === "layered-2d" ? selectedScene : null,
    selectedSceneLayer,
    target: sceneSelectionTarget
  });
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

  const scrollAiAdvancedIntoView = useCallback(() => {
    const workspaceElement = aiWorkspaceRef.current;
    const advancedElement = aiAdvancedSectionRef.current;
    if (!workspaceElement || !advancedElement || !advancedElement.open) return;

    const workspaceBounds = workspaceElement.getBoundingClientRect();
    const advancedBounds = advancedElement.getBoundingClientRect();
    const targetTop =
      workspaceElement.scrollTop + advancedBounds.top - workspaceBounds.top - 12;
    const maxTop = Math.max(0, workspaceElement.scrollHeight - workspaceElement.clientHeight);

    workspaceElement.scrollTo({
      behavior: "auto",
      top: Math.min(Math.max(targetTop, 0), maxTop)
    });
  }, []);

  const openAiAdvancedSection = useCallback(() => {
    setAiAdvancedOpen(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(scrollAiAdvancedIntoView);
    });
  }, [scrollAiAdvancedIntoView]);

  useEffect(() => {
    if (workspace !== "ai" || !aiAdvancedOpen) return;

    const frame = window.requestAnimationFrame(scrollAiAdvancedIntoView);
    return () => window.cancelAnimationFrame(frame);
  }, [aiAdvancedOpen, aiStep, scrollAiAdvancedIntoView, workspace]);
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
        setCropStatus(formatEditorError(error, "Asset preview could not be loaded for cropping."));
      });
    setGuideStatus("Choose a saved prompt target and a scene guide source.");

    return () => {
      cancelled = true;
    };
  }, [selectedAsset?.id, selectedAssetUrl]);

  useEffect(() => {
    if (activeAssetTool !== "optimize" || selectedAsset?.kind !== "image" || !selectedAssetUrl) {
      setOptimizePreview(null);
      return;
    }
    let cancelled = false;
    setOptimizePreview(null);
    setOptimizeStatus("Rendering the before/after comparison...");
    const timeout = window.setTimeout(() => {
      void createImageOptimizationPreview({
        assetUrl: selectedAssetUrl,
        height: optimizeHeight,
        presetId: optimizePresetId,
        width: optimizeWidth
      })
        .then((preview) => {
          if (cancelled) return;
          setOptimizePreview(preview);
          const delta = preview.outputBytes - preview.sourceBytes;
          const change = preview.sourceBytes > 0 ? Math.round((delta / preview.sourceBytes) * 100) : 0;
          setOptimizeStatus(`Preview ready: ${change > 0 ? "+" : ""}${change}% file-size change. Apply creates a derived asset.`);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setOptimizeStatus(formatEditorError(error, "Optimization preview could not be rendered."));
        });
    }, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [activeAssetTool, optimizeHeight, optimizePresetId, optimizeWidth, selectedAsset?.id, selectedAsset?.kind, selectedAssetUrl]);

  useEffect(() => {
    if (!project) return;
    const missingAssetPath = previewAssetPaths.find((assetPath) => !assetPreviewUrls[assetPath]);
    if (!missingAssetPath) return;

    let cancelled = false;
    gateway
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
        reportEditorError(error, "Asset could not be previewed");
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
    if (!selectedScene || !canEditViewportScene) return;
    if (mode === "resize" && selectedHotspot?.id !== hotspot.id) return;

    const startPoint = scenePointFromClient(event.clientX, event.clientY);
    if (!startPoint) return;

    event.preventDefault();
    event.stopPropagation();
    if (activeSceneTool !== "hotspot" || selectedHotspot?.id !== hotspot.id) {
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
    }
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
    if (!selectedScene || !canEditViewportScene) return;
    if (mode === "resize" && selectedPickup?.id !== pickup.id) return;

    const startPoint = scenePointFromClient(event.clientX, event.clientY);
    if (!startPoint) return;

    event.preventDefault();
    event.stopPropagation();
    if (activeSceneTool !== "pickup" || selectedPickup?.id !== pickup.id) {
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
    }
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
    if (!selectedScene || !canEditViewportScene) return;
    if (mode === "resize" && selectedActor?.id !== actor.id) return;

    const startPoint = scenePointFromClient(event.clientX, event.clientY);
    if (!startPoint) return;

    event.preventDefault();
    event.stopPropagation();
    if (activeSceneTool !== "actor" || selectedActor?.id !== actor.id) {
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
    }
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
    if (!selectedScene || !previewPlayerStart || !canEditViewportScene) return;

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

  const hydrateProject = async (
    snapshot: EditorProjectSnapshot,
    recovery?: EditorRecoverySnapshot | null
  ) => {
    const loaded =
      recovery === undefined ? await projectController.loadSession(snapshot) : { recovery, snapshot };
    const hydration = projectController.hydrate(snapshot, loaded.recovery);

    startTransition(() => {
      setProject(snapshot);
      setHistory(hydration.history);
      setPendingRecovery(hydration.pendingRecovery);
      setSelectedAssetId(hydration.selectedAssetId);
      setSelectedAnimationPackId(hydration.selectedAnimationPackId);
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

    setStatus(projectController.projectLoadStatusFor(snapshot, loaded.recovery));
  };

  useEffect(() => {
    let cancelled = false;

    async function loadInitialProject() {
      try {
        const loaded = await projectController.loadSession();
        if (cancelled) return;
        await hydrateProject(loaded.snapshot, loaded.recovery);
      } catch (error) {
        if (cancelled) return;
        reportEditorError(error, "Failed to load project");
      }
    }

    void loadInitialProject();
    return () => {
      cancelled = true;
    };
  }, [projectController, reportEditorError]);

  useEffect(() => {
    window.localStorage.setItem(
      editorPreferencesStorageKey,
      JSON.stringify(navigationState.panelPreferences)
    );
  }, [navigationState.panelPreferences]);

  useEffect(() => {
    window.localStorage.setItem(sceneViewPreferencesStorageKey, JSON.stringify(sceneViewPreferences));
  }, [sceneViewPreferences]);

  useEffect(() => {
    window.localStorage.setItem(resourceDockPreferencesStorageKey, JSON.stringify(resourceDockPreferences));
  }, [resourceDockPreferences]);

  useEffect(() => {
    if (!project?.manifest.id) {
      setGameplayGraphLayout(undefined);
      return;
    }
    const storageKey = `pointclick.editor.gameplay-graph.${project.manifest.id}.v1`;
    try {
      const saved = window.localStorage.getItem(storageKey);
      setGameplayGraphLayout(saved ? JSON.parse(saved) as GameplayGraphLayout : project.manifest.editorLayout?.gameplayGraph);
    } catch {
      setGameplayGraphLayout(project.manifest.editorLayout?.gameplayGraph);
    }
  }, [project?.manifest.editorLayout?.gameplayGraph, project?.manifest.id]);

  useEffect(() => {
    if (!project?.manifest.id || !gameplayGraphLayout) return;
    window.localStorage.setItem(
      `pointclick.editor.gameplay-graph.${project.manifest.id}.v1`,
      JSON.stringify(gameplayGraphLayout)
    );
  }, [gameplayGraphLayout, project?.manifest.id]);

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
    void projectController.syncRecovery(project, history.present, pendingRecovery).catch(() => {
      // Recovery issues should not block normal editing.
    });
  }, [history.present, pendingRecovery, project, projectController]);

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
    await projectController.clearRecovery(project.directory);
    setPendingRecovery(null);
    setStatus(`Loaded ${project.manifest.title}`);
  };

  const play = async () => {
    if (!previewRequest) return;
    setStatus("Creating isolated Test Lab session...");
    try {
    const session = await featureController.createPreviewSession(previewRequest);
      setPreviewSession(session);
      setPreviewTelemetry([]);
      setBrowserPreviewTelemetry([]);
      setPreviewActions([]);
      setBrowserPreviewActions([]);
      dispatchNavigation({ type: "test-lab/open" });
      setStatus("Test Lab connected to the current project");
    } catch (error) {
      reportEditorError(error, "Test Lab could not be opened");
    }
  };

  const openBrowser = async () => {
    if (previewSession) {
    await featureController.openPreviewInBrowser(previewSession.id);
    } else {
    await featureController.openInBrowser(previewRequest);
    }
    setStatus("Browser preview opened with the current project");
  };

  const refreshPreviewTelemetry = async () => {
    if (!previewSession) return;
    try {
    const telemetry = await featureController.readPreviewTelemetry(previewSession.id);
      setPreviewTelemetry(telemetry.snapshots);
      setBrowserPreviewTelemetry(telemetry.browserSnapshots);
      setPreviewActions(telemetry.actions);
      setBrowserPreviewActions(telemetry.browserActions);
    } catch (error) {
      reportEditorError(error, "Runtime telemetry could not be read");
    }
  };

  const closeTestLab = async () => {
    const sessionId = previewSession?.id;
    setPreviewSession(null);
    setPreviewTelemetry([]);
    setBrowserPreviewTelemetry([]);
    setPreviewActions([]);
    setBrowserPreviewActions([]);
    dispatchNavigation({ type: "test-lab/close" });
    if (sessionId) await featureController.closePreviewSession(sessionId);
    setStatus("Returned to authoring");
  };

  const openProject = async () => {
    setStatus("Waiting for a project folder...");
    const snapshot = await featureController.pickProject();
    if (!snapshot) {
      setStatus(project ? `Loaded ${project.manifest.title}` : "Project selection cancelled");
      return;
    }
    await hydrateProject(snapshot);
  };

  const createBlankProject = async () => {
    setStatus("Choose an empty folder for the blank project...");
    try {
    const snapshot = await featureController.createBlankProject();
      if (!snapshot) {
        setStatus(project ? `Loaded ${project.manifest.title}` : "Project creation cancelled");
        return;
      }
      await hydrateProject(snapshot);
      setWorkspace("overview");
    } catch (error) {
      reportEditorError(error, "Blank project could not be created");
    }
  };

  const createProjectFromStarter = async () => {
    setStatus("Choose an empty folder for the starter project...");
    try {
    const snapshot = await featureController.createProjectFromStarter();
      if (!snapshot) {
        setStatus(project ? `Loaded ${project.manifest.title}` : "Project creation cancelled");
        return;
      }
      await hydrateProject(snapshot);
      setWorkspace("overview");
    } catch (error) {
      reportEditorError(error, "Starter project could not be created");
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
      const snapshot = await projectController.applyCommand({
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
      reportEditorError(error, "Project settings could not be saved");
    }
  };

  const importAssets = async () => {
    setStatus("Importing assets...");
    try {
    const snapshot = await featureController.importAssets();
      if (!snapshot) {
        setStatus(project ? `Loaded ${project.manifest.title}` : "Asset import cancelled");
        return;
      }
      setProject(snapshot);
      setSelectedAssetId(snapshot.selectedAsset?.id ?? snapshot.assets.at(-1)?.id ?? null);
      setWorkspace("assets");
      setStatus(`Imported asset library now contains ${snapshot.assetCount} asset(s)`);
    } catch (error) {
      reportEditorError(error, "Assets could not be imported");
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
    if (targetKind === "layer") {
      const layerId = target?.entityId ?? selectedSceneLayer?.id;
      if (!layerId) return;
      updateSceneLayerDraft(layerId, "assetId", asset.id);
      setStatus(`Assigned ${asset.id} to layer ${layerId}. Apply Scene Changes to save.`);
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
    const result = await featureController.importAssetFiles(filePaths);
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
      reportEditorError(error, "Dropped assets could not be imported");
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
    const snapshot = await featureController.importAssets();
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
      reportEditorError(error, "Asset could not be imported");
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
      const snapshot = await projectController.applyCommand({
        type: "animation-pack/upsert",
        patch: { animationPack }
      });
      setProject(snapshot);
      setSelectedAnimationPackId(animationPack.id);
      setStatus(`Saved animation pack ${animationPack.id}`);
    } catch (error) {
      reportEditorError(error, "Animation pack could not be saved");
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
      const snapshot = await projectController.applyCommand({
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
      reportEditorError(error, "Asset background could not be assigned");
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
      const snapshot = await projectController.applyCommand({
        type: "asset/relink",
        assetId: selectedAsset.id,
        patch: {
          path: nextPath
        }
      });
      setProject(snapshot);
      setStatus(`Relinked ${selectedAsset.id} to ${nextPath}`);
    } catch (error) {
      reportEditorError(error, "Asset relink could not be completed");
    }
  };

  const deleteSelectedAsset = async () => {
    if (!selectedAsset) return;

    setStatus(`Deleting ${selectedAsset.id}...`);
    try {
      const deletedAssetId = selectedAsset.id;
      const snapshot = await projectController.applyCommand({
        type: "asset/delete",
        assetId: deletedAssetId
      });
      setProject(snapshot);
      setSelectedAssetId(snapshot.assets[0]?.id ?? null);
      setStatus(`Deleted ${deletedAssetId}`);
    } catch (error) {
      reportEditorError(error, "Asset delete could not be completed");
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
    const result = await featureController.saveProcessedImageAsset({
        dataUrl: canvas.toDataURL("image/png"),
        filenameHint: `${selectedAsset.id}-cutout.png`,
        processing: {
          parentAssetId: selectedAsset.id,
          operations: [{
            type: "crop",
            parameters: { x: crop.x, y: crop.y, width: crop.width, height: crop.height }
          }],
          format: "png",
          dimensions: { width: canvas.width, height: canvas.height },
          processedAt: new Date().toISOString()
        }
      });
      const assetId = result.assetIds[0];
      const asset = assetId ? result.snapshot.assets.find((entry) => entry.id === assetId) : null;
      setProject(result.snapshot);
      if (asset) {
        setSelectedAssetId(asset.id);
        setCropStatus(`Applied cutout as ${asset.id}. Assign it separately when the comparison is approved.`);
      } else {
        setCropStatus("Crop was saved, but no asset id was returned.");
      }
    } catch (error) {
      setCropStatus(formatEditorError(error, "Crop could not be saved."));
    }
  };

  const applyOptimizedAsset = async () => {
    if (!selectedAsset || selectedAsset.kind !== "image" || !selectedAssetUrl) {
      setOptimizeStatus("Select a previewable image asset before optimizing.");
      return;
    }
    if (!optimizePreview) {
      setOptimizeStatus("Wait for the before/after preview before applying this preset.");
      return;
    }
    const preset = imageOptimizePreset(optimizePresetId);
    setOptimizeStatus(`Applying ${preset.label} preset as a derived asset...`);
    try {
      const extension = preset.format === "jpeg" ? "jpg" : preset.format;
    const result = await featureController.saveProcessedImageAsset({
        dataUrl: optimizePreview.dataUrl,
        filenameHint: `${selectedAsset.id}-${preset.id}.${extension}`,
        processing: {
          parentAssetId: selectedAsset.id,
          operations: [
            ...(preset.trimAlpha ? [{ type: "trim-alpha" as const }] : []),
            {
              type: "resize" as const,
              parameters: { width: optimizePreview.width, height: optimizePreview.height, mode: preset.resize }
            },
            { type: "optimize" as const, parameters: { preset: preset.id, lossless: preset.lossless } }
          ],
          format: preset.format,
          ...(preset.quality ? { quality: preset.quality } : {}),
          dimensions: { width: optimizePreview.width, height: optimizePreview.height },
          processedAt: new Date().toISOString()
        }
      });
      const assetId = result.assetIds[0];
      setProject(result.snapshot);
      if (assetId) setSelectedAssetId(assetId);
      setOptimizeStatus(assetId ? `Applied ${assetId}. Review it, then use Assign explicitly.` : "Optimization completed without an asset id.");
    } catch (error) {
      setOptimizeStatus(formatEditorError(error, "Image optimization failed."));
    }
  };

  const assignSelectedProcessedAsset = () => {
    if (!assetEditTarget || !selectedAsset || selectedAsset.kind !== "image") return;
    assignAssetToTargetDraft(assetEditTarget.targetKind, selectedAsset, assetEditTarget);
    setOptimizeStatus(`Assigned ${selectedAsset.id} to the ${assetEditTarget.targetKind} draft.`);
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
    const maskResult = await featureController.saveProcessedImageAsset({
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
      const snapshot = await projectController.applyCommand({
        type: "prompt-pack/upsert",
        patch: { promptPack: updatedPromptPack }
      });
      setProject(snapshot);
      setSelectedAssetId(maskAsset.id);
      setSelectedPromptPackId(updatedPromptPack.id);
      setGuideStatus(`Saved ${maskAsset.id} and linked it to ${updatedPromptPack.id}/${selectedSavedGenerationTarget.id}.`);
    } catch (error) {
      setGuideStatus(formatEditorError(error, "Guide mask could not be saved."));
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
      const snapshot = await projectController.applyCommand({
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
      setGuideStatus(formatEditorError(error, "Guide set could not be updated."));
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
    const referenceResult = await featureController.saveProcessedImageAsset({
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
    const maskResult = await featureController.saveProcessedImageAsset({
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
      const snapshot = await projectController.applyCommand({
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
      setGuideStatus(formatEditorError(error, "Guide assets could not be compiled."));
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

  const restoreProviderConfigFocus = (ref: React.MutableRefObject<HTMLButtonElement | null>) => {
    window.setTimeout(() => ref.current?.focus(), 0);
  };

  const openPromptProviderConfig = (opener?: HTMLButtonElement) => {
    if (opener) promptProviderConfigReturnFocusRef.current = opener;
    setPromptProviderConfigOpen(true);
  };

  const closePromptProviderConfig = () => {
    setPromptProviderConfigOpen(false);
    restoreProviderConfigFocus(promptProviderConfigReturnFocusRef);
  };

  const applyPromptProviderConfig = (values: PromptProviderConfigValues) => {
    setLmStudioApiKey(values.lmStudioApiKey);
    setLmStudioBaseUrl(values.lmStudioBaseUrl);
    setLmStudioModel(values.lmStudioModel);
    setOpenAiApiKey(values.openAiApiKey);
    setOpenAiBaseUrl(values.openAiBaseUrl);
    setOpenAiModel(values.openAiModel);
    setRemoteProviderConsent(values.remoteProviderConsent);
    closePromptProviderConfig();
  };

  const openImageProviderConfig = (opener?: HTMLButtonElement) => {
    if (opener) imageProviderConfigReturnFocusRef.current = opener;
    setImageProviderConfigOpen(true);
  };

  const closeImageProviderConfig = () => {
    setImageProviderConfigOpen(false);
    restoreProviderConfigFocus(imageProviderConfigReturnFocusRef);
  };

  const applyImageProviderConfig = (values: ImageProviderConfigValues) => {
    setComfyUiBaseUrl(values.comfyUiBaseUrl);
    setComfyUiCheckpoint(values.comfyUiCheckpoint);
    setComfyUiSeed(values.comfyUiSeed);
    setComfyUiTimeoutMinutes(values.comfyUiTimeoutMinutes);
    setComfyUiWorkflowPath(values.comfyUiWorkflowPath);
    setGoogleImageAccessToken(values.googleImageAccessToken);
    setGoogleImageApiKey(values.googleImageApiKey);
    setGoogleImageBaseUrl(values.googleImageBaseUrl);
    setGoogleImageLocation(values.googleImageLocation);
    setGoogleImageModel(values.googleImageModel);
    setGoogleImageProjectId(values.googleImageProjectId);
    setGoogleImageProvider(values.googleImageProvider);
    setOpenAiImageApiKey(values.openAiImageApiKey);
    setOpenAiImageBaseUrl(values.openAiImageBaseUrl);
    setOpenAiImageMode(values.openAiImageMode);
    setOpenAiImageModel(values.openAiImageModel);
    setRemoteProviderConsent(values.remoteProviderConsent);
    closeImageProviderConfig();
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
    const job = await featureController.generatePromptPack({
        allowRemoteProvider: remoteProviderConsent,
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
      reportEditorError(error, "Prompt pack could not be generated");
    } finally {
      setPromptPackGenerationState("idle");
    }
  };

  const generateAuthoringSuggestions = async () => {
    if (!project) return;
    setAuthoringSuggestionState("running");
    try {
    const suggestions = await featureController.generateAuthoringSuggestions(
        promptPackScene ? { sceneId: promptPackScene.id } : undefined
      );
      setAuthoringSuggestions(suggestions);
      setStatus(suggestions.length ? `Generated ${suggestions.length} deterministic authoring suggestion(s).` : "No authoring suggestions are available for this scene.");
    } catch (error) {
      reportEditorError(error, "Authoring suggestions could not be generated.");
    } finally {
      setAuthoringSuggestionState("idle");
    }
  };

  const saveApprovedPromptPack = async () => {
    const promptPack = promptPackCandidate?.promptPack ?? null;
    if (!promptPack) return;

    setStatus(`Saving ${promptPack.id}...`);
    try {
      const snapshot = await projectController.applyCommand({
        type: "prompt-pack/upsert",
        patch: { promptPack }
      });
      setProject(snapshot);
      setSelectedPromptPackId(promptPack.id);
      setStatus(`Saved prompt pack ${promptPack.id}`);
    } catch (error) {
      reportEditorError(error, "Prompt pack could not be saved");
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
      const snapshot = await projectController.applyCommand({
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
      reportEditorError(error, "Target prompt settings could not be saved");
    }
  };

  const installSelectedWorkflowPreset = async () => {
    if (!project || !selectedWorkflowPresetId) return;
    setStatus(`Installing workflow preset ${selectedWorkflowPresetId}...`);
    try {
    const snapshot = await featureController.installWorkflowPreset(selectedWorkflowPresetId);
      setProject(snapshot);
      setSelectedWorkflowTemplateId(selectedWorkflowPresetId);
      setStatus(`Installed workflow preset ${selectedWorkflowPresetId}.`);
    } catch (error) {
      reportEditorError(error, "Workflow preset could not be installed");
    }
  };

  const saveSelectedGenerationRecipe = async () => {
    if (!project || !activeImagePromptPack || !selectedEffectiveGenerationTarget || !selectedWorkflowTemplate) {
      setStatus("Choose a target prompt and install a compatible workflow template before saving a recipe.");
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
      sceneId: activeImagePromptPack.sceneId,
      ...(freePromptPack ? {} : { promptPackId: activeImagePromptPack.id }),
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
      const snapshot = await projectController.applyCommand({
        type: "generation-recipe/upsert",
        patch: { generationRecipe }
      });
      setProject(snapshot);
      setStatus(`Saved recipe ${generationRecipe.id}.`);
    } catch (error) {
      reportEditorError(error, "Generation recipe could not be saved");
    }
  };

  const generateImageAsset = async () => {
    if (!project) {
      setComfyUiGenerationStatus("Open or create a project before generating image assets.");
      setStatus("Open or create a project before generating image assets.");
      return;
    }
    if (!activeImagePromptPack) {
      setComfyUiGenerationStatus("Generate or select a prompt pack, or open a free target prompt from the scene.");
      setStatus("Generate or select a prompt pack, or open a free target prompt from the scene.");
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
    if (imageProviderId === "comfyui-local" && !checkpointName && !workflowPath && !selectedWorkflowTemplate) {
      setComfyUiGenerationStatus("ComfyUI needs a checkpoint filename, an installed workflow template, or a legacy workflow API JSON path.");
      setStatus("ComfyUI needs a checkpoint filename, an installed workflow template, or a legacy workflow API JSON path.");
      return;
    }
    if (
      imageProviderId === "comfyui-local" &&
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
    if (
      imageProviderId !== "comfyui-local" &&
      (selectedEffectiveGenerationTarget.referenceAssetId || selectedEffectiveGenerationTarget.maskAssetId)
    ) {
      const imageInputStatus =
        "Cloud image providers currently support text-to-image only in this beta path. Use ComfyUI local for reference or mask targets.";
      setComfyUiGenerationStatus(imageInputStatus);
      setStatus(imageInputStatus);
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

    for (const candidate of imageGenerationCandidates) {
    await featureController.discardAssetCandidate(candidate.id);
    }
    setImageGenerationState("running");
    setActiveImageGenerationContext(selectedImageGenerationContext);
    setImageGenerationJob(null);
    setImageGenerationCandidates([]);
    setSelectedImageCandidateId(null);
    setCandidateHandoffContext(
      selectedImageGenerationContext
        ? {
            ...selectedImageGenerationContext,
            expectedAlpha:
              selectedEffectiveGenerationTarget.expectedAlpha ??
              selectedEffectiveGenerationTarget.transparent ??
              false,
            ...(selectedEffectiveGenerationTarget.backgroundMode
              ? { backgroundMode: selectedEffectiveGenerationTarget.backgroundMode }
              : {})
          }
        : null
    );
    setLastGeneratedImageAsset(null);
    const queuedStatus =
      imageProviderId === "comfyui-local"
        ? `Queueing ${selectedGenerationTarget.id} with ComfyUI (${selectedImageTargetWorkflow.label}). Krea workflows can take several minutes.`
        : `Generating ${selectedGenerationTarget.id} with ${selectedImageProvider.label} (${selectedImageTargetWorkflow.label}).`;
    setComfyUiGenerationStatus(queuedStatus);
    setStatus(queuedStatus);
    try {
      const imageRequest: StartImageGenerationRequest = {
        allowRemoteProvider: remoteProviderConsent,
        batchSize: imageGenerationBatchSize,
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
        providerId: imageProviderId,
        ...(selectedEffectiveGenerationTarget.referenceAssetId
          ? { referenceAssetIds: [selectedEffectiveGenerationTarget.referenceAssetId] }
          : {}),
        targetId: selectedEffectiveGenerationTarget.id,
        width: selectedGenerationDimensions.width,
        workflowFamily: selectedImageWorkflowFamily,
        ...(selectedEffectiveGenerationTarget.backgroundMode
          ? { backgroundMode: selectedEffectiveGenerationTarget.backgroundMode }
          : {}),
        ...(imageProviderId === "comfyui-local" && comfyUiBaseUrl.trim() ? { baseUrl: comfyUiBaseUrl.trim() } : {}),
        ...(imageProviderId === "comfyui-local" && checkpointName ? { checkpointName } : {}),
        ...(imageProviderId === "openai-image" && openAiImageApiKey.trim()
          ? { openAiApiKey: openAiImageApiKey.trim() }
          : {}),
        ...(imageProviderId === "openai-image" && openAiImageBaseUrl.trim()
          ? { openAiBaseUrl: openAiImageBaseUrl.trim() }
          : {}),
        ...(imageProviderId === "openai-image" ? { openAiMode: openAiImageMode } : {}),
        ...(imageProviderId === "openai-image" && openAiImageModel.trim()
          ? { openAiModel: openAiImageModel.trim() }
          : {}),
        ...(imageProviderId === "google-image" && googleImageAccessToken.trim()
          ? { googleAccessToken: googleImageAccessToken.trim() }
          : {}),
        ...(imageProviderId === "google-image" && googleImageApiKey.trim()
          ? { googleApiKey: googleImageApiKey.trim() }
          : {}),
        ...(imageProviderId === "google-image" && googleImageBaseUrl.trim()
          ? { googleBaseUrl: googleImageBaseUrl.trim() }
          : {}),
        ...(imageProviderId === "google-image" && googleImageLocation.trim()
          ? { googleLocation: googleImageLocation.trim() }
          : {}),
        ...(imageProviderId === "google-image" && googleImageModel.trim()
          ? { googleModel: googleImageModel.trim() }
          : {}),
        ...(imageProviderId === "google-image" && googleImageProjectId.trim()
          ? { googleProjectId: googleImageProjectId.trim() }
          : {}),
        ...(imageProviderId === "google-image" ? { googleProvider: googleImageProvider } : {}),
        ...(parsedSeed !== null ? { seed: parsedSeed } : {}),
        timeoutMs: Math.round(timeoutMinutes * 60_000),
        ...(imageProviderId === "comfyui-local" && selectedWorkflowTemplate ? { workflowId: selectedWorkflowTemplate.id } : {}),
        ...(selectedGenerationRecipe ? { recipeId: selectedGenerationRecipe.id } : {}),
        ...(imageProviderId === "comfyui-local" && selectedWorkflowTemplate ? { outputNodeId: selectedWorkflowTemplate.output.nodeId } : {}),
        ...(imageProviderId === "comfyui-local" && workflowPath ? { workflowPath } : {})
      };
    const job = await featureController.startImageGeneration(imageRequest);
      setImageGenerationJob(job);
      setAiStep("review");
    } catch (error) {
      const message = formatEditorError(error, "Image asset could not be generated");
      setComfyUiGenerationStatus(message);
      setStatus(message);
      setImageGenerationState("idle");
      setActiveImageGenerationContext(null);
    }
  };

  const cancelImageGeneration = async () => {
    if (!imageGenerationJob || imageGenerationJob.status === "cancelled") return;
    try {
    await featureController.cancelImageGeneration(imageGenerationJob.id);
    } catch (error) {
      reportEditorError(error, "Image generation could not be cancelled.");
    }
  };

  const discardImageCandidate = async (candidateId: string) => {
    try {
    await featureController.discardAssetCandidate(candidateId);
      setImageGenerationCandidates((current) => current.filter((candidate) => candidate.id !== candidateId));
      setSelectedImageCandidateId((current) => (current === candidateId ? null : current));
      setStatus("Temporary image candidate discarded. The project was not changed.");
    } catch (error) {
      reportEditorError(error, "Image candidate could not be discarded.");
    }
  };

  const applyImageCandidate = async (candidate: ImageGenerationCandidate) => {
    setStatus(`Applying candidate ${candidate.id}...`);
    try {
    const applied = await featureController.applyAssetCandidate(candidate.id);
      setProject(applied.snapshot);
      setSelectedAssetId(applied.assetId);
      setImageGenerationCandidates((current) => current.filter((entry) => entry.id !== candidate.id));
      setSelectedImageCandidateId(null);
      setLastGeneratedImageAsset(
        candidateHandoffContext
          ? {
              ...candidateHandoffContext,
              assetId: applied.assetId,
              assetPath: applied.assetPath,
              hasAlphaPixels: candidate.hasAlphaPixels,
              ...(candidate.warnings.length ? { outputWarning: candidate.warnings.join(" ") } : {}),
              seed: candidate.seed
            }
          : null
      );
      const message = `Applied ${applied.assetId}. Assignment to a scene or actor remains a separate action.`;
      setComfyUiGenerationStatus(message);
      setStatus(message);
    } catch (error) {
      reportEditorError(error, "Image candidate could not be applied.");
    }
  };

  const runValidation = async () => {
    if (!project) return;
    setValidationRunState("running");
    setValidationStatus("Validating saved project files...");
    try {
    const report = await featureController.runValidation();
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
      setValidationStatus(formatEditorError(error, "Validation could not be completed"));
    }
  };

  const exportWebBuild = async () => {
    if (!project || buildBlockingIssues.length > 0 || dirtyState.count > 0) return;
    setWebExportState("running");
    setWebExportStatus("Preparing the browser runtime, project bundle, and assets...");
    try {
    const result = await featureController.exportWebBuild();
      if (!result) {
        setWebExportStatus("Web export cancelled.");
        return;
      }
      const message = `Exported ${result.assetCount} asset(s) to ${result.outputDirectory}.`;
      setWebExportStatus(message);
      setStatus(message);
    } catch (error) {
      const message = formatEditorError(error, "Web export failed.");
      setWebExportStatus(message);
      setStatus(message);
    } finally {
      setWebExportState("idle");
    }
  };

  const createFlow = async () => {
    if (!project) return;

    const flowId = nextFlowId(project);
    setStatus(`Creating ${flowId}...`);
    try {
      const snapshot = await projectController.applyCommand({
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
      reportEditorError(error, "Failed to create flow");
    }
  };

  const deleteSelectedFlow = async () => {
    if (!selectedFlow) return;

    const deletedFlowId = selectedFlow.id;
    setStatus(`Deleting ${deletedFlowId}...`);
    try {
      const snapshot = await projectController.applyCommand({
        type: "flow/delete",
        flowId: deletedFlowId
      });
      const nextActiveFlowId = snapshot.flows[0]?.id ?? null;
      setProject(snapshot);
      setHistory((current) => ({
        ...current,
          present: projectController.discardSavedDraft(
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
      reportEditorError(error, "Failed to delete flow");
    }
  };

  const createItem = async () => {
    if (!project) return;

    const itemId = nextItemId(project);
    setStatus(`Creating ${itemId}...`);
    try {
      const snapshot = await projectController.applyCommand({
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
      reportEditorError(error, "Failed to create item");
    }
  };

  const deleteSelectedItem = async () => {
    if (!selectedItem) return;

    const deletedItemId = selectedItem.id;
    setStatus(`Deleting ${deletedItemId}...`);
    try {
      const snapshot = await projectController.applyCommand({
        type: "item/delete",
        itemId: deletedItemId
      });
      const nextActiveItemId = snapshot.items[0]?.id ?? null;
      setProject(snapshot);
      setWorkspace("scene");
      setHistory((current) => ({
        ...current,
          present: projectController.discardSavedDraft(
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
      reportEditorError(error, "Failed to delete item");
    }
  };

  const createScene = async () => {
    if (!project) return;

    const sceneId = nextSceneId(project);
    setStatus(`Creating ${sceneId}...`);
    try {
      const snapshot = await projectController.applyCommand({
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
      reportEditorError(error, "Failed to create scene");
    }
  };

  const deleteSelectedScene = async () => {
    if (!selectedScene || !project) return;

    const deletedSceneId = selectedScene.id;
    setStatus(`Deleting ${deletedSceneId}...`);
    try {
      const snapshot = await projectController.applyCommand({
        type: "scene/delete",
        sceneId: deletedSceneId
      });
      const nextActiveSceneId = sceneItems(snapshot.scenes)[0]?.id ?? snapshot.manifest.initialSceneId;
      setProject(snapshot);
      setWorkspace("scene");
      setHistory((current) => {
        const nextPresent = projectController.discardSavedDraft(
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
      reportEditorError(error, "Failed to delete scene");
    }
  };

  const createHotspot = async () => {
    if (!project || !selectedScene) return;

    const hotspotId = nextHotspotId(selectedScene);
    setStatus(`Creating ${hotspotId}...`);
    try {
      const snapshot = await projectController.applyCommand({
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
      reportEditorError(error, "Failed to create hotspot");
    }
  };

  const deleteSelectedHotspot = async () => {
    if (!selectedScene || !selectedHotspot) return;

    const deletedHotspotId = selectedHotspot.id;
    const draftKey = createHotspotKey(selectedScene.id, deletedHotspotId);
    setStatus(`Deleting ${deletedHotspotId}...`);
    try {
      const snapshot = await projectController.applyCommand({
        type: "hotspot/delete",
        hotspotId: deletedHotspotId,
        sceneId: selectedScene.id
      });
      setProject(snapshot);
      setWorkspace("scene");
      setHistory((current) => ({
        ...current,
          present: projectController.discardSavedDraft(
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
      reportEditorError(error, "Failed to delete hotspot");
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
      const snapshot = await projectController.applyCommand({
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
      reportEditorError(error, "Failed to create pickup");
    }
  };

  const deleteSelectedPickup = async () => {
    if (!selectedScene || !selectedPickup) return;

    const deletedPickupId = selectedPickup.id;
    const draftKey = createPickupKey(selectedScene.id, deletedPickupId);
    setStatus(`Deleting ${deletedPickupId}...`);
    try {
      const snapshot = await projectController.applyCommand({
        type: "pickup/delete",
        pickupId: deletedPickupId,
        sceneId: selectedScene.id
      });
      setProject(snapshot);
      setWorkspace("scene");
      setHistory((current) => ({
        ...current,
          present: projectController.discardSavedDraft(
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
      reportEditorError(error, "Failed to delete pickup");
    }
  };

  const createActor = async () => {
    if (!project || !selectedScene) return;

    const actorId = nextActorId(selectedScene);
    setStatus(`Creating ${actorId}...`);
    try {
      const snapshot = await projectController.applyCommand({
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
      reportEditorError(error, "Failed to create actor");
    }
  };

  const deleteSelectedActor = async () => {
    if (!selectedScene || !selectedActor) return;

    const deletedActorId = selectedActor.id;
    const draftKey = createActorKey(selectedScene.id, deletedActorId);
    setStatus(`Deleting ${deletedActorId}...`);
    try {
      const snapshot = await projectController.applyCommand({
        actorId: deletedActorId,
        sceneId: selectedScene.id,
        type: "actor/delete"
      });
      setProject(snapshot);
      setWorkspace("scene");
      setHistory((current) => ({
        ...current,
          present: projectController.discardSavedDraft(
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
      reportEditorError(error, "Failed to delete actor");
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

  const openNarrativeReferenceSource = (reference: NarrativeFlowReference) => {
    setWorkspace("scene");
    setSceneInspectorTarget("scene");
    setSelectedSceneLayerId(null);
    setSelectedGenerationGuideId(null);
    setActiveSceneTool(
      reference.entityKind === "actor"
        ? "actor"
        : reference.entityKind === "pickup"
          ? "pickup"
          : "hotspot"
    );
    updateSessionSelection((current) => ({
      ...current,
      activeActorId: reference.entityKind === "actor" ? reference.entityId : null,
      activeFlowId: null,
      activeHotspotId: reference.entityKind === "hotspot" ? reference.entityId : null,
      activeItemId: null,
      activeLocale: null,
      activePickupId: reference.entityKind === "pickup" ? reference.entityId : null,
      activeSceneId: reference.sceneId
    }));
    setStatus(`Opened ${reference.entityKind} ${reference.entityId} in ${reference.sceneName}.`);
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
      case "prompt-pack":
        return project.promptPacks.some((promptPack) => promptPack.id === target.promptPackId);
      case "generation-recipe":
        return project.generationRecipes.some((recipe) => recipe.id === target.generationRecipeId);
      case "workflow-template":
        return project.workflowTemplates.some((template) => template.id === target.workflowTemplateId);
      case "style-bible":
        return project.styleBibles.some((styleBible) => styleBible.id === target.styleBibleId);
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
      setActiveAssetTool("animation");
      setStatus(`Opened animation pack ${target.animationPackId} from build readiness.`);
      return;
    }

    if (target.kind === "prompt-pack") {
      const promptPack = project.promptPacks.find((entry) => entry.id === target.promptPackId);
      setWorkspace("ai");
      setSelectedPromptPackId(target.promptPackId);
      if (promptPack) {
        setPromptPackSceneId(promptPack.sceneId);
      }
      if (target.targetId) {
        setSelectedGenerationTargetId(target.targetId);
      }
      setStatus(
        target.targetId
          ? `Opened prompt target ${target.promptPackId}/${target.targetId} from build readiness.`
          : `Opened prompt pack ${target.promptPackId} from build readiness.`
      );
      return;
    }

    if (target.kind === "generation-recipe") {
      const recipe = project.generationRecipes.find((entry) => entry.id === target.generationRecipeId);
      const promptPack = recipe ? project.promptPacks.find((entry) => entry.id === recipe.promptPackId) : null;
      setWorkspace("ai");
      if (recipe) {
        setSelectedPromptPackId(recipe.promptPackId ?? null);
        if (recipe.targetId) {
          setSelectedGenerationTargetId(recipe.targetId);
        }
        setSelectedWorkflowTemplateId(recipe.workflowId);
        if (recipe.sceneId ?? promptPack?.sceneId) {
          setPromptPackSceneId(recipe.sceneId ?? promptPack!.sceneId);
        }
      }
      setStatus(`Opened generation recipe ${target.generationRecipeId} from build readiness.`);
      return;
    }

    if (target.kind === "workflow-template") {
      setWorkspace("ai");
      setSelectedWorkflowTemplateId(target.workflowTemplateId);
      setStatus(`Opened workflow template ${target.workflowTemplateId} from build readiness.`);
      return;
    }

    if (target.kind === "style-bible") {
      setWorkspace("ai");
      setStatus(`Opened style bible ${target.styleBibleId} context from build readiness.`);
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
      setCleanupStatus(formatEditorError(error, "Background cleanup preview failed."));
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
    const result = await featureController.saveProcessedImageAsset({
        dataUrl,
        filenameHint: backgroundCleanupTarget.filenameHint,
        processing: {
          parentAssetId: backgroundCleanupTarget.assetId,
          operations: [{
            type: "remove-background",
            parameters: {
              keyColor: cleanupKeyColor,
              tolerance: Number(cleanupTolerance),
              feather: Number(cleanupFeather),
              spillReduction: cleanupSpillReduction
            }
          }],
          format: "png",
          dimensions: {
            width: outputCanvas?.width ?? 1,
            height: outputCanvas?.height ?? 1
          },
          processedAt: new Date().toISOString()
        }
      });
      const assetId = result.assetIds[0];
      const asset = assetId ? result.snapshot.assets.find((entry) => entry.id === assetId) : null;
      setProject(result.snapshot);
      if (asset) {
        setSelectedAssetId(asset.id);
        setCleanupStatus(`Applied ${asset.id}. Assign it separately after reviewing the alpha result.`);
        setBackgroundCleanupTarget(null);
      } else {
        setCleanupStatus("Processed asset was saved, but no asset id was returned.");
      }
    } catch (error) {
      setCleanupStatus(formatEditorError(error, "Processed image could not be saved."));
    }
  };

  const openAiStudioForGenerationTarget = (sceneId: string, targetId: string) => {
    const lookup = promptPackTargetLookup(project, sceneId, targetId);
    setFreePromptTarget(null);
    setPromptPackSceneId(sceneId);
    if (lookup) {
      setSelectedPromptPackId(lookup.promptPack.id);
    }
    setSelectedGenerationTargetId(lookup?.target.id ?? targetId);
    setWorkspace("ai");
    setStatus(
      lookup
        ? `Prepared AI generation target ${lookup.target.id} from ${lookup.promptPack.id}.`
        : `Opened AI Studio for ${targetId}. Generate or save a prompt pack for this scene to create the target.`
    );
  };

  const openFreeImageGenerationForSceneTarget = (
    scene: Layered2DScene,
    target: Omit<FreePromptTarget, "sceneId">,
    promptHint?: string,
    outputPreset?: TargetBackgroundMode
  ) => {
    const nextTarget = { ...target, sceneId: scene.id };
    const targetId = freePromptTargetId(nextTarget);
    const label = freePromptLabel(nextTarget, scene);
    setPromptPackSceneId(scene.id);
    setFreePromptTarget(nextTarget);
    setSelectedGenerationTargetId(targetId);
    setPromptPackJob(null);
    setFreePromptText(promptHint ?? `Create game-ready point-and-click artwork for ${label}.`);
    setFreePromptNegative("");
    setFreePromptOutputPreset(outputPreset ?? (target.kind === "scene-background" || target.kind === "layer" ? "opaque-scene" : "chroma-blue"));
    setWorkspace("ai");
    setStatus(`Opened free AI prompt for ${label}. Edit the prompt, choose style/chroma, then generate.`);
  };

  const openContextualGenerationModal = (
    scene: Layered2DScene,
    target: Omit<FreePromptTarget, "sceneId">,
    promptHint?: string,
    outputPreset?: TargetBackgroundMode
  ) => {
    const nextTarget = { ...target, sceneId: scene.id };
    const targetId = freePromptTargetId(nextTarget);
    const label = freePromptLabel(nextTarget, scene);
    setPromptPackSceneId(scene.id);
    setFreePromptTarget(nextTarget);
    setSelectedGenerationTargetId(targetId);
    setPromptPackJob(null);
    setFreePromptText(promptHint ?? `Create game-ready point-and-click artwork for ${label}.`);
    setFreePromptNegative("");
    setFreePromptOutputPreset(outputPreset ?? (target.kind === "scene-background" || target.kind === "layer" ? "opaque-scene" : "chroma-blue"));
    setContextualGenerationModalOpen(true);
    setStatus(`Prepared contextual generation for ${label}.`);
  };

  const openAdvancedAiForContextualGeneration = () => {
    if (!freePromptTarget || !promptPackScene) return;
    setContextualGenerationModalOpen(false);
    setWorkspace("ai");
    openAiAdvancedSection();
    setStatus(`Opened AI Studio for ${freePromptLabel(freePromptTarget, promptPackScene)}.`);
  };

  const openImageGenerationForSceneTarget = (targetId: string) => {
    if (!selectedScene) return;
    openAiStudioForGenerationTarget(selectedScene.id, targetId);
  };

  const openAiStudioForAssetUsage = () => {
    if (!selectedAsset) return;
    const usageTarget = selectedAssetUsage.find(
      (usage) => usage.sceneId && (usage.type === "scene" || usage.type === "actor" || usage.type === "pickup" || usage.type === "player")
    );
    if (!usageTarget?.sceneId) {
      if (selectedScene) {
        setPromptPackSceneId(selectedScene.id);
      }
      setWorkspace("ai");
      setStatus(
        selectedScene
          ? `Opened AI Studio for ${selectedScene.name}. This asset is not linked to a generation target yet.`
          : "Opened AI Studio. Select a layered scene or save a prompt pack before choosing a generation target."
      );
      return;
    }

    const targetId =
      usageTarget.type === "scene"
        ? `${usageTarget.sceneId}-background`
        : usageTarget.type === "player"
          ? "player"
          : usageTarget.entityId ?? selectedAsset.id;
    openAiStudioForGenerationTarget(usageTarget.sceneId, targetId);
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

  const assignGeneratedAssetToLayerDraft = () => {
    if (!lastGeneratedImageAsset || lastGeneratedImageAsset.entityKind !== "layer" || !lastGeneratedImageAsset.entityId) {
      setStatus("Generate a layer target before assigning the asset to a layer draft.");
      return;
    }
    const scene = project?.scenes.find((entry) => entry.id === lastGeneratedImageAsset.sceneId);
    if (!scene || scene.type !== "layered-2d") {
      setStatus("Generated asset could not be assigned because the target scene is unavailable.");
      return;
    }
    updateDraftWithHistory((current) => {
      const sceneDraft = current.sceneDrafts[scene.id] ?? createSceneDraft(scene);
      return {
        ...current,
        sceneDrafts: {
          ...current.sceneDrafts,
          [scene.id]: {
            ...sceneDraft,
            layers: sceneDraft.layers.map((layer) =>
              layer.id === lastGeneratedImageAsset.entityId ? { ...layer, assetId: lastGeneratedImageAsset.assetId } : layer
            )
          }
        }
      };
    });
    setWorkspace("scene");
    setSelectedSceneLayerId(lastGeneratedImageAsset.entityId);
    selectSceneEntityFromHandoff(lastGeneratedImageAsset.sceneId);
    setStatus(
      `Assigned ${lastGeneratedImageAsset.assetId} to layer ${lastGeneratedImageAsset.entityId}. Apply Scene Changes to save.`
    );
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

  const assignGeneratedAssetToPickupDraft = () => {
    if (!lastGeneratedImageAsset || lastGeneratedImageAsset.entityKind !== "pickup" || !lastGeneratedImageAsset.entityId) {
      setStatus("Generate a pickup target before assigning the asset to a pickup draft.");
      return;
    }
    if (
      !updatePickupDraftById(lastGeneratedImageAsset.sceneId, lastGeneratedImageAsset.entityId, {
        assetId: lastGeneratedImageAsset.assetId
      })
    ) {
      setStatus("Generated asset could not be assigned to the pickup draft.");
      return;
    }
    selectSceneEntityFromHandoff(lastGeneratedImageAsset.sceneId, { pickupId: lastGeneratedImageAsset.entityId });
    setStatus(
      `Assigned ${lastGeneratedImageAsset.assetId} to pickup ${lastGeneratedImageAsset.entityId}. Apply Pickup Changes to save.`
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
    if (!currentFlowDraft) return;
    const newNode = createNewFlowNode(type, currentFlowDraft.nodes);
    setSelectedFlowNodeId(newNode.id);
    updateFlowDraft((current) => ({
      ...current,
      nodes: [...current.nodes, newNode]
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
      const snapshot = await projectController.applyCommand({
        actorId: selectedActor.id,
        patch,
        sceneId: selectedScene.id,
        type: "actor/update"
      });
      setProject(snapshot);
      setHistory((current) => ({
        ...current,
          present: projectController.discardSavedDraft(
          current.present,
          "actor",
          createActorKey(selectedScene.id, selectedActor.id)
        )
      }));
      setStatus(`Saved ${selectedActor.id}`);
    } catch (error) {
      reportEditorError(error, "Failed to save actor");
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

      const snapshot = await projectController.applyCommand({
        type: "hotspot/update",
        hotspotId: selectedHotspot.id,
        patch,
        sceneId: selectedScene.id
      });
      setProject(snapshot);
      setHistory((current) =>
        ({
          ...current,
          present: projectController.discardSavedDraft(
            current.present,
            "hotspot",
            createHotspotKey(selectedScene.id, selectedHotspot.id)
          )
        })
      );
      setStatus(`Saved ${selectedHotspot.id}`);
    } catch (error) {
      reportEditorError(error, "Failed to save hotspot");
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
      const snapshot = await projectController.applyCommand({
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
        present: projectController.discardSavedDraft(current.present, "scene", selectedScene.id)
      }));
      setStatus(`Saved ${selectedScene.id}`);
    } catch (error) {
      reportEditorError(error, "Failed to save scene");
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

      const snapshot = await projectController.applyCommand({
        type: "pickup/update",
        pickupId: selectedPickup.id,
        patch,
        sceneId: selectedScene.id
      });
      setProject(snapshot);
      setHistory((current) => ({
        ...current,
          present: projectController.discardSavedDraft(
          current.present,
          "pickup",
          createPickupKey(selectedScene.id, selectedPickup.id)
        )
      }));
      setStatus(`Saved ${selectedPickup.id}`);
    } catch (error) {
      reportEditorError(error, "Failed to save pickup");
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
      const snapshot = await projectController.applyCommand({
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
        present: projectController.discardSavedDraft(current.present, "item", selectedItem.id)
      }));
      setStatus(`Saved ${selectedItem.id}`);
    } catch (error) {
      reportEditorError(error, "Failed to save item");
    }
  };

  const saveLocaleString = async (localeId: string, key: string, value: string) => {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      setStatus("Locale keys cannot be empty");
      return;
    }

    setStatus(`Saving ${normalizedKey}...`);
    try {
      const snapshot = await projectController.applyCommand({
        type: "locale/upsert",
        locale: localeId,
        patch: {
          key: normalizedKey,
          value
        }
      });
      setProject(snapshot);
      setHistory((current) => ({
        ...current,
        present: projectController.discardSavedDraft(current.present, "locale", localeId)
      }));
      setStatus(`Saved ${normalizedKey}`);
    } catch (error) {
      reportEditorError(error, "Failed to save locale string");
    }
  };

  const applyLocaleUpsert = async (key: string, value: string) => {
    if (!selectedLocale) return;
    await saveLocaleString(selectedLocale.locale, key, value);
  };

  const openFlowTextLocaleKey = (key: string) => {
    if (!defaultLocaleDocument) {
      setStatus(`Default locale "${defaultLocaleId}" is unavailable.`);
      return;
    }
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      setStatus("Set a text key before opening the locale entry.");
      return;
    }

    setWorkspace("narrative");
    setSceneInspectorTarget("scene");
    updateDraftWithHistory((current) => ({
      ...current,
      activeActorId: null,
      activeFlowId: null,
      activeHotspotId: null,
      activeItemId: null,
      activeLocale: defaultLocaleDocument.locale,
      activePickupId: null,
      localeEntryDrafts: {
        ...current.localeEntryDrafts,
        [defaultLocaleDocument.locale]: {
          key: normalizedKey,
          value: defaultLocaleStrings?.[normalizedKey] ?? ""
        }
      }
    }));
    setStatus(`Opened ${normalizedKey} in ${defaultLocaleDocument.locale}.`);
  };

  const createFlowTextLocaleKey = async (node: FlowDraftNode) => {
    if (node.type !== "line" || !selectedFlow || !defaultLocaleDocument) return;
    const textKey = node.textKey.trim();
    if (!textKey) {
      setStatus("Set a text key before creating locale text.");
      return;
    }
    await saveLocaleString(
      defaultLocaleDocument.locale,
      textKey,
      fallbackFlowLineText(selectedFlow.id, node.id, textKey)
    );
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
      const snapshot = await projectController.applyCommand({
        type: "locale/delete",
        key: normalizedKey,
        locale: selectedLocale.locale
      });
      setProject(snapshot);
      setHistory((current) => ({
        ...current,
        present: projectController.discardSavedDraft(current.present, "locale", selectedLocale.locale)
      }));
      setStatus(`Deleted ${normalizedKey}`);
    } catch (error) {
      reportEditorError(error, "Failed to delete locale string");
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

    const nextNodes = buildFlowNodes(currentFlowDraft.nodes);
    const nextFlowDiagnostics = validateFlowGraph(
      {
        ...selectedFlow,
        ...(currentFlowDraft.editorLayout ? { editorLayout: currentFlowDraft.editorLayout } : {}),
        name,
        nodes: nextNodes,
        startNodeId
      },
      Object.fromEntries((project?.flows ?? []).map((flow) => [flow.id, flow]))
    );
    const firstGraphError = nextFlowDiagnostics.find((diagnostic) => diagnostic.severity === "error");
    if (firstGraphError) {
      setSelectedFlowNodeId(firstGraphError.nodeId ?? firstGraphError.targetId ?? null);
      setStatus(firstGraphError.message);
      return;
    }

    setStatus(`Saving ${selectedFlow.id}...`);
    try {
      const snapshot = await projectController.applyCommand({
        type: "flow/update",
        flowId: selectedFlow.id,
        patch: {
          ...(currentFlowDraft.editorLayout ? { editorLayout: currentFlowDraft.editorLayout } : {}),
          name,
          nodes: nextNodes,
          startNodeId
        }
      });
      setProject(snapshot);
      setHistory((current) => ({
        ...current,
        present: projectController.discardSavedDraft(current.present, "flow", selectedFlow.id)
      }));
      setStatus(`Saved ${selectedFlow.id}`);
    } catch (error) {
      reportEditorError(error, "Failed to save flow");
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

    if (nextWorkspace === "narrative" || nextWorkspace === "flows") {
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

  const openCreatorPathStep = (step: CreatorPathStep) => {
    changeWorkspace(step.workspace);
  };

  const openProjectResource = (resource: ProjectResourceDescriptor) => {
    const target = resource.owner;
    dispatchNavigation({ type: "navigate", target });
    if (target.workspace === "scene" && target.sceneId) {
      selectScene(target.sceneId);
      return;
    }
    if (target.workspace === "narrative") {
      const flow = target.flowId ? project?.flows.find((entry) => entry.id === target.flowId) : null;
      if (flow) {
        selectFlow(flow);
        setSelectedFlowNodeId(flow.startNodeId);
        return;
      }
      const locale = project?.locales.find((entry) => entry.locale === resource.id);
      if (locale) {
        selectLocale(locale);
        return;
      }
      const item = project?.items.find((entry) => entry.id === resource.id);
      if (item) selectItem(item);
      return;
    }
    if (target.workspace === "assets") {
      if (resource.kind === "image" || resource.kind === "audio") {
        setSelectedAssetId(resource.id);
        setActiveAssetTool("info");
      } else if (resource.kind === "animation-pack") {
        setSelectedAnimationPackId(resource.id);
        setActiveAssetTool("animation");
      }
      return;
    }
    if (target.workspace === "ai") {
      if (resource.kind === "prompt-pack") setSelectedPromptPackId(resource.id);
      if (target.sceneId) setPromptPackSceneId(target.sceneId);
    }
  };

  const renderContextualTree = () => {
    if (!project) {
      return <div className="tree-item tree-meta">No project loaded</div>;
    }
    if (workspace === "scene") {
      return (
        <SceneTreeLaunchpad
          actions={{
            createActor,
            createBlankGenerationGuide,
            createHotspot,
            createPickup,
            createScene,
            createSceneLayer,
            generationGuideColor,
            onSelectActor: selectActor,
            onSelectHotspot: selectHotspot,
            onSelectPickup: selectPickup,
            onSelectScene: selectScene,
            onSelectPlayerInScene: selectPlayerInScene,
            onSetActiveSceneTool: setActiveSceneTool,
            onSetSceneInspectorTarget: setSceneInspectorTarget,
            onSetSelectedGenerationGuideId: setSelectedGenerationGuideId,
            onSetSelectedSceneLayerId: setSelectedSceneLayerId,
            onSetWorkspace: setWorkspace,
            onUpdateSessionSelection: updateSessionSelection
          }}
          model={{
            activeSceneTool,
            assetPreviewUrls,
            currentGenerationGuides,
            currentSceneDraft,
            dirtyState,
            isPlayerInspectorSelected,
            previewSceneBackground,
            projectAvailable: !!project,
            scenes,
            selectedGenerationGuide,
            selectedGenerationGuideId,
            selectedScene,
            selectedSceneLayerId,
            session
          }}
        />
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
                <button
                  className="tree-item tree-meta"
                  key={`missing-narrative-reference-${reference.sceneId}-${reference.entityId}-${reference.flowId}-${index}`}
                  type="button"
                  onClick={() => openNarrativeReferenceSource(reference)}
                >
                  {reference.sceneName} / {reference.entityKind} {reference.entityId}: {reference.flowId}
                </button>
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
          <div className="tree-section-label">Resource Browser</div>
          <div className="resource-browser-controls">
            <input
              aria-label="Search project resources"
              placeholder="Search every resource..."
              type="search"
              value={resourceQuery}
              onChange={(event) => setResourceQuery(event.target.value)}
            />
            <select
              aria-label="Filter project resource type"
              value={resourceKind}
              onChange={(event) => setResourceKind(event.target.value as "all" | ProjectResourceKind)}
            >
              <option value="all">All types</option>
              <option value="scene">Scenes</option>
              <option value="image">Images</option>
              <option value="audio">Audio</option>
              <option value="animation-pack">Animation packs</option>
              <option value="flow">Flows</option>
              <option value="locale">Locales</option>
              <option value="item">Items</option>
              <option value="prompt-pack">Prompt packs</option>
              <option value="style-bible">Style bibles</option>
              <option value="workflow-template">Workflow templates</option>
              <option value="generation-recipe">Generation recipes</option>
            </select>
            <div className="resource-browser-filter-row">
              <select
                aria-label="Filter project resource health"
                value={resourceHealth}
                onChange={(event) => setResourceHealth(event.target.value as "all" | ProjectResourceHealth)}
              >
                <option value="all">All health</option>
                <option value="healthy">Healthy</option>
                <option value="warning">Warnings</option>
                <option value="error">Errors</option>
              </select>
              <div className="resource-view-toggle" aria-label="Resource view" role="group">
                <button className={resourceViewMode === "list" ? "active" : ""} type="button" onClick={() => setResourceViewMode("list")}>List</button>
                <button className={resourceViewMode === "grid" ? "active" : ""} type="button" onClick={() => setResourceViewMode("grid")}>Grid</button>
              </div>
            </div>
          </div>
          <button className="tree-item tree-child resource-import-action" type="button" onClick={importAssets}>
            <span className="scene-dot muted" /> + Import image or audio
          </button>
          <div className="tree-group open">Resources ({filteredProjectResources.length})</div>
          <div className={`resource-browser-items ${resourceViewMode}`}>
          {filteredProjectResources.map((resource) => (
            <button
              className={`tree-item resource-tree-item ${
                (resource.kind === "image" || resource.kind === "audio") && selectedAsset?.id === resource.id
                  ? "selected"
                  : ""
              }`}
              key={`${resource.kind}-${resource.id}`}
              type="button"
              onClick={() => openProjectResource(resource)}
            >
              <span className={`resource-kind-mark ${resource.kind}`} />
              <span className="resource-tree-copy">
                <strong>{resource.label}</strong>
                <small>{resource.kind} · {resource.uses.length} use(s)</small>
              </span>
              {resource.health !== "healthy" ? <span className="dirty-mark">!</span> : null}
            </button>
          ))}
          </div>
          {filteredProjectResources.length === 0 ? (
            <div className="tree-item tree-meta">No resources match the current filter.</div>
          ) : null}
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
          <div className="tree-group open">Creator workflow</div>
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

    if (!projectSummary) {
      return <div className="tree-item tree-meta">Project summary unavailable</div>;
    }

    return (
      <>
        <div className="tree-section-label">Project</div>
        <div className="tree-group open">Structure</div>
        <button className="tree-item tree-child" type="button" onClick={() => changeWorkspace("scene")}>
          <span className="scene-dot muted" /> Scenes
          <span className="tree-count">{projectSummary.sceneCount}</span>
        </button>
        <button className="tree-item tree-child" type="button" onClick={() => changeWorkspace("assets")}>
          <span className="scene-dot muted" /> Assets
          <span className="tree-count">{projectSummary.assetCount}</span>
        </button>
        <button className="tree-item tree-child" type="button" onClick={() => changeWorkspace("narrative")}>
          <span className="scene-dot muted" /> Narrative flows
          <span className="tree-count">{projectSummary.flowCount}</span>
        </button>
        <button className="tree-item tree-child" type="button" onClick={() => changeWorkspace("narrative")}>
          <span className="scene-dot muted" /> Items and locales
          <span className="tree-count">
            {projectSummary.itemCount}/{projectSummary.localeCount}
          </span>
        </button>
        <div className="tree-group open">Production</div>
        <button className="tree-item tree-child" type="button" onClick={() => changeWorkspace("ai")}>
          <span className="scene-dot muted" /> AI prompt packs
          <span className="tree-count">{projectSummary.promptPackCount}</span>
        </button>
        <button className="tree-item tree-child" type="button" onClick={() => changeWorkspace("ai")}>
          <span className="scene-dot muted" /> Generation recipes
          <span className="tree-count">{projectSummary.generationRecipeCount}</span>
        </button>
        <button className="tree-item tree-child" type="button" onClick={() => changeWorkspace("build")}>
          <span className="scene-dot muted" /> Diagnostics
          <span className="tree-count">
            {projectSummary.errorCount}/{projectSummary.warningCount}
          </span>
        </button>
        {dirtyState.count > 0 ? (
          <button className="tree-item tree-child" type="button" onClick={() => changeWorkspace("build")}>
            <span className="scene-dot muted" /> Unsaved drafts
            <span className="tree-count">{dirtyState.count}</span>
          </button>
        ) : null}
      </>
    );
  };

  useEffect(() => {
    if (!project || pendingRecovery || dirtyState.count === 0) return;
    const timeout = window.setTimeout(() => {
      const saves: Array<() => Promise<void>> = [];
      const sceneHasExplicitAssignmentDraft = selectedScene
        ? currentSceneDraft.background !== selectedScene.background ||
          currentSceneDraft.playerAssetId !== (selectedScene.player?.assetId ?? "") ||
          currentSceneDraft.playerAnimationPackId !== (selectedScene.player?.animationPackId ?? "") ||
          currentSceneDraft.layers.some(
            (layer) => layer.assetId !== (selectedScene.layers?.find((saved) => saved.id === layer.id)?.assetId ?? "")
          )
        : false;
      if (selectedScene && dirtyState.sceneIds.has(selectedScene.id) && !sceneHasExplicitAssignmentDraft) {
        saves.push(applySceneChanges);
      }

      const actorKey = selectedScene && selectedActor ? createActorKey(selectedScene.id, selectedActor.id) : null;
      const actorHasExplicitAssignmentDraft = selectedActor
        ? currentActorDraft.assetId !== (selectedActor.assetId ?? "") ||
          currentActorDraft.animationPackId !== (selectedActor.animationPackId ?? "")
        : false;
      if (actorKey && dirtyState.actorKeys.has(actorKey) && !actorHasExplicitAssignmentDraft) {
        saves.push(applyActorChanges);
      }

      const hotspotKey = selectedScene && selectedHotspot ? `${selectedScene.id}::${selectedHotspot.id}` : null;
      if (hotspotKey && dirtyState.hotspotKeys.has(hotspotKey)) saves.push(applyHotspotChanges);

      const pickupKey = selectedScene && selectedPickup ? createPickupKey(selectedScene.id, selectedPickup.id) : null;
      const pickupHasExplicitAssignmentDraft = selectedPickup
        ? currentPickupDraft.assetId !== (selectedPickup.assetId ?? "")
        : false;
      if (pickupKey && dirtyState.pickupKeys.has(pickupKey) && !pickupHasExplicitAssignmentDraft) {
        saves.push(applyPickupChanges);
      }

      if (selectedFlow && dirtyState.flowIds.has(selectedFlow.id)) saves.push(applyFlowChanges);
      if (selectedItem && dirtyState.itemIds.has(selectedItem.id)) saves.push(applyItemChanges);
      if (selectedLocale && dirtyState.localeIds.has(selectedLocale.locale)) {
        const changedStrings = Object.entries(currentLocaleDraft).filter(
          ([key, value]) => selectedLocale.strings[key] !== value
        );
        for (const [key, value] of changedStrings) {
          saves.push(() => saveLocaleString(selectedLocale.locale, key, value));
        }
        const entryKey = currentLocaleEntryDraft.key.trim();
        if (entryKey && selectedLocale.strings[entryKey] !== currentLocaleEntryDraft.value) {
          saves.push(() => saveLocaleString(selectedLocale.locale, entryKey, currentLocaleEntryDraft.value));
        }
      }

      if (saves.length === 0) return;
      setStatus(`Autosaving ${saves.length} valid document change(s)...`);
      void saves.reduce<Promise<void>>((sequence, save) => sequence.then(save), Promise.resolve());
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [
    dirtyState.count,
    history.present,
    pendingRecovery,
    project?.directory,
    selectedActor?.id,
    selectedFlow?.id,
    selectedHotspot?.id,
    selectedItem?.id,
    selectedLocale?.locale,
    selectedPickup?.id,
    selectedScene?.id
  ]);

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
      contextualControls={workspace === "scene" ? (
        <div className="scene-view-controls" aria-label="Scene view preferences">
          <button aria-pressed={sceneViewPreferences.fit} type="button" onClick={() => setSceneViewPreferences((current) => ({ ...current, fit: true }))}>Fit</button>
          <button
            aria-label="Zoom out scene"
            disabled={sceneViewPreferences.zoom <= 0.25}
            type="button"
            onClick={() => setSceneViewPreferences((current) => ({ ...current, fit: false, zoom: Math.max(0.25, current.zoom - 0.25) }))}
          >−</button>
          <button className="scene-zoom-value" title="Reset scene zoom" type="button" onClick={() => setSceneViewPreferences((current) => ({ ...current, fit: true, zoom: 1 }))}>
            {sceneViewPreferences.fit ? "Fit" : `${Math.round(sceneViewPreferences.zoom * 100)}%`}
          </button>
          <button
            aria-label="Zoom in scene"
            disabled={sceneViewPreferences.zoom >= 4}
            type="button"
            onClick={() => setSceneViewPreferences((current) => ({ ...current, fit: false, zoom: Math.min(4, current.zoom + 0.25) }))}
          >+</button>
          <button aria-pressed={sceneViewPreferences.gridVisible} type="button" onClick={() => setSceneViewPreferences((current) => ({ ...current, gridVisible: !current.gridVisible }))}>Grid</button>
          <button aria-pressed={sceneViewPreferences.overlaysVisible} type="button" onClick={() => setSceneViewPreferences((current) => ({ ...current, overlaysVisible: !current.overlaysVisible }))}>Overlays</button>
          <button aria-pressed={sceneViewPreferences.minimapVisible} type="button" onClick={() => setSceneViewPreferences((current) => ({ ...current, minimapVisible: !current.minimapVisible }))}>Map</button>
        </div>
      ) : undefined}
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

  const resizePanelBy = (panel: EditorPanelId, delta: number) => {
    const preferences = navigationState.panelPreferences;
    const width = panel === "navigation" ? preferences.navigationWidth : preferences.inspectorWidth;
    dispatchNavigation({ type: "panel/resize", panel, width: width + delta });
  };

  const beginPanelResize = (panel: EditorPanelId, event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const preferences = navigationState.panelPreferences;
    const startWidth = panel === "navigation" ? preferences.navigationWidth : preferences.inspectorWidth;
    const handleMove = (moveEvent: PointerEvent) => {
      const screenDelta = moveEvent.clientX - startX;
      dispatchNavigation({
        type: "panel/resize",
        panel,
        width: startWidth + (panel === "navigation" ? screenDelta : -screenDelta)
      });
    };
    const handleEnd = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd, { once: true });
  };

  if (navigationState.mode === "test-lab" && previewSession) {
    return (
      <TestLab
        actions={previewActions}
        browserActions={browserPreviewActions}
        browserTrace={browserPreviewTelemetry}
        session={previewSession}
        snapshots={previewTelemetry}
        onClose={() => void closeTestLab()}
        onOpenBrowser={() => void openBrowser()}
        onRefreshTelemetry={() => void refreshPreviewTelemetry()}
      />
    );
  }

  return (
    <div className="studio-shell">
      <StudioTopbar
        activeWorkspace={workspace}
        canRedo={canRedo}
        canUndo={canUndo}
        diagnosticCount={project?.diagnostics.length ?? 0}
        hasProject={!!project}
        isDirty={dirtyState.count > 0}
        projectTitle={project?.manifest.title ?? "Loading project..."}
        onCreateBlankProject={createBlankProject}
        onCreateProjectFromStarter={createProjectFromStarter}
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
      <div
        className="workspace-grid"
        style={{
          gridTemplateColumns: `${navigationState.panelPreferences.navigationOpen ? navigationState.panelPreferences.navigationWidth : 42}px minmax(420px, 1fr) ${navigationState.panelPreferences.inspectorOpen ? navigationState.panelPreferences.inspectorWidth : 42}px`
        }}
      >
        {navigationState.panelPreferences.navigationOpen ? (
          <div className="workspace-panel-slot navigation-slot">
            <ProjectMapPanel
              healthDetail={projectHealth ? `${projectHealth.detail} - ${localeLabel}` : status}
              healthLabel={projectHealth?.label ?? "Loading project health..."}
              healthTone={projectHealth?.tone ?? "warn"}
              onClose={() => dispatchNavigation({ type: "panel/toggle", panel: "navigation" })}
              onOpenProject={openProject}
            >
              {renderContextualTree()}
            </ProjectMapPanel>
            <PanelResizeHandle
              label="Resize project panel"
              side="right"
              onPointerDown={(event) => beginPanelResize("navigation", event)}
              onResize={(delta) => resizePanelBy("navigation", delta)}
            />
          </div>
        ) : (
          <CollapsedPanelRail
            label="Project"
            side="left"
            onOpen={() => dispatchNavigation({ type: "panel/toggle", panel: "navigation" })}
          />
        )}

        <WorkspaceStagePanel toolbar={stageToolbar} timeline={stageTimeline}>

          {workspace === "overview" ? (
            <WorkspaceOverview
              assetCount={projectSummary?.assetCount ?? project.assets.length}
              creatorPathSteps={creatorPathSteps}
              diagnostics={project.diagnostics}
              flowCount={projectSummary?.flowCount ?? project.flowCount}
              hasProjectSettingsChanges={hasProjectSettingsChanges}
              localeOptions={projectLocaleOptions}
              sceneCount={projectSummary?.sceneCount ?? project.sceneCount}
              onOpenAi={() => changeWorkspace("ai")}
              onOpenAssets={() => changeWorkspace("assets")}
              onOpenBuild={() => changeWorkspace("build")}
              onOpenCreatorPathStep={openCreatorPathStep}
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
              promptPackCount={projectSummary?.promptPackCount ?? project.promptPacks.length}
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
              canExport={buildBlockingIssues.length === 0 && dirtyState.count === 0}
              creatorPathSteps={creatorPathSteps}
              dirtyDraftCount={dirtyState.count}
              exportState={webExportState}
              exportStatus={webExportStatus}
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
              onOpenCreatorPathStep={openCreatorPathStep}
              onExportWeb={() => void exportWebBuild()}
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
            <AiStudioWorkspace
              actions={{ onStepChange: setAiStep }}
              model={{ currentStep: aiStep, steps: aiStudioSteps }}
              workspaceRef={aiWorkspaceRef}
            >

              <AiStudioSteps
                aiNextAction={aiNextAction}
                aiRecipeReady={aiRecipeReady}
                aiWorkflowReady={aiWorkflowReady}
                comfyUiGenerationStatus={comfyUiGenerationStatus}
                currentStep={aiStep}
                gameplayEmphasisPresetIds={gameplayEmphasisPresetIds}
                gameplayEmphasisPresets={gameplayEmphasisPresets}
                imageGenerationBatchSize={imageGenerationBatchSize}
                imageGenerationCandidates={imageGenerationCandidates}
                imageGenerationJob={imageGenerationJob}
                imageGenerationState={imageGenerationState}
                imageGenerationTargets={imageGenerationTargets}
                imageProviderBoundary={imageProviderBoundary}
                imageProviderConfigReturnFocusRef={imageProviderConfigReturnFocusRef}
                imageProviderId={imageProviderId}
                imageProviderOptions={imageProviderOptions}
                lastGeneratedImageAsset={lastGeneratedImageAsset}
                layeredScenes={layeredScenes}
                moodPresetId={moodPresetId}
                moodPresets={moodPresets}
                onApplyImageCandidate={applyImageCandidate}
                onCancelImageGeneration={cancelImageGeneration}
                onChangeGameplayEmphasis={toggleGameplayEmphasisPreset}
                onChangeImageProvider={setImageProviderId}
                onChangeImageGenerationBatchSize={setImageGenerationBatchSize}
                onChangeMoodPreset={setMoodPresetId}
                onChangePalettePreset={setPalettePresetId}
                onChangePromptPackBrief={setPromptPackBrief}
                onChangePromptPackScene={setPromptPackSceneId}
                onChangePromptProvider={setPromptProviderId}
                onChangeSettingPreset={setSettingPresetId}
                onChangeVisualStylePreset={setVisualStylePresetId}
                onDiscardImageCandidate={discardImageCandidate}
                onGenerateImageAsset={generateImageAsset}
                onGeneratePromptPack={generatePromptPack}
                onOpenAiAdvancedSection={openAiAdvancedSection}
                onOpenImageProviderConfig={openImageProviderConfig}
                onOpenPromptProviderConfig={openPromptProviderConfig}
                onSaveApprovedPromptPack={saveApprovedPromptPack}
                onSaveSelectedGenerationRecipe={saveSelectedGenerationRecipe}
                onSelectGenerationTarget={setSelectedGenerationTargetId}
                onSelectImageCandidate={setSelectedImageCandidateId}
                onStepChange={setAiStep}
                palettePresetId={palettePresetId}
                palettePresets={palettePresets}
                projectAvailable={!!project}
                promptPackCandidate={promptPackCandidate}
                promptPackGenerationState={promptPackGenerationState}
                promptPackBrief={promptPackBrief}
                promptPackSceneId={promptPackSceneId}
                promptProviderBoundary={promptProviderBoundary}
                promptProviderConfigReturnFocusRef={promptProviderConfigReturnFocusRef}
                promptProviderDescriptors={promptProviderDescriptors}
                promptProviderId={promptProviderId}
                selectedEffectiveGenerationTarget={selectedEffectiveGenerationTarget}
                selectedGenerationDimensions={selectedGenerationDimensions}
                selectedGenerationTarget={selectedGenerationTarget}
                selectedImageProvider={selectedImageProvider}
                selectedImageWorkflowFamily={selectedImageWorkflowFamily}
                selectedImageCandidateId={selectedImageCandidateId}
                selectedWorkflowTemplate={selectedWorkflowTemplate}
                selectedPromptProvider={selectedPromptProvider}
                status={status}
                settingPresetId={settingPresetId}
                settingPresets={settingPresets}
                visualStylePresetId={visualStylePresetId}
                visualStylePresets={visualStylePresets}
              />

              <details
                ref={aiAdvancedSectionRef}
                className="ai-advanced-section"
                open={aiAdvancedOpen}
                onToggle={(event) => setAiAdvancedOpen(event.currentTarget.open)}
              >
                <summary>
                  <span>
                    <strong>Advanced AI workspace</strong>
                    <small>Provider credentials, recipes, ComfyUI, guides, masks, prompts and provenance.</small>
                  </span>
                  <span className="prompt-chip">Optional</span>
                </summary>
                <div className="ai-advanced-content">
              <section className="overview-card ai-target-cockpit">
                <div className="ai-target-cockpit-header">
                  <div>
                    <span className="overview-label">Target cockpit</span>
                    <strong>{selectedEffectiveGenerationTarget?.id ?? "No target selected"}</strong>
                    <p>{aiNextAction}</p>
                  </div>
                  <span className={`capability-badge ${aiRecipeReady ? "good" : aiWorkflowReady ? "warn" : "muted"}`}>
                    {aiRecipeReady ? "Recipe ready" : aiWorkflowReady ? "Recipe needed" : "Setup needed"}
                  </span>
                </div>
                <div className="ai-target-metrics">
                  <div>
                    <span>Scene</span>
                    <strong>{promptPackScene?.id ?? "none"}</strong>
                  </div>
                  <div>
                    <span>Target</span>
                    <strong>{selectedEffectiveGenerationTarget?.intendedUse ?? "none"}</strong>
                  </div>
                  <div>
                    <span>Workflow</span>
                    <strong>{selectedWorkflowTemplate?.id ?? (comfyUiWorkflowPath.trim() ? "legacy path" : "missing")}</strong>
                  </div>
                  <div>
                    <span>Output</span>
                    <strong>{selectedGenerationDimensions.width} x {selectedGenerationDimensions.height}</strong>
                  </div>
                </div>
                <div className="ai-target-cockpit-actions">
                  <button
                    className="secondary-action compact-action"
                    disabled={!activeImagePromptPack || !selectedEffectiveGenerationTarget || !selectedWorkflowTemplate}
                    type="button"
                    onClick={saveSelectedGenerationRecipe}
                  >
                    Save Recipe
                  </button>
                  <button
                    className="play-action compact-action"
                    disabled={!activeImagePromptPack || !selectedEffectiveGenerationTarget || imageGenerationState === "running"}
                    type="button"
                    onClick={generateImageAsset}
                  >
                    {imageGenerationState === "running" ? "Generating..." : "Generate"}
                  </button>
                </div>
                {selectedImageInputWorkflowWarning ? (
                  <p className="ai-target-cockpit-warning">{selectedImageInputWorkflowWarning}</p>
                ) : null}
              </section>
              <section className="overview-card prompt-studio-card">
                <span className="overview-label">Brief & Context</span>
                <strong>{promptPackScene ? `${promptPackScene.name} target brief` : "No layered scene"}</strong>
                <p>{selectedPromptProvider.detail}</p>
                <div className="prompt-studio-controls">
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
              <section className="overview-card prompt-studio-card">
                <span className="overview-label">Narrative & Puzzle Copilot</span>
                <strong>Deterministic suggestions, human-approved changes</strong>
                <p>
                  This local mock copilot reads the selected scene and proposes reviewable story or puzzle beats. It never changes project files or runtime behavior.
                </p>
                <div className="build-actions">
                  <button
                    className="secondary-action"
                    disabled={!project || authoringSuggestionState === "running"}
                    type="button"
                    onClick={generateAuthoringSuggestions}
                  >
                    {authoringSuggestionState === "running" ? "Reviewing..." : "Suggest Story & Puzzle Beats"}
                  </button>
                </div>
                {authoringSuggestions.map((suggestion) => (
                  <div className="flow-link" key={suggestion.id}>
                    <span>{suggestion.kind}</span>
                    <strong>{suggestion.title}</strong>
                    <p className="inspector-copy">{suggestion.rationale}</p>
                    <p className="inspector-copy">{suggestion.proposals.map((proposal) => proposal.summary).join(" ")}</p>
                  </div>
                ))}
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
                  Choose a game target, save a recipe, generate through the selected provider, then review and
                  import the output as a normal project asset.
                </p>
                <div className="prompt-studio-controls">
                  <div className="target-customization-panel free-prompt-panel">
                    <div className="target-customization-heading">
                      <div>
                        <span className="overview-label">Free target prompt</span>
                        <strong>
                          {freePromptTarget && promptPackScene
                            ? freePromptLabel(freePromptTarget, promptPackScene)
                            : "No manual target"}
                        </strong>
                      </div>
                      <span className={`target-mode-pill ${freePromptPack ? "good" : "muted"}`}>
                        {freePromptPack ? "Manual target active" : "Use a scene Generate action"}
                      </span>
                    </div>
                    <div className="target-customization-grid">
                      <label className="prompt-studio-field">
                        Common art style
                        <select
                          value={freePromptStylePresetId}
                          onChange={(event) => setFreePromptStylePresetId(event.target.value)}
                        >
                          {visualStylePresets.map((preset) => (
                            <option key={`free-style-${preset.id}`} value={preset.id}>
                              {preset.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="prompt-studio-field">
                        Output / chroma preset
                        <select
                          value={freePromptOutputPreset}
                          onChange={(event) => setFreePromptOutputPreset(event.target.value as TargetBackgroundMode)}
                        >
                          {freePromptOutputPresets.map((preset) => (
                            <option key={`free-output-${preset.value}`} value={preset.value}>
                              {preset.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="prompt-studio-field">
                        Extra style note
                        <input
                          placeholder="Optional shared style override for this piece"
                          value={freePromptCustomStyle}
                          onChange={(event) => setFreePromptCustomStyle(event.target.value)}
                        />
                      </label>
                      <label className="prompt-studio-field">
                        Free prompt
                        <textarea
                          placeholder="Describe exactly what to generate for the selected scene entity."
                          value={freePromptText}
                          onChange={(event) => setFreePromptText(event.target.value)}
                        />
                      </label>
                      <label className="prompt-studio-field">
                        Free negative prompt
                        <textarea
                          placeholder="Optional exclusions for this target."
                          value={freePromptNegative}
                          onChange={(event) => setFreePromptNegative(event.target.value)}
                        />
                      </label>
                    </div>
                    <p className="target-customization-note">
                      {freePromptOutputPresets.find((preset) => preset.value === freePromptOutputPreset)?.detail ??
                        "Choose an output contract before generating."}
                    </p>
                  </div>
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
                      disabled={imageProviderId !== "comfyui-local"}
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
                      disabled={imageProviderId !== "comfyui-local" || !project || !selectedWorkflowPresetId}
                      type="button"
                      onClick={installSelectedWorkflowPreset}
                    >
                      Install Preset
                    </button>
                  </div>
                  <label className="prompt-studio-field">
                    Installed workflow template
                    <select
                      disabled={imageProviderId !== "comfyui-local" || compatibleWorkflowTemplates.length === 0}
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
                        disabled={!activeImagePromptPack || !selectedEffectiveGenerationTarget || !selectedWorkflowTemplate}
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
                    {imageGenerationState === "running" ? "Generating..." : "Generate Candidates"}
                  </button>
                </div>
                <div className="diagnostic-list">
                  <div className={`diagnostic-item ${imageGenerationState === "running" ? "warning" : ""}`}>
                    <div>
                      <strong>Image generation status</strong>
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
                        Target {lastGeneratedImageAsset.targetId} imported from {selectedImageProvider.label} seed{" "}
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
                          {lastGeneratedImageAsset.backgroundMode ?? "legacy target"} -{" "}
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
                      {lastGeneratedImageAsset.entityKind === "layer" ? (
                        <button
                          className="secondary-action compact-action"
                          type="button"
                          onClick={assignGeneratedAssetToLayerDraft}
                        >
                          Assign To Layer
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
                      {lastGeneratedImageAsset.entityKind === "pickup" ? (
                        <button
                          className="secondary-action compact-action"
                          type="button"
                          onClick={assignGeneratedAssetToPickupDraft}
                        >
                          Assign To Pickup
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
              </details>
            </AiStudioWorkspace>
          ) : workspace === "assets" ? (
            <AssetStudioLaunchpad
              model={{
                preview: {
                  activeAssetTool,
                  cropControlRadius,
                  cropImageFrameRef,
                  cropImageSize,
                  cropPath,
                  cropPreviewPath: cropSvgPath,
                  optimizePreview,
                  selectedAsset,
                  selectedAssetHealth,
                  selectedAssetUrl,
                  selectedCropNode,
                  selectedCropNodeIndex
                },
                sidebar: {
                  activeTool: activeAssetTool,
                  assetCount: project.assetCount,
                  canImport: !!project,
                  selectedAssetId: selectedAsset?.id ?? null
                },
                toolPanel: {
                  activeAssetTool,
                  assetEditTarget: !!assetEditTarget,
                  assetPathDraft,
                  cleanupFeather,
                  cleanupKeyColor,
                  cleanupOutputCanvasRef,
                  cleanupSourceCanvasRef,
                  cleanupSpillReduction,
                  cleanupStatus,
                  cleanupTolerance,
                  cropImageSize,
                  cropPath,
                  cropPreviewBounds,
                  cropStatus,
                  hasBackgroundCleanupTarget: !!backgroundCleanupTarget,
                  iconSize,
                  imageOptimizePresets,
                  optimizePresetId,
                  optimizePreview,
                  optimizeStatus,
                  optimizeHeight,
                  optimizeWidth,
                  promptPacks: project?.promptPacks ?? [],
                  savedPromptPackTargets,
                  selectedAsset,
                  selectedAssetHealth,
                  selectedAssetUsage,
                  selectedAssetUrl,
                  selectedGuideSource,
                  selectedPromptPack,
                  selectedSavedGenerationTarget,
                  selectedCropNode,
                  selectedCropNodeIndex,
                  guideSourceOptions,
                  guideShape,
                  guideStatus,
                  hasSceneSelection: !!selectedScene
                },
                workspace: {
                  activeTool: activeAssetTool,
                  assetCount: project.assetCount,
                  selectedAssetId: selectedAsset?.id ?? null
                }
              }}
              actions={{
                preview: {
                  buildAssetBytesLabel: formatAssetBytes,
                  insertCropNodeFromEvent,
                  startCropHandleInteraction,
                  startCropNodeInteraction
                },
                sidebar: {
                  onImportAssets: importAssets,
                  onToolChange: activateAssetTool
                },
                toolPanel: {
                  buildAssetBytesLabel: formatAssetBytes,
                  imageOptimizePreset,
                  onApplyAssetRelink: applyAssetRelink,
                  onApplyOptimizedAsset: applyOptimizedAsset,
                  onAssignAssetBackground: assignAssetBackground,
                  onAssignSelectedProcessedAsset: assignSelectedProcessedAsset,
                  onDeleteSelectedAsset: deleteSelectedAsset,
                  onOpenAiStudioForAssetUsage: openAiStudioForAssetUsage,
                  onPickCleanupColor: pickCleanupColor,
                  onRenderBackgroundCleanupPreview: renderBackgroundCleanupPreview,
                  onResetCropPath: resetCropPath,
                  onSaveBackgroundCleanupAsset: saveBackgroundCleanupAsset,
                  onSaveCroppedAsset: saveCroppedAsset,
                  onSaveGuideMaskAsset: saveGuideMaskAsset,
                  onSetCleanupFeather: setCleanupFeather,
                  onSetCleanupKeyColor: setCleanupKeyColor,
                  onSetCleanupSpillReduction: setCleanupSpillReduction,
                  onSetCleanupTolerance: setCleanupTolerance,
                  onSetGuideShape: setGuideShape,
                  onSetGuideSourceId: setGuideSourceId,
                  onSetOptimizeHeight: setOptimizeHeight,
                  onSetOptimizePresetId: setOptimizePresetId,
                  onSetOptimizeWidth: setOptimizeWidth,
                  onSetSelectedCropNodeIndex: setSelectedCropNodeIndex,
                  onSetSelectedGenerationTargetId: setSelectedGenerationTargetId,
                  onSetSelectedPromptPackId: setSelectedPromptPackId,
                  onUpdateAssetPathDraft: setAssetPathDraft,
                  onUpdateCropNodeMode: updateCropNodeMode,
                  onUpdateCropNodePosition: updateCropNodePosition
                }
              }}
            >
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
            </AssetStudioLaunchpad>
          ) : workspace === "flows" ? (
            <FlowsWorkspace
              flows={project.flows}
              gameplayLayout={gameplayGraphLayout}
              mode={flowWorkspaceMode}
              narrative={currentFlowDraft ? (
                <NarrativeGraph
                  diagnostics={flowGraphDiagnostics}
                  draft={currentFlowDraft}
                  selectedNodeId={selectedFlowNodeId ?? currentFlowDraft.startNodeId}
                  onChange={updateFlowDraft}
                  onSelectNode={setSelectedFlowNodeId}
                />
              ) : (
                <div className="workspace-placeholder compact">
                  <strong>Select a Flow to edit its Narrative graph.</strong>
                  <p>Choose a flow from the navigator, then switch between Gameplay and Narrative.</p>
                </div>
              )}
              onChangeGameplayLayout={(layout) => {
                setGameplayGraphLayout(layout);
                void projectController.applyCommand({
                  type: "project/update-gameplay-layout",
                  patch: { layout }
                }).then(setProject).catch((error) => reportEditorError(error, "Failed to save Gameplay layout"));
              }}
              onCreateTransition={async (draft: GameplayTransitionDraft) => {
                const flow = project.flows.find((candidate) => candidate.id === draft.flowId);
                const sourceScene = layeredScenes.find((scene) => scene.id === draft.sourceSceneId);
                if (!flow || !sourceScene) return;
                const endNode = flow.nodes.find((node) => node.type === "end") ?? {
                  id: `end-${flow.id}`,
                  type: "end"
                } satisfies FlowNode;
                const changeNodeId = `change-${draft.targetSceneId}`;
                const changeNode: FlowNode = {
                  id: changeNodeId,
                  next: endNode.id,
                  ...(sourceScene.playerStart ? { playerStart: sourceScene.playerStart } : {}),
                  targetSceneId: draft.targetSceneId,
                  type: "change-scene"
                };
                const nodes = [
                  ...flow.nodes.filter((node) => node.id !== changeNodeId && node.id !== endNode.id),
                  changeNode,
                  endNode
                ];
                const sceneEntryTriggers = [
                  ...(flow.sceneEntryTriggers ?? []).filter((trigger) => trigger.sceneId !== draft.sourceSceneId),
                  { flowId: flow.id, sceneId: draft.sourceSceneId }
                ];
                try {
                  const snapshot = await projectController.applyCommand({
                    type: "flow/update",
                    flowId: flow.id,
                    patch: {
                      editorLayout: flow.editorLayout,
                      name: flow.name,
                      nodes,
                      sceneEntryTriggers,
                      startNodeId: flow.startNodeId
                    }
                  });
                  setProject(snapshot);
                  setStatus(`Transition ${draft.verb} saved from ${draft.sourceSceneId} to ${draft.targetSceneId} via ${draft.entryPoint}.`);
                } catch (error) {
                  reportEditorError(error, "Failed to save guided transition");
                }
              }}
              onModeChange={setFlowWorkspaceMode}
              onOpenScene={(sceneId) => selectScene(sceneId)}
              onStartTransitionWizard={(sceneId) => {
                setFlowWorkspaceMode("gameplay");
                setStatus(`Guided transition wizard ready from ${sceneId}. Choose a Flow and destination in the Inspector.`);
              }}
              scenes={layeredScenes}
            />
          ) : workspace === "narrative" && currentFlowDraft ? (
            <NarrativeGraph
              diagnostics={flowGraphDiagnostics}
              draft={currentFlowDraft}
              selectedNodeId={selectedFlowNodeId ?? currentFlowDraft.startNodeId}
              onChange={updateFlowDraft}
              onSelectNode={setSelectedFlowNodeId}
            />
          ) : (
            <ScenesLaunchpad
              model={{
                viewport: {
                  activeImageGenerationContext,
                  activeSceneTool,
                  assetPathById,
                  assetPreviewUrls,
                  canEditViewportScene,
                  currentGenerationGuides,
                  imageAssets,
                  previewActorIssueMap,
                  previewActors,
                  previewHotspotIssueMap,
                  previewHotspots,
                  previewPickups,
                  previewPickupIssueMap,
                  previewPlayerAssetUrl,
                  previewPlayerStart,
                  previewSceneBackground,
                  previewSceneColor,
                  previewSceneBackgroundUrl,
                  previewSceneLayers,
                  previewSceneSize,
                  previewSelectedActor,
                  previewSelectedHotspot,
                  previewWalkArea,
                  previewWalkAreaPoints,
                  sceneBackgroundStyle: selectedScene
                    ? {
                        ...sceneBackgroundStyle(previewSceneBackground, previewSceneBackgroundUrl),
                        aspectRatio: `${previewSceneSize.width} / ${previewSceneSize.height}`,
                        zoom: sceneViewPreferences.zoom
                      }
                    : { background: "#24384a" },
                  sceneViewPreferences,
                  isPlayerInspectorSelected,
                  selectedActor,
                  selectedGenerationGuide,
                  selectedHotspot,
                  selectedPickup,
                  selectedScene: selectedScene?.type === "layered-2d" ? selectedScene : null,
                  selectedSceneLayerId,
                  selectedSceneToolHint,
                  selectedSceneToolLabel,
                  viewportRef,
                  workspace
                },
                workspace: {
                  activeTool: activeSceneTool,
                  selectedSceneId: selectedScene?.id ?? null
                }
              }}
              actions={{
                viewport: {
                  boundsForGenerationGuideShape,
                  generationGuideColor,
                  insertGenerationGuidePointFromEvent,
                  insertWalkAreaPointFromEvent,
                  onCreateActor: createActor,
                  onCreateHotspot: createHotspot,
                  onCreateSceneLayer: createSceneLayer,
                  onSelectActor: selectActor,
                  onSelectHotspot: selectHotspot,
                  onSelectPickup: selectPickup,
                  onSelectPlayerInScene: selectPlayerInScene,
                  onSetActiveSceneTool: setActiveSceneTool,
                  onSetSceneInspectorTarget: setSceneInspectorTarget,
                  onSetSelectedGenerationGuideId: setSelectedGenerationGuideId,
                  onStartActorInteraction: startActorInteraction,
                  onStartActorSpotInteraction: startActorSpotInteraction,
                  onStartGenerationGuidePointInteraction: startGenerationGuidePointInteraction,
                  onStartGenerationGuideShapeInteraction: startGenerationGuideShapeInteraction,
                  onStartHotspotInteraction: startHotspotInteraction,
                  onStartHotspotSpotInteraction: startHotspotSpotInteraction,
                  onStartPickupInteraction: startPickupInteraction,
                  onStartPlayerStartInteraction: startPlayerStartInteraction,
                  onStartWalkAreaPointInteraction: startWalkAreaPointInteraction,
                  updateSceneDraft
                }
              }}
            />
          )}

        </WorkspaceStagePanel>

        {navigationState.panelPreferences.inspectorOpen ? (
        <div className="workspace-panel-slot inspector-slot">
        <PanelResizeHandle
          label="Resize inspector panel"
          side="left"
          onPointerDown={(event) => beginPanelResize("inspector", event)}
          onResize={(delta) => resizePanelBy("inspector", delta)}
        />
        <InspectorPanel
          detail={inspectorDetailFor({
            hasSelectedFlow: !!selectedFlow,
            hasSelectedHotspot: !!selectedHotspot,
            hasSelectedItem: !!selectedItem,
            hasSelectedLocale: !!selectedLocale,
            hasSelectedPickup: !!selectedPickup,
            hasSelectedScene: !!selectedScene,
            isPlayerInspectorSelected,
            sceneSelectionTarget,
            workspace
          })}
          onClose={() => dispatchNavigation({ type: "panel/toggle", panel: "inspector" })}
        >
            {workspace === "scene" ? (
              <>
                <div className="inspector-tab-strip" role="tablist" aria-label="Scene inspector panels">
                  <button aria-selected={sceneInspectorTab === "inspector"} role="tab" type="button" onClick={() => setSceneInspectorTab("inspector")}>Inspector</button>
                  <button aria-selected={sceneInspectorTab === "layers"} role="tab" type="button" onClick={() => setSceneInspectorTab("layers")}>Livelli</button>
                </div>
                <div className="inspector-context-tabs" role="tablist" aria-label="Inspector sections">
                  {(["general", "transform", "interactions", "advanced"] as const).map((tab) => (
                    <button aria-selected={sceneInspectorView === tab} role="tab" key={tab} type="button" onClick={() => setSceneInspectorView(tab)}>
                      {tab === "general" ? "Generale" : tab === "transform" ? "Trasformazione" : tab === "interactions" ? "Interazioni" : "Avanzate"}
                    </button>
                  ))}
                </div>
                {sceneInspectorTab === "layers" && selectedScene ? (
                  <div className="scene-levels-panel" aria-label="Scene levels">
                    <div className="scene-levels-heading"><strong>Livelli</strong><span>{selectedScene.actors.length + selectedScene.pickups.length + selectedScene.hotspots.length} elementi</span></div>
                    <button className="scene-level-row" type="button" onClick={() => selectScene(selectedScene.id)}><span>◈</span><strong>Background</strong><small>Visible · unlocked</small></button>
                    {currentSceneDraft.layers.map((layer) => (
                      <button className="scene-level-row" key={`inspector-layer-${layer.id}`} type="button" onClick={() => { setSelectedSceneLayerId(layer.id); setSceneInspectorTab("inspector"); }}>
                        <span>{layer.visible ? "◈" : "○"}</span><strong>{layer.name || layer.id}</strong><small>{layer.locked ? "Locked" : "Unlocked"}</small>
                      </button>
                    ))}
                    <button className="scene-level-row" type="button" onClick={selectPlayerInScene}><span>♙</span><strong>Player</strong><small>Scene start</small></button>
                    {selectedScene.actors.map((actor) => (
                      <button className="scene-level-row" key={`inspector-actor-${actor.id}`} type="button" onClick={() => { selectActor(actor); setSceneInspectorTab("inspector"); }}><span>♟</span><strong>{actor.id}</strong><small>{actor.role}</small></button>
                    ))}
                    {selectedScene.pickups.map((pickup) => (
                      <button className="scene-level-row" key={`inspector-pickup-${pickup.id}`} type="button" onClick={() => { selectPickup(pickup); setSceneInspectorTab("inspector"); }}><span>◆</span><strong>{pickup.id}</strong><small>Pickup</small></button>
                    ))}
                    {selectedScene.hotspots.map((hotspot) => (
                      <button className="scene-level-row" key={`inspector-hotspot-${hotspot.id}`} type="button" onClick={() => { selectHotspot(hotspot); setSceneInspectorTab("inspector"); }}><span>⌁</span><strong>{hotspot.id}</strong><small>{hotspot.shape?.type ?? "rect"} collider</small></button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
            {workspace === "scene" ? (
              <div className="scene-selection-summary">
                <span className="overview-label">Scene selection</span>
                <strong>{sceneSelection.title}</strong>
                <p>{sceneSelection.detail}</p>
                {sceneSelectionTarget ? (
                  <span className="scene-selection-pill">{sceneSelectionKindLabel(sceneSelectionTarget.kind)}</span>
                ) : null}
              </div>
            ) : null}
            {workspace === "overview" ? (
              <>
                <div className="flow-link">
                  <span>Current workspace</span>
                  <strong>{workspaceCapability.label}</strong>
                  <p className="inspector-copy">{workspaceCapability.detail}</p>
                </div>
                <div className="flow-link">
                  <span>Project diagnostics</span>
                  <strong>{projectSummary?.diagnosticCount ?? 0} total</strong>
                  <p className="inspector-copy">
                    {projectSummary?.errorCount ?? 0} error(s), {projectSummary?.warningCount ?? 0} warning(s)
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
                <div className="flow-link">
                  <span>Project history</span>
                  <strong>{project?.historyRecordCount ?? 0} committed change record(s)</strong>
                  <p className="inspector-copy">
                    {(project?.historyRecords ?? []).slice(0, 3).map((record) => `${record.scope}: ${record.summary}`).join(" · ") ||
                      "No authoring history has been recorded yet."}
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
                    <button
                      type="button"
                      onClick={() =>
                        selectedScene
                          ? openContextualGenerationModal(
                              selectedScene,
                              { kind: "player" },
                              "Create a full-body playable character sprite reference with clear silhouette, visible feet, neutral pose, and game-ready proportions.",
                              "chroma-blue"
                            )
                          : undefined
                      }
                    >
                      Generate player
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
                <div className="flow-link">
                  <span>Scene triggers</span>
                  <strong>
                    {selectedFlowReferences.length
                      ? `${selectedFlowReferences.length} linked trigger(s)`
                      : "No scene trigger"}
                  </strong>
                  <p className="inspector-copy">
                    {selectedFlowReferences.length
                      ? "Open the scene entity that invokes this flow."
                      : "This flow is global or not yet linked from a scene entity."}
                  </p>
                  {selectedFlowReferences.length ? (
                    <div className="inspector-actions-inline">
                      {selectedFlowReferences.map((reference, index) => (
                        <button
                          key={`flow-reference-source-${reference.sceneId}-${reference.entityKind}-${reference.entityId}-${reference.action}-${index}`}
                          type="button"
                          onClick={() => openNarrativeReferenceSource(reference)}
                        >
                          {reference.entityKind} {reference.entityId} / {reference.action}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
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
                {flowGraph ? (
                  <section className="flow-graph-panel" aria-label="Flow graph overview">
                    <div className="flow-graph-header">
                      <div>
                        <span className="overview-label">Flow graph</span>
                        <strong>{flowGraph.nodes.length} nodes / {flowGraph.edges.length} edges</strong>
                      </div>
                      <span className="capability-badge compact good">Deterministic IR</span>
                    </div>
                    {flowGraphDiagnostics.length ? (
                      <ul className="flow-graph-diagnostics" aria-label="Flow graph diagnostics">
                        {flowGraphDiagnostics.map((diagnostic, index) => (
                          <li key={`graph-diagnostic-${diagnostic.code}-${diagnostic.nodeId ?? index}`}>
                            <strong>{diagnostic.severity}</strong> {diagnostic.message}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="inspector-copy">No graph validation issues.</p>
                    )}
                  </section>
                ) : null}
                <div className="flow-nodes">
                  {currentFlowDraft.nodes
                    .map((node, index) => ({ index, node }))
                    .filter(({ node }) => node.id === (selectedFlowNodeId ?? currentFlowDraft.startNodeId))
                    .map(({ index, node }) => (
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
                          {(() => {
                            const textKey = node.textKey.trim();
                            const localeValue =
                              textKey && defaultLocaleStrings ? defaultLocaleStrings[textKey] : undefined;
                            const localeMissing = !!textKey && !!defaultLocaleStrings && localeValue === undefined;
                            return (
                              <div className={`flow-line-locale ${localeMissing ? "missing" : "ready"}`}>
                                <div className="flow-line-locale-header">
                                  <span className={`capability-badge compact ${localeMissing ? "warn" : "good"}`}>
                                    {localeMissing ? "Missing text" : "Localized"}
                                  </span>
                                  <strong>{defaultLocaleId}</strong>
                                </div>
                                <p>
                                  {localeValue ??
                                    (textKey
                                      ? "No text exists for this key yet."
                                      : "Add a text key to connect this line to locale text.")}
                                </p>
                                <div className="inspector-actions-inline">
                                  <button
                                    type="button"
                                    disabled={!textKey || !defaultLocaleDocument}
                                    onClick={() => openFlowTextLocaleKey(textKey)}
                                  >
                                    Open locale key
                                  </button>
                                  {localeMissing ? (
                                    <button
                                      type="button"
                                      disabled={!defaultLocaleDocument}
                                      onClick={() => createFlowTextLocaleKey(node)}
                                    >
                                      Create draft text
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })()}
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
                      <FlowNodeFields
                        audioAssets={(project?.assets ?? [])
                          .filter((asset) => asset.kind === "audio")
                          .map((asset) => ({ id: asset.id, label: asset.id }))}
                        flows={(project?.flows ?? []).map((flow) => ({ id: flow.id, label: flow.name }))}
                        items={(project?.items ?? []).map((item) => ({ id: item.id, label: item.name }))}
                        node={node}
                        nodeIds={flowNodeIds}
                        onChange={(nextNode) => updateFlowNode(index, () => nextNode)}
                      />
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
                    <button type="button" onClick={() => addFlowNode("choice")}>Add choice</button>
                    <button type="button" onClick={() => addFlowNode("condition")}>Add condition</button>
                    <button type="button" onClick={() => addFlowNode("sub-flow")}>Add sub-flow</button>
                    <button type="button" onClick={() => addFlowNode("inventory")}>Add inventory</button>
                    <button type="button" onClick={() => addFlowNode("wait")}>Add wait</button>
                    <button type="button" onClick={() => addFlowNode("cue")}>Add cue</button>
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
                    <button
                      type="button"
                      onClick={() =>
                        selectedScene
                          ? openContextualGenerationModal(
                              selectedScene,
                              { entityId: selectedActor.id, kind: "actor" },
                              `Create a game-ready actor asset for ${selectedActor.id}. Keep the silhouette readable and the full subject visible.`,
                              "chroma-blue"
                            )
                          : undefined
                      }
                    >
                      Generate asset
                    </button>
                    {selectedActor.role === "npc" ? (
                      <button
                        type="button"
                        onClick={() =>
                          selectedScene
                            ? openContextualGenerationModal(
                                selectedScene,
                                { entityId: selectedActor.id, kind: "actor" },
                                `Create a clean sprite sheet reference for NPC ${selectedActor.id}, with idle, walk, and talk poses in a consistent grid.`,
                                "chroma-blue"
                              )
                            : undefined
                        }
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
                    <button
                      type="button"
                      onClick={() =>
                        selectedScene
                          ? openContextualGenerationModal(
                              selectedScene,
                              { entityId: selectedHotspot.id, kind: "hotspot" },
                              `Create a readable interactive hotspot visual for ${selectedHotspot.id}. Make the affordance clear without UI text.`,
                              "chroma-blue"
                            )
                          : undefined
                      }
                    >
                      Generate hotspot art
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
                    <button
                      type="button"
                      onClick={() =>
                        selectedScene
                          ? openContextualGenerationModal(
                              selectedScene,
                              { entityId: selectedPickup.id, kind: "pickup" },
                              `Create a single isolated prop for pickup ${selectedPickup.id}. Keep the full object visible with clean margins for game use.`,
                              "chroma-blue"
                            )
                          : undefined
                      }
                    >
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
            ) : selectedScene && selectedSceneLayer ? (
              <>
                <div className="context-setup-card">
                  <span className={`capability-badge ${selectedSceneLayer.locked ? "warn" : "good"}`}>Layer</span>
                  <strong>{selectedSceneLayer.name || selectedSceneLayer.id}</strong>
                  <p>
                    Scene layers are local to {selectedScene.name}. Use visibility, depth, opacity, and bounds to
                    compose foregrounds, overlays, fog, and parallax-ready art.
                  </p>
                  <div className="context-action-row">
                    <button type="button" onClick={() => setSelectedSceneLayerId(null)}>
                      Back to scene
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openContextualGenerationModal(
                          selectedScene,
                          { entityId: selectedSceneLayer.id, kind: "layer" },
                          `Create a scene layer asset for ${selectedSceneLayer.name || selectedSceneLayer.id}. Match the scene perspective and leave composition-ready edges.`,
                          "opaque-scene"
                        )
                      }
                    >
                      Generate layer
                    </button>
                    <button type="button" onClick={createSceneLayer} disabled={imageAssets.length === 0}>
                      Add layer
                    </button>
                  </div>
                </div>
                <label>
                  Layer id
                  <input
                    value={selectedSceneLayer.id}
                    onChange={(event) => updateSceneLayerDraft(selectedSceneLayer.id, "id", event.target.value)}
                  />
                </label>
                <label>
                  Name
                  <input
                    value={selectedSceneLayer.name}
                    onChange={(event) => updateSceneLayerDraft(selectedSceneLayer.id, "name", event.target.value)}
                  />
                </label>
                <label>
                  Asset
                  <select
                    className={
                      selectedSceneLayer.assetId.trim() && !availableAssetIdsSet.has(selectedSceneLayer.assetId.trim())
                        ? "field-input-invalid"
                        : ""
                    }
                    value={selectedSceneLayer.assetId}
                    onChange={(event) => updateSceneLayerDraft(selectedSceneLayer.id, "assetId", event.target.value)}
                  >
                    <option value="">Select asset</option>
                    {imageAssets.map((asset) => (
                      <option key={`focused-layer-asset-${asset.id}`} value={asset.id}>
                        {asset.id}
                      </option>
                    ))}
                  </select>
                  {selectedSceneLayer.assetId.trim() && !availableAssetIdsSet.has(selectedSceneLayer.assetId.trim()) ? (
                    <small className="field-hint error">Layer asset no longer exists.</small>
                  ) : null}
                </label>
                <div className="field-group">
                  <span>Composition</span>
                  <div className="four-fields">
                    <input
                      aria-label="Layer depth"
                      value={selectedSceneLayer.depth}
                      onChange={(event) => updateSceneLayerDraft(selectedSceneLayer.id, "depth", event.target.value)}
                    />
                    <input
                      aria-label="Layer opacity"
                      value={selectedSceneLayer.opacity}
                      onChange={(event) => updateSceneLayerDraft(selectedSceneLayer.id, "opacity", event.target.value)}
                    />
                  </div>
                  <div className="four-fields">
                    <input
                      aria-label="Layer X"
                      value={selectedSceneLayer.x}
                      onChange={(event) => updateSceneLayerDraft(selectedSceneLayer.id, "x", event.target.value)}
                    />
                    <input
                      aria-label="Layer Y"
                      value={selectedSceneLayer.y}
                      onChange={(event) => updateSceneLayerDraft(selectedSceneLayer.id, "y", event.target.value)}
                    />
                    <input
                      aria-label="Layer width"
                      value={selectedSceneLayer.width}
                      onChange={(event) => updateSceneLayerDraft(selectedSceneLayer.id, "width", event.target.value)}
                    />
                    <input
                      aria-label="Layer height"
                      value={selectedSceneLayer.height}
                      onChange={(event) => updateSceneLayerDraft(selectedSceneLayer.id, "height", event.target.value)}
                    />
                  </div>
                </div>
                <div className="flow-link">
                  <span>Layer state</span>
                  <div className="layer-action-row">
                    <label className="inline-toggle">
                      <input
                        checked={selectedSceneLayer.visible}
                        type="checkbox"
                        onChange={(event) =>
                          updateSceneLayerDraft(selectedSceneLayer.id, "visible", event.target.checked)
                        }
                      />
                      Visible
                    </label>
                    <label className="inline-toggle">
                      <input
                        checked={selectedSceneLayer.locked}
                        type="checkbox"
                        onChange={(event) =>
                          updateSceneLayerDraft(selectedSceneLayer.id, "locked", event.target.checked)
                        }
                      />
                      Locked
                    </label>
                  </div>
                  <strong>
                    {selectedSceneLayer.visible ? "Visible" : "Hidden"}
                    {selectedScene && dirtyState.sceneIds.has(selectedScene.id) ? " - unsaved draft" : ""}
                  </strong>
                  <button
                    className="danger"
                    type="button"
                    disabled={selectedSceneLayer.locked}
                    onClick={() => deleteSceneLayerDraft(selectedSceneLayer.id)}
                  >
                    Delete layer
                  </button>
                  <button type="button" onClick={applySceneChanges}>
                    Apply scene changes -&gt;
                  </button>
                </div>
              </>
            ) : selectedScene && selectedGenerationGuideId && selectedGenerationGuide ? (
              <>
                <div className="context-setup-card">
                  <span className={`capability-badge ${selectedGenerationGuide.locked ? "warn" : "good"}`}>
                    Guide
                  </span>
                  <strong>{selectedGenerationGuide.name}</strong>
                  <p>
                    Generation guides are scene-local targets for AI context, masks, references, and review. Keep
                    them visible while drafting and lock them when they are approved.
                  </p>
                  <div className="context-action-row">
                    <button type="button" onClick={() => setSelectedGenerationGuideId(null)}>
                      Back to scene
                    </button>
                    <button type="button" onClick={() => createBlankGenerationGuide("rect")}>
                      Add guide
                    </button>
                  </div>
                </div>
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
                        <option key={`focused-generation-guide-role-${role}`} value={role}>
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
                          <div className="four-fields" key={`focused-generation-guide-point-${index}`}>
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
                          key={`focused-generation-guide-bounds-${field}`}
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
                <div className="flow-link">
                  <span>Guide state</span>
                  <div className="layer-action-row">
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
                  <strong>
                    {generationGuideShapeLabel(selectedGenerationGuide.shape)}
                    {selectedScene && dirtyState.sceneIds.has(selectedScene.id) ? " - unsaved draft" : ""}
                  </strong>
                  <button
                    className="danger"
                    type="button"
                    disabled={selectedGenerationGuide.locked}
                    onClick={deleteSelectedGenerationGuide}
                  >
                    Delete guide
                  </button>
                  <button type="button" onClick={applySceneChanges}>
                    Apply scene changes -&gt;
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
                <div className="context-action-row">
                  <button
                    type="button"
                    onClick={() =>
                      openContextualGenerationModal(
                        selectedScene,
                        { kind: "scene-background" },
                        `Create a playable 2D point-and-click background for ${selectedScene.name}. Preserve clear walkable space, readable exits, and room for hotspots.`,
                        "opaque-scene"
                      )
                    }
                  >
                    Generate background
                  </button>
                </div>
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
        ) : (
          <CollapsedPanelRail
            label="Inspector"
            side="right"
            onOpen={() => dispatchNavigation({ type: "panel/toggle", panel: "inspector" })}
          />
        )}
      </div>
      {(() => {
        const compactWorkspace = workspace === "assets" || workspace === "ai" || workspace === "build";
        return (
        <ResourceDock
          assets={project.assets}
          height={resourceDockPreferences.height}
          isOpen={resourceDockPreferences.isOpen && (!compactWorkspace || resourceDockWorkspaceOpen === workspace)}
          onClose={() => { setResourceDockWorkspaceOpen(null); setResourceDockPreferences((current) => ({ ...current, isOpen: false })); }}
          onOpen={() => setResourceDockWorkspaceOpen(workspace)}
          onHeightChange={(height) => { setResourceDockWorkspaceOpen(workspace); setResourceDockPreferences((current) => ({ ...current, height: Math.min(360, Math.max(150, height)), isOpen: true })); }}
          onOpenAssets={() => setWorkspace("assets")}
          onQueryChange={(query) => setResourceDockPreferences((current) => ({ ...current, query }))}
          onSelectAsset={(assetId) => { setSelectedAssetId(assetId); setWorkspace("assets"); }}
          onViewModeChange={(viewMode) => setResourceDockPreferences((current) => ({ ...current, viewMode }))}
          previewUrls={assetPreviewUrls}
          query={resourceDockPreferences.query}
          selectedAssetId={selectedAssetId}
          viewMode={resourceDockPreferences.viewMode}
        />
        );
      })()}
      </>
      )}
      {promptProviderConfigOpen ? (
        <PromptProviderConfigDialog
          provider={promptProviderId}
          values={{
            lmStudioApiKey,
            lmStudioBaseUrl,
            lmStudioModel,
            openAiApiKey,
            openAiBaseUrl,
            openAiModel,
            remoteProviderConsent
          }}
          onApply={applyPromptProviderConfig}
          onCancel={closePromptProviderConfig}
        />
      ) : null}
      {imageProviderConfigOpen ? (
        <ImageProviderConfigDialog
          provider={imageProviderId}
          values={{
            comfyUiBaseUrl,
            comfyUiCheckpoint,
            comfyUiSeed,
            comfyUiTimeoutMinutes,
            comfyUiWorkflowPath,
            googleImageAccessToken,
            googleImageApiKey,
            googleImageBaseUrl,
            googleImageLocation,
            googleImageModel,
            googleImageProjectId,
            googleImageProvider,
            openAiImageApiKey,
            openAiImageBaseUrl,
            openAiImageMode,
            openAiImageModel,
            remoteProviderConsent
          }}
          onApply={applyImageProviderConfig}
          onCancel={closeImageProviderConfig}
        />
      ) : null}
      {contextualGenerationModalOpen && freePromptTarget && promptPackScene ? (
        <div className="contextual-generation-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="contextual-generation-modal"
            role="dialog"
            aria-labelledby="contextual-generation-title"
          >
            <div className="contextual-generation-header">
              <div>
                <span className="overview-label">Contextual Generate</span>
                <strong id="contextual-generation-title">
                  {freePromptLabel(freePromptTarget, promptPackScene)}
                </strong>
                <p>{freePromptTarget.kind} / {freePromptTarget.sceneId}</p>
              </div>
              <button
                className="icon-action"
                type="button"
                aria-label="Close contextual generation"
                onClick={() => setContextualGenerationModalOpen(false)}
              >
                <X size={iconSize} />
              </button>
            </div>
            <div className="contextual-generation-body">
              <div className="prompt-studio-field provider-selector-field">
                <span>Provider</span>
                <div className="provider-selector-row">
                  <select
                    aria-label="Contextual image provider"
                    value={imageProviderId}
                    onChange={(event) => setImageProviderId(event.target.value as ImageGenerationProviderId)}
                  >
                    {imageProviderOptions.map((provider) => (
                      <option key={`context-image-provider-${provider.value}`} value={provider.value}>
                        {provider.label}
                      </option>
                    ))}
                  </select>
                  <button
                    ref={(element) => {
                      imageProviderConfigReturnFocusRef.current = element;
                    }}
                    aria-label="Configure image provider"
                    className="icon-action provider-settings-button"
                    title="Configure image provider"
                    type="button"
                    onClick={(event) => openImageProviderConfig(event.currentTarget)}
                  >
                    <Settings2 size={iconSize} />
                  </button>
                </div>
              </div>
              <label className="prompt-studio-field">
                Art style
                <select
                  value={freePromptStylePresetId}
                  onChange={(event) => setFreePromptStylePresetId(event.target.value)}
                >
                  {visualStylePresets.map((preset) => (
                    <option key={`context-style-${preset.id}`} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="prompt-studio-field">
                Output
                <select
                  value={freePromptOutputPreset}
                  onChange={(event) => setFreePromptOutputPreset(event.target.value as TargetBackgroundMode)}
                >
                  {freePromptOutputPresets.map((preset) => (
                    <option key={`context-output-${preset.value}`} value={preset.value}>
                      {preset.label}
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
              <label className="prompt-studio-field span-2">
                Extra style
                <input
                  placeholder="Optional art direction for this generated piece"
                  value={freePromptCustomStyle}
                  onChange={(event) => setFreePromptCustomStyle(event.target.value)}
                />
              </label>
              <label className="prompt-studio-field span-2">
                Prompt
                <textarea
                  value={freePromptText}
                  onChange={(event) => setFreePromptText(event.target.value)}
                />
              </label>
              <label className="prompt-studio-field span-2">
                Negative prompt
                <textarea
                  value={freePromptNegative}
                  onChange={(event) => setFreePromptNegative(event.target.value)}
                />
              </label>
            </div>
            <div className="contextual-generation-contract">
              <span className={`target-mode-pill ${selectedImageTargetWorkflowTone}`}>
                {selectedImageTargetWorkflow.label}
              </span>
              <span className="prompt-chip">{selectedImageWorkflowFamily}</span>
              <span className="prompt-chip">
                {selectedGenerationDimensions.width} x {selectedGenerationDimensions.height}
              </span>
              {selectedImageInputWorkflowWarning ? (
                <p className="target-customization-note">{selectedImageInputWorkflowWarning}</p>
              ) : (
                <p className="target-customization-note">
                  {freePromptOutputPresets.find((preset) => preset.value === freePromptOutputPreset)?.detail}
                </p>
              )}
            </div>
            {lastGeneratedImageAsset && lastGeneratedImageAsset.targetId === selectedEffectiveGenerationTarget?.id ? (
              <div className="contextual-generation-result">
                <div>
                  <span className="overview-label">Generated</span>
                  <strong>{lastGeneratedImageAsset.assetId}</strong>
                  <p>{lastGeneratedImageAsset.hasAlphaPixels ? "Alpha pixels detected" : "Opaque bitmap"}</p>
                </div>
                <div className="generation-handoff-actions">
                  <button className="secondary-action compact-action" type="button" onClick={openGeneratedAsset}>
                    Open Asset
                  </button>
                  {lastGeneratedImageAsset.entityKind === "scene-background" ? (
                    <button className="secondary-action compact-action" type="button" onClick={assignGeneratedAssetToBackgroundDraft}>
                      Set Background
                    </button>
                  ) : null}
                  {lastGeneratedImageAsset.entityKind === "layer" ? (
                    <button className="secondary-action compact-action" type="button" onClick={assignGeneratedAssetToLayerDraft}>
                      Assign Layer
                    </button>
                  ) : null}
                  {lastGeneratedImageAsset.entityKind === "player" ? (
                    <button className="secondary-action compact-action" type="button" onClick={assignGeneratedAssetToPlayerDraft}>
                      Assign Player
                    </button>
                  ) : null}
                  {lastGeneratedImageAsset.entityKind === "actor" ? (
                    <button className="secondary-action compact-action" type="button" onClick={assignGeneratedAssetToActorDraft}>
                      Assign Actor
                    </button>
                  ) : null}
                  {lastGeneratedImageAsset.entityKind === "pickup" ? (
                    <button className="secondary-action compact-action" type="button" onClick={assignGeneratedAssetToPickupDraft}>
                      Assign Pickup
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="contextual-generation-footer">
              <p>{comfyUiGenerationStatus}</p>
              <div>
                <button className="secondary-action compact-action" type="button" onClick={openAdvancedAiForContextualGeneration}>
                  Advanced
                </button>
                <button
                  className="play-action compact-action"
                  disabled={!activeImagePromptPack || !selectedEffectiveGenerationTarget || imageGenerationState === "running"}
                  type="button"
                  onClick={generateImageAsset}
                >
                  {imageGenerationState === "running" ? "Generating..." : "Generate"}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
