import { randomUUID } from "node:crypto";
import type {
  ImageGenerationCandidate,
  ImageGenerationProviderResult,
  ImageGenerationQueueJob,
  StartImageGenerationRequest
} from "./image-generation";

export interface StoredCandidate {
  descriptor: ImageGenerationCandidate;
  bytes: Uint8Array;
  projectDirectory: string;
  request: StartImageGenerationRequest;
  result: ImageGenerationProviderResult;
}

interface StoredJob {
  candidateIds: string[];
  completed: number;
  id: string;
  requested: number;
  status: ImageGenerationQueueJob["status"];
}

export class ImageCandidateStore {
  private readonly jobs = new Map<string, StoredJob>();
  private readonly candidates = new Map<string, StoredCandidate>();

  createJob(requested: number): ImageGenerationQueueJob {
    if (!Number.isInteger(requested) || requested < 1 || requested > 4) {
      throw new RangeError("Image generation batch size must be between 1 and 4.");
    }
    const job: StoredJob = { candidateIds: [], completed: 0, id: randomUUID(), requested, status: "queued" };
    this.jobs.set(job.id, job);
    return this.snapshot(job);
  }

  setStatus(jobId: string, status: StoredJob["status"]): ImageGenerationQueueJob {
    const job = this.requireJob(jobId);
    job.status = status;
    return this.snapshot(job);
  }

  addCandidate(
    jobId: string,
    projectDirectory: string,
    request: StartImageGenerationRequest,
    result: ImageGenerationProviderResult,
    descriptor: Omit<ImageGenerationCandidate, "id">
  ): ImageGenerationCandidate {
    const job = this.requireJob(jobId);
    if (job.status === "cancelled") throw new Error("Image generation job was cancelled.");
    const candidate: StoredCandidate = {
      bytes: result.bytes,
      descriptor: { ...descriptor, id: randomUUID() },
      projectDirectory,
      request,
      result
    };
    this.candidates.set(candidate.descriptor.id, candidate);
    job.candidateIds.push(candidate.descriptor.id);
    job.completed += 1;
    return candidate.descriptor;
  }

  getCandidate(candidateId: string): StoredCandidate {
    const candidate = this.candidates.get(candidateId);
    if (!candidate) throw new Error("Image candidate was not found or has already been discarded.");
    return candidate;
  }

  discardCandidate(candidateId: string): void {
    this.candidates.delete(candidateId);
    for (const job of this.jobs.values()) {
      job.candidateIds = job.candidateIds.filter((id) => id !== candidateId);
    }
  }

  discardJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    for (const candidateId of job.candidateIds) this.candidates.delete(candidateId);
    this.jobs.delete(jobId);
  }

  job(jobId: string): ImageGenerationQueueJob {
    return this.snapshot(this.requireJob(jobId));
  }

  private requireJob(jobId: string): StoredJob {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error("Image generation job was not found.");
    return job;
  }

  private snapshot(job: StoredJob): ImageGenerationQueueJob {
    return { ...job, candidateIds: [...job.candidateIds] };
  }
}
