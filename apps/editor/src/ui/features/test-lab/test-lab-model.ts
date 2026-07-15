import type { RuntimeDebugSnapshot } from "@pointclick/contracts";
import { firstRuntimeTraceDivergence } from "../../../trace-diff";

export type TestLabTraceStatus = "awaiting-browser" | "aligned" | "diverged";

export function testLabTraceStatus(
  snapshots: RuntimeDebugSnapshot[],
  browserTrace: RuntimeDebugSnapshot[]
): TestLabTraceStatus {
  if (browserTrace.length === 0) return "awaiting-browser";
  return firstRuntimeTraceDivergence(snapshots, browserTrace) ? "diverged" : "aligned";
}
