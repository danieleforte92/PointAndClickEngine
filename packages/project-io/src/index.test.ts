import { cp, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyProjectCommand, loadProjectFromDirectory } from "./index";

describe("loadProjectFromDirectory", () => {
  it("loads the sample project bundle from disk", async () => {
    const loaded = await loadProjectFromDirectory(
      path.resolve(import.meta.dirname, "../../../apps/sample-game/project")
    );

    expect(loaded.bundle.manifest.title).toBe("The Isle of Echoes");
    expect(Object.keys(loaded.bundle.scenes)).toContain("moonlit-dock");
    expect(loaded.bundle.scenes["moonlit-dock"]?.type).toBe("layered-2d");
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
        actionFlowId: "inspect-tavern-door",
        bounds: {
          x: 840,
          y: 330,
          width: 140,
          height: 225
        },
        cursor: "enter",
        labelKey: "hotspot.tavern-entrance-updated"
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
      actionFlowId: "inspect-tavern-door",
      bounds: {
        x: 840,
        y: 330,
        width: 140,
        height: 225
      },
      cursor: "enter",
      labelKey: "hotspot.tavern-entrance-updated"
    });

    const scenePath = path.join(projectRoot, "scenes", "moonlit-dock.scene.json");
    const sceneFile = JSON.parse(await readFile(scenePath, "utf8")) as {
      hotspots: Array<{ id: string; labelKey: string }>;
    };
    expect(sceneFile.hotspots.find((entry) => entry.id === "tavern-entrance")?.labelKey).toBe(
      "hotspot.tavern-entrance-updated"
    );
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
        name: "Moonlit Dock Revised",
        playerStart: {
          x: 490,
          y: 575
        },
        walkArea: {
          x: 90,
          y: 460,
          width: 1080,
          height: 180
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
      walkArea: {
        x: 90,
        y: 460,
        width: 1080,
        height: 180
      }
    });

    const scenePath = path.join(projectRoot, "scenes", "moonlit-dock.scene.json");
    const sceneFile = JSON.parse(await readFile(scenePath, "utf8")) as {
      background: string;
      name: string;
    };
    expect(sceneFile.background).toBe("#204060");
    expect(sceneFile.name).toBe("Moonlit Dock Revised");
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
});
