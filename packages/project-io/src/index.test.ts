import { cp, mkdtemp, mkdir, readFile, readdir, stat, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyProjectCommand,
  atomicWriteFile,
  createBlankProject,
  createProjectFromTemplate,
  diffProjectDirectories,
  initializeProjectHistory,
  loadProjectHistory,
  loadProjectFromDirectory,
  safeProjectPath,
  serializeJsonDocument,
  validateProjectBundle,
  validateProjectFiles
} from "./index";

describe("project creation", () => {
  it("creates a valid blank project in an empty directory", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "blank-adventure");

    const loaded = await createBlankProject(projectRoot, {
      title: "Blank Adventure"
    });

    expect(loaded.directory).toBe(path.resolve(projectRoot));
    expect(loaded.bundle.manifest).toMatchObject({
      id: "blank-adventure",
      title: "Blank Adventure",
      initialSceneId: "start",
      defaultLocale: "en"
    });
    expect(loaded.bundle.scenes.start?.type).toBe("layered-2d");
    expect(Object.keys(loaded.bundle.locales)).toEqual(["en"]);
    expect(validateProjectBundle(loaded.bundle)).toEqual([]);
    expect(await validateProjectFiles(loaded)).toEqual([]);
  });

  it("copies a valid template project into an empty directory", async () => {
    const templateRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "from-template");

    const loaded = await createProjectFromTemplate(templateRoot, projectRoot);

    expect(loaded.bundle.manifest.title).toBe("The Isle of Echoes");
    expect(Object.keys(loaded.bundle.scenes)).toContain("moonlit-dock");
    expect(await validateProjectFiles(loaded)).toEqual([]);
  });

  it("does not create a project over existing files", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "occupied");
    await mkdir(projectRoot, { recursive: true });
    await writeFile(path.join(projectRoot, "notes.txt"), "keep me", "utf8");

    await expect(createBlankProject(projectRoot)).rejects.toThrow("must be empty");
  });
});

describe("project document persistence", () => {
  it("serializes the same document deterministically and atomically replaces it", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const documentPath = path.join(tempRoot, "document.json");
    const document = { id: "stable", nested: { enabled: true }, schemaVersion: 1 };

    const firstSerialization = serializeJsonDocument(document);
    const secondSerialization = serializeJsonDocument(document);
    expect(secondSerialization).toBe(firstSerialization);

    await atomicWriteFile(documentPath, firstSerialization);
    expect(await readFile(documentPath, "utf8")).toBe(firstSerialization);
    expect((await readdir(tempRoot)).filter((entry) => entry.startsWith("document.json.tmp-"))).toEqual([]);
  });

  it("preserves the prior document and removes its temporary file when replacement fails", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const documentPath = path.join(tempRoot, "document.json");
    const temporaryPath = path.join(tempRoot, "document.json.test-tmp");
    await writeFile(documentPath, "before\n", "utf8");

    await expect(
      atomicWriteFile(documentPath, "after\n", {
        temporaryPath,
        operations: {
          ensureDirectory: async (directory) => {
            await mkdir(directory, { recursive: true });
          },
          removeFile: async (filePath) => {
            await unlink(filePath);
          },
          replaceFile: async () => {
            throw new Error("simulated replacement failure");
          },
          writeFile: async (filePath, contents) => {
            await writeFile(filePath, contents, "utf8");
          }
        }
      })
    ).rejects.toThrow("simulated replacement failure");

    expect(await readFile(documentPath, "utf8")).toBe("before\n");
    await expect(stat(temporaryPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("ignores an unreferenced document left before a manifest update", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");
    await cp(fixtureRoot, projectRoot, { recursive: true });
    await writeFile(
      path.join(projectRoot, "scenes", "interrupted.scene.json"),
      serializeJsonDocument({ id: "interrupted", schemaVersion: 1, type: "placeholder" }),
      "utf8"
    );

    const loaded = await loadProjectFromDirectory(projectRoot);
    expect(loaded.bundle.scenes.interrupted).toBeUndefined();
  });
});

describe("project history", () => {
  it("creates a baseline and records the semantic documents changed by an edit", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-history-"));
    const projectRoot = path.join(tempRoot, "project");
    await cp(fixtureRoot, projectRoot, { recursive: true });

    await initializeProjectHistory(projectRoot, "cli");
    await applyProjectCommand(projectRoot, {
      type: "project/update-settings",
      patch: {
        defaultLocale: "en",
        initialSceneId: "new-scene",
        title: "History Updated Adventure",
        viewport: { height: 720, width: 1280 }
      }
    });

    const history = await loadProjectHistory(projectRoot);
    expect(history.records).toHaveLength(2);
    const change = history.records[1];
    expect(change).toMatchObject({
      operation: "project/update-settings",
      scope: "project",
      source: "editor"
    });
    expect(change?.affectedDocuments).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "project", path: "adventure.project.json" })])
    );
  });

  it("reports semantic document differences between project directories", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-diff-"));
    const left = path.join(tempRoot, "left");
    const right = path.join(tempRoot, "right");
    await cp(fixtureRoot, left, { recursive: true });
    await cp(fixtureRoot, right, { recursive: true });
    await applyProjectCommand(right, {
      type: "project/update-settings",
      patch: {
        defaultLocale: "en",
        initialSceneId: "moonlit-dock",
        title: "Right Side",
        viewport: { height: 720, width: 1280 }
      }
    });

    const diff = await diffProjectDirectories(left, right);
    expect(diff.changedDocuments).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "project", path: "adventure.project.json" })])
    );
  });
});

describe("project settings", () => {
  it("updates manifest settings on disk", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    const updated = await applyProjectCommand(projectRoot, {
      type: "project/update-settings",
      patch: {
        defaultLocale: "en",
        initialSceneId: "new-scene",
        title: "Updated Adventure",
        viewport: {
          height: 768,
          width: 1366
        }
      }
    });

    expect(updated.bundle.manifest).toMatchObject({
      defaultLocale: "en",
      initialSceneId: "new-scene",
      title: "Updated Adventure",
      viewport: {
        height: 768,
        width: 1366
      }
    });

    const manifest = JSON.parse(
      await readFile(path.join(projectRoot, "adventure.project.json"), "utf8")
    ) as {
      defaultLocale: string;
      initialSceneId: string;
      title: string;
      viewport: { height: number; width: number };
    };
    expect(manifest.title).toBe("Updated Adventure");
    expect(manifest.initialSceneId).toBe("new-scene");
    expect(manifest.defaultLocale).toBe("en");
    expect(manifest.viewport).toEqual({ height: 768, width: 1366 });
  });

  it("rejects project settings that point to missing documents", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    await expect(
      applyProjectCommand(projectRoot, {
        type: "project/update-settings",
        patch: {
          defaultLocale: "it",
          initialSceneId: "missing-scene",
          title: "Updated Adventure",
          viewport: {
            height: 720,
            width: 1280
          }
        }
      })
    ).rejects.toThrow('Initial scene "missing-scene" was not found in the loaded project');
  });
});

describe("loadProjectFromDirectory", () => {
  it("loads the sample project bundle from disk", async () => {
    const loaded = await loadProjectFromDirectory(
      path.resolve(import.meta.dirname, "../../../apps/sample-game/project")
    );

    expect(loaded.bundle.manifest.title).toBe("The Isle of Echoes");
    expect(Object.keys(loaded.bundle.scenes)).toContain("moonlit-dock");
    expect(loaded.bundle.scenes["moonlit-dock"]?.type).toBe("layered-2d");
    expect(Object.keys(loaded.bundle.promptPacks)).toContain("moonlit-dock-art");
    expect(Object.keys(loaded.bundle.animationPacks)).toContain("mara");
  });

  it("rejects manifest references outside the project directory", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");
    await mkdir(projectRoot, { recursive: true });
    await writeFile(
      path.join(tempRoot, "outside.scene.json"),
      JSON.stringify({
        schemaVersion: 1,
        id: "outside",
        name: "Outside",
        type: "layered-2d",
        size: { width: 1280, height: 720 },
        background: "#24384a",
        playerStart: { x: 640, y: 576 },
        walkArea: {
          points: [
            { x: 0, y: 0 },
            { x: 1280, y: 0 },
            { x: 1280, y: 720 }
          ]
        },
        actors: [],
        pickups: [],
        shapes: [],
        hotspots: []
      }),
      "utf8"
    );
    await writeFile(
      path.join(projectRoot, "adventure.project.json"),
      JSON.stringify({
        schemaVersion: 1,
        id: "bad-project",
        title: "Bad Project",
        initialSceneId: "outside",
        defaultLocale: "en",
        viewport: { width: 1280, height: 720 },
        scenes: [{ id: "outside", path: "../outside.scene.json" }],
        flows: [],
        items: [],
        locales: [{ locale: "en", path: "locales/en.json" }]
      }),
      "utf8"
    );

    await expect(loadProjectFromDirectory(projectRoot)).rejects.toThrow("outside the project");
  });

  it("rejects preview-style asset path traversal", () => {
    const projectRoot = path.resolve("apps/sample-game/project");
    expect(() => safeProjectPath(projectRoot, "../secret.png", "Preview asset path")).toThrow(
      "outside the project"
    );
  });

  it("rejects Comfy workflow absolute and outside-project paths", () => {
    const projectRoot = path.resolve("apps/sample-game/project");
    expect(() =>
      safeProjectPath(projectRoot, path.resolve(projectRoot, "workflow.json"), "ComfyUI workflow path")
    ).toThrow("must be relative");
    expect(() => safeProjectPath(projectRoot, "../workflow.json", "ComfyUI workflow path")).toThrow(
      "outside the project"
    );
  });

  it("rejects existing paths that escape through a symbolic link while allowing new in-project paths", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");
    const outsideRoot = path.join(tempRoot, "outside");
    await mkdir(projectRoot, { recursive: true });
    await mkdir(outsideRoot, { recursive: true });

    try {
      await symlink(outsideRoot, path.join(projectRoot, "linked"), "junction");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EACCES") return;
      throw error;
    }

    expect(() => safeProjectPath(projectRoot, "linked/secret.json", "Asset path")).toThrow(
      "resolves outside the project through a symbolic link"
    );
    expect(safeProjectPath(projectRoot, "new/nested/document.json", "Asset path")).toBe(
      path.join(projectRoot, "new", "nested", "document.json")
    );
  });

  it("persists hotspot edits back to the scene document", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    const updated = await applyProjectCommand(projectRoot, {
      type: "hotspot/update",
      hotspotId: "tavern-entrance",
      patch: {
        actions: {
          lookFlowId: "look-tavern-door",
          talkFlowId: "talk-tavern-door",
          useFlowId: "look-tavern-door",
          useItemFlows: [
            {
              itemId: "rusty-hook",
              flowId: "use-rusty-hook-on-door"
            }
          ]
        },
        bounds: {
          x: 840,
          y: 330,
          width: 140,
          height: 225
        },
        cursor: "enter",
        interactSpot: {
          x: 890,
          y: 585
        },
        labelKey: "hotspot.tavern-entrance-updated",
        lookSpot: {
          x: 900,
          y: 350
        }
      },
      sceneId: "moonlit-dock"
    });

    const scene = updated.bundle.scenes["moonlit-dock"];
    expect(scene?.type).toBe("layered-2d");
    if (!scene || scene.type !== "layered-2d") {
      throw new Error("Expected layered 2D scene");
    }

    const hotspot = scene.hotspots.find((entry) => entry.id === "tavern-entrance");
    expect(hotspot).toMatchObject({
      actions: {
        lookFlowId: "look-tavern-door",
        talkFlowId: "talk-tavern-door",
        useFlowId: "look-tavern-door"
      },
      bounds: {
        x: 840,
        y: 330,
        width: 140,
        height: 225
      },
      cursor: "enter",
      interactSpot: {
        x: 890,
        y: 585
      },
      labelKey: "hotspot.tavern-entrance-updated",
      lookSpot: {
        x: 900,
        y: 350
      }
    });

    const scenePath = path.join(projectRoot, "scenes", "moonlit-dock.scene.json");
    const sceneFile = JSON.parse(await readFile(scenePath, "utf8")) as {
      hotspots: Array<{ id: string; labelKey: string }>;
    };
    expect(sceneFile.hotspots.find((entry) => entry.id === "tavern-entrance")?.labelKey).toBe(
      "hotspot.tavern-entrance-updated"
    );
  });

  it("creates a new hotspot in the scene document", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    const updated = await applyProjectCommand(projectRoot, {
      type: "hotspot/create",
      hotspot: {
        actions: {
          useItemFlows: []
        },
        bounds: {
          x: 420,
          y: 320,
          width: 160,
          height: 120
        },
        id: "harbor-sign",
        labelKey: "hotspot.harbor-sign"
      },
      sceneId: "moonlit-dock"
    });

    const scene = updated.bundle.scenes["moonlit-dock"];
    expect(scene?.type).toBe("layered-2d");
    if (!scene || scene.type !== "layered-2d") {
      throw new Error("Expected layered 2D scene");
    }

    expect(scene.hotspots.some((entry) => entry.id === "harbor-sign")).toBe(true);

    const sceneFile = JSON.parse(
      await readFile(path.join(projectRoot, "scenes", "moonlit-dock.scene.json"), "utf8")
    ) as { hotspots: Array<{ id: string }> };
    expect(sceneFile.hotspots.some((entry) => entry.id === "harbor-sign")).toBe(true);
  });

  it("deletes a hotspot from the scene document", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    const updated = await applyProjectCommand(projectRoot, {
      type: "hotspot/delete",
      hotspotId: "tavern-entrance",
      sceneId: "moonlit-dock"
    });

    const scene = updated.bundle.scenes["moonlit-dock"];
    expect(scene?.type).toBe("layered-2d");
    if (!scene || scene.type !== "layered-2d") {
      throw new Error("Expected layered 2D scene");
    }

    expect(scene.hotspots.some((entry) => entry.id === "tavern-entrance")).toBe(false);
  });

  it("creates, updates, and deletes actors in the scene document", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    const created = await applyProjectCommand(projectRoot, {
      type: "actor/create",
      actor: {
        actions: {
          lookFlowId: "look-tavern-door",
          useItemFlows: []
        },
        bounds: {
          x: 500,
          y: 350,
          width: 120,
          height: 90
        },
        depth: 12,
        id: "desk-drawer",
        interactSpot: {
          x: 560,
          y: 470
        },
        labelKey: "actor.desk-drawer",
        role: "prop"
      },
      sceneId: "moonlit-dock"
    });

    const createdScene = created.bundle.scenes["moonlit-dock"];
    expect(createdScene?.type).toBe("layered-2d");
    if (!createdScene || createdScene.type !== "layered-2d") {
      throw new Error("Expected layered 2D scene");
    }
    expect(createdScene.actors.some((entry) => entry.id === "desk-drawer")).toBe(true);

    const updated = await applyProjectCommand(projectRoot, {
      type: "actor/update",
      actorId: "desk-drawer",
      patch: {
        actions: {
          talkFlowId: "talk-tavern-door",
          useItemFlows: []
        },
        bounds: {
          x: 510,
          y: 360,
          width: 130,
          height: 95
        },
        depth: 18,
        id: "desk-drawer",
        interactSpot: {
          x: 575,
          y: 480
        },
        labelKey: "actor.desk-drawer-updated",
        lookSpot: {
          x: 575,
          y: 380
        },
        role: "prop"
      },
      sceneId: "moonlit-dock"
    });

    const updatedScene = updated.bundle.scenes["moonlit-dock"];
    expect(updatedScene?.type).toBe("layered-2d");
    if (!updatedScene || updatedScene.type !== "layered-2d") {
      throw new Error("Expected layered 2D scene");
    }
    expect(updatedScene.actors.find((entry) => entry.id === "desk-drawer")).toMatchObject({
      depth: 18,
      labelKey: "actor.desk-drawer-updated",
      lookSpot: {
        x: 575,
        y: 380
      }
    });

    const deleted = await applyProjectCommand(projectRoot, {
      type: "actor/delete",
      actorId: "desk-drawer",
      sceneId: "moonlit-dock"
    });

    const deletedScene = deleted.bundle.scenes["moonlit-dock"];
    expect(deletedScene?.type).toBe("layered-2d");
    if (!deletedScene || deletedScene.type !== "layered-2d") {
      throw new Error("Expected layered 2D scene");
    }
    expect(deletedScene.actors.some((entry) => entry.id === "desk-drawer")).toBe(false);

    const sceneFile = JSON.parse(
      await readFile(path.join(projectRoot, "scenes", "moonlit-dock.scene.json"), "utf8")
    ) as { actors: Array<{ id: string }> };
    expect(sceneFile.actors.some((entry) => entry.id === "desk-drawer")).toBe(false);
  });

  it("persists scene inspector edits back to the scene document", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    const updated = await applyProjectCommand(projectRoot, {
      type: "scene/update",
      patch: {
        background: "#204060",
        layers: [
          {
            assetId: "mara-spritesheet",
            bounds: { x: 10, y: 20, width: 240, height: 180 },
            depth: 42,
            id: "foreground-test",
            name: "Foreground Test",
            opacity: 0.85,
            visible: true
          }
        ],
        name: "Moonlit Dock Revised",
        playerStart: {
          x: 490,
          y: 575
        },
        size: {
          width: 1440,
          height: 810
        },
        walkArea: {
          points: [
            { x: 90, y: 460 },
            { x: 1160, y: 460 },
            { x: 1180, y: 545 },
            { x: 1090, y: 650 },
            { x: 170, y: 665 },
            { x: 75, y: 560 }
          ]
        }
      },
      sceneId: "moonlit-dock"
    });

    const scene = updated.bundle.scenes["moonlit-dock"];
    expect(scene?.type).toBe("layered-2d");
    if (!scene || scene.type !== "layered-2d") {
      throw new Error("Expected layered 2D scene");
    }

    expect(scene).toMatchObject({
      background: "#204060",
      name: "Moonlit Dock Revised",
      playerStart: {
        x: 490,
        y: 575
      },
      size: {
        width: 1440,
        height: 810
      },
      walkArea: {
        points: [
          { x: 90, y: 460 },
          { x: 1160, y: 460 },
          { x: 1180, y: 545 },
          { x: 1090, y: 650 },
          { x: 170, y: 665 },
          { x: 75, y: 560 }
        ]
      }
    });

    const scenePath = path.join(projectRoot, "scenes", "moonlit-dock.scene.json");
    const sceneFile = JSON.parse(await readFile(scenePath, "utf8")) as {
      background: string;
      layers?: Array<{ id: string; assetId: string; depth: number }>;
      name: string;
      size: { height: number; width: number };
    };
    expect(sceneFile.background).toBe("#204060");
    expect(sceneFile.layers?.[0]).toMatchObject({
      assetId: "mara-spritesheet",
      depth: 42,
      id: "foreground-test"
    });
    expect(sceneFile.name).toBe("Moonlit Dock Revised");
    expect(sceneFile.size).toEqual({ width: 1440, height: 810 });
  });

  it("creates a new scene document and manifest entry on disk", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    const updated = await applyProjectCommand(projectRoot, {
      type: "scene/create",
      scene: {
        actors: [],
        background: "#1b2c3d",
        hotspots: [],
        id: "harbor-street",
        name: "Harbor Street",
        playerStart: { x: 640, y: 560 },
        pickups: [],
        schemaVersion: 1,
        shapes: [],
        size: { width: 1280, height: 720 },
        type: "layered-2d",
        walkArea: {
          points: [
            { x: 80, y: 480 },
            { x: 1200, y: 480 },
            { x: 1200, y: 680 },
            { x: 80, y: 680 }
          ]
        }
      }
    });

    expect(updated.bundle.scenes["harbor-street"]?.name).toBe("Harbor Street");

    const manifest = JSON.parse(
      await readFile(path.join(projectRoot, "adventure.project.json"), "utf8")
    ) as { scenes: Array<{ id: string; path: string }> };
    expect(manifest.scenes).toContainEqual({
      id: "harbor-street",
      path: "scenes/harbor-street.scene.json"
    });

    const sceneFile = JSON.parse(
      await readFile(path.join(projectRoot, "scenes", "harbor-street.scene.json"), "utf8")
    ) as { id: string; name: string };
    expect(sceneFile).toMatchObject({
      id: "harbor-street",
      name: "Harbor Street"
    });
  });

  it("deletes a non-initial scene document and removes it from the manifest", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    await applyProjectCommand(projectRoot, {
      type: "scene/create",
      scene: {
        actors: [],
        background: "#1b2c3d",
        hotspots: [],
        id: "harbor-street",
        name: "Harbor Street",
        playerStart: { x: 640, y: 560 },
        pickups: [],
        schemaVersion: 1,
        shapes: [],
        size: { width: 1280, height: 720 },
        type: "layered-2d",
        walkArea: {
          points: [
            { x: 80, y: 480 },
            { x: 1200, y: 480 },
            { x: 1200, y: 680 },
            { x: 80, y: 680 }
          ]
        }
      }
    });

    const updated = await applyProjectCommand(projectRoot, {
      type: "scene/delete",
      sceneId: "harbor-street"
    });

    expect(updated.bundle.scenes["harbor-street"]).toBeUndefined();

    const manifest = JSON.parse(
      await readFile(path.join(projectRoot, "adventure.project.json"), "utf8")
    ) as { scenes: Array<{ id: string; path: string }>; initialSceneId: string };
    expect(manifest.scenes.some((entry) => entry.id === "harbor-street")).toBe(false);
    expect(manifest.initialSceneId).toBe("moonlit-dock");

    await expect(stat(path.join(projectRoot, "scenes", "harbor-street.scene.json"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("reassigns the initial scene when deleting the current initial scene", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    await applyProjectCommand(projectRoot, {
      type: "scene/create",
      scene: {
        actors: [],
        background: "#1b2c3d",
        hotspots: [],
        id: "harbor-street",
        name: "Harbor Street",
        playerStart: { x: 640, y: 560 },
        pickups: [],
        schemaVersion: 1,
        shapes: [],
        size: { width: 1280, height: 720 },
        type: "layered-2d",
        walkArea: {
          points: [
            { x: 80, y: 480 },
            { x: 1200, y: 480 },
            { x: 1200, y: 680 },
            { x: 80, y: 680 }
          ]
        }
      }
    });

    const updated = await applyProjectCommand(projectRoot, {
      type: "scene/delete",
      sceneId: "moonlit-dock"
    });

    expect(updated.bundle.manifest.initialSceneId).toBe("new-scene");
    expect(updated.bundle.scenes["moonlit-dock"]).toBeUndefined();
  });

  it("blocks deleting the final remaining scene", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    await applyProjectCommand(projectRoot, {
      type: "scene/delete",
      sceneId: "new-scene"
    });

    await expect(
      applyProjectCommand(projectRoot, {
        type: "scene/delete",
        sceneId: "moonlit-dock"
      })
    ).rejects.toThrow("A project must keep at least one scene");
  });

  it("updates an existing locale string on disk", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    const updated = await applyProjectCommand(projectRoot, {
      type: "locale/upsert",
      locale: "en",
      patch: {
        key: "hotspot.tavern-entrance",
        value: "The Lantern and Gull"
      }
    });

    expect(updated.bundle.locales["en"]?.strings["hotspot.tavern-entrance"]).toBe(
      "The Lantern and Gull"
    );

    const localePath = path.join(projectRoot, "locales", "en.json");
    const localeFile = JSON.parse(await readFile(localePath, "utf8")) as {
      strings: Record<string, string>;
    };
    expect(localeFile.strings["hotspot.tavern-entrance"]).toBe("The Lantern and Gull");
  });

  it("inserts a new locale string on disk", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    const updated = await applyProjectCommand(projectRoot, {
      type: "locale/upsert",
      locale: "en",
      patch: {
        key: "ui.editor.scene",
        value: "Scene"
      }
    });

    expect(updated.bundle.locales["en"]?.strings["ui.editor.scene"]).toBe("Scene");

    const localePath = path.join(projectRoot, "locales", "en.json");
    const localeFile = JSON.parse(await readFile(localePath, "utf8")) as {
      strings: Record<string, string>;
    };
    expect(localeFile.strings["ui.editor.scene"]).toBe("Scene");
  });

  it("deletes an existing locale string on disk", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    const updated = await applyProjectCommand(projectRoot, {
      type: "locale/delete",
      key: "hotspot.tavern-entrance",
      locale: "en"
    });

    expect(updated.bundle.locales["en"]?.strings["hotspot.tavern-entrance"]).toBeUndefined();

    const localePath = path.join(projectRoot, "locales", "en.json");
    const localeFile = JSON.parse(await readFile(localePath, "utf8")) as {
      strings: Record<string, string>;
    };
    expect(localeFile.strings["hotspot.tavern-entrance"]).toBeUndefined();
  });

  it("rejects deleting a locale key that does not exist", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    await expect(
      applyProjectCommand(projectRoot, {
        type: "locale/delete",
        key: "missing.key",
        locale: "en"
      })
    ).rejects.toThrow('Locale key "missing.key" does not exist in locale "en"');
  });

  it("updates flow name and start node on disk", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    const sourceFlow = (await loadProjectFromDirectory(projectRoot)).bundle.flows["look-tavern-door"];
    if (!sourceFlow) {
      throw new Error("Expected sample flow");
    }

    const updated = await applyProjectCommand(projectRoot, {
      type: "flow/update",
      flowId: "look-tavern-door",
      patch: {
        editorLayout: {
          nodes: {
            "mara-one": { x: 120, y: 80 }
          },
          viewport: { x: 10, y: 20, zoom: 1.1 }
        },
        name: "Inspect the tavern door again",
        nodes: sourceFlow.nodes,
        startNodeId: "mara-one"
      }
    });

    const flow = updated.bundle.flows["look-tavern-door"];
    expect(flow).toMatchObject({
      editorLayout: {
        nodes: { "mara-one": { x: 120, y: 80 } },
        viewport: { x: 10, y: 20, zoom: 1.1 }
      },
      name: "Inspect the tavern door again",
      startNodeId: "mara-one"
    });

    const flowPath = path.join(projectRoot, "flows", "look-tavern-door.flow.json");
    const flowFile = JSON.parse(await readFile(flowPath, "utf8")) as {
      editorLayout?: unknown;
      name: string;
      startNodeId: string;
    };
    expect(flowFile.name).toBe("Inspect the tavern door again");
    expect(flowFile.editorLayout).toEqual({
      nodes: { "mara-one": { x: 120, y: 80 } },
      viewport: { x: 10, y: 20, zoom: 1.1 }
    });
    expect(flowFile.startNodeId).toBe("mara-one");
  });

  it("persists an added flow node on disk", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    const sourceFlow = (await loadProjectFromDirectory(projectRoot)).bundle.flows["look-tavern-door"];
    if (!sourceFlow) {
      throw new Error("Expected sample flow");
    }

    const nodes = sourceFlow.nodes.map((node) =>
      node.id === "mara-one" && node.type === "line"
        ? { ...node, next: "mara-three" }
        : node
    );
    nodes.splice(nodes.length - 1, 0, {
      id: "mara-three",
      next: "end",
      speakerId: "mara",
      textKey: "dialogue.tavern.03",
      type: "line"
    });

    const updated = await applyProjectCommand(projectRoot, {
      type: "flow/update",
      flowId: "look-tavern-door",
      patch: {
        name: sourceFlow.name,
        nodes,
        startNodeId: sourceFlow.startNodeId
      }
    });

    expect(updated.bundle.flows["look-tavern-door"]?.nodes.some((node) => node.id === "mara-three")).toBe(
      true
    );

    const flowPath = path.join(projectRoot, "flows", "look-tavern-door.flow.json");
    const flowFile = JSON.parse(await readFile(flowPath, "utf8")) as {
      nodes: Array<{ id: string }>;
    };
    expect(flowFile.nodes.some((node) => node.id === "mara-three")).toBe(true);
  });

  it("persists a removed flow node on disk", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    const sourceFlow = (await loadProjectFromDirectory(projectRoot)).bundle.flows["look-tavern-door"];
    if (!sourceFlow) {
      throw new Error("Expected sample flow");
    }

    const nodes = sourceFlow.nodes
      .filter((node) => node.id !== "mara-one")
      .map((node) =>
        node.id === "mara-three" && node.type === "line" ? { ...node, next: "end" } : node
      );

    const updated = await applyProjectCommand(projectRoot, {
      type: "flow/update",
      flowId: "look-tavern-door",
      patch: {
        name: sourceFlow.name,
        nodes,
        startNodeId: "end"
      }
    });

    expect(updated.bundle.flows["look-tavern-door"]?.nodes.some((node) => node.id === "mara-one")).toBe(
      false
    );

    const flowPath = path.join(projectRoot, "flows", "look-tavern-door.flow.json");
    const flowFile = JSON.parse(await readFile(flowPath, "utf8")) as {
      nodes: Array<{ id: string }>;
    };
    expect(flowFile.nodes.some((node) => node.id === "mara-one")).toBe(false);
  });

  it("creates a new flow document and manifest entry on disk", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    const updated = await applyProjectCommand(projectRoot, {
      type: "flow/create",
      flow: {
        id: "harbor-gossip",
        name: "Harbor Gossip",
        nodes: [
          {
            id: "line-1",
            next: "end-1",
            speakerId: "dockhand",
            textKey: "dialogue.harbor-gossip.01",
            type: "line"
          },
          {
            id: "end-1",
            type: "end"
          }
        ],
        schemaVersion: 1,
        startNodeId: "line-1"
      }
    });

    expect(updated.bundle.flows["harbor-gossip"]?.name).toBe("Harbor Gossip");

    const manifest = JSON.parse(
      await readFile(path.join(projectRoot, "adventure.project.json"), "utf8")
    ) as { flows: Array<{ id: string; path: string }> };
    expect(manifest.flows).toContainEqual({
      id: "harbor-gossip",
      path: "flows/harbor-gossip.flow.json"
    });

    const flowFile = JSON.parse(
      await readFile(path.join(projectRoot, "flows", "harbor-gossip.flow.json"), "utf8")
    ) as { id: string; startNodeId: string };
    expect(flowFile).toMatchObject({
      id: "harbor-gossip",
      startNodeId: "line-1"
    });
  });

  it("deletes an unreferenced flow document and removes it from the manifest", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    await applyProjectCommand(projectRoot, {
      type: "flow/create",
      flow: {
        id: "harbor-gossip",
        name: "Harbor Gossip",
        nodes: [
          {
            id: "line-1",
            next: "end-1",
            speakerId: "dockhand",
            textKey: "dialogue.harbor-gossip.01",
            type: "line"
          },
          {
            id: "end-1",
            type: "end"
          }
        ],
        schemaVersion: 1,
        startNodeId: "line-1"
      }
    });

    const updated = await applyProjectCommand(projectRoot, {
      type: "flow/delete",
      flowId: "harbor-gossip"
    });

    expect(updated.bundle.flows["harbor-gossip"]).toBeUndefined();

    const manifest = JSON.parse(
      await readFile(path.join(projectRoot, "adventure.project.json"), "utf8")
    ) as { flows: Array<{ id: string; path: string }> };
    expect(manifest.flows.some((entry) => entry.id === "harbor-gossip")).toBe(false);

    await expect(stat(path.join(projectRoot, "flows", "harbor-gossip.flow.json"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("blocks deleting a flow that is still referenced by scene content", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    await expect(
      applyProjectCommand(projectRoot, {
        type: "flow/delete",
        flowId: "pickup-rusty-hook"
      })
    ).rejects.toThrow('Flow "pickup-rusty-hook" is still referenced');
  });

  it("persists pickup edits back to the scene document", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    const updated = await applyProjectCommand(projectRoot, {
      type: "pickup/update",
      pickupId: "dock-hook",
      patch: {
        assetId: "dock-sky",
        bounds: {
          x: 320,
          y: 548,
          width: 84,
          height: 52
        },
        itemId: "rusty-hook",
        labelKey: "pickup.rusty-hook.updated",
        pickupFlowId: "pickup-rusty-hook"
      },
      sceneId: "moonlit-dock"
    });

    const scene = updated.bundle.scenes["moonlit-dock"];
    expect(scene?.type).toBe("layered-2d");
    if (!scene || scene.type !== "layered-2d") {
      throw new Error("Expected layered 2D scene");
    }

    expect(scene.pickups.find((pickup) => pickup.id === "dock-hook")).toMatchObject({
      bounds: {
        x: 320,
        y: 548,
        width: 84,
        height: 52
      },
      itemId: "rusty-hook",
      labelKey: "pickup.rusty-hook.updated",
      pickupFlowId: "pickup-rusty-hook",
      assetId: "dock-sky"
    });
  });

  it("creates a new pickup in the scene document", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    const updated = await applyProjectCommand(projectRoot, {
      type: "pickup/create",
      pickup: {
        bounds: {
          x: 520,
          y: 560,
          width: 60,
          height: 50
        },
        id: "dock-key",
        itemId: "rusty-hook",
        labelKey: "pickup.dock-key"
      },
      sceneId: "moonlit-dock"
    });

    const scene = updated.bundle.scenes["moonlit-dock"];
    expect(scene?.type).toBe("layered-2d");
    if (!scene || scene.type !== "layered-2d") {
      throw new Error("Expected layered 2D scene");
    }

    expect(scene.pickups.some((entry) => entry.id === "dock-key")).toBe(true);
  });

  it("deletes a pickup from the scene document", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    const updated = await applyProjectCommand(projectRoot, {
      type: "pickup/delete",
      pickupId: "dock-hook",
      sceneId: "moonlit-dock"
    });

    const scene = updated.bundle.scenes["moonlit-dock"];
    expect(scene?.type).toBe("layered-2d");
    if (!scene || scene.type !== "layered-2d") {
      throw new Error("Expected layered 2D scene");
    }

    expect(scene.pickups.some((entry) => entry.id === "dock-hook")).toBe(false);
  });

  it("persists item edits back to the item document", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    const updated = await applyProjectCommand(projectRoot, {
      type: "item/update",
      itemId: "rusty-hook",
      patch: {
        labelKey: "item.rusty-hook.updated",
        name: "Harbor Hook"
      }
    });

    expect(updated.bundle.items["rusty-hook"]).toMatchObject({
      labelKey: "item.rusty-hook.updated",
      name: "Harbor Hook"
    });

    const itemPath = path.join(projectRoot, "items", "rusty-hook.item.json");
    const itemFile = JSON.parse(await readFile(itemPath, "utf8")) as {
      labelKey: string;
      name: string;
    };
    expect(itemFile.labelKey).toBe("item.rusty-hook.updated");
    expect(itemFile.name).toBe("Harbor Hook");
  });

  it("creates a new item document and manifest entry on disk", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    const updated = await applyProjectCommand(projectRoot, {
      type: "item/create",
      item: {
        id: "brass-key",
        labelKey: "item.brass-key",
        name: "Brass Key",
        schemaVersion: 1
      }
    });

    expect(updated.bundle.items["brass-key"]?.name).toBe("Brass Key");

    const manifest = JSON.parse(
      await readFile(path.join(projectRoot, "adventure.project.json"), "utf8")
    ) as { items: Array<{ id: string; path: string }> };
    expect(manifest.items).toContainEqual({
      id: "brass-key",
      path: "items/brass-key.item.json"
    });

    const itemFile = JSON.parse(
      await readFile(path.join(projectRoot, "items", "brass-key.item.json"), "utf8")
    ) as { id: string; labelKey: string };
    expect(itemFile).toMatchObject({
      id: "brass-key",
      labelKey: "item.brass-key"
    });
  });

  it("deletes an unreferenced item document and removes it from the manifest", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    await applyProjectCommand(projectRoot, {
      type: "item/create",
      item: {
        id: "brass-key",
        labelKey: "item.brass-key",
        name: "Brass Key",
        schemaVersion: 1
      }
    });

    const updated = await applyProjectCommand(projectRoot, {
      type: "item/delete",
      itemId: "brass-key"
    });

    expect(updated.bundle.items["brass-key"]).toBeUndefined();

    const manifest = JSON.parse(
      await readFile(path.join(projectRoot, "adventure.project.json"), "utf8")
    ) as { items: Array<{ id: string; path: string }> };
    expect(manifest.items.some((entry) => entry.id === "brass-key")).toBe(false);

    await expect(stat(path.join(projectRoot, "items", "brass-key.item.json"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("blocks deleting an item that is still referenced by scene content", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    await expect(
      applyProjectCommand(projectRoot, {
        type: "item/delete",
        itemId: "rusty-hook"
      })
    ).rejects.toThrow('Item "rusty-hook" is still referenced');
  });

  it("reports semantic diagnostics for missing item and flow references", async () => {
    const loaded = await loadProjectFromDirectory(
      path.resolve(import.meta.dirname, "../../../apps/sample-game/project")
    );
    const scene = loaded.bundle.scenes["moonlit-dock"];
    expect(scene?.type).toBe("layered-2d");
    if (!scene || scene.type !== "layered-2d") {
      throw new Error("Expected layered 2D scene");
    }

    const diagnostics = validateProjectBundle({
      ...loaded.bundle,
      scenes: {
        ...loaded.bundle.scenes,
        "moonlit-dock": {
          ...scene,
          pickups: [
            {
              ...scene.pickups[0]!,
              itemId: "missing-item"
            }
          ],
          hotspots: [
            {
              ...scene.hotspots[0]!,
              actions: {
                ...scene.hotspots[0]!.actions,
                lookFlowId: "missing-flow"
              }
            }
          ]
        }
      }
    });

    expect(diagnostics.some((item) => item.code === "scene.pickup-item-missing")).toBe(true);
    expect(diagnostics.some((item) => item.code === "scene.hotspot-look-missing-flow")).toBe(true);
  });

  it("reports semantic diagnostics for missing actor and prompt pack references", async () => {
    const loaded = await loadProjectFromDirectory(
      path.resolve(import.meta.dirname, "../../../apps/sample-game/project")
    );
    const scene = loaded.bundle.scenes["moonlit-dock"];
    expect(scene?.type).toBe("layered-2d");
    if (!scene || scene.type !== "layered-2d") {
      throw new Error("Expected layered 2D scene");
    }

    const diagnostics = validateProjectBundle({
      ...loaded.bundle,
      scenes: {
        ...loaded.bundle.scenes,
        "moonlit-dock": {
          ...scene,
          layers: [
            {
              assetId: "missing-layer-asset",
              bounds: { x: 1200, y: 650, width: 200, height: 120 },
              depth: 30,
              id: "broken-layer",
              name: "Broken Layer"
            }
          ],
          generationGuides: [
            {
              id: "broken-source",
              name: "Broken Source",
              role: "actor",
              source: { kind: "actor", id: "missing-actor" },
              shape: { type: "rect", bounds: { x: 1200, y: 650, width: 200, height: 120 } }
            }
          ],
          actors: [
            {
              actions: { useItemFlows: [] },
              assetId: "missing-asset",
              bounds: { x: 10, y: 20, width: 30, height: 40 },
              depth: 4,
              id: "loose-prop",
              interactSpot: { x: 5000, y: 5000 },
              labelKey: "actor.loose-prop",
              role: "prop",
              visibleWhen: { type: "item-in-inventory", itemId: "missing-item" }
            }
          ],
          pickups: scene.pickups.map((pickup, index) =>
            index === 0 ? { ...pickup, assetId: "missing-pickup-asset" } : pickup
          )
        }
      },
      promptPacks: {
        ...loaded.bundle.promptPacks,
        "broken-pack": {
          ...loaded.bundle.promptPacks["moonlit-dock-art"]!,
          id: "broken-pack",
          sceneId: "missing-scene",
          outputs: {
            ...loaded.bundle.promptPacks["moonlit-dock-art"]!.outputs,
            generationTargets: loaded.bundle.promptPacks["moonlit-dock-art"]!.outputs.generationTargets.map(
              (target, index) =>
                index === 0
                  ? {
                      ...target,
                      guideIds: ["missing-guide"],
                      maskAssetId: "missing-mask",
                      referenceAssetId: "missing-reference"
                    }
                  : target
            )
          }
        }
      }
    });

    expect(diagnostics.some((item) => item.code === "scene.actor-asset-missing")).toBe(true);
    expect(diagnostics.some((item) => item.code === "scene.layer-asset-missing")).toBe(true);
    expect(diagnostics.some((item) => item.code === "scene.layer-bounds-outside-scene")).toBe(true);
    expect(diagnostics.some((item) => item.code === "scene.generation-guide-source-missing")).toBe(true);
    expect(diagnostics.some((item) => item.code === "scene.generation-guide-outside-scene")).toBe(true);
    expect(diagnostics.some((item) => item.code === "scene.pickup-asset-missing")).toBe(true);
    expect(diagnostics.some((item) => item.code === "scene.actor-interact-spot-outside-scene")).toBe(true);
    expect(diagnostics.some((item) => item.code === "scene.actor-visible-item-missing")).toBe(true);
    expect(diagnostics.some((item) => item.code === "prompt-pack.scene-missing")).toBe(true);
    expect(diagnostics.some((item) => item.code === "prompt-pack.reference-asset-missing")).toBe(true);
    expect(diagnostics.some((item) => item.code === "prompt-pack.mask-asset-missing")).toBe(true);
    expect(diagnostics.some((item) => item.code === "prompt-pack.generation-guide-missing")).toBe(true);
  });

  it("accepts workflow engine documents with valid cross references", async () => {
    const loaded = await loadProjectFromDirectory(
      path.resolve(import.meta.dirname, "../../../apps/sample-game/project")
    );

    const diagnostics = validateProjectBundle({
      ...loaded.bundle,
      assets: {
        ...loaded.bundle.assets,
        "dock-style-reference": {
          schemaVersion: 1,
          id: "dock-style-reference",
          kind: "image",
          path: "assets/generated/dock-style-reference.png",
          source: "imported"
        },
        "dock-layout": {
          schemaVersion: 1,
          id: "dock-layout",
          kind: "image",
          path: "assets/generated/dock-layout.png",
          source: "imported"
        },
        "moonlit-dock-background-v2": {
          schemaVersion: 1,
          id: "moonlit-dock-background-v2",
          kind: "image",
          path: "assets/generated/moonlit-dock-background-v2.png",
          source: "generated",
          generation: {
            provider: "comfyui",
            workflowId: "sdxl-background",
            recipeId: "moonlit-dock-background-recipe",
            promptPackId: "moonlit-dock-art",
            targetId: "moonlit-dock-background",
            referenceAssetIds: ["dock-style-reference"],
            parentAssetIds: ["dock-layout"],
            prompt: {
              positive: "Paint a clean moonlit dock background."
            },
            dimensions: { width: 1280, height: 720 }
          }
        }
      },
      styleBibles: {
        "isle-style": {
          schemaVersion: 1,
          id: "isle-style",
          name: "Isle Style",
          medium: "hand-painted comic adventure art",
          palette: ["cool moonlight", "warm lantern light"],
          referenceAssetIds: ["dock-style-reference"]
        }
      },
      workflowTemplates: {
        "sdxl-background": {
          schemaVersion: 1,
          id: "sdxl-background",
          name: "SDXL Background 16:9",
          family: "background_t2i_fast",
          workflowPath: "workflows/sdxl-background-api.json",
          outputMode: "opaque-image",
          supportedInputs: ["prompt", "negative-prompt", "seed", "dimensions", "output-prefix"],
          bindings: [{ input: "prompt", nodeId: "6", inputKey: "text", required: true }],
          output: { nodeId: "9", kind: "opaque-image" }
        }
      },
      generationRecipes: {
        "moonlit-dock-background-recipe": {
          schemaVersion: 1,
          id: "moonlit-dock-background-recipe",
          sceneId: "moonlit-dock",
          promptPackId: "moonlit-dock-art",
          targetId: "moonlit-dock-background",
          assetType: "background",
          workflowFamily: "background_t2i_fast",
          workflowId: "sdxl-background",
          styleBibleId: "isle-style",
          resolution: { width: 1280, height: 720 },
          prompt: {
            positive: "Paint a clean moonlit dock background.",
            negative: "text, watermark"
          },
          inputs: {
            referenceAssetIds: ["dock-style-reference"],
            parentAssetIds: ["dock-layout"]
          },
          generation: {
            seed: 39120481,
            steps: 4,
            cfg: 2,
            sampler: "euler",
            scheduler: "sgm_uniform",
            denoise: 1
          }
        }
      }
    });

    expect(diagnostics).toEqual([]);
  });

  it("reports semantic diagnostics for broken workflow engine references", async () => {
    const loaded = await loadProjectFromDirectory(
      path.resolve(import.meta.dirname, "../../../apps/sample-game/project")
    );

    const diagnostics = validateProjectBundle({
      ...loaded.bundle,
      assets: {
        ...loaded.bundle.assets,
        "broken-generated": {
          schemaVersion: 1,
          id: "broken-generated",
          kind: "image",
          path: "assets/generated/broken.png",
          source: "generated",
          generation: {
            provider: "comfyui",
            workflowId: "missing-workflow",
            recipeId: "missing-recipe",
            promptPackId: "moonlit-dock-art",
            targetId: "missing-target",
            referenceAssetIds: ["missing-reference"],
            maskAssetId: "missing-mask",
            parentAssetIds: ["missing-parent"],
            guideIds: ["missing-guide"]
          }
        }
      },
      styleBibles: {
        "broken-style": {
          schemaVersion: 1,
          id: "broken-style",
          name: "Broken Style",
          medium: "painted",
          palette: ["blue"],
          referenceAssetIds: ["missing-style-reference"]
        }
      },
      workflowTemplates: {
        "broken-workflow": {
          schemaVersion: 1,
          id: "broken-workflow",
          name: "Broken Workflow",
          family: "background_t2i_fast",
          workflowPath: "workflows/missing.json",
          outputMode: "opaque-image",
          supportedInputs: ["prompt"],
          bindings: [{ input: "seed", nodeId: "10", inputKey: "seed" }],
          output: { nodeId: "9", kind: "opaque-image" }
        }
      },
      generationRecipes: {
        "broken-recipe": {
          schemaVersion: 1,
          id: "broken-recipe",
          sceneId: "missing-scene",
          promptPackId: "missing-pack",
          targetId: "missing-target",
          assetType: "background",
          workflowFamily: "scene_inpaint_masked",
          workflowId: "broken-workflow",
          styleBibleId: "missing-style",
          resolution: { width: 1280, height: 720 },
          prompt: {
            positive: "Paint a clean moonlit dock background."
          },
          inputs: {
            referenceAssetIds: ["missing-reference"],
            maskAssetId: "missing-mask",
            parentAssetIds: ["missing-parent"],
            guideIds: ["missing-guide"]
          },
          generation: {}
        }
      }
    });

    expect(diagnostics.some((item) => item.code === "asset.generation-workflow-missing")).toBe(true);
    expect(diagnostics.some((item) => item.code === "asset.generation-recipe-missing")).toBe(true);
    expect(diagnostics.some((item) => item.code === "asset.generation-target-missing")).toBe(true);
    expect(diagnostics.some((item) => item.code === "asset.generation-reference-asset-missing")).toBe(true);
    expect(diagnostics.some((item) => item.code === "asset.generation-mask-asset-missing")).toBe(true);
    expect(diagnostics.some((item) => item.code === "asset.generation-parent-asset-missing")).toBe(true);
    expect(diagnostics.some((item) => item.code === "asset.generation-guide-missing")).toBe(true);
    expect(diagnostics.some((item) => item.code === "style-bible.reference-asset-missing")).toBe(true);
    expect(diagnostics.some((item) => item.code === "workflow-template.binding-input-unsupported")).toBe(true);
    expect(diagnostics.some((item) => item.code === "generation-recipe.workflow-family-mismatch")).toBe(true);
    expect(diagnostics.some((item) => item.code === "generation-recipe.scene-missing")).toBe(true);
    expect(diagnostics.some((item) => item.code === "generation-recipe.prompt-pack-missing")).toBe(true);
    expect(diagnostics.some((item) => item.code === "generation-recipe.style-bible-missing")).toBe(true);
    expect(diagnostics.some((item) => item.code === "generation-recipe.reference-asset-missing")).toBe(true);
    expect(diagnostics.some((item) => item.code === "generation-recipe.mask-asset-missing")).toBe(true);
    expect(diagnostics.some((item) => item.code === "generation-recipe.parent-asset-missing")).toBe(true);
    expect(diagnostics.some((item) => item.code === "generation-recipe.generation-guide-missing")).toBe(true);
  });

  it("upserts a prompt pack document and manifest entry", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    const source = (await loadProjectFromDirectory(projectRoot)).bundle.promptPacks["moonlit-dock-art"];
    if (!source) {
      throw new Error("Expected sample prompt pack");
    }

    const updated = await applyProjectCommand(projectRoot, {
      type: "prompt-pack/upsert",
      patch: {
        documentPath: "prompt-packs/harbor-style.prompt-pack.json",
        promptPack: {
          ...source,
          id: "harbor-style",
          name: "Harbor Style Exploration"
        }
      }
    });

    expect(updated.bundle.promptPacks["harbor-style"]?.name).toBe("Harbor Style Exploration");

    const manifest = JSON.parse(
      await readFile(path.join(projectRoot, "adventure.project.json"), "utf8")
    ) as { promptPacks?: Array<{ id: string; path: string }> };
    expect(manifest.promptPacks).toContainEqual({
      id: "harbor-style",
      path: "prompt-packs/harbor-style.prompt-pack.json"
    });

    const promptPackFile = JSON.parse(
      await readFile(path.join(projectRoot, "prompt-packs", "harbor-style.prompt-pack.json"), "utf8")
    ) as { id: string; name: string };
    expect(promptPackFile).toMatchObject({
      id: "harbor-style",
      name: "Harbor Style Exploration"
    });
  });

  it("upserts workflow templates and generation recipes", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const loaded = await createBlankProject(path.join(tempRoot, "recipe-project"));
    await mkdir(path.join(loaded.directory, "workflows"), { recursive: true });
    await writeFile(
      path.join(loaded.directory, "workflows/test.workflow.json"),
      JSON.stringify({
        "6": { class_type: "CLIPTextEncode", inputs: { text: "old" } },
        "9": { class_type: "SaveImage", inputs: { images: ["6", 0] } }
      }),
      "utf8"
    );

    const withWorkflow = await applyProjectCommand(loaded.directory, {
      type: "workflow-template/upsert",
      patch: {
        workflowTemplate: {
          schemaVersion: 1,
          id: "test-workflow",
          name: "Test Workflow",
          family: "background_t2i_fast",
          workflowPath: "workflows/test.workflow.json",
          outputMode: "opaque-image",
          supportedInputs: ["prompt"],
          bindings: [{ input: "prompt", nodeId: "6", inputKey: "text", required: true }],
          output: { nodeId: "9", kind: "opaque-image" }
        }
      }
    });

    const withRecipe = await applyProjectCommand(withWorkflow.directory, {
      type: "generation-recipe/upsert",
      patch: {
        generationRecipe: {
          schemaVersion: 1,
          id: "start-test-workflow",
          sceneId: "start",
          targetId: "start-background",
          assetType: "background",
          workflowFamily: "background_t2i_fast",
          workflowId: "test-workflow",
          resolution: { width: 1280, height: 720 },
          prompt: { positive: "Paint a readable cave." },
          generation: { seed: 42 }
        }
      }
    });

    expect(withRecipe.bundle.workflowTemplates["test-workflow"]?.workflowPath).toBe("workflows/test.workflow.json");
    expect(withRecipe.bundle.generationRecipes["start-test-workflow"]?.workflowId).toBe("test-workflow");
    expect(withRecipe.bundle.manifest.workflowTemplates?.[0]).toMatchObject({
      id: "test-workflow",
      path: "workflow-templates/test-workflow.workflow-template.json"
    });
    expect(withRecipe.bundle.manifest.generationRecipes?.[0]).toMatchObject({
      id: "start-test-workflow",
      path: "generation-recipes/start-test-workflow.generation-recipe.json"
    });
    expect(validateProjectBundle(withRecipe.bundle)).toEqual([]);
    expect(await validateProjectFiles(withRecipe)).toEqual([]);
  });

  it("upserts an animation pack document and manifest entry", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    const source = (await loadProjectFromDirectory(projectRoot)).bundle.animationPacks.mara;
    if (!source) {
      throw new Error("Expected sample animation pack");
    }

    const updated = await applyProjectCommand(projectRoot, {
      type: "animation-pack/upsert",
      patch: {
        animationPack: {
          ...source,
          id: "mara-fast",
          name: "Mara Fast Walk"
        },
        documentPath: "animation-packs/mara-fast.animation-pack.json"
      }
    });

    expect(updated.bundle.animationPacks["mara-fast"]?.name).toBe("Mara Fast Walk");

    const manifest = JSON.parse(
      await readFile(path.join(projectRoot, "adventure.project.json"), "utf8")
    ) as { animationPacks?: Array<{ id: string; path: string }> };
    expect(manifest.animationPacks).toContainEqual({
      id: "mara-fast",
      path: "animation-packs/mara-fast.animation-pack.json"
    });
  });

  it("registers imported assets in the project manifest and asset documents", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });
    await mkdir(path.join(projectRoot, "assets", "imported"), { recursive: true });
    await writeFile(path.join(projectRoot, "assets", "imported", "dock-sky.png"), "fake image", "utf8");

    const updated = await applyProjectCommand(projectRoot, {
      type: "asset/import",
      assets: [
        {
          documentPath: "assets/dock-sky.asset.json",
          filePath: "assets/imported/dock-sky.png",
          id: "dock-sky",
          kind: "image",
          source: "imported"
        }
      ]
    });

    expect(updated.bundle.assets["dock-sky"]).toMatchObject({
      kind: "image",
      path: "assets/imported/dock-sky.png",
      source: "imported"
    });

    const manifest = JSON.parse(
      await readFile(path.join(projectRoot, "adventure.project.json"), "utf8")
    ) as { assets?: Array<{ id: string; path: string }> };
    expect(manifest.assets).toContainEqual({
      id: "dock-sky",
      path: "assets/dock-sky.asset.json"
    });
  });

  it("registers generated assets with provenance metadata", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });
    await mkdir(path.join(projectRoot, "assets", "imported"), { recursive: true });
    await writeFile(path.join(projectRoot, "assets", "imported", "dock-generated.png"), "fake image", "utf8");

    const updated = await applyProjectCommand(projectRoot, {
      type: "asset/import",
      assets: [
        {
          documentPath: "assets/dock-generated.asset.json",
          filePath: "assets/imported/dock-generated.png",
          id: "dock-generated",
          kind: "image",
          source: "generated",
          generation: {
            provider: "comfyui",
            model: "sdxl-turbo",
            promptPackId: "moonlit-dock-art",
            targetId: "moonlit-dock-background",
            seed: 42,
            prompt: {
              positive: "A moonlit dock background.",
              negative: "text, watermark"
            },
            dimensions: { width: 1280, height: 720 }
          }
        }
      ]
    });

    expect(updated.bundle.assets["dock-generated"]).toMatchObject({
      kind: "image",
      path: "assets/imported/dock-generated.png",
      source: "generated",
      generation: {
        provider: "comfyui",
        model: "sdxl-turbo",
        targetId: "moonlit-dock-background"
      }
    });

    const assetFile = JSON.parse(
      await readFile(path.join(projectRoot, "assets", "dock-generated.asset.json"), "utf8")
    ) as { generation?: { dimensions?: { width: number; height: number }; seed?: number }; source: string };
    expect(assetFile.source).toBe("generated");
    expect(assetFile.generation).toMatchObject({
      dimensions: { width: 1280, height: 720 },
      seed: 42
    });
  });

  it("persists audio metadata and non-destructive processed image lineage", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });
    await mkdir(path.join(projectRoot, "assets", "imported"), { recursive: true });
    await writeFile(path.join(projectRoot, "assets", "imported", "source.png"), "source", "utf8");
    await writeFile(path.join(projectRoot, "assets", "imported", "optimized.webp"), "optimized", "utf8");
    await writeFile(path.join(projectRoot, "assets", "imported", "dock.ogg"), "audio", "utf8");

    const updated = await applyProjectCommand(projectRoot, {
      type: "asset/import",
      assets: [
        {
          documentPath: "assets/source.asset.json",
          filePath: "assets/imported/source.png",
          id: "source",
          kind: "image",
          source: "imported"
        },
        {
          documentPath: "assets/optimized.asset.json",
          filePath: "assets/imported/optimized.webp",
          id: "optimized",
          kind: "image",
          source: "processed",
          processing: {
            parentAssetId: "source",
            operations: [{ type: "optimize", parameters: { quality: 88 } }],
            format: "webp",
            quality: 88,
            dimensions: { width: 1280, height: 720 },
            processedAt: "2026-07-14T10:00:00.000Z"
          }
        },
        {
          captionKey: "audio.dock",
          channel: "ambience",
          documentPath: "assets/dock.asset.json",
          filePath: "assets/imported/dock.ogg",
          id: "dock",
          kind: "audio",
          loop: true,
          source: "imported",
          volume: 0.65
        }
      ]
    });

    expect(updated.bundle.assets.optimized).toMatchObject({
      kind: "image",
      source: "processed",
      processing: { parentAssetId: "source", format: "webp", quality: 88 }
    });
    expect(updated.bundle.assets.dock).toMatchObject({
      kind: "audio",
      channel: "ambience",
      captionKey: "audio.dock",
      loop: true,
      volume: 0.65
    });
  });

  it("reports missing registered asset files", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    await applyProjectCommand(projectRoot, {
      type: "asset/import",
      assets: [
        {
          documentPath: "assets/missing-sky.asset.json",
          filePath: "assets/imported/missing-sky.png",
          id: "missing-sky",
          kind: "image",
          source: "imported"
        }
      ]
    });

    const loaded = await loadProjectFromDirectory(projectRoot);
    const diagnostics = await validateProjectFiles(loaded);

    expect(diagnostics.some((item) => item.code === "asset.file-missing")).toBe(true);
  });

  it("relinks an asset path and updates scene backgrounds using it", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });
    await mkdir(path.join(projectRoot, "assets", "imported"), { recursive: true });
    await writeFile(path.join(projectRoot, "assets", "imported", "dock-sky.png"), "fake image", "utf8");
    await writeFile(path.join(projectRoot, "assets", "imported", "dock-sky-v2.png"), "fake image v2", "utf8");

    await applyProjectCommand(projectRoot, {
      type: "asset/import",
      assets: [
        {
          documentPath: "assets/dock-sky.asset.json",
          filePath: "assets/imported/dock-sky.png",
          id: "dock-sky",
          kind: "image",
          source: "imported"
        }
      ]
    });

    const loaded = await loadProjectFromDirectory(projectRoot);
    const sourceScene = loaded.bundle.scenes["moonlit-dock"];
    expect(sourceScene?.type).toBe("layered-2d");
    if (!sourceScene || sourceScene.type !== "layered-2d") {
      throw new Error("Expected layered 2D scene");
    }

    await applyProjectCommand(projectRoot, {
      type: "scene/update",
      patch: {
        background: "assets/imported/dock-sky.png",
        name: sourceScene.name,
        playerStart: sourceScene.playerStart,
        size: sourceScene.size,
        walkArea: sourceScene.walkArea
      },
      sceneId: "moonlit-dock"
    });

    const updated = await applyProjectCommand(projectRoot, {
      type: "asset/relink",
      assetId: "dock-sky",
      patch: {
        path: "assets/imported/dock-sky-v2.png"
      }
    });

    expect(updated.bundle.assets["dock-sky"]?.path).toBe("assets/imported/dock-sky-v2.png");
    const relinkedScene = updated.bundle.scenes["moonlit-dock"];
    expect(relinkedScene?.type).toBe("layered-2d");
    if (!relinkedScene || relinkedScene.type !== "layered-2d") {
      throw new Error("Expected layered 2D scene");
    }
    expect(relinkedScene.background).toBe("assets/imported/dock-sky-v2.png");

    const assetFile = JSON.parse(
      await readFile(path.join(projectRoot, "assets", "dock-sky.asset.json"), "utf8")
    ) as { path: string };
    expect(assetFile.path).toBe("assets/imported/dock-sky-v2.png");

    const sceneFile = JSON.parse(
      await readFile(path.join(projectRoot, "scenes", "moonlit-dock.scene.json"), "utf8")
    ) as { background: string };
    expect(sceneFile.background).toBe("assets/imported/dock-sky-v2.png");
  });

  it("deletes an unused asset document and removes it from the manifest", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });
    await mkdir(path.join(projectRoot, "assets", "imported"), { recursive: true });
    await writeFile(path.join(projectRoot, "assets", "imported", "dock-sky.png"), "fake image", "utf8");

    await applyProjectCommand(projectRoot, {
      type: "asset/import",
      assets: [
        {
          documentPath: "assets/dock-sky.asset.json",
          filePath: "assets/imported/dock-sky.png",
          id: "dock-sky",
          kind: "image",
          source: "imported"
        }
      ]
    });

    const updated = await applyProjectCommand(projectRoot, {
      type: "asset/delete",
      assetId: "dock-sky"
    });

    expect(updated.bundle.assets["dock-sky"]).toBeUndefined();

    const manifest = JSON.parse(
      await readFile(path.join(projectRoot, "adventure.project.json"), "utf8")
    ) as { assets?: Array<{ id: string; path: string }> };
    expect(manifest.assets?.some((entry) => entry.id === "dock-sky")).toBe(false);

    await expect(stat(path.join(projectRoot, "assets", "dock-sky.asset.json"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("blocks deleting an asset that is still referenced by a scene background", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });
    await mkdir(path.join(projectRoot, "assets", "imported"), { recursive: true });
    await writeFile(path.join(projectRoot, "assets", "imported", "dock-sky.png"), "fake image", "utf8");

    await applyProjectCommand(projectRoot, {
      type: "asset/import",
      assets: [
        {
          documentPath: "assets/dock-sky.asset.json",
          filePath: "assets/imported/dock-sky.png",
          id: "dock-sky",
          kind: "image",
          source: "imported"
        }
      ]
    });

    const loaded = await loadProjectFromDirectory(projectRoot);
    const sourceScene = loaded.bundle.scenes["moonlit-dock"];
    expect(sourceScene?.type).toBe("layered-2d");
    if (!sourceScene || sourceScene.type !== "layered-2d") {
      throw new Error("Expected layered 2D scene");
    }

    await applyProjectCommand(projectRoot, {
      type: "scene/update",
      patch: {
        background: "assets/imported/dock-sky.png",
        name: sourceScene.name,
        playerStart: sourceScene.playerStart,
        size: sourceScene.size,
        walkArea: sourceScene.walkArea
      },
      sceneId: "moonlit-dock"
    });

    await expect(
      applyProjectCommand(projectRoot, {
        type: "asset/delete",
        assetId: "dock-sky"
      })
    ).rejects.toThrow('Asset "dock-sky" is still referenced by moonlit-dock');
  });

  it("blocks deleting an asset that is still referenced by a scene layer", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });
    await mkdir(path.join(projectRoot, "assets", "imported"), { recursive: true });
    await writeFile(path.join(projectRoot, "assets", "imported", "foreground-fog.png"), "fake image", "utf8");

    await applyProjectCommand(projectRoot, {
      type: "asset/import",
      assets: [
        {
          documentPath: "assets/foreground-fog.asset.json",
          filePath: "assets/imported/foreground-fog.png",
          id: "foreground-fog",
          kind: "image",
          source: "imported"
        }
      ]
    });

    const loaded = await loadProjectFromDirectory(projectRoot);
    const sourceScene = loaded.bundle.scenes["moonlit-dock"];
    expect(sourceScene?.type).toBe("layered-2d");
    if (!sourceScene || sourceScene.type !== "layered-2d") {
      throw new Error("Expected layered 2D scene");
    }

    await applyProjectCommand(projectRoot, {
      type: "scene/update",
      patch: {
        background: sourceScene.background,
        layers: [
          {
            assetId: "foreground-fog",
            bounds: { x: 0, y: 520, width: 1280, height: 160 },
            depth: 92,
            id: "foreground-fog",
            name: "Foreground Fog"
          }
        ],
        name: sourceScene.name,
        playerStart: sourceScene.playerStart,
        size: sourceScene.size,
        walkArea: sourceScene.walkArea
      },
      sceneId: "moonlit-dock"
    });

    await expect(
      applyProjectCommand(projectRoot, {
        type: "asset/delete",
        assetId: "foreground-fog"
      })
    ).rejects.toThrow('Asset "foreground-fog" is still referenced by moonlit-dock');
  });

  it("blocks deleting an asset that is still referenced by a pickup", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });
    await mkdir(path.join(projectRoot, "assets", "imported"), { recursive: true });
    await writeFile(path.join(projectRoot, "assets", "imported", "dock-hook.png"), "fake image", "utf8");

    await applyProjectCommand(projectRoot, {
      type: "asset/import",
      assets: [
        {
          documentPath: "assets/dock-hook.asset.json",
          filePath: "assets/imported/dock-hook.png",
          id: "dock-hook",
          kind: "image",
          source: "imported"
        }
      ]
    });

    const loaded = await loadProjectFromDirectory(projectRoot);
    const sourceScene = loaded.bundle.scenes["moonlit-dock"];
    expect(sourceScene?.type).toBe("layered-2d");
    if (!sourceScene || sourceScene.type !== "layered-2d") {
      throw new Error("Expected layered 2D scene");
    }
    const sourcePickup = sourceScene.pickups.find((pickup) => pickup.id === "dock-hook");
    if (!sourcePickup) {
      throw new Error("Expected dock hook pickup");
    }

    await applyProjectCommand(projectRoot, {
      type: "pickup/update",
      pickupId: sourcePickup.id,
      patch: {
        ...sourcePickup,
        assetId: "dock-hook"
      },
      sceneId: sourceScene.id
    });

    await expect(
      applyProjectCommand(projectRoot, {
        type: "asset/delete",
        assetId: "dock-hook"
      })
    ).rejects.toThrow('Asset "dock-hook" is still referenced by dock-hook');
  });

  it("blocks deleting an asset that is still referenced by a prompt target guide", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });
    await mkdir(path.join(projectRoot, "assets", "imported"), { recursive: true });
    await writeFile(path.join(projectRoot, "assets", "imported", "target-mask.png"), "fake image", "utf8");

    await applyProjectCommand(projectRoot, {
      type: "asset/import",
      assets: [
        {
          documentPath: "assets/target-mask.asset.json",
          filePath: "assets/imported/target-mask.png",
          id: "target-mask",
          kind: "image",
          source: "imported"
        }
      ]
    });

    const loaded = await loadProjectFromDirectory(projectRoot);
    const promptPack = loaded.bundle.promptPacks["moonlit-dock-art"];
    if (!promptPack) {
      throw new Error("Expected sample prompt pack");
    }

    await applyProjectCommand(projectRoot, {
      type: "prompt-pack/upsert",
      patch: {
        promptPack: {
          ...promptPack,
          outputs: {
            ...promptPack.outputs,
            generationTargets: promptPack.outputs.generationTargets.map((target, index) =>
              index === 0 ? { ...target, maskAssetId: "target-mask" } : target
            )
          }
        }
      }
    });

    await expect(
      applyProjectCommand(projectRoot, {
        type: "asset/delete",
        assetId: "target-mask"
      })
    ).rejects.toThrow('Asset "target-mask" is still referenced by moonlit-dock-art/');
  });
});
