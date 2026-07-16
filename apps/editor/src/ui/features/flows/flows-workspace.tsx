import type { GameplayGraphLayout, FlowDocument, FlowEditorLayout, Layered2DScene } from "@pointclick/contracts";
import type { ReactNode } from "react";
import { GameplayGraph, type GameplayTransitionDraft } from "./gameplay-graph";

export type FlowsWorkspaceMode = "gameplay" | "narrative";

export interface FlowsWorkspaceProps {
  flows: readonly FlowDocument[];
  gameplayLayout?: GameplayGraphLayout | undefined;
  mode: FlowsWorkspaceMode;
  narrative: ReactNode;
  onChangeGameplayLayout: (layout: GameplayGraphLayout) => void;
  onCreateTransition?: (draft: GameplayTransitionDraft) => void | Promise<void>;
  onModeChange: (mode: FlowsWorkspaceMode) => void;
  onOpenScene: (sceneId: string) => void;
  onStartTransitionWizard: (sceneId: string) => void;
  scenes: readonly Layered2DScene[];
}

export function FlowsWorkspace({
  flows,
  gameplayLayout,
  mode,
  narrative,
  onChangeGameplayLayout,
  onCreateTransition,
  onModeChange,
  onOpenScene,
  onStartTransitionWizard,
  scenes
}: FlowsWorkspaceProps) {
  return (
    <section className="flows-workspace" data-flow-mode={mode} aria-label="Flows workspace">
      <div className="flows-workspace-tabs" role="tablist" aria-label="Flow views">
        <button aria-selected={mode === "gameplay"} role="tab" type="button" onClick={() => onModeChange("gameplay")}>Gameplay</button>
        <button aria-selected={mode === "narrative"} role="tab" type="button" onClick={() => onModeChange("narrative")}>Narrative</button>
      </div>
      {mode === "gameplay" ? (
        <GameplayGraph
          flows={flows}
          layout={gameplayLayout}
          onChangeLayout={onChangeGameplayLayout}
          onCreateTransition={onCreateTransition}
          onOpenScene={onOpenScene}
          onStartTransitionWizard={onStartTransitionWizard}
          scenes={scenes}
        />
      ) : narrative}
    </section>
  );
}

export function flowEditorLayoutToGameplayLayout(layout: FlowEditorLayout | undefined): GameplayGraphLayout | undefined {
  if (!layout) return undefined;
  return layout;
}
