export type ProviderEndpointTrust = "loopback" | "remote";

export interface ProviderEndpointPolicyInput {
  allowRemoteProvider?: boolean | undefined;
  baseUrl?: string | undefined;
  defaultBaseUrl: string;
  providerLabel: string;
}

export interface ValidatedProviderEndpoint {
  isCustomEndpoint: boolean;
  trust: ProviderEndpointTrust;
  url: string;
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "::1" || /^127(?:\.\d{1,3}){3}$/.test(normalized);
}

export function validateProviderEndpoint(
  baseUrl: string | undefined,
  defaultBaseUrl: string,
  providerLabel: string
): ValidatedProviderEndpoint {
  const configuredBaseUrl = baseUrl?.trim();
  let endpoint: URL;
  try {
    endpoint = new URL(configuredBaseUrl || defaultBaseUrl);
  } catch {
    throw new Error(`${providerLabel} endpoint must be a valid absolute HTTP(S) URL.`);
  }

  if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
    throw new Error(`${providerLabel} endpoint must use HTTP or HTTPS.`);
  }
  if (endpoint.username || endpoint.password) {
    throw new Error(`${providerLabel} endpoint must not embed credentials in the URL.`);
  }
  if (!endpoint.hostname) {
    throw new Error(`${providerLabel} endpoint must include a hostname.`);
  }

  return {
    isCustomEndpoint: Boolean(configuredBaseUrl),
    trust: isLoopbackHostname(endpoint.hostname) ? "loopback" : "remote",
    url: endpoint.toString().replace(/\/$/, "")
  };
}

export function assertProviderEndpointConsent(input: ProviderEndpointPolicyInput): ValidatedProviderEndpoint {
  const endpoint = validateProviderEndpoint(input.baseUrl, input.defaultBaseUrl, input.providerLabel);
  if (endpoint.trust === "remote" && input.allowRemoteProvider !== true) {
    throw new Error(
      `${input.providerLabel} uses remote endpoint "${endpoint.url}". Explicit consent is required before sending project prompts or assets; enable remote provider consent in AI Studio.`
    );
  }
  return endpoint;
}
