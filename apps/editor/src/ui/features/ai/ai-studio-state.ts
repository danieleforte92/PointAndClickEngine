import type { AiStudioStep } from "./ai-studio-model";

export interface AiStudioState {
  advancedOpen: boolean;
  selectedGenerationTargetId: string;
  selectedPromptPackId: string | null;
  step: AiStudioStep;
}
export const initialAiStudioState: AiStudioState = {
  advancedOpen: false,
  selectedGenerationTargetId: "",
  selectedPromptPackId: null,
  step: "brief"
};

export type AiStudioAction =
  | { type: "advanced/toggle"; open?: boolean }
  | { type: "generation-target/select"; targetId: string }
  | { type: "prompt-pack/select"; promptPackId: string | null }
  | { type: "step/select"; step: AiStudioStep };

export function aiStudioReducer(state: AiStudioState, action: AiStudioAction): AiStudioState {
  switch (action.type) {
    case "advanced/toggle":
      return { ...state, advancedOpen: action.open ?? !state.advancedOpen };
    case "generation-target/select":
      return { ...state, selectedGenerationTargetId: action.targetId };
    case "prompt-pack/select":
      return { ...state, selectedPromptPackId: action.promptPackId };
    case "step/select":
      return { ...state, step: action.step };
  }
}
