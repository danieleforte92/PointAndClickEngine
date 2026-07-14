#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  diffProjectDirectories,
  initializeProjectHistory,
  loadProjectHistory,
  loadProjectFromDirectory,
  migrateProject,
  rollbackProjectMigration,
  validateProjectBundle,
  validateProjectFiles
} from "@pointclick/project-io";
import { exportWeb } from "@pointclick/web-export";

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

async function listHistory(projectDirectory: string): Promise<void> {
  const history = await loadProjectHistory(projectDirectory);
  if (history.records.length === 0) {
    console.log("No project history records. Run pointclick history init <project-directory>.");
    return;
  }
  for (const record of history.records) {
    console.log(
      `${String(record.sequence).padStart(6, "0")} ${record.createdAt} ${record.scope} ${record.operation}: ${record.summary}`
    );
  }
}

async function initializeHistory(projectDirectory: string): Promise<void> {
  const history = await initializeProjectHistory(projectDirectory, "cli");
  console.log(`Project history ready: ${history.records.length} record(s) in ${history.directory}`);
}

async function diffProjects(leftProjectDirectory: string, rightProjectDirectory: string): Promise<void> {
  const diff = await diffProjectDirectories(leftProjectDirectory, rightProjectDirectory);
  if (diff.changedDocuments.length === 0) {
    console.log("No semantic project document changes.");
    return;
  }
  for (const document of diff.changedDocuments) {
    const state = !document.beforeSha256 ? "added" : !document.afterSha256 ? "removed" : "changed";
    console.log(`${state.toUpperCase()} ${document.kind}${document.id ? ` ${document.id}` : ""}: ${document.path}`);
  }
}

async function showImpact(projectDirectory: string, changeId: string): Promise<void> {
  const history = await loadProjectHistory(projectDirectory);
  const record = history.records.find((candidate) => candidate.id === changeId || String(candidate.sequence) === changeId);
  if (!record) throw new Error(`History record "${changeId}" was not found.`);
  console.log(`${record.summary} (${record.scope}, ${record.operation})`);
  for (const document of record.affectedDocuments) {
    console.log(`- ${document.kind}${document.id ? ` ${document.id}` : ""}: ${document.path}`);
  }
}

function optionValue(argumentsList: string[], name: string): string | undefined {
  const index = argumentsList.indexOf(name);
  if (index < 0) return undefined;
  const value = argumentsList[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function optionValues(argumentsList: string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < argumentsList.length; index += 1) {
    if (argumentsList[index] !== name) continue;
    const value = argumentsList[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
    values.push(value);
    index += 1;
  }
  return values;
}

async function migrate(projectDirectory: string, argumentsList: string[]): Promise<void> {
  const rollbackDirectory = optionValue(argumentsList, "--rollback");
  if (rollbackDirectory) {
    const files = await rollbackProjectMigration(projectDirectory, rollbackDirectory);
    console.log(`Migration rollback restored ${files.length} file(s) from ${rollbackDirectory}.`);
    return;
  }

  const backupDirectory = optionValue(argumentsList, "--backup-dir");
  const result = await migrateProject(projectDirectory, {
    ...(argumentsList.includes("--dry-run") ? { dryRun: true } : {}),
    ...(backupDirectory ? { backupDirectory } : {})
  });
  if (result.status === "noop") {
    console.log(`Project is already at schema v${result.toVersion}.`);
    return;
  }
  const prefix = result.status === "dry-run" ? "Migration dry-run" : "Migrated project";
  console.log(`${prefix}: v${result.fromVersion} → v${result.toVersion}; ${result.changedFiles.length} file(s).`);
  if (result.backupDirectory) console.log(`Backup: ${result.backupDirectory}`);
  for (const file of result.changedFiles) console.log(`- ${file}`);
}

async function exportWebProject(projectDirectory: string, argumentsList: string[]): Promise<void> {
  const entrypoint = optionValue(argumentsList, "--entrypoint");
  const output = optionValue(argumentsList, "--output");
  if (!entrypoint || !output) {
    throw new Error("export web requires --entrypoint <file> and --output <directory>.");
  }
  const project = await loadProjectFromDirectory(projectDirectory);
  const entrypointContents = await readFile(path.resolve(process.cwd(), entrypoint), "utf8");
  const requestedAssets = optionValues(argumentsList, "--asset");
  const assets = requestedAssets.length > 0
    ? requestedAssets
    : Object.values(project.bundle.assets).map((asset) => asset.path);
  const result = await exportWeb({
    projectDirectory: project.directory,
    outputDirectory: output,
    browserEntrypoint: { contents: entrypointContents },
    assets: assets.map((sourcePath) => ({ sourcePath }))
  });
  console.log(`Web export written to ${result.outputDirectory}.`);
  console.log(`Entrypoint: ${result.entrypointOutputPath}; assets: ${result.assets.length}.`);
}

async function main(): Promise<void> {
  const [, , command, ...argumentsList] = process.argv;
  if (command === "validate" && argumentsList[0]) return validateProject(argumentsList[0]);
  if (command === "history" && argumentsList[0] === "init" && argumentsList[1]) return initializeHistory(argumentsList[1]);
  if (command === "history" && argumentsList[0] === "list" && argumentsList[1]) return listHistory(argumentsList[1]);
  if (command === "diff" && argumentsList[0] && argumentsList[1]) return diffProjects(argumentsList[0], argumentsList[1]);
  if (command === "impact" && argumentsList[0] && argumentsList[1]) return showImpact(argumentsList[0], argumentsList[1]);
  if (command === "migrate" && argumentsList[0]) return migrate(argumentsList[0], argumentsList.slice(1));
  if (command === "export" && argumentsList[0] === "web" && argumentsList[1]) {
    return exportWebProject(argumentsList[1], argumentsList.slice(2));
  }

  console.error(
    "Usage: pointclick validate <project-directory> | migrate <project-directory> [--dry-run] [--backup-dir <directory>] | migrate <project-directory> --rollback <backup-directory> | export web <project-directory> --entrypoint <file> --output <directory> [--asset <path>] | history <init|list> <project-directory> | diff <left-project> <right-project> | impact <project-directory> <change-id>"
  );
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
