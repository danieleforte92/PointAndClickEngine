import { createHash, randomUUID } from "node:crypto";
import { lstatSync, realpathSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assertDocument,
  type AssetGenerationMetadata,
  type AssetGenerationRecipeDocument,
  type AssetDocument,
  type AnimationPackDocument,
  type AssetSource,
  type CursorValue,
  type FlowDocument,
  type FlowNode,
  type Hotspot,
  type HotspotActions,
  type ItemDocument,
  type LocaleDocument,
  type Layered2DScene,
  type Polygon2,
  type PromptPackDocument,
  type ProjectChangeDocument,
  type ProjectChangeRecord,
  type ProjectChangeScope,
  type ProjectChangeSource,
  type ProjectBundle,
  type ProjectManifest,
  type Rect,
  type SceneActor,
  type SceneGenerationGuide,
  type SceneLayer,
  type ScenePlayerConfig,
  type ScenePickup,
  type SceneDocument,
  type StyleBibleDocument,
  type Vector2,
  type WorkflowTemplateDocument
} from "@pointclick/contracts";

export interface LoadedProject {
  directory: string;
  bundle: ProjectBundle;
}

export interface ProjectHistory {
  directory: string;
  records: ProjectChangeRecord[];
}

export interface ApplyProjectCommandOptions {
  recordHistory?: boolean;
  source?: ProjectChangeSource;
  summary?: string;
}

export interface ProjectDiff {
  changedDocuments: ProjectChangeDocument[];
  leftProjectDirectory: string;
  rightProjectDirectory: string;
}

export interface CreateBlankProjectOptions {
  id?: string;
  title?: string;
}

export type ProjectDiagnosticSeverity = "error" | "warning";

export interface ProjectDiagnostic {
  code: string;
  documentId?: string;
  message: string;
  path?: string;
  severity: ProjectDiagnosticSeverity;
}

export interface HotspotPatch {
  actions: HotspotActions;
  bounds: Rect;
  cursor?: CursorValue;
  interactSpot?: Vector2 | null;
  labelKey: string;
  lookSpot?: Vector2 | null;
}

export interface PickupPatch {
  assetId?: string;
  bounds: Rect;
  interactSpot?: Vector2 | null;
  itemId: string;
  labelKey: string;
  lookSpot?: Vector2 | null;
  pickupFlowId?: string;
}

export type ActorPatch = SceneActor;

export interface ScenePatch {
  background: string;
  generationGuides?: SceneGenerationGuide[];
  layers?: SceneLayer[];
  name: string;
  player?: ScenePlayerConfig;
  playerStart: Vector2;
  size: { height: number; width: number };
  walkArea: Polygon2;
}

export interface ItemPatch {
  labelKey: string;
  name: string;
}

export interface ImportedAssetPatch {
  documentPath: string;
  filePath: string;
  generation?: AssetGenerationMetadata;
  id: string;
  kind: "image";
  source: AssetSource;
}

export interface AssetRelinkPatch {
  path: string;
}

export interface LocaleUpsertPatch {
  key: string;
  value: string;
}

export interface FlowPatch {
  name: string;
  nodes: FlowNode[];
  startNodeId: string;
}

export interface ProjectSettingsPatch {
  defaultLocale: string;
  initialSceneId: string;
  title: string;
  viewport: {
    height: number;
    width: number;
  };
}

export interface PromptPackUpsertPatch {
  documentPath?: string;
  promptPack: PromptPackDocument;
}

export interface AnimationPackUpsertPatch {
  animationPack: AnimationPackDocument;
  documentPath?: string;
}

export type FlowReferenceUse =
  | "lookFlowId"
  | "talkFlowId"
  | "useFlowId"
  | "useItemFlow"
  | "pickupFlowId";

export type ItemReferenceUse = "pickupItemId" | "hotspotUseItemFlow";

export type HotspotUpdateCommand = {
  type: "hotspot/update";
  hotspotId: string;
  patch: HotspotPatch;
  sceneId: string;
};

export type HotspotCreateCommand = {
  type: "hotspot/create";
  hotspot: Hotspot;
  sceneId: string;
};

export type HotspotDeleteCommand = {
  type: "hotspot/delete";
  hotspotId: string;
  sceneId: string;
};

export type SceneUpdateCommand = {
  type: "scene/update";
  patch: ScenePatch;
  sceneId: string;
};

export type SceneCreateCommand = {
  type: "scene/create";
  scene: Layered2DScene;
  documentPath?: string;
};

export type SceneDeleteCommand = {
  type: "scene/delete";
  sceneId: string;
};

export type PickupUpdateCommand = {
  type: "pickup/update";
  pickupId: string;
  patch: PickupPatch;
  sceneId: string;
};

export type PickupCreateCommand = {
  type: "pickup/create";
  pickup: ScenePickup;
  sceneId: string;
};

export type PickupDeleteCommand = {
  type: "pickup/delete";
  pickupId: string;
  sceneId: string;
};

export type ActorUpdateCommand = {
  type: "actor/update";
  actorId: string;
  patch: ActorPatch;
  sceneId: string;
};

export type ActorCreateCommand = {
  type: "actor/create";
  actor: SceneActor;
  sceneId: string;
};

export type ActorDeleteCommand = {
  type: "actor/delete";
  actorId: string;
  sceneId: string;
};

export type LocaleUpsertCommand = {
  type: "locale/upsert";
  locale: string;
  patch: LocaleUpsertPatch;
};

export type LocaleDeleteCommand = {
  type: "locale/delete";
  key: string;
  locale: string;
};

export type FlowUpdateCommand = {
  type: "flow/update";
  flowId: string;
  patch: FlowPatch;
};

export type FlowCreateCommand = {
  type: "flow/create";
  flow: FlowDocument;
  documentPath?: string;
};

export type FlowDeleteCommand = {
  type: "flow/delete";
  flowId: string;
};

export type ItemUpdateCommand = {
  type: "item/update";
  itemId: string;
  patch: ItemPatch;
};

export type ItemCreateCommand = {
  type: "item/create";
  item: ItemDocument;
  documentPath?: string;
};

export type ItemDeleteCommand = {
  type: "item/delete";
  itemId: string;
};

export type AssetImportCommand = {
  type: "asset/import";
  assets: ImportedAssetPatch[];
};

export type AssetRelinkCommand = {
  type: "asset/relink";
  assetId: string;
  patch: AssetRelinkPatch;
};

export type AssetDeleteCommand = {
  type: "asset/delete";
  assetId: string;
};

export type PromptPackUpsertCommand = {
  type: "prompt-pack/upsert";
  patch: PromptPackUpsertPatch;
};

export type AnimationPackUpsertCommand = {
  type: "animation-pack/upsert";
  patch: AnimationPackUpsertPatch;
};

export type WorkflowTemplateUpsertCommand = {
  type: "workflow-template/upsert";
  patch: {
    documentPath?: string;
    workflowTemplate: WorkflowTemplateDocument;
  };
};

export type GenerationRecipeUpsertCommand = {
  type: "generation-recipe/upsert";
  patch: {
    documentPath?: string;
    generationRecipe: AssetGenerationRecipeDocument;
  };
};

export type ProjectSettingsUpdateCommand = {
  type: "project/update-settings";
  patch: ProjectSettingsPatch;
};

export type EditorProjectCommand =
  | ProjectSettingsUpdateCommand
  | HotspotUpdateCommand
  | HotspotCreateCommand
  | HotspotDeleteCommand
  | SceneCreateCommand
  | SceneDeleteCommand
  | SceneUpdateCommand
  | PickupUpdateCommand
  | PickupCreateCommand
  | PickupDeleteCommand
  | ActorUpdateCommand
  | ActorCreateCommand
  | ActorDeleteCommand
  | LocaleUpsertCommand
  | LocaleDeleteCommand
  | FlowUpdateCommand
  | FlowCreateCommand
  | FlowDeleteCommand
  | ItemUpdateCommand
  | ItemCreateCommand
  | ItemDeleteCommand
  | AssetImportCommand
  | AssetRelinkCommand
  | AssetDeleteCommand
  | AnimationPackUpsertCommand
  | PromptPackUpsertCommand
  | WorkflowTemplateUpsertCommand
  | GenerationRecipeUpsertCommand;

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

export interface AtomicWriteOperations {
  ensureDirectory(directory: string): Promise<void>;
  removeFile(filePath: string): Promise<void>;
  replaceFile(sourcePath: string, destinationPath: string): Promise<void>;
  writeFile(filePath: string, contents: string): Promise<void>;
}

export interface AtomicWriteOptions {
  operations?: AtomicWriteOperations;
  temporaryPath?: string;
}

const defaultAtomicWriteOperations: AtomicWriteOperations = {
  ensureDirectory: async (directory) => {
    await mkdir(directory, { recursive: true });
  },
  removeFile: async (filePath) => {
    await unlink(filePath);
  },
  replaceFile: async (sourcePath, destinationPath) => {
    await rename(sourcePath, destinationPath);
  },
  writeFile: async (filePath, contents) => {
    await writeFile(filePath, contents, "utf8");
  }
};

export function serializeJsonDocument(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function atomicWriteFile(
  filePath: string,
  contents: string,
  options: AtomicWriteOptions = {}
): Promise<void> {
  const operations = options.operations ?? defaultAtomicWriteOperations;
  const temporaryPath = options.temporaryPath ?? `${filePath}.tmp-${randomUUID()}`;

  await operations.ensureDirectory(path.dirname(filePath));
  try {
    await operations.writeFile(temporaryPath, contents);
    await operations.replaceFile(temporaryPath, filePath);
  } catch (error) {
    await operations.removeFile(temporaryPath).catch(() => undefined);
    throw error;
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await atomicWriteFile(filePath, serializeJsonDocument(value));
}

function slugifyId(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

export function safeProjectPath(projectDirectory: string, relativePath: string, label = "Project path"): string {
  const trimmedPath = relativePath.trim();
  if (!trimmedPath) {
    throw new Error(`${label} cannot be empty`);
  }
  if (path.isAbsolute(trimmedPath)) {
    throw new Error(`${label} "${relativePath}" must be relative to the project`);
  }

  const root = path.resolve(projectDirectory);
  const resolvedPath = path.resolve(root, trimmedPath);
  const projectRelativePath = path.relative(root, resolvedPath);
  if (
    projectRelativePath === ".." ||
    projectRelativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(projectRelativePath)
  ) {
    throw new Error(`${label} "${relativePath}" is outside the project`);
  }
  const canonicalRoot = realpathSync(root);
  let existingPath = resolvedPath;
  while (true) {
    try {
      lstatSync(existingPath);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      if (existingPath === root) {
        throw new Error(`${label} project root "${projectDirectory}" does not exist`);
      }
      existingPath = path.dirname(existingPath);
    }
  }

  let canonicalExistingPath: string;
  try {
    canonicalExistingPath = realpathSync(existingPath);
  } catch (error) {
    throw new Error(
      `${label} "${relativePath}" resolves through an unreadable or dangling symbolic link: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
  }

  const canonicalRelativePath = path.relative(canonicalRoot, canonicalExistingPath);
  if (
    canonicalRelativePath === ".." ||
    canonicalRelativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(canonicalRelativePath)
  ) {
    throw new Error(`${label} "${relativePath}" resolves outside the project through a symbolic link`);
  }

  return resolvedPath;
}

function titleFromDirectory(projectDirectory: string): string {
  const name = path.basename(path.resolve(projectDirectory)).replace(/[-_]+/g, " ").trim();
  return name
    ? name.replace(/\b\w/g, (character) => character.toUpperCase())
    : "Untitled Adventure";
}

async function ensureEmptyDirectory(projectDirectory: string): Promise<string> {
  const directory = path.resolve(projectDirectory);
  await mkdir(directory, { recursive: true });
  const entries = await readdir(directory);
  if (entries.length > 0) {
    throw new Error(`Project directory "${directory}" must be empty before creating a new project.`);
  }
  return directory;
}

async function copyDirectoryContents(sourceDirectory: string, targetDirectory: string): Promise<void> {
  await mkdir(targetDirectory, { recursive: true });
  const entries = await readdir(sourceDirectory, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDirectory, entry.name);
    const targetPath = path.join(targetDirectory, entry.name);
    if (entry.isDirectory()) {
      await copyDirectoryContents(sourcePath, targetPath);
    } else if (entry.isFile()) {
      await mkdir(path.dirname(targetPath), { recursive: true });
      await copyFile(sourcePath, targetPath);
    }
  }
}

function createDiagnostic(
  severity: ProjectDiagnosticSeverity,
  code: string,
  message: string,
  options: { documentId?: string; path?: string } = {}
): ProjectDiagnostic {
  return {
    code,
    message,
    severity,
    ...options
  };
}

function validateReferencedFlow(
  bundle: ProjectBundle,
  diagnostics: ProjectDiagnostic[],
  flowId: string | undefined,
  documentId: string,
  pathValue: string,
  code: string
): void {
  if (!flowId) return;
  if (!bundle.flows[flowId]) {
    diagnostics.push(
      createDiagnostic("error", code, `Flow "${flowId}" does not exist.`, {
        documentId,
        path: pathValue
      })
    );
  }
}

function validateReferencedItem(
  bundle: ProjectBundle,
  diagnostics: ProjectDiagnostic[],
  itemId: string | undefined,
  documentId: string,
  pathValue: string,
  code: string
): void {
  if (!itemId) return;
  if (!bundle.items[itemId]) {
    diagnostics.push(
      createDiagnostic("error", code, `Item "${itemId}" does not exist.`, {
        documentId,
        path: pathValue
      })
    );
  }
}

function validateScenePoint(
  diagnostics: ProjectDiagnostic[],
  scene: Layered2DScene,
  point: Vector2 | undefined,
  pathValue: string,
  code: string
): void {
  if (!point) return;
  if (point.x < 0 || point.y < 0 || point.x > scene.size.width || point.y > scene.size.height) {
    diagnostics.push(
      createDiagnostic(
        "error",
        code,
        `Scene point ${Math.round(point.x)}, ${Math.round(point.y)} is outside scene "${scene.id}".`,
        { documentId: scene.id, path: pathValue }
      )
    );
  }
}

function validateSceneRect(
  diagnostics: ProjectDiagnostic[],
  scene: Layered2DScene,
  rect: Rect | undefined,
  pathValue: string,
  code: string
): void {
  if (!rect) return;
  if (rect.x < 0 || rect.y < 0 || rect.x + rect.width > scene.size.width || rect.y + rect.height > scene.size.height) {
    diagnostics.push(
      createDiagnostic(
        "warning",
        code,
        `Scene rectangle is outside scene "${scene.id}".`,
        { documentId: scene.id, path: pathValue }
      )
    );
  }
}

function guideShapeBounds(guide: SceneGenerationGuide): Rect {
  if (guide.shape.type === "polygon") {
    const xs = guide.shape.points.map((point) => point.x);
    const ys = guide.shape.points.map((point) => point.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY)
    };
  }
  return guide.shape.bounds;
}

function validateGenerationGuide(
  diagnostics: ProjectDiagnostic[],
  scene: Layered2DScene,
  guide: SceneGenerationGuide
): void {
  validateSceneRect(
    diagnostics,
    scene,
    guideShapeBounds(guide),
    `scenes/${scene.id}/generationGuides/${guide.id}/shape`,
    "scene.generation-guide-outside-scene"
  );

  const source = guide.source;
  if (!source) return;

  const idRequired = source.kind === "layer" || source.kind === "actor" || source.kind === "pickup" || source.kind === "hotspot";
  if (idRequired && !source.id) {
    diagnostics.push(
      createDiagnostic(
        "error",
        "scene.generation-guide-source-id-missing",
        `Generation guide "${guide.id}" source "${source.kind}" requires an id.`,
        { documentId: scene.id, path: `scenes/${scene.id}/generationGuides/${guide.id}/source/id` }
      )
    );
    return;
  }

  const exists =
    source.kind === "scene" || source.kind === "background" || source.kind === "player"
      ? true
      : source.kind === "layer"
        ? (scene.layers ?? []).some((layer) => layer.id === source.id)
        : source.kind === "actor"
          ? scene.actors.some((actor) => actor.id === source.id)
          : source.kind === "pickup"
            ? scene.pickups.some((pickup) => pickup.id === source.id)
            : scene.hotspots.some((hotspot) => hotspot.id === source.id);

  if (!exists) {
    diagnostics.push(
      createDiagnostic(
        "error",
        "scene.generation-guide-source-missing",
        `Generation guide "${guide.id}" source "${source.kind}:${source.id ?? ""}" does not exist.`,
        { documentId: scene.id, path: `scenes/${scene.id}/generationGuides/${guide.id}/source` }
      )
    );
  }
}

function validateActions(
  bundle: ProjectBundle,
  diagnostics: ProjectDiagnostic[],
  actions: HotspotActions,
  documentId: string,
  pathValue: string
): void {
  validateReferencedFlow(
    bundle,
    diagnostics,
    actions.lookFlowId,
    documentId,
    `${pathValue}/lookFlowId`,
    "scene.action-look-missing-flow"
  );
  validateReferencedFlow(
    bundle,
    diagnostics,
    actions.talkFlowId,
    documentId,
    `${pathValue}/talkFlowId`,
    "scene.action-talk-missing-flow"
  );
  validateReferencedFlow(
    bundle,
    diagnostics,
    actions.useFlowId,
    documentId,
    `${pathValue}/useFlowId`,
    "scene.action-use-missing-flow"
  );

  for (const mapping of actions.useItemFlows) {
    validateReferencedItem(
      bundle,
      diagnostics,
      mapping.itemId,
      documentId,
      `${pathValue}/useItemFlows/${mapping.itemId}`,
      "scene.action-item-missing"
    );
    validateReferencedFlow(
      bundle,
      diagnostics,
      mapping.flowId,
      documentId,
      `${pathValue}/useItemFlows/${mapping.itemId}/flowId`,
      "scene.action-item-flow-missing"
    );
  }
}

function validateActor(
  bundle: ProjectBundle,
  diagnostics: ProjectDiagnostic[],
  scene: Layered2DScene,
  actor: SceneActor,
  defaultLocale: ProjectBundle["locales"][string] | undefined
): void {
  if (actor.assetId && !bundle.assets[actor.assetId]) {
    diagnostics.push(
      createDiagnostic(
        "error",
        "scene.actor-asset-missing",
        `Actor "${actor.id}" references missing asset "${actor.assetId}".`,
        { documentId: scene.id, path: `scenes/${scene.id}/actors/${actor.id}/assetId` }
      )
    );
  }

  if (actor.animationPackId && !bundle.animationPacks[actor.animationPackId]) {
    diagnostics.push(
      createDiagnostic(
        "error",
        "scene.actor-animation-pack-missing",
        `Actor "${actor.id}" references missing animation pack "${actor.animationPackId}".`,
        { documentId: scene.id, path: `scenes/${scene.id}/actors/${actor.id}/animationPackId` }
      )
    );
  }

  if (defaultLocale && !(actor.labelKey in defaultLocale.strings)) {
    diagnostics.push(
      createDiagnostic(
        "warning",
        "locale.missing-actor-label",
        `Missing localized string "${actor.labelKey}" in default locale.`,
        { documentId: scene.id, path: `scenes/${scene.id}/actors/${actor.id}/labelKey` }
      )
    );
  }

  if (actor.visibleWhen?.type === "item-in-inventory") {
    validateReferencedItem(
      bundle,
      diagnostics,
      actor.visibleWhen.itemId,
      scene.id,
      `scenes/${scene.id}/actors/${actor.id}/visibleWhen/itemId`,
      "scene.actor-visible-item-missing"
    );
  }

  validateScenePoint(
    diagnostics,
    scene,
    actor.interactSpot,
    `scenes/${scene.id}/actors/${actor.id}/interactSpot`,
    "scene.actor-interact-spot-outside-scene"
  );
  validateScenePoint(
    diagnostics,
    scene,
    actor.lookSpot,
    `scenes/${scene.id}/actors/${actor.id}/lookSpot`,
    "scene.actor-look-spot-outside-scene"
  );
  validateActions(bundle, diagnostics, actor.actions, scene.id, `scenes/${scene.id}/actors/${actor.id}/actions`);
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function sceneGenerationGuideIds(bundle: ProjectBundle, sceneId: string | undefined): Set<string> {
  if (!sceneId) return new Set();
  const scene = bundle.scenes[sceneId];
  return scene?.type === "layered-2d"
    ? new Set((scene.generationGuides ?? []).map((guide) => guide.id))
    : new Set();
}

export function validateProjectBundle(bundle: ProjectBundle): ProjectDiagnostic[] {
  const diagnostics: ProjectDiagnostic[] = [];
  const defaultLocale = bundle.locales[bundle.manifest.defaultLocale];

  if (!bundle.scenes[bundle.manifest.initialSceneId]) {
    diagnostics.push(
      createDiagnostic(
        "error",
        "manifest.initial-scene-missing",
        `Initial scene "${bundle.manifest.initialSceneId}" does not exist.`,
        { path: "manifest.initialSceneId" }
      )
    );
  }

  if (!defaultLocale) {
    diagnostics.push(
      createDiagnostic(
        "error",
        "manifest.default-locale-missing",
        `Default locale "${bundle.manifest.defaultLocale}" does not exist.`,
        { path: "manifest.defaultLocale" }
      )
    );
  }

  for (const flow of Object.values(bundle.flows)) {
    try {
      validateFlowReferences(flow);
    } catch (error) {
      diagnostics.push(
        createDiagnostic(
          "error",
          "flow.invalid-references",
          error instanceof Error ? error.message : `Flow "${flow.id}" is invalid.`,
          { documentId: flow.id, path: `flows/${flow.id}` }
        )
      );
    }

    for (const node of flow.nodes) {
      if (node.type === "change-scene" && !bundle.scenes[node.targetSceneId]) {
        diagnostics.push(
          createDiagnostic(
            "error",
            "flow.change-scene-missing-scene",
            `Flow "${flow.id}" changes to missing scene "${node.targetSceneId}".`,
            { documentId: flow.id, path: `flows/${flow.id}/nodes/${node.id}/targetSceneId` }
          )
        );
      }
      if (node.type === "sub-flow" && !bundle.flows[node.flowId]) {
        diagnostics.push(
          createDiagnostic(
            "error",
            "flow.sub-flow-missing-flow",
            `Flow "${flow.id}" enters missing sub-flow "${node.flowId}".`,
            { documentId: flow.id, path: `flows/${flow.id}/nodes/${node.id}/flowId` }
          )
        );
      }
      if (node.type !== "line" || !defaultLocale) continue;
      if (!(node.textKey in defaultLocale.strings)) {
        diagnostics.push(
          createDiagnostic(
            "warning",
            "locale.missing-flow-text",
            `Missing localized string "${node.textKey}" in default locale.`,
            { documentId: flow.id, path: `flows/${flow.id}/nodes/${node.id}/textKey` }
          )
        );
      }
    }
    for (const trigger of flow.sceneEntryTriggers ?? []) {
      if (!bundle.scenes[trigger.sceneId]) {
        diagnostics.push(
          createDiagnostic(
            "error",
            "flow.scene-entry-missing-scene",
            `Flow "${flow.id}" has a scene-entry trigger for missing scene "${trigger.sceneId}".`,
            { documentId: flow.id, path: `flows/${flow.id}/sceneEntryTriggers/${trigger.sceneId}` }
          )
        );
      }
      if (!bundle.flows[trigger.flowId]) {
        diagnostics.push(
          createDiagnostic(
            "error",
            "flow.scene-entry-missing-flow",
            `Scene-entry trigger references missing flow "${trigger.flowId}".`,
            { documentId: flow.id, path: `flows/${flow.id}/sceneEntryTriggers/${trigger.sceneId}` }
          )
        );
      }
    }
  }

  for (const item of Object.values(bundle.items)) {
    if (defaultLocale && !(item.labelKey in defaultLocale.strings)) {
      diagnostics.push(
        createDiagnostic(
          "warning",
          "locale.missing-item-label",
          `Missing localized string "${item.labelKey}" in default locale.`,
          { documentId: item.id, path: `items/${item.id}/labelKey` }
        )
      );
    }
  }

  const assetsByPath = new Map<string, AssetDocument>();
  for (const asset of Object.values(bundle.assets)) {
    assetsByPath.set(asset.path, asset);

    if (asset.generation?.workflowId && !bundle.workflowTemplates[asset.generation.workflowId]) {
      diagnostics.push(
        createDiagnostic(
          "error",
          "asset.generation-workflow-missing",
          `Asset "${asset.id}" references missing workflow "${asset.generation.workflowId}".`,
          { documentId: asset.id, path: `assets/${asset.id}/generation/workflowId` }
        )
      );
    }

    if (asset.generation?.recipeId && !bundle.generationRecipes[asset.generation.recipeId]) {
      diagnostics.push(
        createDiagnostic(
          "error",
          "asset.generation-recipe-missing",
          `Asset "${asset.id}" references missing generation recipe "${asset.generation.recipeId}".`,
          { documentId: asset.id, path: `assets/${asset.id}/generation/recipeId` }
        )
      );
    }

    if (asset.generation?.promptPackId && !bundle.promptPacks[asset.generation.promptPackId]) {
      diagnostics.push(
        createDiagnostic(
          "error",
          "asset.generation-prompt-pack-missing",
          `Asset "${asset.id}" references missing prompt pack "${asset.generation.promptPackId}".`,
          { documentId: asset.id, path: `assets/${asset.id}/generation/promptPackId` }
        )
      );
    }

    const promptPack = asset.generation?.promptPackId
      ? bundle.promptPacks[asset.generation.promptPackId]
      : undefined;
    if (
      promptPack &&
      asset.generation?.targetId &&
      !promptPack.outputs.generationTargets.some((target) => target.id === asset.generation?.targetId)
    ) {
      diagnostics.push(
        createDiagnostic(
          "error",
          "asset.generation-target-missing",
          `Asset "${asset.id}" references missing prompt target "${asset.generation.targetId}".`,
          { documentId: asset.id, path: `assets/${asset.id}/generation/targetId` }
        )
      );
    }

    for (const parentAssetId of asset.generation?.parentAssetIds ?? []) {
      if (!bundle.assets[parentAssetId]) {
        diagnostics.push(
          createDiagnostic(
            "error",
            "asset.generation-parent-asset-missing",
            `Asset "${asset.id}" references missing parent asset "${parentAssetId}".`,
            { documentId: asset.id, path: `assets/${asset.id}/generation/parentAssetIds/${parentAssetId}` }
          )
        );
      }
    }

    for (const referenceAssetId of asset.generation?.referenceAssetIds ?? []) {
      if (!bundle.assets[referenceAssetId]) {
        diagnostics.push(
          createDiagnostic(
            "error",
            "asset.generation-reference-asset-missing",
            `Asset "${asset.id}" references missing reference asset "${referenceAssetId}".`,
            { documentId: asset.id, path: `assets/${asset.id}/generation/referenceAssetIds/${referenceAssetId}` }
          )
        );
      }
    }

    if (asset.generation?.maskAssetId && !bundle.assets[asset.generation.maskAssetId]) {
      diagnostics.push(
        createDiagnostic(
          "error",
          "asset.generation-mask-asset-missing",
          `Asset "${asset.id}" references missing mask asset "${asset.generation.maskAssetId}".`,
          { documentId: asset.id, path: `assets/${asset.id}/generation/maskAssetId` }
        )
      );
    }

    const recipe = asset.generation?.recipeId ? bundle.generationRecipes[asset.generation.recipeId] : undefined;
    const generationGuideIds = sceneGenerationGuideIds(bundle, recipe?.sceneId ?? promptPack?.sceneId);
    for (const guideId of asset.generation?.guideIds ?? []) {
      if (!generationGuideIds.has(guideId)) {
        diagnostics.push(
          createDiagnostic(
            "error",
            "asset.generation-guide-missing",
            `Asset "${asset.id}" references missing generation guide "${guideId}".`,
            { documentId: asset.id, path: `assets/${asset.id}/generation/guideIds/${guideId}` }
          )
        );
      }
    }
  }

  for (const scene of Object.values(bundle.scenes)) {
    if (scene.type !== "layered-2d") continue;

    if (!isHexColor(scene.background) && !assetsByPath.has(scene.background)) {
      diagnostics.push(
        createDiagnostic(
          "error",
          "scene.background-asset-missing",
          `Scene "${scene.id}" background asset "${scene.background}" is not registered.`,
          { documentId: scene.id, path: `scenes/${scene.id}/background` }
        )
      );
    }

    if (scene.player?.assetId && !bundle.assets[scene.player.assetId]) {
      diagnostics.push(
        createDiagnostic(
          "error",
          "scene.player-asset-missing",
          `Scene "${scene.id}" player references missing asset "${scene.player.assetId}".`,
          { documentId: scene.id, path: `scenes/${scene.id}/player/assetId` }
        )
      );
    }

    if (scene.player?.animationPackId && !bundle.animationPacks[scene.player.animationPackId]) {
      diagnostics.push(
        createDiagnostic(
          "error",
          "scene.player-animation-pack-missing",
          `Scene "${scene.id}" player references missing animation pack "${scene.player.animationPackId}".`,
          { documentId: scene.id, path: `scenes/${scene.id}/player/animationPackId` }
        )
      );
    }

    for (const layer of scene.layers ?? []) {
      if (!bundle.assets[layer.assetId]) {
        diagnostics.push(
          createDiagnostic(
            "error",
            "scene.layer-asset-missing",
            `Scene "${scene.id}" layer "${layer.id}" references missing asset "${layer.assetId}".`,
            { documentId: scene.id, path: `scenes/${scene.id}/layers/${layer.id}/assetId` }
          )
        );
      }
      validateSceneRect(
        diagnostics,
        scene,
        layer.bounds,
        `scenes/${scene.id}/layers/${layer.id}/bounds`,
        "scene.layer-bounds-outside-scene"
      );
    }

    for (const hotspot of scene.hotspots) {
      if (defaultLocale && !(hotspot.labelKey in defaultLocale.strings)) {
        diagnostics.push(
          createDiagnostic(
            "warning",
            "locale.missing-hotspot-label",
            `Missing localized string "${hotspot.labelKey}" in default locale.`,
            { documentId: scene.id, path: `scenes/${scene.id}/hotspots/${hotspot.id}/labelKey` }
          )
        );
      }

      validateReferencedFlow(
        bundle,
        diagnostics,
        hotspot.actions.lookFlowId,
        scene.id,
        `scenes/${scene.id}/hotspots/${hotspot.id}/actions/lookFlowId`,
        "scene.hotspot-look-missing-flow"
      );

      validateScenePoint(
        diagnostics,
        scene,
        hotspot.interactSpot,
        `scenes/${scene.id}/hotspots/${hotspot.id}/interactSpot`,
        "scene.hotspot-interact-spot-outside-scene"
      );
      validateScenePoint(
        diagnostics,
        scene,
        hotspot.lookSpot,
        `scenes/${scene.id}/hotspots/${hotspot.id}/lookSpot`,
        "scene.hotspot-look-spot-outside-scene"
      );
      validateReferencedFlow(
        bundle,
        diagnostics,
        hotspot.actions.talkFlowId,
        scene.id,
        `scenes/${scene.id}/hotspots/${hotspot.id}/actions/talkFlowId`,
        "scene.hotspot-talk-missing-flow"
      );
      validateReferencedFlow(
        bundle,
        diagnostics,
        hotspot.actions.useFlowId,
        scene.id,
        `scenes/${scene.id}/hotspots/${hotspot.id}/actions/useFlowId`,
        "scene.hotspot-use-missing-flow"
      );

      for (const mapping of hotspot.actions.useItemFlows) {
        if (!bundle.items[mapping.itemId]) {
          diagnostics.push(
            createDiagnostic(
              "error",
              "scene.hotspot-item-missing",
              `Hotspot "${hotspot.id}" references missing item "${mapping.itemId}".`,
              {
                documentId: scene.id,
                path: `scenes/${scene.id}/hotspots/${hotspot.id}/actions/useItemFlows/${mapping.itemId}`
              }
            )
          );
        }
        validateReferencedFlow(
          bundle,
          diagnostics,
          mapping.flowId,
          scene.id,
          `scenes/${scene.id}/hotspots/${hotspot.id}/actions/useItemFlows/${mapping.itemId}/flowId`,
          "scene.hotspot-item-flow-missing"
        );
      }
    }

    for (const pickup of scene.pickups) {
      if (pickup.assetId && !bundle.assets[pickup.assetId]) {
        diagnostics.push(
          createDiagnostic(
            "error",
            "scene.pickup-asset-missing",
            `Pickup "${pickup.id}" references missing asset "${pickup.assetId}".`,
            { documentId: scene.id, path: `scenes/${scene.id}/pickups/${pickup.id}/assetId` }
          )
        );
      }

      if (!bundle.items[pickup.itemId]) {
        diagnostics.push(
          createDiagnostic(
            "error",
            "scene.pickup-item-missing",
            `Pickup "${pickup.id}" references missing item "${pickup.itemId}".`,
            { documentId: scene.id, path: `scenes/${scene.id}/pickups/${pickup.id}/itemId` }
          )
        );
      }

      validateReferencedFlow(
        bundle,
        diagnostics,
        pickup.pickupFlowId,
        scene.id,
        `scenes/${scene.id}/pickups/${pickup.id}/pickupFlowId`,
        "scene.pickup-flow-missing"
      );

      if (defaultLocale && !(pickup.labelKey in defaultLocale.strings)) {
        diagnostics.push(
          createDiagnostic(
            "warning",
            "locale.missing-pickup-label",
            `Missing localized string "${pickup.labelKey}" in default locale.`,
            { documentId: scene.id, path: `scenes/${scene.id}/pickups/${pickup.id}/labelKey` }
          )
        );
      }

      validateScenePoint(
        diagnostics,
        scene,
        pickup.interactSpot,
        `scenes/${scene.id}/pickups/${pickup.id}/interactSpot`,
        "scene.pickup-interact-spot-outside-scene"
      );
      validateScenePoint(
        diagnostics,
        scene,
        pickup.lookSpot,
        `scenes/${scene.id}/pickups/${pickup.id}/lookSpot`,
        "scene.pickup-look-spot-outside-scene"
      );
    }

    const actorIds = new Set<string>();
    for (const actor of scene.actors) {
      if (actorIds.has(actor.id)) {
        diagnostics.push(
          createDiagnostic(
            "error",
            "scene.actor-duplicate-id",
            `Scene "${scene.id}" contains duplicate actor "${actor.id}".`,
            { documentId: scene.id, path: `scenes/${scene.id}/actors/${actor.id}` }
          )
        );
      }
      actorIds.add(actor.id);
      validateActor(bundle, diagnostics, scene, actor, defaultLocale);
    }

    const generationGuideIds = new Set<string>();
    for (const guide of scene.generationGuides ?? []) {
      if (generationGuideIds.has(guide.id)) {
        diagnostics.push(
          createDiagnostic(
            "error",
            "scene.generation-guide-duplicate-id",
            `Scene "${scene.id}" contains duplicate generation guide "${guide.id}".`,
            { documentId: scene.id, path: `scenes/${scene.id}/generationGuides/${guide.id}` }
          )
        );
      }
      generationGuideIds.add(guide.id);
      validateGenerationGuide(diagnostics, scene, guide);
    }
  }

  for (const promptPack of Object.values(bundle.promptPacks)) {
    if (!bundle.scenes[promptPack.sceneId]) {
      diagnostics.push(
        createDiagnostic(
          "error",
          "prompt-pack.scene-missing",
          `Prompt pack "${promptPack.id}" references missing scene "${promptPack.sceneId}".`,
          { documentId: promptPack.id, path: `prompt-packs/${promptPack.id}/sceneId` }
        )
      );
    }

    const promptPackScene = bundle.scenes[promptPack.sceneId];
    const promptPackGuideIds =
      promptPackScene?.type === "layered-2d"
        ? new Set((promptPackScene.generationGuides ?? []).map((guide) => guide.id))
        : new Set<string>();

    for (const target of promptPack.outputs.generationTargets) {
      if (target.referenceAssetId && !bundle.assets[target.referenceAssetId]) {
        diagnostics.push(
          createDiagnostic(
            "error",
            "prompt-pack.reference-asset-missing",
            `Prompt pack "${promptPack.id}" target "${target.id}" references missing asset "${target.referenceAssetId}".`,
            { documentId: promptPack.id, path: `prompt-packs/${promptPack.id}/generationTargets/${target.id}/referenceAssetId` }
          )
        );
      }
      if (target.maskAssetId && !bundle.assets[target.maskAssetId]) {
        diagnostics.push(
          createDiagnostic(
            "error",
            "prompt-pack.mask-asset-missing",
            `Prompt pack "${promptPack.id}" target "${target.id}" references missing asset "${target.maskAssetId}".`,
            { documentId: promptPack.id, path: `prompt-packs/${promptPack.id}/generationTargets/${target.id}/maskAssetId` }
          )
        );
      }
      for (const guideId of target.guideIds ?? []) {
        if (!promptPackGuideIds.has(guideId)) {
          diagnostics.push(
            createDiagnostic(
              "error",
              "prompt-pack.generation-guide-missing",
              `Prompt pack "${promptPack.id}" target "${target.id}" references missing generation guide "${guideId}".`,
              { documentId: promptPack.id, path: `prompt-packs/${promptPack.id}/generationTargets/${target.id}/guideIds/${guideId}` }
            )
          );
        }
      }
    }
  }

  for (const styleBible of Object.values(bundle.styleBibles)) {
    for (const referenceAssetId of styleBible.referenceAssetIds ?? []) {
      if (!bundle.assets[referenceAssetId]) {
        diagnostics.push(
          createDiagnostic(
            "error",
            "style-bible.reference-asset-missing",
            `Style bible "${styleBible.id}" references missing asset "${referenceAssetId}".`,
            { documentId: styleBible.id, path: `style-bibles/${styleBible.id}/referenceAssetIds/${referenceAssetId}` }
          )
        );
      }
    }
  }

  for (const workflow of Object.values(bundle.workflowTemplates)) {
    const supportedInputs = new Set(workflow.supportedInputs);
    for (const binding of workflow.bindings) {
      if (!supportedInputs.has(binding.input)) {
        diagnostics.push(
          createDiagnostic(
            "error",
            "workflow-template.binding-input-unsupported",
            `Workflow template "${workflow.id}" binding "${binding.input}" is not declared in supportedInputs.`,
            { documentId: workflow.id, path: `workflow-templates/${workflow.id}/bindings/${binding.input}` }
          )
        );
      }
    }
  }

  for (const recipe of Object.values(bundle.generationRecipes)) {
    const workflow = bundle.workflowTemplates[recipe.workflowId];
    if (!workflow) {
      diagnostics.push(
        createDiagnostic(
          "error",
          "generation-recipe.workflow-missing",
          `Generation recipe "${recipe.id}" references missing workflow "${recipe.workflowId}".`,
          { documentId: recipe.id, path: `generation-recipes/${recipe.id}/workflowId` }
        )
      );
    } else if (workflow.family !== recipe.workflowFamily) {
      diagnostics.push(
        createDiagnostic(
          "error",
          "generation-recipe.workflow-family-mismatch",
          `Generation recipe "${recipe.id}" expects workflow family "${recipe.workflowFamily}", but workflow "${workflow.id}" uses "${workflow.family}".`,
          { documentId: recipe.id, path: `generation-recipes/${recipe.id}/workflowFamily` }
        )
      );
    }

    if (recipe.sceneId && !bundle.scenes[recipe.sceneId]) {
      diagnostics.push(
        createDiagnostic(
          "error",
          "generation-recipe.scene-missing",
          `Generation recipe "${recipe.id}" references missing scene "${recipe.sceneId}".`,
          { documentId: recipe.id, path: `generation-recipes/${recipe.id}/sceneId` }
        )
      );
    }

    const promptPack = recipe.promptPackId ? bundle.promptPacks[recipe.promptPackId] : undefined;
    if (recipe.promptPackId && !promptPack) {
      diagnostics.push(
        createDiagnostic(
          "error",
          "generation-recipe.prompt-pack-missing",
          `Generation recipe "${recipe.id}" references missing prompt pack "${recipe.promptPackId}".`,
          { documentId: recipe.id, path: `generation-recipes/${recipe.id}/promptPackId` }
        )
      );
    }

    if (
      promptPack &&
      recipe.targetId &&
      !promptPack.outputs.generationTargets.some((target) => target.id === recipe.targetId)
    ) {
      diagnostics.push(
        createDiagnostic(
          "error",
          "generation-recipe.target-missing",
          `Generation recipe "${recipe.id}" references missing prompt target "${recipe.targetId}".`,
          { documentId: recipe.id, path: `generation-recipes/${recipe.id}/targetId` }
        )
      );
    }

    if (recipe.styleBibleId && !bundle.styleBibles[recipe.styleBibleId]) {
      diagnostics.push(
        createDiagnostic(
          "error",
          "generation-recipe.style-bible-missing",
          `Generation recipe "${recipe.id}" references missing style bible "${recipe.styleBibleId}".`,
          { documentId: recipe.id, path: `generation-recipes/${recipe.id}/styleBibleId` }
        )
      );
    }

    for (const referenceAssetId of recipe.inputs?.referenceAssetIds ?? []) {
      if (!bundle.assets[referenceAssetId]) {
        diagnostics.push(
          createDiagnostic(
            "error",
            "generation-recipe.reference-asset-missing",
            `Generation recipe "${recipe.id}" references missing asset "${referenceAssetId}".`,
            { documentId: recipe.id, path: `generation-recipes/${recipe.id}/inputs/referenceAssetIds/${referenceAssetId}` }
          )
        );
      }
    }

    if (recipe.inputs?.maskAssetId && !bundle.assets[recipe.inputs.maskAssetId]) {
      diagnostics.push(
        createDiagnostic(
          "error",
          "generation-recipe.mask-asset-missing",
          `Generation recipe "${recipe.id}" references missing mask asset "${recipe.inputs.maskAssetId}".`,
          { documentId: recipe.id, path: `generation-recipes/${recipe.id}/inputs/maskAssetId` }
        )
      );
    }

    for (const parentAssetId of recipe.inputs?.parentAssetIds ?? []) {
      if (!bundle.assets[parentAssetId]) {
        diagnostics.push(
          createDiagnostic(
            "error",
            "generation-recipe.parent-asset-missing",
            `Generation recipe "${recipe.id}" references missing parent asset "${parentAssetId}".`,
            { documentId: recipe.id, path: `generation-recipes/${recipe.id}/inputs/parentAssetIds/${parentAssetId}` }
          )
        );
      }
    }

    const guideIds = sceneGenerationGuideIds(bundle, recipe.sceneId ?? promptPack?.sceneId);
    for (const guideId of recipe.inputs?.guideIds ?? []) {
      if (!guideIds.has(guideId)) {
        diagnostics.push(
          createDiagnostic(
            "error",
            "generation-recipe.generation-guide-missing",
            `Generation recipe "${recipe.id}" references missing generation guide "${guideId}".`,
            { documentId: recipe.id, path: `generation-recipes/${recipe.id}/inputs/guideIds/${guideId}` }
          )
        );
      }
    }
  }

  for (const animationPack of Object.values(bundle.animationPacks)) {
    if (!bundle.assets[animationPack.assetId]) {
      diagnostics.push(
        createDiagnostic(
          "error",
          "animation-pack.asset-missing",
          `Animation pack "${animationPack.id}" references missing asset "${animationPack.assetId}".`,
          { documentId: animationPack.id, path: `animation-packs/${animationPack.id}/assetId` }
        )
      );
    }

    const frameCount = animationPack.grid.columns * animationPack.grid.rows;
    const clipIds = new Set<string>();
    for (const clip of animationPack.clips) {
      if (clipIds.has(clip.id)) {
        diagnostics.push(
          createDiagnostic(
            "error",
            "animation-pack.clip-duplicate-id",
            `Animation pack "${animationPack.id}" contains duplicate clip "${clip.id}".`,
            { documentId: animationPack.id, path: `animation-packs/${animationPack.id}/clips/${clip.id}` }
          )
        );
      }
      clipIds.add(clip.id);

      for (const frame of clip.frames) {
        if (frame >= frameCount) {
          diagnostics.push(
            createDiagnostic(
              "error",
              "animation-pack.clip-frame-out-of-range",
              `Animation pack "${animationPack.id}" clip "${clip.id}" references frame ${frame}, but the grid has ${frameCount} frame(s).`,
              { documentId: animationPack.id, path: `animation-packs/${animationPack.id}/clips/${clip.id}/frames` }
            )
          );
        }
      }
    }
  }

  return diagnostics;
}

export async function loadProjectFromDirectory(projectDirectory: string): Promise<LoadedProject> {
  const directory = path.resolve(projectDirectory);
  const manifestPath = path.join(directory, "adventure.project.json");
  const manifestValue = await readJson(manifestPath);
  assertDocument<ProjectManifest>("project", manifestValue);

  const scenes: Record<string, SceneDocument> = {};
  for (const reference of manifestValue.scenes) {
    const value = await readJson(safeProjectPath(directory, reference.path, `Scene reference "${reference.id}"`));
    assertDocument<SceneDocument>("scene", value);
    if (value.id !== reference.id) {
      throw new Error(`Scene reference "${reference.id}" points to document "${value.id}"`);
    }
    scenes[value.id] = value;
  }

  const flows: Record<string, FlowDocument> = {};
  for (const reference of manifestValue.flows) {
    const value = await readJson(safeProjectPath(directory, reference.path, `Flow reference "${reference.id}"`));
    assertDocument<FlowDocument>("flow", value);
    if (value.id !== reference.id) {
      throw new Error(`Flow reference "${reference.id}" points to document "${value.id}"`);
    }
    flows[value.id] = value;
  }

  const locales: Record<string, LocaleDocument> = {};
  for (const reference of manifestValue.locales) {
    const value = await readJson(safeProjectPath(directory, reference.path, `Locale reference "${reference.locale}"`));
    assertDocument<LocaleDocument>("locale", value);
    if (value.locale !== reference.locale) {
      throw new Error(`Locale reference "${reference.locale}" points to document "${value.locale}"`);
    }
    locales[value.locale] = value;
  }

  const items: Record<string, ItemDocument> = {};
  for (const reference of manifestValue.items) {
    const value = await readJson(safeProjectPath(directory, reference.path, `Item reference "${reference.id}"`));
    assertDocument<ItemDocument>("item", value);
    if (value.id !== reference.id) {
      throw new Error(`Item reference "${reference.id}" points to document "${value.id}"`);
    }
    items[value.id] = value;
  }

  const assets: Record<string, AssetDocument> = {};
  for (const reference of manifestValue.assets ?? []) {
    const value = await readJson(safeProjectPath(directory, reference.path, `Asset reference "${reference.id}"`));
    assertDocument<AssetDocument>("asset", value);
    if (value.id !== reference.id) {
      throw new Error(`Asset reference "${reference.id}" points to document "${value.id}"`);
    }
    assets[value.id] = value;
  }

  const animationPacks: Record<string, AnimationPackDocument> = {};
  for (const reference of manifestValue.animationPacks ?? []) {
    const value = await readJson(
      safeProjectPath(directory, reference.path, `Animation pack reference "${reference.id}"`)
    );
    assertDocument<AnimationPackDocument>("animationPack", value);
    if (value.id !== reference.id) {
      throw new Error(`Animation pack reference "${reference.id}" points to document "${value.id}"`);
    }
    animationPacks[value.id] = value;
  }

  const promptPacks: Record<string, PromptPackDocument> = {};
  for (const reference of manifestValue.promptPacks ?? []) {
    const value = await readJson(safeProjectPath(directory, reference.path, `Prompt pack reference "${reference.id}"`));
    assertDocument<PromptPackDocument>("promptPack", value);
    if (value.id !== reference.id) {
      throw new Error(`Prompt pack reference "${reference.id}" points to document "${value.id}"`);
    }
    promptPacks[value.id] = value;
  }

  const styleBibles: Record<string, StyleBibleDocument> = {};
  for (const reference of manifestValue.styleBibles ?? []) {
    const value = await readJson(safeProjectPath(directory, reference.path, `Style bible reference "${reference.id}"`));
    assertDocument<StyleBibleDocument>("styleBible", value);
    if (value.id !== reference.id) {
      throw new Error(`Style bible reference "${reference.id}" points to document "${value.id}"`);
    }
    styleBibles[value.id] = value;
  }

  const workflowTemplates: Record<string, WorkflowTemplateDocument> = {};
  for (const reference of manifestValue.workflowTemplates ?? []) {
    const value = await readJson(
      safeProjectPath(directory, reference.path, `Workflow template reference "${reference.id}"`)
    );
    assertDocument<WorkflowTemplateDocument>("workflowTemplate", value);
    if (value.id !== reference.id) {
      throw new Error(`Workflow template reference "${reference.id}" points to document "${value.id}"`);
    }
    workflowTemplates[value.id] = value;
  }

  const generationRecipes: Record<string, AssetGenerationRecipeDocument> = {};
  for (const reference of manifestValue.generationRecipes ?? []) {
    const value = await readJson(
      safeProjectPath(directory, reference.path, `Generation recipe reference "${reference.id}"`)
    );
    assertDocument<AssetGenerationRecipeDocument>("generationRecipe", value);
    if (value.id !== reference.id) {
      throw new Error(`Generation recipe reference "${reference.id}" points to document "${value.id}"`);
    }
    generationRecipes[value.id] = value;
  }

  return {
    directory,
    bundle: {
      manifest: manifestValue,
      scenes,
      flows,
      locales,
      items,
      assets,
      animationPacks,
      promptPacks,
      styleBibles,
      workflowTemplates,
      generationRecipes
    }
  };
}

export async function createBlankProject(
  projectDirectory: string,
  options: CreateBlankProjectOptions = {}
): Promise<LoadedProject> {
  const directory = await ensureEmptyDirectory(projectDirectory);
  const title = options.title?.trim() || titleFromDirectory(directory);
  const projectId = slugifyId(options.id ?? title, "untitled-adventure");
  const sceneId = "start";

  const manifest: ProjectManifest = {
    schemaVersion: 1,
    id: projectId,
    title,
    initialSceneId: sceneId,
    defaultLocale: "en",
    viewport: {
      width: 1280,
      height: 720
    },
    scenes: [
      {
        id: sceneId,
        path: "scenes/start.scene.json"
      }
    ],
    flows: [],
    items: [],
    assets: [],
    promptPacks: [],
    animationPacks: [],
    styleBibles: [],
    workflowTemplates: [],
    generationRecipes: [],
    locales: [
      {
        locale: "en",
        path: "locales/en.json"
      }
    ]
  };

  const scene: Layered2DScene = {
    schemaVersion: 1,
    id: sceneId,
    name: "Start",
    type: "layered-2d",
    size: {
      width: 1280,
      height: 720
    },
    background: "#24384a",
    playerStart: {
      x: 640,
      y: 576
    },
    walkArea: {
      points: [
        { x: 0, y: 0 },
        { x: 1280, y: 0 },
        { x: 1280, y: 720 },
        { x: 0, y: 720 }
      ]
    },
    actors: [],
    pickups: [],
    shapes: [],
    hotspots: []
  };

  const locale: LocaleDocument = {
    schemaVersion: 1,
    locale: "en",
    strings: {}
  };

  await writeJson(path.join(directory, "adventure.project.json"), manifest);
  await writeJson(path.join(directory, "scenes/start.scene.json"), scene);
  await writeJson(path.join(directory, "locales/en.json"), locale);
  await mkdir(path.join(directory, "assets", "imported"), { recursive: true });
  await mkdir(path.join(directory, "animation-packs"), { recursive: true });
  await mkdir(path.join(directory, "flows"), { recursive: true });
  await mkdir(path.join(directory, "items"), { recursive: true });
  await mkdir(path.join(directory, "prompt-packs"), { recursive: true });
  await mkdir(path.join(directory, "workflow-templates"), { recursive: true });
  await mkdir(path.join(directory, "generation-recipes"), { recursive: true });
  await mkdir(path.join(directory, "workflows"), { recursive: true });

  const loaded = await loadProjectFromDirectory(directory);
  await initializeProjectHistory(loaded.directory, "migration");
  return loaded;
}

export async function createProjectFromTemplate(
  templateDirectory: string,
  projectDirectory: string
): Promise<LoadedProject> {
  const sourceDirectory = path.resolve(templateDirectory);
  const directory = await ensureEmptyDirectory(projectDirectory);

  await loadProjectFromDirectory(sourceDirectory);
  await copyDirectoryContents(sourceDirectory, directory);

  const loaded = await loadProjectFromDirectory(directory);
  await initializeProjectHistory(loaded.directory, "migration");
  return loaded;
}

function scenePathFor(project: LoadedProject, sceneId: string): string {
  const reference = project.bundle.manifest.scenes.find((scene) => scene.id === sceneId);
  if (!reference) {
    throw new Error(`Scene "${sceneId}" is not referenced by the project manifest`);
  }
  return safeProjectPath(project.directory, reference.path, `Scene reference "${sceneId}"`);
}

function localePathFor(project: LoadedProject, locale: string): string {
  const reference = project.bundle.manifest.locales.find((entry) => entry.locale === locale);
  if (!reference) {
    throw new Error(`Locale "${locale}" is not referenced by the project manifest`);
  }
  return safeProjectPath(project.directory, reference.path, `Locale reference "${locale}"`);
}

function flowPathFor(project: LoadedProject, flowId: string): string {
  const reference = project.bundle.manifest.flows.find((entry) => entry.id === flowId);
  if (!reference) {
    throw new Error(`Flow "${flowId}" is not referenced by the project manifest`);
  }
  return safeProjectPath(project.directory, reference.path, `Flow reference "${flowId}"`);
}

function itemPathFor(project: LoadedProject, itemId: string): string {
  const reference = project.bundle.manifest.items.find((entry) => entry.id === itemId);
  if (!reference) {
    throw new Error(`Item "${itemId}" is not referenced by the project manifest`);
  }
  return safeProjectPath(project.directory, reference.path, `Item reference "${itemId}"`);
}

function assetPathFor(project: LoadedProject, assetId: string): string {
  const reference = (project.bundle.manifest.assets ?? []).find((entry) => entry.id === assetId);
  if (!reference) {
    throw new Error(`Asset "${assetId}" is not referenced by the project manifest`);
  }
  return safeProjectPath(project.directory, reference.path, `Asset reference "${assetId}"`);
}

function assetDocumentPathFor(projectDirectory: string, relativePath: string): string {
  return safeProjectPath(projectDirectory, relativePath, "Asset document path");
}

function promptPackPathFor(project: LoadedProject, promptPackId: string): string {
  const reference = (project.bundle.manifest.promptPacks ?? []).find((entry) => entry.id === promptPackId);
  if (!reference) {
    throw new Error(`Prompt pack "${promptPackId}" is not referenced by the project manifest`);
  }
  return safeProjectPath(project.directory, reference.path, `Prompt pack reference "${promptPackId}"`);
}

function animationPackPathFor(project: LoadedProject, animationPackId: string): string {
  const reference = (project.bundle.manifest.animationPacks ?? []).find((entry) => entry.id === animationPackId);
  if (!reference) {
    throw new Error(`Animation pack "${animationPackId}" is not referenced by the project manifest`);
  }
  return safeProjectPath(project.directory, reference.path, `Animation pack reference "${animationPackId}"`);
}

function workflowTemplatePathFor(project: LoadedProject, workflowTemplateId: string): string {
  const reference = (project.bundle.manifest.workflowTemplates ?? []).find((entry) => entry.id === workflowTemplateId);
  if (!reference) {
    throw new Error(`Workflow template "${workflowTemplateId}" is not referenced by the project manifest`);
  }
  return safeProjectPath(project.directory, reference.path, `Workflow template reference "${workflowTemplateId}"`);
}

function generationRecipePathFor(project: LoadedProject, generationRecipeId: string): string {
  const reference = (project.bundle.manifest.generationRecipes ?? []).find((entry) => entry.id === generationRecipeId);
  if (!reference) {
    throw new Error(`Generation recipe "${generationRecipeId}" is not referenced by the project manifest`);
  }
  return safeProjectPath(project.directory, reference.path, `Generation recipe reference "${generationRecipeId}"`);
}

function projectManifestPath(project: LoadedProject): string {
  return path.join(project.directory, "adventure.project.json");
}

function defaultFlowDocumentPath(flowId: string): string {
  return `flows/${flowId}.flow.json`;
}

function defaultItemDocumentPath(itemId: string): string {
  return `items/${itemId}.item.json`;
}

function defaultSceneDocumentPath(sceneId: string): string {
  return `scenes/${sceneId}.scene.json`;
}

function defaultPromptPackDocumentPath(promptPackId: string): string {
  return `prompt-packs/${promptPackId}.prompt-pack.json`;
}

function defaultAnimationPackDocumentPath(animationPackId: string): string {
  return `animation-packs/${animationPackId}.animation-pack.json`;
}

function defaultWorkflowTemplateDocumentPath(workflowTemplateId: string): string {
  return `workflow-templates/${workflowTemplateId}.workflow-template.json`;
}

function defaultGenerationRecipeDocumentPath(generationRecipeId: string): string {
  return `generation-recipes/${generationRecipeId}.generation-recipe.json`;
}

function describeFlowReference(use: FlowReferenceUse): string {
  switch (use) {
    case "lookFlowId":
      return "look action";
    case "talkFlowId":
      return "talk action";
    case "useFlowId":
      return "use action";
    case "useItemFlow":
      return "item-specific use action";
    case "pickupFlowId":
      return "pickup action";
  }
}

function describeItemReference(use: ItemReferenceUse): string {
  switch (use) {
    case "pickupItemId":
      return "pickup";
    case "hotspotUseItemFlow":
      return "item-specific hotspot action";
  }
}

function findFlowReferences(
  bundle: ProjectBundle,
  flowId: string
): Array<{ documentId: string; path: string; use: FlowReferenceUse }> {
  const references: Array<{ documentId: string; path: string; use: FlowReferenceUse }> = [];

  for (const scene of Object.values(bundle.scenes)) {
    if (scene.type !== "layered-2d") continue;

    for (const hotspot of scene.hotspots) {
      if (hotspot.actions.lookFlowId === flowId) {
        references.push({
          documentId: hotspot.id,
          path: `scenes/${scene.id}/hotspots/${hotspot.id}/actions/lookFlowId`,
          use: "lookFlowId"
        });
      }
      if (hotspot.actions.talkFlowId === flowId) {
        references.push({
          documentId: hotspot.id,
          path: `scenes/${scene.id}/hotspots/${hotspot.id}/actions/talkFlowId`,
          use: "talkFlowId"
        });
      }
      if (hotspot.actions.useFlowId === flowId) {
        references.push({
          documentId: hotspot.id,
          path: `scenes/${scene.id}/hotspots/${hotspot.id}/actions/useFlowId`,
          use: "useFlowId"
        });
      }
      for (const mapping of hotspot.actions.useItemFlows) {
        if (mapping.flowId === flowId) {
          references.push({
            documentId: hotspot.id,
            path: `scenes/${scene.id}/hotspots/${hotspot.id}/actions/useItemFlows/${mapping.itemId}/flowId`,
            use: "useItemFlow"
          });
        }
      }
    }

    for (const pickup of scene.pickups) {
      if (pickup.pickupFlowId === flowId) {
        references.push({
          documentId: pickup.id,
          path: `scenes/${scene.id}/pickups/${pickup.id}/pickupFlowId`,
          use: "pickupFlowId"
        });
      }
    }
  }

  return references;
}

function findItemReferences(
  bundle: ProjectBundle,
  itemId: string
): Array<{ documentId: string; path: string; use: ItemReferenceUse }> {
  const references: Array<{ documentId: string; path: string; use: ItemReferenceUse }> = [];

  for (const scene of Object.values(bundle.scenes)) {
    if (scene.type !== "layered-2d") continue;

    for (const hotspot of scene.hotspots) {
      for (const mapping of hotspot.actions.useItemFlows) {
        if (mapping.itemId === itemId) {
          references.push({
            documentId: hotspot.id,
            path: `scenes/${scene.id}/hotspots/${hotspot.id}/actions/useItemFlows/${mapping.itemId}`,
            use: "hotspotUseItemFlow"
          });
        }
      }
    }

    for (const pickup of scene.pickups) {
      if (pickup.itemId === itemId) {
        references.push({
          documentId: pickup.id,
          path: `scenes/${scene.id}/pickups/${pickup.id}/itemId`,
          use: "pickupItemId"
        });
      }
    }
  }

  return references;
}

function findAssetReferences(
  bundle: ProjectBundle,
  asset: AssetDocument
): Array<{
  documentId: string;
  path: string;
  use:
    | "sceneBackground"
    | "sceneLayer"
    | "scenePlayer"
    | "sceneActor"
    | "scenePickup"
    | "promptTargetReference"
    | "promptTargetMask"
    | "styleBibleReference"
    | "recipeReference"
    | "recipeMask"
    | "recipeParent"
    | "assetGenerationReference"
    | "assetGenerationMask"
    | "assetGenerationParent";
}> {
  const references: Array<{
    documentId: string;
    path: string;
    use:
      | "sceneBackground"
      | "sceneLayer"
      | "scenePlayer"
      | "sceneActor"
      | "scenePickup"
      | "promptTargetReference"
      | "promptTargetMask"
      | "styleBibleReference"
      | "recipeReference"
      | "recipeMask"
      | "recipeParent"
      | "assetGenerationReference"
      | "assetGenerationMask"
      | "assetGenerationParent";
  }> = [];

  for (const scene of Object.values(bundle.scenes)) {
    if (scene.type !== "layered-2d") continue;
    if (scene.background === asset.path) {
      references.push({
        documentId: scene.id,
        path: `scenes/${scene.id}/background`,
        use: "sceneBackground"
      });
    }
    if (scene.player?.assetId === asset.id) {
      references.push({
        documentId: scene.id,
        path: `scenes/${scene.id}/player/assetId`,
        use: "scenePlayer"
      });
    }
    for (const layer of scene.layers ?? []) {
      if (layer.assetId === asset.id) {
        references.push({
          documentId: scene.id,
          path: `scenes/${scene.id}/layers/${layer.id}/assetId`,
          use: "sceneLayer"
        });
      }
    }
    for (const actor of scene.actors) {
      if (actor.assetId === asset.id) {
        references.push({
          documentId: actor.id,
          path: `scenes/${scene.id}/actors/${actor.id}/assetId`,
          use: "sceneActor"
        });
      }
    }
    for (const pickup of scene.pickups) {
      if (pickup.assetId === asset.id) {
        references.push({
          documentId: pickup.id,
          path: `scenes/${scene.id}/pickups/${pickup.id}/assetId`,
          use: "scenePickup"
        });
      }
    }
  }

  for (const promptPack of Object.values(bundle.promptPacks)) {
    for (const target of promptPack.outputs.generationTargets) {
      if (target.referenceAssetId === asset.id) {
        references.push({
          documentId: `${promptPack.id}/${target.id}`,
          path: `prompt-packs/${promptPack.id}/generationTargets/${target.id}/referenceAssetId`,
          use: "promptTargetReference"
        });
      }
      if (target.maskAssetId === asset.id) {
        references.push({
          documentId: `${promptPack.id}/${target.id}`,
          path: `prompt-packs/${promptPack.id}/generationTargets/${target.id}/maskAssetId`,
          use: "promptTargetMask"
        });
      }
    }
  }

  for (const styleBible of Object.values(bundle.styleBibles)) {
    for (const referenceAssetId of styleBible.referenceAssetIds ?? []) {
      if (referenceAssetId === asset.id) {
        references.push({
          documentId: styleBible.id,
          path: `style-bibles/${styleBible.id}/referenceAssetIds/${referenceAssetId}`,
          use: "styleBibleReference"
        });
      }
    }
  }

  for (const recipe of Object.values(bundle.generationRecipes)) {
    for (const referenceAssetId of recipe.inputs?.referenceAssetIds ?? []) {
      if (referenceAssetId === asset.id) {
        references.push({
          documentId: `${recipe.id}/${referenceAssetId}`,
          path: `generation-recipes/${recipe.id}/inputs/referenceAssetIds/${referenceAssetId}`,
          use: "recipeReference"
        });
      }
    }
    if (recipe.inputs?.maskAssetId === asset.id) {
      references.push({
        documentId: recipe.id,
        path: `generation-recipes/${recipe.id}/inputs/maskAssetId`,
        use: "recipeMask"
      });
    }
    for (const parentAssetId of recipe.inputs?.parentAssetIds ?? []) {
      if (parentAssetId === asset.id) {
        references.push({
          documentId: `${recipe.id}/${parentAssetId}`,
          path: `generation-recipes/${recipe.id}/inputs/parentAssetIds/${parentAssetId}`,
          use: "recipeParent"
        });
      }
    }
  }

  for (const generatedAsset of Object.values(bundle.assets)) {
    if (generatedAsset.id === asset.id) continue;
    for (const referenceAssetId of generatedAsset.generation?.referenceAssetIds ?? []) {
      if (referenceAssetId === asset.id) {
        references.push({
          documentId: generatedAsset.id,
          path: `assets/${generatedAsset.id}/generation/referenceAssetIds/${referenceAssetId}`,
          use: "assetGenerationReference"
        });
      }
    }
    if (generatedAsset.generation?.maskAssetId === asset.id) {
      references.push({
        documentId: generatedAsset.id,
        path: `assets/${generatedAsset.id}/generation/maskAssetId`,
        use: "assetGenerationMask"
      });
    }
    for (const parentAssetId of generatedAsset.generation?.parentAssetIds ?? []) {
      if (parentAssetId === asset.id) {
        references.push({
          documentId: generatedAsset.id,
          path: `assets/${generatedAsset.id}/generation/parentAssetIds/${parentAssetId}`,
          use: "assetGenerationParent"
        });
      }
    }
  }

  return references;
}

function patchHotspot(scene: Layered2DScene, hotspotId: string, patch: HotspotPatch): Layered2DScene {
  const index = scene.hotspots.findIndex((hotspot) => hotspot.id === hotspotId);
  if (index < 0) {
    throw new Error(`Hotspot "${hotspotId}" was not found in scene "${scene.id}"`);
  }

  const currentHotspot = scene.hotspots[index]!;
  const nextHotspot: Hotspot = {
    ...currentHotspot,
    actions: patch.actions,
    bounds: patch.bounds,
    labelKey: patch.labelKey
  };
  if ("interactSpot" in patch) {
    if (patch.interactSpot) {
      nextHotspot.interactSpot = patch.interactSpot;
    } else {
      delete nextHotspot.interactSpot;
    }
  }
  if ("lookSpot" in patch) {
    if (patch.lookSpot) {
      nextHotspot.lookSpot = patch.lookSpot;
    } else {
      delete nextHotspot.lookSpot;
    }
  }
  if (patch.cursor) {
    nextHotspot.cursor = patch.cursor;
  } else {
    delete nextHotspot.cursor;
  }

  const hotspots = [...scene.hotspots];
  hotspots[index] = nextHotspot;
  return {
    ...scene,
    hotspots
  };
}

function addHotspot(scene: Layered2DScene, hotspot: Hotspot): Layered2DScene {
  if (scene.hotspots.some((entry) => entry.id === hotspot.id)) {
    throw new Error(`Hotspot "${hotspot.id}" already exists in scene "${scene.id}"`);
  }

  return {
    ...scene,
    hotspots: [...scene.hotspots, hotspot]
  };
}

function removeHotspot(scene: Layered2DScene, hotspotId: string): Layered2DScene {
  const index = scene.hotspots.findIndex((hotspot) => hotspot.id === hotspotId);
  if (index < 0) {
    throw new Error(`Hotspot "${hotspotId}" was not found in scene "${scene.id}"`);
  }

  return {
    ...scene,
    hotspots: scene.hotspots.filter((hotspot) => hotspot.id !== hotspotId)
  };
}

function patchScene(scene: Layered2DScene, patch: ScenePatch): Layered2DScene {
  return {
    ...scene,
    background: patch.background,
    ...(patch.generationGuides ? { generationGuides: patch.generationGuides } : {}),
    ...(patch.layers ? { layers: patch.layers } : {}),
    name: patch.name,
    ...(patch.player ? { player: patch.player } : {}),
    playerStart: patch.playerStart,
    size: patch.size,
    walkArea: patch.walkArea
  };
}

function patchPickup(scene: Layered2DScene, pickupId: string, patch: PickupPatch): Layered2DScene {
  const index = scene.pickups.findIndex((pickup) => pickup.id === pickupId);
  if (index < 0) {
    throw new Error(`Pickup "${pickupId}" was not found in scene "${scene.id}"`);
  }

  const currentPickup = scene.pickups[index]!;
  const nextPickup: ScenePickup = {
    ...currentPickup,
    bounds: patch.bounds,
    itemId: patch.itemId,
    labelKey: patch.labelKey
  };
  if (patch.assetId) {
    nextPickup.assetId = patch.assetId;
  } else {
    delete nextPickup.assetId;
  }
  if ("interactSpot" in patch) {
    if (patch.interactSpot) {
      nextPickup.interactSpot = patch.interactSpot;
    } else {
      delete nextPickup.interactSpot;
    }
  }
  if ("lookSpot" in patch) {
    if (patch.lookSpot) {
      nextPickup.lookSpot = patch.lookSpot;
    } else {
      delete nextPickup.lookSpot;
    }
  }
  if (patch.pickupFlowId) {
    nextPickup.pickupFlowId = patch.pickupFlowId;
  } else {
    delete nextPickup.pickupFlowId;
  }

  const pickups = [...scene.pickups];
  pickups[index] = nextPickup;
  return {
    ...scene,
    pickups
  };
}

function addPickup(scene: Layered2DScene, pickup: ScenePickup): Layered2DScene {
  if (scene.pickups.some((entry) => entry.id === pickup.id)) {
    throw new Error(`Pickup "${pickup.id}" already exists in scene "${scene.id}"`);
  }

  return {
    ...scene,
    pickups: [...scene.pickups, pickup]
  };
}

function removePickup(scene: Layered2DScene, pickupId: string): Layered2DScene {
  const index = scene.pickups.findIndex((pickup) => pickup.id === pickupId);
  if (index < 0) {
    throw new Error(`Pickup "${pickupId}" was not found in scene "${scene.id}"`);
  }

  return {
    ...scene,
    pickups: scene.pickups.filter((pickup) => pickup.id !== pickupId)
  };
}

function patchActor(scene: Layered2DScene, actorId: string, patch: ActorPatch): Layered2DScene {
  const index = scene.actors.findIndex((actor) => actor.id === actorId);
  if (index < 0) {
    throw new Error(`Actor "${actorId}" was not found in scene "${scene.id}"`);
  }
  if (patch.id !== actorId) {
    throw new Error(`Actor patch id "${patch.id}" must match actor "${actorId}"`);
  }

  const actors = [...scene.actors];
  actors[index] = patch;
  return {
    ...scene,
    actors
  };
}

function addActor(scene: Layered2DScene, actor: SceneActor): Layered2DScene {
  if (scene.actors.some((entry) => entry.id === actor.id)) {
    throw new Error(`Actor "${actor.id}" already exists in scene "${scene.id}"`);
  }

  return {
    ...scene,
    actors: [...scene.actors, actor]
  };
}

function removeActor(scene: Layered2DScene, actorId: string): Layered2DScene {
  const index = scene.actors.findIndex((actor) => actor.id === actorId);
  if (index < 0) {
    throw new Error(`Actor "${actorId}" was not found in scene "${scene.id}"`);
  }

  return {
    ...scene,
    actors: scene.actors.filter((actor) => actor.id !== actorId)
  };
}

function replaceSceneBackground(scene: Layered2DScene, currentPath: string, nextPath: string): Layered2DScene {
  if (scene.background !== currentPath) {
    return scene;
  }

  return {
    ...scene,
    background: nextPath
  };
}

function patchLocale(locale: LocaleDocument, patch: LocaleUpsertPatch): LocaleDocument {
  return {
    ...locale,
    strings: {
      ...locale.strings,
      [patch.key]: patch.value
    }
  };
}

function removeLocaleKey(locale: LocaleDocument, key: string): LocaleDocument {
  if (!(key in locale.strings)) {
    throw new Error(`Locale key "${key}" does not exist in locale "${locale.locale}"`);
  }

  const { [key]: _removed, ...strings } = locale.strings;
  return {
    ...locale,
    strings
  };
}

function patchFlow(flow: FlowDocument, patch: FlowPatch): FlowDocument {
  return {
    ...flow,
    name: patch.name,
    nodes: patch.nodes,
    startNodeId: patch.startNodeId
  };
}

function patchItem(item: ItemDocument, patch: ItemPatch): ItemDocument {
  return {
    ...item,
    labelKey: patch.labelKey,
    name: patch.name
  };
}

function patchAsset(asset: AssetDocument, patch: AssetRelinkPatch): AssetDocument {
  return {
    ...asset,
    path: patch.path
  };
}

function upsertPromptPackManifestReference(
  manifest: ProjectManifest,
  promptPack: PromptPackDocument,
  documentPath: string
): ProjectManifest {
  const promptPacks = [...(manifest.promptPacks ?? [])];
  const existingIndex = promptPacks.findIndex((entry) => entry.id === promptPack.id);
  const reference = { id: promptPack.id, path: documentPath };

  if (existingIndex >= 0) {
    promptPacks[existingIndex] = reference;
  } else {
    promptPacks.push(reference);
  }

  return {
    ...manifest,
    promptPacks
  };
}

function upsertAnimationPackManifestReference(
  manifest: ProjectManifest,
  animationPack: AnimationPackDocument,
  documentPath: string
): ProjectManifest {
  const animationPacks = [...(manifest.animationPacks ?? [])];
  const existingIndex = animationPacks.findIndex((entry) => entry.id === animationPack.id);
  const reference = { id: animationPack.id, path: documentPath };

  if (existingIndex >= 0) {
    animationPacks[existingIndex] = reference;
  } else {
    animationPacks.push(reference);
  }

  return {
    ...manifest,
    animationPacks
  };
}

function upsertWorkflowTemplateManifestReference(
  manifest: ProjectManifest,
  workflowTemplate: WorkflowTemplateDocument,
  documentPath: string
): ProjectManifest {
  const workflowTemplates = [...(manifest.workflowTemplates ?? [])];
  const existingIndex = workflowTemplates.findIndex((entry) => entry.id === workflowTemplate.id);
  const reference = { id: workflowTemplate.id, path: documentPath };

  if (existingIndex >= 0) {
    workflowTemplates[existingIndex] = reference;
  } else {
    workflowTemplates.push(reference);
  }

  return {
    ...manifest,
    workflowTemplates
  };
}

function upsertGenerationRecipeManifestReference(
  manifest: ProjectManifest,
  generationRecipe: AssetGenerationRecipeDocument,
  documentPath: string
): ProjectManifest {
  const generationRecipes = [...(manifest.generationRecipes ?? [])];
  const existingIndex = generationRecipes.findIndex((entry) => entry.id === generationRecipe.id);
  const reference = { id: generationRecipe.id, path: documentPath };

  if (existingIndex >= 0) {
    generationRecipes[existingIndex] = reference;
  } else {
    generationRecipes.push(reference);
  }

  return {
    ...manifest,
    generationRecipes
  };
}

function validateFlowReferences(flow: FlowDocument): void {
  const seen = new Set<string>();
  for (const node of flow.nodes) {
    if (seen.has(node.id)) {
      throw new Error(`Flow "${flow.id}" contains duplicate node id "${node.id}"`);
    }
    seen.add(node.id);
  }

  if (!seen.has(flow.startNodeId)) {
    throw new Error(`Flow "${flow.id}" startNodeId "${flow.startNodeId}" does not exist`);
  }

  let hasEnd = false;
  for (const node of flow.nodes) {
    if (node.type === "end") {
      hasEnd = true;
      continue;
    }
    if (node.type === "choice") {
      for (const choice of node.choices) {
        if (!seen.has(choice.next)) {
          throw new Error(
            `Flow "${flow.id}" choice "${node.id}/${choice.id}" points to missing next "${choice.next}"`
          );
        }
      }
      continue;
    }
    if (node.type === "condition") {
      if (!seen.has(node.ifTrue) || !seen.has(node.ifFalse)) {
        throw new Error(`Flow "${flow.id}" condition node "${node.id}" points to a missing branch`);
      }
      continue;
    }
    if (!seen.has(node.next)) {
      throw new Error(`Flow "${flow.id}" node "${node.id}" points to missing next "${node.next}"`);
    }
  }

  if (!hasEnd) {
    throw new Error(`Flow "${flow.id}" must contain at least one end node`);
  }
}

export async function validateProjectFiles(project: LoadedProject): Promise<ProjectDiagnostic[]> {
  const diagnostics: ProjectDiagnostic[] = [];

  for (const asset of Object.values(project.bundle.assets)) {
    const assetFilePath = safeProjectPath(project.directory, asset.path, `Asset file "${asset.id}"`);
    try {
      await stat(assetFilePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        diagnostics.push(
          createDiagnostic(
            "error",
            "asset.file-missing",
            `Asset "${asset.id}" file "${asset.path}" is missing.`,
            { documentId: asset.id, path: `assets/${asset.id}/path` }
          )
        );
        continue;
      }
      throw error;
    }

    if (asset.contentSha256) {
      const actualHash = sha256(await readFile(assetFilePath));
      if (actualHash !== asset.contentSha256) {
        diagnostics.push(
          createDiagnostic(
            "warning",
            "asset.content-hash-mismatch",
            `Asset "${asset.id}" file content no longer matches its recorded SHA-256 hash.`,
            { documentId: asset.id, path: `assets/${asset.id}/contentSha256` }
          )
        );
      }
    }
  }

  for (const workflow of Object.values(project.bundle.workflowTemplates)) {
    const workflowFilePath = safeProjectPath(
      project.directory,
      workflow.workflowPath,
      `Workflow template file "${workflow.id}"`
    );
    try {
      await stat(workflowFilePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        diagnostics.push(
          createDiagnostic(
            "error",
            "workflow-template.file-missing",
            `Workflow template "${workflow.id}" file "${workflow.workflowPath}" is missing.`,
            { documentId: workflow.id, path: `workflow-templates/${workflow.id}/workflowPath` }
          )
        );
        continue;
      }
      throw error;
    }

    let workflowJson: unknown;
    try {
      workflowJson = await readJson(workflowFilePath);
    } catch (error) {
      diagnostics.push(
        createDiagnostic(
          "error",
          "workflow-template.file-invalid",
          `Workflow template "${workflow.id}" file "${workflow.workflowPath}" is not valid JSON.`,
          { documentId: workflow.id, path: `workflow-templates/${workflow.id}/workflowPath` }
        )
      );
      continue;
    }

    const workflowNodes =
      workflowJson && typeof workflowJson === "object" && !Array.isArray(workflowJson)
        ? (workflowJson as Record<string, { inputs?: Record<string, unknown> }>)
        : null;
    if (!workflowNodes) {
      diagnostics.push(
        createDiagnostic(
          "error",
          "workflow-template.file-not-object",
          `Workflow template "${workflow.id}" file "${workflow.workflowPath}" must be a ComfyUI API JSON object.`,
          { documentId: workflow.id, path: `workflow-templates/${workflow.id}/workflowPath` }
        )
      );
      continue;
    }

    for (const binding of workflow.bindings) {
      const node = workflowNodes[binding.nodeId];
      if (!node) {
        diagnostics.push(
          createDiagnostic(
            "error",
            "workflow-template.binding-node-missing",
            `Workflow template "${workflow.id}" binding "${binding.input}" references missing node "${binding.nodeId}".`,
            { documentId: workflow.id, path: `workflow-templates/${workflow.id}/bindings/${binding.input}` }
          )
        );
        continue;
      }
      if (!node.inputs || !(binding.inputKey in node.inputs)) {
        diagnostics.push(
          createDiagnostic(
            "error",
            "workflow-template.binding-input-missing",
            `Workflow template "${workflow.id}" binding "${binding.input}" references missing input "${binding.nodeId}.${binding.inputKey}".`,
            { documentId: workflow.id, path: `workflow-templates/${workflow.id}/bindings/${binding.input}` }
          )
        );
      }
    }

    const outputNode = workflowNodes[workflow.output.nodeId];
    if (!outputNode) {
      diagnostics.push(
        createDiagnostic(
          "error",
          "workflow-template.output-node-missing",
          `Workflow template "${workflow.id}" output references missing node "${workflow.output.nodeId}".`,
          { documentId: workflow.id, path: `workflow-templates/${workflow.id}/output/nodeId` }
        )
      );
    } else if (!outputNode.inputs || !("images" in outputNode.inputs)) {
      diagnostics.push(
        createDiagnostic(
          "error",
          "workflow-template.output-input-missing",
          `Workflow template "${workflow.id}" output node "${workflow.output.nodeId}" must have an images input.`,
          { documentId: workflow.id, path: `workflow-templates/${workflow.id}/output/nodeId` }
        )
      );
    }
  }

  diagnostics.push(...(await validateProjectHistory(project.directory)));

  return diagnostics;
}

const projectHistoryDirectory = (projectDirectory: string) => path.join(projectDirectory, ".pointclick", "changes");

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function documentHash(value: unknown): string {
  return sha256(serializeJsonDocument(value));
}

function projectDocumentSnapshots(project: LoadedProject): ProjectChangeDocument[] {
  const snapshots: ProjectChangeDocument[] = [
    {
      kind: "project",
      id: project.bundle.manifest.id,
      path: "adventure.project.json",
      afterSha256: documentHash(project.bundle.manifest)
    }
  ];

  const appendReferences = <T extends { id?: string }>(
    kind: string,
    references: ReadonlyArray<{ id: string; path: string }> | undefined,
    documents: Record<string, T>
  ) => {
    for (const reference of references ?? []) {
      const document = documents[reference.id];
      if (!document) continue;
      snapshots.push({
        kind,
        id: reference.id,
        path: reference.path,
        afterSha256: documentHash(document)
      });
    }
  };

  appendReferences("scene", project.bundle.manifest.scenes, project.bundle.scenes);
  appendReferences("flow", project.bundle.manifest.flows, project.bundle.flows);
  appendReferences("item", project.bundle.manifest.items, project.bundle.items);
  appendReferences("asset", project.bundle.manifest.assets, project.bundle.assets);
  appendReferences("animation-pack", project.bundle.manifest.animationPacks, project.bundle.animationPacks);
  appendReferences("prompt-pack", project.bundle.manifest.promptPacks, project.bundle.promptPacks);
  appendReferences("style-bible", project.bundle.manifest.styleBibles, project.bundle.styleBibles);
  appendReferences("workflow-template", project.bundle.manifest.workflowTemplates, project.bundle.workflowTemplates);
  appendReferences("generation-recipe", project.bundle.manifest.generationRecipes, project.bundle.generationRecipes);

  for (const reference of project.bundle.manifest.locales) {
    const document = project.bundle.locales[reference.locale];
    if (!document) continue;
    snapshots.push({
      kind: "locale",
      id: reference.locale,
      path: reference.path,
      afterSha256: documentHash(document)
    });
  }

  return snapshots;
}

function projectChangeScope(command: EditorProjectCommand): ProjectChangeScope {
  if (command.type === "project/update-settings") return "project";
  if (command.type.startsWith("scene/") || command.type.startsWith("hotspot/") || command.type.startsWith("pickup/") || command.type.startsWith("actor/")) {
    return "scene";
  }
  if (command.type.startsWith("flow/") || command.type.startsWith("item/")) return "narrative";
  if (command.type.startsWith("locale/")) return "localization";
  if (command.type.startsWith("asset/") || command.type.startsWith("animation-pack/")) return "asset";
  return "ai";
}

function projectChangeSummary(command: EditorProjectCommand): string {
  const target =
    "sceneId" in command ? command.sceneId :
    "flowId" in command ? command.flowId :
    "itemId" in command ? command.itemId :
    "assetId" in command ? command.assetId :
    "hotspotId" in command ? command.hotspotId :
    "pickupId" in command ? command.pickupId :
    "actorId" in command ? command.actorId :
    "locale" in command ? command.locale :
    undefined;
  return target ? `${command.type} (${target})` : command.type;
}

function redactHistoryValue(value: unknown, key = ""): unknown {
  const normalizedKey = key.toLowerCase();
  if (/(api[-_]?key|token|secret|password|authorization|access[-_]?token)/.test(normalizedKey)) {
    return "[redacted]";
  }
  if (Array.isArray(value)) return value.map((entry) => redactHistoryValue(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        redactHistoryValue(entryValue, entryKey)
      ])
    );
  }
  return value;
}

function changedProjectDocuments(before: LoadedProject, after: LoadedProject): ProjectChangeDocument[] {
  const beforeByPath = new Map(projectDocumentSnapshots(before).map((document) => [document.path, document]));
  const afterByPath = new Map(projectDocumentSnapshots(after).map((document) => [document.path, document]));
  const paths = new Set([...beforeByPath.keys(), ...afterByPath.keys()]);
  const changed: ProjectChangeDocument[] = [];

  for (const documentPath of [...paths].sort()) {
    const beforeDocument = beforeByPath.get(documentPath);
    const afterDocument = afterByPath.get(documentPath);
    if (beforeDocument?.afterSha256 === afterDocument?.afterSha256) continue;
    const id = afterDocument?.id ?? beforeDocument?.id;
    changed.push({
      kind: afterDocument?.kind ?? beforeDocument!.kind,
      ...(id ? { id } : {}),
      path: documentPath,
      ...(beforeDocument?.afterSha256 ? { beforeSha256: beforeDocument.afterSha256 } : {}),
      ...(afterDocument?.afterSha256 ? { afterSha256: afterDocument.afterSha256 } : {})
    });
  }

  return changed;
}

export async function diffProjectDirectories(
  leftProjectDirectory: string,
  rightProjectDirectory: string
): Promise<ProjectDiff> {
  const [left, right] = await Promise.all([
    loadProjectFromDirectory(leftProjectDirectory),
    loadProjectFromDirectory(rightProjectDirectory)
  ]);
  return {
    changedDocuments: changedProjectDocuments(left, right),
    leftProjectDirectory: left.directory,
    rightProjectDirectory: right.directory
  };
}

export async function loadProjectHistory(projectDirectory: string): Promise<ProjectHistory> {
  const directory = projectHistoryDirectory(path.resolve(projectDirectory));
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { directory, records: [] };
    throw error;
  }

  const records: ProjectChangeRecord[] = [];
  for (const entry of entries.filter((entry) => entry.isFile() && entry.name.endsWith(".change.json")).sort((left, right) => left.name.localeCompare(right.name))) {
    const value = await readJson(path.join(directory, entry.name));
    assertDocument<ProjectChangeRecord>("projectChange", value);
    records.push(value);
  }
  return { directory, records: records.sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id)) };
}

async function writeProjectHistoryRecord(projectDirectory: string, record: ProjectChangeRecord): Promise<void> {
  assertDocument<ProjectChangeRecord>("projectChange", record);
  const directory = projectHistoryDirectory(path.resolve(projectDirectory));
  const filename = `${String(record.sequence).padStart(6, "0")}-${record.id}.change.json`;
  await writeJson(path.join(directory, filename), record);
}

export async function initializeProjectHistory(
  projectDirectory: string,
  source: ProjectChangeSource = "migration"
): Promise<ProjectHistory> {
  const existing = await loadProjectHistory(projectDirectory);
  if (existing.records.length > 0) return existing;
  const project = await loadProjectFromDirectory(projectDirectory);
  const affectedDocuments = projectDocumentSnapshots(project).map(({ afterSha256, ...document }) => ({
    ...document,
    ...(afterSha256 ? { afterSha256 } : {})
  }));
  const record: ProjectChangeRecord = {
    schemaVersion: 1,
    id: randomUUID(),
    sequence: 0,
    createdAt: new Date().toISOString(),
    source,
    operation: "history/init",
    summary: "Project history baseline",
    scope: "project",
    affectedDocuments
  };
  await writeProjectHistoryRecord(project.directory, record);
  return { directory: existing.directory, records: [record] };
}

export async function recordProjectChange(
  before: LoadedProject,
  after: LoadedProject,
  command: EditorProjectCommand,
  options: Pick<ApplyProjectCommandOptions, "source" | "summary"> = {}
): Promise<ProjectChangeRecord> {
  const history = await loadProjectHistory(after.directory);
  const affectedDocuments = changedProjectDocuments(before, after);
  const record: ProjectChangeRecord = {
    schemaVersion: 1,
    id: randomUUID(),
    sequence: (history.records.at(-1)?.sequence ?? 0) + 1,
    createdAt: new Date().toISOString(),
    source: options.source ?? "editor",
    operation: command.type,
    summary: options.summary?.trim() || projectChangeSummary(command),
    scope: projectChangeScope(command),
    affectedDocuments: affectedDocuments.length > 0 ? affectedDocuments : projectDocumentSnapshots(after).slice(0, 1),
    command: redactHistoryValue(command)
  };
  await writeProjectHistoryRecord(after.directory, record);
  return record;
}

export async function validateProjectHistory(projectDirectory: string): Promise<ProjectDiagnostic[]> {
  try {
    await loadProjectHistory(projectDirectory);
    return [];
  } catch (error) {
    return [
      createDiagnostic(
        "error",
        "history.invalid",
        `Project history is invalid: ${error instanceof Error ? error.message : "unknown error"}`,
        { path: ".pointclick/changes" }
      )
    ];
  }
}

async function applyProjectCommandWithoutHistory(
  projectDirectory: string,
  command: EditorProjectCommand
): Promise<LoadedProject> {
  const project = await loadProjectFromDirectory(projectDirectory);

  if (command.type === "project/update-settings") {
    const title = command.patch.title.trim();
    const defaultLocale = command.patch.defaultLocale.trim();
    const initialSceneId = command.patch.initialSceneId.trim();
    const viewport = {
      height: Math.round(command.patch.viewport.height),
      width: Math.round(command.patch.viewport.width)
    };

    if (!title) {
      throw new Error("Project title is required");
    }
    if (!project.bundle.scenes[initialSceneId]) {
      throw new Error(`Initial scene "${initialSceneId}" was not found in the loaded project`);
    }
    if (!project.bundle.locales[defaultLocale]) {
      throw new Error(`Default locale "${defaultLocale}" was not found in the loaded project`);
    }

    const nextManifest: ProjectManifest = {
      ...project.bundle.manifest,
      defaultLocale,
      initialSceneId,
      title,
      viewport
    };

    assertDocument<ProjectManifest>("project", nextManifest);
    await writeJson(projectManifestPath(project), nextManifest);
  }

  if (command.type === "hotspot/update") {
    const scene = project.bundle.scenes[command.sceneId];
    if (!scene) {
      throw new Error(`Scene "${command.sceneId}" was not found in the loaded project`);
    }
    if (scene.type !== "layered-2d") {
      throw new Error(`Scene "${command.sceneId}" does not support hotspot editing yet`);
    }

    const nextScene = patchHotspot(scene, command.hotspotId, command.patch);
    assertDocument<Layered2DScene>("layered2dScene", nextScene);
    await writeJson(scenePathFor(project, command.sceneId), nextScene);
  }

  if (command.type === "hotspot/create") {
    const scene = project.bundle.scenes[command.sceneId];
    if (!scene) {
      throw new Error(`Scene "${command.sceneId}" was not found in the loaded project`);
    }
    if (scene.type !== "layered-2d") {
      throw new Error(`Scene "${command.sceneId}" does not support hotspot editing yet`);
    }

    const nextScene = addHotspot(scene, command.hotspot);
    assertDocument<Layered2DScene>("layered2dScene", nextScene);
    await writeJson(scenePathFor(project, command.sceneId), nextScene);
  }

  if (command.type === "hotspot/delete") {
    const scene = project.bundle.scenes[command.sceneId];
    if (!scene) {
      throw new Error(`Scene "${command.sceneId}" was not found in the loaded project`);
    }
    if (scene.type !== "layered-2d") {
      throw new Error(`Scene "${command.sceneId}" does not support hotspot editing yet`);
    }

    const nextScene = removeHotspot(scene, command.hotspotId);
    assertDocument<Layered2DScene>("layered2dScene", nextScene);
    await writeJson(scenePathFor(project, command.sceneId), nextScene);
  }

  if (command.type === "scene/update") {
    const scene = project.bundle.scenes[command.sceneId];
    if (!scene) {
      throw new Error(`Scene "${command.sceneId}" was not found in the loaded project`);
    }
    if (scene.type !== "layered-2d") {
      throw new Error(`Scene "${command.sceneId}" does not support inspector scene editing yet`);
    }

    const nextScene = patchScene(scene, command.patch);
    assertDocument<Layered2DScene>("layered2dScene", nextScene);
    await writeJson(scenePathFor(project, command.sceneId), nextScene);
  }

  if (command.type === "scene/create") {
    if (project.bundle.scenes[command.scene.id]) {
      throw new Error(`Scene "${command.scene.id}" already exists in the loaded project`);
    }

    assertDocument<Layered2DScene>("layered2dScene", command.scene);

    const documentPath = command.documentPath ?? defaultSceneDocumentPath(command.scene.id);
    if (project.bundle.manifest.scenes.some((entry) => entry.id === command.scene.id || entry.path === documentPath)) {
      throw new Error(`Scene "${command.scene.id}" already has a manifest entry`);
    }

    const nextManifest: ProjectManifest = {
      ...project.bundle.manifest,
      scenes: [...project.bundle.manifest.scenes, { id: command.scene.id, path: documentPath }]
    };

    await writeJson(safeProjectPath(project.directory, documentPath, "Scene document path"), command.scene);
    assertDocument<ProjectManifest>("project", nextManifest);
    await writeJson(projectManifestPath(project), nextManifest);
  }

  if (command.type === "scene/delete") {
    const scene = project.bundle.scenes[command.sceneId];
    if (!scene) {
      throw new Error(`Scene "${command.sceneId}" was not found in the loaded project`);
    }

    if (project.bundle.manifest.scenes.length <= 1) {
      throw new Error("A project must keep at least one scene");
    }

    const remainingScenes = project.bundle.manifest.scenes.filter((entry) => entry.id !== command.sceneId);
    const nextInitialSceneId =
      project.bundle.manifest.initialSceneId === command.sceneId
        ? remainingScenes[0]!.id
        : project.bundle.manifest.initialSceneId;

    const nextManifest: ProjectManifest = {
      ...project.bundle.manifest,
      initialSceneId: nextInitialSceneId,
      scenes: remainingScenes
    };

    assertDocument<ProjectManifest>("project", nextManifest);
    await writeJson(projectManifestPath(project), nextManifest);

    try {
      await unlink(scenePathFor(project, command.sceneId));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  if (command.type === "pickup/update") {
    const scene = project.bundle.scenes[command.sceneId];
    if (!scene) {
      throw new Error(`Scene "${command.sceneId}" was not found in the loaded project`);
    }
    if (scene.type !== "layered-2d") {
      throw new Error(`Scene "${command.sceneId}" does not support pickup editing yet`);
    }

    const nextScene = patchPickup(scene, command.pickupId, command.patch);
    assertDocument<Layered2DScene>("layered2dScene", nextScene);
    await writeJson(scenePathFor(project, command.sceneId), nextScene);
  }

  if (command.type === "pickup/create") {
    const scene = project.bundle.scenes[command.sceneId];
    if (!scene) {
      throw new Error(`Scene "${command.sceneId}" was not found in the loaded project`);
    }
    if (scene.type !== "layered-2d") {
      throw new Error(`Scene "${command.sceneId}" does not support pickup editing yet`);
    }

    const nextScene = addPickup(scene, command.pickup);
    assertDocument<Layered2DScene>("layered2dScene", nextScene);
    await writeJson(scenePathFor(project, command.sceneId), nextScene);
  }

  if (command.type === "pickup/delete") {
    const scene = project.bundle.scenes[command.sceneId];
    if (!scene) {
      throw new Error(`Scene "${command.sceneId}" was not found in the loaded project`);
    }
    if (scene.type !== "layered-2d") {
      throw new Error(`Scene "${command.sceneId}" does not support pickup editing yet`);
    }

    const nextScene = removePickup(scene, command.pickupId);
    assertDocument<Layered2DScene>("layered2dScene", nextScene);
    await writeJson(scenePathFor(project, command.sceneId), nextScene);
  }

  if (command.type === "actor/update") {
    const scene = project.bundle.scenes[command.sceneId];
    if (!scene) {
      throw new Error(`Scene "${command.sceneId}" was not found in the loaded project`);
    }
    if (scene.type !== "layered-2d") {
      throw new Error(`Scene "${command.sceneId}" does not support actor editing yet`);
    }

    const nextScene = patchActor(scene, command.actorId, command.patch);
    assertDocument<Layered2DScene>("layered2dScene", nextScene);
    await writeJson(scenePathFor(project, command.sceneId), nextScene);
  }

  if (command.type === "actor/create") {
    const scene = project.bundle.scenes[command.sceneId];
    if (!scene) {
      throw new Error(`Scene "${command.sceneId}" was not found in the loaded project`);
    }
    if (scene.type !== "layered-2d") {
      throw new Error(`Scene "${command.sceneId}" does not support actor editing yet`);
    }

    const nextScene = addActor(scene, command.actor);
    assertDocument<Layered2DScene>("layered2dScene", nextScene);
    await writeJson(scenePathFor(project, command.sceneId), nextScene);
  }

  if (command.type === "actor/delete") {
    const scene = project.bundle.scenes[command.sceneId];
    if (!scene) {
      throw new Error(`Scene "${command.sceneId}" was not found in the loaded project`);
    }
    if (scene.type !== "layered-2d") {
      throw new Error(`Scene "${command.sceneId}" does not support actor editing yet`);
    }

    const nextScene = removeActor(scene, command.actorId);
    assertDocument<Layered2DScene>("layered2dScene", nextScene);
    await writeJson(scenePathFor(project, command.sceneId), nextScene);
  }

  if (command.type === "locale/upsert") {
    const locale = project.bundle.locales[command.locale];
    if (!locale) {
      throw new Error(`Locale "${command.locale}" was not found in the loaded project`);
    }

    const nextLocale = patchLocale(locale, {
      key: command.patch.key.trim(),
      value: command.patch.value
    });
    assertDocument<LocaleDocument>("locale", nextLocale);
    await writeJson(localePathFor(project, command.locale), nextLocale);
  }

  if (command.type === "locale/delete") {
    const locale = project.bundle.locales[command.locale];
    if (!locale) {
      throw new Error(`Locale "${command.locale}" was not found in the loaded project`);
    }

    const normalizedKey = command.key.trim();
    if (!normalizedKey) {
      throw new Error("Locale key cannot be empty");
    }

    const nextLocale = removeLocaleKey(locale, normalizedKey);
    assertDocument<LocaleDocument>("locale", nextLocale);
    await writeJson(localePathFor(project, command.locale), nextLocale);
  }

  if (command.type === "flow/update") {
    const flow = project.bundle.flows[command.flowId];
    if (!flow) {
      throw new Error(`Flow "${command.flowId}" was not found in the loaded project`);
    }

    const nextFlow = patchFlow(flow, command.patch);
    assertDocument<FlowDocument>("flow", nextFlow);
    validateFlowReferences(nextFlow);
    await writeJson(flowPathFor(project, command.flowId), nextFlow);
  }

  if (command.type === "flow/create") {
    if (project.bundle.flows[command.flow.id]) {
      throw new Error(`Flow "${command.flow.id}" already exists in the loaded project`);
    }

    assertDocument<FlowDocument>("flow", command.flow);
    validateFlowReferences(command.flow);

    const documentPath = command.documentPath ?? defaultFlowDocumentPath(command.flow.id);
    if (project.bundle.manifest.flows.some((entry) => entry.id === command.flow.id || entry.path === documentPath)) {
      throw new Error(`Flow "${command.flow.id}" already has a manifest entry`);
    }

    const nextManifest: ProjectManifest = {
      ...project.bundle.manifest,
      flows: [...project.bundle.manifest.flows, { id: command.flow.id, path: documentPath }]
    };

    await writeJson(safeProjectPath(project.directory, documentPath, "Flow document path"), command.flow);
    assertDocument<ProjectManifest>("project", nextManifest);
    await writeJson(projectManifestPath(project), nextManifest);
  }

  if (command.type === "flow/delete") {
    const flow = project.bundle.flows[command.flowId];
    if (!flow) {
      throw new Error(`Flow "${command.flowId}" was not found in the loaded project`);
    }

    const references = findFlowReferences(project.bundle, command.flowId);
    if (references.length > 0) {
      const details = references
        .map((reference) => `${reference.documentId} (${describeFlowReference(reference.use)})`)
        .join(", ");
      throw new Error(`Flow "${command.flowId}" is still referenced by ${details}`);
    }

    const nextManifest: ProjectManifest = {
      ...project.bundle.manifest,
      flows: project.bundle.manifest.flows.filter((entry) => entry.id !== command.flowId)
    };

    assertDocument<ProjectManifest>("project", nextManifest);
    await writeJson(projectManifestPath(project), nextManifest);

    try {
      await unlink(flowPathFor(project, command.flowId));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  if (command.type === "item/update") {
    const item = project.bundle.items[command.itemId];
    if (!item) {
      throw new Error(`Item "${command.itemId}" was not found in the loaded project`);
    }

    const nextItem = patchItem(item, command.patch);
    assertDocument<ItemDocument>("item", nextItem);
    await writeJson(itemPathFor(project, command.itemId), nextItem);
  }

  if (command.type === "item/create") {
    if (project.bundle.items[command.item.id]) {
      throw new Error(`Item "${command.item.id}" already exists in the loaded project`);
    }

    assertDocument<ItemDocument>("item", command.item);

    const documentPath = command.documentPath ?? defaultItemDocumentPath(command.item.id);
    if (project.bundle.manifest.items.some((entry) => entry.id === command.item.id || entry.path === documentPath)) {
      throw new Error(`Item "${command.item.id}" already has a manifest entry`);
    }

    const nextManifest: ProjectManifest = {
      ...project.bundle.manifest,
      items: [...project.bundle.manifest.items, { id: command.item.id, path: documentPath }]
    };

    await writeJson(safeProjectPath(project.directory, documentPath, "Item document path"), command.item);
    assertDocument<ProjectManifest>("project", nextManifest);
    await writeJson(projectManifestPath(project), nextManifest);
  }

  if (command.type === "item/delete") {
    const item = project.bundle.items[command.itemId];
    if (!item) {
      throw new Error(`Item "${command.itemId}" was not found in the loaded project`);
    }

    const references = findItemReferences(project.bundle, command.itemId);
    if (references.length > 0) {
      const details = references
        .map((reference) => `${reference.documentId} (${describeItemReference(reference.use)})`)
        .join(", ");
      throw new Error(`Item "${command.itemId}" is still referenced by ${details}`);
    }

    const nextManifest: ProjectManifest = {
      ...project.bundle.manifest,
      items: project.bundle.manifest.items.filter((entry) => entry.id !== command.itemId)
    };

    assertDocument<ProjectManifest>("project", nextManifest);
    await writeJson(projectManifestPath(project), nextManifest);

    try {
      await unlink(itemPathFor(project, command.itemId));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  if (command.type === "asset/import") {
    const nextManifest = {
      ...project.bundle.manifest,
      assets: [...(project.bundle.manifest.assets ?? [])]
    };

    for (const asset of command.assets) {
      let contentSha256: string | undefined;
      try {
        contentSha256 = sha256(await readFile(safeProjectPath(project.directory, asset.filePath, `Asset file "${asset.id}"`)));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      const assetDocument: AssetDocument = {
        schemaVersion: 1,
        id: asset.id,
        kind: asset.kind,
        path: asset.filePath,
        source: asset.source,
        ...(contentSha256 ? { contentSha256 } : {}),
        ...(asset.generation ? { generation: asset.generation } : {})
      };
      assertDocument<AssetDocument>("asset", assetDocument);

      const existingReferenceIndex = nextManifest.assets.findIndex((entry) => entry.id === asset.id);
      const nextReference = {
        id: asset.id,
        path: asset.documentPath
      };

      if (existingReferenceIndex >= 0) {
        nextManifest.assets[existingReferenceIndex] = nextReference;
      } else {
        nextManifest.assets.push(nextReference);
      }

      await writeJson(assetDocumentPathFor(project.directory, asset.documentPath), assetDocument);
    }

    assertDocument<ProjectManifest>("project", nextManifest);
    await writeJson(projectManifestPath(project), nextManifest);
  }

  if (command.type === "asset/relink") {
    const asset = project.bundle.assets[command.assetId];
    if (!asset) {
      throw new Error(`Asset "${command.assetId}" was not found in the loaded project`);
    }

    const nextPath = command.patch.path.trim();
    if (!nextPath) {
      throw new Error("Asset path cannot be empty");
    }

    const nextAsset = patchAsset(asset, { path: nextPath });
    assertDocument<AssetDocument>("asset", nextAsset);
    await writeJson(assetPathFor(project, command.assetId), nextAsset);

    for (const scene of Object.values(project.bundle.scenes)) {
      if (scene.type !== "layered-2d" || scene.background !== asset.path) continue;
      const nextScene = replaceSceneBackground(scene, asset.path, nextPath);
      assertDocument<Layered2DScene>("layered2dScene", nextScene);
      await writeJson(scenePathFor(project, scene.id), nextScene);
    }
  }

  if (command.type === "asset/delete") {
    const asset = project.bundle.assets[command.assetId];
    if (!asset) {
      throw new Error(`Asset "${command.assetId}" was not found in the loaded project`);
    }

    const references = findAssetReferences(project.bundle, asset);
    if (references.length > 0) {
      throw new Error(
        `Asset "${command.assetId}" is still referenced by ${references
          .map((reference) => reference.documentId)
          .join(", ")}`
      );
    }

    const nextManifest: ProjectManifest = {
      ...project.bundle.manifest,
      assets: (project.bundle.manifest.assets ?? []).filter((entry) => entry.id !== command.assetId)
    };

    assertDocument<ProjectManifest>("project", nextManifest);
    await writeJson(projectManifestPath(project), nextManifest);

    try {
      await unlink(assetPathFor(project, command.assetId));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  if (command.type === "animation-pack/upsert") {
    const animationPack = command.patch.animationPack;
    assertDocument<AnimationPackDocument>("animationPack", animationPack);

    if (!project.bundle.assets[animationPack.assetId]) {
      throw new Error(`Animation pack "${animationPack.id}" references missing asset "${animationPack.assetId}"`);
    }

    const documentPath =
      command.patch.documentPath ??
      (project.bundle.animationPacks[animationPack.id]
        ? path.relative(project.directory, animationPackPathFor(project, animationPack.id)).replace(/\\/g, "/")
        : defaultAnimationPackDocumentPath(animationPack.id));

    const nextManifest = upsertAnimationPackManifestReference(project.bundle.manifest, animationPack, documentPath);
    assertDocument<ProjectManifest>("project", nextManifest);
    await writeJson(safeProjectPath(project.directory, documentPath, "Animation pack document path"), animationPack);
    await writeJson(projectManifestPath(project), nextManifest);
  }

  if (command.type === "prompt-pack/upsert") {
    const promptPack = command.patch.promptPack;
    assertDocument<PromptPackDocument>("promptPack", promptPack);

    if (!project.bundle.scenes[promptPack.sceneId]) {
      throw new Error(`Prompt pack "${promptPack.id}" references missing scene "${promptPack.sceneId}"`);
    }

    const documentPath =
      command.patch.documentPath ??
      (project.bundle.promptPacks[promptPack.id]
        ? path.relative(project.directory, promptPackPathFor(project, promptPack.id)).replace(/\\/g, "/")
        : defaultPromptPackDocumentPath(promptPack.id));

    const nextManifest = upsertPromptPackManifestReference(project.bundle.manifest, promptPack, documentPath);
    assertDocument<ProjectManifest>("project", nextManifest);
    await writeJson(safeProjectPath(project.directory, documentPath, "Prompt pack document path"), promptPack);
    await writeJson(projectManifestPath(project), nextManifest);
  }

  if (command.type === "workflow-template/upsert") {
    const workflowTemplate = command.patch.workflowTemplate;
    assertDocument<WorkflowTemplateDocument>("workflowTemplate", workflowTemplate);

    const documentPath =
      command.patch.documentPath ??
      (project.bundle.workflowTemplates[workflowTemplate.id]
        ? path.relative(project.directory, workflowTemplatePathFor(project, workflowTemplate.id)).replace(/\\/g, "/")
        : defaultWorkflowTemplateDocumentPath(workflowTemplate.id));

    const nextManifest = upsertWorkflowTemplateManifestReference(
      project.bundle.manifest,
      workflowTemplate,
      documentPath
    );
    assertDocument<ProjectManifest>("project", nextManifest);
    await writeJson(
      safeProjectPath(project.directory, documentPath, "Workflow template document path"),
      workflowTemplate
    );
    await writeJson(projectManifestPath(project), nextManifest);
  }

  if (command.type === "generation-recipe/upsert") {
    const generationRecipe = command.patch.generationRecipe;
    assertDocument<AssetGenerationRecipeDocument>("generationRecipe", generationRecipe);

    if (generationRecipe.sceneId && !project.bundle.scenes[generationRecipe.sceneId]) {
      throw new Error(`Generation recipe "${generationRecipe.id}" references missing scene "${generationRecipe.sceneId}"`);
    }
    if (generationRecipe.promptPackId && !project.bundle.promptPacks[generationRecipe.promptPackId]) {
      throw new Error(
        `Generation recipe "${generationRecipe.id}" references missing prompt pack "${generationRecipe.promptPackId}"`
      );
    }
    if (!project.bundle.workflowTemplates[generationRecipe.workflowId]) {
      throw new Error(
        `Generation recipe "${generationRecipe.id}" references missing workflow template "${generationRecipe.workflowId}"`
      );
    }

    const documentPath =
      command.patch.documentPath ??
      (project.bundle.generationRecipes[generationRecipe.id]
        ? path.relative(project.directory, generationRecipePathFor(project, generationRecipe.id)).replace(/\\/g, "/")
        : defaultGenerationRecipeDocumentPath(generationRecipe.id));

    const nextManifest = upsertGenerationRecipeManifestReference(
      project.bundle.manifest,
      generationRecipe,
      documentPath
    );
    assertDocument<ProjectManifest>("project", nextManifest);
    await writeJson(
      safeProjectPath(project.directory, documentPath, "Generation recipe document path"),
      generationRecipe
    );
    await writeJson(projectManifestPath(project), nextManifest);
  }

  return loadProjectFromDirectory(projectDirectory);
}

export async function applyProjectCommand(
  projectDirectory: string,
  command: EditorProjectCommand,
  options: ApplyProjectCommandOptions = {}
): Promise<LoadedProject> {
  const before = await loadProjectFromDirectory(projectDirectory);
  if (options.recordHistory !== false) {
    await initializeProjectHistory(before.directory, options.source ?? "editor");
  }
  const after = await applyProjectCommandWithoutHistory(before.directory, command);
  if (options.recordHistory !== false) {
    await recordProjectChange(before, after, command, options);
  }
  return after;
}

export * from "./migration";
