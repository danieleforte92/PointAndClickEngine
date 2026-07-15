import type { PromptPackGenerationTarget } from "@pointclick/contracts";

/**
 * Shared context exchanged by AI Studio, Scenes, and Assets.
 *
 * Keep this contract independent from any feature implementation so the
 * workspace modules can be developed and tested without importing one
 * another's internals. The shape intentionally matches the existing AI
 * handoff types; this file only changes ownership, not runtime behavior.
 */
export type ImageGenerationEntityKind =
  | "scene-background"
  | "layer"
  | "actor"
  | "pickup"
  | "player"
  | "hotspot"
  | "asset";

export interface ImageGenerationSceneContext {
  entityId?: string;
  entityKind: ImageGenerationEntityKind;
  intendedUse: PromptPackGenerationTarget["intendedUse"];
  sceneId: string;
  targetId: string;
}

export interface GeneratedAssetHandoff extends ImageGenerationSceneContext {
  assetId: string;
  assetPath: string;
  backgroundMode?: PromptPackGenerationTarget["backgroundMode"];
  expectedAlpha: boolean;
  hasAlphaPixels: boolean;
  outputWarning?: string;
  seed: number;
}

export interface CandidateHandoffContext extends ImageGenerationSceneContext {
  backgroundMode?: PromptPackGenerationTarget["backgroundMode"];
  expectedAlpha: boolean;
}
