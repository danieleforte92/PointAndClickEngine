import { describe, expect, it } from "vitest";
import { normalizePromptPackOutputs } from "./prompt-pack-output-normalizer";

describe("normalizePromptPackOutputs", () => {
  it("accepts provider responses with string notes and fenced JSON", () => {
    const outputs = normalizePromptPackOutputs(
      `\`\`\`json
{
  "sceneBackgroundPrompt": "A damp cavern interior.",
  "propPrompts": [
    { "id": "stone_archway", "prompt": "Weathered stone archway." },
    { "id": "", "prompt": "ignored" },
    { "id": "broken" }
  ],
  "characterReferencePrompts": [],
  "animationNotes": "Keep readable silhouettes.",
  "negativePrompt": "text overlays",
  "styleNotes": "Hand-painted 2D aesthetic."
}
\`\`\``,
      "LM Studio"
    );

    expect(outputs).toEqual({
      sceneBackgroundPrompt: "A damp cavern interior.",
      propPrompts: [{ id: "stone_archway", prompt: "Weathered stone archway." }],
      characterReferencePrompts: [],
      animationNotes: ["Keep readable silhouettes."],
      negativePrompt: "text overlays",
      styleNotes: ["Hand-painted 2D aesthetic."]
    });
  });

  it("throws a provider-specific error when the response is not usable", () => {
    expect(() => normalizePromptPackOutputs("{}", "Local model")).toThrow(
      "Local model response did not include sceneBackgroundPrompt"
    );
  });
});
