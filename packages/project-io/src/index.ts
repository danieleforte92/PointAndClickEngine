import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  assertDocument,
  type FlowDocument,
  type LocaleDocument,
  type ProjectBundle,
  type ProjectManifest,
  type SceneDocument
} from "@pointclick/contracts";

export interface LoadedProject {
  directory: string;
  bundle: ProjectBundle;
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
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

