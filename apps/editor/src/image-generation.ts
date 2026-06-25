import type { EditorProjectSnapshot } from "./preload";

export interface GenerateImageAssetRequest {
  baseUrl?: string;
  checkpointName: string;
  height: number;
  negativePrompt?: string;
  prompt: string;
  providerId: "comfyui";
  seed?: number;
  targetId: string;
  width: number;
}

export interface GeneratedImageAssetJob {
  assetId: string;
  assetPath: string;
  model: string;
  promptId: string;
  provider: "comfyui";
  seed: number;
  snapshot: EditorProjectSnapshot;
  status: "completed";
  targetId: string;
}
