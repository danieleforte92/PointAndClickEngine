import type {
  Layered2DScene,
  PromptPackContext,
  PromptPackDocument,
  PromptPackGenerationTarget,
  PromptPackOutputs,
  PromptPackSuggestedActor,
  ProjectBundle,
  SceneActor,
  ScenePickup
} from "@pointclick/contracts";
import { pointClickCoreNegativePrompt } from "./prompt-pack-presets";

export interface GeneratePromptPackRequest {
  bundle: ProjectBundle;
  sceneId: string;
  artBrief: string;
  generatedAt?: string;
}

export type PromptProviderId = "mock" | "openai" | "lmstudio";

export interface PromptProviderDescriptor {
  id: PromptProviderId;
  label: string;
  status: "available" | "requires-config";
  defaultModel: string;
  detail: string;
}

export interface PromptPackCandidate {
  promptPack: PromptPackDocument;
  summary: string;
}

export interface PromptProviderJob {
  id: string;
  provider: PromptProviderId;
  status: "completed";
  candidates: PromptPackCandidate[];
}

export interface PromptProvider {
  generate(request: GeneratePromptPackRequest): PromptProviderJob;
}

const mockModel = "creator-alpha-mock-v1";
const defaultArtBrief =
  "Readable 2D point-and-click adventure art, hand-painted shapes, clear interactable silhouettes, restrained palette.";
const defaultNegativePrompt =
  `photorealism, unreadable silhouettes, cluttered UI text, warped hands, extra limbs, heavy blur, low contrast, ${pointClickCoreNegativePrompt}`;

export const promptProviderDescriptors: PromptProviderDescriptor[] = [
  {
    id: "mock",
    label: "Mock deterministic",
    status: "available",
    defaultModel: mockModel,
    detail: "Offline deterministic provider for Creator Alpha fixtures and contributors without API keys."
  },
  {
    id: "openai",
    label: "OpenAI Responses API",
    status: "requires-config",
    defaultModel: "gpt-5.2",
    detail: "Uses an OpenAI API key or OPENAI_API_KEY to draft prompt-pack copy through the Responses API."
  },
  {
    id: "lmstudio",
    label: "LM Studio local",
    status: "requires-config",
    defaultModel: "local-model",
    detail: "Uses LM Studio's OpenAI-compatible local server to draft prompt packs without cloud keys."
  }
];

function isLayeredScene(scene: ProjectBundle["scenes"][string] | undefined): scene is Layered2DScene {
  return scene?.type === "layered-2d";
}

function defaultLocale(bundle: ProjectBundle) {
  return bundle.locales[bundle.manifest.defaultLocale] ?? Object.values(bundle.locales)[0] ?? null;
}

function labelFor(bundle: ProjectBundle, labelKey: string) {
  const locale = defaultLocale(bundle);
  return locale?.strings[labelKey] ?? labelKey;
}

function sentenceList(values: string[], fallback: string) {
  return values.length ? values.join(", ") : fallback;
}

export function stableHash(value: unknown) {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function promptPackId(sceneId: string) {
  return `mock-${sceneId}-art`;
}

function providerLabel(provider: PromptProviderId) {
  if (provider === "mock") return "Mock";
  if (provider === "openai") return "OpenAI";
  return "LM Studio";
}

function targetForPickup(pickup: ScenePickup): PromptPackGenerationTarget {
  return {
    id: pickup.id,
    backgroundMode: "transparent-alpha",
    expectedAlpha: true,
    intendedUse: "prop",
    marginPercent: 8,
    safetyNegativePrompt: "background, floor shadow baked into alpha, cropped object, multiple objects",
    sourceEntityId: pickup.id,
    sourceEntityKind: "pickup",
    width: Math.max(1, Math.round(pickup.bounds.width)),
    height: Math.max(1, Math.round(pickup.bounds.height)),
    transparent: true
  };
}

function targetForActor(actor: SceneActor): PromptPackGenerationTarget {
  const intendedUse = actor.role === "npc" ? "character-reference" : "prop";
  return {
    id: actor.id,
    backgroundMode: "transparent-alpha",
    expectedAlpha: true,
    intendedUse,
    marginPercent: intendedUse === "prop" ? 8 : 12,
    safetyNegativePrompt:
      intendedUse === "prop"
        ? "background, scenery, cropped object, multiple objects"
        : "background, cropped feet, extra characters, duplicate character, inconsistent costume",
    sourceEntityId: actor.id,
    sourceEntityKind: "actor",
    width: Math.max(1, Math.round(actor.bounds.width)),
    height: Math.max(1, Math.round(actor.bounds.height)),
    transparent: true
  };
}

export function buildPromptPackContext(
  bundle: ProjectBundle,
  sceneId: string,
  artBrief: string
): PromptPackContext {
  const scene = bundle.scenes[sceneId];
  if (!isLayeredScene(scene)) {
    throw new Error(`Prompt Pack Studio requires a layered-2d scene, got "${sceneId}"`);
  }

  const labelEntries = [
    ...scene.hotspots.map((hotspot) => [hotspot.labelKey, labelFor(bundle, hotspot.labelKey)] as const),
    ...scene.actors.map((actor) => [actor.labelKey, labelFor(bundle, actor.labelKey)] as const),
    ...scene.pickups.map((pickup) => [pickup.labelKey, labelFor(bundle, pickup.labelKey)] as const),
    ...Object.values(bundle.items).map((item) => [item.labelKey, labelFor(bundle, item.labelKey)] as const)
  ];

  return {
    projectTitle: bundle.manifest.title,
    sceneId: scene.id,
    sceneName: scene.name,
    sceneSize: scene.size,
    artBrief: artBrief.trim() || defaultArtBrief,
    locale: bundle.manifest.defaultLocale,
    labels: Object.fromEntries(labelEntries),
    hotspots: scene.hotspots.map((hotspot) => ({
      id: hotspot.id,
      labelKey: hotspot.labelKey
    })),
    actors: scene.actors.map((actor) => ({
      id: actor.id,
      role: actor.role,
      labelKey: actor.labelKey
    })),
    pickups: scene.pickups.map((pickup) => ({
      id: pickup.id,
      itemId: pickup.itemId,
      labelKey: pickup.labelKey
    })),
    items: Object.values(bundle.items).map((item) => ({
      id: item.id,
      labelKey: item.labelKey
    }))
  };
}

function buildOutputs(scene: Layered2DScene, context: PromptPackContext): PromptPackOutputs {
  const labels = context.labels;
  const hotspotLabels = context.hotspots.map((hotspot) => labels[hotspot.labelKey] ?? hotspot.id);
  const actorLabels = context.actors.map((actor) => labels[actor.labelKey] ?? actor.id);
  const pickupLabels = context.pickups.map((pickup) => labels[pickup.labelKey] ?? pickup.id);
  const aspectRatio = `${context.sceneSize.width}:${context.sceneSize.height}`;

  const propPrompts = [
    ...scene.pickups.map((pickup) => ({
      id: pickup.id,
      prompt: `Transparent alpha prop asset for "${labels[pickup.labelKey] ?? pickup.id}" in ${context.sceneName}. Single isolated object, clean PNG alpha edge, 8 percent padding, readable at ${Math.round(pickup.bounds.width)}x${Math.round(pickup.bounds.height)} pixels. Match brief: ${context.artBrief}.`
    })),
    ...scene.actors
      .filter((actor) => actor.role !== "npc")
      .map((actor) => ({
        id: actor.id,
        prompt: `Transparent alpha ${actor.role} asset for "${labels[actor.labelKey] ?? actor.id}" in ${context.sceneName}. Single isolated subject with clean PNG alpha edge, strong silhouette, and the same palette as the scene.`
      }))
  ];

  const characterReferencePrompts = scene.actors
    .filter((actor) => actor.role === "npc")
    .flatMap((actor) => [
      {
        id: actor.id,
        prompt: `Transparent alpha full-body character reference for "${labels[actor.labelKey] ?? actor.id}", an NPC in ${context.sceneName}. Neutral readable pose, visible feet, clean PNG alpha edge, 12 percent padding, style brief: ${context.artBrief}.`
      },
      {
        id: `${actor.id}-sprite-sheet`,
        prompt: `Sprite sheet for "${labels[actor.labelKey] ?? actor.id}" on a flat #00A2FF chroma-blue background. Include idle, walk, and talk frames in a clean grid, consistent scale, visible feet, stable foot origin, no transparency required before chroma cleanup. Style brief: ${context.artBrief}.`
      }
    ]);

  return {
    sceneBackgroundPrompt: `Wide layered 2D adventure background for "${context.sceneName}" (${aspectRatio}). Project: ${context.projectTitle}. Include readable navigation space and clear areas for ${sentenceList(hotspotLabels, "future hotspots")}. Style brief: ${context.artBrief}.`,
    propPrompts,
    characterReferencePrompts,
    animationNotes: [
      "Keep walk cycles centered on a stable foot origin so Character Gym can align depth and path playback.",
      "Author idle, walk, and talk clips as short loops with consistent frame size and transparent backgrounds.",
      `Scene interactables to preserve: ${sentenceList([...pickupLabels, ...actorLabels], "none yet")}.`
    ],
    negativePrompt: defaultNegativePrompt,
    styleNotes: [
      "Use high-contrast silhouettes for all clickable objects.",
      "Keep scene depth readable with foreground, midground, and background bands.",
      "Avoid baked text in artwork; labels stay in locale documents."
    ],
    generationTargets: [
      {
        id: `${scene.id}-background`,
        backgroundMode: "opaque-scene",
        expectedAlpha: false,
        intendedUse: "scene-background",
        marginPercent: 0,
        safetyNegativePrompt: "transparent background, floating isolated props, UI, text, logo, watermark",
        sourceEntityId: scene.id,
        sourceEntityKind: "scene",
        width: context.sceneSize.width,
        height: context.sceneSize.height,
        aspectRatio,
        transparent: false
      },
      ...scene.pickups.map(targetForPickup),
      ...scene.actors.map(targetForActor),
      ...scene.actors
        .filter((actor) => actor.role === "npc")
        .map((actor) => ({
          id: `${actor.id}-sprite-sheet`,
          backgroundMode: "chroma-blue" as const,
          chromaColor: "#00A2FF" as const,
          expectedAlpha: false,
          intendedUse: "sprite-sheet" as const,
          marginPercent: 4,
          safetyNegativePrompt:
            "transparent alpha, detailed background, perspective floor, cropped feet, inconsistent frame size",
          sourceEntityId: actor.id,
          sourceEntityKind: "actor" as const,
          transparent: false
        }))
    ]
  };
}

function buildSuggestedActors(scene: Layered2DScene, context: PromptPackContext): PromptPackSuggestedActor[] {
  return scene.actors.map((actor) => {
    const suggestedActor: PromptPackSuggestedActor = {
      id: actor.id,
      role: actor.role,
      label: context.labels[actor.labelKey] ?? actor.id,
      visualPrompt: `Review or regenerate "${context.labels[actor.labelKey] ?? actor.id}" as a ${actor.role} asset for ${context.sceneName}.`,
      suggestedBounds: actor.bounds
    };

    if (actor.interactSpot) {
      suggestedActor.suggestedInteractSpot = actor.interactSpot;
    }
    if (actor.lookSpot) {
      suggestedActor.suggestedLookSpot = actor.lookSpot;
    }

    return suggestedActor;
  });
}

function appendArtDirection(prompt: string, context: PromptPackContext) {
  const trimmedPrompt = prompt.trim();
  const artBrief = context.artBrief.trim();
  if (!artBrief || trimmedPrompt.includes(artBrief)) return trimmedPrompt;
  return `${trimmedPrompt} Art direction: ${artBrief}`;
}

function mergeUniqueTextParts(parts: Array<string | undefined>) {
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

function mergeOutputsWithArtDirection(
  deterministicOutputs: PromptPackOutputs,
  context: PromptPackContext,
  outputsOverride?: Omit<PromptPackOutputs, "generationTargets">
): PromptPackOutputs {
  const merged = {
    ...deterministicOutputs,
    ...outputsOverride,
    generationTargets: deterministicOutputs.generationTargets
  };

  return {
    ...merged,
    sceneBackgroundPrompt: appendArtDirection(merged.sceneBackgroundPrompt, context),
    propPrompts: merged.propPrompts.map((prompt) => ({
      ...prompt,
      prompt: appendArtDirection(prompt.prompt, context)
    })),
    characterReferencePrompts: merged.characterReferencePrompts.map((prompt) => ({
      ...prompt,
      prompt: appendArtDirection(prompt.prompt, context)
    })),
    negativePrompt: mergeUniqueTextParts([deterministicOutputs.negativePrompt, outputsOverride?.negativePrompt]),
    styleNotes: [
      ...deterministicOutputs.styleNotes,
      ...(outputsOverride?.styleNotes ?? []),
      `Art direction source: ${context.artBrief}`
    ],
    generationTargets: deterministicOutputs.generationTargets
  };
}

export function createPromptPackDocument(
  request: GeneratePromptPackRequest,
  provenance: {
    provider: PromptProviderId;
    model: string;
    jobId: string;
    seed?: string | number;
  },
  outputsOverride?: Omit<PromptPackOutputs, "generationTargets">
): PromptPackDocument {
  const scene = request.bundle.scenes[request.sceneId];
  if (!isLayeredScene(scene)) {
    throw new Error(`Prompt Pack Studio requires a layered-2d scene, got "${request.sceneId}"`);
  }

  const context = buildPromptPackContext(request.bundle, request.sceneId, request.artBrief);
  const inputHash = stableHash(context);
  const generatedAt = request.generatedAt ?? "2026-01-01T00:00:00.000Z";
  const deterministicOutputs = buildOutputs(scene, context);
  const outputs = mergeOutputsWithArtDirection(deterministicOutputs, context, outputsOverride);

  return {
    schemaVersion: 1,
    id: promptPackId(scene.id),
    name: `${scene.name} ${providerLabel(provenance.provider)} Prompt Pack`,
    sceneId: scene.id,
    artBrief: context.artBrief,
    context,
    outputs,
    suggestedActors: buildSuggestedActors(scene, context),
    provenance: {
      provider: provenance.provider,
      model: provenance.model,
      generatedAt,
      inputHash,
      jobId: provenance.jobId,
      seed: provenance.seed ?? inputHash
    }
  };
}

export const mockPromptPackProvider: PromptProvider = {
  generate(request) {
    const context = buildPromptPackContext(request.bundle, request.sceneId, request.artBrief);
    const inputHash = stableHash(context);
    const jobId = `mock-${inputHash}`;
    const promptPack = createPromptPackDocument(request, {
      provider: "mock",
      model: mockModel,
      jobId,
      seed: inputHash
    });

    return {
      id: jobId,
      provider: "mock",
      status: "completed",
      candidates: [
        {
          promptPack,
          summary: `${promptPack.outputs.generationTargets.length} target(s), ${promptPack.outputs.propPrompts.length} prop prompt(s), ${promptPack.outputs.characterReferencePrompts.length} character prompt(s).`
        }
      ]
    };
  }
};
