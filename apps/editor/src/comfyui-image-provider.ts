import { ComfyUIClient, type ComfyUIUploadedImage, type ComfyUIUploadInput } from "./comfyui-client";
import { type ComfyUIJobStore, InMemoryComfyUIJobStore } from "./comfyui-job-store";
import { findImageReference } from "./comfyui-output-parser";
import {
  buildTextToImageWorkflow,
  checkpointNameFromWorkflow,
  patchCustomWorkflow,
  patchWorkflowWithBindings
} from "./comfyui-workflow-patcher";
import type { WorkflowTemplateBinding } from "@pointclick/contracts";

export interface ComfyUIImageProviderConfig {
  baseUrl?: string;
  checkpointName?: string;
  outputNodeId?: string;
  pollIntervalMs?: number;
  referenceImages?: ComfyUIUploadInput[];
  maskImage?: ComfyUIUploadInput;
  timeoutMs?: number;
  workflowBindings?: WorkflowTemplateBinding[];
  workflowJson?: unknown;
}

export interface GenerateComfyUIImageRequest {
  height: number;
  negativePrompt?: string;
  prompt: string;
  seed?: number;
  targetId: string;
  width: number;
}

export interface GenerateComfyUIImageOptions {
  fetchImpl?: typeof fetch;
  jobStore?: ComfyUIJobStore;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface ComfyUIImageResult {
  bytes: Uint8Array;
  filename: string;
  height: number;
  mimeType: string;
  model: string;
  promptId: string;
  seed: number;
  targetId: string;
  width: number;
}

function defaultSeed() {
  return Math.floor(Math.random() * 1_000_000_000);
}

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function generateComfyUIImage(
  request: GenerateComfyUIImageRequest,
  config: ComfyUIImageProviderConfig = {},
  options: GenerateComfyUIImageOptions = {}
): Promise<ComfyUIImageResult> {
  if (!request.prompt.trim()) {
    throw new Error("ComfyUI image generation needs a prompt.");
  }

  const checkpointName = config.checkpointName?.trim() || null;
  if (!checkpointName && !config.workflowJson) {
    throw new Error("ComfyUI image generation needs a checkpoint filename.");
  }

  const seed = request.seed ?? defaultSeed();
  const now = options.now ?? Date.now;
  const wait = options.sleep ?? sleep;
  const pollIntervalMs = config.pollIntervalMs ?? 1_000;
  const timeoutMs = config.timeoutMs ?? 120_000;
  const client = new ComfyUIClient({
    ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {})
  });
  const uploadedReferenceImages: ComfyUIUploadedImage[] = [];
  for (const referenceImage of config.referenceImages ?? []) {
    uploadedReferenceImages.push(await client.uploadImage(referenceImage));
  }
  const uploadedMaskImage = config.maskImage
    ? await client.uploadMask(
        config.maskImage,
        uploadedReferenceImages[0] ?? (await client.uploadImage(config.maskImage))
      )
    : undefined;
  const patchRequest = {
    ...request,
    ...(uploadedReferenceImages.length ? { uploadedReferenceImages } : {}),
    ...(uploadedMaskImage ? { uploadedMaskImage } : {})
  };
  const workflow = config.workflowJson
    ? config.workflowBindings
      ? patchWorkflowWithBindings(config.workflowJson, patchRequest, {
          bindings: config.workflowBindings,
          checkpointName,
          ...(config.outputNodeId ? { outputNodeId: config.outputNodeId } : {}),
          seed
        })
      : patchCustomWorkflow(config.workflowJson, patchRequest, checkpointName, seed)
    : buildTextToImageWorkflow(request, checkpointName!, seed);
  const model = checkpointName ?? checkpointNameFromWorkflow(workflow);
  const jobStore = options.jobStore ?? new InMemoryComfyUIJobStore();

  const promptId = await client.queuePrompt(workflow);
  const startedAt = now();
  jobStore.set({
    promptId,
    startedAt,
    status: "queued",
    targetId: request.targetId,
    updatedAt: startedAt
  });
  console.info(`[ComfyUI] Queued prompt ${promptId} for target ${request.targetId}`);

  while (now() - startedAt < timeoutMs) {
    jobStore.update(promptId, { status: "running", updatedAt: now() });
    const historyPayload = await client.getHistory(promptId).catch((error: unknown) => {
      jobStore.update(promptId, {
        error: error instanceof Error ? error.message : "ComfyUI history request failed.",
        status: "failed",
        updatedAt: now()
      });
      throw error;
    });
    const imageReference = findImageReference(historyPayload, config.outputNodeId);
    if (imageReference?.filename) {
      const image = await client.downloadImage(imageReference).catch((error: unknown) => {
        jobStore.update(promptId, {
          error: error instanceof Error ? error.message : "ComfyUI image download failed.",
          status: "failed",
          updatedAt: now()
        });
        throw error;
      });

      jobStore.update(promptId, {
        completedAt: now(),
        filename: imageReference.filename,
        status: "completed",
        updatedAt: now()
      });

      return {
        bytes: image.bytes,
        filename: imageReference.filename,
        height: request.height,
        mimeType: image.mimeType,
        model,
        promptId,
        seed,
        targetId: request.targetId,
        width: request.width
      };
    }

    await wait(pollIntervalMs);
  }

  const timeoutMessage = `ComfyUI generation timed out after ${Math.round(timeoutMs / 60_000)} minute(s).`;
  jobStore.update(promptId, {
    error: timeoutMessage,
    status: "timedOut",
    updatedAt: now()
  });
  throw new Error(timeoutMessage);
}
