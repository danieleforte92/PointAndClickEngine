export interface ComfyImageReference {
  filename?: string;
  subfolder?: string;
  type?: string;
}

function imageReferenceFromValue(value: unknown): ComfyImageReference | null {
  if (!value || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = imageReferenceFromValue(entry);
      if (found) return found;
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.filename === "string") {
    return {
      filename: record.filename,
      subfolder: typeof record.subfolder === "string" ? record.subfolder : "",
      type: typeof record.type === "string" ? record.type : "output"
    };
  }

  for (const child of Object.values(record)) {
    const found = imageReferenceFromValue(child);
    if (found) return found;
  }
  return null;
}

export function findImageReference(historyPayload: unknown, outputNodeId?: string): ComfyImageReference | null {
  if (outputNodeId && historyPayload && typeof historyPayload === "object") {
    for (const promptEntry of Object.values(historyPayload as Record<string, unknown>)) {
      if (!promptEntry || typeof promptEntry !== "object") continue;
      const outputs = (promptEntry as { outputs?: unknown }).outputs;
      if (!outputs || typeof outputs !== "object") continue;
      const preferredOutput = (outputs as Record<string, unknown>)[outputNodeId];
      const preferredReference = imageReferenceFromValue(preferredOutput);
      if (preferredReference) return preferredReference;
    }
  }

  return imageReferenceFromValue(historyPayload);
}
