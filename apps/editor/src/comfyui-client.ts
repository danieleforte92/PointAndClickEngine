import type { ComfyWorkflow } from "./comfyui-workflow-patcher";
import type { ComfyImageReference } from "./comfyui-output-parser";

interface ComfyPromptResponse {
  prompt_id?: string;
}

async function readError(response: Response) {
  return response.text().catch(() => response.statusText);
}

export class ComfyUIClient {
  readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: { baseUrl?: string; fetchImpl?: typeof fetch } = {}) {
    this.baseUrl = (options.baseUrl?.trim() || "http://127.0.0.1:8188").replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async queuePrompt(workflow: ComfyWorkflow): Promise<string> {
    const response = await this.fetchImpl(`${this.baseUrl}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow })
    });

    if (!response.ok) {
      throw new Error(`ComfyUI prompt queue failed (${response.status}): ${await readError(response)}`);
    }

    const payload = (await response.json()) as ComfyPromptResponse;
    const promptId = payload.prompt_id;
    if (!promptId) {
      throw new Error("ComfyUI prompt response did not include prompt_id.");
    }
    return promptId;
  }

  async getHistory(promptId: string): Promise<unknown> {
    const response = await this.fetchImpl(`${this.baseUrl}/history/${encodeURIComponent(promptId)}`);
    if (!response.ok) {
      throw new Error(`ComfyUI history failed (${response.status}): ${await readError(response)}`);
    }
    return response.json();
  }

  async downloadImage(imageReference: ComfyImageReference): Promise<{ bytes: Uint8Array; mimeType: string }> {
    if (!imageReference.filename) {
      throw new Error("ComfyUI image download needs a filename.");
    }

    const viewUrl = new URL(`${this.baseUrl}/view`);
    viewUrl.searchParams.set("filename", imageReference.filename);
    viewUrl.searchParams.set("subfolder", imageReference.subfolder ?? "");
    viewUrl.searchParams.set("type", imageReference.type ?? "output");

    const response = await this.fetchImpl(viewUrl.toString());
    if (!response.ok) {
      throw new Error(`ComfyUI image download failed (${response.status}): ${await readError(response)}`);
    }

    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      mimeType: response.headers.get("content-type") ?? "image/png"
    };
  }
}
