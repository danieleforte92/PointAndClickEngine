import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createLogRecord, LocalErrorLogger } from "./error-logging";

describe("local error logging", () => {
  it("redacts credential-like fields and writes JSONL records", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "pointclick-log-"));
    const logger = new LocalErrorLogger(directory);

    await logger.log(
      createLogRecord("provider-error", "error", {
        apiKey: "must-not-be-written",
        message: "provider unavailable"
      })
    );

    const content = await readFile(path.join(directory, "pointclick.log"), "utf8");
    expect(content).toContain("provider unavailable");
    expect(content).not.toContain("must-not-be-written");
    await logger.logError("network-error", new Error("Bearer sk-live-secret"));
    const errorContent = await readFile(path.join(directory, "pointclick.log"), "utf8");
    expect(errorContent).not.toContain("sk-live-secret");
    expect(content.trim().split("\n")).toHaveLength(1);
  });
});
