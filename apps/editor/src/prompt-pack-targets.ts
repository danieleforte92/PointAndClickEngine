import type { PromptPackDocument, PromptPackGenerationTarget, StyleBibleDocument } from "@pointclick/contracts";

type PromptEntry = { id: string; prompt: string };

export interface PromptTargetResolution {
  match: "background" | "source-entity" | "target-id" | "legacy-affix" | "fallback";
  prompt: string;
  promptId?: string;
  warning?: string;
}

function shouldUseCharacterPrompts(target: PromptPackGenerationTarget) {
  if (target.intendedUse === "prop") return false;

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

function styleBiblePositivePrompt(styleBible: StyleBibleDocument | null | undefined): string {
  if (!styleBible) return "";

  const parts = [
    `medium: ${styleBible.medium}`,
    styleBible.palette.length ? `palette: ${styleBible.palette.join(", ")}` : "",
    styleBible.camera ? `camera: ${styleBible.camera}` : "",
    styleBible.linework ? `linework: ${styleBible.linework}` : "",
    styleBible.lighting ? `lighting: ${styleBible.lighting}` : "",
    styleBible.referenceAssetIds?.length ? `style references: ${styleBible.referenceAssetIds.join(", ")}` : "",
    styleBible.loraTags?.length ? `LoRA tags: ${styleBible.loraTags.join(", ")}` : ""
  ].filter(Boolean);

  return parts.length ? `Style bible "${styleBible.name}": ${parts.join("; ")}.` : "";
}

function chromaColorForTarget(target: PromptPackGenerationTarget): string {
  return target.chromaColor ?? (target.backgroundMode === "chroma-green" ? "#00FF00" : "#00A2FF");
}

function targetOutputContractPrompt(target: PromptPackGenerationTarget): string {
  if (target.backgroundMode === "chroma-blue" || target.backgroundMode === "chroma-green") {
    const color = chromaColorForTarget(target);
    return `Output contract: isolate only the requested subject on a perfectly flat ${color} chroma key background. The entire background must be one solid, untextured color from edge to edge, with no scenery, no gradients, no floor, no cast shadow, no contact shadow, no props behind the subject, and clean empty margins for chroma key removal.`;
  }

  if (target.backgroundMode === "transparent-alpha" || target.expectedAlpha || target.transparent) {
    return "Output contract: isolate only the requested subject for transparent PNG alpha. Do not include scenery, floor plane, cast shadow, contact shadow, border, frame, or background props.";
  }

  return "";
}

export function composeTargetPositivePrompt(
  basePrompt: string,
  target: PromptPackGenerationTarget,
  styleBible?: StyleBibleDocument | null
): string {
  const customization = target.customPositivePrompt?.trim();
  return [
    basePrompt.trim(),
    styleBiblePositivePrompt(styleBible),
    customization ? `Target customization: ${customization}` : "",
    targetOutputContractPrompt(target)
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function composeTargetNegativePrompt(
  promptPack: PromptPackDocument,
  target: PromptPackGenerationTarget,
  styleBible?: StyleBibleDocument | null
): string {
  const chromaNegativePrompt =
    target.backgroundMode === "chroma-blue" || target.backgroundMode === "chroma-green"
      ? "detailed background, environment, scenery, gradient background, textured background, patterned backdrop, floor, ground plane, contact shadow, cast shadow, vignette, props behind subject"
      : undefined;
  const parts = [
    target.safetyNegativePrompt,
    target.customNegativePrompt,
    chromaNegativePrompt,
    styleBible?.negativePrompt,
    styleBible?.forbidden?.join(", "),
    promptPack.outputs.negativePrompt
  ];
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const part of parts) {
    for (const item of part?.split(",") ?? []) {
      const trimmed = item.trim();
      const key = trimmed.toLowerCase();
      if (!trimmed || seen.has(key)) continue;
      seen.add(key);
      merged.push(trimmed);
    }
  }
  return merged.join(", ");
}
