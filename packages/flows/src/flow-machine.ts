import type { FlowDocument, FlowNode } from "@pointclick/contracts";
import type { GameCommand, WorldState } from "@pointclick/core";

export interface FlowSession {
  flowId: string;
  currentNodeId: string;
  done: boolean;
}

export interface DialogueLine {
  speakerId: string;
  textKey: string;
}

export interface FlowStep {
  session: FlowSession;
  commands: GameCommand[];
  line: DialogueLine | null;
}

function nodeById(flow: FlowDocument, id: string): FlowNode {
  const node = flow.nodes.find((candidate) => candidate.id === id);
  if (!node) {
    throw new Error(`Flow "${flow.id}" references missing node "${id}"`);
  }
  return node;
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
  _world: WorldState
): FlowStep {
  if (session.done) {
    return { session, commands: [], line: null };
  }

  const commands: GameCommand[] = [];
  let currentNodeId = session.currentNodeId;

  for (let guard = 0; guard < flow.nodes.length + 1; guard += 1) {
    const node = nodeById(flow, currentNodeId);

    if (node.type === "line") {
      return {
        commands,
        line: { speakerId: node.speakerId, textKey: node.textKey },
        session: { ...session, currentNodeId: node.next }
      };
    }

    if (node.type === "set-flag") {
      commands.push({ type: "flag/set", key: node.key, value: node.value });
      currentNodeId = node.next;
      continue;
    }

    commands.push({ type: "flow/end", flowId: flow.id });
    return {
      commands,
      line: null,
      session: { ...session, currentNodeId: node.id, done: true }
    };
  }

  throw new Error(`Flow "${flow.id}" exceeded its synchronous step limit`);
}

