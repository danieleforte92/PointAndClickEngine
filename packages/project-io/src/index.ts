import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assertDocument,
  type CursorValue,
  type FlowDocument,
  type Hotspot,
  type LocaleDocument,
  type Layered2DScene,
  type ProjectBundle,
  type ProjectManifest,
  type Rect,
  type SceneDocument
} from "@pointclick/contracts";

export interface LoadedProject {
  directory: string;
  bundle: ProjectBundle;
}

export interface HotspotPatch {
  actionFlowId: string;
  bounds: Rect;
  cursor?: CursorValue;
  labelKey: string;
}

export type EditorProjectCommand = {
  type: "hotspot/update";
  hotspotId: string;
  patch: HotspotPatch;
  sceneId: string;
};

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

  return {
    directory,
    bundle: {
      manifest: manifestValue,
      scenes,
      flows,
      locales
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

function patchHotspot(scene: Layered2DScene, hotspotId: string, patch: HotspotPatch): Layered2DScene {
  const index = scene.hotspots.findIndex((hotspot) => hotspot.id === hotspotId);
  if (index < 0) {
    throw new Error(`Hotspot "${hotspotId}" was not found in scene "${scene.id}"`);
  }

  const currentHotspot = scene.hotspots[index]!;
  const nextHotspot: Hotspot = {
    ...currentHotspot,
    actionFlowId: patch.actionFlowId,
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

  return loadProjectFromDirectory(projectDirectory);
}
