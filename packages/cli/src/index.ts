#!/usr/bin/env node
import {
  diffProjectDirectories,
  initializeProjectHistory,
  loadProjectHistory,
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

async function main(): Promise<void> {
  const [, , command, ...argumentsList] = process.argv;
  if (command === "validate" && argumentsList[0]) return validateProject(argumentsList[0]);
  if (command === "history" && argumentsList[0] === "init" && argumentsList[1]) return initializeHistory(argumentsList[1]);
  if (command === "history" && argumentsList[0] === "list" && argumentsList[1]) return listHistory(argumentsList[1]);
  if (command === "diff" && argumentsList[0] && argumentsList[1]) return diffProjects(argumentsList[0], argumentsList[1]);
  if (command === "impact" && argumentsList[0] && argumentsList[1]) return showImpact(argumentsList[0], argumentsList[1]);

  console.error(
    "Usage: pointclick validate <project-directory> | history <init|list> <project-directory> | diff <left-project> <right-project> | impact <project-directory> <change-id>"
  );
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
