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
      promptPacks: [{ id: "dock-art", path: "prompt-packs/dock-art.prompt-pack.json" }],
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
      actors: [],
      pickups: [],
      shapes: [],
      hotspots: [],
      surprise: true
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("accepts layered scene actors and interaction spots", () => {
    const result = validateDocument("layered2dScene", {
      schemaVersion: 1,
      id: "dock",
      name: "Dock",
      type: "layered-2d",
      size: { width: 1280, height: 720 },
      background: "#132538",
      playerStart: { x: 100, y: 600 },
      walkArea: {
        points: [
          { x: 0, y: 500 },
          { x: 1280, y: 500 },
          { x: 1280, y: 720 }
        ]
      },
      actors: [
        {
          id: "screwdriver",
          role: "pickup",
          labelKey: "actor.screwdriver",
          assetId: "screwdriver-image",
          bounds: { x: 100, y: 200, width: 60, height: 20 },
          depth: 8,
          visibleWhen: { type: "flag-equals", key: "drawer.open", value: true },
          interactSpot: { x: 120, y: 580 },
          lookSpot: { x: 130, y: 560 },
          actions: {
            lookFlowId: "look-screwdriver",
            useItemFlows: []
          }
        }
      ],
      pickups: [
        {
          id: "dock-hook",
          itemId: "rusty-hook",
          labelKey: "pickup.rusty-hook",
          bounds: { x: 300, y: 560, width: 70, height: 60 },
          interactSpot: { x: 330, y: 610 },
          lookSpot: { x: 330, y: 570 }
        }
      ],
      shapes: [],
      hotspots: [
        {
          id: "tavern-door",
          labelKey: "hotspot.tavern-door",
          bounds: { x: 850, y: 335, width: 125, height: 215 },
          interactSpot: { x: 910, y: 550 },
          lookSpot: { x: 910, y: 430 },
          actions: {
            lookFlowId: "look-door",
            useItemFlows: []
          }
        }
      ]
    });

    expect(result).toEqual({ valid: true, errors: [] });
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

  it("accepts prompt pack definitions", () => {
    const result = validateDocument("promptPack", {
      schemaVersion: 1,
      id: "dock-art",
      name: "Dock Art Direction",
      sceneId: "dock",
      artBrief: "A moonlit dock with readable adventure-game props.",
      context: {
        projectTitle: "Sample",
        sceneId: "dock",
        sceneName: "Dock",
        sceneSize: { width: 1280, height: 720 },
        artBrief: "A moonlit dock with readable adventure-game props.",
        locale: "en",
        labels: {
          "hotspot.tavern-door": "Tavern door"
        },
        hotspots: [{ id: "tavern-door", labelKey: "hotspot.tavern-door" }],
        actors: [{ id: "screwdriver", role: "pickup", labelKey: "actor.screwdriver" }],
        pickups: [{ id: "dock-hook", itemId: "rusty-hook", labelKey: "pickup.rusty-hook" }],
        items: [{ id: "rusty-hook", labelKey: "item.rusty-hook" }]
      },
      outputs: {
        sceneBackgroundPrompt: "Paint a clean moonlit dock background.",
        propPrompts: [{ id: "rusty-hook", prompt: "A rusty hook isolated for a prop layer." }],
        characterReferencePrompts: [],
        animationNotes: ["Keep the player pivot at the feet."],
        negativePrompt: "blurry, cropped, unreadable",
        styleNotes: ["Readable silhouettes", "Warm lamplight against cool moonlight"],
        generationTargets: [
          {
            id: "dock-background",
            intendedUse: "scene-background",
            width: 1280,
            height: 720,
            aspectRatio: "16:9"
          }
        ]
      },
      suggestedActors: [
        {
          id: "rusty-hook",
          role: "pickup",
          label: "Rusty Hook",
          visualPrompt: "A rusty hook prop with transparent background.",
          suggestedBounds: { x: 300, y: 560, width: 70, height: 60 },
          suggestedInteractSpot: { x: 330, y: 610 }
        }
      ],
      provenance: {
        provider: "mock",
        model: "mock-prompt-pack-v1",
        generatedAt: "2026-06-24T12:00:00.000Z",
        inputHash: "sample-input"
      }
    });

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("rejects prompt pack suggested actors with invalid ids", () => {
    const result = validateDocument("promptPack", {
      schemaVersion: 1,
      id: "dock-art",
      name: "Dock Art Direction",
      sceneId: "dock",
      artBrief: "",
      context: {
        projectTitle: "Sample",
        sceneId: "dock",
        sceneName: "Dock",
        sceneSize: { width: 1280, height: 720 },
        artBrief: "",
        locale: "en",
        labels: {},
        hotspots: [],
        actors: [],
        pickups: [],
        items: []
      },
      outputs: {
        sceneBackgroundPrompt: "Paint a clean moonlit dock background.",
        propPrompts: [],
        characterReferencePrompts: [],
        animationNotes: [],
        negativePrompt: "",
        styleNotes: [],
        generationTargets: []
      },
      suggestedActors: [
        {
          id: "Bad Actor",
          role: "prop",
          label: "Bad Actor",
          visualPrompt: "Invalid id should fail."
        }
      ],
      provenance: {
        provider: "mock",
        model: "mock-prompt-pack-v1",
        generatedAt: "2026-06-24T12:00:00.000Z"
      }
    });

    expect(result.valid).toBe(false);
  });
});
