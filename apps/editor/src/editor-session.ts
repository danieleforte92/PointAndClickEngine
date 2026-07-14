import type {
  ConditionExpression,
  CursorValue,
  FlowDocument,
  FlowEditorLayout,
  FlowNode,
  Hotspot,
  HotspotUseItemFlow,
  ItemDocument,
  Layered2DScene,
  LocaleDocument,
  Polygon2,
  SceneActor,
  SceneActorRole,
  SceneGenerationGuide,
  SceneLayer,
  ScenePlayerConfig,
  ScenePickup,
  SceneDocument
} from "@pointclick/contracts";

export type Workspace = "overview" | "scene" | "narrative" | "assets" | "ai" | "build";
export type SceneNavigationEntityKind =
  | "scene"
  | "background"
  | "layer"
  | "walk-area"
  | "player-start"
  | "actor"
  | "pickup"
  | "hotspot"
  | "guide";
export type SceneSelectionTool = "select" | "actor" | "hotspot" | "pickup" | "player-start" | "walk-area";
export type SceneSelectionTarget = {
  entityId?: string;
  kind: SceneNavigationEntityKind;
  sceneId: string | null;
};
export type ProjectNavigationSection = "health" | "settings" | "entrypoints" | "structure" | "diagnostics";

export type EditorNavigationTarget =
  | { workspace: "overview"; section?: ProjectNavigationSection }
  | { workspace: "scene"; sceneId?: string; entityKind?: SceneNavigationEntityKind; entityId?: string }
  | { workspace: "narrative"; flowId?: string; textKey?: string; sceneId?: string; entityId?: string }
  | { workspace: "assets"; assetId?: string }
  | { workspace: "ai"; targetId?: string; sceneId?: string; assetId?: string }
  | { workspace: "build"; diagnosticId?: string };

export function workspaceForNavigationTarget(target: EditorNavigationTarget): Workspace {
  return target.workspace;
}

export function sceneSelectionTargetFor({
  activeActorId,
  activeHotspotId,
  activePickupId,
  activeSceneId,
  activeSceneTool,
  playerSelected,
  selectedGenerationGuideId,
  selectedSceneLayerId
}: {
  activeActorId: string | null;
  activeHotspotId: string | null;
  activePickupId: string | null;
  activeSceneId: string | null;
  activeSceneTool: SceneSelectionTool;
  playerSelected: boolean;
  selectedGenerationGuideId: string | null;
  selectedSceneLayerId: string | null;
}): SceneSelectionTarget | null {
  if (!activeSceneId) return null;
  if (selectedSceneLayerId) return { entityId: selectedSceneLayerId, kind: "layer", sceneId: activeSceneId };
  if (selectedGenerationGuideId) return { entityId: selectedGenerationGuideId, kind: "guide", sceneId: activeSceneId };
  if (playerSelected || activeSceneTool === "player-start") return { kind: "player-start", sceneId: activeSceneId };
  if (activeActorId) return { entityId: activeActorId, kind: "actor", sceneId: activeSceneId };
  if (activePickupId) return { entityId: activePickupId, kind: "pickup", sceneId: activeSceneId };
  if (activeHotspotId) return { entityId: activeHotspotId, kind: "hotspot", sceneId: activeSceneId };
  if (activeSceneTool === "walk-area") return { kind: "walk-area", sceneId: activeSceneId };
  return { kind: "scene", sceneId: activeSceneId };
}

export type FlagValueKind = "string" | "number" | "boolean";
export type DraftNodeType = FlowNode["type"];

export interface HotspotDraft {
  cursor: string;
  height: string;
  interactSpotEnabled: boolean;
  interactSpotX: string;
  interactSpotY: string;
  labelKey: string;
  lookFlowId: string;
  lookSpotEnabled: boolean;
  lookSpotX: string;
  lookSpotY: string;
  talkFlowId: string;
  useFlowId: string;
  useItemFlows: Array<{ itemId: string; flowId: string }>;
  width: string;
  x: string;
  y: string;
}

export interface PickupDraft {
  assetId: string;
  height: string;
  itemId: string;
  labelKey: string;
  pickupFlowId: string;
  width: string;
  x: string;
  y: string;
}

export interface ActorDraft {
  animationPackId: string;
  assetId: string;
  cursor: string;
  depth: string;
  height: string;
  interactSpotEnabled: boolean;
  interactSpotX: string;
  interactSpotY: string;
  labelKey: string;
  lookFlowId: string;
  lookSpotEnabled: boolean;
  lookSpotX: string;
  lookSpotY: string;
  role: SceneActorRole;
  talkFlowId: string;
  useFlowId: string;
  useItemFlows: Array<{ itemId: string; flowId: string }>;
  visibleFlagKey: string;
  visibleFlagValue: string;
  visibleFlagValueKind: FlagValueKind;
  visibleItemId: string;
  visibleWhenType: "none" | "flag-equals" | "item-in-inventory";
  width: string;
  x: string;
  y: string;
}

export interface ItemDraft {
  labelKey: string;
  name: string;
}

export interface SceneDraft {
  background: string;
  generationGuides: SceneGenerationGuide[];
  height: string;
  layers: SceneLayerDraft[];
  name: string;
  playerAnimationPackId: string;
  playerAssetId: string;
  playerScaleFar: string;
  playerScaleNear: string;
  playerStartX: string;
  playerStartY: string;
  playerWalkSpeed: string;
  width: string;
  walkAreaPoints: Array<{ x: string; y: string }>;
}

export interface SceneLayerDraft {
  assetId: string;
  depth: string;
  height: string;
  id: string;
  locked: boolean;
  name: string;
  opacity: string;
  visible: boolean;
  width: string;
  x: string;
  y: string;
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

export interface FlowChangeSceneDraftNode {
  id: string;
  next: string;
  playerStartEnabled: boolean;
  playerStartX: string;
  playerStartY: string;
  targetSceneId: string;
  type: "change-scene";
}

export interface FlowEndDraftNode {
  id: string;
  type: "end";
}

export interface FlowConditionDraft {
  itemId: string;
  key: string;
  type: ConditionExpression["type"];
  value: string;
  valueKind: FlagValueKind;
}

export interface FlowChoiceDraftNode {
  choices: Array<{
    id: string;
    labelKey: string;
    next: string;
    when: FlowConditionDraft | null;
  }>;
  id: string;
  promptKey: string;
  type: "choice";
}

export interface FlowConditionDraftNode {
  id: string;
  ifFalse: string;
  ifTrue: string;
  type: "condition";
  when: FlowConditionDraft;
}

export interface FlowSubFlowDraftNode {
  flowId: string;
  id: string;
  next: string;
  type: "sub-flow";
}

export interface FlowInventoryDraftNode {
  action: "add" | "remove";
  id: string;
  itemId: string;
  next: string;
  type: "inventory";
}

export interface FlowWaitDraftNode {
  durationMs: string;
  id: string;
  next: string;
  type: "wait";
}

export interface FlowCueDraftNode {
  cueKey: string;
  cueType: "camera-shake" | "fade" | "sound" | "emote";
  cueValue: string;
  id: string;
  next: string;
  type: "cue";
}

export type FlowDraftNode =
  | FlowLineDraftNode
  | FlowFlagDraftNode
  | FlowChangeSceneDraftNode
  | FlowChoiceDraftNode
  | FlowConditionDraftNode
  | FlowSubFlowDraftNode
  | FlowInventoryDraftNode
  | FlowWaitDraftNode
  | FlowCueDraftNode
  | FlowEndDraftNode;

export interface FlowDraft {
  editorLayout?: FlowEditorLayout;
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
  activeActorId: string | null;
  activeFlowId: string | null;
  activeHotspotId: string | null;
  activeItemId: string | null;
  activeLocale: string | null;
  activePickupId: string | null;
  activeSceneId: string;
  directory: string;
  flows: FlowDocument[];
  items: ItemDocument[];
  locales: LocaleDocument[];
  scenes: SceneDocument[];
}

export interface EditorSessionState {
  activeActorId: string | null;
  activeFlowId: string | null;
  activeHotspotId: string | null;
  activeItemId: string | null;
  activeLocale: string | null;
  activePickupId: string | null;
  activeSceneId: string | null;
  actorDrafts: Record<string, ActorDraft>;
  flowDrafts: Record<string, FlowDraft>;
  hotspotDrafts: Record<string, HotspotDraft>;
  itemDrafts: Record<string, ItemDraft>;
  localeDrafts: Record<string, Record<string, string>>;
  localeEntryDrafts: Record<string, LocaleEntryDraft>;
  pickupDrafts: Record<string, PickupDraft>;
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
  actorKeys: Set<string>;
  count: number;
  flowIds: Set<string>;
  hotspotKeys: Set<string>;
  itemIds: Set<string>;
  localeIds: Set<string>;
  pickupKeys: Set<string>;
  sceneIds: Set<string>;
}

export type NarrativeEntityKind = "actor" | "hotspot" | "pickup";

export interface NarrativeFlowReference {
  action: string;
  entityId: string;
  entityKind: NarrativeEntityKind;
  flowExists: boolean;
  flowId: string;
  sceneId: string;
  sceneName: string;
}

export interface NarrativeSceneGroup {
  references: NarrativeFlowReference[];
  sceneId: string;
  sceneName: string;
}

export interface NarrativeRelationIndex {
  missingReferences: NarrativeFlowReference[];
  sceneGroups: NarrativeSceneGroup[];
  unlinkedFlows: FlowDocument[];
}

export interface ScenePointDraftValue {
  x: number;
  y: number;
}

export interface SceneRectDraftValue extends ScenePointDraftValue {
  height: number;
  width: number;
}

export const cursorOptions: CursorValue[] = ["look", "talk", "use", "enter"];
export const hexColorPattern = /^#[0-9a-fA-F]{6}$/;

export function sceneItems(scenes: SceneDocument[]) {
  return scenes.filter((scene): scene is Layered2DScene => scene.type === "layered-2d");
}

function pushNarrativeReference(
  references: NarrativeFlowReference[],
  flowIds: Set<string>,
  scene: Layered2DScene,
  entityKind: NarrativeEntityKind,
  entityId: string,
  action: string,
  flowId?: string
) {
  const normalizedFlowId = flowId?.trim();
  if (!normalizedFlowId) return;

  references.push({
    action,
    entityId,
    entityKind,
    flowExists: flowIds.has(normalizedFlowId),
    flowId: normalizedFlowId,
    sceneId: scene.id,
    sceneName: scene.name
  });
}

export function buildNarrativeRelationIndex(
  scenes: SceneDocument[],
  flows: FlowDocument[]
): NarrativeRelationIndex {
  const flowIds = new Set(flows.map((flow) => flow.id));
  const linkedFlowIds = new Set<string>();
  const sceneGroups: NarrativeSceneGroup[] = [];

  for (const scene of sceneItems(scenes)) {
    const references: NarrativeFlowReference[] = [];

    for (const hotspot of scene.hotspots) {
      pushNarrativeReference(references, flowIds, scene, "hotspot", hotspot.id, "look", hotspot.actions.lookFlowId);
      pushNarrativeReference(references, flowIds, scene, "hotspot", hotspot.id, "talk", hotspot.actions.talkFlowId);
      pushNarrativeReference(references, flowIds, scene, "hotspot", hotspot.id, "use", hotspot.actions.useFlowId);
      hotspot.actions.useItemFlows.forEach((entry) =>
        pushNarrativeReference(
          references,
          flowIds,
          scene,
          "hotspot",
          hotspot.id,
          `use ${entry.itemId}`,
          entry.flowId
        )
      );
    }

    for (const actor of scene.actors) {
      pushNarrativeReference(references, flowIds, scene, "actor", actor.id, "look", actor.actions.lookFlowId);
      pushNarrativeReference(references, flowIds, scene, "actor", actor.id, "talk", actor.actions.talkFlowId);
      pushNarrativeReference(references, flowIds, scene, "actor", actor.id, "use", actor.actions.useFlowId);
      actor.actions.useItemFlows.forEach((entry) =>
        pushNarrativeReference(
          references,
          flowIds,
          scene,
          "actor",
          actor.id,
          `use ${entry.itemId}`,
          entry.flowId
        )
      );
    }

    for (const pickup of scene.pickups) {
      pushNarrativeReference(references, flowIds, scene, "pickup", pickup.id, "pickup", pickup.pickupFlowId);
    }

    references.filter((reference) => reference.flowExists).forEach((reference) => linkedFlowIds.add(reference.flowId));
    sceneGroups.push({
      references,
      sceneId: scene.id,
      sceneName: scene.name
    });
  }

  return {
    missingReferences: sceneGroups.flatMap((group) => group.references.filter((reference) => !reference.flowExists)),
    sceneGroups,
    unlinkedFlows: flows.filter((flow) => !linkedFlowIds.has(flow.id))
  };
}

export function createHotspotDraft(hotspot: Hotspot | null): HotspotDraft {
  return {
    cursor: hotspot?.cursor ?? "",
    height: hotspot ? String(hotspot.bounds.height) : "",
    interactSpotEnabled: hotspot?.interactSpot !== undefined,
    interactSpotX: hotspot?.interactSpot ? String(hotspot.interactSpot.x) : "",
    interactSpotY: hotspot?.interactSpot ? String(hotspot.interactSpot.y) : "",
    labelKey: hotspot?.labelKey ?? "",
    lookFlowId: hotspot?.actions.lookFlowId ?? "",
    lookSpotEnabled: hotspot?.lookSpot !== undefined,
    lookSpotX: hotspot?.lookSpot ? String(hotspot.lookSpot.x) : "",
    lookSpotY: hotspot?.lookSpot ? String(hotspot.lookSpot.y) : "",
    talkFlowId: hotspot?.actions.talkFlowId ?? "",
    useFlowId: hotspot?.actions.useFlowId ?? "",
    useItemFlows:
      hotspot?.actions.useItemFlows.map((entry) => ({
        itemId: entry.itemId,
        flowId: entry.flowId
      })) ?? [],
    width: hotspot ? String(hotspot.bounds.width) : "",
    x: hotspot ? String(hotspot.bounds.x) : "",
    y: hotspot ? String(hotspot.bounds.y) : ""
  };
}

export function createPickupDraft(pickup: ScenePickup | null): PickupDraft {
  return {
    assetId: pickup?.assetId ?? "",
    height: pickup ? String(pickup.bounds.height) : "",
    itemId: pickup?.itemId ?? "",
    labelKey: pickup?.labelKey ?? "",
    pickupFlowId: pickup?.pickupFlowId ?? "",
    width: pickup ? String(pickup.bounds.width) : "",
    x: pickup ? String(pickup.bounds.x) : "",
    y: pickup ? String(pickup.bounds.y) : ""
  };
}

export function createActorDraft(actor: SceneActor | null): ActorDraft {
  const visibleWhen = actor?.visibleWhen;
  const visibleWhenType = visibleWhen?.type ?? "none";
  return {
    animationPackId: actor?.animationPackId ?? "",
    assetId: actor?.assetId ?? "",
    cursor: "",
    depth: actor ? String(actor.depth) : "0",
    height: actor ? String(actor.bounds.height) : "",
    interactSpotEnabled: actor?.interactSpot !== undefined,
    interactSpotX: actor?.interactSpot ? String(actor.interactSpot.x) : "",
    interactSpotY: actor?.interactSpot ? String(actor.interactSpot.y) : "",
    labelKey: actor?.labelKey ?? "",
    lookFlowId: actor?.actions.lookFlowId ?? "",
    lookSpotEnabled: actor?.lookSpot !== undefined,
    lookSpotX: actor?.lookSpot ? String(actor.lookSpot.x) : "",
    lookSpotY: actor?.lookSpot ? String(actor.lookSpot.y) : "",
    role: actor?.role ?? "prop",
    talkFlowId: actor?.actions.talkFlowId ?? "",
    useFlowId: actor?.actions.useFlowId ?? "",
    useItemFlows:
      actor?.actions.useItemFlows.map((entry) => ({
        itemId: entry.itemId,
        flowId: entry.flowId
      })) ?? [],
    visibleFlagKey: visibleWhen?.type === "flag-equals" ? visibleWhen.key : "",
    visibleFlagValue: visibleWhen?.type === "flag-equals" ? String(visibleWhen.value) : "",
    visibleFlagValueKind: visibleWhen?.type === "flag-equals" ? inferFlagValueKind(visibleWhen.value) : "boolean",
    visibleItemId: visibleWhen?.type === "item-in-inventory" ? visibleWhen.itemId : "",
    visibleWhenType,
    width: actor ? String(actor.bounds.width) : "",
    x: actor ? String(actor.bounds.x) : "",
    y: actor ? String(actor.bounds.y) : ""
  };
}

export function createItemDraft(item: ItemDocument | null): ItemDraft {
  return {
    labelKey: item?.labelKey ?? "",
    name: item?.name ?? ""
  };
}

export function createSceneDraft(scene: Layered2DScene | null): SceneDraft {
  const player = createScenePlayerConfig(scene?.player);
  return {
    background: scene?.background ?? "",
    generationGuides: scene?.generationGuides?.map((guide) => ({ ...guide })) ?? [],
    height: scene ? String(scene.size.height) : "",
    layers: scene?.layers?.map((layer) => createSceneLayerDraft(layer, scene)) ?? [],
    name: scene?.name ?? "",
    playerAnimationPackId: player.animationPackId ?? "",
    playerAssetId: player.assetId ?? "",
    playerScaleFar: String(player.scaleFar),
    playerScaleNear: String(player.scaleNear),
    playerStartX: scene ? String(scene.playerStart.x) : "",
    playerStartY: scene ? String(scene.playerStart.y) : "",
    playerWalkSpeed: String(player.walkSpeed),
    width: scene ? String(scene.size.width) : "",
    walkAreaPoints:
      scene?.walkArea.points.map((point) => ({
        x: String(point.x),
        y: String(point.y)
      })) ?? [
        { x: "0", y: "0" },
        { x: "100", y: "0" },
        { x: "100", y: "100" }
      ]
  };
}

export function createSceneLayerDraft(layer: SceneLayer, scene: Layered2DScene): SceneLayerDraft {
  const bounds = layer.bounds ?? {
    x: 0,
    y: 0,
    width: scene.size.width,
    height: scene.size.height
  };
  return {
    assetId: layer.assetId,
    depth: String(layer.depth),
    height: String(bounds.height),
    id: layer.id,
    locked: layer.locked ?? false,
    name: layer.name,
    opacity: String(layer.opacity ?? 1),
    visible: layer.visible ?? true,
    width: String(bounds.width),
    x: String(bounds.x),
    y: String(bounds.y)
  };
}

export function createScenePlayerConfig(player?: ScenePlayerConfig | null): Required<ScenePlayerConfig> {
  return {
    animationPackId: player?.animationPackId ?? "",
    assetId: player?.assetId ?? "",
    scaleFar: player?.scaleFar ?? 0.62,
    scaleNear: player?.scaleNear ?? 1.08,
    walkSpeed: player?.walkSpeed ?? 320
  };
}

export function polygonArea(polygon: Polygon2): number {
  let total = 0;
  for (let index = 0; index < polygon.points.length; index += 1) {
    const current = polygon.points[index]!;
    const next = polygon.points[(index + 1) % polygon.points.length]!;
    total += current.x * next.y - next.x * current.y;
  }
  return Math.abs(total) / 2;
}

export function inferFlagValueKind(value: string | number | boolean): FlagValueKind {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  return "string";
}

function createConditionDraft(condition: ConditionExpression): FlowConditionDraft {
  return condition.type === "flag-equals"
    ? {
        itemId: "",
        key: condition.key,
        type: "flag-equals",
        value: String(condition.value),
        valueKind: inferFlagValueKind(condition.value)
      }
    : {
        itemId: condition.itemId,
        key: "",
        type: "item-in-inventory",
        value: "",
        valueKind: "boolean"
      };
}

function buildConditionExpression(condition: FlowConditionDraft): ConditionExpression {
  if (condition.type === "item-in-inventory") {
    return { type: "item-in-inventory", itemId: condition.itemId.trim() };
  }
  let value: string | number | boolean = condition.value;
  if (condition.valueKind === "boolean") value = condition.value.trim().toLowerCase() === "true";
  if (condition.valueKind === "number") value = Number(condition.value);
  return { type: "flag-equals", key: condition.key.trim(), value };
}

export function createFlowDraft(flow: FlowDocument | null): FlowDraft | null {
  if (!flow) return null;
  return {
    ...(flow.editorLayout ? { editorLayout: structuredClone(flow.editorLayout) } : {}),
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
      if (node.type === "change-scene") {
        return {
          id: node.id,
          next: node.next,
          playerStartEnabled: node.playerStart !== undefined,
          playerStartX: node.playerStart ? String(node.playerStart.x) : "",
          playerStartY: node.playerStart ? String(node.playerStart.y) : "",
          targetSceneId: node.targetSceneId,
          type: "change-scene"
        };
      }
      if (node.type === "choice") {
        return {
          choices: node.choices.map((choice) => ({
            id: choice.id,
            labelKey: choice.labelKey,
            next: choice.next,
            when: choice.when ? createConditionDraft(choice.when) : null
          })),
          id: node.id,
          promptKey: node.promptKey,
          type: "choice"
        };
      }
      if (node.type === "condition") {
        return {
          id: node.id,
          ifFalse: node.ifFalse,
          ifTrue: node.ifTrue,
          type: "condition",
          when: createConditionDraft(node.when)
        };
      }
      if (node.type === "sub-flow") {
        return { flowId: node.flowId, id: node.id, next: node.next, type: "sub-flow" };
      }
      if (node.type === "inventory") {
        return { action: node.action, id: node.id, itemId: node.itemId, next: node.next, type: "inventory" };
      }
      if (node.type === "wait") {
        return { durationMs: String(node.durationMs), id: node.id, next: node.next, type: "wait" };
      }
      if (node.type === "cue") {
        return {
          cueKey: node.cue.key ?? "",
          cueType: node.cue.type,
          cueValue: node.cue.value ?? "",
          id: node.id,
          next: node.next,
          type: "cue"
        };
      }
      return { id: node.id, type: "end" };
    }),
    startNodeId: flow.startNodeId
  };
}

export function buildHotspotUseItemFlows(
  entries: Array<{ itemId: string; flowId: string }>
): HotspotUseItemFlow[] {
  return entries
    .map((entry) => ({
      itemId: entry.itemId.trim(),
      flowId: entry.flowId.trim()
    }))
    .filter((entry) => entry.itemId.length > 0 && entry.flowId.length > 0);
}

export function buildHotspotFromDraft(hotspot: Hotspot, draft: HotspotDraft): Hotspot {
  const x = parseNumber(draft.x);
  const y = parseNumber(draft.y);
  const width = parsePositiveNumber(draft.width);
  const height = parsePositiveNumber(draft.height);
  const interactSpotX = parseNumber(draft.interactSpotX);
  const interactSpotY = parseNumber(draft.interactSpotY);
  const lookSpotX = parseNumber(draft.lookSpotX);
  const lookSpotY = parseNumber(draft.lookSpotY);

  const nextHotspot: Hotspot = {
    ...hotspot,
    actions: {
      useItemFlows: buildHotspotUseItemFlows(draft.useItemFlows)
    },
    bounds:
      x === null || y === null || width === null || height === null
        ? hotspot.bounds
        : { x, y, width, height },
    labelKey: draft.labelKey
  };

  const cursor = draft.cursor.trim();
  if (cursor === "look" || cursor === "talk" || cursor === "use" || cursor === "enter") {
    nextHotspot.cursor = cursor;
  } else {
    delete nextHotspot.cursor;
  }

  if (draft.lookFlowId.trim()) nextHotspot.actions.lookFlowId = draft.lookFlowId.trim();
  if (draft.talkFlowId.trim()) nextHotspot.actions.talkFlowId = draft.talkFlowId.trim();
  if (draft.useFlowId.trim()) nextHotspot.actions.useFlowId = draft.useFlowId.trim();

  if (draft.interactSpotEnabled && interactSpotX !== null && interactSpotY !== null) {
    nextHotspot.interactSpot = { x: interactSpotX, y: interactSpotY };
  } else {
    delete nextHotspot.interactSpot;
  }

  if (draft.lookSpotEnabled && lookSpotX !== null && lookSpotY !== null) {
    nextHotspot.lookSpot = { x: lookSpotX, y: lookSpotY };
  } else {
    delete nextHotspot.lookSpot;
  }

  return nextHotspot;
}

export function buildActorFromDraft(actor: SceneActor, draft: ActorDraft): SceneActor {
  const x = parseNumber(draft.x);
  const y = parseNumber(draft.y);
  const width = parsePositiveNumber(draft.width);
  const height = parsePositiveNumber(draft.height);
  const depth = parseNumber(draft.depth);
  const interactSpotX = parseNumber(draft.interactSpotX);
  const interactSpotY = parseNumber(draft.interactSpotY);
  const lookSpotX = parseNumber(draft.lookSpotX);
  const lookSpotY = parseNumber(draft.lookSpotY);

  const nextActor: SceneActor = {
    ...actor,
    actions: {
      useItemFlows: buildHotspotUseItemFlows(draft.useItemFlows)
    },
    bounds:
      x === null || y === null || width === null || height === null
        ? actor.bounds
        : { x, y, width, height },
    depth: depth ?? actor.depth,
    labelKey: draft.labelKey,
    role: draft.role
  };

  const assetId = draft.assetId.trim();
  if (assetId) {
    nextActor.assetId = assetId;
  } else {
    delete nextActor.assetId;
  }

  const animationPackId = draft.animationPackId.trim();
  if (animationPackId) {
    nextActor.animationPackId = animationPackId;
  } else {
    delete nextActor.animationPackId;
  }

  if (draft.lookFlowId.trim()) nextActor.actions.lookFlowId = draft.lookFlowId.trim();
  if (draft.talkFlowId.trim()) nextActor.actions.talkFlowId = draft.talkFlowId.trim();
  if (draft.useFlowId.trim()) nextActor.actions.useFlowId = draft.useFlowId.trim();

  if (draft.interactSpotEnabled && interactSpotX !== null && interactSpotY !== null) {
    nextActor.interactSpot = { x: interactSpotX, y: interactSpotY };
  } else {
    delete nextActor.interactSpot;
  }

  if (draft.lookSpotEnabled && lookSpotX !== null && lookSpotY !== null) {
    nextActor.lookSpot = { x: lookSpotX, y: lookSpotY };
  } else {
    delete nextActor.lookSpot;
  }

  if (draft.visibleWhenType === "flag-equals" && draft.visibleFlagKey.trim()) {
    let value: string | number | boolean = draft.visibleFlagValue;
    if (draft.visibleFlagValueKind === "boolean") {
      value = draft.visibleFlagValue.trim().toLowerCase() === "true";
    } else if (draft.visibleFlagValueKind === "number") {
      value = Number(draft.visibleFlagValue);
    }
    nextActor.visibleWhen = {
      key: draft.visibleFlagKey.trim(),
      type: "flag-equals",
      value
    };
  } else if (draft.visibleWhenType === "item-in-inventory" && draft.visibleItemId.trim()) {
    nextActor.visibleWhen = {
      itemId: draft.visibleItemId.trim(),
      type: "item-in-inventory"
    };
  } else {
    delete nextActor.visibleWhen;
  }

  return nextActor;
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function clampScenePoint(
  point: ScenePointDraftValue,
  size: { height: number; width: number }
): ScenePointDraftValue {
  return {
    x: Math.round(clamp(point.x, 0, size.width)),
    y: Math.round(clamp(point.y, 0, size.height))
  };
}

export function moveScenePoint(
  point: ScenePointDraftValue,
  delta: ScenePointDraftValue,
  size: { height: number; width: number }
): ScenePointDraftValue {
  return clampScenePoint(
    {
      x: point.x + delta.x,
      y: point.y + delta.y
    },
    size
  );
}

export function clampSceneRect(
  rect: SceneRectDraftValue,
  size: { height: number; width: number }
): SceneRectDraftValue {
  const width = Math.round(clamp(rect.width, 1, size.width));
  const height = Math.round(clamp(rect.height, 1, size.height));
  const x = Math.round(clamp(rect.x, 0, size.width - width));
  const y = Math.round(clamp(rect.y, 0, size.height - height));

  return {
    height,
    width,
    x,
    y
  };
}

export function moveSceneRect(
  rect: SceneRectDraftValue,
  delta: ScenePointDraftValue,
  size: { height: number; width: number }
): SceneRectDraftValue {
  return clampSceneRect(
    {
      ...rect,
      x: rect.x + delta.x,
      y: rect.y + delta.y
    },
    size
  );
}

export function resizeSceneRectFromBottomRight(
  rect: SceneRectDraftValue,
  delta: ScenePointDraftValue,
  size: { height: number; width: number }
): SceneRectDraftValue {
  return {
    x: Math.round(clamp(rect.x, 0, size.width - 1)),
    y: Math.round(clamp(rect.y, 0, size.height - 1)),
    width: Math.round(clamp(rect.width + delta.x, 1, size.width - rect.x)),
    height: Math.round(clamp(rect.height + delta.y, 1, size.height - rect.y))
  };
}

export function insertDraftPointAfter<T>(points: T[], afterIndex: number, point: T): T[] {
  const nextPoints = [...points];
  const insertIndex = clamp(afterIndex + 1, 0, nextPoints.length);
  nextPoints.splice(insertIndex, 0, point);
  return nextPoints;
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
  const next = nextNodeTarget(nodes);
  if (type === "line") {
    return {
      id: generateNodeId(nodes, "line"),
      next,
      speakerId: "speaker",
      textKey: "dialogue.new-line",
      type: "line"
    };
  }
  if (type === "set-flag") {
    return {
      id: generateNodeId(nodes, "flag"),
      key: "story.flag",
      next,
      type: "set-flag",
      value: "true",
      valueKind: "boolean"
    };
  }
  if (type === "change-scene") {
    return {
      id: generateNodeId(nodes, "scene"),
      next,
      playerStartEnabled: false,
      playerStartX: "",
      playerStartY: "",
      targetSceneId: "",
      type: "change-scene"
    };
  }
  if (type === "choice") {
    return {
      choices: [{ id: "option-1", labelKey: "dialogue.choice.option", next, when: null }],
      id: generateNodeId(nodes, "choice"),
      promptKey: "dialogue.choice.prompt",
      type: "choice"
    };
  }
  if (type === "condition") {
    return {
      id: generateNodeId(nodes, "condition"),
      ifFalse: next,
      ifTrue: next,
      type: "condition",
      when: { itemId: "", key: "story.flag", type: "flag-equals", value: "true", valueKind: "boolean" }
    };
  }
  if (type === "sub-flow") {
    return { flowId: "", id: generateNodeId(nodes, "sub-flow"), next, type: "sub-flow" };
  }
  if (type === "inventory") {
    return { action: "add", id: generateNodeId(nodes, "inventory"), itemId: "", next, type: "inventory" };
  }
  if (type === "wait") {
    return { durationMs: "500", id: generateNodeId(nodes, "wait"), next, type: "wait" };
  }
  if (type === "cue") {
    return { cueKey: "", cueType: "sound", cueValue: "", id: generateNodeId(nodes, "cue"), next, type: "cue" };
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
    if (node.type === "change-scene") {
      const playerStartX = parseNumber(node.playerStartX);
      const playerStartY = parseNumber(node.playerStartY);
      return {
        id: node.id.trim(),
        next: node.next.trim(),
        ...(node.playerStartEnabled && playerStartX !== null && playerStartY !== null
          ? { playerStart: { x: playerStartX, y: playerStartY } }
          : {}),
        targetSceneId: node.targetSceneId.trim(),
        type: "change-scene"
      };
    }
    if (node.type === "choice") {
      return {
        choices: node.choices.map((choice) => ({
          id: choice.id.trim(),
          labelKey: choice.labelKey.trim(),
          next: choice.next.trim(),
          ...(choice.when ? { when: buildConditionExpression(choice.when) } : {})
        })),
        id: node.id.trim(),
        promptKey: node.promptKey.trim(),
        type: "choice"
      };
    }
    if (node.type === "condition") {
      return {
        id: node.id.trim(),
        ifFalse: node.ifFalse.trim(),
        ifTrue: node.ifTrue.trim(),
        type: "condition",
        when: buildConditionExpression(node.when)
      };
    }
    if (node.type === "sub-flow") {
      return { flowId: node.flowId.trim(), id: node.id.trim(), next: node.next.trim(), type: "sub-flow" };
    }
    if (node.type === "inventory") {
      return { action: node.action, id: node.id.trim(), itemId: node.itemId.trim(), next: node.next.trim(), type: "inventory" };
    }
    if (node.type === "wait") {
      return { durationMs: Number(node.durationMs), id: node.id.trim(), next: node.next.trim(), type: "wait" };
    }
    if (node.type === "cue") {
      return {
        cue: {
          type: node.cueType,
          ...(node.cueKey.trim() ? { key: node.cueKey.trim() } : {}),
          ...(node.cueValue.trim() ? { value: node.cueValue.trim() } : {})
        },
        id: node.id.trim(),
        next: node.next.trim(),
        type: "cue"
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
    activeActorId: project.activeActorId,
    activeFlowId: null,
    activeHotspotId: project.activeHotspotId,
    activeItemId: project.activeItemId,
    activeLocale: null,
    activePickupId: project.activePickupId,
    activeSceneId: project.activeSceneId,
    actorDrafts: {},
    flowDrafts: {},
    hotspotDrafts: {},
    itemDrafts: {},
    localeDrafts: {},
    localeEntryDrafts: {},
    pickupDrafts: {},
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

function actorKey(sceneId: string, actorId: string): string {
  return `${sceneId}::actor::${actorId}`;
}

function findActor(
  project: EditorProjectData,
  sceneId: string | null,
  actorId: string | null
): SceneActor | null {
  const scene = findScene(project, sceneId);
  if (!scene || !actorId) return null;
  return scene.actors.find((actor) => actor.id === actorId) ?? null;
}

function findLocale(project: EditorProjectData, localeId: string | null): LocaleDocument | null {
  if (!localeId) return null;
  return project.locales.find((locale) => locale.locale === localeId) ?? null;
}

function findFlow(project: EditorProjectData, flowId: string | null): FlowDocument | null {
  if (!flowId) return null;
  return project.flows.find((flow) => flow.id === flowId) ?? null;
}

function findItem(project: EditorProjectData, itemId: string | null): ItemDocument | null {
  if (!itemId) return null;
  return project.items.find((item) => item.id === itemId) ?? null;
}

function pickupKey(sceneId: string, pickupId: string): string {
  return `${sceneId}::pickup::${pickupId}`;
}

function findPickup(
  project: EditorProjectData,
  sceneId: string | null,
  pickupId: string | null
): ScenePickup | null {
  const scene = findScene(project, sceneId);
  if (!scene || !pickupId) return null;
  return scene.pickups.find((pickup) => pickup.id === pickupId) ?? null;
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
  const actorKeys = new Set<string>();
  const flowIds = new Set<string>();
  const hotspotKeys = new Set<string>();
  const itemIds = new Set<string>();
  const localeIds = new Set<string>();
  const pickupKeys = new Set<string>();
  const sceneIds = new Set<string>();

  for (const [key, draft] of Object.entries(session.actorDrafts)) {
    const [sceneId, kind, actorId] = key.split("::");
    if (!sceneId || kind !== "actor" || !actorId) continue;
    const actor = findActor(project, sceneId, actorId);
    if (actor && JSON.stringify(draft) !== JSON.stringify(createActorDraft(actor))) {
      actorKeys.add(key);
    }
  }

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

  for (const [itemId, draft] of Object.entries(session.itemDrafts)) {
    const item = findItem(project, itemId);
    if (item && JSON.stringify(draft) !== JSON.stringify(createItemDraft(item))) {
      itemIds.add(itemId);
    }
  }

  for (const [key, draft] of Object.entries(session.pickupDrafts)) {
    const [sceneId, , pickupId] = key.split("::");
    if (!sceneId || !pickupId) continue;
    const pickup = findPickup(project, sceneId, pickupId);
    if (pickup && JSON.stringify(draft) !== JSON.stringify(createPickupDraft(pickup))) {
      pickupKeys.add(key);
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
    actorKeys,
    count:
      actorKeys.size +
      flowIds.size +
      hotspotKeys.size +
      itemIds.size +
      localeIds.size +
      pickupKeys.size +
      sceneIds.size,
    flowIds,
    hotspotKeys,
    itemIds,
    localeIds,
    pickupKeys,
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
    activeActorId: session.activeActorId,
    activeFlowId: session.activeFlowId,
    activeHotspotId: session.activeHotspotId,
    activeItemId: session.activeItemId,
    activeLocale: session.activeLocale,
    activePickupId: session.activePickupId,
    activeSceneId: session.activeSceneId,
    actorDrafts: {},
    flowDrafts: {},
    hotspotDrafts: {},
    itemDrafts: {},
    localeDrafts: {},
    localeEntryDrafts: {},
    pickupDrafts: {},
    sceneDrafts: {}
  };

  for (const key of dirty.actorKeys) {
    recoverySession.actorDrafts[key] = {
      ...session.actorDrafts[key]!
    };
  }

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

  for (const itemId of dirty.itemIds) {
    recoverySession.itemDrafts[itemId] = {
      ...session.itemDrafts[itemId]!
    };
  }

  for (const key of dirty.pickupKeys) {
    recoverySession.pickupDrafts[key] = {
      ...session.pickupDrafts[key]!
    };
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
    activeActorId: recovery.session.activeActorId ?? base.activeActorId,
    activeFlowId: recovery.session.activeFlowId ?? base.activeFlowId,
    activeHotspotId: recovery.session.activeHotspotId ?? base.activeHotspotId,
    activeItemId: recovery.session.activeItemId ?? base.activeItemId,
    activeLocale: recovery.session.activeLocale ?? base.activeLocale,
    activePickupId: recovery.session.activePickupId ?? base.activePickupId,
    activeSceneId: recovery.session.activeSceneId ?? base.activeSceneId,
    actorDrafts: { ...recovery.session.actorDrafts },
    flowDrafts: { ...recovery.session.flowDrafts },
    hotspotDrafts: { ...recovery.session.hotspotDrafts },
    itemDrafts: { ...recovery.session.itemDrafts },
    localeDrafts: { ...recovery.session.localeDrafts },
    localeEntryDrafts: { ...recovery.session.localeEntryDrafts },
    pickupDrafts: { ...recovery.session.pickupDrafts },
    sceneDrafts: { ...recovery.session.sceneDrafts }
  };
}

export function discardSavedDraft(
  session: EditorSessionState,
  kind: "actor" | "flow" | "hotspot" | "item" | "locale" | "pickup" | "scene",
  id: string
): EditorSessionState {
  const next = cloneSessionState(session);
  if (kind === "actor") delete next.actorDrafts[id];
  if (kind === "flow") delete next.flowDrafts[id];
  if (kind === "hotspot") delete next.hotspotDrafts[id];
  if (kind === "item") delete next.itemDrafts[id];
  if (kind === "locale") {
    delete next.localeDrafts[id];
    delete next.localeEntryDrafts[id];
  }
  if (kind === "pickup") delete next.pickupDrafts[id];
  if (kind === "scene") delete next.sceneDrafts[id];
  return next;
}

export function createHotspotKey(sceneId: string, hotspotId: string): string {
  return hotspotKey(sceneId, hotspotId);
}

export function createActorKey(sceneId: string, actorId: string): string {
  return actorKey(sceneId, actorId);
}

export function createPickupKey(sceneId: string, pickupId: string): string {
  return pickupKey(sceneId, pickupId);
}
