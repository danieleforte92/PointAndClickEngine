import type { WorkflowTemplateDocument } from "@pointclick/contracts";

export interface WorkflowPresetDescriptor {
  id: string;
  label: string;
  template: WorkflowTemplateDocument;
  workflowJson: Record<string, unknown>;
}

const sdxlLightningT2IWorkflow = {
  "3": {
    class_type: "KSampler",
    inputs: {
      cfg: 1,
      denoise: 1,
      latent_image: ["5", 0],
      model: ["4", 0],
      negative: ["7", 0],
      positive: ["6", 0],
      sampler_name: "euler",
      scheduler: "sgm_uniform",
      seed: 1,
      steps: 4
    }
  },
  "4": {
    class_type: "CheckpointLoaderSimple",
    inputs: {
      ckpt_name: "sdxl_lightning_4step.safetensors"
    }
  },
  "5": {
    class_type: "EmptyLatentImage",
    inputs: {
      batch_size: 1,
      height: 576,
      width: 1024
    }
  },
  "6": {
    class_type: "CLIPTextEncode",
    inputs: {
      clip: ["4", 1],
      text: "PointClick positive prompt"
    }
  },
  "7": {
    class_type: "CLIPTextEncode",
    inputs: {
      clip: ["4", 1],
      text: "PointClick negative prompt"
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
      filename_prefix: "pointclick",
      images: ["8", 0]
    }
  }
};

const sdxlStandardBackgroundWorkflow = {
  ...sdxlLightningT2IWorkflow,
  "3": {
    class_type: "KSampler",
    inputs: {
      cfg: 6,
      denoise: 1,
      latent_image: ["5", 0],
      model: ["4", 0],
      negative: ["7", 0],
      positive: ["6", 0],
      sampler_name: "dpmpp_2m",
      scheduler: "karras",
      seed: 1,
      steps: 24
    }
  },
  "4": {
    class_type: "CheckpointLoaderSimple",
    inputs: {
      ckpt_name: "sd_xl_base_1.0.safetensors"
    }
  }
};

const sdxlTurboT2IWorkflow = {
  ...sdxlLightningT2IWorkflow,
  "3": {
    class_type: "KSampler",
    inputs: {
      cfg: 1,
      denoise: 1,
      latent_image: ["5", 0],
      model: ["4", 0],
      negative: ["7", 0],
      positive: ["6", 0],
      sampler_name: "euler",
      scheduler: "normal",
      seed: 1,
      steps: 1
    }
  },
  "4": {
    class_type: "CheckpointLoaderSimple",
    inputs: {
      ckpt_name: "SDXL-TURBO\\sd_xl_turbo_1.0_fp16.safetensors"
    }
  }
};

const sd15InpaintWorkflow = {
  ...sdxlLightningT2IWorkflow,
  "3": {
    class_type: "KSampler",
    inputs: {
      cfg: 7,
      denoise: 1,
      latent_image: ["12", 0],
      model: ["4", 0],
      negative: ["7", 0],
      positive: ["6", 0],
      sampler_name: "euler",
      scheduler: "normal",
      seed: 1,
      steps: 24
    }
  },
  "4": {
    class_type: "CheckpointLoaderSimple",
    inputs: {
      ckpt_name: "sd-v1-5-inpainting.safetensors"
    }
  },
  "10": {
    class_type: "LoadImage",
    inputs: {
      image: "reference.png"
    },
    _meta: { title: "PointClick Reference Image" }
  },
  "11": {
    class_type: "LoadImageMask",
    inputs: {
      channel: "alpha",
      image: "mask.png"
    },
    _meta: { title: "PointClick Inpaint Mask" }
  },
  "12": {
    class_type: "VAEEncodeForInpaint",
    inputs: {
      grow_mask_by: 6,
      mask: ["11", 0],
      pixels: ["10", 0],
      vae: ["4", 2]
    }
  }
};

export const workflowPresets: WorkflowPresetDescriptor[] = [
  {
    id: "pc-background-16x9-sdxl-standard",
    label: "Background 16:9 SDXL Standard 8GB",
    template: {
      schemaVersion: 1,
      id: "pc-background-16x9-sdxl-standard",
      name: "PointClick Background 16:9 SDXL Standard 8GB",
      family: "background_t2i_fast",
      workflowPath: "workflows/pc-background-16x9-sdxl-standard.workflow.json",
      outputMode: "opaque-image",
      hardwareProfile: "8GB VRAM recommended, standard SDXL checkpoint, slower but prompt-faithful",
      supportedInputs: ["prompt", "negative-prompt", "seed", "dimensions", "checkpoint", "output-prefix"],
      bindings: [
        { input: "prompt", nodeId: "6", inputKey: "text", required: true },
        { input: "negative-prompt", nodeId: "7", inputKey: "text" },
        { input: "seed", nodeId: "3", inputKey: "seed" },
        { input: "dimensions", nodeId: "5", inputKey: "width", required: true },
        { input: "checkpoint", nodeId: "4", inputKey: "ckpt_name" },
        { input: "output-prefix", nodeId: "9", inputKey: "filename_prefix" }
      ],
      output: { nodeId: "9", kind: "opaque-image" },
      notes: [
        "Recommended for usable scene backgrounds. Install an SDXL base-compatible checkpoint in ComfyUI/models/checkpoints or use Checkpoint filename / override.",
        "Uses DPM++ 2M, karras scheduler, 24 steps, and CFG 6 so both positive and negative prompts matter.",
        "Slower than Lightning/Turbo, but substantially more reliable for background composition on 8GB VRAM."
      ]
    },
    workflowJson: sdxlStandardBackgroundWorkflow
  },
  {
    id: "pc-background-16x9-t2i",
    label: "Background 16:9 SDXL Lightning 8GB Fast Draft",
    template: {
      schemaVersion: 1,
      id: "pc-background-16x9-t2i",
      name: "PointClick Background 16:9 SDXL Lightning 8GB Fast Draft",
      family: "background_t2i_fast",
      workflowPath: "workflows/pc-background-16x9-t2i.workflow.json",
      outputMode: "opaque-image",
      hardwareProfile: "8GB VRAM draft, SDXL-Lightning 4-step",
      supportedInputs: ["prompt", "negative-prompt", "seed", "dimensions", "checkpoint", "output-prefix"],
      bindings: [
        { input: "prompt", nodeId: "6", inputKey: "text", required: true },
        { input: "negative-prompt", nodeId: "7", inputKey: "text" },
        { input: "seed", nodeId: "3", inputKey: "seed" },
        { input: "dimensions", nodeId: "5", inputKey: "width", required: true },
        { input: "checkpoint", nodeId: "4", inputKey: "ckpt_name" },
        { input: "output-prefix", nodeId: "9", inputKey: "filename_prefix" }
      ],
      output: { nodeId: "9", kind: "opaque-image" },
      notes: [
        "Recommended checkpoint: ByteDance SDXL-Lightning 4-step all-in-one checkpoint in ComfyUI/models/checkpoints.",
        "Uses Euler sampler, sgm_uniform scheduler, 4 steps, and CFG 1 for 8GB-friendly 16:9 drafts.",
        "Use this as a smoke-test or ideation preset only. Distilled Lightning checkpoints can ignore composition constraints and are not the default background path."
      ]
    },
    workflowJson: sdxlLightningT2IWorkflow
  },
  {
    id: "pc-background-16x9-sdxl-turbo",
    label: "Background 16:9 SDXL Turbo 8GB Fast Draft",
    template: {
      schemaVersion: 1,
      id: "pc-background-16x9-sdxl-turbo",
      name: "PointClick Background 16:9 SDXL Turbo 8GB Fast Draft",
      family: "background_t2i_fast",
      workflowPath: "workflows/pc-background-16x9-sdxl-turbo.workflow.json",
      outputMode: "opaque-image",
      hardwareProfile: "8GB VRAM draft, SDXL Turbo 1-step",
      supportedInputs: ["prompt", "negative-prompt", "seed", "dimensions", "checkpoint", "output-prefix"],
      bindings: [
        { input: "prompt", nodeId: "6", inputKey: "text", required: true },
        { input: "negative-prompt", nodeId: "7", inputKey: "text" },
        { input: "seed", nodeId: "3", inputKey: "seed" },
        { input: "dimensions", nodeId: "5", inputKey: "width", required: true },
        { input: "checkpoint", nodeId: "4", inputKey: "ckpt_name" },
        { input: "output-prefix", nodeId: "9", inputKey: "filename_prefix" }
      ],
      output: { nodeId: "9", kind: "opaque-image" },
      notes: [
        "Recommended checkpoint: Stability AI SDXL Turbo checkpoint in ComfyUI/models/checkpoints.",
        "Default checkpoint name matches ComfyUI subfolder installs like SDXL-TURBO/sd_xl_turbo_1.0_fp16.safetensors.",
        "Use this as a smoke-test or ideation preset only. Turbo is fastest at 1 step, but scene composition and negative guidance are not reliable enough for the default background path."
      ]
    },
    workflowJson: sdxlTurboT2IWorkflow
  },
  {
    id: "pc-prop-character-chroma",
    label: "Prop/Character Chroma SDXL Lightning 8GB",
    template: {
      schemaVersion: 1,
      id: "pc-prop-character-chroma",
      name: "PointClick Prop/Character Chroma SDXL Lightning 8GB",
      family: "prop_isolated_alpha_or_chroma",
      workflowPath: "workflows/pc-prop-character-chroma.workflow.json",
      outputMode: "chroma-image",
      hardwareProfile: "8GB VRAM draft, SDXL-Lightning 4-step",
      supportedInputs: ["prompt", "negative-prompt", "seed", "dimensions", "checkpoint", "output-prefix"],
      bindings: [
        { input: "prompt", nodeId: "6", inputKey: "text", required: true },
        { input: "negative-prompt", nodeId: "7", inputKey: "text" },
        { input: "seed", nodeId: "3", inputKey: "seed" },
        { input: "dimensions", nodeId: "5", inputKey: "width", required: true },
        { input: "checkpoint", nodeId: "4", inputKey: "ckpt_name" },
        { input: "output-prefix", nodeId: "9", inputKey: "filename_prefix" }
      ],
      output: { nodeId: "9", kind: "chroma-image" },
      notes: [
        "Recommended checkpoint: ByteDance SDXL-Lightning 4-step all-in-one checkpoint in ComfyUI/models/checkpoints.",
        "Prompt should request a flat blue or green background, then clean up in Asset Studio Chroma Key or Bezier Cutout.",
        "Uses the same 4-step SDXL-Lightning core workflow as background generation."
      ]
    },
    workflowJson: sdxlLightningT2IWorkflow
  },
  {
    id: "pc-prop-character-chroma-sdxl-turbo",
    label: "Prop/Character Chroma SDXL Turbo 8GB",
    template: {
      schemaVersion: 1,
      id: "pc-prop-character-chroma-sdxl-turbo",
      name: "PointClick Prop/Character Chroma SDXL Turbo 8GB",
      family: "prop_isolated_alpha_or_chroma",
      workflowPath: "workflows/pc-prop-character-chroma-sdxl-turbo.workflow.json",
      outputMode: "chroma-image",
      hardwareProfile: "8GB VRAM draft, SDXL Turbo 1-step",
      supportedInputs: ["prompt", "negative-prompt", "seed", "dimensions", "checkpoint", "output-prefix"],
      bindings: [
        { input: "prompt", nodeId: "6", inputKey: "text", required: true },
        { input: "negative-prompt", nodeId: "7", inputKey: "text" },
        { input: "seed", nodeId: "3", inputKey: "seed" },
        { input: "dimensions", nodeId: "5", inputKey: "width", required: true },
        { input: "checkpoint", nodeId: "4", inputKey: "ckpt_name" },
        { input: "output-prefix", nodeId: "9", inputKey: "filename_prefix" }
      ],
      output: { nodeId: "9", kind: "chroma-image" },
      notes: [
        "Recommended checkpoint: Stability AI SDXL Turbo checkpoint in ComfyUI/models/checkpoints.",
        "Use this when SDXL Turbo is installed but SDXL Lightning is not.",
        "Prompt should request a flat blue or green background, then clean up in Asset Studio."
      ]
    },
    workflowJson: sdxlTurboT2IWorkflow
  },
  {
    id: "pc-scene-inpaint-masked",
    label: "Scene Inpaint Masked SD 1.5 8GB",
    template: {
      schemaVersion: 1,
      id: "pc-scene-inpaint-masked",
      name: "PointClick Scene Inpaint Masked SD 1.5 8GB",
      family: "scene_inpaint_masked",
      workflowPath: "workflows/pc-scene-inpaint-masked.workflow.json",
      outputMode: "opaque-image",
      hardwareProfile: "8GB VRAM, SD 1.5 inpainting checkpoint",
      supportedInputs: [
        "prompt",
        "negative-prompt",
        "seed",
        "dimensions",
        "checkpoint",
        "reference-image",
        "mask-image",
        "output-prefix"
      ],
      bindings: [
        { input: "prompt", nodeId: "6", inputKey: "text", required: true },
        { input: "negative-prompt", nodeId: "7", inputKey: "text" },
        { input: "seed", nodeId: "3", inputKey: "seed" },
        { input: "dimensions", nodeId: "5", inputKey: "width", required: true },
        { input: "checkpoint", nodeId: "4", inputKey: "ckpt_name" },
        { input: "reference-image", nodeId: "10", inputKey: "image", required: true },
        { input: "mask-image", nodeId: "11", inputKey: "image", required: true },
        { input: "output-prefix", nodeId: "9", inputKey: "filename_prefix" }
      ],
      output: { nodeId: "9", kind: "opaque-image" },
      notes: [
        "Recommended checkpoint: SD 1.5 inpainting-compatible checkpoint in ComfyUI/models/checkpoints.",
        "Uses only core ComfyUI LoadImage, LoadImageMask, VAEEncodeForInpaint, KSampler, and SaveImage nodes.",
        "Use compiled reference and mask assets from a scene guide before queueing."
      ]
    },
    workflowJson: sd15InpaintWorkflow
  }
];

export function workflowPresetById(id: string): WorkflowPresetDescriptor | undefined {
  return workflowPresets.find((preset) => preset.id === id);
}
