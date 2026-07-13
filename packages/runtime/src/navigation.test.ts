import { describe, expect, it } from "vitest";
import type { Polygon2 } from "@pointclick/contracts";
import {
  closestPointOnPolygon,
  createNavigationGrid,
  NavigationGridCache,
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

  it("rejects diagonal corner cutting", () => {
    const grid = {
      cellSize: 1,
      height: 2,
      origin: { x: 0, y: 0 },
      walkable: [true, false, false, true],
      width: 2
    };

    expect(findPath(grid, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull();
  });

  it("caches grids by scene and invalidates changed inputs", () => {
    const cache = new NavigationGridCache();
    const first = cache.get("dock", dockPolygon, 24);
    const second = cache.get("dock", dockPolygon, 24);

    expect(second).toBe(first);
    expect(cache.buildCount).toBe(1);

    const differentCellSize = cache.get("dock", dockPolygon, 20);
    expect(differentCellSize).not.toBe(first);
    expect(cache.buildCount).toBe(2);

    const changedWalkArea = {
      points: dockPolygon.points.map((point, index) => ({
        x: point.x + (index === 0 ? 1 : 0),
        y: point.y
      }))
    };
    const changedAreaGrid = cache.get("dock", changedWalkArea, 20);
    expect(changedAreaGrid).not.toBe(differentCellSize);
    expect(cache.buildCount).toBe(3);

    cache.invalidate("dock");
    cache.get("dock", dockPolygon, 20);
    expect(cache.buildCount).toBe(4);
  });

  it("returns deterministic waypoints ending at the resolved goal", () => {
    const first = resolveWalkTarget(dockPolygon, { x: 510, y: 590 }, { x: 20, y: 390 }, 24);
    const second = resolveWalkTarget(dockPolygon, { x: 510, y: 590 }, { x: 20, y: 390 }, 24);

    expect(first?.waypoints).toEqual(second?.waypoints);
    expect(first?.waypoints.at(-1)).toEqual(first?.goal);
  });
});
