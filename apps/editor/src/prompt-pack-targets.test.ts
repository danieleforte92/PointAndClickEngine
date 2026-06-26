import { describe, expect, it } from "vitest";
import type { PromptPackDocument, PromptPackGenerationTarget } from "@pointclick/contracts";
import { resolvePromptForGenerationTarget } from "./prompt-pack-targets";

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
    propPrompts: [{ id: "rusty-hook", prompt: "PROP PROMPT" }],
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
});
