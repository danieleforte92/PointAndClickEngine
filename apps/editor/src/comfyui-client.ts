import type { ComfyWorkflow } from "./comfyui-workflow-patcher";
import type { ComfyImageReference } from "./comfyui-output-parser";

interface ComfyPromptResponse {
  prompt_id?: string;
}

async function readError(response: Response) {
  return response.text().catch(() => response.statusText);
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function formatComfyQueueError(status: number, body: string) {
  const payload = tryParseJson(body);
  if (!payload || typeof payload !== "object") {
    return `ComfyUI prompt queue failed (${status}): ${body}`;
  }

  const nodeErrors = (payload as { node_errors?: unknown }).node_errors;
  if (nodeErrors && typeof nodeErrors === "object") {
    for (const [nodeId, nodeError] of Object.entries(nodeErrors)) {
      const errors = (nodeError as { errors?: unknown }).errors;
      if (!Array.isArray(errors)) continue;

      for (const error of errors) {
        const errorRecord = error as {
          extra_info?: { input_config?: unknown; input_name?: unknown; received_value?: unknown };
          message?: unknown;
          type?: unknown;
        };
        if (errorRecord.type !== "value_not_in_list" || errorRecord.extra_info?.input_name !== "ckpt_name") {
          continue;
        }

        const available = Array.isArray(errorRecord.extra_info.input_config)
          ? errorRecord.extra_info.input_config[0]
          : undefined;
        const availableCheckpoints = Array.isArray(available)
          ? available.filter((item): item is string => typeof item === "string")
          : [];
        const received = String(errorRecord.extra_info.received_value ?? "");
        const availableMessage = availableCheckpoints.length
          ? ` Available checkpoint(s): ${availableCheckpoints.map((item) => `"${item}"`).join(", ")}.`
          : "";

        return (
          `ComfyUI rejected checkpoint "${received}" on node ${nodeId}. ` +
          `Install that checkpoint, reinstall a preset that matches your local model, or set ` +
          `"Checkpoint filename / override" to one of ComfyUI's checkpoint names.${availableMessage}`
        );
      }
    }
  }

  return `ComfyUI prompt queue failed (${status}): ${body}`;
}

export interface ComfyUIUploadInput {
  bytes: Uint8Array;
  filename: string;
  mimeType?: string;
}

export interface ComfyUIUploadedImage {
  name: string;
  subfolder: string;
  type: string;
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
      throw new Error(formatComfyQueueError(response.status, await readError(response)));
    }

    const payload = (await response.json()) as ComfyPromptResponse;
    const promptId = payload.prompt_id;
    if (!promptId) {
      throw new Error("ComfyUI prompt response did not include prompt_id.");
    }
    return promptId;
  }

  async uploadImage(input: ComfyUIUploadInput): Promise<ComfyUIUploadedImage> {
    return this.uploadMultipart("/upload/image", input);
  }

  async uploadMask(input: ComfyUIUploadInput, originalRef: ComfyUIUploadedImage): Promise<ComfyUIUploadedImage> {
    return this.uploadMultipart("/upload/mask", input, {
      original_ref: JSON.stringify({
        filename: originalRef.name,
        subfolder: originalRef.subfolder,
        type: originalRef.type
      })
    });
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

  private async uploadMultipart(
    route: "/upload/image" | "/upload/mask",
    input: ComfyUIUploadInput,
    extraFields: Record<string, string> = {}
  ): Promise<ComfyUIUploadedImage> {
    const body = new FormData();
    const bytes = new Uint8Array(input.bytes);
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    body.set(
      "image",
      new Blob([arrayBuffer], { type: input.mimeType ?? "application/octet-stream" }),
      input.filename
    );
    body.set("type", "input");
    body.set("overwrite", "true");
    for (const [key, value] of Object.entries(extraFields)) {
      body.set(key, value);
    }

    const response = await this.fetchImpl(`${this.baseUrl}${route}`, {
      method: "POST",
      body
    });
    if (!response.ok) {
      throw new Error(`ComfyUI ${route} failed (${response.status}): ${await readError(response)}`);
    }

    const payload = (await response.json()) as Partial<ComfyUIUploadedImage> & { filename?: string };
    const name = payload.name ?? payload.filename;
    if (!name) {
      throw new Error(`ComfyUI ${route} response did not include an uploaded filename.`);
    }

    return {
      name,
      subfolder: payload.subfolder ?? "",
      type: payload.type ?? "input"
    };
  }
}
