export type ComfyUIJobStatus = "queued" | "running" | "completed" | "failed" | "timedOut";

export interface ComfyUIJobState {
  completedAt?: number;
  error?: string;
  filename?: string;
  promptId: string;
  startedAt: number;
  status: ComfyUIJobStatus;
  targetId: string;
  updatedAt: number;
}

export interface ComfyUIJobStore {
  get(promptId: string): ComfyUIJobState | undefined;
  list(): ComfyUIJobState[];
  set(job: ComfyUIJobState): void;
  update(promptId: string, patch: Partial<Omit<ComfyUIJobState, "promptId" | "startedAt" | "targetId">>): void;
}

export class InMemoryComfyUIJobStore implements ComfyUIJobStore {
  private readonly jobs = new Map<string, ComfyUIJobState>();

  get(promptId: string): ComfyUIJobState | undefined {
    return this.jobs.get(promptId);
  }

  list(): ComfyUIJobState[] {
    return [...this.jobs.values()];
  }

  set(job: ComfyUIJobState): void {
    this.jobs.set(job.promptId, job);
  }

  update(promptId: string, patch: Partial<Omit<ComfyUIJobState, "promptId" | "startedAt" | "targetId">>): void {
    const current = this.jobs.get(promptId);
    if (!current) return;
    this.jobs.set(promptId, {
      ...current,
      ...patch
    });
  }
}
