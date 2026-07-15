import { describe, expect, it } from "vitest";
import { createBuildController } from "./build-controller";

describe("Build controller", () => {
  it("only enables export after a clean validation report", () => {
    const controller = createBuildController();
    expect(controller.canExport(null)).toBe(false);
  });
});
