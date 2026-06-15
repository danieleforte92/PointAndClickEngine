import type {
  FlowDocument,
  Hotspot,
  ItemDocument,
  Layered2DScene,
  LocaleDocument,
  ProjectBundle,
  SceneDocument,
  ScenePickup
} from "@pointclick/contracts";
import {
  buildFlowNodes,
  buildHotspotUseItemFlows,
  parseNumber,
  parsePositiveNumber,
  type EditorSessionState
} from "./editor-session";
import type { EditorProjectSnapshot } from "./preload";

function toSceneMap(scenes: SceneDocument[]): Record<string, SceneDocument> {
  return Object.fromEntries(scenes.map((scene) => [scene.id, scene]));
}

function toFlowMap(flows: FlowDocument[]): Record<string, FlowDocument> {
  return Object.fromEntries(flows.map((flow) => [flow.id, flow]));
}

function toLocaleMap(locales: LocaleDocument[]): Record<string, LocaleDocument> {
  return Object.fromEntries(locales.map((locale) => [locale.locale, locale]));
}

function toItemMap(items: ItemDocument[]): Record<string, ItemDocument> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

function applySceneDrafts(
  scenes: Record<string, SceneDocument>,
  session: EditorSessionState
): Record<string, SceneDocument> {
  const nextScenes = { ...scenes };

  for (const [sceneId, draft] of Object.entries(session.sceneDrafts)) {
    const scene = nextScenes[sceneId];
    if (!scene || scene.type !== "layered-2d") continue;

    const walkAreaPoints = draft.walkAreaPoints
      .map((point) => {
        const x = parseNumber(point.x);
        const y = parseNumber(point.y);
        return x === null || y === null ? null : { x, y };
      })
      .filter((point): point is { x: number; y: number } => point !== null);

    const playerStartX = parseNumber(draft.playerStartX);
    const playerStartY = parseNumber(draft.playerStartY);

    nextScenes[sceneId] = {
      ...scene,
      background: draft.background,
      name: draft.name,
      playerStart:
        playerStartX === null || playerStartY === null
          ? scene.playerStart
          : { x: playerStartX, y: playerStartY },
      walkArea: walkAreaPoints.length >= 3 ? { points: walkAreaPoints } : scene.walkArea
    };
  }

  return nextScenes;
}

function applyHotspotDraft(scene: Layered2DScene, hotspotId: string, draft: EditorSessionState["hotspotDrafts"][string]) {
  return scene.hotspots.map((hotspot): Hotspot => {
    if (hotspot.id !== hotspotId) return hotspot;

    const x = parseNumber(draft.x);
    const y = parseNumber(draft.y);
    const width = parsePositiveNumber(draft.width);
    const height = parsePositiveNumber(draft.height);

    const nextHotspot: Hotspot = {
      ...hotspot,
      labelKey: draft.labelKey,
      bounds:
        x === null || y === null || width === null || height === null
          ? hotspot.bounds
          : { x, y, width, height },
      actions: {
        useItemFlows: buildHotspotUseItemFlows(draft.useItemFlows)
      }
    };

    const nextCursor = draft.cursor.trim();
    if (nextCursor === "look" || nextCursor === "talk" || nextCursor === "use" || nextCursor === "enter") {
      nextHotspot.cursor = nextCursor;
    } else {
      delete nextHotspot.cursor;
    }
    if (draft.lookFlowId.trim()) {
      nextHotspot.actions.lookFlowId = draft.lookFlowId.trim();
    }
    if (draft.talkFlowId.trim()) {
      nextHotspot.actions.talkFlowId = draft.talkFlowId.trim();
    }
    if (draft.useFlowId.trim()) {
      nextHotspot.actions.useFlowId = draft.useFlowId.trim();
    }

    return nextHotspot;
  });
}

function applyPickupDraft(scene: Layered2DScene, pickupId: string, draft: EditorSessionState["pickupDrafts"][string]) {
  return scene.pickups.map((pickup): ScenePickup => {
    if (pickup.id !== pickupId) return pickup;

    const x = parseNumber(draft.x);
    const y = parseNumber(draft.y);
    const width = parsePositiveNumber(draft.width);
    const height = parsePositiveNumber(draft.height);

    const nextPickup: ScenePickup = {
      ...pickup,
      itemId: draft.itemId,
      labelKey: draft.labelKey,
      bounds:
        x === null || y === null || width === null || height === null
          ? pickup.bounds
          : { x, y, width, height }
    };

    if (draft.pickupFlowId.trim()) {
      nextPickup.pickupFlowId = draft.pickupFlowId.trim();
    } else {
      delete nextPickup.pickupFlowId;
    }

    return nextPickup;
  });
}

function applyEntityDrafts(
  scenes: Record<string, SceneDocument>,
  session: EditorSessionState
): Record<string, SceneDocument> {
  const nextScenes = { ...scenes };

  for (const [key, draft] of Object.entries(session.hotspotDrafts)) {
    const [sceneId, hotspotId] = key.split("::");
    const scene = nextScenes[sceneId ?? ""];
    if (!sceneId || !hotspotId || !scene || scene.type !== "layered-2d") continue;
    nextScenes[sceneId] = {
      ...scene,
      hotspots: applyHotspotDraft(scene, hotspotId, draft)
    };
  }

  for (const [key, draft] of Object.entries(session.pickupDrafts)) {
    const [sceneId, kind, pickupId] = key.split("::");
    const scene = nextScenes[sceneId ?? ""];
    if (!sceneId || kind !== "pickup" || !pickupId || !scene || scene.type !== "layered-2d") continue;
    nextScenes[sceneId] = {
      ...scene,
      pickups: applyPickupDraft(scene, pickupId, draft)
    };
  }

  return nextScenes;
}

function applyFlowDrafts(
  flows: Record<string, FlowDocument>,
  session: EditorSessionState
): Record<string, FlowDocument> {
  const nextFlows = { ...flows };

  for (const [flowId, draft] of Object.entries(session.flowDrafts)) {
    const flow = nextFlows[flowId];
    if (!flow) continue;
    nextFlows[flowId] = {
      ...flow,
      name: draft.name,
      nodes: buildFlowNodes(draft.nodes),
      startNodeId: draft.startNodeId
    };
  }

  return nextFlows;
}

function applyLocaleDrafts(
  locales: Record<string, LocaleDocument>,
  session: EditorSessionState
): Record<string, LocaleDocument> {
  const nextLocales = { ...locales };

  for (const [localeId, draftStrings] of Object.entries(session.localeDrafts)) {
    const locale = nextLocales[localeId];
    if (!locale) continue;
    nextLocales[localeId] = {
      ...locale,
      strings: { ...draftStrings }
    };
  }

  for (const [localeId, draftEntry] of Object.entries(session.localeEntryDrafts)) {
    const locale = nextLocales[localeId];
    if (!locale) continue;
    const key = draftEntry.key.trim();
    if (!key) continue;
    nextLocales[localeId] = {
      ...locale,
      strings: {
        ...locale.strings,
        [key]: draftEntry.value
      }
    };
  }

  return nextLocales;
}

function applyItemDrafts(
  items: Record<string, ItemDocument>,
  session: EditorSessionState
): Record<string, ItemDocument> {
  const nextItems = { ...items };

  for (const [itemId, draft] of Object.entries(session.itemDrafts)) {
    const item = nextItems[itemId];
    if (!item) continue;
    nextItems[itemId] = {
      ...item,
      labelKey: draft.labelKey,
      name: draft.name
    };
  }

  return nextItems;
}

export function buildDraftProjectBundle(
  snapshot: EditorProjectSnapshot,
  session: EditorSessionState
): ProjectBundle {
  const sceneMap = applyEntityDrafts(applySceneDrafts(toSceneMap(snapshot.scenes), session), session);
  const flowMap = applyFlowDrafts(toFlowMap(snapshot.flows), session);
  const localeMap = applyLocaleDrafts(toLocaleMap(snapshot.locales), session);
  const itemMap = applyItemDrafts(toItemMap(snapshot.items), session);

  return {
    manifest: snapshot.manifest,
    scenes: sceneMap,
    flows: flowMap,
    locales: localeMap,
    items: itemMap
  };
}
