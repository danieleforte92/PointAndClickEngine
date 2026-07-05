import { describe, expect, it } from "vitest";
import { GoogleImageProvider } from "./google-image-provider";
import { OpenAIImageProvider } from "./openai-image-provider";

const baseRequest = {
  height: 1024,
  output: { expectedAlpha: false },
  prompt: "A readable point-and-click adventure prop.",
  providerConfig: {},
  targetId: "rusty-hook",
  width: 1024
};

describe("OpenAIImageProvider", () => {
  it("normalizes Images API b64_json output", async () => {
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://api.openai.com/v1/images/generations");
      expect(init?.headers).toMatchObject({ Authorization: "Bearer test-key" });
      expect(init?.body ? JSON.parse(String(init.body)) : null).toMatchObject({
        model: "gpt-image-2",
        response_format: "b64_json",
        size: "1024x1024"
      });
      return {
        ok: true,
        text: async () => JSON.stringify({ data: [{ b64_json: Buffer.from([1, 2, 3]).toString("base64") }] })
      } as Response;
    }) as typeof fetch;

    const result = await new OpenAIImageProvider({ apiKey: "test-key", fetchImpl }).generate(baseRequest);

    expect(result).toMatchObject({
      filename: "rusty-hook.png",
      model: "gpt-image-2",
      providerId: "openai-image",
      targetId: "rusty-hook"
    });
    expect([...result.bytes]).toEqual([1, 2, 3]);
  });

  it("normalizes Responses image tool output", async () => {
    const fetchImpl = (async (url: string) => {
      expect(url).toBe("https://api.openai.com/v1/responses");
      return {
        ok: true,
        text: async () =>
          JSON.stringify({
            id: "resp-123",
            output: [{ type: "image_generation_call", result: Buffer.from([4, 5, 6]).toString("base64") }]
          })
      } as Response;
    }) as typeof fetch;

    const result = await new OpenAIImageProvider({
      apiKey: "test-key",
      fetchImpl,
      mode: "responses-api",
      model: "gpt-5.5"
    }).generate(baseRequest);

    expect(result.providerJobId).toBe("resp-123");
    expect([...result.bytes]).toEqual([4, 5, 6]);
  });
});

describe("GoogleImageProvider", () => {
  it("normalizes Gemini API inline image data", async () => {
    const fetchImpl = (async (url: string) => {
      expect(url).toBe(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=gemini-key"
      );
      return {
        ok: true,
        text: async () =>
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ inlineData: { data: Buffer.from([7, 8, 9]).toString("base64"), mimeType: "image/png" } }]
                }
              }
            ]
          })
      } as Response;
    }) as typeof fetch;

    const result = await new GoogleImageProvider({ apiKey: "gemini-key", fetchImpl }).generate(baseRequest);

    expect(result).toMatchObject({
      model: "gemini-2.5-flash-image",
      providerId: "google-image",
      targetId: "rusty-hook"
    });
    expect([...result.bytes]).toEqual([7, 8, 9]);
  });

  it("normalizes Vertex AI base64 predictions", async () => {
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      expect(url).toBe(
        "https://us-central1-aiplatform.googleapis.com/v1/projects/demo/locations/us-central1/publishers/google/models/imagen-4.0-generate-preview:predict"
      );
      expect(init?.headers).toMatchObject({ Authorization: "Bearer vertex-token" });
      return {
        ok: true,
        text: async () =>
          JSON.stringify({
            predictions: [{ bytesBase64Encoded: Buffer.from([10, 11]).toString("base64"), mimeType: "image/png" }]
          })
      } as Response;
    }) as typeof fetch;

    const result = await new GoogleImageProvider({
      accessToken: "vertex-token",
      fetchImpl,
      projectId: "demo",
      provider: "vertex-ai"
    }).generate(baseRequest);

    expect(result.model).toBe("imagen-4.0-generate-preview");
    expect([...result.bytes]).toEqual([10, 11]);
  });
});

