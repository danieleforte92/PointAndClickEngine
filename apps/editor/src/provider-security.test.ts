import { describe, expect, it } from "vitest";
import { assertProviderEndpointConsent, validateProviderEndpoint } from "./provider-security";

describe("provider endpoint policy", () => {
  it("recognizes default loopback providers without remote consent", () => {
    expect(
      assertProviderEndpointConsent({
        defaultBaseUrl: "http://127.0.0.1:8188",
        providerLabel: "ComfyUI"
      })
    ).toMatchObject({ isCustomEndpoint: false, trust: "loopback", url: "http://127.0.0.1:8188" });
    expect(
      assertProviderEndpointConsent({
        baseUrl: "http://localhost:1234/v1",
        defaultBaseUrl: "http://127.0.0.1:8188",
        providerLabel: "LM Studio"
      })
    ).toMatchObject({ isCustomEndpoint: true, trust: "loopback" });
  });

  it("requires explicit consent for default cloud and custom remote endpoints", () => {
    expect(() =>
      assertProviderEndpointConsent({
        defaultBaseUrl: "https://api.openai.com/v1",
        providerLabel: "OpenAI"
      })
    ).toThrow("Explicit consent is required");
    expect(() =>
      assertProviderEndpointConsent({
        baseUrl: "https://provider.example/v1",
        defaultBaseUrl: "http://localhost:1234/v1",
        providerLabel: "LM Studio"
      })
    ).toThrow("Explicit consent is required");
    expect(
      assertProviderEndpointConsent({
        allowRemoteProvider: true,
        baseUrl: "https://provider.example/v1",
        defaultBaseUrl: "http://localhost:1234/v1",
        providerLabel: "LM Studio"
      })
    ).toMatchObject({ isCustomEndpoint: true, trust: "remote" });
  });

  it("rejects non-HTTP endpoints and embedded credentials", () => {
    expect(() => validateProviderEndpoint("file:///tmp/provider", "http://localhost:1234", "LM Studio")).toThrow(
      "must use HTTP or HTTPS"
    );
    expect(() =>
      validateProviderEndpoint("https://token@example.com/v1", "http://localhost:1234", "LM Studio")
    ).toThrow("must not embed credentials");
  });
});
