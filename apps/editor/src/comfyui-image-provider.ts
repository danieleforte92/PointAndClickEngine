export interface ComfyUIImageProviderConfig {
  baseUrl?: string;
  checkpointName?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
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

interface ComfyWorkflowNode {
  class_type?: string;
  inputs?: Record<string, unknown>;
  _meta?: {
    title?: string;
  };
}

type ComfyWorkflow = Record<string, ComfyWorkflowNode>;

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

function cloneWorkflow(value: unknown): ComfyWorkflow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("ComfyUI custom workflow must be an API JSON object.");
  }

  const workflow = JSON.parse(JSON.stringify(value)) as ComfyWorkflow;
  if (!Object.values(workflow).some((node) => node && typeof node === "object" && node.class_type)) {
    throw new Error("ComfyUI custom workflow does not look like an API export.");
  }
  return workflow;
}

function maxNodeId(workflow: ComfyWorkflow) {
  return Object.keys(workflow).reduce((max, id) => {
    const numericId = Number(id);
    return Number.isFinite(numericId) ? Math.max(max, numericId) : max;
  }, 0);
}

function isTextEncodeNode(node: ComfyWorkflowNode) {
  return node.class_type === "CLIPTextEncode" && typeof node.inputs?.text === "string";
}

function isNegativePromptNode(id: string, node: ComfyWorkflowNode) {
  const haystack = `${id} ${node._meta?.title ?? ""} ${String(node.inputs?.text ?? "")}`.toLowerCase();
  return haystack.includes("negative") || haystack.includes("neg prompt") || haystack.includes("avoid");
}

function firstCheckpointNode(workflow: ComfyWorkflow) {
  return Object.entries(workflow).find(([, node]) => node.class_type === "CheckpointLoaderSimple");
}

function checkpointNameFromWorkflow(workflow: ComfyWorkflow) {
  const checkpoint = firstCheckpointNode(workflow)?.[1].inputs?.ckpt_name;
  if (typeof checkpoint === "string") return checkpoint;

  const unet = Object.values(workflow).find((node) => node.class_type === "UNETLoader")?.inputs?.unet_name;
  if (typeof unet === "string") return unet;

  const clip = Object.values(workflow).find((node) => node.class_type === "CLIPLoader")?.inputs?.clip_name;
  if (typeof clip === "string") return clip;

  return "custom-workflow";
}

function ensureInputs(node: ComfyWorkflowNode) {
  node.inputs ??= {};
  return node.inputs;
}

function patchExistingPromptNodes(workflow: ComfyWorkflow, request: GenerateComfyUIImageRequest) {
  const promptNodes = Object.entries(workflow).filter((entry): entry is [string, ComfyWorkflowNode] =>
    isTextEncodeNode(entry[1])
  );
  if (promptNodes.length === 0) return false;

  const negativePrompt = request.negativePrompt?.trim() || defaultNegativePrompt;
  const negativeNode = promptNodes.find(([id, node]) => isNegativePromptNode(id, node));
  const positiveNodes = promptNodes.filter(([id, node]) => !isNegativePromptNode(id, node));

  for (const [, node] of positiveNodes.length ? positiveNodes : promptNodes.slice(0, 1)) {
    ensureInputs(node).text = request.prompt;
  }

  if (negativeNode) {
    ensureInputs(negativeNode[1]).text = negativePrompt;
  } else if (promptNodes.length > 1) {
    ensureInputs(promptNodes[promptNodes.length - 1]![1]).text = negativePrompt;
  }

  return true;
}

function patchPrimitivePromptNodes(workflow: ComfyWorkflow, request: GenerateComfyUIImageRequest) {
  const promptNodes = Object.entries(workflow).filter(([, node]) => {
    const title = `${node._meta?.title ?? ""}`.toLowerCase();
    return (
      node.class_type === "PrimitiveStringMultiline" &&
      typeof node.inputs?.value === "string" &&
      (title.includes("user prompt") || title.includes("user input") || title.includes("positive prompt"))
    );
  });

  if (promptNodes.length === 0) return false;

  for (const [, node] of promptNodes) {
    ensureInputs(node).value = request.prompt;
  }

  return true;
}

function hasLinkedPromptConditioning(workflow: ComfyWorkflow) {
  return Object.values(workflow).some(
    (node) => node.class_type === "CLIPTextEncode" && Array.isArray(node.inputs?.text)
  );
}

function injectPromptNodes(workflow: ComfyWorkflow, request: GenerateComfyUIImageRequest) {
  const checkpoint = firstCheckpointNode(workflow);
  if (!checkpoint) {
    throw new Error(
      "ComfyUI custom workflow has no CLIPTextEncode nodes and no CheckpointLoaderSimple node to auto-wire prompts."
    );
  }

  const positiveId = String(maxNodeId(workflow) + 1);
  const negativeId = String(maxNodeId(workflow) + 2);
  workflow[positiveId] = {
    class_type: "CLIPTextEncode",
    inputs: {
      clip: [checkpoint[0], 1],
      text: request.prompt
    },
    _meta: { title: "PointClick Positive Prompt" }
  };
  workflow[negativeId] = {
    class_type: "CLIPTextEncode",
    inputs: {
      clip: [checkpoint[0], 1],
      text: request.negativePrompt?.trim() || defaultNegativePrompt
    },
    _meta: { title: "PointClick Negative Prompt" }
  };

  let patchedSamplerCount = 0;
  for (const node of Object.values(workflow)) {
    if (node.class_type !== "KSampler") continue;
    const inputs = ensureInputs(node);
    inputs.positive = [positiveId, 0];
    inputs.negative = [negativeId, 0];
    patchedSamplerCount += 1;
  }

  if (patchedSamplerCount === 0) {
    throw new Error(
      "ComfyUI custom workflow has no CLIPTextEncode nodes and no standard KSampler node for prompt injection."
    );
  }
}

function patchCustomWorkflow(
  workflowJson: unknown,
  request: GenerateComfyUIImageRequest,
  checkpointName: string | null,
  seed: number
) {
  const workflow = cloneWorkflow(workflowJson);

  for (const node of Object.values(workflow)) {
    const inputs = node.inputs;
    if (!inputs) continue;

    if (checkpointName && typeof inputs.ckpt_name === "string") {
      inputs.ckpt_name = checkpointName;
    }
    if ("width" in inputs && "height" in inputs) {
      inputs.width = request.width;
      inputs.height = request.height;
    }
    for (const key of Object.keys(inputs)) {
      if ((key === "seed" || key.endsWith(".seed")) && typeof inputs[key] === "number") {
        inputs[key] = seed;
      }
    }
    if (typeof inputs.filename_prefix === "string") {
      inputs.filename_prefix = `pointclick_${request.targetId}`;
    }
  }

  if (!patchPrimitivePromptNodes(workflow, request) && !patchExistingPromptNodes(workflow, request)) {
    if (hasLinkedPromptConditioning(workflow)) {
      throw new Error(
        "ComfyUI custom workflow uses linked prompt conditioning, but no editable user prompt string node was found."
      );
    }
    injectPromptNodes(workflow, request);
  }

  return workflow;
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

  const checkpointName = config.checkpointName?.trim() || null;
  if (!checkpointName && !config.workflowJson) {
    throw new Error("ComfyUI image generation needs a checkpoint filename.");
  }

  const seed = request.seed ?? defaultSeed();
  const baseUrl = (config.baseUrl?.trim() || "http://127.0.0.1:8188").replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const wait = options.sleep ?? sleep;
  const pollIntervalMs = config.pollIntervalMs ?? 1_000;
  const timeoutMs = config.timeoutMs ?? 120_000;
  const workflow = config.workflowJson
    ? patchCustomWorkflow(config.workflowJson, request, checkpointName, seed)
    : buildTextToImageWorkflow(request, checkpointName!, seed);
  const model = checkpointName ?? checkpointNameFromWorkflow(workflow);

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
    model,
    promptId,
    seed,
    targetId: request.targetId,
    width: request.width
  };
}
