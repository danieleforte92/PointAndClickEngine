import type { PromptPackOutputs } from "@pointclick/contracts";

type PromptPackProviderOutputs = Omit<PromptPackOutputs, "generationTargets">;

function parseJsonText(text: string) {
  const trimmed = text.trim();
  const withoutFence = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()
    : trimmed;
  return JSON.parse(withoutFence) as unknown;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return [value];
  }
  return [];
}

function promptArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const id = stringValue(record.id).trim();
    const prompt = stringValue(record.prompt).trim();
    return id && prompt ? [{ id, prompt }] : [];
  });
}

export function normalizePromptPackOutputs(text: string, providerName: string): PromptPackProviderOutputs {
  const value = parseJsonText(text);
  if (!value || typeof value !== "object") {
    throw new Error(`${providerName} response did not include a JSON object`);
  }

  const record = value as Record<string, unknown>;
  const sceneBackgroundPrompt = stringValue(record.sceneBackgroundPrompt).trim();
  if (!sceneBackgroundPrompt) {
    throw new Error(`${providerName} response did not include sceneBackgroundPrompt`);
  }

  return {
    sceneBackgroundPrompt,
    propPrompts: promptArray(record.propPrompts),
    characterReferencePrompts: promptArray(record.characterReferencePrompts),
    animationNotes: stringArray(record.animationNotes),
    negativePrompt: stringValue(record.negativePrompt),
    styleNotes: stringArray(record.styleNotes)
  };
}
