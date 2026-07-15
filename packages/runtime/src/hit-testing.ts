import { pointInHotspot, type Hotspot, type Layered2DScene, type Vector2 } from "@pointclick/contracts";
import { colliderBounds, hotspotCollider } from "@pointclick/contracts/collider";

/** Runtime hit testing uses the same collider shape as the editor renderer. */
export function findHotspotAtPoint(scene: Layered2DScene, point: Vector2): Hotspot | null {
  const hotspot = [...scene.hotspots]
    .reverse()
    .find((hotspot) => pointInHotspot(point, hotspot)) ?? null;
  if (!hotspot) return null;
  return {
    ...hotspot,
    bounds: hotspot.bounds ?? colliderBounds(hotspotCollider(hotspot))
  } as Hotspot;
}
