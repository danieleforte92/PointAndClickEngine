import type { EditorProjectSnapshot } from "./preload";
import type { PromptPackGenerationTarget, WorkflowFamily } from "@pointclick/contracts";

export type ImageGenerationProviderId = "comfyui-local" | "openai-image" | "google-image";
export type ImageGenerationJobStatus = "queued" | "running" | "completed" | "failed" | "timedOut" | "cancelled";

export interface ImageGenerationReferenceAsset {
  bytes: Uint8Array | Buffer;
  filename: string;
  id: string;
  mimeType: string;
}

export interface ImageGenerationProviderRequest {
  height: number;
  maskAsset?: ImageGenerationReferenceAsset;
  negativePrompt?: string;
  output: {
    expectedAlpha: boolean;
    mode?: GenerateImageAssetRequest["backgroundMode"];
    nodeId?: string;
  };
  prompt: string;
  providerConfig: Record<string, unknown>;
  recipeId?: string;
  referenceAssets?: ImageGenerationReferenceAsset[];
  seed?: number;
  targetId: string;
  timeoutMs?: number;
  width: number;
  workflowFamily?: WorkflowFamily;
  workflowId?: string;
}

export interface ImageGenerationProviderResult {
  bytes: Uint8Array;
  costUsd?: number;
  filename: string;
  height: number;
  latencyMs?: number;
  mimeType: string;
  model?: string;
  providerId: ImageGenerationProviderId;
  providerJobId: string;
  seed?: number;
  targetId: string;
  warnings?: string[];
  width: number;
}

export interface ImageGenerationProvider {
  id: ImageGenerationProviderId;
  generate(request: ImageGenerationProviderRequest): Promise<ImageGenerationProviderResult>;
}

export interface GenerateImageAssetRequest {
  baseUrl?: string;
  backgroundMode?: "opaque-scene" | "transparent-alpha" | "chroma-blue" | "chroma-green" | "reference-only";
  checkpointName?: string;
  expectedAlpha?: boolean;
  googleAccessToken?: string;
  googleApiKey?: string;
  googleBaseUrl?: string;
  googleLocation?: string;
  googleModel?: string;
  googleProjectId?: string;
  googleProvider?: "gemini-api" | "vertex-ai";
  guideIds?: string[];
  height: number;
  maskAssetId?: string;
  negativePrompt?: string;
  openAiApiKey?: string;
  openAiBaseUrl?: string;
  openAiModel?: string;
  openAiMode?: "images-api" | "responses-api";
  promptPackId?: string;
  prompt: string;
  providerId: ImageGenerationProviderId | "comfyui";
  referenceAssetIds?: string[];
  seed?: number;
  targetId: string;
  timeoutMs?: number;
  width: number;
  outputNodeId?: string;
  recipeId?: string;
  workflowId?: string;
  workflowFamily?: WorkflowFamily;
  workflowPath?: string;
}

export interface GeneratedImageAssetJob {
  assetId: string;
  assetPath: string;
  backgroundMode?: GenerateImageAssetRequest["backgroundMode"];
  expectedAlpha: boolean;
  hasAlphaPixels: boolean;
  model: string;
  outputWarning?: string;
  promptId: string;
  provider: ImageGenerationProviderId;
  seed: number;
  snapshot: EditorProjectSnapshot;
  status: "completed";
  targetId: string;
}

export function bitmapHasAlphaPixels(bitmap: Uint8Array | Buffer): boolean {
  for (let index = 3; index < bitmap.length; index += 4) {
    if (bitmap[index]! < 255) return true;
  }
  return false;
}

export function generatedImageOutputWarning(options: {
  backgroundMode?: GenerateImageAssetRequest["backgroundMode"];
  expectedAlpha: boolean;
  hasAlphaPixels: boolean;
}): string | undefined {
  if (options.expectedAlpha && !options.hasAlphaPixels) {
    return "This target expected transparent PNG alpha, but the downloaded image is fully opaque. Use an alpha-capable ComfyUI workflow before assigning it as a transparent prop or character.";
  }

  if (
    (options.backgroundMode === "chroma-blue" || options.backgroundMode === "chroma-green") &&
    options.hasAlphaPixels
  ) {
    return "This target expected a flat chroma background, but the image already contains alpha pixels. Verify the workflow output before chroma cleanup.";
  }

  return undefined;
}

export function generatedImageParentAssetIds(options: {
  maskAssetId?: string | undefined;
  referenceAssetIds?: string[] | undefined;
}): string[] {
  const parentAssetIds: string[] = [];
  const seen = new Set<string>();
  for (const assetId of [...(options.referenceAssetIds ?? []), options.maskAssetId].filter(
    (value): value is string => Boolean(value?.trim())
  )) {
    if (seen.has(assetId)) continue;
    seen.add(assetId);
    parentAssetIds.push(assetId);
  }
  return parentAssetIds;
}

export function estimateImageWorkflowFamily(
  target: Pick<
    PromptPackGenerationTarget,
    "backgroundMode" | "expectedAlpha" | "intendedUse" | "maskAssetId" | "referenceAssetId" | "transparent"
  > | null
): WorkflowFamily {
  if (target?.maskAssetId) {
    return "scene_inpaint_masked";
  }

  if (target?.referenceAssetId) {
    return "background_img2img_layout";
  }

  if (target?.intendedUse === "character-reference") {
    return "character_reference_sheet";
  }

  if (target?.intendedUse === "animation-reference" || target?.intendedUse === "sprite-sheet") {
    return "sprite_sheet_reference";
  }

  if (
    target?.intendedUse === "prop" ||
    target?.backgroundMode === "transparent-alpha" ||
    target?.backgroundMode === "chroma-blue" ||
    target?.backgroundMode === "chroma-green" ||
    target?.expectedAlpha ||
    target?.transparent
  ) {
    return "prop_isolated_alpha_or_chroma";
  }

  return "background_t2i_fast";
}
