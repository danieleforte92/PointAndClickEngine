import type {
  ConditionExpression,
  FlowChoice,
  FlowDocument,
  FlowNode,
  FlowPresentationCue
} from "@pointclick/contracts";
import type { GameCommand, WorldState } from "@pointclick/core";

export interface FlowStackFrame {
  flowId: string;
  nextNodeId: string;
}

export interface FlowSession {
  flowId: string;
  currentNodeId: string;
  done: boolean;
  stack?: FlowStackFrame[];
  waitingUntil?: number;
}

export interface DialogueLine {
  speakerId: string;
  textKey: string;
}

export interface FlowChoiceOption extends FlowChoice {}

export interface FlowStep {
  session: FlowSession;
  commands: GameCommand[];
  line: DialogueLine | null;
  promptKey: string | null;
  choices: FlowChoiceOption[];
  cues: FlowPresentationCue[];
  waitUntil: number | null;
}

export interface FlowMachineOptions {
  flows?: Readonly<Record<string, FlowDocument>>;
  now?: number;
}

function nodeById(flow: FlowDocument, id: string): FlowNode {
  const node = flow.nodes.find((candidate) => candidate.id === id);
  if (!node) {
    throw new Error(`Flow "${flow.id}" references missing node "${id}"`);
  }
  return node;
}

function resolveFlow(
  flow: FlowDocument,
  flowId: string,
  options: FlowMachineOptions
): FlowDocument {
  if (flow.id === flowId) return flow;
  const resolved = options.flows?.[flowId];
  if (!resolved) {
    throw new Error(`Flow "${flow.id}" references missing sub-flow "${flowId}"`);
  }
  return resolved;
}

function evaluateCondition(condition: ConditionExpression, world: WorldState): boolean {
  if (condition.type === "flag-equals") {
    return world.flags[condition.key] === condition.value;
  }
  return world.inventory.includes(condition.itemId);
}

function step(
  session: FlowSession,
  commands: GameCommand[] = [],
  line: DialogueLine | null = null,
  promptKey: string | null = null,
  choices: FlowChoiceOption[] = [],
  cues: FlowPresentationCue[] = [],
  waitUntil: number | null = null
): FlowStep {
  return { session, commands, line, promptKey, choices, cues, waitUntil };
}

export function createFlowSession(flow: FlowDocument): FlowSession {
  return {
    flowId: flow.id,
    currentNodeId: flow.startNodeId,
    done: false
  };
}

export function advanceFlow(
  flow: FlowDocument,
  session: FlowSession,
  world: WorldState,
  options: FlowMachineOptions = {}
): FlowStep {
  if (session.done) return step(session);

  const commands: GameCommand[] = [];
  const cues: FlowPresentationCue[] = [];
  let activeFlow = flow;
  let activeSession: FlowSession = {
    ...session,
    ...(session.stack ? { stack: session.stack.map((frame) => ({ ...frame })) } : {})
  };
  const now = options.now ?? Date.now();

  if (activeSession.waitingUntil !== undefined) {
    if (now < activeSession.waitingUntil) {
      return step(
        activeSession,
        commands,
        null,
        null,
        [],
        cues,
        activeSession.waitingUntil
      );
    }
    const { waitingUntil: _waitingUntil, ...readySession } = activeSession;
    activeSession = readySession;
  }

  for (let guard = 0; guard < activeFlow.nodes.length + 1 + (activeSession.stack?.length ?? 0) * 2; guard += 1) {
    const node = nodeById(activeFlow, activeSession.currentNodeId);

    if (node.type === "line") {
      return step(
        { ...activeSession, currentNodeId: node.next },
        commands,
        { speakerId: node.speakerId, textKey: node.textKey },
        null,
        [],
        cues
      );
    }

    if (node.type === "choice") {
      const choices = node.choices.filter(
        (choice) => !choice.when || evaluateCondition(choice.when, world)
      );
      return step({ ...activeSession }, commands, null, node.promptKey, choices, cues);
    }

    if (node.type === "set-flag") {
      commands.push({ type: "flag/set", key: node.key, value: node.value });
      activeSession = { ...activeSession, currentNodeId: node.next };
      continue;
    }

    if (node.type === "condition") {
      activeSession = {
        ...activeSession,
        currentNodeId: evaluateCondition(node.when, world) ? node.ifTrue : node.ifFalse
      };
      continue;
    }

    if (node.type === "change-scene") {
      commands.push({
        type: "scene/change",
        sceneId: node.targetSceneId,
        player: node.playerStart ?? world.player
      });
      activeSession = { ...activeSession, currentNodeId: node.next };
      continue;
    }

    if (node.type === "inventory") {
      commands.push({
        type: node.action === "add" ? "inventory/add" : "inventory/remove",
        itemId: node.itemId
      });
      activeSession = { ...activeSession, currentNodeId: node.next };
      continue;
    }

    if (node.type === "wait") {
      const waitUntil = now + node.durationMs;
      return step(
        { ...activeSession, currentNodeId: node.next, waitingUntil: waitUntil },
        commands,
        null,
        null,
        [],
        cues,
        waitUntil
      );
    }

    if (node.type === "cue") {
      cues.push(node.cue);
      activeSession = { ...activeSession, currentNodeId: node.next };
      continue;
    }

    if (node.type === "sub-flow") {
      const subFlow = resolveFlow(activeFlow, node.flowId, options);
      commands.push({ type: "flow/start", flowId: subFlow.id });
      activeSession = {
        ...activeSession,
        flowId: subFlow.id,
        currentNodeId: subFlow.startNodeId,
        stack: [
          ...(activeSession.stack ?? []),
          { flowId: activeFlow.id, nextNodeId: node.next }
        ]
      };
      activeFlow = subFlow;
      continue;
    }

    commands.push({ type: "flow/end", flowId: activeFlow.id });
    const stack = activeSession.stack ?? [];
    const parent = stack.at(-1);
    if (!parent) {
      return step(
        { ...activeSession, currentNodeId: node.id, done: true },
        commands,
        null,
        null,
        [],
        cues
      );
    }

    activeFlow = resolveFlow(activeFlow, parent.flowId, options);
    activeSession = {
      ...activeSession,
      flowId: parent.flowId,
      currentNodeId: parent.nextNodeId,
      stack: stack.slice(0, -1)
    };
  }

  throw new Error(`Flow "${flow.id}" exceeded its synchronous step limit`);
}

export function chooseFlowChoice(
  flow: FlowDocument,
  session: FlowSession,
  choiceId: string,
  world: WorldState,
  options: FlowMachineOptions = {}
): FlowStep {
  const node = nodeById(flow, session.currentNodeId);
  if (node.type !== "choice") {
    throw new Error(`Flow "${flow.id}" is not waiting for a choice.`);
  }
  const choice = node.choices.find(
    (candidate) =>
      candidate.id === choiceId && (!candidate.when || evaluateCondition(candidate.when, world))
  );
  if (!choice) {
    throw new Error(`Flow "${flow.id}" does not expose choice "${choiceId}".`);
  }
  return advanceFlow(
    flow,
    { ...session, currentNodeId: choice.next },
    world,
    options
  );
}
