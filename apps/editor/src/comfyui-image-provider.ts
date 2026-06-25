export interface ComfyUIImageProviderConfig {
  baseUrl?: string;
  checkpointName?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
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

interface ComfyPromptResponse {
  prompt_id?: string;
}

interface ComfyImageReference {
  filename?: string;
  subfolder?: string;
  type?: string;
}

const defaultNegativePrompt = "blur, low contrast, warped geometry, unreadable silhouettes, baked text";

function defaultSeed() {
  return Math.floor(Math.random() * 1_000_000_000);
}

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function buildTextToImageWorkflow(request: GenerateComfyUIImageRequest, checkpointName: string, seed: number) {
  return {
    "3": {
      class_type: "KSampler",
      inputs: {
        cfg: 7,
        denoise: 1,
        latent_image: ["5", 0],
        model: ["4", 0],
        negative: ["7", 0],
        positive: ["6", 0],
        sampler_name: "euler",
        scheduler: "normal",
        seed,
        steps: 22
      }
    },
    "4": {
      class_type: "CheckpointLoaderSimple",
      inputs: {
        ckpt_name: checkpointName
      }
    },
    "5": {
      class_type: "EmptyLatentImage",
      inputs: {
        batch_size: 1,
        height: request.height,
        width: request.width
      }
    },
    "6": {
      class_type: "CLIPTextEncode",
      inputs: {
        clip: ["4", 1],
        text: request.prompt
      }
    },
    "7": {
      class_type: "CLIPTextEncode",
      inputs: {
        clip: ["4", 1],
        text: request.negativePrompt?.trim() || defaultNegativePrompt
      }
    },
    "8": {
      class_type: "VAEDecode",
      inputs: {
        samples: ["3", 0],
        vae: ["4", 2]
      }
    },
    "9": {
      class_type: "SaveImage",
      inputs: {
        filename_prefix: `pointclick_${request.targetId}`,
        images: ["8", 0]
      }
    }
  };
}

function findImageReference(value: unknown): ComfyImageReference | null {
  if (!value || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findImageReference(entry);
      if (found) return found;
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.filename === "string") {
    return {
      filename: record.filename,
      subfolder: typeof record.subfolder === "string" ? record.subfolder : "",
      type: typeof record.type === "string" ? record.type : "output"
    };
  }

  for (const child of Object.values(record)) {
    const found = findImageReference(child);
    if (found) return found;
  }
  return null;
}

async function readError(response: Response) {
  return response.text().catch(() => response.statusText);
}

export async function generateComfyUIImage(
  request: GenerateComfyUIImageRequest,
  config: ComfyUIImageProviderConfig = {},
  options: GenerateComfyUIImageOptions = {}
): Promise<ComfyUIImageResult> {
  if (!request.prompt.trim()) {
    throw new Error("ComfyUI image generation needs a prompt.");
  }

  const checkpointName = config.checkpointName?.trim();
  if (!checkpointName) {
    throw new Error("ComfyUI image generation needs a checkpoint filename.");
  }

  const seed = request.seed ?? defaultSeed();
  const baseUrl = (config.baseUrl?.trim() || "http://127.0.0.1:8188").replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const wait = options.sleep ?? sleep;
  const pollIntervalMs = config.pollIntervalMs ?? 1_000;
  const timeoutMs = config.timeoutMs ?? 120_000;
  const workflow = buildTextToImageWorkflow(request, checkpointName, seed);

  const promptResponse = await fetchImpl(`${baseUrl}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow })
  });

  if (!promptResponse.ok) {
    throw new Error(`ComfyUI prompt queue failed (${promptResponse.status}): ${await readError(promptResponse)}`);
  }

  const promptPayload = (await promptResponse.json()) as ComfyPromptResponse;
  const promptId = promptPayload.prompt_id;
  if (!promptId) {
    throw new Error("ComfyUI prompt response did not include prompt_id.");
  }

  const startedAt = Date.now();
  let imageReference: ComfyImageReference | null = null;

  while (Date.now() - startedAt < timeoutMs) {
    const historyResponse = await fetchImpl(`${baseUrl}/history/${encodeURIComponent(promptId)}`);
    if (!historyResponse.ok) {
      throw new Error(`ComfyUI history failed (${historyResponse.status}): ${await readError(historyResponse)}`);
    }

    const historyPayload = await historyResponse.json();
    imageReference = findImageReference(historyPayload);
    if (imageReference?.filename) break;

    await wait(pollIntervalMs);
  }

  if (!imageReference?.filename) {
    throw new Error(`ComfyUI generation timed out after ${timeoutMs}ms.`);
  }

  const viewUrl = new URL(`${baseUrl}/view`);
  viewUrl.searchParams.set("filename", imageReference.filename);
  viewUrl.searchParams.set("subfolder", imageReference.subfolder ?? "");
  viewUrl.searchParams.set("type", imageReference.type ?? "output");

  const imageResponse = await fetchImpl(viewUrl.toString());
  if (!imageResponse.ok) {
    throw new Error(`ComfyUI image download failed (${imageResponse.status}): ${await readError(imageResponse)}`);
  }

  const bytes = new Uint8Array(await imageResponse.arrayBuffer());

  return {
    bytes,
    filename: imageReference.filename,
    height: request.height,
    mimeType: imageResponse.headers.get("content-type") ?? "image/png",
    model: checkpointName,
    promptId,
    seed,
    targetId: request.targetId,
    width: request.width
  };
}
