import { describe, expect, it } from "vitest";
import { createShellController } from "./shell-controller";

describe("Shell controller", () => {
  it("clamps panel resizing to the compact studio range", () => {
    const controller = createShellController();
    expect(controller.resize(300, -200)).toBe(220);
    expect(controller.resize(300, 300)).toBe(520);
    expect(controller.panelLabel("inspector")).toBe("Inspector");
  });
});
