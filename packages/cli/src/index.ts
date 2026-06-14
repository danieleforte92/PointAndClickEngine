#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  assertDocument,
  type FlowDocument,
  type LocaleDocument,
  type ProjectManifest,
  type SceneDocument
} from "@pointclick/contracts";

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

async function validateProject(projectDirectory: string): Promise<void> {
  const manifestPath = path.resolve(projectDirectory, "adventure.project.json");
  const manifestValue = await readJson(manifestPath);
  assertDocument<ProjectManifest>("project", manifestValue);

  for (const reference of manifestValue.scenes) {
    const value = await readJson(path.resolve(projectDirectory, reference.path));
    assertDocument<SceneDocument>("scene", value);
    if (value.id !== reference.id) {
      throw new Error(`Scene reference "${reference.id}" points to document "${value.id}"`);
    }
  }

  for (const reference of manifestValue.flows) {
    const value = await readJson(path.resolve(projectDirectory, reference.path));
    assertDocument<FlowDocument>("flow", value);
    if (value.id !== reference.id) {
      throw new Error(`Flow reference "${reference.id}" points to document "${value.id}"`);
    }
  }

  for (const reference of manifestValue.locales) {
    const value = await readJson(path.resolve(projectDirectory, reference.path));
    assertDocument<LocaleDocument>("locale", value);
    if (value.locale !== reference.locale) {
      throw new Error(`Locale reference "${reference.locale}" points to document "${value.locale}"`);
    }
  }

  console.log(
    `Valid project "${manifestValue.title}": ${manifestValue.scenes.length} scene(s), ` +
      `${manifestValue.flows.length} flow(s), ${manifestValue.locales.length} locale(s).`
  );
}

async function main(): Promise<void> {
  const [, , command, projectDirectory] = process.argv;
  if (command !== "validate" || !projectDirectory) {
    console.error("Usage: pointclick validate <project-directory>");
    process.exitCode = 1;
    return;
  }
  await validateProject(projectDirectory);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
