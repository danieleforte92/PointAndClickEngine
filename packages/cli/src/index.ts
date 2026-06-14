#!/usr/bin/env node
import { loadProjectFromDirectory } from "@pointclick/project-io";

async function validateProject(projectDirectory: string): Promise<void> {
  const loaded = await loadProjectFromDirectory(projectDirectory);
  const manifestValue = loaded.bundle.manifest;

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
