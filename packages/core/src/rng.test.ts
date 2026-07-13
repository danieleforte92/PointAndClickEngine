import { describe, expect, it } from "vitest";
import { DeterministicRng } from "./rng";

describe("deterministic RNG", () => {
  it("produces the same sequence for the same seed", () => {
    const left = new DeterministicRng(1234);
    const right = new DeterministicRng(1234);

    expect([left.next(), left.next(), left.next()]).toEqual([right.next(), right.next(), right.next()]);
  });

  it("can snapshot its state and avoids a zero seed", () => {
    const rng = new DeterministicRng(0);
    const first = rng.next();
    const snapshot = rng.snapshot();
    const next = rng.next();

    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
    expect(snapshot).not.toBe(0);
    expect(next).not.toBe(first);
  });
});
