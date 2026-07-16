import { describe, expect, it } from "vitest";
import { playerPerspectiveScaleAt } from "./scene-math";

describe("playerPerspectiveScaleAt", () => {
  const walkArea = {
    points: [
      { x: 0, y: 100 },
      { x: 1280, y: 100 },
      { x: 1280, y: 700 }
    ]
  };

  it("interpolates from far to near across the walk area", () => {
    expect(playerPerspectiveScaleAt(walkArea, { scaleFar: 0.5, scaleNear: 1.25 }, { x: 0, y: 100 })).toBe(0.5);
    expect(playerPerspectiveScaleAt(walkArea, { scaleFar: 0.5, scaleNear: 1.25 }, { x: 0, y: 400 })).toBe(0.875);
    expect(playerPerspectiveScaleAt(walkArea, { scaleFar: 0.5, scaleNear: 1.25 }, { x: 0, y: 700 })).toBe(1.25);
  });

  it("clamps positions outside the walk area and falls back to near without an area", () => {
    expect(playerPerspectiveScaleAt(walkArea, { scaleFar: 0.5, scaleNear: 1.25 }, { x: 0, y: -10 })).toBe(0.5);
    expect(playerPerspectiveScaleAt(walkArea, { scaleFar: 0.5, scaleNear: 1.25 }, { x: 0, y: 900 })).toBe(1.25);
    expect(playerPerspectiveScaleAt(undefined, { scaleFar: 0.5, scaleNear: 1.25 }, { x: 0, y: 400 })).toBe(1.25);
  });
});
