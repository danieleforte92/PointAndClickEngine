import { describe, expect, it } from "vitest";
import { validateDocument } from "./validate";

describe("project contracts", () => {
  it("accepts a minimal project manifest", () => {
    const result = validateDocument("project", {
      schemaVersion: 1,
      id: "sample",
      title: "Sample",
      initialSceneId: "dock",
      defaultLocale: "en",
      viewport: { width: 1280, height: 720 },
      scenes: [{ id: "dock", path: "scenes/dock.scene.json" }],
      flows: [],
      items: [{ id: "rusty-hook", path: "items/rusty-hook.item.json" }],
      assets: [{ id: "dock-sky", path: "assets/dock-sky.asset.json" }],
      locales: [{ locale: "en", path: "locales/en.json" }]
    });

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("rejects unknown properties and malformed colors", () => {
    const result = validateDocument("layered2dScene", {
      schemaVersion: 1,
      id: "dock",
      name: "Dock",
      type: "layered-2d",
      size: { width: 1280, height: 720 },
      background: "navy",
      playerStart: { x: 100, y: 600 },
      walkArea: {
        points: [
          { x: 0, y: 500 },
          { x: 1280, y: 500 },
          { x: 1280, y: 720 }
        ]
      },
      pickups: [],
      shapes: [],
      hotspots: [],
      surprise: true
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("accepts item definitions", () => {
    const result = validateDocument("item", {
      schemaVersion: 1,
      id: "rusty-hook",
      name: "Rusty Hook",
      labelKey: "item.rusty-hook"
    });

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("accepts asset definitions", () => {
    const result = validateDocument("asset", {
      schemaVersion: 1,
      id: "dock-sky",
      kind: "image",
      path: "assets/imported/dock-sky.png",
      source: "imported"
    });

    expect(result).toEqual({ valid: true, errors: [] });
  });
});
