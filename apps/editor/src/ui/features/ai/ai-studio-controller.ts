import { aiStudioReducer, type AiStudioAction, type AiStudioState } from "./ai-studio-state";
import { aiStudioSteps, type AiStudioStep } from "./ai-studio-model";

export interface AiStudioController {
  modelFor(state: AiStudioState): {
    currentStep: AiStudioStep;
    steps: typeof aiStudioSteps;
  };
  reduce(state: AiStudioState, action: AiStudioAction): AiStudioState;
  canGenerate(state: AiStudioState, hasTarget: boolean): boolean;
}

/** Pure workflow boundary used by the AI view and its focused tests. */
export function createAiStudioController(): AiStudioController {
  return {
    modelFor: (state) => ({ currentStep: state.step, steps: aiStudioSteps }),
    reduce: aiStudioReducer,
    canGenerate: (state, hasTarget) => hasTarget && state.step === "generate"
  };
}
