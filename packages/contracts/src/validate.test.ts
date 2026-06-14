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
      shapes: [],
      hotspots: [],
      surprise: true
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
