import { describe, expect, it } from "vitest";
import { buildProjectResourceIndex, filterProjectResources, type ProjectResourceSource } from "./project-resources";

function source(): ProjectResourceSource {
  return {
    animationPacks: [],
    assets: [
      { schemaVersion: 1, id: "rain", kind: "audio", path: "assets/rain.ogg", source: "imported", channel: "ambience", loop: true }
    ],
    diagnostics: [],
    flows: [{
      schemaVersion: 1,
      id: "arrival",
      name: "Arrival",
      startNodeId: "rain-cue",
      nodes: [
        { id: "rain-cue", type: "cue", cue: { type: "sound", key: "rain" }, next: "end" },
        { id: "end", type: "end" }
      ]
    }],
    generationRecipes: [],
    items: [],
    locales: [],
    manifest: {
      schemaVersion: 1,
      id: "sample",
      title: "Sample",
      initialSceneId: "dock",
      defaultLocale: "en",
      viewport: { width: 1280, height: 720 },
      scenes: [{ id: "dock", path: "scenes/dock.scene.json" }],
      flows: [{ id: "arrival", path: "flows/arrival.flow.json" }],
      locales: [],
      items: [],
      assets: [{ id: "rain", path: "assets/rain.asset.json" }]
    },
    promptPacks: [],
    scenes: [{
      schemaVersion: 1,
      id: "dock",
      name: "Moonlit Dock",
      type: "layered-2d",
      background: "#132538",
      size: { width: 1280, height: 720 },
      playerStart: { x: 10, y: 10 },
      walkArea: { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }] },
      actors: [], pickups: [], shapes: [], hotspots: []
    }],
    styleBibles: [],
    workflowTemplates: []
  };
}

describe("project resource index", () => {
  it("federates domain documents and links audio usage back to Narrative", () => {
    const resources = buildProjectResourceIndex(source());
    const audio = resources.find((resource) => resource.id === "rain");
    expect(audio?.kind).toBe("audio");
    expect(audio?.uses[0]?.target).toEqual({ workspace: "narrative", flowId: "arrival" });
    expect(filterProjectResources(resources, "moonlit").map((resource) => resource.id)).toEqual(["dock"]);
  });
});
