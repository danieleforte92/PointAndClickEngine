import { describe, expect, it } from "vitest";
import {
  healthSummary,
  parseWalkAreaDraft,
  providerBoundaryStatus,
  sceneSelectionKindLabel
} from "./editor-ui-model";

describe("editor-ui-model", () => {
  it("parses walk-area drafts without accepting partial coordinates", () => {
    expect(parseWalkAreaDraft([{ x: "12.5", y: "8" }, { x: "40", y: "18" }])).toEqual({
      points: [
        { x: 12.5, y: 8 },
        { x: 40, y: 18 }
      ]
    });
    expect(parseWalkAreaDraft([{ x: "12.5", y: "not-a-number" }])).toBeNull();
  });

  it("keeps inspector labels stable across scene selection kinds", () => {
    expect(sceneSelectionKindLabel("walk-area")).toBe("Walk Area");
    expect(sceneSelectionKindLabel("player-start")).toBe("Player");
  });

  it("reports provider boundaries and clean project health", () => {
    expect(providerBoundaryStatus("mock", "", "http://localhost:8188")).toMatchObject({
      label: "Offline",
      tone: "good"
    });
    expect(providerBoundaryStatus("openai", "https://api.example.com/v1", "")).toMatchObject({
      label: "Remote · consent",
      tone: "warn"
    });
    expect(healthSummary([], 0)).toEqual({
      detail: "No draft changes pending",
      label: "Project ready for preview",
      tone: "good"
    });
  });
});
