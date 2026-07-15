import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import type { TSchema } from "@sinclair/typebox";
import { colliderBounds } from "./collider";
import type { ColliderShape } from "./schemas";
import {
  AssetGenerationRecipeDocumentSchema,
  AssetDocumentSchema,
  AnimationPackDocumentSchema,
  FlowDocumentSchema,
  ItemDocumentSchema,
  Layered2DSceneSchema,
  LocaleDocumentSchema,
  PromptPackDocumentSchema,
  ProjectChangeRecordSchema,
  SaveDocumentSchema,
  ProjectManifestSchema,
  SceneDocumentSchema,
  StyleBibleDocumentSchema,
  WorkflowTemplateDocumentSchema
} from "./schemas";

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

const validators = {
  project: ajv.compile(ProjectManifestSchema),
  scene: ajv.compile(SceneDocumentSchema),
  layered2dScene: ajv.compile(Layered2DSceneSchema),
  flow: ajv.compile(FlowDocumentSchema),
  locale: ajv.compile(LocaleDocumentSchema),
  item: ajv.compile(ItemDocumentSchema),
  asset: ajv.compile(AssetDocumentSchema),
  animationPack: ajv.compile(AnimationPackDocumentSchema),
  promptPack: ajv.compile(PromptPackDocumentSchema),
  styleBible: ajv.compile(StyleBibleDocumentSchema),
  workflowTemplate: ajv.compile(WorkflowTemplateDocumentSchema),
  generationRecipe: ajv.compile(AssetGenerationRecipeDocumentSchema),
  projectChange: ajv.compile(ProjectChangeRecordSchema),
  save: ajv.compile(SaveDocumentSchema)
} satisfies Record<string, ValidateFunction>;

export type DocumentKind = keyof typeof validators;

export interface ValidationResult {
  valid: boolean;
  errors: ErrorObject[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** v3 stores shape as the source of truth; hydrate the legacy bounds view at
 * the validation boundary so older editor/runtime consumers remain safe. */
function normalizeHotspotGeometry(value: unknown, mutate: boolean): unknown {
  if (!isRecord(value) || !Array.isArray(value.hotspots)) return value;
  let changed = false;
  const hotspots = value.hotspots.map((hotspot) => {
    if (!isRecord(hotspot) || hotspot.bounds !== undefined || !isRecord(hotspot.shape)) return hotspot;
    try {
      const bounds = colliderBounds(hotspot.shape as ColliderShape);
      changed = true;
      if (mutate) {
        hotspot.bounds = bounds;
        return hotspot;
      }
      return { ...hotspot, bounds };
    } catch {
      return hotspot;
    }
  });
  return changed && !mutate ? { ...value, hotspots } : value;
}

export function validateDocument(kind: DocumentKind, value: unknown): ValidationResult {
  const validator = validators[kind];
  const candidate = kind === "scene" || kind === "layered2dScene"
    ? normalizeHotspotGeometry(value, false)
    : value;
  const valid = validator(candidate);
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
  if (kind === "scene" || kind === "layered2dScene") normalizeHotspotGeometry(value, true);
}

export function exportSchema(schema: TSchema): string {
  return JSON.stringify(schema, null, 2);
}
