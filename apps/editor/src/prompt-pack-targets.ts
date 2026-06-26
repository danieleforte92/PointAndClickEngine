import type { PromptPackDocument, PromptPackGenerationTarget } from "@pointclick/contracts";

type PromptEntry = { id: string; prompt: string };

export interface PromptTargetResolution {
  match: "background" | "source-entity" | "target-id" | "legacy-affix" | "fallback";
  prompt: string;
  promptId?: string;
  warning?: string;
}

function shouldUseCharacterPrompts(target: PromptPackGenerationTarget) {
  return (
    target.intendedUse === "character-reference" ||
    target.intendedUse === "animation-reference" ||
    target.intendedUse === "sprite-sheet" ||
    target.sourceEntityKind === "actor" ||
    target.sourceEntityKind === "player"
  );
}

function findById(prompts: PromptEntry[], id: string | undefined): PromptEntry | null {
  if (!id) return null;
  return prompts.find((entry) => entry.id === id) ?? null;
}

function findLegacyAffixMatch(prompts: PromptEntry[], targetId: string): PromptEntry | null {
  return (
    prompts.find(
      (entry) =>
        targetId.startsWith(`${entry.id}-`) ||
        targetId.endsWith(`-${entry.id}`) ||
        entry.id.startsWith(`${targetId}-`) ||
        entry.id.endsWith(`-${targetId}`)
    ) ?? null
  );
}

export function resolvePromptForGenerationTarget(
  promptPack: PromptPackDocument,
  target: PromptPackGenerationTarget
): PromptTargetResolution {
  if (target.intendedUse === "scene-background" || target.sourceEntityKind === "scene") {
    return {
      match: "background",
      prompt: promptPack.outputs.sceneBackgroundPrompt
    };
  }

  const prompts = shouldUseCharacterPrompts(target)
    ? promptPack.outputs.characterReferencePrompts
    : promptPack.outputs.propPrompts;
  const exactTargetMatch = findById(prompts, target.id);

  if (target.intendedUse === "sprite-sheet" && exactTargetMatch) {
    return {
      match: "target-id",
      prompt: exactTargetMatch.prompt,
      promptId: exactTargetMatch.id
    };
  }

  const sourceEntityMatch = findById(prompts, target.sourceEntityId);
  if (sourceEntityMatch) {
    return {
      match: "source-entity",
      prompt: sourceEntityMatch.prompt,
      promptId: sourceEntityMatch.id
    };
  }

  if (exactTargetMatch) {
    return {
      match: "target-id",
      prompt: exactTargetMatch.prompt,
      promptId: exactTargetMatch.id
    };
  }

  const legacyMatch = findLegacyAffixMatch(prompts, target.id);
  if (legacyMatch) {
    return {
      match: "legacy-affix",
      prompt: legacyMatch.prompt,
      promptId: legacyMatch.id
    };
  }

  return {
    match: "fallback",
    prompt: promptPack.outputs.sceneBackgroundPrompt,
    warning: `No ${target.intendedUse} prompt matched target "${target.id}". Falling back to the scene background prompt.`
  };
}
