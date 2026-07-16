import { describe, expect, it } from "vitest";
import { colliderBounds, pointInCollider, pointInHotspot } from "./collider";

describe("ColliderShape geometry", () => {
  it("hit-tests rectangle and ellipse boundaries", () => {
    const rect = { type: "rect" as const, bounds: { x: 10, y: 20, width: 100, height: 50 } };
    const ellipse = { type: "ellipse" as const, bounds: { x: 10, y: 20, width: 100, height: 50 } };

    expect(pointInCollider({ x: 10, y: 20 }, rect)).toBe(true);
    expect(pointInCollider({ x: 110, y: 70 }, rect)).toBe(true);
    expect(pointInCollider({ x: 111, y: 70 }, rect)).toBe(false);
    expect(pointInCollider({ x: 60, y: 45 }, ellipse)).toBe(true);
    expect(pointInCollider({ x: 10, y: 20 }, ellipse)).toBe(false);
  });

  it("hit-tests polygons and exposes their bounds", () => {
    const polygon = {
      type: "polygon" as const,
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 80 }]
    };
    expect(pointInCollider({ x: 50, y: 30 }, polygon)).toBe(true);
    expect(pointInCollider({ x: 50, y: 80 }, polygon)).toBe(true);
    expect(pointInCollider({ x: 5, y: 70 }, polygon)).toBe(false);
    expect(colliderBounds(polygon)).toEqual({ x: 0, y: 0, width: 100, height: 80 });
  });

  it("keeps legacy hotspot rectangles readable", () => {
    expect(pointInHotspot({ x: 30, y: 30 }, { bounds: { x: 20, y: 20, width: 20, height: 20 } })).toBe(true);
  });
});
