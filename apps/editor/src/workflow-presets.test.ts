import { describe, expect, it } from "vitest";
import { workflowPresets } from "./workflow-presets";

interface WorkflowPresetNode {
  class_type?: string;
  inputs?: Record<string, unknown>;
}

function isWorkflowPresetNode(value: unknown): value is WorkflowPresetNode {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function kSamplerCfgForPreset(id: string) {
  const preset = workflowPresets.find((candidate) => candidate.id === id);
  if (!preset) throw new Error(`Missing workflow preset ${id}`);

  const sampler = Object.values(preset.workflowJson).find(
    (node): node is WorkflowPresetNode =>
      isWorkflowPresetNode(node) &&
      node.class_type === "KSampler" &&
      Boolean(node.inputs && typeof node.inputs === "object" && !Array.isArray(node.inputs))
  );
  if (!sampler?.inputs) {
    throw new Error(`Missing KSampler for workflow preset ${id}`);
  }

  return sampler.inputs.cfg;
}

describe("workflowPresets", () => {
  it("uses the standard SDXL background preset as the default installable background path", () => {
    expect(workflowPresets[0]?.id).toBe("pc-background-16x9-sdxl-standard");
    expect(kSamplerCfgForPreset("pc-background-16x9-sdxl-standard")).toBe(6);
  });

  it("keeps distilled SDXL presets prompt-guided in ComfyUI KSampler", () => {
    expect(kSamplerCfgForPreset("pc-background-16x9-t2i")).toBe(1);
    expect(kSamplerCfgForPreset("pc-background-16x9-sdxl-turbo")).toBe(1);
    expect(kSamplerCfgForPreset("pc-prop-character-chroma")).toBe(1);
    expect(kSamplerCfgForPreset("pc-prop-character-chroma-sdxl-turbo")).toBe(1);
  });
});
