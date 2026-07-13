import {
  canonicalStringify,
  computeSaveChecksum,
  saveDocumentPayload
} from "./serialization";
import {
  SAVE_SCHEMA_VERSION,
  SAVE_SLOT_IDS,
  SaveCorruptionError,
  type CreateSaveDocumentInput,
  type JsonValue,
  type SaveCheckpoint,
  type SaveDocument,
  type SaveDocumentPayload,
  type SaveSlotId,
  type SaveValidationIssue,
  type SaveValidationOptions,
  type SaveValidationResult,
  type StableCheckpoint
} from "./types";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(code: string, path: string, message: string): SaveValidationIssue {
  return { code, path, message };
}

function isJsonValue(value: unknown, path: string, errors: SaveValidationIssue[]): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return true;
    errors.push(issue("invalid-json-value", path, "JSON numbers must be finite."));
    return false;
  }
  if (Array.isArray(value)) {
    let valid = true;
    value.forEach((entry, index) => {
      valid = isJsonValue(entry, `${path}[${index}]`, errors) && valid;
    });
    return valid;
  }
  if (isRecord(value)) {
    let valid = true;
    for (const [key, entry] of Object.entries(value)) {
      valid = isJsonValue(entry, `${path}.${key}`, errors) && valid;
    }
    return valid;
  }

  errors.push(issue("invalid-json-value", path, "Value is not JSON serializable."));
  return false;
}

function isSaveSlotId(value: unknown): value is SaveSlotId {
  return typeof value === "string" && (SAVE_SLOT_IDS as readonly string[]).includes(value);
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function validateCheckpoint(value: unknown, errors: SaveValidationIssue[]): value is SaveCheckpoint {
  if (!isRecord(value)) {
    errors.push(issue("invalid-checkpoint", "checkpoint", "Checkpoint must be an object."));
    return false;
  }

  let valid = true;
  if (value.kind === "stable") {
    if (!("worldState" in value)) {
      errors.push(issue("missing-field", "checkpoint.worldState", "Stable checkpoint is missing worldState."));
      valid = false;
    } else {
      valid = isJsonValue(value.worldState, "checkpoint.worldState", errors) && valid;
    }
    if (!("flowSession" in value)) {
      errors.push(issue("missing-field", "checkpoint.flowSession", "Stable checkpoint is missing flowSession."));
      valid = false;
    } else if (value.flowSession !== null) {
      valid = isJsonValue(value.flowSession, "checkpoint.flowSession", errors) && valid;
    }
    if (!Array.isArray(value.eventLog)) {
      errors.push(issue("invalid-field", "checkpoint.eventLog", "Stable checkpoint eventLog must be an array."));
      valid = false;
    } else {
      value.eventLog.forEach((entry, index) => {
        valid = isJsonValue(entry, `checkpoint.eventLog[${index}]`, errors) && valid;
      });
    }
    if ("sequence" in value && (typeof value.sequence !== "number" || !Number.isInteger(value.sequence))) {
      errors.push(issue("invalid-field", "checkpoint.sequence", "Checkpoint sequence must be an integer."));
      valid = false;
    }
    return valid;
  }

  if ("kind" in value) {
    errors.push(issue("unstable-checkpoint", "checkpoint.kind", "Checkpoint kind must be stable."));
    return false;
  }

  if (!("state" in value)) {
    errors.push(issue("missing-field", "checkpoint.state", "Stable checkpoint is missing state."));
    valid = false;
  } else {
    valid = isJsonValue(value.state, "checkpoint.state", errors) && valid;
  }
  if (typeof value.sequence !== "number" || !Number.isInteger(value.sequence) || value.sequence < 0) {
    errors.push(issue("invalid-field", "checkpoint.sequence", "Checkpoint sequence must be a non-negative integer."));
    valid = false;
  }
  return valid;
}

function validationOptions(options: SaveValidationOptions | string): SaveValidationOptions {
  return typeof options === "string" ? { expectedProjectFingerprint: options } : options;
}

export function inspectSaveDocument(
  document: unknown,
  options: SaveValidationOptions | string = {}
): SaveValidationResult {
  const errors: SaveValidationIssue[] = [];
  const normalizedOptions = validationOptions(options);

  if (!isRecord(document)) {
    return {
      valid: false,
      errors: [issue("invalid-document", "$", "Save document must be an object.")]
    };
  }

  if (document.schemaVersion !== SAVE_SCHEMA_VERSION) {
    errors.push(issue("unsupported-schema-version", "schemaVersion", `Expected schema version ${SAVE_SCHEMA_VERSION}.`));
  }
  if (!isSaveSlotId(document.slot)) {
    errors.push(issue("invalid-slot", "slot", "Save slot must be manual-1, manual-2, manual-3, or autosave."));
  }
  if (typeof document.projectFingerprint !== "string" || !SHA256_PATTERN.test(document.projectFingerprint)) {
    errors.push(issue("invalid-fingerprint", "projectFingerprint", "Project fingerprint must be a lowercase SHA-256 hex string."));
  } else if (
    normalizedOptions.expectedProjectFingerprint &&
    document.projectFingerprint !== normalizedOptions.expectedProjectFingerprint
  ) {
    errors.push(issue("fingerprint-mismatch", "projectFingerprint", "Save belongs to a different project."));
  }
  if (typeof document.locale !== "string" || document.locale.trim().length === 0) {
    errors.push(issue("invalid-locale", "locale", "Save locale must be a non-empty string."));
  }
  if (!validTimestamp(document.createdAt)) {
    errors.push(issue("invalid-timestamp", "createdAt", "createdAt must be a valid timestamp."));
  }
  if (!validTimestamp(document.updatedAt)) {
    errors.push(issue("invalid-timestamp", "updatedAt", "updatedAt must be a valid timestamp."));
  }
  validateCheckpoint(document.checkpoint, errors);
  if (typeof document.checksum !== "string" || !SHA256_PATTERN.test(document.checksum)) {
    errors.push(issue("invalid-checksum", "checksum", "Checksum must be a lowercase SHA-256 hex string."));
  }

  if (errors.length === 0) {
    try {
      const expectedChecksum = computeSaveChecksum(document as unknown as SaveDocument);
      if (document.checksum !== expectedChecksum) {
        errors.push(issue("checksum-mismatch", "checksum", "Save checksum does not match its contents."));
      }
    } catch (error) {
      errors.push(
        issue(
          "invalid-document",
          "$",
          error instanceof Error ? error.message : "Save document could not be serialized."
        )
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateSaveDocument(
  document: unknown,
  options: SaveValidationOptions | string = {}
): SaveDocument {
  const result = inspectSaveDocument(document, options);
  if (!result.valid) {
    throw new SaveCorruptionError(
      `Invalid save document${result.errors.length > 0 ? `: ${result.errors[0]?.message ?? "unknown error"}` : "."}`,
      result.errors
    );
  }
  return document as SaveDocument;
}

export const validateSaveDocumentResult = inspectSaveDocument;

export function isSaveDocument(document: unknown, options: SaveValidationOptions | string = {}): document is SaveDocument {
  return inspectSaveDocument(document, options).valid;
}

export function assertValidSaveDocument<TWorldState extends JsonValue, TFlowSession extends JsonValue, TEvent extends JsonValue>(
  document: unknown,
  options: SaveValidationOptions | string = {}
): asserts document is SaveDocument<TWorldState, TFlowSession, TEvent> {
  validateSaveDocument(document, options);
}

export function createStableCheckpoint<
  TWorldState extends JsonValue,
  TFlowSession extends JsonValue,
  TEvent extends JsonValue
>(
  worldState: TWorldState,
  flowSession: TFlowSession | null,
  eventLog: readonly TEvent[]
): StableCheckpoint<TWorldState, TFlowSession, TEvent> {
  return {
    kind: "stable",
    worldState,
    flowSession,
    eventLog: [...eventLog]
  };
}

export function createSaveDocument<
  TWorldState extends JsonValue,
  TFlowSession extends JsonValue,
  TEvent extends JsonValue
>(input: CreateSaveDocumentInput<TWorldState, TFlowSession, TEvent>): SaveDocument<TWorldState, TFlowSession, TEvent> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const updatedAt = input.updatedAt ?? createdAt;
  const normalizedCheckpoint: SaveCheckpoint<TWorldState, TFlowSession, TEvent> = "kind" in input.checkpoint
    ? input.checkpoint
    : {
        kind: "stable" as const,
        worldState: input.checkpoint.state,
        flowSession: null,
        eventLog: [],
        sequence: input.checkpoint.sequence
      };
  const payload: SaveDocumentPayload<TWorldState, TFlowSession, TEvent> = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    slot: input.slot,
    projectFingerprint: input.projectFingerprint,
    locale: input.locale,
    createdAt,
    updatedAt,
    checkpoint: normalizedCheckpoint
  };
  const document: SaveDocument<TWorldState, TFlowSession, TEvent> = {
    ...payload,
    checksum: computeSaveChecksum(payload)
  };
  assertValidSaveDocument<TWorldState, TFlowSession, TEvent>(document);
  return document;
}

export function serializeSaveDocument(document: SaveDocument): string {
  assertValidSaveDocument(document);
  return `${JSON.stringify(JSON.parse(canonicalStringify(document)), null, 2)}\n`;
}

export function deserializeSaveDocument(
  serialized: string,
  options: SaveValidationOptions | string = {}
): SaveDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON.";
    throw new SaveCorruptionError(`Could not parse save document: ${message}`, [
      issue("invalid-json", "$", message)
    ]);
  }

  assertValidSaveDocument(parsed, options);
  return parsed;
}

export const parseSaveDocument = deserializeSaveDocument;
