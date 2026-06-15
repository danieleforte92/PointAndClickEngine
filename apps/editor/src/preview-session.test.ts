import { describe, expect, it } from "vitest";
import type {
  FlowDocument,
  ItemDocument,
  LocaleDocument,
  ProjectManifest,
  SceneDocument
} from "@pointclick/contracts";
import { buildDraftProjectBundle } from "./preview-session";
import { initializeEditorSession } from "./editor-session";
import type { EditorProjectSnapshot } from "./preload";

const manifest: ProjectManifest = {
  schemaVersion: 1,
  id: "isle-of-echoes",
  title: "The Isle of Echoes",
  initialSceneId: "moonlit-dock",
  defaultLocale: "en",
  viewport: { width: 1280, height: 720 },
  scenes: [{ id: "moonlit-dock", path: "scenes/moonlit-dock.scene.json" }],
  flows: [{ id: "look-door", path: "flows/look-door.flow.json" }],
  items: [{ id: "rusty-hook", path: "items/rusty-hook.item.json" }],
  assets: [],
  locales: [{ locale: "en", path: "locales/en.json" }]
};

const scene: SceneDocument = {
  schemaVersion: 1,
  id: "moonlit-dock",
  name: "Moonlit Dock",
  type: "layered-2d",
  size: { width: 1280, height: 720 },
  background: "#123456",
  playerStart: { x: 500, y: 590 },
  walkArea: {
    points: [
      { x: 0, y: 500 },
      { x: 1280, y: 500 },
      { x: 1280, y: 720 }
    ]
  },
  pickups: [
    {
      id: "dock-hook",
      itemId: "rusty-hook",
      labelKey: "pickup.rusty-hook",
      bounds: { x: 300, y: 560, width: 70, height: 60 }
    }
  ],
  shapes: [],
  hotspots: [
    {
      id: "tavern-door",
      labelKey: "hotspot.tavern-door",
      bounds: { x: 900, y: 340, width: 100, height: 200 },
      actions: {
        lookFlowId: "look-door",
        useItemFlows: []
      }
    }
  ]
};

const flow: FlowDocument = {
  schemaVersion: 1,
  id: "look-door",
  name: "Look at door",
  startNodeId: "line-1",
  nodes: [
    {
      id: "line-1",
      type: "line",
      speakerId: "mara",
      textKey: "dialogue.look-door",
      next: "end"
    },
    { id: "end", type: "end" }
  ]
};

const locale: LocaleDocument = {
  schemaVersion: 1,
  locale: "en",
  strings: {
    "dialogue.look-door": "The door looks solid.",
    "hotspot.tavern-door": "The Lantern & Gull",
    "item.rusty-hook": "Rusty Hook",
    "pickup.rusty-hook": "Rusty Hook"
  }
};

const item: ItemDocument = {
  schemaVersion: 1,
  id: "rusty-hook",
  name: "Rusty Hook",
  labelKey: "item.rusty-hook"
};

const snapshot: EditorProjectSnapshot = {
  activeAssetId: null,
  activeFlowId: flow.id,
  activeHotspotId: "tavern-door",
  activeItemId: item.id,
  activeLocale: locale.locale,
  activePickupId: "dock-hook",
  activeSceneId: scene.id,
  assetCount: 0,
  assets: [],
  diagnostics: [],
  directory: "D:/Work/PointAndClickEngine/apps/sample-game/project",
  flowCount: 1,
  flows: [flow],
  itemCount: 1,
  items: [item],
  localeCount: 1,
  locales: [locale],
  manifest,
  selectedAsset: null,
  sceneCount: 1,
  scenes: [scene],
  selectedFlow: flow,
  selectedHotspot: scene.hotspots[0]!,
  selectedItem: item,
  selectedLocale: locale,
  selectedPickup: scene.pickups[0]!,
  selectedScene: scene
};

describe("buildDraftProjectBundle", () => {
  it("applies unsaved scene, flow, locale, item, hotspot, and pickup drafts", () => {
    const session = initializeEditorSession(snapshot);
    session.sceneDrafts[scene.id] = {
      background: "#654321",
      name: "Moonlit Dock Revised",
      playerStartX: "480",
      playerStartY: "575",
      walkAreaPoints: [
        { x: "0", y: "480" },
        { x: "1280", y: "480" },
        { x: "1280", y: "720" }
      ]
    };
    session.hotspotDrafts[`${scene.id}::tavern-door`] = {
      cursor: "enter",
      height: "210",
      labelKey: "hotspot.tavern-door.updated",
      lookFlowId: "look-door",
      talkFlowId: "",
      useFlowId: "",
      useItemFlows: [{ itemId: "rusty-hook", flowId: "look-door" }],
      width: "120",
      x: "890",
      y: "330"
    };
    session.pickupDrafts[`${scene.id}::pickup::dock-hook`] = {
      height: "48",
      itemId: "rusty-hook",
      labelKey: "pickup.rusty-hook.updated",
      pickupFlowId: "look-door",
      width: "78",
      x: "320",
      y: "552"
    };
    session.itemDrafts[item.id] = {
      labelKey: "item.rusty-hook.updated",
      name: "Harbor Hook"
    };
    session.localeDrafts.en = {
      ...locale.strings,
      "dialogue.look-door": "The revised door."
    };
    session.localeEntryDrafts.en = {
      key: "dialogue.extra",
      value: "Extra line"
    };
    session.flowDrafts[flow.id] = {
      id: flow.id,
      name: "Look at door again",
      startNodeId: "line-1",
      nodes: [
        {
          id: "line-1",
          type: "line",
          speakerId: "mara",
          textKey: "dialogue.look-door",
          next: "end"
        },
        { id: "end", type: "end" }
      ]
    };

    const bundle = buildDraftProjectBundle(snapshot, session);
    const nextScene = bundle.scenes["moonlit-dock"];
    expect(nextScene?.type).toBe("layered-2d");
    if (!nextScene || nextScene.type !== "layered-2d") {
      throw new Error("Expected layered 2D scene");
    }
    const nextHotspot = nextScene.hotspots[0];
    const nextPickup = nextScene.pickups[0];

    expect(nextScene).toMatchObject({
      background: "#654321",
      name: "Moonlit Dock Revised",
      playerStart: { x: 480, y: 575 }
    });
    expect(nextHotspot).toMatchObject({
      labelKey: "hotspot.tavern-door.updated",
      cursor: "enter",
      actions: {
        lookFlowId: "look-door"
      }
    });
    expect(nextPickup).toMatchObject({
      labelKey: "pickup.rusty-hook.updated",
      pickupFlowId: "look-door"
    });
    expect(bundle.items["rusty-hook"]).toMatchObject({
      name: "Harbor Hook",
      labelKey: "item.rusty-hook.updated"
    });
    expect(bundle.locales.en?.strings["dialogue.look-door"]).toBe("The revised door.");
    expect(bundle.locales.en?.strings["dialogue.extra"]).toBe("Extra line");
    expect(bundle.flows["look-door"]?.name).toBe("Look at door again");
  });
});
