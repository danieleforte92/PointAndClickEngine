import type {
  Layered2DScene,
  PromptPackGenerationTarget,
  SceneGenerationGuide
} from "@pointclick/contracts";
import { describe, expect, it } from "vitest";
import {
  aiStudioSteps,
  assetTypeForGenerationTarget,
  dimensionsForGenerationTarget,
  expectedAlphaForBackgroundMode,
  imageGenerationContextForTarget,
  suggestedGenerationGuideIds
} from "./ai-studio-model";

function target(overrides: Partial<PromptPackGenerationTarget> = {}): PromptPackGenerationTarget {
  return {
    id: "target-1",
    intendedUse: "prop",
    prompt: "a prop",
    ...overrides
  } as PromptPackGenerationTarget;
}

function scene(overrides: Partial<Layered2DScene> = {}): Layered2DScene {
  return {
    id: "scene-1",
    name: "Courtyard",
    type: "layered-2d",
    actors: [],
    hotspots: [],
    layers: [],
    pickups: [],
    playerStart: { x: 100, y: 100 },
    size: { width: 1280, height: 720 },
    ...overrides
  } as Layered2DScene;
}

function guide(overrides: Partial<SceneGenerationGuide>): SceneGenerationGuide {
  return {
    id: "guide-1",
    role: "context",
    shape: { type: "rect", bounds: { x: 0, y: 0, width: 100, height: 100 } },
    ...overrides
  } as SceneGenerationGuide;
}

describe("ai studio model", () => {
  it("keeps the guided workflow ordered", () => {
    expect(aiStudioSteps.map((step) => step.id)).toEqual([
      "brief",
      "context",
      "recipe",
      "generate",
      "review"
    ]);
  });

  it("uses target defaults and clamps provider dimensions", () => {
    expect(dimensionsForGenerationTarget(target({ intendedUse: "scene-background" }))).toEqual({
      height: 1024,
      width: 1024
    });
    expect(dimensionsForGenerationTarget(target({ height: 12, width: 4096 }))).toEqual({
      height: 64,
      width: 2048
    });
  });

  it("preserves alpha policy and maps generation asset types", () => {
    expect(expectedAlphaForBackgroundMode("transparent-alpha", false)).toBe(true);
    expect(expectedAlphaForBackgroundMode("chroma-blue", true)).toBe(false);
    expect(expectedAlphaForBackgroundMode(undefined, true)).toBe(true);
    expect(assetTypeForGenerationTarget(target({ intendedUse: "scene-background" }))).toBe("background");
    expect(assetTypeForGenerationTarget(target({ intendedUse: "character-reference" }))).toBe("character");
    expect(assetTypeForGenerationTarget(target({ intendedUse: "animation-reference" }))).toBe("animation");
  });

  it("resolves generation targets to stable scene entities", () => {
    const resolved = imageGenerationContextForTarget(
      target({ id: "actor-1-idle", intendedUse: "character-reference" }),
      scene({ actors: [{ id: "actor-1", role: "npc" }] as unknown as Layered2DScene["actors"] })
    );
    expect(resolved).toMatchObject({
      entityId: "actor-1",
      entityKind: "actor",
      sceneId: "scene-1",
      targetId: "actor-1-idle"
    });

    expect(
      imageGenerationContextForTarget(
        target({ id: "layer-target", sourceEntityId: "foreground", sourceEntityKind: "layer" }),
        scene()
      )
    ).toMatchObject({ entityId: "foreground", entityKind: "layer" });
  });

  it("suggests explicit and role-compatible scene guides", () => {
    const guides = [
      guide({ id: "explicit", role: "mask" }),
      guide({ id: "background", role: "background" }),
      guide({ id: "unrelated", role: "actor" })
    ];
    expect(
      suggestedGenerationGuideIds(
        target({ intendedUse: "scene-background", guideIds: ["explicit"] }),
        guides
      )
    ).toEqual(["explicit", "background"]);
    expect(suggestedGenerationGuideIds(null, guides)).toEqual([]);
  });
});
