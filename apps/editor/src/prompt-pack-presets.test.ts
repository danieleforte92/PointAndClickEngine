import { describe, expect, it } from "vitest";
import {
  buildGuidedArtBrief,
  defaultPromptPresetSelection,
  pointClickCoreNegativePrompt
} from "./prompt-pack-presets";

describe("Prompt pack presets", () => {
  it("composes selected preset blocks into the guided art brief", () => {
    const brief = buildGuidedArtBrief("A test pirate scene.", {
      customGameplayFocus: "Keep the locked hatch visible.",
      customMood: "",
      customPalette: "",
      customSetting: "",
      customStyle: "",
      gameplayEmphasisPresetIds: defaultPromptPresetSelection.gameplayEmphasisPresets,
      moodPresetId: defaultPromptPresetSelection.moodPreset,
      palettePresetId: defaultPromptPresetSelection.palettePreset,
      settingPresetId: defaultPromptPresetSelection.settingPreset,
      visualStylePresetId: defaultPromptPresetSelection.visualStylePreset
    });

    expect(brief).toContain("Hand-painted 2D comedic point-and-click adventure game aesthetic");
    expect(brief).toContain("clear walkable area in the lower half of the scene");
    expect(brief).toContain("Keep the locked hatch visible.");
    expect(brief).toContain(pointClickCoreNegativePrompt);
    expect(brief).toContain("original IP only");
  });
});
