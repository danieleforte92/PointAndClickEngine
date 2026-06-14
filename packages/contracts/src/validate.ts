import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import type { TSchema } from "@sinclair/typebox";
import {
  FlowDocumentSchema,
  Layered2DSceneSchema,
  LocaleDocumentSchema,
  ProjectManifestSchema,
  SceneDocumentSchema
} from "./schemas";

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

const validators = {
  project: ajv.compile(ProjectManifestSchema),
  scene: ajv.compile(SceneDocumentSchema),
  layered2dScene: ajv.compile(Layered2DSceneSchema),
  flow: ajv.compile(FlowDocumentSchema),
  locale: ajv.compile(LocaleDocumentSchema)
} satisfies Record<string, ValidateFunction>;

export type DocumentKind = keyof typeof validators;

export interface ValidationResult {
  valid: boolean;
  errors: ErrorObject[];
}

export function validateDocument(kind: DocumentKind, value: unknown): ValidationResult {
  const validator = validators[kind];
  const valid = validator(value);
  return {
    valid,
    errors: valid ? [] : [...(validator.errors ?? [])]
  };
}

export function assertDocument<T>(kind: DocumentKind, value: unknown): asserts value is T {
  const result = validateDocument(kind, value);
  if (!result.valid) {
    const details = result.errors
      .map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
      .join("; ");
    throw new Error(`Invalid ${kind} document: ${details}`);
  }
}

export function exportSchema(schema: TSchema): string {
  return JSON.stringify(schema, null, 2);
}

