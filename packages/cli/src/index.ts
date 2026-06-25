#!/usr/bin/env node
import {
  loadProjectFromDirectory,
  validateProjectBundle,
  validateProjectFiles
} from "@pointclick/project-io";

async function validateProject(projectDirectory: string): Promise<void> {
  const loaded = await loadProjectFromDirectory(projectDirectory);
  const manifestValue = loaded.bundle.manifest;
  const diagnostics = [
    ...validateProjectBundle(loaded.bundle),
    ...(await validateProjectFiles(loaded))
  ];
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === "warning");

  for (const diagnostic of diagnostics) {
    const location = diagnostic.path ? ` ${diagnostic.path}` : "";
    console.log(`${diagnostic.severity.toUpperCase()} ${diagnostic.code}${location}: ${diagnostic.message}`);
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid project "${manifestValue.title}": ${errors.length} error(s), ${warnings.length} warning(s).`
    );
  }

  console.log(
    `Valid project "${manifestValue.title}": ${manifestValue.scenes.length} scene(s), ` +
      `${manifestValue.flows.length} flow(s), ${manifestValue.locales.length} locale(s), ` +
      `${warnings.length} warning(s).`
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
