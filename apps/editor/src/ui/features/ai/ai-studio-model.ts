import type {
  AssetGenerationRecipeDocument,
  Layered2DScene,
  PromptPackGenerationTarget,
  SceneGenerationGuide
} from "@pointclick/contracts";

export type {
  CandidateHandoffContext,
  GeneratedAssetHandoff,
  ImageGenerationEntityKind,
  ImageGenerationSceneContext
} from "../../shared/editor-feature-handoff";
import type {
  ImageGenerationEntityKind,
  ImageGenerationSceneContext
} from "../../shared/editor-feature-handoff";

export type AiStudioStep = "brief" | "context" | "recipe" | "generate" | "review";

export const aiStudioSteps: Array<{ id: AiStudioStep; label: string; detail: string }> = [
  { id: "brief", label: "Brief", detail: "Set the art direction." },
  { id: "context", label: "Context", detail: "Choose the project target." },
  { id: "recipe", label: "Recipe", detail: "Lock workflow and inputs." },
  { id: "generate", label: "Generate", detail: "Create temporary candidates." },
  { id: "review", label: "Review & Apply", detail: "Approve changes explicitly." }
];

export function targetMatchesGenerationGuide(
  target: PromptPackGenerationTarget,
  guide: SceneGenerationGuide
): boolean {
  if (target.guideIds?.includes(guide.id)) return true;
  const source = guide.source;
  if (source?.kind && target.sourceEntityKind && source.kind === target.sourceEntityKind) {
    return source.id ? source.id === target.sourceEntityId : true;
  }
  if (target.sourceEntityKind === "actor" && (guide.role === "actor" || guide.role === "npc")) return true;
  if (target.sourceEntityKind === "pickup" && guide.role === "pickup") return true;
  if (target.sourceEntityKind === "player" && guide.role === "player") return true;
  if (target.intendedUse === "scene-background" && (guide.role === "background" || guide.role === "context")) return true;
  if (target.intendedUse === "prop" && (guide.role === "prop" || guide.role === "pickup")) return true;
  if (
    (target.intendedUse === "character-reference" || target.intendedUse === "animation-reference" || target.intendedUse === "sprite-sheet") &&
    (guide.role === "actor" || guide.role === "npc" || guide.role === "player")
  ) {
    return true;
  }
  return guide.role === "mask";
}

export function suggestedGenerationGuideIds(
  target: PromptPackGenerationTarget | null,
  guides: SceneGenerationGuide[]
): string[] {
  if (!target) return [];
  return guides.filter((guide) => targetMatchesGenerationGuide(target, guide)).map((guide) => guide.id);
}

export function imageGenerationContextForTarget(
  target: PromptPackGenerationTarget,
  scene: Layered2DScene
): ImageGenerationSceneContext {
  if (target.intendedUse === "scene-background") {
    return {
      entityKind: "scene-background",
      intendedUse: target.intendedUse,
      sceneId: scene.id,
      targetId: target.id
    };
  }

  const pickup = scene.pickups.find((entry) => entry.id === target.id);
  if (target.sourceEntityKind === "layer" && target.sourceEntityId) {
    return {
      entityId: target.sourceEntityId,
      entityKind: "layer",
      intendedUse: target.intendedUse,
      sceneId: scene.id,
      targetId: target.id
    };
  }

  if (target.sourceEntityKind === "hotspot" && target.sourceEntityId) {
    return {
      entityId: target.sourceEntityId,
      entityKind: "hotspot",
      intendedUse: target.intendedUse,
      sceneId: scene.id,
      targetId: target.id
    };
  }

  if (pickup) {
    return {
      entityId: pickup.id,
      entityKind: "pickup",
      intendedUse: target.intendedUse,
      sceneId: scene.id,
      targetId: target.id
    };
  }

  const actor = scene.actors.find((entry) => target.id === entry.id || target.id.startsWith(`${entry.id}-`));
  if (actor) {
    return {
      entityId: actor.id,
      entityKind: "actor",
      intendedUse: target.intendedUse,
      sceneId: scene.id,
      targetId: target.id
    };
  }

  return {
    entityKind: "asset",
    intendedUse: target.intendedUse,
    sceneId: scene.id,
    targetId: target.id
  };
}

export function dimensionsForGenerationTarget(target: PromptPackGenerationTarget): { height: number; width: number } {
  const fallback = target.intendedUse === "scene-background" ? 1024 : 512;
  return {
    height: Math.max(64, Math.min(2048, target.height ?? fallback)),
    width: Math.max(64, Math.min(2048, target.width ?? fallback))
  };
}

export function expectedAlphaForBackgroundMode(
  backgroundMode: PromptPackGenerationTarget["backgroundMode"],
  fallback: boolean
): boolean {
  return backgroundMode === "transparent-alpha" ? true : backgroundMode ? false : fallback;
}

export function assetTypeForGenerationTarget(
  target: PromptPackGenerationTarget
): AssetGenerationRecipeDocument["assetType"] {
  if (target.intendedUse === "scene-background") return "background";
  if (target.intendedUse === "prop") return "prop";
  if (target.intendedUse === "character-reference") return "character";
  if (target.intendedUse === "sprite-sheet") return "sprite-sheet";
  if (target.intendedUse === "animation-reference") return "animation";
  return "prop";
}
