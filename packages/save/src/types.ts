export const SAVE_SCHEMA_VERSION = 1 as const;

export const SAVE_SLOT_IDS = ["manual-1", "manual-2", "manual-3", "autosave"] as const;

export const SAVE_SLOTS = SAVE_SLOT_IDS;

export type SaveSlotId = (typeof SAVE_SLOT_IDS)[number];

export type Sha256 = string;

export type ProjectFingerprint = Sha256;

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export type JsonArray = readonly JsonValue[];

export interface StableCheckpoint<
  TWorldState extends JsonValue = JsonValue,
  TFlowSession extends JsonValue = JsonValue,
  TEvent extends JsonValue = JsonValue
> {
  readonly kind: "stable";
  readonly worldState: TWorldState;
  readonly flowSession: TFlowSession | null;
  readonly eventLog: readonly TEvent[];
  readonly sequence?: number;
}

/** Compact checkpoint input kept for callers that already expose stable state plus a sequence. */
export interface StableStateCheckpoint<TWorldState extends JsonValue = JsonValue> {
  readonly state: TWorldState;
  readonly sequence: number;
}

export type SaveCheckpoint<
  TWorldState extends JsonValue = JsonValue,
  TFlowSession extends JsonValue = JsonValue,
  TEvent extends JsonValue = JsonValue
> = StableCheckpoint<TWorldState, TFlowSession, TEvent> | StableStateCheckpoint<TWorldState>;

export interface SaveDocumentPayload<
  TWorldState extends JsonValue = JsonValue,
  TFlowSession extends JsonValue = JsonValue,
  TEvent extends JsonValue = JsonValue
> {
  readonly schemaVersion: typeof SAVE_SCHEMA_VERSION;
  readonly slot: SaveSlotId;
  readonly projectFingerprint: ProjectFingerprint;
  readonly locale: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly checkpoint: StableCheckpoint<TWorldState, TFlowSession, TEvent>;
}

export interface SaveDocument<
  TWorldState extends JsonValue = JsonValue,
  TFlowSession extends JsonValue = JsonValue,
  TEvent extends JsonValue = JsonValue
> extends SaveDocumentPayload<TWorldState, TFlowSession, TEvent> {
  readonly checksum: string;
}

export interface CreateSaveDocumentInput<
  TWorldState extends JsonValue = JsonValue,
  TFlowSession extends JsonValue = JsonValue,
  TEvent extends JsonValue = JsonValue
> {
  readonly slot: SaveSlotId;
  readonly projectFingerprint: ProjectFingerprint;
  readonly locale: string;
  readonly checkpoint: SaveCheckpoint<TWorldState, TFlowSession, TEvent>;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface SaveValidationOptions {
  readonly expectedProjectFingerprint?: string;
}

export interface SaveValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly path: string;
}

export interface SaveValidationResult {
  readonly valid: boolean;
  readonly errors: readonly SaveValidationIssue[];
}

export class SaveCorruptionError extends Error {
  readonly issues: readonly SaveValidationIssue[];

  constructor(message: string, issues: readonly SaveValidationIssue[]) {
    super(message);
    this.name = "SaveCorruptionError";
    this.issues = issues;
  }
}
