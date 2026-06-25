import { describe, expect, it } from "vitest";
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
});
