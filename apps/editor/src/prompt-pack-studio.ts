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

export interface GeneratePromptPackRequest {
  bundle: ProjectBundle;
  sceneId: string;
  artBrief: string;
  generatedAt?: string;
}

export interface PromptPackCandidate {
  promptPack: PromptPackDocument;
  summary: string;
}

export interface PromptProviderJob {
  id: string;
  provider: "mock";
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
  "photorealism, unreadable silhouettes, cluttered UI text, warped hands, extra limbs, heavy blur, low contrast";

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

function stableHash(value: unknown) {
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

function targetForPickup(pickup: ScenePickup): PromptPackGenerationTarget {
  return {
    id: pickup.id,
    intendedUse: "prop",
    width: Math.max(1, Math.round(pickup.bounds.width)),
    height: Math.max(1, Math.round(pickup.bounds.height)),
    transparent: true
  };
}

function targetForActor(actor: SceneActor): PromptPackGenerationTarget {
  return {
    id: actor.id,
    intendedUse: actor.role === "npc" ? "character-reference" : "prop",
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
      prompt: `Transparent prop asset for "${labels[pickup.labelKey] ?? pickup.id}" in ${context.sceneName}. Match brief: ${context.artBrief}. Keep the object readable at ${Math.round(pickup.bounds.width)}x${Math.round(pickup.bounds.height)} pixels.`
    })),
    ...scene.actors
      .filter((actor) => actor.role !== "npc")
      .map((actor) => ({
        id: actor.id,
        prompt: `Transparent ${actor.role} asset for "${labels[actor.labelKey] ?? actor.id}" in ${context.sceneName}. Use strong silhouette, clean edge lighting, and the same palette as the scene.`
      }))
  ];

  const characterReferencePrompts = scene.actors
    .filter((actor) => actor.role === "npc")
    .map((actor) => ({
      id: actor.id,
      prompt: `Character reference sheet for "${labels[actor.labelKey] ?? actor.id}", an NPC in ${context.sceneName}. Front-facing neutral pose, side walk pose, talk expression, transparent background, style brief: ${context.artBrief}.`
    }));

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
        intendedUse: "scene-background",
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
          id: `${actor.id}-animation-reference`,
          intendedUse: "animation-reference" as const,
          transparent: true
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

export const mockPromptPackProvider: PromptProvider = {
  generate(request) {
    const scene = request.bundle.scenes[request.sceneId];
    if (!isLayeredScene(scene)) {
      throw new Error(`Prompt Pack Studio requires a layered-2d scene, got "${request.sceneId}"`);
    }

    const context = buildPromptPackContext(request.bundle, request.sceneId, request.artBrief);
    const inputHash = stableHash(context);
    const generatedAt = request.generatedAt ?? "2026-01-01T00:00:00.000Z";
    const jobId = `mock-${inputHash}`;
    const promptPack: PromptPackDocument = {
      schemaVersion: 1,
      id: promptPackId(scene.id),
      name: `${scene.name} Mock Prompt Pack`,
      sceneId: scene.id,
      artBrief: context.artBrief,
      context,
      outputs: buildOutputs(scene, context),
      suggestedActors: buildSuggestedActors(scene, context),
      provenance: {
        provider: "mock",
        model: mockModel,
        generatedAt,
        inputHash,
        jobId,
        seed: inputHash
      }
    };

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
