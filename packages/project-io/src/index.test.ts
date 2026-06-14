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
});
