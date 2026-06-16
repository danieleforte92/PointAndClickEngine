import { cp, mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyProjectCommand,
  loadProjectFromDirectory,
  validateProjectBundle,
  validateProjectFiles
} from "./index";

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
      name: string;
    };
    expect(sceneFile.background).toBe("#204060");
    expect(sceneFile.name).toBe("Moonlit Dock Revised");
  });

  it("creates a new scene document and manifest entry on disk", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

    const updated = await applyProjectCommand(projectRoot, {
      type: "scene/create",
      scene: {
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

    expect(updated.bundle.manifest.initialSceneId).toBe("harbor-street");
    expect(updated.bundle.scenes["moonlit-dock"]).toBeUndefined();
  });

  it("blocks deleting the final remaining scene", async () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "../../../apps/sample-game/project");
    const tempRoot = await mkdtemp(path.join(tmpdir(), "pointclick-project-io-"));
    const projectRoot = path.join(tempRoot, "project");

    await cp(fixtureRoot, projectRoot, { recursive: true });

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
        name: "Inspect the tavern door again",
        nodes: sourceFlow.nodes,
        startNodeId: "mara-one"
      }
    });

    const flow = updated.bundle.flows["look-tavern-door"];
    expect(flow).toMatchObject({
      name: "Inspect the tavern door again",
      startNodeId: "mara-one"
    });

    const flowPath = path.join(projectRoot, "flows", "look-tavern-door.flow.json");
    const flowFile = JSON.parse(await readFile(flowPath, "utf8")) as {
      name: string;
      startNodeId: string;
    };
    expect(flowFile.name).toBe("Inspect the tavern door again");
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
      pickupFlowId: "pickup-rusty-hook"
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
});
