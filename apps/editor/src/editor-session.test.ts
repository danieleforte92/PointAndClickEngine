import { describe, expect, it } from "vitest";
import type { FlowDocument, ItemDocument, LocaleDocument, SceneDocument } from "@pointclick/contracts";
import {
  buildRecoverySnapshot,
  commitHistory,
  createFlowDraft,
  createHistoryState,
  createSceneDraft,
  getDirtyState,
  initializeEditorSession,
  redoHistory,
  restoreSessionFromRecovery,
  sceneItems,
  undoHistory
} from "./editor-session";

const sceneDocument: SceneDocument = {
  background: "#132538",
  hotspots: [
    {
      actions: {
        lookFlowId: "inspect-tavern-door",
        useItemFlows: []
      },
      bounds: { height: 215, width: 125, x: 850, y: 335 },
      cursor: "enter",
      id: "tavern-entrance",
      labelKey: "hotspot.tavern-entrance"
    }
  ],
  id: "moonlit-dock",
  name: "Moonlit Dock",
  playerStart: { x: 510, y: 590 },
  schemaVersion: 1,
  pickups: [],
  shapes: [],
  size: { height: 720, width: 1280 },
  type: "layered-2d",
  walkArea: {
    points: [
      { x: 80, y: 470 },
      { x: 1180, y: 470 },
      { x: 1200, y: 550 },
      { x: 1120, y: 660 },
      { x: 160, y: 675 },
      { x: 60, y: 560 }
    ]
  }
};

const flowDocument: FlowDocument = {
  id: "inspect-tavern-door",
  name: "Inspect the tavern door",
  nodes: [
    {
      id: "remember-door",
      key: "tavern.discovered",
      next: "mara-one",
      type: "set-flag",
      value: true
    },
    {
      id: "mara-one",
      next: "end",
      speakerId: "mara",
      textKey: "dialogue.tavern.01",
      type: "line"
    },
    {
      id: "end",
      type: "end"
    }
  ],
  schemaVersion: 1,
  startNodeId: "remember-door"
};

const localeDocument: LocaleDocument = {
  locale: "en",
  schemaVersion: 1,
  strings: {
    "dialogue.tavern.01": "The tavern door is warm.",
    "hotspot.tavern-entrance": "The Lantern & Gull"
  }
};

const itemDocument: ItemDocument = {
  id: "rusty-hook",
  labelKey: "item.rusty-hook",
  name: "Rusty Hook",
  schemaVersion: 1
};

const project = {
  activeFlowId: "inspect-tavern-door",
  activeHotspotId: "tavern-entrance",
  activeItemId: "rusty-hook",
  activeLocale: "en",
  activePickupId: null,
  activeSceneId: "moonlit-dock",
  directory: "D:/Work/PointAndClickEngine/apps/sample-game/project",
  flows: [flowDocument],
  items: [itemDocument],
  locales: [localeDocument],
  scenes: [sceneDocument]
};

describe("editor-session history", () => {
  it("undoes and redoes draft edits", () => {
    const session = initializeEditorSession(project);
    const history = createHistoryState(session);

    const nextSession = {
      ...session,
      sceneDrafts: {
        "moonlit-dock": {
          ...createSceneDraft(sceneItems(project.scenes)[0] ?? null),
          name: "Moonlit Dock Revised"
        }
      }
    };

    const updated = commitHistory(history, nextSession);
    expect(updated.present.sceneDrafts["moonlit-dock"]?.name).toBe("Moonlit Dock Revised");

    const undone = undoHistory(updated);
    expect(undone.present.sceneDrafts["moonlit-dock"]).toBeUndefined();

    const redone = redoHistory(undone);
    expect(redone.present.sceneDrafts["moonlit-dock"]?.name).toBe("Moonlit Dock Revised");
  });
});

describe("editor-session recovery", () => {
  it("builds a recovery snapshot only for dirty drafts", () => {
    const session = initializeEditorSession(project);
    session.localeDrafts.en = {
      ...localeDocument.strings,
      "dialogue.tavern.01": "The tavern door is warm, again."
    };
    session.sceneDrafts["moonlit-dock"] = {
      ...createSceneDraft(sceneItems(project.scenes)[0] ?? null),
      background: "#204060"
    };

    const dirty = getDirtyState(project, session);
    expect(dirty.count).toBe(2);

    const recovery = buildRecoverySnapshot(project.directory, project, session);
    expect(recovery?.session.localeDrafts.en?.["dialogue.tavern.01"]).toBe(
      "The tavern door is warm, again."
    );
    expect(recovery?.session.sceneDrafts["moonlit-dock"]?.background).toBe("#204060");
    expect(recovery?.session.flowDrafts["inspect-tavern-door"]).toBeUndefined();
  });

  it("restores drafts for a matching project", () => {
    const session = initializeEditorSession(project);
    session.activeFlowId = "inspect-tavern-door";
    session.activeHotspotId = null;
    session.activeLocale = null;
    session.flowDrafts["inspect-tavern-door"] = {
      ...(createFlowDraft(flowDocument) ?? {
        id: flowDocument.id,
        name: flowDocument.name,
        nodes: [],
        startNodeId: flowDocument.startNodeId
      }),
      name: "Inspect the tavern door again"
    };

    const recovery = buildRecoverySnapshot(project.directory, project, session);
    if (!recovery) {
      throw new Error("Expected recovery snapshot");
    }

    const restored = restoreSessionFromRecovery(project, recovery);
    expect(restored.activeFlowId).toBe("inspect-tavern-door");
    expect(restored.flowDrafts["inspect-tavern-door"]?.name).toBe("Inspect the tavern door again");
  });
});
