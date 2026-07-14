import { describe, expect, it } from "vitest";
import { ImageCandidateStore } from "./image-candidate-store";

describe("image candidate lifecycle", () => {
  it("keeps candidates temporary until explicit apply or discard", () => {
    const store = new ImageCandidateStore();
    const job = store.createJob(2);
    store.setStatus(job.id, "running");
    const result = {
      bytes: new Uint8Array([1, 2, 3]),
      filename: "candidate.png",
      height: 64,
      mimeType: "image/png",
      providerId: "comfyui-local" as const,
      providerJobId: "provider-1",
      targetId: "door",
      width: 64
    };
    const candidate = store.addCandidate(job.id, "C:/project", { providerId: "comfyui-local", prompt: "door", targetId: "door", width: 64, height: 64 }, result, {
      hasAlphaPixels: false,
      height: 64,
      mimeType: "image/png",
      model: "local",
      previewDataUrl: "data:image/png;base64,AQID",
      provider: "comfyui-local",
      providerJobId: "provider-1",
      seed: 0,
      targetId: "door",
      warnings: [],
      width: 64
    });
    expect(store.getCandidate(candidate.id).projectDirectory).toBe("C:/project");
    expect(store.job(job.id).candidateIds).toEqual([candidate.id]);
    store.discardCandidate(candidate.id);
    expect(() => store.getCandidate(candidate.id)).toThrow(/discarded/);
  });
});
