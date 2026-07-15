import type { RuntimeDebugSnapshot } from "@pointclick/contracts";
import { testLabTraceStatus, type TestLabTraceStatus } from "./test-lab-model";

export interface TestLabController {
  traceStatus(snapshots: RuntimeDebugSnapshot[], browserTrace: RuntimeDebugSnapshot[]): TestLabTraceStatus;
  keyboardShortcutLabel(): string;
}

export function createTestLabController(): TestLabController {
  return {
    traceStatus: testLabTraceStatus,
    keyboardShortcutLabel: () => "Escape closes Test Lab"
  };
}
