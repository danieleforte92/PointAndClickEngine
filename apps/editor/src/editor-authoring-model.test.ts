import { describe, expect, it } from "vitest";
import type { EditorProjectSnapshot } from "./preload";
import {
  buildSceneLayersFromDraft,
  createDefaultActor,
  createDefaultFlowDocument,
  createDefaultHotspot,
  createDefaultPickup,
  createDefaultSceneDocument,
  nextActorId,
  nextAnimationPackId,
  nextFlowId,
  nextHotspotId,
  nextItemId,
  nextPickupId,
  nextSceneId,
  scenePointIsInside,
  summarizeActorViewportIssues,
  summarizeHotspotViewportIssues
} from "./editor-authoring-model";

function snapshot(): EditorProjectSnapshot {
  return {
    animationPacks: [{ id: "new-animation-pack" }],
    flows: [{ id: "new-flow" }],
    items: [{ id: "new-item" }],
    manifest: { viewport: { height: 576, width: 1024 } },
    scenes: [{ id: "new-scene" }]
  } as EditorProjectSnapshot;
}

describe("editor-authoring-model", () => {
  it("allocates stable ids without colliding with existing documents", () => {
    const project = snapshot();
    expect(nextAnimationPackId(project)).toBe("new-animation-pack-1");
    expect(nextFlowId(project)).toBe("new-flow-1");
    expect(nextItemId(project)).toBe("new-item-1");
    expect(nextSceneId(project)).toBe("new-scene-1");

    const scene = createDefaultSceneDocument(project, "scene");
    expect(nextHotspotId({ ...scene, hotspots: [createDefaultHotspot(scene, "new-hotspot")] })).toBe("new-hotspot-1");
    expect(nextPickupId({ ...scene, pickups: [createDefaultPickup(scene, "new-pickup", "item")] })).toBe("new-pickup-1");
    expect(nextActorId({ ...scene, actors: [createDefaultActor(scene, "new-actor")] })).toBe("new-actor-1");
  });

  it("creates documents sized to the project viewport", () => {
    const project = snapshot();
    const flow = createDefaultFlowDocument("intro");
    const scene = createDefaultSceneDocument(project, "scene");
    const hotspot = createDefaultHotspot(scene, "door");
    const pickup = createDefaultPickup(scene, "key", "item-key");
    const actor = createDefaultActor(scene, "hero");

    expect(flow.nodes).toHaveLength(2);
    expect(flow.nodes[0]).toMatchObject({ next: "end-1", textKey: "dialogue.intro.01", type: "line" });
    expect(scene.size).toEqual({ height: 576, width: 1024 });
    expect(scene.walkArea.points).toHaveLength(4);
    expect(hotspot.bounds.width).toBeGreaterThanOrEqual(80);
    expect(pickup.itemId).toBe("item-key");
    expect(actor.role).toBe("prop");
  });

  it("summarizes viewport guardrails without mutating authoring documents", () => {
    const project = snapshot();
    const scene = createDefaultSceneDocument(project, "scene");
    const hotspot = createDefaultHotspot(scene, "door");
    const invalidHotspot = {
      ...hotspot,
      actions: { ...hotspot.actions, lookFlowId: "missing-flow" },
      interactSpot: { x: -1, y: 0 }
    };
    const summary = summarizeHotspotViewportIssues(
      invalidHotspot,
      scene,
      new Set(["known-flow"]),
      new Set(["item-key"]),
      "en",
      { [hotspot.labelKey]: "Door" }
    );

    expect(summary).toMatchObject({ hasIssues: true, tone: "error" });
    expect(summary.detail).toContain("missing-flow");
    expect(hotspot.interactSpot?.x).toBeGreaterThanOrEqual(0);

    const actor = createDefaultActor(scene, "hero");
    const actorSummary = summarizeActorViewportIssues(
      { ...actor, assetId: "missing-asset" },
      scene,
      new Set(["hero.png"]),
      new Set(),
      new Set(),
      new Set(),
      "en",
      { [actor.labelKey]: "Hero" }
    );
    expect(actorSummary.detail).toContain("missing-asset");
  });

  it("keeps scene points and layer drafts within their authoring guardrails", () => {
    expect(scenePointIsInside({ x: 2, y: 3 }, { height: 10, width: 10 })).toBe(true);
    expect(scenePointIsInside({ x: 11, y: 3 }, { height: 10, width: 10 })).toBe(false);

    expect(
      buildSceneLayersFromDraft(
        [
          {
            assetId: "bg",
            depth: "0",
            height: "576",
            id: "background",
            locked: false,
            name: "Background",
            opacity: "1",
            visible: true,
            width: "1024",
            x: "0",
            y: "0"
          }
        ],
        new Set(["bg"])
      )
    ).toMatchObject({ error: null, layers: [{ assetId: "bg", id: "background" }] });

    expect(
      buildSceneLayersFromDraft(
        [{
          assetId: "missing",
          depth: "0",
          height: "576",
          id: "background",
          locked: false,
          name: "Background",
          opacity: "1",
          visible: true,
          width: "1024",
          x: "0",
          y: "0"
        }],
        new Set()
      ).error
    ).toContain("no longer exists");
  });
});
