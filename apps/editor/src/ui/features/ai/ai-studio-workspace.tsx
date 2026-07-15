import type { ReactNode, RefObject } from "react";
import type { AiStudioStep } from "./ai-studio-model";

export interface AiStudioWorkspaceProps {
  actions: AiStudioWorkspaceActions;
  children: ReactNode;
  model: AiStudioWorkspaceModel;
  workspaceRef?: RefObject<HTMLDivElement | null>;
}

export interface AiStudioWorkspaceActions {
  onStepChange: (step: AiStudioStep) => void;
}

export interface AiStudioWorkspaceModel {
  currentStep: AiStudioStep;
  steps: ReadonlyArray<{ detail: string; id: AiStudioStep; label: string }>;
}

/**
 * AI Studio owns its workflow chrome. Step content remains injectable so the
 * composition root can migrate one vertical slice at a time without making
 * the feature depend on EditorGateway or sibling workspace internals.
 */
export function AiStudioWorkspace({
  actions,
  children,
  model,
  workspaceRef
}: AiStudioWorkspaceProps) {
  return (
    <div ref={workspaceRef} className="workspace-overview build-workspace ai-workspace" data-feature="ai-studio">
      <section className="overview-card ai-guided-shell" aria-labelledby="ai-guided-title">
        <div className="ai-guided-heading">
          <div>
            <span className="overview-label">AI Studio workflow</span>
            <h2 id="ai-guided-title">Build art direction, then approve the output.</h2>
            <p>
              The mock provider is offline and deterministic. Advanced provider and workflow settings stay available
              below when you need them.
            </p>
          </div>
          <span className="capability-badge good">Local-first</span>
        </div>
        <nav className="ai-stepper" aria-label="AI Studio steps">
          {model.steps.map((step, index) => (
            <button
              aria-current={model.currentStep === step.id ? "step" : undefined}
              className={model.currentStep === step.id ? "active" : ""}
              key={step.id}
              type="button"
              onClick={() => actions.onStepChange(step.id)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </button>
          ))}
        </nav>
      </section>
      {children}
    </div>
  );
}
