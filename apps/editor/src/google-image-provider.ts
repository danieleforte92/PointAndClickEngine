import type {
  ImageGenerationProvider,
  ImageGenerationProviderRequest,
  ImageGenerationProviderResult
} from "./image-generation";

export interface GoogleImageProviderConfig {
  accessToken?: string;
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  location?: string;
  model?: string;
  projectId?: string;
  provider?: "gemini-api" | "vertex-ai";
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

function geminiImageFromPayload(payload: unknown): { data: string; mimeType: string } | null {
  const candidates = payload && typeof payload === "object" ? (payload as { candidates?: unknown }).candidates : null;
  if (!Array.isArray(candidates)) return null;
  for (const candidate of candidates) {
    const parts =
      candidate && typeof candidate === "object"
        ? (candidate as { content?: { parts?: unknown } }).content?.parts
        : null;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      const inlineData = part && typeof part === "object" ? (part as { inlineData?: unknown }).inlineData : null;
      if (!inlineData || typeof inlineData !== "object") continue;
      const record = inlineData as Record<string, unknown>;
      if (typeof record.data === "string") {
        return {
          data: record.data,
          mimeType: typeof record.mimeType === "string" ? record.mimeType : "image/png"
        };
      }
    }
  }
  return null;
}

function vertexImageFromPayload(payload: unknown): { data: string; mimeType: string } | null {
  const predictions =
    payload && typeof payload === "object" ? (payload as { predictions?: unknown }).predictions : null;
  if (!Array.isArray(predictions)) return null;
  for (const prediction of predictions) {
    if (!prediction || typeof prediction !== "object") continue;
    const record = prediction as Record<string, unknown>;
    if (typeof record.bytesBase64Encoded === "string") {
      return {
        data: record.bytesBase64Encoded,
        mimeType: typeof record.mimeType === "string" ? record.mimeType : "image/png"
      };
    }
  }
  return null;
}

export class GoogleImageProvider implements ImageGenerationProvider {
  readonly id = "google-image" as const;

  constructor(private readonly config: GoogleImageProviderConfig = {}) {}

  async generate(request: ImageGenerationProviderRequest): Promise<ImageGenerationProviderResult> {
    if (request.referenceAssets?.length || request.maskAsset) {
      throw new Error("Google image provider currently supports text-to-image only in AI Studio.");
    }

    const provider = this.config.provider ?? "gemini-api";
    const startedAt = Date.now();
    const fetchImpl = this.config.fetchImpl ?? fetch;
    const model =
      this.config.model?.trim() ||
      (provider === "vertex-ai" ? "imagen-4.0-generate-preview" : "gemini-2.5-flash-image");
    const prompt = request.negativePrompt ? `${request.prompt}\n\nAvoid: ${request.negativePrompt}` : request.prompt;

    if (provider === "vertex-ai") {
      const projectId = this.config.projectId?.trim();
      const location = this.config.location?.trim() || "us-central1";
      const accessToken = this.config.accessToken?.trim() || process.env.GOOGLE_VERTEX_ACCESS_TOKEN?.trim();
      if (!projectId) {
        throw new Error("Vertex AI image generation needs a Google Cloud project id.");
      }
      if (!accessToken) {
        throw new Error("Vertex AI image generation needs an OAuth access token.");
      }
      const baseUrl = (this.config.baseUrl?.trim() || `https://${location}-aiplatform.googleapis.com/v1`).replace(
        /\/+$/,
        ""
      );
      const response = await fetchImpl(
        `${baseUrl}/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(
          location
        )}/publishers/google/models/${encodeURIComponent(model)}:predict`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: {
              sampleCount: 1,
              outputOptions: { mimeType: "image/png" }
            }
          })
        }
      );
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(`Vertex AI image generation failed: ${errorMessage(payload, response.statusText)}`);
      }
      const image = vertexImageFromPayload(payload);
      if (!image) {
        throw new Error("Vertex AI image generation returned no bytesBase64Encoded prediction.");
      }
      return {
        bytes: Buffer.from(image.data, "base64"),
        filename: `${request.targetId}.png`,
        height: request.height,
        latencyMs: Date.now() - startedAt,
        mimeType: image.mimeType,
        model,
        providerId: this.id,
        providerJobId: `vertex-${Date.now()}`,
        ...(request.seed !== undefined ? { seed: request.seed } : {}),
        targetId: request.targetId,
        width: request.width
      };
    }

    const apiKey = this.config.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("Gemini image generation needs an API key. Set GEMINI_API_KEY or enter one in AI Studio.");
    }
    const baseUrl = (this.config.baseUrl?.trim() || "https://generativelanguage.googleapis.com/v1beta").replace(
      /\/+$/,
      ""
    );
    const response = await fetchImpl(`${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    const payload = await readJsonResponse(response);
    if (!response.ok) {
      throw new Error(`Gemini image generation failed: ${errorMessage(payload, response.statusText)}`);
    }
    const image = geminiImageFromPayload(payload);
    if (!image) {
      throw new Error("Gemini image generation returned no inline image data.");
    }
    return {
      bytes: Buffer.from(image.data, "base64"),
      filename: `${request.targetId}.png`,
      height: request.height,
      latencyMs: Date.now() - startedAt,
      mimeType: image.mimeType,
      model,
      providerId: this.id,
      providerJobId: `gemini-${Date.now()}`,
      ...(request.seed !== undefined ? { seed: request.seed } : {}),
      targetId: request.targetId,
      width: request.width
    };
  }
}
