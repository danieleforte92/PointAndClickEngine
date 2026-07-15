import { copyFile, mkdir, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { safeProjectPath } from "./index";

export const PROJECT_SCHEMA_VERSION = 3 as const;

export type MigrationStatus = "dry-run" | "migrated" | "noop";

export interface MigrateProjectOptions {
  dryRun?: boolean;
  backupDirectory?: string;
}

export interface MigrateProjectResult {
  status: MigrationStatus;
  fromVersion: number;
  toVersion: number;
  changedFiles: string[];
  backupDirectory?: string;
}

interface MigrationBackupManifest {
  schemaVersion: 1;
  projectDirectory: string;
  files: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function projectDocumentPaths(projectDirectory: string, manifest: Record<string, unknown>): string[] {
  const paths = ["adventure.project.json"];
  const referenceCollections = [
    "scenes",
    "flows",
    "locales",
    "items",
    "assets",
    "promptPacks",
    "animationPacks",
    "styleBibles",
    "workflowTemplates",
    "generationRecipes"
  ];

  for (const collection of referenceCollections) {
    const references = manifest[collection];
    if (!Array.isArray(references)) continue;
    for (const reference of references) {
      if (!isRecord(reference) || typeof reference.path !== "string") {
        throw new Error(`Project manifest collection "${collection}" contains an invalid document reference.`);
      }
      const absolutePath = safeProjectPath(
        projectDirectory,
        reference.path,
        `Migration reference "${collection}"`
      );
      const relativePath = path.relative(projectDirectory, absolutePath).replaceAll(path.sep, "/");
      if (!paths.includes(relativePath)) paths.push(relativePath);
    }
  }

  return paths;
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

function migratedDocument(value: unknown, relativePath: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`Migration document "${relativePath}" must be a JSON object.`);
  }
  if (value.schemaVersion !== 1 && value.schemaVersion !== 2) {
    throw new Error(
      `Migration document "${relativePath}" has schema version ${String(value.schemaVersion)}; expected 1 or 2.`
    );
  }

  const next: Record<string, unknown> = { ...value, schemaVersion: PROJECT_SCHEMA_VERSION };
  if (Array.isArray(value.hotspots)) {
    next.hotspots = value.hotspots.map((hotspot) => {
      if (!isRecord(hotspot) || !isRecord(hotspot.bounds) || hotspot.shape !== undefined) return hotspot;
      return {
        ...hotspot,
        shape: {
          type: "rect",
          bounds: hotspot.bounds
        }
      };
    });
  }
  return next;
}

function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function atomicReplace(filePath: string, contents: string): Promise<void> {
  const temporaryPath = `${filePath}.migration-${randomUUID()}`;
  await writeFile(temporaryPath, contents, "utf8");
  try {
    await rename(temporaryPath, filePath);
  } catch (error) {
    if (!((error as NodeJS.ErrnoException).code === "EEXIST" || (error as NodeJS.ErrnoException).code === "EPERM")) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
    await unlink(filePath);
    await rename(temporaryPath, filePath);
  }
}

async function restoreBackup(
  projectDirectory: string,
  backupDirectory: string,
  files: readonly string[]
): Promise<void> {
  for (const relativePath of files) {
    const destination = safeProjectPath(projectDirectory, relativePath, "Rollback destination");
    const backupPath = path.join(backupDirectory, relativePath.split("/").join(path.sep));
    await atomicReplace(destination, await readFile(backupPath, "utf8"));
  }
}

export async function migrateProject(
  projectDirectory: string,
  options: MigrateProjectOptions = {}
): Promise<MigrateProjectResult> {
  const directory = path.resolve(projectDirectory);
  const manifestPath = safeProjectPath(directory, "adventure.project.json", "Project manifest");
  const manifest = await readJson(manifestPath);
  if (!isRecord(manifest) || typeof manifest.schemaVersion !== "number") {
    throw new Error("Project manifest does not declare a numeric schemaVersion.");
  }

  const fromVersion = manifest.schemaVersion;
  if (fromVersion === PROJECT_SCHEMA_VERSION) {
    return {
      status: "noop",
      fromVersion,
      toVersion: PROJECT_SCHEMA_VERSION,
      changedFiles: []
    };
  }
  if (fromVersion !== 1 && fromVersion !== 2) {
    throw new Error(`Unsupported project schema version ${fromVersion}; expected 1, 2 or ${PROJECT_SCHEMA_VERSION}.`);
  }

  const relativePaths = projectDocumentPaths(directory, manifest);
  const transformed = new Map<string, string>();
  for (const relativePath of relativePaths) {
    const absolutePath = safeProjectPath(directory, relativePath, "Migration document");
    const value = await readJson(absolutePath);
    transformed.set(relativePath, serializeJson(migratedDocument(value, relativePath)));
  }

  if (options.dryRun) {
    return {
      status: "dry-run",
      fromVersion,
      toVersion: PROJECT_SCHEMA_VERSION,
      changedFiles: relativePaths
    };
  }

  const migrationRoot = path.join(directory, ".pointclick", "migrations");
  const stagingDirectory = path.join(migrationRoot, `.staging-${randomUUID()}`);
  const backupDirectory = path.resolve(
    options.backupDirectory ?? path.join(migrationRoot, `backup-${new Date().toISOString().replaceAll(":", "-")}-${randomUUID()}`)
  );
  await mkdir(stagingDirectory, { recursive: true });
  await mkdir(backupDirectory, { recursive: true });

  try {
    for (const [relativePath, contents] of transformed) {
      const stagedPath = path.join(stagingDirectory, relativePath.split("/").join(path.sep));
      await mkdir(path.dirname(stagedPath), { recursive: true });
      await writeFile(stagedPath, contents, "utf8");

      const originalPath = safeProjectPath(directory, relativePath, "Migration source");
      const backupPath = path.join(backupDirectory, relativePath.split("/").join(path.sep));
      await mkdir(path.dirname(backupPath), { recursive: true });
      await copyFile(originalPath, backupPath);
    }

    const backupManifest: MigrationBackupManifest = {
      schemaVersion: 1,
      projectDirectory: directory,
      files: relativePaths
    };
    await writeFile(path.join(backupDirectory, "manifest.json"), serializeJson(backupManifest), "utf8");

    for (const relativePath of relativePaths) {
      const stagedPath = path.join(stagingDirectory, relativePath.split("/").join(path.sep));
      const destination = safeProjectPath(directory, relativePath, "Migration destination");
      await atomicReplace(destination, await readFile(stagedPath, "utf8"));
    }
  } catch (error) {
    try {
      await restoreBackup(directory, backupDirectory, relativePaths);
    } catch (rollbackError) {
      throw new Error(
        `Migration failed and automatic rollback also failed: ${
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
        }`
      );
    }
    throw error;
  } finally {
    await rm(stagingDirectory, { recursive: true, force: true });
  }

  return {
    status: "migrated",
    fromVersion,
    toVersion: PROJECT_SCHEMA_VERSION,
    changedFiles: relativePaths,
    backupDirectory
  };
}

export async function rollbackProjectMigration(
  projectDirectory: string,
  backupDirectory: string
): Promise<string[]> {
  const directory = path.resolve(projectDirectory);
  const backup = path.resolve(backupDirectory);
  const manifestPath = path.join(backup, "manifest.json");
  const manifest = await readJson(manifestPath);
  if (
    !isRecord(manifest) ||
    manifest.schemaVersion !== 1 ||
    !Array.isArray(manifest.files) ||
    !manifest.files.every((file) => typeof file === "string")
  ) {
    throw new Error(`Invalid migration backup manifest: ${manifestPath}`);
  }
  if (manifest.projectDirectory !== directory) {
    throw new Error("Migration backup belongs to a different project directory.");
  }

  const files = manifest.files as string[];
  await restoreBackup(directory, backup, files);
  return files;
}
