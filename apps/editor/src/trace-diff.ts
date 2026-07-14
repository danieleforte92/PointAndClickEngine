import type { RuntimeDebugSnapshot } from "@pointclick/contracts";

export type RuntimeSnapshotField =
  | "sceneId"
  | "player"
  | "flags"
  | "inventory"
  | "activeFlowId"
  | "activeNodeId"
  | "dialogueKey"
  | "path"
  | "events"
  | "audio";

export interface RuntimeTraceDivergence {
  actual: unknown;
  expected: unknown;
  field: RuntimeSnapshotField | "length" | "sequence";
  index: number;
  sequence: number | null;
}
const comparedFields: RuntimeSnapshotField[] = [
  "sceneId",
  "player",
  "flags",
  "inventory",
  "activeFlowId",
  "activeNodeId",
  "dialogueKey",
  "path",
  "events",
  "audio"
];

function equal(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function firstRuntimeTraceDivergence(
  expected: readonly RuntimeDebugSnapshot[],
  actual: readonly RuntimeDebugSnapshot[]
): RuntimeTraceDivergence | null {
  const length = Math.min(expected.length, actual.length);
  for (let index = 0; index < length; index += 1) {
    const left = expected[index]!;
    const right = actual[index]!;
    if (left.sequence !== right.sequence) {
      return { actual: right.sequence, expected: left.sequence, field: "sequence", index, sequence: null };
    }
    for (const field of comparedFields) {
      if (!equal(left[field], right[field])) {
        return {
          actual: right[field],
          expected: left[field],
          field,
          index,
          sequence: left.sequence
        };
      }
    }
  }
  if (expected.length !== actual.length) {
    return {
      actual: actual.length,
      expected: expected.length,
      field: "length",
      index: length,
      sequence: expected[length]?.sequence ?? actual[length]?.sequence ?? null
    };
  }
  return null;
}
