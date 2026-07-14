import type {
  AnimationPackDocument,
  FlowDocument,
  Hotspot,
  Layered2DScene,
  LocaleDocument,
  SceneActor,
  SceneLayer,
  ScenePickup
} from "@pointclick/contracts";
import type { EditorProjectSnapshot } from "./preload";
import {
  parseNumber,
  parsePositiveNumber,
  type SceneLayerDraft,
  type ScenePointDraftValue
} from "./editor-session";

/** Stable authoring IDs used by the create-document commands in the editor. */
export function nextAnimationPackId(snapshot: EditorProjectSnapshot | null): string {
  return nextAvailableId(snapshot?.animationPacks.map((animationPack) => animationPack.id) ?? [], "new-animation-pack");
}

export function nextFlowId(snapshot: EditorProjectSnapshot): string {
  return nextAvailableId(snapshot.flows.map((flow) => flow.id), "new-flow");
}

export function createDefaultFlowDocument(flowId: string): FlowDocument {
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

export function nextItemId(snapshot: EditorProjectSnapshot): string {
  return nextAvailableId(snapshot.items.map((item) => item.id), "new-item");
}

export function nextSceneId(snapshot: EditorProjectSnapshot): string {
  return nextAvailableId(snapshot.scenes.map((scene) => scene.id), "new-scene");
}

export function createDefaultSceneDocument(snapshot: EditorProjectSnapshot, sceneId: string): Layered2DScene {
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

export function nextHotspotId(scene: Layered2DScene): string {
  return nextAvailableId(scene.hotspots.map((hotspot) => hotspot.id), "new-hotspot");
}

export function nextPickupId(scene: Layered2DScene): string {
  return nextAvailableId(scene.pickups.map((pickup) => pickup.id), "new-pickup");
}

export function nextActorId(scene: Layered2DScene): string {
  return nextAvailableId(scene.actors.map((actor) => actor.id), "new-actor");
}

export function createDefaultHotspot(scene: Layered2DScene, hotspotId: string): Hotspot {
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

export function createDefaultPickup(scene: Layered2DScene, pickupId: string, itemId: string): ScenePickup {
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

export function createDefaultActor(scene: Layered2DScene, actorId: string): SceneActor {
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

export interface AuthoringGuardrail {
  badge: "blocking" | "ready" | "review";
  blockingIssues: string[];
  detail: string;
  summary: string;
  tone: "error" | "good" | "warn";
  warningIssues: string[];
}

export function buildGuardrail(
  blockingIssues: string[],
  warningIssues: string[],
  readySummary: string,
  readyDetail: string
): AuthoringGuardrail {
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
      blockingIssues.length > 0 ? "error" : warningIssues.length > 0 ? "warn" : "good",
    warningIssues
  };
}

export interface ViewportIssueSummary {
  detail: string;
  hasIssues: boolean;
  issueCount: number;
  tone: "error" | "good" | "warn";
}

export function summarizeHotspotViewportIssues(
  hotspot: Hotspot,
  scene: Layered2DScene,
  availableFlowIdsSet: Set<string>,
  availableItemIdsSet: Set<string>,
  defaultLocaleId: string,
  defaultLocaleStrings: LocaleDocument["strings"] | null
): ViewportIssueSummary {
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

  return viewportIssueSummary(blockingIssues, warningIssues);
}

export function summarizePickupViewportIssues(
  pickup: ScenePickup,
  availableFlowIdsSet: Set<string>,
  availableItemIdsSet: Set<string>,
  defaultLocaleId: string,
  defaultLocaleStrings: LocaleDocument["strings"] | null
): ViewportIssueSummary {
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

  return viewportIssueSummary(blockingIssues, warningIssues);
}

export function scenePointIsInside(
  point: ScenePointDraftValue | undefined,
  size: { height: number; width: number }
): boolean {
  if (!point) return true;
  return point.x >= 0 && point.x <= size.width && point.y >= 0 && point.y <= size.height;
}

export function buildSceneLayersFromDraft(
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

export function summarizeActorViewportIssues(
  actor: SceneActor,
  scene: Layered2DScene,
  availableAssetIdsSet: Set<string>,
  availableAnimationPackIdsSet: Set<string>,
  availableFlowIdsSet: Set<string>,
  availableItemIdsSet: Set<string>,
  defaultLocaleId: string,
  defaultLocaleStrings: LocaleDocument["strings"] | null
): ViewportIssueSummary {
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

  return viewportIssueSummary(blockingIssues, warningIssues);
}

function nextAvailableId(existingIds: string[], base: string): string {
  const existing = new Set(existingIds);
  let counter = 0;
  let candidate = base;
  while (existing.has(candidate)) {
    counter += 1;
    candidate = `${base}-${counter}`;
  }
  return candidate;
}

function viewportIssueSummary(blockingIssues: string[], warningIssues: string[]): ViewportIssueSummary {
  return {
    detail: [...blockingIssues, ...warningIssues][0] ?? "Ready to save.",
    hasIssues: blockingIssues.length > 0 || warningIssues.length > 0,
    issueCount: blockingIssues.length + warningIssues.length,
    tone: blockingIssues.length > 0 ? "error" : warningIssues.length > 0 ? "warn" : "good"
  };
}
