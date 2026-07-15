import { describe, expect, it } from "vitest";
import { assetStudioReducer, initialAssetStudioState } from "./asset-studio-state";

describe("asset studio state", () => {
  it("keeps browser filters and editing tool independent", () => {
    const filtered = assetStudioReducer(
      assetStudioReducer(initialAssetStudioState, { type: "filter/query", query: "harbor" }),
      { type: "filter/kind", kind: "image" }
    );
    const editing = assetStudioReducer(filtered, { type: "tool/select", tool: "crop" });

    expect(editing).toMatchObject({ activeTool: "crop", resourceKind: "image", resourceQuery: "harbor" });
    expect(initialAssetStudioState).toEqual({
      activeTool: "info",
      resourceHealth: "all",
      resourceKind: "all",
      resourceQuery: "",
      resourceViewMode: "list"
    });
  });

  it("supports both resource presentation modes", () => {
    expect(
      assetStudioReducer(initialAssetStudioState, { type: "view-mode/select", mode: "grid" }).resourceViewMode
    ).toBe("grid");
  });
});
