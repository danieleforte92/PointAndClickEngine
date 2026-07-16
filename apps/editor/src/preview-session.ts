import type {
  AssetDocument,
  AnimationPackDocument,
  FlowDocument,
  Hotspot,
  ItemDocument,
  Layered2DScene,
  LocaleDocument,
  PromptPackDocument,
  ProjectBundle,
  SceneActor,
  SceneDocument,
  SceneLayer,
  ScenePickup,
  StyleBibleDocument,
  WorkflowTemplateDocument,
  AssetGenerationRecipeDocument
} from "@pointclick/contracts";
import {
  buildFlowNodes,
  buildActorFromDraft,
  buildHotspotFromDraft,
  createScenePlayerConfig,
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

function toAssetMap(assets: AssetDocument[]): Record<string, AssetDocument> {
  return Object.fromEntries(assets.map((asset) => [asset.id, asset]));
}

function toAnimationPackMap(animationPacks: AnimationPackDocument[]): Record<string, AnimationPackDocument> {
  return Object.fromEntries(animationPacks.map((animationPack) => [animationPack.id, animationPack]));
}

function toPromptPackMap(promptPacks: PromptPackDocument[]): Record<string, PromptPackDocument> {
  return Object.fromEntries(promptPacks.map((promptPack) => [promptPack.id, promptPack]));
}

function toStyleBibleMap(styleBibles: StyleBibleDocument[]): Record<string, StyleBibleDocument> {
  return Object.fromEntries(styleBibles.map((styleBible) => [styleBible.id, styleBible]));
}

function toWorkflowTemplateMap(
  workflowTemplates: WorkflowTemplateDocument[]
): Record<string, WorkflowTemplateDocument> {
  return Object.fromEntries(workflowTemplates.map((workflowTemplate) => [workflowTemplate.id, workflowTemplate]));
}

function toGenerationRecipeMap(
  generationRecipes: AssetGenerationRecipeDocument[]
): Record<string, AssetGenerationRecipeDocument> {
  return Object.fromEntries(generationRecipes.map((generationRecipe) => [generationRecipe.id, generationRecipe]));
}

function buildDraftSceneLayers(
  scene: Layered2DScene,
  draft: EditorSessionState["sceneDrafts"][string]
): SceneLayer[] {
  const layers: SceneLayer[] = [];

  for (const layer of draft.layers) {
    const id = layer.id.trim();
    const name = layer.name.trim();
    const assetId = layer.assetId.trim();
    const depth = parseNumber(layer.depth);
    const opacity = parseNumber(layer.opacity);
    const x = parseNumber(layer.x);
    const y = parseNumber(layer.y);
    const width = parsePositiveNumber(layer.width);
    const height = parsePositiveNumber(layer.height);
    if (!id || !name || !assetId || depth === null || opacity === null) return scene.layers ?? [];
    if (opacity < 0 || opacity > 1 || x === null || y === null || width === null || height === null) {
      return scene.layers ?? [];
    }
    layers.push({
      assetId,
      bounds: { x, y, width, height },
      depth,
      id,
      locked: layer.locked,
      name,
      opacity,
      visible: layer.visible
    });
  }

  return layers;
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
    const width = parsePositiveNumber(draft.width);
    const height = parsePositiveNumber(draft.height);
    const baseHeight = parsePositiveNumber(draft.playerBaseHeight);
    const baseWidth = parsePositiveNumber(draft.playerBaseWidth);
    const scaleFar = parsePositiveNumber(draft.playerScaleFar);
    const scaleNear = parsePositiveNumber(draft.playerScaleNear);
    const walkSpeed = parsePositiveNumber(draft.playerWalkSpeed);
    const playerDefaults = createScenePlayerConfig(scene.player);

    nextScenes[sceneId] = {
      ...scene,
      background: draft.background,
      generationGuides: draft.generationGuides,
      layers: buildDraftSceneLayers(scene, draft),
      name: draft.name,
      player: {
        ...(draft.playerAnimationPackId.trim() ? { animationPackId: draft.playerAnimationPackId.trim() } : {}),
        ...(draft.playerAssetId.trim() ? { assetId: draft.playerAssetId.trim() } : {}),
        baseHeight: baseHeight ?? playerDefaults.baseHeight,
        baseWidth: baseWidth ?? playerDefaults.baseWidth,
        scaleFar: scaleFar ?? playerDefaults.scaleFar,
        scaleNear: scaleNear ?? playerDefaults.scaleNear,
        walkSpeed: walkSpeed ?? playerDefaults.walkSpeed
      },
      playerStart:
        playerStartX === null || playerStartY === null
          ? scene.playerStart
          : { x: playerStartX, y: playerStartY },
      size: width === null || height === null ? scene.size : { width, height },
      walkArea: walkAreaPoints.length >= 3 ? { points: walkAreaPoints } : scene.walkArea
    };
  }

  return nextScenes;
}

function applyHotspotDraft(scene: Layered2DScene, hotspotId: string, draft: EditorSessionState["hotspotDrafts"][string]) {
  return scene.hotspots.map((hotspot): Hotspot => {
    if (hotspot.id !== hotspotId) return hotspot;
    return buildHotspotFromDraft(hotspot, draft);
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

    if (draft.assetId.trim()) {
      nextPickup.assetId = draft.assetId.trim();
    } else {
      delete nextPickup.assetId;
    }

    if (draft.pickupFlowId.trim()) {
      nextPickup.pickupFlowId = draft.pickupFlowId.trim();
    } else {
      delete nextPickup.pickupFlowId;
    }

    return nextPickup;
  });
}

function applyActorDraft(scene: Layered2DScene, actorId: string, draft: EditorSessionState["actorDrafts"][string]) {
  return scene.actors.map((actor): SceneActor => {
    if (actor.id !== actorId) return actor;
    return buildActorFromDraft(actor, draft);
  });
}

function applyEntityDrafts(
  scenes: Record<string, SceneDocument>,
  session: EditorSessionState
): Record<string, SceneDocument> {
  const nextScenes = { ...scenes };

  for (const [key, draft] of Object.entries(session.actorDrafts)) {
    const [sceneId, kind, actorId] = key.split("::");
    const scene = nextScenes[sceneId ?? ""];
    if (!sceneId || kind !== "actor" || !actorId || !scene || scene.type !== "layered-2d") continue;
    nextScenes[sceneId] = {
      ...scene,
      actors: applyActorDraft(scene, actorId, draft)
    };
  }

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
      ...(draft.editorLayout ? { editorLayout: draft.editorLayout } : {}),
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
  const assetMap = toAssetMap(snapshot.assets);
  const animationPackMap = toAnimationPackMap(snapshot.animationPacks);
  const promptPackMap = toPromptPackMap(snapshot.promptPacks);
  const styleBibleMap = toStyleBibleMap(snapshot.styleBibles);
  const workflowTemplateMap = toWorkflowTemplateMap(snapshot.workflowTemplates);
  const generationRecipeMap = toGenerationRecipeMap(snapshot.generationRecipes);

  return {
    manifest: snapshot.manifest,
    scenes: sceneMap,
    flows: flowMap,
    locales: localeMap,
    items: itemMap,
    assets: assetMap,
    animationPacks: animationPackMap,
    promptPacks: promptPackMap,
    styleBibles: styleBibleMap,
    workflowTemplates: workflowTemplateMap,
    generationRecipes: generationRecipeMap
  };
}
