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
  type SceneDocument,
  type Vector2
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

export interface ScenePatch {
  background: string;
  name: string;
  playerStart: Vector2;
  walkArea: Rect;
}

export interface LocaleUpsertPatch {
  key: string;
  value: string;
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

export type LocaleUpsertCommand = {
  type: "locale/upsert";
  locale: string;
  patch: LocaleUpsertPatch;
};

export type EditorProjectCommand =
  | HotspotUpdateCommand
  | SceneUpdateCommand
  | LocaleUpsertCommand;

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

function localePathFor(project: LoadedProject, locale: string): string {
  const reference = project.bundle.manifest.locales.find((entry) => entry.locale === locale);
  if (!reference) {
    throw new Error(`Locale "${locale}" is not referenced by the project manifest`);
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

function patchScene(scene: Layered2DScene, patch: ScenePatch): Layered2DScene {
  return {
    ...scene,
    background: patch.background,
    name: patch.name,
    playerStart: patch.playerStart,
    walkArea: patch.walkArea
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

  return loadProjectFromDirectory(projectDirectory);
}
