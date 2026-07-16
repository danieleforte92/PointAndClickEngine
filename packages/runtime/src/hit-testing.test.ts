import { describe, expect, it } from "vitest";
import type { Layered2DScene } from "@pointclick/contracts";
import { findHotspotAtPoint } from "./hit-testing";

const scene = {
  id: "room",
  name: "Room",
  schemaVersion: 3,
  type: "layered-2d",
  size: { width: 640, height: 360 },
  background: "#000000",
  playerStart: { x: 20, y: 20 },
  walkArea: { points: [{ x: 0, y: 0 }, { x: 640, y: 0 }, { x: 640, y: 360 }] },
  actors: [],
  pickups: [],
  shapes: [],
  hotspots: [
    {
      id: "ellipse",
      labelKey: "ellipse",
      bounds: { x: 0, y: 0, width: 120, height: 80 },
      shape: { type: "ellipse", bounds: { x: 0, y: 0, width: 120, height: 80 } },
      actions: { useItemFlows: [] }
    },
    {
      id: "polygon",
      labelKey: "polygon",
      bounds: { x: 160, y: 0, width: 120, height: 100 },
      shape: { type: "polygon", points: [{ x: 160, y: 0 }, { x: 280, y: 0 }, { x: 220, y: 100 }] },
      actions: { useItemFlows: [] }
    }
  ]
} satisfies Layered2DScene;

describe("runtime collider hit testing", () => {
  it("resolves the clickable shape rather than its bounding rectangle", () => {
    expect(findHotspotAtPoint(scene, { x: 60, y: 40 })?.id).toBe("ellipse");
    expect(findHotspotAtPoint(scene, { x: 0, y: 0 })).toBeNull();
    expect(findHotspotAtPoint(scene, { x: 160, y: 90 })).toBeNull();
    expect(findHotspotAtPoint(scene, { x: 220, y: 40 })?.id).toBe("polygon");
  });
});
