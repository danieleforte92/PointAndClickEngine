import type { EditorProjectSnapshot } from "./preload";

export interface GenerateImageAssetRequest {
  baseUrl?: string;
  backgroundMode?: "opaque-scene" | "transparent-alpha" | "chroma-blue" | "chroma-green" | "reference-only";
  checkpointName?: string;
  expectedAlpha?: boolean;
  guideIds?: string[];
  height: number;
  maskAssetId?: string;
  negativePrompt?: string;
  promptPackId?: string;
  prompt: string;
  providerId: "comfyui";
  referenceAssetIds?: string[];
  seed?: number;
  targetId: string;
  timeoutMs?: number;
  width: number;
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
  provider: "comfyui";
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
