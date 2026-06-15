import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assertDocument,
  type CursorValue,
  type FlowDocument,
  type FlowNode,
  type Hotspot,
  type HotspotActions,
  type ItemDocument,
  type LocaleDocument,
  type Layered2DScene,
  type Polygon2,
  type ProjectBundle,
  type ProjectManifest,
  type Rect,
  type ScenePickup,
  type SceneDocument,
  type Vector2
} from "@pointclick/contracts";

export interface LoadedProject {
  directory: string;
  bundle: ProjectBundle;
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
  labelKey: string;
}

export interface PickupPatch {
  bounds: Rect;
  itemId: string;
  labelKey: string;
  pickupFlowId?: string;
}

export interface ScenePatch {
  background: string;
  name: string;
  playerStart: Vector2;
  walkArea: Polygon2;
}

export interface ItemPatch {
  labelKey: string;
  name: string;
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

export type HotspotUpdateCommand = {
  type: "hotspot/update";
  hotspotId: string;
  patch: HotspotPatch;
  sceneId: string;
};

export type SceneUpdateCommand = {
  type: "scene/update";
  patch: ScenePatch;
  sceneId: string;
};

export type PickupUpdateCommand = {
  type: "pickup/update";
  pickupId: string;
  patch: PickupPatch;
  sceneId: string;
};

export type LocaleUpsertCommand = {
  type: "locale/upsert";
  locale: string;
  patch: LocaleUpsertPatch;
};

export type FlowUpdateCommand = {
  type: "flow/update";
  flowId: string;
  patch: FlowPatch;
};

export type ItemUpdateCommand = {
  type: "item/update";
  itemId: string;
  patch: ItemPatch;
};

export type EditorProjectCommand =
  | HotspotUpdateCommand
  | SceneUpdateCommand
  | PickupUpdateCommand
  | LocaleUpsertCommand
  | FlowUpdateCommand
  | ItemUpdateCommand;

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

  for (const scene of Object.values(bundle.scenes)) {
    if (scene.type !== "layered-2d") continue;

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
    const value = await readJson(path.resolve(directory, reference.path));
    assertDocument<SceneDocument>("scene", value);
    if (value.id !== reference.id) {
      throw new Error(`Scene reference "${reference.id}" points to document "${value.id}"`);
    }
    scenes[value.id] = value;
  }

  const flows: Record<string, FlowDocument> = {};
  for (const reference of manifestValue.flows) {
    const value = await readJson(path.resolve(directory, reference.path));
    assertDocument<FlowDocument>("flow", value);
    if (value.id !== reference.id) {
      throw new Error(`Flow reference "${reference.id}" points to document "${value.id}"`);
    }
    flows[value.id] = value;
  }

  const locales: Record<string, LocaleDocument> = {};
  for (const reference of manifestValue.locales) {
    const value = await readJson(path.resolve(directory, reference.path));
    assertDocument<LocaleDocument>("locale", value);
    if (value.locale !== reference.locale) {
      throw new Error(`Locale reference "${reference.locale}" points to document "${value.locale}"`);
    }
    locales[value.locale] = value;
  }

  const items: Record<string, ItemDocument> = {};
  for (const reference of manifestValue.items) {
    const value = await readJson(path.resolve(directory, reference.path));
    assertDocument<ItemDocument>("item", value);
    if (value.id !== reference.id) {
      throw new Error(`Item reference "${reference.id}" points to document "${value.id}"`);
    }
    items[value.id] = value;
  }

  return {
    directory,
    bundle: {
      manifest: manifestValue,
      scenes,
      flows,
      locales,
      items
    }
  };
}

function scenePathFor(project: LoadedProject, sceneId: string): string {
  const reference = project.bundle.manifest.scenes.find((scene) => scene.id === sceneId);
  if (!reference) {
    throw new Error(`Scene "${sceneId}" is not referenced by the project manifest`);
  }
  return path.resolve(project.directory, reference.path);
}

function localePathFor(project: LoadedProject, locale: string): string {
  const reference = project.bundle.manifest.locales.find((entry) => entry.locale === locale);
  if (!reference) {
    throw new Error(`Locale "${locale}" is not referenced by the project manifest`);
  }
  return path.resolve(project.directory, reference.path);
}

function flowPathFor(project: LoadedProject, flowId: string): string {
  const reference = project.bundle.manifest.flows.find((entry) => entry.id === flowId);
  if (!reference) {
    throw new Error(`Flow "${flowId}" is not referenced by the project manifest`);
  }
  return path.resolve(project.directory, reference.path);
}

function itemPathFor(project: LoadedProject, itemId: string): string {
  const reference = project.bundle.manifest.items.find((entry) => entry.id === itemId);
  if (!reference) {
    throw new Error(`Item "${itemId}" is not referenced by the project manifest`);
  }
  return path.resolve(project.directory, reference.path);
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

function patchScene(scene: Layered2DScene, patch: ScenePatch): Layered2DScene {
  return {
    ...scene,
    background: patch.background,
    name: patch.name,
    playerStart: patch.playerStart,
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

function patchLocale(locale: LocaleDocument, patch: LocaleUpsertPatch): LocaleDocument {
  return {
    ...locale,
    strings: {
      ...locale.strings,
      [patch.key]: patch.value
    }
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
    if (!seen.has(node.next)) {
      throw new Error(`Flow "${flow.id}" node "${node.id}" points to missing next "${node.next}"`);
    }
  }

  if (!hasEnd) {
    throw new Error(`Flow "${flow.id}" must contain at least one end node`);
  }
}

export async function applyProjectCommand(
  projectDirectory: string,
  command: EditorProjectCommand
): Promise<LoadedProject> {
  const project = await loadProjectFromDirectory(projectDirectory);

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

  if (command.type === "item/update") {
    const item = project.bundle.items[command.itemId];
    if (!item) {
      throw new Error(`Item "${command.itemId}" was not found in the loaded project`);
    }

    const nextItem = patchItem(item, command.patch);
    assertDocument<ItemDocument>("item", nextItem);
    await writeJson(itemPathFor(project, command.itemId), nextItem);
  }

  return loadProjectFromDirectory(projectDirectory);
}
