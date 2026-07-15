import { describe, expect, it } from "vitest";
import { createTestLabController } from "./test-lab-controller";

describe("Test Lab controller", () => {
  it("keeps browser replay status deterministic", () => {
    const controller = createTestLabController();
    expect(controller.traceStatus([], [])).toBe("awaiting-browser");
    expect(controller.keyboardShortcutLabel()).toContain("Escape");
  });
});
