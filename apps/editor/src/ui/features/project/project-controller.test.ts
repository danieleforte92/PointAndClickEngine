import { describe, expect, it } from "vitest";
import { createProjectController } from "./project-controller";

describe("Project controller", () => {
  it("keeps save readiness independent from rendering", () => {
    const controller = createProjectController();
    expect(controller.canSave("Demo", { width: 640, height: 360 })).toBe(true);
    expect(controller.canSave("", { width: 640, height: 360 })).toBe(false);
  });
});
