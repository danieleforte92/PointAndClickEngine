import { describe, expect, it } from "vitest";
import type { FlowDocument, ProjectBundle } from "@pointclick/contracts";
import { MemorySaveStorage } from "@pointclick/save";
import { AdventureEngine } from "./engine";

function lineFlow(id: string, textKey: string): FlowDocument {
  return {
    id,
    name: id,
    nodes: [
      {
        id: "line-1",
        next: "end",
        speakerId: "mara",
        textKey,
        type: "line"
      },
      {
        id: "end",
        type: "end"
      }
    ],
    schemaVersion: 1,
    startNodeId: "line-1"
  };
}

function testBundle(): ProjectBundle {
  const lookDoor = lineFlow("look-door", "dialogue.look-door");
  const lookRadio = lineFlow("look-radio", "dialogue.look-radio");

  return {
    assets: {},
    flows: {
      [lookDoor.id]: lookDoor,
      [lookRadio.id]: lookRadio
    },
    items: {
      "brass-key": {
        id: "brass-key",
        labelKey: "item.brass-key",
        name: "Brass Key",
        schemaVersion: 1
      }
    },
    locales: {
      en: {
        locale: "en",
        schemaVersion: 1,
        strings: {
          "actor.locked-panel": "Locked Panel",
          "actor.radio": "Radio",
          "dialogue.look-door": "The door is shut.",
          "dialogue.look-radio": "The radio hums.",
          "hotspot.door": "Door",
          "item.brass-key": "Brass Key",
          "pickup.brass-key": "Brass Key",
          "speaker.mara": "Mara"
        }
      }
    },
    manifest: {
      defaultLocale: "en",
      flows: [
        { id: lookDoor.id, path: "flows/look-door.flow.json" },
        { id: lookRadio.id, path: "flows/look-radio.flow.json" }
      ],
      id: "test-project",
      initialSceneId: "room",
      items: [{ id: "brass-key", path: "items/brass-key.item.json" }],
      locales: [{ locale: "en", path: "locales/en.json" }],
      promptPacks: [],
      animationPacks: [],
      scenes: [{ id: "room", path: "scenes/room.scene.json" }],
      schemaVersion: 1,
      title: "Test Project",
      viewport: { width: 320, height: 240 }
    },
    animationPacks: {},
    promptPacks: {},
    styleBibles: {},
    workflowTemplates: {},
    generationRecipes: {},
    scenes: {
      room: {
        actors: [
          {
            actions: {
              lookFlowId: "look-radio",
              useItemFlows: []
            },
            bounds: { x: 40, y: 40, width: 40, height: 40 },
            depth: 4,
            id: "radio",
            interactSpot: { x: 50, y: 100 },
            labelKey: "actor.radio",
            role: "prop"
          },
          {
            actions: {
              useItemFlows: []
            },
            bounds: { x: 120, y: 40, width: 40, height: 40 },
            depth: 4,
            id: "locked-panel",
            labelKey: "actor.locked-panel",
            role: "prop",
            visibleWhen: { itemId: "brass-key", type: "item-in-inventory" }
          }
        ],
        background: "#000000",
        hotspots: [
          {
            actions: {
              lookFlowId: "look-door",
              useItemFlows: []
            },
            bounds: { x: 180, y: 40, width: 60, height: 120 },
            id: "door",
            interactSpot: { x: 100, y: 100 },
            labelKey: "hotspot.door"
          }
        ],
        id: "room",
        name: "Room",
        pickups: [
          {
            bounds: { x: 20, y: 80, width: 20, height: 20 },
            id: "key-pickup",
            interactSpot: { x: 30, y: 100 },
            itemId: "brass-key",
            labelKey: "pickup.brass-key"
          },
          {
            bounds: { x: 60, y: 80, width: 20, height: 20 },
            id: "key-pickup-second",
            interactSpot: { x: 70, y: 100 },
            itemId: "brass-key",
            labelKey: "pickup.brass-key"
          }
        ],
        playerStart: { x: 10, y: 100 },
        schemaVersion: 1,
        shapes: [],
        size: { width: 320, height: 240 },
        type: "layered-2d",
        walkArea: {
          points: [
            { x: 0, y: 0 },
            { x: 220, y: 0 },
            { x: 220, y: 180 },
            { x: 0, y: 180 }
          ]
        }
      }
    }
  };
}

describe("AdventureEngine interactions", () => {
  it("keeps hotspot interactions pending until movement completes", () => {
    const engine = new AdventureEngine(testBundle());
    engine.start();
    engine.selectVerb("look");

    const pending = engine.interactHotspot("door");

    expect(pending.state.player).toEqual({ x: 10, y: 100 });
    expect(pending.events).toEqual([]);
    expect(pending.pathProgress).not.toBeNull();

    const frame = engine.completeMovement();

    expect(frame.state.player).toEqual({ x: 100, y: 100 });
    expect(frame.events.map((event) => event.type)).toEqual([
      "movement/completed",
      "hotspot/interacted",
      "flow/started"
    ]);
    expect(frame.dialogue?.text).toBe("The door is shut.");
  });

  it("resolves actor interactions through actor events and action flows", () => {
    const engine = new AdventureEngine(testBundle());
    engine.start();
    engine.selectVerb("look");

    const pending = engine.interactActor("radio");
    expect(pending.events).toEqual([]);

    const frame = engine.completeMovement();

    expect(frame.state.player).toEqual({ x: 50, y: 100 });
    expect(frame.events.map((event) => event.type)).toEqual([
      "movement/completed",
      "actor/interacted",
      "flow/started"
    ]);
    expect(frame.dialogue?.text).toBe("The radio hums.");
  });

  it("evaluates conditional actor visibility from world state", () => {
    const engine = new AdventureEngine(testBundle());
    engine.start();

    expect(engine.visibleActors().map((actor) => actor.id)).toEqual(["radio"]);

    engine.selectVerb("use");
    engine.interactPickup("key-pickup");
    engine.completeMovement();

    expect(engine.visibleActors().map((actor) => actor.id)).toEqual(["radio", "locked-panel"]);
  });

  it("does not select an item that has not been collected", () => {
    const engine = new AdventureEngine(testBundle());
    engine.start();

    const frame = engine.toggleSelectedItem("brass-key");

    expect(frame.events).toEqual([]);
    expect(frame.state.selectedItemId).toBeNull();
    expect(frame.feedback).toContain("not in the inventory");
  });

  it("marks a second pickup as collected when its unique item is already owned", () => {
    const engine = new AdventureEngine(testBundle());
    engine.start();
    engine.selectVerb("use");

    const first = engine.interactPickup("key-pickup");
    const firstCompleted = engine.completeMovement();
    const second = engine.interactPickup("key-pickup-second");
    const secondCompleted = engine.completeMovement();

    expect(first.events).toEqual([]);
    expect(firstCompleted.state.inventory).toEqual(["brass-key"]);
    expect(firstCompleted.state.collectedPickups).toEqual(["key-pickup"]);
    expect(second.events).toEqual([]);
    expect(secondCompleted.events.map((event) => event.type)).toContain("pickup/collected");
    expect(secondCompleted.state.inventory).toEqual(["brass-key"]);
    expect(secondCompleted.state.collectedPickups).toEqual(["key-pickup", "key-pickup-second"]);
  });

  it("exposes locale fallback and restores only stable gameplay state", async () => {
    const fingerprint = "a".repeat(64);
    const engine = new AdventureEngine(testBundle(), "it-IT");
    engine.start();
    engine.selectVerb("look");

    const pending = engine.interactHotspot("door");
    expect(pending.pathProgress?.status).toBe("walking");
    expect(() => engine.createSaveDocument("manual-1", fingerprint)).toThrow(
      /movement has completed/
    );

    engine.completeMovement();
    expect(engine.localeInfo).toEqual({
      requested: "it-IT",
      active: "en",
      fallback: "engine"
    });
    engine.setLocale("en-US");
    expect(engine.activeLocale).toBe("en");

    const storage = new MemorySaveStorage();
    const saved = await engine.save(storage, "manual-1", fingerprint);
    const restored = new AdventureEngine(testBundle());
    await restored.restore(storage, "manual-1", fingerprint);

    expect(saved.checkpoint.kind).toBe("stable");
    expect(restored.state).toEqual(engine.state);
    expect(restored.isMoving).toBe(false);
    expect(restored.locale).toBe("en");
  });

  it("starts a scene-entry trigger when the initial scene is entered", () => {
    const bundle = testBundle();
    const entryFlow = {
      ...lineFlow("room-entry", "dialogue.look-radio"),
      sceneEntryTriggers: [{ sceneId: "room", flowId: "room-entry" }]
    };
    bundle.flows[entryFlow.id] = entryFlow;
    bundle.manifest.flows.push({ id: entryFlow.id, path: "flows/room-entry.flow.json" });

    const frame = new AdventureEngine(bundle).start();

    expect(frame.dialogue?.text).toBe("The radio hums.");
    expect(frame.events.map((event) => event.type)).toContain("flow/started");
  });
});
