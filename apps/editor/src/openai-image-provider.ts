import type {
  ImageGenerationProvider,
  ImageGenerationProviderRequest,
  ImageGenerationProviderResult
} from "./image-generation";

export interface OpenAIImageProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  mode?: "images-api" | "responses-api";
  model?: string;
}

function requiredApiKey(value: string | undefined): string {
  const apiKey = value?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OpenAI image generation needs an API key. Set OPENAI_API_KEY or enter one in AI Studio.");
  }
  return apiKey;
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

function errorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const error = record.error;
    if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") {
      return (error as { message: string }).message;
    }
    if (typeof record.message === "string") return record.message;
  }
  return fallback;
}

function imageSize(width: number, height: number): "1024x1024" | "1024x1536" | "1536x1024" | "auto" {
  if (width === height) return "1024x1024";
  return width > height ? "1536x1024" : "1024x1536";
}

function base64FromResponsesPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) return null;
  for (const entry of output) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (record.type === "image_generation_call" && typeof record.result === "string") {
      return record.result;
    }
  }
  return null;
}

function base64FromImagesPayload(payload: unknown): string | null {
  const data = payload && typeof payload === "object" ? (payload as { data?: unknown }).data : null;
  if (!Array.isArray(data)) return null;
  const first = data.find((entry) => entry && typeof entry === "object") as Record<string, unknown> | undefined;
  return typeof first?.b64_json === "string" ? first.b64_json : null;
}

export class OpenAIImageProvider implements ImageGenerationProvider {
  readonly id = "openai-image" as const;

  constructor(private readonly config: OpenAIImageProviderConfig = {}) {}

  async generate(request: ImageGenerationProviderRequest): Promise<ImageGenerationProviderResult> {
    if (request.referenceAssets?.length || request.maskAsset) {
      throw new Error("OpenAI image provider currently supports text-to-image only in AI Studio.");
    }

    const startedAt = Date.now();
    const fetchImpl = this.config.fetchImpl ?? fetch;
    const apiKey = requiredApiKey(this.config.apiKey);
    const baseUrl = (this.config.baseUrl?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
    const model = this.config.model?.trim() || "gpt-image-2";
    const mode = this.config.mode ?? "images-api";
    const prompt = request.negativePrompt ? `${request.prompt}\n\nAvoid: ${request.negativePrompt}` : request.prompt;

    if (mode === "responses-api") {
      const response = await fetchImpl(`${baseUrl}/responses`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          input: prompt,
          tools: [{ type: "image_generation", size: imageSize(request.width, request.height) }]
        })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(`OpenAI image generation failed: ${errorMessage(payload, response.statusText)}`);
      }
      const imageBase64 = base64FromResponsesPayload(payload);
      if (!imageBase64) {
        throw new Error("OpenAI image generation returned no image_generation_call result.");
      }
      return {
        bytes: Buffer.from(imageBase64, "base64"),
        filename: `${request.targetId}.png`,
        height: request.height,
        latencyMs: Date.now() - startedAt,
        mimeType: "image/png",
        model,
        providerId: this.id,
        providerJobId:
          payload && typeof payload === "object" && typeof (payload as { id?: unknown }).id === "string"
            ? (payload as { id: string }).id
            : `openai-${Date.now()}`,
        ...(request.seed !== undefined ? { seed: request.seed } : {}),
        targetId: request.targetId,
        width: request.width
      };
    }

    const response = await fetchImpl(`${baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size: imageSize(request.width, request.height),
        response_format: "b64_json"
      })
    });
    const payload = await readJsonResponse(response);
    if (!response.ok) {
      throw new Error(`OpenAI image generation failed: ${errorMessage(payload, response.statusText)}`);
    }
    const imageBase64 = base64FromImagesPayload(payload);
    if (!imageBase64) {
      throw new Error("OpenAI image generation returned no b64_json image data.");
    }
    return {
      bytes: Buffer.from(imageBase64, "base64"),
      filename: `${request.targetId}.png`,
      height: request.height,
      latencyMs: Date.now() - startedAt,
      mimeType: "image/png",
      model,
      providerId: this.id,
      providerJobId: `openai-${Date.now()}`,
      ...(request.seed !== undefined ? { seed: request.seed } : {}),
      targetId: request.targetId,
      width: request.width
    };
  }
}
