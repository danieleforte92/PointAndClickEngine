import { describe, expect, it } from "vitest";
import {
  buildAnimationFrameSliceCells,
  buildAnimationClipPreviewState,
  chooseAnimationPreviewClip,
  describeImageTargetWorkflow,
  animationPreviewIssue
} from "./character-gym-preview";
import type { PromptPackGenerationTarget } from "@pointclick/contracts";

const baseDraft = {
  assetId: "mara-spritesheet",
  frameHeight: "64",
  frameWidth: "64",
  gridColumns: "3",
  gridRows: "2",
  clips: [
    {
      fps: "4",
      frames: "0, 1, 0, 2",
      id: "idle",
      loop: true
    }
  ]
};

const basePreset = {
  id: "target_default",
  label: "Target default",
  useCase: "Use target dimensions."
};

function target(patch: Partial<PromptPackGenerationTarget>): PromptPackGenerationTarget {
  return {
    height: 512,
    id: "target",
    intendedUse: "prop",
    transparent: false,
    width: 512,
    ...patch
  };
}

describe("Character Gym preview helpers", () => {
  it("chooses the focused clip before falling back to idle", () => {
    const clips = [
      { fps: "8", frames: "3, 4, 5", id: "walk", loop: true },
      { fps: "4", frames: "0", id: "idle", loop: true }
    ];

    expect(chooseAnimationPreviewClip(clips, "walk")?.id).toBe("walk");
    expect(chooseAnimationPreviewClip(clips, "missing")?.id).toBe("idle");
  });

  it("advances looped frames from fps and elapsed time", () => {
    const state = buildAnimationClipPreviewState(baseDraft, baseDraft.clips[0]!, 500);

    expect(state?.frame).toEqual({
      column: 0,
      frame: 0,
      row: 0
    });
    expect(state?.backgroundSize).toBe("300% 200%");
  });

  it("holds non-looping clips on the final frame", () => {
    const state = buildAnimationClipPreviewState(
      baseDraft,
      { fps: "8", frames: "3, 4, 5", id: "walk", loop: false },
      10_000
    );

    expect(state?.frame).toEqual({
      column: 2,
      frame: 5,
      row: 1
    });
  });

  it("reports invalid frame references without throwing", () => {
    const issue = animationPreviewIssue(
      baseDraft,
      { fps: "8", frames: "3, 8", id: "walk", loop: true },
      "asset://mara"
    );

    expect(issue).toContain("frame 8");
  });

  it("builds visual frame slicing cells from the draft grid", () => {
    const cells = buildAnimationFrameSliceCells(baseDraft);

    expect(cells).toHaveLength(6);
    expect(cells[4]).toMatchObject({
      column: 1,
      frame: 4,
      row: 1
    });
    expect(cells[4]?.backgroundSize).toBe("300% 200%");
  });
});

describe("ComfyUI target workflow guidance", () => {
  it("describes opaque targets", () => {
    expect(describeImageTargetWorkflow(target({}), basePreset)).toMatchObject({
      label: "Opaque output",
      mode: "opaque"
    });
  });

  it("describes transparent targets as workflow-dependent alpha", () => {
    expect(describeImageTargetWorkflow(target({ transparent: true }), basePreset)).toMatchObject({
      label: "Alpha workflow expected",
      mode: "transparent"
    });
  });

  it("prefers chroma guidance when target text requests a key color", () => {
    expect(
      describeImageTargetWorkflow(
        target({ transparent: true }),
        basePreset,
        "Full-body character on flat green chroma."
      )
    ).toMatchObject({
      label: "Chroma workflow expected",
      mode: "chroma"
    });
  });
});
