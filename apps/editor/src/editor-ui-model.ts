import type {
  AssetDocument,
  Hotspot,
  Layered2DScene,
  PromptPackDocument,
  PromptPackGenerationTarget,
  SceneActor,
  SceneGenerationGuide,
  ScenePickup
} from "@pointclick/contracts";
import {
  hexColorPattern,
  parseNumber,
  sceneItems,
  type SceneLayerDraft,
  type SceneSelectionTarget,
  type Workspace
} from "./editor-session";
import type { EditorProjectSnapshot } from "./preload";
import type { EditorValidationReport } from "./validation-report";

export function sceneFromSnapshot(snapshot: EditorProjectSnapshot | null, sceneId: string | null) {
  if (!snapshot || !sceneId) return null;
  return sceneItems(snapshot.scenes).find((scene) => scene.id === sceneId) ?? null;
}

export function hotspotFromSnapshot(
  snapshot: EditorProjectSnapshot | null,
  sceneId: string | null,
  hotspotId: string | null
) {
  const scene = sceneFromSnapshot(snapshot, sceneId);
  if (!scene || !hotspotId) return null;
  return scene.hotspots.find((hotspot) => hotspot.id === hotspotId) ?? null;
}

export function localeFromSnapshot(snapshot: EditorProjectSnapshot | null, localeId: string | null) {
  if (!snapshot || !localeId) return null;
  return snapshot.locales.find((locale) => locale.locale === localeId) ?? null;
}

export function flowFromSnapshot(snapshot: EditorProjectSnapshot | null, flowId: string | null) {
  if (!snapshot || !flowId) return null;
  return snapshot.flows.find((flow) => flow.id === flowId) ?? null;
}

export function itemFromSnapshot(snapshot: EditorProjectSnapshot | null, itemId: string | null) {
  if (!snapshot || !itemId) return null;
  return snapshot.items.find((item) => item.id === itemId) ?? null;
}

export function pickupFromSnapshot(
  snapshot: EditorProjectSnapshot | null,
  sceneId: string | null,
  pickupId: string | null
) {
  const scene = sceneFromSnapshot(snapshot, sceneId);
  if (!scene || !pickupId) return null;
  return scene.pickups.find((pickup) => pickup.id === pickupId) ?? null;
}

export function assetFromSnapshot(snapshot: EditorProjectSnapshot | null, assetId: string | null) {
  if (!snapshot || !assetId) return null;
  return snapshot.assets.find((asset) => asset.id === assetId) ?? null;
}

export function isHexColor(value: string): boolean {
  return hexColorPattern.test(value);
}

export function sceneBackgroundStyle(background: string, assetUrl?: string) {
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

type AssetUsageReference = {
  detail: string;
  entityId?: string;
  sceneId?: string;
  sceneName?: string;
  type: string;
};

export function assetUsage(asset: AssetDocument, snapshot: EditorProjectSnapshot | null) {
  if (!snapshot) return [] as AssetUsageReference[];
  const usage: AssetUsageReference[] = [];
  for (const scene of sceneItems(snapshot.scenes)) {
    if (scene.background === asset.path) {
      usage.push({ detail: "Scene background", sceneId: scene.id, sceneName: scene.name, type: "scene" });
    }
    if (scene.player?.assetId === asset.id) {
      usage.push({ detail: "Player asset", entityId: "player", sceneId: scene.id, sceneName: scene.name, type: "player" });
    }
    for (const actor of scene.actors) {
      if (actor.assetId === asset.id) {
        usage.push({ detail: `Actor ${actor.id}`, entityId: actor.id, sceneId: scene.id, sceneName: scene.name, type: "actor" });
      }
    }
    for (const pickup of scene.pickups) {
      if (pickup.assetId === asset.id) {
        usage.push({ detail: `Pickup ${pickup.id}`, entityId: pickup.id, sceneId: scene.id, sceneName: scene.name, type: "pickup" });
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

export function assetHealth(asset: AssetDocument, snapshot: EditorProjectSnapshot | null) {
  if (!snapshot) return "available";
  return snapshot.diagnostics.some(
    (diagnostic) => diagnostic.code === "asset.file-missing" && diagnostic.documentId === asset.id
  )
    ? "missing"
    : "available";
}

export function promptPackTargetLookup(
  snapshot: EditorProjectSnapshot | null,
  sceneId: string,
  targetId: string
): { promptPack: PromptPackDocument; target: PromptPackGenerationTarget } | null {
  if (!snapshot) return null;
  for (const promptPack of snapshot.promptPacks) {
    if (promptPack.sceneId !== sceneId) continue;
    const target = promptPack.outputs.generationTargets.find((entry) => entry.id === targetId);
    if (target) return { promptPack, target };
  }
  return null;
}

export function fallbackFlowLineText(flowId: string, nodeId: string, textKey: string) {
  const keyLabel = textKey.trim() || `${flowId}.${nodeId}`;
  return `Draft text for ${keyLabel}`;
}

export function parseWalkAreaDraft(
  walkAreaPoints: Array<{ x: string; y: string }>
): { points: Array<{ x: number; y: number }> } | null {
  const points = walkAreaPoints.map((point) => {
    const x = parseNumber(point.x);
    const y = parseNumber(point.y);
    return x === null || y === null ? null : { x, y };
  });

  if (points.some((point) => point === null)) return null;
  return { points: points as Array<{ x: number; y: number }> };
}

export function healthSummary(
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

export function formatValidationTimestamp(timestamp: string | null): string {
  if (!timestamp) return "Not run yet";
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) return timestamp;
  return value.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

export function validationTone(report: EditorValidationReport | null): "good" | "warn" | "error" | "muted" {
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
  sceneSelectionTarget: SceneSelectionTarget | null;
  workspace: Workspace;
}

export function inspectorDetailFor({
  hasSelectedFlow,
  hasSelectedHotspot,
  hasSelectedItem,
  hasSelectedLocale,
  hasSelectedPickup,
  hasSelectedScene,
  isPlayerInspectorSelected,
  sceneSelectionTarget,
  workspace
}: InspectorDetailState): string {
  if (workspace === "overview") return "Project";
  if (workspace === "assets") return "Library";
  if (workspace === "ai") return "AI";
  if (workspace === "build") return "Validation";
  if (workspace === "scene" && sceneSelectionTarget) return sceneSelectionKindLabel(sceneSelectionTarget.kind);
  if (hasSelectedFlow) return "Flow";
  if (hasSelectedLocale) return "Locale";
  if (isPlayerInspectorSelected) return "Player";
  if (hasSelectedHotspot) return "Hotspot";
  if (hasSelectedPickup) return "Pickup";
  if (hasSelectedItem) return "Item";
  if (hasSelectedScene) return "Scene";
  return "";
}

export function sceneSelectionKindLabel(kind: SceneSelectionTarget["kind"]): string {
  switch (kind) {
    case "scene": return "Scene";
    case "background": return "Background";
    case "layer": return "Layer";
    case "walk-area": return "Walk Area";
    case "player-start": return "Player";
    case "actor": return "Actor";
    case "pickup": return "Pickup";
    case "hotspot": return "Hotspot";
    case "guide": return "Guide";
  }
}

export function sceneSelectionSummary({
  selectedActor,
  selectedGenerationGuide,
  selectedHotspot,
  selectedPickup,
  selectedScene,
  selectedSceneLayer,
  target
}: {
  selectedActor: SceneActor | null;
  selectedGenerationGuide: SceneGenerationGuide | null;
  selectedHotspot: Hotspot | null;
  selectedPickup: ScenePickup | null;
  selectedScene: Layered2DScene | null;
  selectedSceneLayer: SceneLayerDraft | null;
  target: SceneSelectionTarget | null;
}) {
  if (!target || !selectedScene) {
    return { detail: "Open a scene to select scene-local objects.", title: "No scene selection" };
  }

  const label = sceneSelectionKindLabel(target.kind);
  if (target.kind === "scene") return { detail: selectedScene.id, title: selectedScene.name };
  if (target.kind === "walk-area") return { detail: selectedScene.id, title: "Walk area polygon" };
  if (target.kind === "player-start") return { detail: selectedScene.id, title: "Player start and movement" };
  if (target.kind === "layer") return { detail: target.entityId ?? "layer", title: selectedSceneLayer?.name || target.entityId || label };
  if (target.kind === "guide") return { detail: target.entityId ?? "guide", title: selectedGenerationGuide?.name || target.entityId || label };
  if (target.kind === "actor") return { detail: target.entityId ?? "actor", title: selectedActor?.labelKey || target.entityId || label };
  if (target.kind === "pickup") return { detail: target.entityId ?? "pickup", title: selectedPickup?.labelKey || target.entityId || label };
  if (target.kind === "hotspot") return { detail: target.entityId ?? "hotspot", title: selectedHotspot?.labelKey || target.entityId || label };
  return { detail: selectedScene.id, title: label };
}

interface ProviderBoundaryStatus {
  detail: string;
  label: string;
  tone: "good" | "warn" | "error" | "muted";
}

export function providerBoundaryStatus(
  providerId: string,
  baseUrl: string,
  defaultBaseUrl: string,
  remoteProviderConsent = false
): ProviderBoundaryStatus {
  if (providerId === "mock") {
    return { detail: "Offline deterministic output. No network request is made.", label: "Offline", tone: "good" };
  }

  const configuredUrl = baseUrl.trim() || defaultBaseUrl;
  try {
    const endpoint = new URL(configuredUrl);
    const hostname = endpoint.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const isLoopback = hostname === "localhost" || hostname === "::1" || /^127(?:\.\d{1,3}){3}$/.test(hostname);
    if (isLoopback) return { detail: `Local endpoint ${endpoint.origin}.`, label: "Local", tone: "good" };
    return {
      detail: remoteProviderConsent
        ? `Remote endpoint ${endpoint.origin}. Consent is enabled for this session.`
        : `Remote endpoint ${endpoint.origin}. Explicit consent is required before sending project context.`,
      label: remoteProviderConsent ? "Remote · allowed" : "Remote · consent",
      tone: remoteProviderConsent ? "good" : "warn"
    };
  } catch {
    return { detail: "The endpoint must be an absolute HTTP(S) URL.", label: "Check URL", tone: "error" };
  }
}
