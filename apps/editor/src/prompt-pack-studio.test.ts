import { describe, expect, it } from "vitest";
import type {
  FlowDocument,
  ItemDocument,
  LocaleDocument,
  ProjectBundle,
  ProjectManifest,
  SceneDocument
} from "@pointclick/contracts";
import { validateDocument } from "@pointclick/contracts";
import { buildPromptPackContext, mockPromptPackProvider } from "./prompt-pack-studio";

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
  animationPacks: [],
  promptPacks: [],
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
  actors: [
    {
      actions: {
        lookFlowId: "look-door",
        useItemFlows: []
      },
      bounds: { x: 100, y: 320, width: 80, height: 90 },
      depth: 6,
      id: "radio",
      labelKey: "actor.radio",
      role: "prop"
    },
    {
      actions: {
        talkFlowId: "look-door",
        useItemFlows: []
      },
      bounds: { x: 760, y: 330, width: 90, height: 180 },
      depth: 7,
      id: "keeper",
      labelKey: "actor.keeper",
      role: "npc"
    }
  ],
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
    "actor.keeper": "The Harbor Keeper",
    "actor.radio": "Radio",
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

const bundle: ProjectBundle = {
  manifest,
  scenes: { [scene.id]: scene },
  flows: { [flow.id]: flow },
  locales: { [locale.locale]: locale },
  items: { [item.id]: item },
  assets: {},
  animationPacks: {},
  promptPacks: {}
};

describe("Prompt Pack Studio", () => {
  it("extracts scene context from bundle documents and localized labels", () => {
    const context = buildPromptPackContext(bundle, scene.id, "Ink wash coastal noir.");

    expect(context).toMatchObject({
      projectTitle: "The Isle of Echoes",
      sceneId: "moonlit-dock",
      sceneName: "Moonlit Dock",
      artBrief: "Ink wash coastal noir.",
      locale: "en",
      labels: {
        "actor.keeper": "The Harbor Keeper",
        "hotspot.tavern-door": "The Lantern & Gull",
        "pickup.rusty-hook": "Rusty Hook"
      }
    });
    expect(context.hotspots).toHaveLength(1);
    expect(context.actors).toHaveLength(2);
    expect(context.pickups).toHaveLength(1);
    expect(context.items).toHaveLength(1);
  });

  it("generates deterministic schema-valid mock prompt packs", () => {
    const request = {
      bundle,
      sceneId: scene.id,
      artBrief: "Ink wash coastal noir.",
      generatedAt: "2026-06-25T12:00:00.000Z"
    };

    const first = mockPromptPackProvider.generate(request);
    const second = mockPromptPackProvider.generate(request);
    const promptPack = first.candidates[0]!.promptPack;

    expect(first).toEqual(second);
    expect(promptPack.id).toBe("mock-moonlit-dock-art");
    expect(promptPack.outputs.propPrompts.map((prompt) => prompt.id)).toEqual(["dock-hook", "radio"]);
    expect(promptPack.outputs.characterReferencePrompts.map((prompt) => prompt.id)).toEqual(["keeper"]);
    expect(promptPack.outputs.generationTargets.map((target) => target.id)).toContain(
      "moonlit-dock-background"
    );
    expect(validateDocument("promptPack", promptPack)).toEqual({ valid: true, errors: [] });
  });
});
