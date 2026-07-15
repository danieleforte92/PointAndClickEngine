import { describe, expect, it } from "vitest";
import { createAssetStudioController } from "./asset-studio-controller";
import { initialAssetStudioState } from "./asset-studio-state";

describe("Assets controller", () => {
  it("keeps browser filters and tool semantics in one boundary", () => {
    const controller = createAssetStudioController();
    const next = controller.reduce(initialAssetStudioState, { type: "filter/query", query: "hero" });
    expect(controller.hasActiveFilter(next)).toBe(true);
    expect(controller.toolLabel(next)).toBe("Asset details");
  });
});
