import type {
  FlowDocument,
  Hotspot,
  Layered2DScene,
  ProjectBundle,
  SceneDocument
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
    return this.frame(events, null);
  }

  walkTo(x: number, y: number): RuntimeFrame {
    const scene = this.currentScene;
    if (scene.type !== "layered-2d") {
      return this.frame([], null);
    }

    const resolution = resolveWalkTarget(scene.walkArea, this.world.player, { x, y });
    if (!resolution) {
      return this.frame([], null);
    }

    const events = this.dispatch({
      type: "character/walk",
      x: resolution.goal.x,
      y: resolution.goal.y
    });
    return this.frame(events, null);
  }

  activateHotspot(hotspotId: string): RuntimeFrame {
    const hotspot = this.hotspot(hotspotId);
    const events = this.dispatch({ type: "hotspot/activate", hotspotId });
    events.push(...this.dispatch({ type: "flow/start", flowId: hotspot.actionFlowId }));
    const flow = this.flow(hotspot.actionFlowId);
    this.flowSession = createFlowSession(flow);
    return this.advanceActiveFlow(events);
  }

  advanceDialogue(): RuntimeFrame {
    return this.advanceActiveFlow([]);
  }

  private advanceActiveFlow(events: DomainEvent[]): RuntimeFrame {
    if (!this.flowSession) {
      return this.frame(events, null);
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
        : null
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
    dialogue: (DialogueLine & { text: string }) | null
  ): RuntimeFrame {
    return { state: this.world, events, dialogue };
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

  private localize(key: string): string {
    return this.bundle.locales[this.locale]?.strings[key] ?? `[${key}]`;
  }
}
