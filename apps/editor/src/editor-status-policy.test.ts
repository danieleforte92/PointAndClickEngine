import { describe, expect, it } from "vitest";
import { formatEditorError } from "./editor-status-policy";

describe("editor status policy", () => {
  it("keeps the message from an Error instance", () => {
    expect(formatEditorError(new Error("Project is locked"), "Fallback")).toBe("Project is locked");
  });

  it("uses the feature fallback for non-Error failures", () => {
    expect(formatEditorError({ message: "hidden" }, "Project could not be saved")).toBe(
      "Project could not be saved"
    );
    expect(formatEditorError("network failure", "Project could not be saved")).toBe(
      "Project could not be saved"
    );
  });

  it("preserves an empty Error message for behavior compatibility", () => {
    expect(formatEditorError(new Error(), "Project could not be saved")).toBe("");
  });
});
