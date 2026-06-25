import { describe, expect, it } from "vitest";
import type {
  FlowDocument,
  ItemDocument,
  LocaleDocument,
  ProjectBundle,
  ProjectManifest,
  SceneDocument
} from "@pointclick/contracts";
import { generateLMStudioPromptPack } from "./lmstudio-prompt-provider";

const manifest: ProjectManifest = {
  schemaVersion: 1,
  id: "local-ai-test",
  title: "Local AI Test",
  initialSceneId: "lab",
  defaultLocale: "en",
  viewport: { width: 1024, height: 576 },
  scenes: [{ id: "lab", path: "scenes/lab.scene.json" }],
  flows: [{ id: "look-console", path: "flows/look-console.flow.json" }],
  items: [{ id: "fuse", path: "items/fuse.item.json" }],
  assets: [],
  animationPacks: [],
  promptPacks: [],
  locales: [{ locale: "en", path: "locales/en.json" }]
};

const scene: SceneDocument = {
  schemaVersion: 1,
  id: "lab",
  name: "Quiet Lab",
  type: "layered-2d",
  size: { width: 1024, height: 576 },
  background: "#222222",
  playerStart: { x: 200, y: 420 },
  walkArea: {
    points: [
      { x: 0, y: 380 },
      { x: 1024, y: 380 },
      { x: 1024, y: 576 }
    ]
  },
  actors: [],
  pickups: [
    {
      id: "loose-fuse",
      itemId: "fuse",
      labelKey: "pickup.fuse",
      bounds: { x: 500, y: 390, width: 48, height: 40 }
    }
  ],
  shapes: [],
  hotspots: [
    {
      id: "console",
      labelKey: "hotspot.console",
      bounds: { x: 700, y: 220, width: 120, height: 120 },
      actions: {
        lookFlowId: "look-console",
        useItemFlows: []
      }
    }
  ]
};

const flow: FlowDocument = {
  schemaVersion: 1,
  id: "look-console",
  name: "Look Console",
  startNodeId: "end",
  nodes: [{ id: "end", type: "end" }]
};

const item: ItemDocument = {
  schemaVersion: 1,
  id: "fuse",
  name: "Fuse",
  labelKey: "item.fuse"
};

const locale: LocaleDocument = {
  schemaVersion: 1,
  locale: "en",
  strings: {
    "hotspot.console": "Console",
    "item.fuse": "Fuse",
    "pickup.fuse": "Fuse"
  }
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

describe("generateLMStudioPromptPack", () => {
  it("falls back to chat completions and assembles a local prompt pack", async () => {
    const urls: string[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      urls.push(url);
      if (url.endsWith("/responses")) {
        return {
          ok: false,
          status: 404,
          statusText: "Not Found"
        } as Response;
      }

      expect(JSON.parse(String(init?.body))).toMatchObject({
        model: "gemma-local",
        response_format: { type: "json_object" }
      });

      return {
        ok: true,
        json: async () => ({
          id: "chatcmpl-local",
          choices: [
            {
              message: {
                content: JSON.stringify({
                  sceneBackgroundPrompt: "A compact laboratory background with readable consoles.",
                  propPrompts: [{ id: "loose-fuse", prompt: "A clean fuse prop on transparent background." }],
                  characterReferencePrompts: [],
                  animationNotes: ["Keep prop silhouettes stable."],
                  negativePrompt: "blur, clutter",
                  styleNotes: ["Strong terminal glow."]
                })
              }
            }
          ]
        })
      } as Response;
    }) as typeof fetch;

    const job = await generateLMStudioPromptPack(
      {
        bundle,
        sceneId: scene.id,
        artBrief: "Guided scene answers:\n- Mood: quiet tension",
        generatedAt: "2026-06-25T10:00:00.000Z"
      },
      {
        baseUrl: "http://localhost:1234/v1",
        model: "gemma-local"
      },
      {
        fetchImpl,
        now: () => "2026-06-25T10:00:00.000Z"
      }
    );

    expect(urls).toEqual([
      "http://localhost:1234/v1/responses",
      "http://localhost:1234/v1/chat/completions"
    ]);
    expect(job.provider).toBe("lmstudio");
    expect(job.candidates[0]?.promptPack.provenance.provider).toBe("lmstudio");
    expect(job.candidates[0]?.promptPack.outputs.propPrompts[0]?.id).toBe("loose-fuse");
  });
});
