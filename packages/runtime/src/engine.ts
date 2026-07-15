import type {
  ConditionExpression,
  FlowChoice,
  FlowDocument,
  Hotspot,
  HotspotActions,
  ScenePickup,
  Layered2DScene,
  ProjectBundle,
  SceneActor,
  Verb,
  SceneDocument,
  Vector2
} from "@pointclick/contracts";
import { colliderBounds, hotspotCollider } from "@pointclick/contracts/collider";
import {
  createInitialState,
  executeCommand,
  type DomainEvent,
  type GameCommand,
  type WorldState
} from "@pointclick/core";
import {
  advanceFlow,
  chooseFlowChoice,
  createFlowSession,
  type DialogueLine,
  type FlowMachineOptions,
  type FlowSession
} from "@pointclick/flows";
import {
  assertValidSaveDocument,
  createSaveDocument,
  createStableCheckpoint,
  type JsonValue,
  type SaveDocument,
  type SaveSlotId,
  type SaveStorage
} from "@pointclick/save";
import {
  DEFAULT_NAVIGATION_CELL_SIZE,
  NavigationGridCache,
  resolveWalkTargetOnGrid,
  type MovementPlan,
  type PathProgress
} from "./navigation";

export interface RuntimeFrame {
  state: WorldState;
  events: DomainEvent[];
  dialogue: (DialogueLine & { text: string }) | null;
  feedback: string | null;
  pathProgress: PathProgress | null;
  promptKey: string | null;
  choices: FlowChoice[];
  presentationCues: Array<{
    type: "camera-shake" | "fade" | "sound" | "emote";
    key?: string;
    value?: string;
  }>;
  waitUntil: number | null;
}

type PendingInteraction =
  | {
      kind: "actor";
      actorId: string;
      itemId: string | null;
      verb: Verb;
    }
  | {
      hotspotId: string;
      itemId: string | null;
      kind: "hotspot";
      verb: Verb;
    }
  | {
      itemId: string | null;
      kind: "pickup";
      pickupId: string;
      verb: Verb;
    };

export class AdventureEngine {
  private world: WorldState;
  private flowSession: FlowSession | null = null;
  private eventLog: DomainEvent[] = [];
  private movementPlan: MovementPlan | null = null;
  private pendingInteraction: PendingInteraction | null = null;
  private requestedLocale: string;
  private readonly navigationGridCache = new NavigationGridCache();
  private navigationCellSize = DEFAULT_NAVIGATION_CELL_SIZE;

  constructor(
    private readonly bundle: ProjectBundle,
    locale = bundle.manifest.defaultLocale
  ) {
    this.requestedLocale = locale;
    const scene = this.scene(bundle.manifest.initialSceneId);
    if (scene.type !== "layered-2d") {
      throw new Error("The foundation runtime currently starts from a layered-2d scene");
    }
    this.world = createInitialState(scene.id, scene.playerStart);
  }

  get state(): WorldState {
    return this.world;
  }

  get events(): readonly DomainEvent[] {
    return this.eventLog;
  }

  get locale(): string {
    return this.requestedLocale;
  }

  get activeLocale(): string {
    return this.resolveLocale(this.requestedLocale);
  }

  get activeFlowNodeId(): string | null {
    return this.flowSession?.currentNodeId ?? null;
  }

  get localeInfo(): { requested: string; active: string; fallback: string } {
    return {
      requested: this.requestedLocale,
      active: this.activeLocale,
      fallback: "engine"
    };
  }

  get isMoving(): boolean {
    return this.movementPlan !== null;
  }

  get currentMovement(): MovementPlan | null {
    return this.movementPlan ? this.cloneMovementPlan(this.movementPlan) : null;
  }

  get pathProgress(): PathProgress | null {
    return this.movementPlan ? this.createPathProgress(this.movementPlan) : null;
  }

  get navigationGridCacheSize(): number {
    return this.navigationGridCache.size;
  }

  setNavigationCellSize(cellSize: number): void {
    if (!Number.isFinite(cellSize) || cellSize <= 0) {
      throw new RangeError("Navigation cell size must be a finite positive number.");
    }
    if (this.navigationCellSize === cellSize) return;
    this.navigationCellSize = cellSize;
    this.navigationGridCache.clear();
  }

  get currentScene(): SceneDocument {
    return this.scene(this.world.sceneId);
  }

  start(): RuntimeFrame {
    const events = this.dispatch({ type: "game/start" });
    this.beginSceneEntryFlow(this.world.sceneId, events);
    return this.flowSession ? this.advanceActiveFlow(events) : this.frame(events, null, null);
  }

  walkTo(x: number, y: number): RuntimeFrame {
    const scene = this.currentScene;
    if (scene.type !== "layered-2d") {
      return this.frame([], null, null);
    }

    const resolution = this.resolveWalkTarget(scene, { x, y });
    if (!resolution) {
      return this.frame([], null, "No path found.");
    }

    if (!this.movementPlan && this.samePosition(this.navigationPosition(), resolution.goal)) {
      return this.frame([], null, null);
    }

    this.pendingInteraction = null;
    this.movementPlan = this.createMovementPlan(scene.id, resolution);
    return this.frame([], null, null);
  }

  advanceMovement(steps = 1): RuntimeFrame {
    if (!Number.isInteger(steps) || steps < 0) {
      throw new RangeError("Movement steps must be a non-negative integer.");
    }

    let result = this.frame([], null, null);
    for (let step = 0; step < steps && this.movementPlan; step += 1) {
      result = this.mergeFrames(result, this.advanceMovementStep());
    }
    return result;
  }

  completeMovement(): RuntimeFrame {
    let result = this.frame([], null, null);
    while (this.movementPlan) {
      result = this.mergeFrames(result, this.advanceMovementStep());
    }
    return result;
  }

  tickMovement(steps = 1): RuntimeFrame {
    return this.advanceMovement(steps);
  }

  setLocale(locale: string): RuntimeFrame {
    const normalized = locale.trim();
    if (!normalized) {
      throw new Error("Locale must be a non-empty string.");
    }
    this.requestedLocale = normalized;
    return this.frame([], null, null);
  }

  createSaveDocument(
    slot: SaveSlotId,
    projectFingerprint: string
  ): SaveDocument {
    if (this.isMoving) {
      throw new Error("Save is only available after movement has completed.");
    }

    return createSaveDocument({
      slot,
      projectFingerprint,
      locale: this.activeLocale,
      checkpoint: createStableCheckpoint(
        this.world as unknown as JsonValue,
        this.flowSession as unknown as JsonValue | null,
        this.eventLog as unknown as JsonValue[]
      )
    });
  }

  async save(
    storage: SaveStorage,
    slot: SaveSlotId,
    projectFingerprint: string
  ): Promise<SaveDocument> {
    const document = this.createSaveDocument(slot, projectFingerprint);
    await storage.write(slot, document);
    return document;
  }

  async autosave(
    storage: SaveStorage,
    projectFingerprint: string
  ): Promise<SaveDocument> {
    return this.save(storage, "autosave", projectFingerprint);
  }

  restoreSaveDocument(
    document: unknown,
    expectedProjectFingerprint: string
  ): RuntimeFrame {
    assertValidSaveDocument<JsonValue, JsonValue, JsonValue>(
      document,
      expectedProjectFingerprint
    );
    this.world = structuredClone(
      document.checkpoint.worldState
    ) as unknown as WorldState;
    this.flowSession = document.checkpoint.flowSession
      ? (structuredClone(document.checkpoint.flowSession) as unknown as FlowSession)
      : null;
    this.eventLog = structuredClone(document.checkpoint.eventLog) as DomainEvent[];
    this.requestedLocale = document.locale;
    this.movementPlan = null;
    this.pendingInteraction = null;
    this.navigationGridCache.clear();
    this.scene(this.world.sceneId);
    return this.frame([], null, null);
  }

  async restore(
    storage: SaveStorage,
    slot: SaveSlotId,
    expectedProjectFingerprint: string
  ): Promise<RuntimeFrame | null> {
    const document = await storage.read(slot);
    return document
      ? this.restoreSaveDocument(document, expectedProjectFingerprint)
      : null;
  }

  selectVerb(verb: Verb): RuntimeFrame {
    const events = this.dispatch({ type: "verb/select", verb });
    return this.frame(events, null, null);
  }

  toggleSelectedItem(itemId: string): RuntimeFrame {
    if (!this.bundle.items[itemId]) {
      return this.frame([], null, `Missing item "${itemId}".`);
    }

    if (!this.world.inventory.includes(itemId)) {
      return this.frame([], null, `Item "${this.itemLabel(itemId)}" is not in the inventory.`);
    }

    const events = this.dispatch({ type: "inventory/select", itemId });
    return this.frame(events, null, null);
  }

  clearSelectedItem(): RuntimeFrame {
    const events = this.dispatch({ type: "inventory/clear-selection" });
    return this.frame(events, null, null);
  }

  interactHotspot(hotspotId: string): RuntimeFrame {
    const hotspot = this.hotspot(hotspotId);
    const verb = this.world.activeVerb;
    const itemId = this.world.selectedItemId;

    if (verb === "walk") {
      return this.frame([], null, "Walk there instead of talking to it.");
    }

    return this.beginInteraction(
      { hotspotId, itemId, kind: "hotspot", verb },
      hotspot.interactSpot
    );
  }

  interactActor(actorId: string): RuntimeFrame {
    const actor = this.actor(actorId);
    const verb = this.world.activeVerb;
    const itemId = this.world.selectedItemId;

    if (!this.isActorVisible(actor)) {
      return this.frame([], null, null);
    }

    if (verb === "walk") {
      return this.frame([], null, "Walk there instead of using it.");
    }

    return this.beginInteraction(
      { actorId, itemId, kind: "actor", verb },
      actor.interactSpot
    );
  }

  interactPickup(pickupId: string): RuntimeFrame {
    const pickup = this.pickup(pickupId);
    const verb = this.world.activeVerb;
    const itemId = this.world.selectedItemId;

    if (this.world.collectedPickups.includes(pickupId)) {
      return this.frame([], null, null);
    }

    if (verb === "walk") {
      return this.frame([], null, "Walk won't pick it up.");
    }

    if (verb === "talk") {
      return this.frame([], null, "Talking to loose hardware feels optimistic.");
    }

    if (verb === "use" && itemId) {
      return this.frame([], null, "That item does not help with this pickup.");
    }

    return this.beginInteraction(
      { itemId, kind: "pickup", pickupId, verb },
      pickup.interactSpot
    );
  }

  visibleActors(): SceneActor[] {
    const scene = this.currentScene;
    if (scene.type !== "layered-2d") {
      return [];
    }
    return scene.actors.filter((actor) => this.isActorVisible(actor));
  }

  advanceDialogue(): RuntimeFrame {
    return this.advanceActiveFlow([]);
  }

  chooseDialogue(choiceId: string): RuntimeFrame {
    if (!this.flowSession) {
      return this.frame([], null, "No dialogue choice is active.");
    }
    const flow = this.flow(this.flowSession.flowId);
    const step = chooseFlowChoice(
      flow,
      this.flowSession,
      choiceId,
      this.world,
      this.flowMachineOptions()
    );
    return this.presentFlowStep(step, []);
  }

  private advanceActiveFlow(events: DomainEvent[]): RuntimeFrame {
    if (!this.flowSession) {
      return this.frame(events, null, null);
    }

    const flow = this.flow(this.flowSession.flowId);
    const step = advanceFlow(flow, this.flowSession, this.world, this.flowMachineOptions());
    return this.presentFlowStep(step, events);
  }

  private presentFlowStep(
    step: ReturnType<typeof advanceFlow>,
    events: DomainEvent[]
  ): RuntimeFrame {
    this.flowSession = step.session;
    for (const command of step.commands) {
      events.push(...this.dispatch(command));
    }

    if (step.session.done) {
      this.flowSession = null;
    }

    return this.frame(
      events,
      step.line
        ? {
            ...step.line,
            text: this.localize(step.line.textKey)
          }
      : null,
      null,
      {
        promptKey: step.promptKey,
        choices: step.choices,
        presentationCues: step.cues,
        waitUntil: step.waitUntil
      }
    );
  }

  private flowMachineOptions(): FlowMachineOptions {
    return { flows: this.bundle.flows };
  }

  private dispatch(command: GameCommand): DomainEvent[] {
    const result = executeCommand(this.world, command);
    this.world = result.state;
    this.eventLog.push(...result.events);
    for (const event of result.events) {
      if (event.type === "scene/changed") {
        this.beginSceneEntryFlow(event.sceneId, result.events);
      }
    }
    return [...result.events];
  }

  private beginSceneEntryFlow(sceneId: string, events: DomainEvent[]): void {
    if (this.flowSession) return;
    const flow = Object.values(this.bundle.flows).find((candidate) =>
      candidate.sceneEntryTriggers?.some((trigger) => trigger.sceneId === sceneId)
    );
    if (!flow) return;
    this.flowSession = createFlowSession(flow);
    events.push(...this.dispatch({ type: "flow/start", flowId: flow.id }));
  }

  private frame(
    events: DomainEvent[],
    dialogue: (DialogueLine & { text: string }) | null,
    feedback: string | null,
    presentation: {
      promptKey?: string | null;
      choices?: FlowChoice[];
      presentationCues?: RuntimeFrame["presentationCues"];
      waitUntil?: number | null;
    } = {}
  ): RuntimeFrame {
    return {
      state: this.world,
      events,
      dialogue,
      feedback,
      pathProgress: this.pathProgress,
      promptKey: presentation.promptKey ?? null,
      choices: presentation.choices ?? [],
      presentationCues: presentation.presentationCues ?? [],
      waitUntil: presentation.waitUntil ?? null
    };
  }

  private mergeFrames(previous: RuntimeFrame, next: RuntimeFrame): RuntimeFrame {
    return {
      ...next,
      events: [...previous.events, ...next.events],
      dialogue: next.dialogue ?? previous.dialogue,
      feedback: next.feedback ?? previous.feedback,
      promptKey: next.promptKey ?? previous.promptKey,
      choices: next.choices.length > 0 ? next.choices : previous.choices,
      presentationCues: [...previous.presentationCues, ...next.presentationCues],
      waitUntil: next.waitUntil ?? previous.waitUntil
    };
  }

  private advanceMovementStep(): RuntimeFrame {
    const plan = this.movementPlan;
    if (!plan) return this.frame([], null, null);

    const waypoint = plan.waypoints[plan.nextWaypointIndex];
    if (!waypoint) return this.finishMovement();

    plan.position = { ...waypoint };
    plan.nextWaypointIndex += 1;
    if (plan.nextWaypointIndex === plan.waypoints.length) {
      return this.finishMovement();
    }

    return this.frame([], null, null);
  }

  private finishMovement(): RuntimeFrame {
    const plan = this.movementPlan;
    if (!plan) return this.frame([], null, null);

    this.movementPlan = null;
    const events = this.dispatch({
      type: "movement/complete",
      x: plan.goal.x,
      y: plan.goal.y
    });
    const pending = this.pendingInteraction;
    this.pendingInteraction = null;
    if (pending) {
      return this.executePendingInteraction(pending, events);
    }
    return this.frame(events, null, null);
  }

  private createMovementPlan(sceneId: string, resolution: {
    goal: Vector2;
    path: Array<{ x: number; y: number }>;
    waypoints: Vector2[];
  }): MovementPlan {
    const start = this.navigationPosition();
    return {
      goal: { ...resolution.goal },
      nextWaypointIndex: 0,
      path: resolution.path.map((cell) => ({ ...cell })),
      position: { ...start },
      sceneId,
      start: { ...start },
      waypoints: resolution.waypoints.map((waypoint) => ({ ...waypoint }))
    };
  }

  private createPathProgress(plan: MovementPlan): PathProgress {
    return {
      status: "walking",
      sceneId: plan.sceneId,
      waypointIndex: plan.nextWaypointIndex,
      ratio:
        plan.waypoints.length === 0
          ? 1
          : Math.min(plan.nextWaypointIndex / plan.waypoints.length, 1),
      completedWaypoints: Math.min(plan.nextWaypointIndex, plan.waypoints.length),
      currentWaypointIndex:
        plan.nextWaypointIndex < plan.waypoints.length ? plan.nextWaypointIndex : null,
      goal: { ...plan.goal },
      path: plan.path.map((cell) => ({ ...cell })),
      position: { ...plan.position },
      totalWaypoints: plan.waypoints.length,
      waypoints: plan.waypoints.map((waypoint) => ({ ...waypoint }))
    };
  }

  private cloneMovementPlan(plan: MovementPlan): MovementPlan {
    return {
      goal: { ...plan.goal },
      nextWaypointIndex: plan.nextWaypointIndex,
      path: plan.path.map((cell) => ({ ...cell })),
      position: { ...plan.position },
      sceneId: plan.sceneId,
      start: { ...plan.start },
      waypoints: plan.waypoints.map((waypoint) => ({ ...waypoint }))
    };
  }

  private navigationPosition(): Vector2 {
    return this.movementPlan ? this.movementPlan.position : this.world.player;
  }

  private samePosition(left: Vector2, right: Vector2): boolean {
    return (left.x - right.x) ** 2 + (left.y - right.y) ** 2 <= 1e-6;
  }

  private resolveWalkTarget(scene: Layered2DScene, target: Vector2) {
    const grid = this.navigationGridCache.get(
      scene.id,
      scene.walkArea,
      this.navigationCellSize
    );
    return grid
      ? resolveWalkTargetOnGrid(grid, scene.walkArea, this.navigationPosition(), target)
      : null;
  }

  private beginInteraction(
    pending: PendingInteraction,
    spot: Vector2 | undefined
  ): RuntimeFrame {
    if (!spot) {
      if (this.movementPlan) {
        this.pendingInteraction = pending;
        return this.frame([], null, null);
      }
      return this.executePendingInteraction(pending, []);
    }

    const scene = this.currentScene;
    if (scene.type !== "layered-2d") {
      return this.executePendingInteraction(pending, []);
    }

    const resolution = this.resolveWalkTarget(scene, spot);
    if (!resolution) {
      return this.frame([], null, "No path found.");
    }

    if (!this.movementPlan && this.samePosition(this.navigationPosition(), resolution.goal)) {
      return this.executePendingInteraction(pending, []);
    }

    this.pendingInteraction = pending;
    this.movementPlan = this.createMovementPlan(scene.id, resolution);
    return this.frame([], null, null);
  }

  private executePendingInteraction(
    pending: PendingInteraction,
    events: DomainEvent[]
  ): RuntimeFrame {
    if (pending.kind === "hotspot") {
      const hotspot = this.hotspot(pending.hotspotId);
      events.push(
        ...this.dispatch({
          type: "hotspot/interact",
          hotspotId: pending.hotspotId,
          verb: pending.verb,
          itemId: pending.itemId
        })
      );
      const flowId = this.resolveActionsFlow(hotspot.actions, pending.verb, pending.itemId);
      if (!flowId) {
        return this.frame(
          events,
          null,
          this.unsupportedHotspotFeedback(pending.verb, hotspot)
        );
      }
      return this.startFlow(flowId, events);
    }

    if (pending.kind === "actor") {
      const actor = this.actor(pending.actorId);
      events.push(
        ...this.dispatch({
          type: "actor/interact",
          actorId: pending.actorId,
          verb: pending.verb,
          itemId: pending.itemId
        })
      );
      const flowId = this.resolveActionsFlow(actor.actions, pending.verb, pending.itemId);
      if (!flowId) {
        return this.frame(events, null, this.unsupportedActorFeedback(pending.verb, actor));
      }
      return this.startFlow(flowId, events);
    }

    const pickup = this.pickup(pending.pickupId);
    if (pending.verb === "use") {
      events.push(
        ...this.dispatch({
          type: "pickup/collect",
          pickupId: pickup.id,
          itemId: pickup.itemId
        })
      );
    }

    if (pickup.pickupFlowId) {
      return this.startFlow(pickup.pickupFlowId, events);
    }

    if (pending.verb === "use") {
      return this.frame(events, null, `Collected ${this.itemLabel(pickup.itemId)}.`);
    }

    return this.frame(events, null, this.localize(pickup.labelKey));
  }

  private startFlow(flowId: string, events: DomainEvent[]): RuntimeFrame {
    events.push(...this.dispatch({ type: "flow/start", flowId }));
    const flow = this.flow(flowId);
    this.flowSession = createFlowSession(flow);
    return this.advanceActiveFlow(events);
  }

  private scene(id: string): SceneDocument {
    const scene = this.bundle.scenes[id];
    if (!scene) throw new Error(`Missing scene "${id}"`);
    return scene;
  }

  private flow(id: string): FlowDocument {
    const flow = this.bundle.flows[id];
    if (!flow) throw new Error(`Missing flow "${id}"`);
    return flow;
  }

  private hotspot(id: string): Hotspot {
    const scene = this.currentScene;
    const hotspot = scene.hotspots.find((candidate) => candidate.id === id);
    if (!hotspot) throw new Error(`Missing hotspot "${id}" in scene "${scene.id}"`);
    return {
      ...hotspot,
      bounds: hotspot.bounds ?? colliderBounds(hotspotCollider(hotspot))
    } as Hotspot;
  }

  private pickup(id: string): ScenePickup {
    const scene = this.currentScene;
    if (scene.type !== "layered-2d") {
      throw new Error(`Scene "${scene.id}" does not support pickups`);
    }
    const pickup = scene.pickups.find((candidate) => candidate.id === id);
    if (!pickup) throw new Error(`Missing pickup "${id}" in scene "${scene.id}"`);
    return pickup;
  }

  private actor(id: string): SceneActor {
    const scene = this.currentScene;
    if (scene.type !== "layered-2d") {
      throw new Error(`Scene "${scene.id}" does not support actors`);
    }
    const actor = scene.actors.find((candidate) => candidate.id === id);
    if (!actor) throw new Error(`Missing actor "${id}" in scene "${scene.id}"`);
    return actor;
  }

  private resolveActionsFlow(actions: HotspotActions, verb: Verb, itemId: string | null): string | null {
    if (verb === "look") {
      return actions.lookFlowId ?? null;
    }
    if (verb === "talk") {
      return actions.talkFlowId ?? null;
    }
    if (verb === "use") {
      if (itemId) {
        return (
          actions.useItemFlows.find((entry) => entry.itemId === itemId)?.flowId ??
          actions.useFlowId ??
          null
        );
      }
      return actions.useFlowId ?? null;
    }
    return null;
  }

  private isActorVisible(actor: SceneActor): boolean {
    if (!actor.visibleWhen) return true;
    return this.evaluateCondition(actor.visibleWhen);
  }

  private evaluateCondition(condition: ConditionExpression): boolean {
    if (condition.type === "flag-equals") {
      return this.world.flags[condition.key] === condition.value;
    }
    return this.world.inventory.includes(condition.itemId);
  }

  private unsupportedHotspotFeedback(verb: Verb, hotspot: Hotspot): string {
    const label = this.localize(hotspot.labelKey);
    if (verb === "look") return `Nothing new stands out about ${label}.`;
    if (verb === "talk") return `${label} is not feeling conversational.`;
    if (verb === "use") return `That does not seem useful on ${label}.`;
    return "Nothing happens.";
  }

  private unsupportedActorFeedback(verb: Verb, actor: SceneActor): string {
    const label = this.localize(actor.labelKey);
    if (verb === "look") return `Nothing new stands out about ${label}.`;
    if (verb === "talk") return `${label} has nothing to say.`;
    if (verb === "use") return `That does not seem useful on ${label}.`;
    return "Nothing happens.";
  }

  private localize(key: string): string {
    const requested = this.bundle.locales[this.requestedLocale];
    const project = this.bundle.locales[this.bundle.manifest.defaultLocale];
    return requested?.strings[key] ?? project?.strings[key] ?? `[${key}]`;
  }

  private resolveLocale(requested: string): string {
    if (this.bundle.locales[requested]) return requested;
    const language = requested.split("-")[0]?.toLowerCase();
    const matchingLocale = Object.keys(this.bundle.locales).find(
      (candidate) => candidate.toLowerCase() === language
    );
    return matchingLocale ?? this.bundle.manifest.defaultLocale;
  }

  private itemLabel(itemId: string): string {
    const item = this.bundle.items[itemId];
    return item ? this.localize(item.labelKey) : itemId;
  }
}
