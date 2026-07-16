import { cp, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  loadProjectFromDirectory,
  migrateProject,
  rollbackProjectMigration
} from "./index";

async function fixtureProject(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pointclick-migration-"));
  const source = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
  const destination = path.join(root, "project");
  await cp(source, destination, { recursive: true });
  return destination;
}

describe("project schema migration", () => {
  it("supports a dry-run without changing project files", async () => {
    const projectDirectory = await fixtureProject();
    const manifestPath = path.join(projectDirectory, "adventure.project.json");
    const before = await readFile(manifestPath, "utf8");

    const result = await migrateProject(projectDirectory, { dryRun: true });

    expect(result.status).toBe("dry-run");
    expect(result.changedFiles).toContain("adventure.project.json");
    expect(await readFile(manifestPath, "utf8")).toBe(before);
  });

  it("migrates all referenced documents idempotently and can roll back", async () => {
    const projectDirectory = await fixtureProject();

    const result = await migrateProject(projectDirectory);
    expect(result.status).toBe("migrated");
    expect(result.backupDirectory).toBeTruthy();

    for (const relativePath of result.changedFiles) {
      const value = JSON.parse(
        await readFile(path.join(projectDirectory, relativePath), "utf8")
      ) as { schemaVersion: number };
      expect(value.schemaVersion).toBe(3);
    }
    await expect(loadProjectFromDirectory(projectDirectory)).resolves.toBeTruthy();

    await expect(migrateProject(projectDirectory)).resolves.toMatchObject({
      status: "noop",
      fromVersion: 3,
      changedFiles: []
    });

    if (!result.backupDirectory) throw new Error("Expected migration backup");
    const restoredFiles = await rollbackProjectMigration(projectDirectory, result.backupDirectory);
    expect(restoredFiles).toEqual(result.changedFiles);
    expect(JSON.parse(await readFile(path.join(projectDirectory, "adventure.project.json"), "utf8"))).toMatchObject({
      schemaVersion: 1
    });
    await expect(loadProjectFromDirectory(projectDirectory)).resolves.toBeTruthy();
  });
});
