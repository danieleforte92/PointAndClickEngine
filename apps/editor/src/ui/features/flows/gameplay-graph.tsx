import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node, type NodeChange } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { FlowDocument, GameplayGraphLayout, Layered2DScene } from "@pointclick/contracts";
import { useMemo, useState } from "react";
import { deriveGameplayGraph } from "./gameplay-graph-model";

export interface GameplayTransitionDraft {
  entryPoint: "player-start" | "interact-spot";
  flowId: string;
  sourceSceneId: string;
  targetSceneId: string;
  verb: "look" | "use" | "talk" | "enter";
}

export interface GameplayGraphProps {
  flows: readonly FlowDocument[];
  layout?: GameplayGraphLayout | undefined;
  onChangeLayout: (layout: GameplayGraphLayout) => void;
  onCreateTransition?: ((draft: GameplayTransitionDraft) => void | Promise<void>) | undefined;
  onOpenScene: (sceneId: string) => void;
  onStartTransitionWizard: (sceneId: string) => void;
  scenes: readonly Layered2DScene[];
}

export function GameplayGraph({ flows, layout, onChangeLayout, onCreateTransition, onOpenScene, onStartTransitionWizard, scenes }: GameplayGraphProps) {
  const [wizardSceneId, setWizardSceneId] = useState<string | null>(null);
  const [wizardFlowId, setWizardFlowId] = useState(flows[0]?.id ?? "");
  const [wizardTargetSceneId, setWizardTargetSceneId] = useState(() => scenes.find((scene) => scene.id !== scenes[0]?.id)?.id ?? scenes[0]?.id ?? "");
  const [wizardVerb, setWizardVerb] = useState<GameplayTransitionDraft["verb"]>("use");
  const [wizardEntryPoint, setWizardEntryPoint] = useState<GameplayTransitionDraft["entryPoint"]>("player-start");
  const [wizardSubmitted, setWizardSubmitted] = useState(false);
  const graph = useMemo(() => deriveGameplayGraph(scenes, flows), [flows, scenes]);
  const nodes = useMemo<Array<Node>>(() => graph.nodes.map((node, index) => ({
    id: node.id,
    data: { label: node.label, kind: node.kind },
    position: layout?.nodes[node.id] ?? { x: node.kind === "scene" ? 80 : 360, y: 60 + index * 120 },
    type: "default"
  })), [graph.nodes, layout]);
  const edges = useMemo<Edge[]>(() => graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    animated: true,
    type: "smoothstep"
  })), [graph.edges]);

  const handleNodesChange = (changes: NodeChange[]) => {
    const nextNodes = { ...(layout?.nodes ?? {}) };
    for (const change of changes) {
      if (change.type === "position" && change.position) nextNodes[change.id] = change.position;
    }
    if (changes.some((change) => change.type === "position")) {
      onChangeLayout({ nodes: nextNodes, viewport: layout?.viewport ?? { x: 0, y: 0, zoom: 0.8 } });
    }
  };

  return (
    <section className="gameplay-graph-workspace" aria-label="Gameplay graph">
      <div className="flow-workspace-toolbar">
        <div>
          <span>Gameplay graph</span>
          <strong>Scene transitions derived from existing Flows</strong>
        </div>
        <div className="flow-workspace-actions">
          {scenes.slice(0, 3).map((scene) => (
            <button key={scene.id} type="button" onClick={() => {
              setWizardSceneId(scene.id);
              setWizardTargetSceneId(scenes.find((candidate) => candidate.id !== scene.id)?.id ?? scene.id);
              setWizardSubmitted(false);
              onStartTransitionWizard(scene.id);
            }}>
              + Link from {scene.name}
            </button>
          ))}
        </div>
      </div>
      {wizardSceneId ? (
        <form
          className="transition-wizard"
          aria-label="Guided transition wizard"
          onSubmit={(event) => {
            event.preventDefault();
            if (!wizardFlowId || !wizardTargetSceneId) return;
            setWizardSubmitted(true);
            void onCreateTransition?.({
              entryPoint: wizardEntryPoint,
              flowId: wizardFlowId,
              sourceSceneId: wizardSceneId,
              targetSceneId: wizardTargetSceneId,
              verb: wizardVerb
            });
          }}
        >
          <div>
            <span>Guided transition wizard</span>
            <strong>Link from {scenes.find((scene) => scene.id === wizardSceneId)?.name ?? wizardSceneId}</strong>
          </div>
          <label>Flow<select aria-label="Transition flow" value={wizardFlowId} onChange={(event) => setWizardFlowId(event.target.value)}>{flows.map((flow) => <option key={flow.id} value={flow.id}>{flow.name}</option>)}</select></label>
          <label>Destination<select aria-label="Transition destination" value={wizardTargetSceneId} onChange={(event) => setWizardTargetSceneId(event.target.value)}>{scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</select></label>
          <label>Verb<select aria-label="Transition verb" value={wizardVerb} onChange={(event) => setWizardVerb(event.target.value as GameplayTransitionDraft["verb"])}><option value="look">Look</option><option value="use">Use</option><option value="talk">Talk</option><option value="enter">Enter</option></select></label>
          <label>Entry point<select aria-label="Transition entry point" value={wizardEntryPoint} onChange={(event) => setWizardEntryPoint(event.target.value as GameplayTransitionDraft["entryPoint"])}><option value="player-start">Player start</option><option value="interact-spot">Interaction spot</option></select></label>
          <button type="submit">Apply transition</button>
          <button type="button" onClick={() => setWizardSceneId(null)}>Cancel</button>
          {wizardSubmitted ? <output role="status">Transition saved to the selected Flow.</output> : null}
        </form>
      ) : null}
      <div className="gameplay-graph-canvas">
        {graph.edges.length === 0 ? (
          <div className="graph-empty-state">
            <strong>No scene transitions yet</strong>
            <p>Use the guided link action to create or update a change-scene node in an existing Flow.</p>
          </div>
        ) : null}
        <ReactFlow
          colorMode="dark"
          edges={edges}
          fitView
          minZoom={0.25}
          nodes={nodes}
          onNodeClick={(_event, node) => {
            if (node.id.startsWith("scene:")) onOpenScene(node.id.slice("scene:".length));
          }}
          onNodesChange={handleNodesChange}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="var(--pc-border-strong)" gap={28} size={1} />
          <MiniMap pannable zoomable nodeColor={(node) => node.id.startsWith("scene:") ? "var(--pc-state-info)" : "var(--pc-state-warning)"} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  );
}
