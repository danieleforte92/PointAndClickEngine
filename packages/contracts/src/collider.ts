import type { ColliderShape, Rect, Vector2 } from "./schemas";

export interface HotspotGeometrySource {
  bounds?: Rect | undefined;
  shape?: ColliderShape | undefined;
}

const EPSILON = 1e-7;

/** Return the canonical collider for a hotspot, including legacy rectangles. */
export function hotspotCollider(hotspot: HotspotGeometrySource): ColliderShape {
  if (hotspot.shape) return hotspot.shape;
  if (hotspot.bounds) return { type: "rect", bounds: { ...hotspot.bounds } };
  throw new Error("Hotspot collider geometry is missing.");
}

export function colliderBounds(shape: ColliderShape): Rect {
  if (shape.type !== "polygon") return { ...shape.bounds };
  const xs = shape.points.map((point) => point.x);
  const ys = shape.points.map((point) => point.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  };
}

function pointOnSegment(point: Vector2, start: Vector2, end: Vector2): boolean {
  const cross = (point.y - start.y) * (end.x - start.x) - (point.x - start.x) * (end.y - start.y);
  if (Math.abs(cross) > EPSILON) return false;
  const dot = (point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y);
  if (dot < -EPSILON) return false;
  const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  return dot <= lengthSquared + EPSILON;
}

export function pointInPolygon(point: Vector2, points: readonly Vector2[]): boolean {
  if (points.length < 3) return false;
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const currentPoint = points[index]!;
    const previousPoint = points[previous]!;
    if (pointOnSegment(point, previousPoint, currentPoint)) return true;
    const crosses = currentPoint.y > point.y !== previousPoint.y > point.y;
    if (
      crosses &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

export function pointInCollider(point: Vector2, shape: ColliderShape): boolean {
  if (shape.type === "polygon") return pointInPolygon(point, shape.points);
  const { x, y, width, height } = shape.bounds;
  if (shape.type === "rect") {
    return point.x >= x - EPSILON && point.x <= x + width + EPSILON && point.y >= y - EPSILON && point.y <= y + height + EPSILON;
  }
  if (width <= 0 || height <= 0) return false;
  const normalizedX = (point.x - (x + width / 2)) / (width / 2);
  const normalizedY = (point.y - (y + height / 2)) / (height / 2);
  return normalizedX ** 2 + normalizedY ** 2 <= 1 + EPSILON;
}

export function pointInHotspot(point: Vector2, hotspot: HotspotGeometrySource): boolean {
  return pointInCollider(point, hotspotCollider(hotspot));
}
