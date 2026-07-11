import { describe, expect, it } from "vitest";
import type { ProjectBundle } from "@pointclick/contracts";
import { mockAuthoringProvider } from "./index";

const bundle: ProjectBundle = {
  manifest: {
    schemaVersion: 1,
    id: "test-project",
    title: "Test Project",
    initialSceneId: "dock",
    defaultLocale: "en",
    viewport: { width: 1280, height: 720 },
    scenes: [{ id: "dock", path: "scenes/dock.scene.json" }],
    flows: [],
    items: [{ id: "hook", path: "items/hook.item.json" }],
    locales: [{ locale: "en", path: "locales/en.json" }]
  },
  scenes: {
    dock: {
      schemaVersion: 1,
      id: "dock",
      name: "Dock",
      type: "layered-2d",
      size: { width: 1280, height: 720 },
      background: "#000000",
      playerStart: { x: 0, y: 0 },
      walkArea: { points: [{ x: 0, y: 0 }, { x: 1280, y: 0 }, { x: 1280, y: 720 }] },
      actors: [],
      pickups: [{ id: "hook", itemId: "hook", labelKey: "pickup.hook", bounds: { x: 1, y: 1, width: 10, height: 10 } }],
      shapes: [],
      hotspots: [{ id: "door", labelKey: "hotspot.door", bounds: { x: 1, y: 1, width: 10, height: 10 }, actions: { useItemFlows: [] } }]
    }
  },
  flows: {}, locales: { en: { schemaVersion: 1, locale: "en", strings: {} } }, items: { hook: { schemaVersion: 1, id: "hook", name: "Hook", labelKey: "item.hook" } }, assets: {}, animationPacks: {}, promptPacks: {}, styleBibles: {}, workflowTemplates: {}, generationRecipes: {}
};

describe("mockAuthoringProvider", () => {
  it("returns deterministic, review-required narrative and puzzle suggestions", async () => {
    const first = await mockAuthoringProvider.suggest({ bundle });
    const second = await mockAuthoringProvider.suggest({ bundle });
    expect(first).toEqual(second);
    expect(first.map((suggestion) => suggestion.kind)).toEqual(["narrative", "puzzle"]);
    expect(first.every((suggestion) => suggestion.warnings.length > 0)).toBe(true);
  });
});
