import { describe, expect, it } from "vitest";
import type { Polygon2 } from "@pointclick/contracts";
import {
  closestPointOnPolygon,
  createNavigationGrid,
  findPath,
  isDegeneratePolygon,
  nearestWalkableCell,
  pointInPolygon,
  resolveWalkTarget
} from "./navigation";

const dockPolygon: Polygon2 = {
  points: [
    { x: 80, y: 470 },
    { x: 1180, y: 470 },
    { x: 1200, y: 550 },
    { x: 1120, y: 660 },
    { x: 160, y: 675 },
    { x: 60, y: 560 }
  ]
};

const concavePolygon: Polygon2 = {
  points: [
    { x: 0, y: 0 },
    { x: 160, y: 0 },
    { x: 160, y: 60 },
    { x: 90, y: 60 },
    { x: 90, y: 150 },
    { x: 0, y: 150 }
  ]
};

describe("navigation geometry", () => {
  it("detects inside and outside points for polygons", () => {
    expect(pointInPolygon({ x: 240, y: 560 }, dockPolygon)).toBe(true);
    expect(pointInPolygon({ x: 30, y: 410 }, dockPolygon)).toBe(false);
  });

  it("projects an outside point to the nearest polygon boundary", () => {
    const projected = closestPointOnPolygon({ x: 40, y: 420 }, dockPolygon);
    expect(projected.x).toBeGreaterThanOrEqual(60);
    expect(projected.y).toBeGreaterThanOrEqual(470);
    expect(pointInPolygon(projected, dockPolygon)).toBe(true);
  });

  it("rejects zero-area polygons", () => {
    expect(
      isDegeneratePolygon({
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 20, y: 0 }
        ]
      })
    ).toBe(true);
  });
});

describe("navigation pathfinding", () => {
  it("finds a path through a concave polygon", () => {
    const grid = createNavigationGrid(concavePolygon, 20);
    if (!grid) {
      throw new Error("Expected navigation grid");
    }

    const start = nearestWalkableCell(grid, { x: 20, y: 20 });
    const goal = nearestWalkableCell(grid, { x: 40, y: 130 });
    if (!start || !goal) {
      throw new Error("Expected start and goal cells");
    }

    const path = findPath(grid, start, goal);
    expect(path).not.toBeNull();
    expect(path?.length).toBeGreaterThan(2);
  });

  it("projects outside clicks and resolves a deterministic endpoint", () => {
    const resolution = resolveWalkTarget(
      dockPolygon,
      { x: 510, y: 590 },
      { x: 20, y: 390 },
      24
    );

    expect(resolution).not.toBeNull();
    expect(resolution?.goal.x).toBe(80);
    expect(resolution?.goal.y).toBe(470);
    expect(resolution?.path.length).toBeGreaterThan(0);
  });
});
