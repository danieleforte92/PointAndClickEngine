import type { FlowDocument, Layered2DScene } from "@pointclick/contracts";

export interface GameplayGraphNode {
  id: string;
  kind: "scene" | "flow";
  label: string;
  sceneId?: string;
  flowId?: string;
}

export interface GameplayGraphEdge {
  id: string;
  source: string;
  target: string;
  flowId: string;
  label: string;
  targetSceneId: string;
}

export interface GameplayGraphModel {
  nodes: GameplayGraphNode[];
  edges: GameplayGraphEdge[];
}

function flowOwnerSceneIds(scene: Layered2DScene, flowId: string): boolean {
  return scene.hotspots.some((hotspot) =>
    [hotspot.actions.lookFlowId, hotspot.actions.talkFlowId, hotspot.actions.useFlowId, ...hotspot.actions.useItemFlows.map((entry) => entry.flowId)].includes(flowId)
  ) || scene.actors.some((actor) =>
    [actor.actions.lookFlowId, actor.actions.talkFlowId, actor.actions.useFlowId, ...actor.actions.useItemFlows.map((entry) => entry.flowId)].includes(flowId)
  ) || scene.pickups.some((pickup) => pickup.pickupFlowId === flowId);
}

/** Gameplay is a derived view over scenes, triggers, and existing Flow docs. */
export function deriveGameplayGraph(scenes: readonly Layered2DScene[], flows: readonly FlowDocument[]): GameplayGraphModel {
  const nodes: GameplayGraphNode[] = [
    ...scenes.map((scene) => ({ id: `scene:${scene.id}`, kind: "scene" as const, label: scene.name, sceneId: scene.id })),
    ...flows.map((flow) => ({ id: `flow:${flow.id}`, kind: "flow" as const, label: flow.name, flowId: flow.id }))
  ];
  const edges: GameplayGraphEdge[] = [];
  for (const flow of flows) {
    const transitions = flow.nodes.filter((node) => node.type === "change-scene");
    for (const scene of scenes) {
      const isOwner = flow.sceneEntryTriggers?.some((trigger) => trigger.sceneId === scene.id) || flowOwnerSceneIds(scene, flow.id);
      if (!isOwner) continue;
      for (const [index, node] of transitions.entries()) {
        const targetScene = scenes.find((candidate) => candidate.id === node.targetSceneId);
        if (!targetScene) continue;
        edges.push({
          id: `${scene.id}:${flow.id}:${node.id}:${index}`,
          source: `scene:${scene.id}`,
          target: `scene:${targetScene.id}`,
          flowId: flow.id,
          label: flow.name,
          targetSceneId: targetScene.id
        });
      }
    }
  }
  return { nodes, edges };
}

export function gameplayGraphNodeId(kind: GameplayGraphNode["kind"], id: string): string {
  return `${kind}:${id}`;
}

