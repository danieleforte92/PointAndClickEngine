import type {
  ConditionExpression,
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
import {
  createInitialState,
  executeCommand,
  type DomainEvent,
  type GameCommand,
  type WorldState
} from "@pointclick/core";
import {
  advanceFlow,
  createFlowSession,
  type DialogueLine,
  type FlowSession
} from "@pointclick/flows";
import { resolveWalkTarget } from "./navigation";

export interface RuntimeFrame {
  state: WorldState;
  events: DomainEvent[];
  dialogue: (DialogueLine & { text: string }) | null;
  feedback: string | null;
}

export class AdventureEngine {
  private world: WorldState;
  private flowSession: FlowSession | null = null;
  private eventLog: DomainEvent[] = [];

  constructor(
    private readonly bundle: ProjectBundle,
    private readonly locale = bundle.manifest.defaultLocale
  ) {
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

  get currentScene(): SceneDocument {
    return this.scene(this.world.sceneId);
  }

  start(): RuntimeFrame {
    const events = this.dispatch({ type: "game/start" });
    return this.frame(events, null, null);
  }

  walkTo(x: number, y: number): RuntimeFrame {
    const scene = this.currentScene;
    if (scene.type !== "layered-2d") {
      return this.frame([], null, null);
    }

    const resolution = resolveWalkTarget(scene.walkArea, this.world.player, { x, y });
    if (!resolution) {
      return this.frame([], null, "No path found.");
    }

    const events = this.dispatch({
      type: "character/walk",
      x: resolution.goal.x,
      y: resolution.goal.y
    });
    return this.frame(events, null, null);
  }

  selectVerb(verb: Verb): RuntimeFrame {
    const events = this.dispatch({ type: "verb/select", verb });
    return this.frame(events, null, null);
  }

  toggleSelectedItem(itemId: string): RuntimeFrame {
    if (!this.bundle.items[itemId]) {
      return this.frame([], null, `Missing item "${itemId}".`);
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

    const events: DomainEvent[] = [];
    const spotFeedback = this.moveToInteractionSpot(hotspot.interactSpot, events);
    if (spotFeedback) {
      return this.frame(events, null, spotFeedback);
    }

    events.push(...this.dispatch({ type: "hotspot/interact", hotspotId, verb, itemId }));
    const flowId = this.resolveActionsFlow(hotspot.actions, verb, itemId);
    if (!flowId) {
      return this.frame(events, null, this.unsupportedHotspotFeedback(verb, hotspot));
    }

    return this.startFlow(flowId, events);
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

    const events: DomainEvent[] = [];
    const spotFeedback = this.moveToInteractionSpot(actor.interactSpot, events);
    if (spotFeedback) {
      return this.frame(events, null, spotFeedback);
    }

    events.push(...this.dispatch({ type: "actor/interact", actorId, verb, itemId }));
    const flowId = this.resolveActionsFlow(actor.actions, verb, itemId);
    if (!flowId) {
      return this.frame(events, null, this.unsupportedActorFeedback(verb, actor));
    }

    return this.startFlow(flowId, events);
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

    const events: DomainEvent[] = [];
    const spotFeedback = this.moveToInteractionSpot(pickup.interactSpot, events);
    if (spotFeedback) {
      return this.frame(events, null, spotFeedback);
    }

    if (verb === "use") {
      events.push(...this.dispatch({ type: "pickup/collect", pickupId: pickup.id, itemId: pickup.itemId }));
    }

    if (pickup.pickupFlowId) {
      return this.startFlow(pickup.pickupFlowId, events);
    }

    if (verb === "use") {
      return this.frame(events, null, `Collected ${this.itemLabel(pickup.itemId)}.`);
    }

    return this.frame(events, null, this.localize(pickup.labelKey));
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

  private advanceActiveFlow(events: DomainEvent[]): RuntimeFrame {
    if (!this.flowSession) {
      return this.frame(events, null, null);
    }

    const flow = this.flow(this.flowSession.flowId);
    const step = advanceFlow(flow, this.flowSession, this.world);
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
      null
    );
  }

  private dispatch(command: GameCommand): DomainEvent[] {
    const result = executeCommand(this.world, command);
    this.world = result.state;
    this.eventLog.push(...result.events);
    return [...result.events];
  }

  private frame(
    events: DomainEvent[],
    dialogue: (DialogueLine & { text: string }) | null,
    feedback: string | null
  ): RuntimeFrame {
    return { state: this.world, events, dialogue, feedback };
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
    return hotspot;
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

  private moveToInteractionSpot(spot: Vector2 | undefined, events: DomainEvent[]): string | null {
    if (!spot) return null;
    const scene = this.currentScene;
    if (scene.type !== "layered-2d") return null;

    const resolution = resolveWalkTarget(scene.walkArea, this.world.player, spot);
    if (!resolution) {
      return "No path found.";
    }

    events.push(
      ...this.dispatch({
        type: "character/walk",
        x: resolution.goal.x,
        y: resolution.goal.y
      })
    );
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
    return this.bundle.locales[this.locale]?.strings[key] ?? `[${key}]`;
  }

  private itemLabel(itemId: string): string {
    const item = this.bundle.items[itemId];
    return item ? this.localize(item.labelKey) : itemId;
  }
}
