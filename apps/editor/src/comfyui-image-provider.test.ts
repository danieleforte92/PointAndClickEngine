import { describe, expect, it } from "vitest";
import { InMemoryComfyUIJobStore } from "./comfyui-job-store";
import { generateComfyUIImage } from "./comfyui-image-provider";

describe("generateComfyUIImage", () => {
  it("queues a ComfyUI workflow, polls history, and downloads the image", async () => {
    const calls: Array<{ body?: unknown; url: string }> = [];
    let historyCalls = 0;
    const bytes = new Uint8Array([137, 80, 78, 71]);

    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({
        url,
        body: init?.body ? JSON.parse(String(init.body)) : undefined
      });

      if (url.endsWith("/prompt")) {
        return {
          ok: true,
          json: async () => ({ prompt_id: "prompt-123" })
        } as Response;
      }

      if (url.endsWith("/history/prompt-123")) {
        historyCalls += 1;
        return {
          ok: true,
          json: async () =>
            historyCalls === 1
              ? { "prompt-123": { outputs: {} } }
              : {
                  "prompt-123": {
                    outputs: {
                      "9": {
                        images: [{ filename: "pointclick_lab_00001_.png", subfolder: "", type: "output" }]
                      }
                    }
                  }
                }
        } as Response;
      }

      if (url.includes("/view?")) {
        return {
          headers: new Headers({ "content-type": "image/png" }),
          ok: true,
          arrayBuffer: async () => bytes.buffer
        } as Response;
      }

      throw new Error(`Unexpected URL ${url}`);
    }) as typeof fetch;

    const result = await generateComfyUIImage(
      {
        height: 512,
        negativePrompt: "blur",
        prompt: "A readable point-and-click adventure lab background.",
        seed: 42,
        targetId: "lab-background",
        width: 768
      },
      {
        baseUrl: "http://127.0.0.1:8188",
        checkpointName: "test-model.safetensors",
        pollIntervalMs: 1,
        timeoutMs: 1_000
      },
      {
        fetchImpl,
        sleep: async () => {}
      }
    );

    expect(calls[0]).toMatchObject({
      url: "http://127.0.0.1:8188/prompt"
    });
    expect(calls[0]?.body).toMatchObject({
      prompt: {
        "4": {
          inputs: {
            ckpt_name: "test-model.safetensors"
          }
        },
        "5": {
          inputs: {
            height: 512,
            width: 768
          }
        }
      }
    });
    expect(result).toMatchObject({
      filename: "pointclick_lab_00001_.png",
      model: "test-model.safetensors",
      promptId: "prompt-123",
      seed: 42,
      targetId: "lab-background"
    });
    expect([...result.bytes]).toEqual([137, 80, 78, 71]);
  });

  it("patches a custom API workflow and injects prompt nodes when they are missing", async () => {
    const calls: Array<{ body?: Record<string, any>; url: string }> = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({
        url,
        body: init?.body ? JSON.parse(String(init.body)) : undefined
      });

      if (url.endsWith("/prompt")) {
        return {
          ok: true,
          json: async () => ({ prompt_id: "prompt-custom" })
        } as Response;
      }

      if (url.endsWith("/history/prompt-custom")) {
        return {
          ok: true,
          json: async () => ({
            "prompt-custom": {
              outputs: {
                "7": {
                  images: [{ filename: "Asset_00001_.png", subfolder: "", type: "output" }]
                }
              }
            }
          })
        } as Response;
      }

      if (url.includes("/view?")) {
        return {
          headers: new Headers({ "content-type": "image/png" }),
          ok: true,
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer
        } as Response;
      }

      throw new Error(`Unexpected URL ${url}`);
    }) as typeof fetch;

    await generateComfyUIImage(
      {
        height: 720,
        negativePrompt: "messy details",
        prompt: "A readable tavern background.",
        seed: 99,
        targetId: "tavern-background",
        width: 1280
      },
      {
        pollIntervalMs: 1,
        timeoutMs: 1_000,
        workflowJson: {
          "1": {
            inputs: {
              ckpt_name: "SDXL-TURBO\\sd_xl_turbo_1.0_fp16.safetensors"
            },
            class_type: "CheckpointLoaderSimple"
          },
          "2": {
            inputs: {
              width: 1024,
              height: 1024,
              batch_size: 1
            },
            class_type: "EmptyLatentImage"
          },
          "3": {
            inputs: {
              seed: 0,
              steps: 4,
              cfg: 2,
              sampler_name: "euler",
              scheduler: "sgm_uniform",
              denoise: 1,
              model: ["1", 0],
              latent_image: ["2", 0]
            },
            class_type: "KSampler"
          },
          "7": {
            inputs: {
              filename_prefix: "Asset_",
              images: ["3", 0]
            },
            class_type: "SaveImage"
          }
        }
      },
      {
        fetchImpl,
        sleep: async () => {}
      }
    );

    expect(calls[0]?.body).toBeDefined();
    const workflow = calls[0]!.body!.prompt as Record<string, any>;
    expect(workflow["2"].inputs).toMatchObject({ height: 720, width: 1280 });
    expect(workflow["3"].inputs).toMatchObject({
      negative: ["9", 0],
      positive: ["8", 0],
      seed: 99
    });
    expect(workflow["8"]).toMatchObject({
      class_type: "CLIPTextEncode",
      inputs: {
        clip: ["1", 1],
        text: "A readable tavern background."
      }
    });
    expect(workflow["9"]).toMatchObject({
      class_type: "CLIPTextEncode",
      inputs: {
        clip: ["1", 1],
        text: "messy details"
      }
    });
    expect(workflow["7"].inputs.filename_prefix).toBe("pointclick_tavern-background");
  });

  it("patches Krea-style workflows with linked prompt and resolution nodes", async () => {
    const calls: Array<{ body?: Record<string, any>; url: string }> = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({
        url,
        body: init?.body ? JSON.parse(String(init.body)) : undefined
      });

      if (url.endsWith("/prompt")) {
        return {
          ok: true,
          json: async () => ({ prompt_id: "prompt-krea" })
        } as Response;
      }

      if (url.endsWith("/history/prompt-krea")) {
        return {
          ok: true,
          json: async () => ({
            "prompt-krea": {
              outputs: {
                "29": {
                  images: [{ filename: "Krea2_turbo_00001_.png", subfolder: "", type: "output" }]
                }
              }
            }
          })
        } as Response;
      }

      if (url.includes("/view?")) {
        return {
          headers: new Headers({ "content-type": "image/png" }),
          ok: true,
          arrayBuffer: async () => new Uint8Array([4, 5, 6]).buffer
        } as Response;
      }

      throw new Error(`Unexpected URL ${url}`);
    }) as typeof fetch;

    const result = await generateComfyUIImage(
      {
        height: 720,
        prompt: "A clear hand-painted pirate tavern background.",
        seed: 1234,
        targetId: "tavern-bg",
        width: 1280
      },
      {
        pollIntervalMs: 1,
        timeoutMs: 1_000,
        workflowJson: {
          "29": {
            inputs: {
              filename_prefix: "Krea2_turbo",
              images: ["30:8", 0]
            },
            class_type: "SaveImage"
          },
          "49": {
            inputs: {
              aspect_ratio: "1:1 (Square)",
              megapixels: 1,
              multiple: 8
            },
            class_type: "ResolutionSelector"
          },
          "30:5": {
            inputs: {
              width: ["49", 0],
              height: ["49", 1],
              batch_size: 1
            },
            class_type: "EmptyLatentImage"
          },
          "30:3": {
            inputs: {
              seed: 562435667168948,
              steps: 8,
              cfg: 1,
              sampler_name: "euler",
              scheduler: "simple",
              denoise: 1,
              model: ["30:22", 0],
              positive: ["30:6", 0],
              negative: ["30:13", 0],
              latent_image: ["30:5", 0]
            },
            class_type: "KSampler"
          },
          "30:10": {
            inputs: {
              unet_name: "krea2_turbo_fp8_scaled.safetensors",
              weight_dtype: "default"
            },
            class_type: "UNETLoader"
          },
          "30:16": {
            inputs: {
              prompt: ["30:17", 0],
              "sampling_mode.seed": 0,
              clip: ["30:11", 0]
            },
            class_type: "TextGenerate"
          },
          "30:19": {
            inputs: {
              value: "Old hardcoded prompt"
            },
            class_type: "PrimitiveStringMultiline",
            _meta: {
              title: "Text String (User Prompt)"
            }
          },
          "30:6": {
            inputs: {
              text: ["30:28", 0],
              clip: ["30:11", 0]
            },
            class_type: "CLIPTextEncode"
          }
        }
      },
      {
        fetchImpl,
        sleep: async () => {}
      }
    );

    const workflow = calls[0]!.body!.prompt as Record<string, any>;
    expect(workflow["30:19"].inputs.value).toBe("A clear hand-painted pirate tavern background.");
    expect(workflow["30:5"].inputs).toMatchObject({ height: 720, width: 1280 });
    expect(workflow["30:3"].inputs.seed).toBe(1234);
    expect(workflow["30:16"].inputs["sampling_mode.seed"]).toBe(1234);
    expect(workflow["29"].inputs.filename_prefix).toBe("pointclick_tavern-bg");
    expect(result.model).toBe("krea2_turbo_fp8_scaled.safetensors");
  });

  it("reports timeout in minutes for long-running workflows", async () => {
    let now = 0;
    const fetchImpl = (async (url: string) => {
      if (url.endsWith("/prompt")) {
        return {
          ok: true,
          json: async () => ({ prompt_id: "prompt-timeout" })
        } as Response;
      }

      if (url.endsWith("/history/prompt-timeout")) {
        return {
          ok: true,
          json: async () => ({ "prompt-timeout": { outputs: {} } })
        } as Response;
      }

      throw new Error(`Unexpected URL ${url}`);
    }) as typeof fetch;

    await expect(
      generateComfyUIImage(
        {
          height: 512,
          prompt: "A slow generation.",
          targetId: "slow-target",
          width: 512
        },
        {
          checkpointName: "test-model.safetensors",
          pollIntervalMs: 1,
          timeoutMs: 60_000
        },
        {
          fetchImpl,
          now: () => {
            now += 60_001;
            return now;
          },
          sleep: async () => {}
        }
      )
    ).rejects.toThrow("ComfyUI generation timed out after 1 minute(s).");
  });

  it("prefers an explicit output node when parsing multi-output history", async () => {
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      if (url.endsWith("/prompt")) {
        expect(init?.body ? JSON.parse(String(init.body)) : undefined).toBeDefined();
        return {
          ok: true,
          json: async () => ({ prompt_id: "prompt-multi-output" })
        } as Response;
      }

      if (url.endsWith("/history/prompt-multi-output")) {
        return {
          ok: true,
          json: async () => ({
            "prompt-multi-output": {
              outputs: {
                "8": {
                  images: [{ filename: "preview_00001_.png", subfolder: "", type: "output" }]
                },
                "12": {
                  images: [{ filename: "final_00001_.png", subfolder: "final", type: "output" }]
                }
              }
            }
          })
        } as Response;
      }

      if (url.includes("/view?")) {
        expect(url).toContain("filename=final_00001_.png");
        expect(url).toContain("subfolder=final");
        return {
          headers: new Headers({ "content-type": "image/png" }),
          ok: true,
          arrayBuffer: async () => new Uint8Array([9, 9, 9]).buffer
        } as Response;
      }

      throw new Error(`Unexpected URL ${url}`);
    }) as typeof fetch;

    const result = await generateComfyUIImage(
      {
        height: 512,
        prompt: "A multi output workflow.",
        seed: 77,
        targetId: "multi-output",
        width: 512
      },
      {
        checkpointName: "test-model.safetensors",
        outputNodeId: "12",
        pollIntervalMs: 1,
        timeoutMs: 1_000
      },
      {
        fetchImpl,
        sleep: async () => {}
      }
    );

    expect(result.filename).toBe("final_00001_.png");
  });

  it("uploads reference and mask assets before patching LoadImage nodes", async () => {
    const calls: Array<{ body?: unknown; url: string }> = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({
        url,
        body: init?.body
      });

      if (url.endsWith("/upload/image")) {
        const body = init?.body as FormData;
        expect(body.get("type")).toBe("input");
        expect(body.get("overwrite")).toBe("true");
        return {
          ok: true,
          json: async () => ({ name: "layout-reference.png", subfolder: "", type: "input" })
        } as Response;
      }

      if (url.endsWith("/upload/mask")) {
        const body = init?.body as FormData;
        expect(body.get("type")).toBe("input");
        expect(JSON.parse(String(body.get("original_ref")))).toEqual({
          filename: "layout-reference.png",
          subfolder: "",
          type: "input"
        });
        return {
          ok: true,
          json: async () => ({ name: "layout-mask.png", subfolder: "", type: "input" })
        } as Response;
      }

      if (url.endsWith("/prompt")) {
        return {
          ok: true,
          json: async () => ({ prompt_id: "prompt-inputs" })
        } as Response;
      }

      if (url.endsWith("/history/prompt-inputs")) {
        return {
          ok: true,
          json: async () => ({
            "prompt-inputs": {
              outputs: {
                "20": {
                  images: [{ filename: "inpaint_00001_.png", subfolder: "", type: "output" }]
                }
              }
            }
          })
        } as Response;
      }

      if (url.includes("/view?")) {
        return {
          headers: new Headers({ "content-type": "image/png" }),
          ok: true,
          arrayBuffer: async () => new Uint8Array([7, 8, 9]).buffer
        } as Response;
      }

      throw new Error(`Unexpected URL ${url}`);
    }) as typeof fetch;

    await generateComfyUIImage(
      {
        height: 720,
        negativePrompt: "messy",
        prompt: "Repair the tavern door area.",
        seed: 123,
        targetId: "door-inpaint",
        width: 1280
      },
      {
        pollIntervalMs: 1,
        timeoutMs: 1_000,
        referenceImages: [
          {
            bytes: new Uint8Array([1, 2, 3]),
            filename: "reference.png",
            mimeType: "image/png"
          }
        ],
        maskImage: {
          bytes: new Uint8Array([4, 5, 6]),
          filename: "mask.png",
          mimeType: "image/png"
        },
        workflowJson: {
          "1": {
            inputs: {
              ckpt_name: "sdxl.safetensors"
            },
            class_type: "CheckpointLoaderSimple"
          },
          "10": {
            inputs: {
              image: "old-layout.png"
            },
            class_type: "LoadImage",
            _meta: { title: "Reference Layout" }
          },
          "11": {
            inputs: {
              image: "old-mask.png",
              channel: "alpha"
            },
            class_type: "LoadImageMask",
            _meta: { title: "Inpaint Mask" }
          },
          "12": {
            inputs: {
              text: "old positive",
              clip: ["1", 1]
            },
            class_type: "CLIPTextEncode"
          },
          "13": {
            inputs: {
              text: "old negative",
              clip: ["1", 1]
            },
            class_type: "CLIPTextEncode",
            _meta: { title: "Negative Prompt" }
          },
          "20": {
            inputs: {
              filename_prefix: "old",
              images: ["21", 0]
            },
            class_type: "SaveImage"
          }
        }
      },
      {
        fetchImpl,
        sleep: async () => {}
      }
    );

    expect(calls.map((call) => call.url)).toEqual([
      "http://127.0.0.1:8188/upload/image",
      "http://127.0.0.1:8188/upload/mask",
      "http://127.0.0.1:8188/prompt",
      "http://127.0.0.1:8188/history/prompt-inputs",
      "http://127.0.0.1:8188/view?filename=inpaint_00001_.png&subfolder=&type=output"
    ]);

    const promptBody = JSON.parse(String(calls[2]!.body)) as { prompt: Record<string, any> };
    expect(promptBody.prompt["10"].inputs.image).toBe("layout-reference.png");
    expect(promptBody.prompt["11"].inputs.image).toBe("layout-mask.png");
    expect(promptBody.prompt["12"].inputs.text).toBe("Repair the tavern door area.");
    expect(promptBody.prompt["13"].inputs.text).toBe("messy");
  });

  it("records job state through completion and timeout", async () => {
    const completedStore = new InMemoryComfyUIJobStore();
    const completedFetch = (async (url: string) => {
      if (url.endsWith("/prompt")) {
        return { ok: true, json: async () => ({ prompt_id: "prompt-complete" }) } as Response;
      }
      if (url.endsWith("/history/prompt-complete")) {
        return {
          ok: true,
          json: async () => ({
            "prompt-complete": {
              outputs: {
                "9": {
                  images: [{ filename: "complete_00001_.png", subfolder: "", type: "output" }]
                }
              }
            }
          })
        } as Response;
      }
      if (url.includes("/view?")) {
        return {
          headers: new Headers({ "content-type": "image/png" }),
          ok: true,
          arrayBuffer: async () => new Uint8Array([1]).buffer
        } as Response;
      }
      throw new Error(`Unexpected URL ${url}`);
    }) as typeof fetch;

    await generateComfyUIImage(
      {
        height: 256,
        prompt: "A completed job.",
        targetId: "complete-target",
        width: 256
      },
      {
        checkpointName: "test-model.safetensors",
        pollIntervalMs: 1,
        timeoutMs: 1_000
      },
      {
        fetchImpl: completedFetch,
        jobStore: completedStore,
        now: () => 100,
        sleep: async () => {}
      }
    );

    expect(completedStore.get("prompt-complete")).toMatchObject({
      filename: "complete_00001_.png",
      status: "completed",
      targetId: "complete-target"
    });

    let now = 0;
    const timedOutStore = new InMemoryComfyUIJobStore();
    const timedOutFetch = (async (url: string) => {
      if (url.endsWith("/prompt")) {
        return { ok: true, json: async () => ({ prompt_id: "prompt-timeout-state" }) } as Response;
      }
      if (url.endsWith("/history/prompt-timeout-state")) {
        return { ok: true, json: async () => ({ "prompt-timeout-state": { outputs: {} } }) } as Response;
      }
      throw new Error(`Unexpected URL ${url}`);
    }) as typeof fetch;

    await expect(
      generateComfyUIImage(
        {
          height: 256,
          prompt: "A timeout job.",
          targetId: "timeout-target",
          width: 256
        },
        {
          checkpointName: "test-model.safetensors",
          pollIntervalMs: 1,
          timeoutMs: 60_000
        },
        {
          fetchImpl: timedOutFetch,
          jobStore: timedOutStore,
          now: () => {
            now += 60_001;
            return now;
          },
          sleep: async () => {}
        }
      )
    ).rejects.toThrow("ComfyUI generation timed out after 1 minute(s).");

    expect(timedOutStore.get("prompt-timeout-state")).toMatchObject({
      status: "timedOut",
      targetId: "timeout-target"
    });
  });
});
