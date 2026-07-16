import type { Polygon2, ScenePlayerConfig, Vector2 } from "./schemas";

export function playerPerspectiveScaleAt(
  walkArea: Polygon2 | undefined,
  player: Pick<ScenePlayerConfig, "scaleFar" | "scaleNear"> | null | undefined,
  position: Vector2
): number {
  const far = player?.scaleFar ?? 0.62;
  const near = player?.scaleNear ?? 1.08;
  const ys = walkArea?.points.map((point) => point.y) ?? [];
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  if (ys.length === 0 || maxY <= minY) return near;

  const t = Math.max(0, Math.min(1, (position.y - minY) / (maxY - minY)));
  return far + (near - far) * t;
}
