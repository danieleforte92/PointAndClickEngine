import { describe, expect, it } from "vitest";
import { validateDocument } from "./validate";

describe("project contracts", () => {
  it("accepts a stable save document", () => {
    expect(
      validateDocument("save", {
        schemaVersion: 1,
        slot: "manual-1",
        projectFingerprint: "a".repeat(64),
        locale: "en",
        createdAt: "2026-07-13T12:00:00.000Z",
        updatedAt: "2026-07-13T12:00:00.000Z",
        checkpoint: {
          kind: "stable",
          worldState: { sceneId: "dock", player: { x: 100, y: 600 } },
          flowSession: null,
          eventLog: []
        },
        checksum: "b".repeat(64)
      })
    ).toEqual({ valid: true, errors: [] });
  });

  it("accepts a committed project change record", () => {
    expect(
      validateDocument("projectChange", {
        schemaVersion: 1,
        id: "history-000001",
        sequence: 1,
        createdAt: "2026-07-11T12:00:00.000Z",
        source: "editor",
        operation: "scene/update",
        summary: "scene/update (moonlit-dock)",
        scope: "scene",
        affectedDocuments: [
          {
            kind: "scene",
            id: "moonlit-dock",
            path: "scenes/moonlit-dock.scene.json",
            beforeSha256: "a".repeat(64),
            afterSha256: "b".repeat(64)
          }
        ]
      })
    ).toEqual({ valid: true, errors: [] });
  });

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
      animationPacks: [{ id: "mara", path: "animation-packs/mara.animation-pack.json" }],
      locales: [{ locale: "en", path: "locales/en.json" }]
    });

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("accepts animation pack definitions", () => {
    const result = validateDocument("animationPack", {
      schemaVersion: 1,
      id: "mara",
      name: "Mara",
      assetId: "mara-spritesheet",
      frame: { width: 64, height: 64 },
      grid: { columns: 3, rows: 2 },
      footOrigin: { x: 32, y: 63 },
      defaultFacing: "right",
      clips: [
        { id: "idle", frames: [0, 1], fps: 4, loop: true },
        { id: "walk", frames: [3, 4, 5], fps: 8, loop: true }
      ]
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
          assetId: "rusty-hook-image",
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

  it("accepts optional image layers in layered scenes", () => {
    const result = validateDocument("layered2dScene", {
      schemaVersion: 1,
      id: "dock",
      name: "Dock",
      type: "layered-2d",
      size: { width: 1280, height: 720 },
      background: "#132538",
      layers: [
        {
          id: "foreground-fog",
          name: "Foreground Fog",
          assetId: "fog-strip",
          bounds: { x: 0, y: 520, width: 1280, height: 200 },
          depth: 95,
          locked: false,
          opacity: 0.72,
          visible: true
        }
      ],
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
      hotspots: []
    });

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("accepts scene generation guides", () => {
    const result = validateDocument("layered2dScene", {
      schemaVersion: 1,
      id: "dock",
      name: "Dock",
      type: "layered-2d",
      size: { width: 1280, height: 720 },
      background: "#132538",
      generationGuides: [
        {
          id: "door-mask",
          name: "Door Mask",
          role: "hotspot",
          source: { kind: "hotspot", id: "tavern-door" },
          shape: { type: "polygon", points: [{ x: 850, y: 335 }, { x: 975, y: 335 }, { x: 975, y: 550 }] },
          tags: ["door", "entrance"],
          visible: true,
          locked: false,
          color: "#00A2FF"
        }
      ],
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
      hotspots: [
        {
          id: "tavern-door",
          labelKey: "hotspot.tavern-door",
          bounds: { x: 850, y: 335, width: 125, height: 215 },
          actions: { useItemFlows: [] }
        }
      ]
    });

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("rejects generation guide polygons with fewer than three points", () => {
    const result = validateDocument("layered2dScene", {
      schemaVersion: 1,
      id: "dock",
      name: "Dock",
      type: "layered-2d",
      size: { width: 1280, height: 720 },
      background: "#132538",
      generationGuides: [
        {
          id: "bad-mask",
          name: "Bad Mask",
          role: "mask",
          shape: { type: "polygon", points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }
        }
      ],
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
      hotspots: []
    });

    expect(result.valid).toBe(false);
  });

  it("rejects invalid generation guide roles", () => {
    const result = validateDocument("layered2dScene", {
      schemaVersion: 1,
      id: "dock",
      name: "Dock",
      type: "layered-2d",
      size: { width: 1280, height: 720 },
      background: "#132538",
      generationGuides: [
        {
          id: "bad-role",
          name: "Bad Role",
          role: "camera",
          shape: { type: "rect", bounds: { x: 0, y: 0, width: 100, height: 100 } }
        }
      ],
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
      hotspots: []
    });

    expect(result.valid).toBe(false);
  });

  it("rejects layer opacity outside the canonical range", () => {
    const result = validateDocument("layered2dScene", {
      schemaVersion: 1,
      id: "dock",
      name: "Dock",
      type: "layered-2d",
      size: { width: 1280, height: 720 },
      background: "#132538",
      layers: [
        {
          id: "foreground-fog",
          name: "Foreground Fog",
          assetId: "fog-strip",
          depth: 95,
          opacity: 1.25
        }
      ],
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
      hotspots: []
    });

    expect(result.valid).toBe(false);
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

  it("accepts explicit generation target output contracts", () => {
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
        labels: {},
        hotspots: [],
        actors: [{ id: "keeper", role: "npc", labelKey: "actor.keeper" }],
        pickups: [],
        items: []
      },
      outputs: {
        sceneBackgroundPrompt: "Paint a clean moonlit dock background.",
        propPrompts: [],
        characterReferencePrompts: [
          { id: "keeper-sprite-sheet", prompt: "A keeper sprite sheet on chroma blue." }
        ],
        animationNotes: ["Keep the player pivot at the feet."],
        negativePrompt: "blurry, cropped, unreadable",
        styleNotes: ["Readable silhouettes"],
        generationTargets: [
          {
            id: "keeper-sprite-sheet",
            sourceEntityKind: "actor",
            sourceEntityId: "keeper",
            backgroundMode: "chroma-blue",
            expectedAlpha: false,
            chromaColor: "#00A2FF",
            customPositivePrompt: "Longer raincoat, brass buttons, same visual style.",
            customNegativePrompt: "extra arms, scene background",
            guideBounds: { x: 120, y: 80, width: 128, height: 256 },
            guideShape: "rect",
            intendedUse: "sprite-sheet",
            maskAssetId: "keeper-mask",
            marginPercent: 4,
            referenceAssetId: "keeper-reference",
            guideIds: ["keeper-guide"],
            safetyNegativePrompt: "transparent alpha, cropped feet"
          }
        ]
      },
      suggestedActors: [],
      provenance: {
        provider: "mock",
        model: "mock-prompt-pack-v1",
        generatedAt: "2026-06-24T12:00:00.000Z"
      }
    });

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("accepts legacy transparent prompt pack targets", () => {
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
        propPrompts: [{ id: "rusty-hook", prompt: "A rusty hook on transparent background." }],
        characterReferencePrompts: [],
        animationNotes: [],
        negativePrompt: "",
        styleNotes: [],
        generationTargets: [
          {
            id: "rusty-hook-prop",
            intendedUse: "prop",
            transparent: true
          }
        ]
      },
      suggestedActors: [],
      provenance: {
        provider: "mock",
        model: "mock-prompt-pack-v1",
        generatedAt: "2026-06-24T12:00:00.000Z"
      }
    });

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("accepts workflow engine manifest references", () => {
    const result = validateDocument("project", {
      schemaVersion: 1,
      id: "sample",
      title: "Sample",
      initialSceneId: "dock",
      defaultLocale: "en",
      viewport: { width: 1280, height: 720 },
      scenes: [{ id: "dock", path: "scenes/dock.scene.json" }],
      flows: [],
      items: [],
      assets: [],
      promptPacks: [],
      animationPacks: [],
      styleBibles: [{ id: "sample-style", path: "style-bibles/sample-style.style-bible.json" }],
      workflowTemplates: [
        { id: "sdxl-background", path: "workflow-templates/sdxl-background.workflow-template.json" }
      ],
      generationRecipes: [
        { id: "dock-background-recipe", path: "generation-recipes/dock-background.recipe.json" }
      ],
      locales: [{ locale: "en", path: "locales/en.json" }]
    });

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("accepts generated asset provenance", () => {
    const result = validateDocument("asset", {
      schemaVersion: 1,
      id: "dock-background-v2",
      kind: "image",
      path: "assets/imported/dock-background-v2.png",
      source: "generated",
      generation: {
        provider: "comfyui",
        generatedAt: "2026-06-29T12:00:00.000Z",
        model: "sdxl-turbo",
        workflowId: "sdxl-background",
        workflowFamily: "scene_inpaint_masked",
        recipeId: "dock-background-recipe",
        promptPackId: "dock-art",
        targetId: "dock-background",
        seed: 39120481,
        prompt: {
          positive: "A moonlit dock background.",
          negative: "logos, readable text"
        },
        dimensions: { width: 1280, height: 720 },
        parentAssetIds: ["dock-layout"],
        referenceAssetIds: ["dock-style-reference"],
        maskAssetId: "dock-mask",
        guideIds: ["door-mask"],
        warnings: ["Generated as RGB PNG; no alpha channel."]
      }
    });

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("accepts style bible, workflow template, and generation recipe documents", () => {
    expect(
      validateDocument("styleBible", {
        schemaVersion: 1,
        id: "sample-style",
        name: "Sample Style",
        medium: "hand-painted comic adventure art",
        palette: ["cool moonlight", "warm tavern lanterns"],
        camera: "fixed side-view point-and-click camera",
        linework: "clean readable silhouettes",
        lighting: "soft moonlight with warm windows",
        negativePrompt: "photorealistic, logos, readable text",
        forbidden: ["existing franchise characters"],
        referenceAssetIds: ["dock-style-reference"],
        loraTags: ["sample-style-lora"]
      })
    ).toEqual({ valid: true, errors: [] });

    expect(
      validateDocument("workflowTemplate", {
        schemaVersion: 1,
        id: "sdxl-background",
        name: "SDXL Background 16:9",
        family: "background_t2i_fast",
        workflowPath: "workflows/sdxl-background-api.json",
        outputMode: "opaque-image",
        hardwareProfile: "rtx3070-8gb-preview",
        supportedInputs: ["prompt", "negative-prompt", "seed", "dimensions", "output-prefix"],
        bindings: [
          { input: "prompt", nodeId: "6", inputKey: "text", required: true },
          { input: "dimensions", nodeId: "5", inputKey: "width", required: true }
        ],
        output: {
          nodeId: "9",
          kind: "opaque-image"
        },
        notes: ["No latent x2 upscale in the default preview path."]
      })
    ).toEqual({ valid: true, errors: [] });

    expect(
      validateDocument("generationRecipe", {
        schemaVersion: 1,
        id: "dock-background-recipe",
        sceneId: "dock",
        promptPackId: "dock-art",
        targetId: "dock-background",
        assetType: "background",
        workflowFamily: "background_t2i_fast",
        workflowId: "sdxl-background",
        styleBibleId: "sample-style",
        resolution: { width: 1280, height: 720 },
        prompt: {
          positive: "A moonlit dock background.",
          negative: "logos, readable text"
        },
        inputs: {
          referenceAssetIds: ["dock-style-reference"],
          maskAssetId: "dock-mask",
          guideIds: ["door-mask"],
          parentAssetIds: ["dock-layout"]
        },
        generation: {
          seed: 39120481,
          steps: 4,
          cfg: 2,
          sampler: "euler",
          scheduler: "sgm_uniform",
          denoise: 1,
          model: "sdxl-turbo"
        }
      })
    ).toEqual({ valid: true, errors: [] });
  });

  it("accepts audio assets and processed image lineage without changing schema version", () => {
    expect(
      validateDocument("asset", {
        schemaVersion: 1,
        id: "dock-ambience",
        kind: "audio",
        path: "assets/imported/dock-ambience.ogg",
        source: "imported",
        channel: "ambience",
        volume: 0.7,
        loop: true,
        captionKey: "audio.dock-ambience"
      })
    ).toEqual({ valid: true, errors: [] });

    expect(
      validateDocument("asset", {
        schemaVersion: 2,
        id: "dock-background-web",
        kind: "image",
        path: "assets/imported/dock-background-web.webp",
        source: "processed",
        processing: {
          parentAssetId: "dock-background-source",
          operations: [
            { type: "trim-alpha" },
            { type: "optimize", parameters: { preset: "background", quality: 88 } }
          ],
          format: "webp",
          quality: 88,
          dimensions: { width: 1280, height: 720 },
          processedAt: "2026-07-14T10:00:00.000Z"
        }
      })
    ).toEqual({ valid: true, errors: [] });
  });

  it("accepts optional narrative editor layout while keeping old flows valid", () => {
    const baseFlow = {
      schemaVersion: 1,
      id: "layout-test",
      name: "Layout Test",
      startNodeId: "end",
      nodes: [{ id: "end", type: "end" }]
    };
    expect(validateDocument("flow", baseFlow)).toEqual({ valid: true, errors: [] });
    expect(
      validateDocument("flow", {
        ...baseFlow,
        schemaVersion: 2,
        editorLayout: {
          nodes: { end: { x: 420, y: 160 } },
          viewport: { x: 12, y: -8, zoom: 1.15 }
        }
      })
    ).toEqual({ valid: true, errors: [] });
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
