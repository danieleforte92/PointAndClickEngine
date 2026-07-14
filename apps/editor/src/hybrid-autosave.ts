export type AutosaveDocumentStatus = "clean" | "draft-invalid" | "pending" | "saving" | "saved" | "error";

export interface AutosaveDocumentState {
  error?: string;
  status: AutosaveDocumentStatus;
  updatedAt: number;
}
export interface HybridAutosaveOptions<T> {
  delayMs?: number;
  persist(documentId: string, value: T): Promise<void>;
  recover(documentId: string, value: T): Promise<void> | void;
  validate(documentId: string, value: T): readonly string[];
  onStatusChange?(documentId: string, state: AutosaveDocumentState): void;
}

interface PendingDocument<T> {
  revision: number;
  timer: ReturnType<typeof setTimeout> | null;
  value: T;
}

/** Coalesces valid writes per document while keeping every draft recoverable immediately. */
export class HybridAutosaveController<T> {
  private readonly pending = new Map<string, PendingDocument<T>>();
  private readonly delayMs: number;

  constructor(private readonly options: HybridAutosaveOptions<T>) {
    this.delayMs = options.delayMs ?? 800;
  }

  update(documentId: string, value: T): void {
    const previous = this.pending.get(documentId);
    if (previous?.timer) clearTimeout(previous.timer);
    const revision = (previous?.revision ?? 0) + 1;
    const pending: PendingDocument<T> = { revision, timer: null, value };
    this.pending.set(documentId, pending);
    void this.options.recover(documentId, value);

    const problems = this.options.validate(documentId, value);
    if (problems.length > 0) {
      this.emit(documentId, "draft-invalid", problems[0]);
      return;
    }

    this.emit(documentId, "pending");
    pending.timer = setTimeout(() => void this.persist(documentId, revision), this.delayMs);
  }

  async flush(documentId?: string): Promise<void> {
    const ids = documentId ? [documentId] : [...this.pending.keys()];
    for (const id of ids) {
      const pending = this.pending.get(id);
      if (!pending) continue;
      if (pending.timer) clearTimeout(pending.timer);
      if (this.options.validate(id, pending.value).length === 0) {
        await this.persist(id, pending.revision);
      }
    }
  }

  cancel(documentId?: string): void {
    const ids = documentId ? [documentId] : [...this.pending.keys()];
    for (const id of ids) {
      const pending = this.pending.get(id);
      if (pending?.timer) clearTimeout(pending.timer);
      this.pending.delete(id);
    }
  }

  private async persist(documentId: string, revision: number): Promise<void> {
    const pending = this.pending.get(documentId);
    if (!pending || pending.revision !== revision) return;
    pending.timer = null;
    this.emit(documentId, "saving");
    try {
      await this.options.persist(documentId, pending.value);
      if (this.pending.get(documentId)?.revision === revision) {
        this.pending.delete(documentId);
        this.emit(documentId, "saved");
      }
    } catch (error) {
      if (this.pending.get(documentId)?.revision === revision) {
        this.emit(documentId, "error", error instanceof Error ? error.message : "Autosave failed");
      }
    }
  }

  private emit(documentId: string, status: AutosaveDocumentStatus, error?: string): void {
    this.options.onStatusChange?.(documentId, {
      ...(error ? { error } : {}),
      status,
      updatedAt: Date.now()
    });
  }
}
