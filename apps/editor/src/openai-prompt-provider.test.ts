import { describe, expect, it } from "vitest";
import type {
  FlowDocument,
  ItemDocument,
  LocaleDocument,
  ProjectBundle,
  ProjectManifest,
  SceneDocument
} from "@pointclick/contracts";
import { generateOpenAIPromptPack } from "./openai-prompt-provider";

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
  actors: [],
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
  startNodeId: "end",
  nodes: [{ id: "end", type: "end" }]
};

const locale: LocaleDocument = {
  schemaVersion: 1,
  locale: "en",
  strings: {
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

describe("generateOpenAIPromptPack", () => {
  it("calls the Responses API and assembles a prompt pack", async () => {
    const requests: Array<{ url: string; body: unknown }> = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      requests.push({
        url,
        body: JSON.parse(String(init?.body))
      });
      return {
        ok: true,
        json: async () => ({
          id: "resp_123",
          output_text: JSON.stringify({
            sceneBackgroundPrompt: "A crisp moonlit harbor background.",
            propPrompts: [{ id: "dock-hook", prompt: "A rusty hook prop on transparent background." }],
            characterReferencePrompts: [],
            animationNotes: ["Keep the player foot pivot stable."],
            negativePrompt: "blur, clutter",
            styleNotes: ["High contrast silhouettes."]
          })
        })
      } as Response;
    }) as typeof fetch;

    const job = await generateOpenAIPromptPack(
      {
        bundle,
        sceneId: scene.id,
        artBrief: "Coastal noir.",
        generatedAt: "2026-06-25T12:00:00.000Z"
      },
      {
        apiKey: "test-key",
        model: "gpt-test",
        baseUrl: "https://example.test/v1"
      },
      {
        fetchImpl,
        now: () => "2026-06-25T12:00:00.000Z"
      }
    );

    expect(requests[0]?.url).toBe("https://example.test/v1/responses");
    expect(requests[0]?.body).toMatchObject({
      model: "gpt-test",
      text: {
        format: {
          type: "json_schema",
          strict: true
        }
      }
    });
    expect(job.provider).toBe("openai");
    expect(job.candidates[0]?.promptPack.outputs.sceneBackgroundPrompt).toBe(
      "A crisp moonlit harbor background."
    );
    expect(job.candidates[0]?.promptPack.outputs.generationTargets.map((target) => target.id)).toContain(
      "moonlit-dock-background"
    );
  });
});
