export interface ComfyWorkflowNode {
  class_type?: string;
  inputs?: Record<string, unknown>;
  _meta?: {
    title?: string;
  };
}

export type ComfyWorkflow = Record<string, ComfyWorkflowNode>;

export interface ComfyWorkflowPatchRequest {
  height: number;
  negativePrompt?: string;
  prompt: string;
  targetId: string;
  width: number;
}

export const defaultNegativePrompt = "blur, low contrast, warped geometry, unreadable silhouettes, baked text";

export function buildTextToImageWorkflow(
  request: ComfyWorkflowPatchRequest,
  checkpointName: string,
  seed: number
): ComfyWorkflow {
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

export function checkpointNameFromWorkflow(workflow: ComfyWorkflow) {
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

function patchExistingPromptNodes(workflow: ComfyWorkflow, request: ComfyWorkflowPatchRequest) {
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

function patchPrimitivePromptNodes(workflow: ComfyWorkflow, request: ComfyWorkflowPatchRequest) {
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

function injectPromptNodes(workflow: ComfyWorkflow, request: ComfyWorkflowPatchRequest) {
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

export function patchCustomWorkflow(
  workflowJson: unknown,
  request: ComfyWorkflowPatchRequest,
  checkpointName: string | null,
  seed: number
): ComfyWorkflow {
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
