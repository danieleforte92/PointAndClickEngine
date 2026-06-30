import { describe, expect, it } from "vitest";
import type { PromptPackDocument, PromptPackGenerationTarget, StyleBibleDocument } from "@pointclick/contracts";
import {
  composeTargetNegativePrompt,
  composeTargetPositivePrompt,
  resolvePromptForGenerationTarget
} from "./prompt-pack-targets";

const promptPack: PromptPackDocument = {
  schemaVersion: 1,
  id: "test-pack",
  name: "Test Pack",
  sceneId: "dock",
  artBrief: "Readable dock art.",
  context: {
    projectTitle: "Test",
    sceneId: "dock",
    sceneName: "Dock",
    sceneSize: { width: 1280, height: 720 },
    artBrief: "Readable dock art.",
    locale: "en",
    labels: {},
    hotspots: [],
    actors: [{ id: "keeper", role: "npc", labelKey: "actor.keeper" }],
    pickups: [{ id: "rusty-hook", itemId: "rusty-hook", labelKey: "pickup.rusty-hook" }],
    items: [{ id: "rusty-hook", labelKey: "item.rusty-hook" }]
  },
  outputs: {
    sceneBackgroundPrompt: "BACKGROUND PROMPT",
    propPrompts: [
      { id: "rusty-hook", prompt: "PROP PROMPT" },
      { id: "radio", prompt: "RADIO PROP PROMPT" }
    ],
    characterReferencePrompts: [
      { id: "keeper", prompt: "CHARACTER PROMPT" },
      { id: "keeper-sprite-sheet", prompt: "SPRITE SHEET PROMPT" },
      { id: "mara", prompt: "MARA CHARACTER PROMPT" }
    ],
    animationNotes: [],
    negativePrompt: "",
    styleNotes: [],
    generationTargets: []
  },
  suggestedActors: [],
  provenance: {
    provider: "mock",
    model: "mock",
    generatedAt: "2026-06-25T12:00:00.000Z"
  }
};

function target(patch: Partial<PromptPackGenerationTarget>): PromptPackGenerationTarget {
  return {
    id: "dock-background",
    intendedUse: "scene-background",
    ...patch
  };
}

const styleBible: StyleBibleDocument = {
  schemaVersion: 1,
  id: "isle-style",
  name: "Isle Style",
  medium: "hand-painted comic adventure art",
  palette: ["cool moonlight", "warm lantern light"],
  camera: "fixed side-view camera",
  linework: "clean silhouettes",
  lighting: "soft moonlight",
  negativePrompt: "photorealistic, logos",
  forbidden: ["baked UI text", "logos"]
};

describe("resolvePromptForGenerationTarget", () => {
  it("uses the prop prompt for rusty-hook-prop instead of the background prompt", () => {
    const resolution = resolvePromptForGenerationTarget(promptPack, target({ id: "rusty-hook-prop", intendedUse: "prop" }));
    expect(resolution.prompt).toBe("PROP PROMPT");
    expect(resolution.match).toBe("legacy-affix");
  });

  it("uses a character prompt for mara-reference legacy target ids", () => {
    const resolution = resolvePromptForGenerationTarget(
      promptPack,
      target({ id: "mara-reference", intendedUse: "character-reference" })
    );
    expect(resolution.prompt).toBe("MARA CHARACTER PROMPT");
  });

  it("uses character templates for NPC actor targets", () => {
    const resolution = resolvePromptForGenerationTarget(
      promptPack,
      target({
        id: "keeper",
        intendedUse: "character-reference",
        sourceEntityKind: "actor",
        sourceEntityId: "keeper"
      })
    );
    expect(resolution.prompt).toBe("CHARACTER PROMPT");
  });

  it("uses prop templates for actor targets that are authored as props", () => {
    const resolution = resolvePromptForGenerationTarget(
      promptPack,
      target({
        id: "radio",
        intendedUse: "prop",
        sourceEntityKind: "actor",
        sourceEntityId: "radio"
      })
    );
    expect(resolution.prompt).toBe("RADIO PROP PROMPT");
  });

  it("uses the sprite-sheet template for sprite-sheet targets", () => {
    const resolution = resolvePromptForGenerationTarget(
      promptPack,
      target({
        id: "keeper-sprite-sheet",
        intendedUse: "sprite-sheet",
        sourceEntityKind: "actor",
        sourceEntityId: "keeper"
      })
    );
    expect(resolution.prompt).toBe("SPRITE SHEET PROMPT");
  });

  it("composes target prompt customizations", () => {
    expect(
      composeTargetPositivePrompt("BASE", target({ customPositivePrompt: "Use a brass hook." }))
    ).toBe("BASE\n\nTarget customization: Use a brass hook.");
  });

  it("adds style bible details to positive prompts", () => {
    expect(composeTargetPositivePrompt("BASE", target({}), styleBible)).toContain(
      'Style bible "Isle Style": medium: hand-painted comic adventure art; palette: cool moonlight, warm lantern light'
    );
  });

  it("adds a solid chroma output contract to chroma targets", () => {
    expect(
      composeTargetPositivePrompt(
        "BASE",
        target({
          backgroundMode: "chroma-blue",
          chromaColor: "#00A2FF"
        })
      )
    ).toContain("perfectly flat #00A2FF chroma key background");
  });

  it("adds an alpha output contract to transparent targets", () => {
    expect(
      composeTargetPositivePrompt(
        "BASE",
        target({
          backgroundMode: "transparent-alpha",
          expectedAlpha: true
        })
      )
    ).toContain("transparent PNG alpha");
  });

  it("merges target and pack negative prompts without duplicates", () => {
    expect(
      composeTargetNegativePrompt(
        {
          ...promptPack,
          outputs: {
            ...promptPack.outputs,
            negativePrompt: "blur, room background"
          }
        },
        target({
          customNegativePrompt: "extra fingers, blur",
          safetyNegativePrompt: "room background, floor"
        })
      )
    ).toBe("room background, floor, extra fingers, blur");
  });

  it("adds chroma background failures to negative prompts without duplicates", () => {
    expect(
      composeTargetNegativePrompt(
        {
          ...promptPack,
          outputs: {
            ...promptPack.outputs,
            negativePrompt: "blur, gradient background"
          }
        },
        target({
          backgroundMode: "chroma-green",
          safetyNegativePrompt: "room background, floor"
        })
      )
    ).toBe(
      "room background, floor, detailed background, environment, scenery, gradient background, textured background, patterned backdrop, ground plane, contact shadow, cast shadow, vignette, props behind subject, blur"
    );
  });

  it("merges style bible negative prompts and forbidden terms without duplicates", () => {
    expect(
      composeTargetNegativePrompt(
        {
          ...promptPack,
          outputs: {
            ...promptPack.outputs,
            negativePrompt: "blur, logos"
          }
        },
        target({ safetyNegativePrompt: "room background" }),
        styleBible
      )
    ).toBe("room background, photorealistic, logos, baked UI text, blur");
  });
});
