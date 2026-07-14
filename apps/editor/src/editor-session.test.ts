import { describe, expect, it } from "vitest";
import type { FlowDocument, ItemDocument, LocaleDocument, SceneDocument } from "@pointclick/contracts";
import {
  buildRecoverySnapshot,
  buildFlowNodes,
  buildNarrativeRelationIndex,
  clampSceneRect,
  clampScenePoint,
  commitHistory,
  createActorDraft,
  createActorKey,
  createFlowDraft,
  createHistoryState,
  createHotspotDraft,
  createHotspotKey,
  createSceneDraft,
  getDirtyState,
  initializeEditorSession,
  insertDraftPointAfter,
  moveScenePoint,
  moveSceneRect,
  redoHistory,
  resizeSceneRectFromBottomRight,
  restoreSessionFromRecovery,
  sceneItems,
  sceneSelectionTargetFor,
  undoHistory,
  workspaceForNavigationTarget
} from "./editor-session";

const sceneDocument: SceneDocument = {
  actors: [
    {
      actions: {
        lookFlowId: "inspect-tavern-door",
        useItemFlows: []
      },
      bounds: { height: 80, width: 90, x: 420, y: 360 },
      depth: 8,
      id: "radio",
      labelKey: "actor.radio",
      role: "prop"
    }
  ],
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
    "actor.radio": "Radio",
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
  activeActorId: "radio",
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

describe("editor-session navigation targets", () => {
  it("keeps cross-workspace targets anchored to the destination workspace", () => {
    expect(workspaceForNavigationTarget({ workspace: "overview", section: "structure" })).toBe("overview");
    expect(
      workspaceForNavigationTarget({
        workspace: "scene",
        sceneId: "moonlit-dock",
        entityKind: "hotspot",
        entityId: "tavern-entrance"
      })
    ).toBe("scene");
    expect(workspaceForNavigationTarget({ workspace: "build", diagnosticId: "asset.file-missing" })).toBe("build");
  });
});

describe("editor-session narrative drafts", () => {
  it("round-trips every supported flow node family without changing the domain model", () => {
    const flow: FlowDocument = {
      schemaVersion: 1,
      id: "all-nodes",
      name: "All nodes",
      startNodeId: "choice",
      nodes: [
        { id: "choice", type: "choice", promptKey: "choice.prompt", choices: [{ id: "yes", labelKey: "choice.yes", next: "condition" }] },
        { id: "condition", type: "condition", when: { type: "flag-equals", key: "door.open", value: true }, ifTrue: "sub", ifFalse: "inventory" },
        { id: "sub", type: "sub-flow", flowId: "inspect-tavern-door", next: "wait" },
        { id: "inventory", type: "inventory", action: "add", itemId: "rusty-hook", next: "wait" },
        { id: "wait", type: "wait", durationMs: 250, next: "cue" },
        { id: "cue", type: "cue", cue: { type: "sound", key: "door-sfx" }, next: "end" },
        { id: "end", type: "end" }
      ],
      editorLayout: { nodes: { choice: { x: 24, y: 48 } }, viewport: { x: 1, y: 2, zoom: 0.8 } }
    };
    const draft = createFlowDraft(flow);
    expect(draft?.editorLayout).toEqual(flow.editorLayout);
    expect(buildFlowNodes(draft?.nodes ?? [])).toEqual(flow.nodes);
  });
});

describe("editor-session scene selection targets", () => {
  const baseSelection = {
    activeActorId: null,
    activeHotspotId: null,
    activePickupId: null,
    activeSceneId: "moonlit-dock",
    activeSceneTool: "select" as const,
    playerSelected: false,
    selectedGenerationGuideId: null,
    selectedSceneLayerId: null
  };

  it("derives the selected scene object from editor state", () => {
    expect(sceneSelectionTargetFor(baseSelection)).toEqual({
      kind: "scene",
      sceneId: "moonlit-dock"
    });
    expect(sceneSelectionTargetFor({ ...baseSelection, activeActorId: "radio" })).toEqual({
      entityId: "radio",
      kind: "actor",
      sceneId: "moonlit-dock"
    });
    expect(sceneSelectionTargetFor({ ...baseSelection, activeSceneTool: "walk-area" })).toEqual({
      kind: "walk-area",
      sceneId: "moonlit-dock"
    });
  });

  it("prioritizes local layer and guide selections over entity selections", () => {
    expect(
      sceneSelectionTargetFor({
        ...baseSelection,
        activeActorId: "radio",
        selectedSceneLayerId: "foreground-fog"
      })
    ).toEqual({
      entityId: "foreground-fog",
      kind: "layer",
      sceneId: "moonlit-dock"
    });
    expect(
      sceneSelectionTargetFor({
        ...baseSelection,
        activeHotspotId: "door",
        selectedGenerationGuideId: "door-mask"
      })
    ).toEqual({
      entityId: "door-mask",
      kind: "guide",
      sceneId: "moonlit-dock"
    });
  });
});

describe("editor-session narrative relation index", () => {
  it("groups flow references by scene entity and reports unlinked flows", () => {
    const extraFlow: FlowDocument = {
      ...flowDocument,
      id: "unlinked-flow",
      name: "Unlinked Flow"
    };
    const index = buildNarrativeRelationIndex([sceneDocument], [flowDocument, extraFlow]);

    expect(index.sceneGroups).toHaveLength(1);
    expect(index.sceneGroups[0]?.sceneId).toBe("moonlit-dock");
    expect(index.sceneGroups[0]?.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "look",
          entityId: "tavern-entrance",
          entityKind: "hotspot",
          flowExists: true,
          flowId: "inspect-tavern-door"
        }),
        expect.objectContaining({
          action: "look",
          entityId: "radio",
          entityKind: "actor",
          flowExists: true,
          flowId: "inspect-tavern-door"
        })
      ])
    );
    expect(index.unlinkedFlows.map((flow) => flow.id)).toEqual(["unlinked-flow"]);
    expect(index.missingReferences).toEqual([]);
  });

  it("keeps broken entity flow links visible for diagnostics", () => {
    const sceneWithMissingFlow: SceneDocument = {
      ...sceneDocument,
      hotspots: [
        {
          ...sceneDocument.hotspots[0]!,
          actions: {
            ...sceneDocument.hotspots[0]!.actions,
            talkFlowId: "missing-flow"
          }
        }
      ]
    };
    const index = buildNarrativeRelationIndex([sceneWithMissingFlow], [flowDocument]);

    expect(index.missingReferences).toEqual([
      expect.objectContaining({
        action: "talk",
        entityId: "tavern-entrance",
        entityKind: "hotspot",
        flowExists: false,
        flowId: "missing-flow"
      })
    ]);
  });
});

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
    session.actorDrafts[createActorKey("moonlit-dock", "radio")] = {
      ...createActorDraft(sceneDocument.actors[0] ?? null),
      depth: "12"
    };
    session.sceneDrafts["moonlit-dock"] = {
      ...createSceneDraft(sceneItems(project.scenes)[0] ?? null),
      background: "#204060"
    };

    const dirty = getDirtyState(project, session);
    expect(dirty.count).toBe(3);

    const recovery = buildRecoverySnapshot(project.directory, project, session);
    expect(recovery?.session.localeDrafts.en?.["dialogue.tavern.01"]).toBe(
      "The tavern door is warm, again."
    );
    expect(recovery?.session.sceneDrafts["moonlit-dock"]?.background).toBe("#204060");
    expect(recovery?.session.actorDrafts[createActorKey("moonlit-dock", "radio")]?.depth).toBe("12");
    expect(recovery?.session.flowDrafts["inspect-tavern-door"]).toBeUndefined();
  });

  it("tracks hotspot spot draft changes as dirty state", () => {
    const session = initializeEditorSession(project);
    const key = createHotspotKey("moonlit-dock", "tavern-entrance");
    session.hotspotDrafts[key] = {
      ...createHotspotDraft(sceneDocument.hotspots[0] ?? null),
      interactSpotEnabled: true,
      interactSpotX: "910",
      interactSpotY: "560"
    };

    const dirty = getDirtyState(project, session);
    expect(dirty.hotspotKeys.has(key)).toBe(true);
    expect(dirty.count).toBe(1);
  });

  it("tracks scene layer draft changes as dirty state", () => {
    const session = initializeEditorSession(project);
    session.sceneDrafts["moonlit-dock"] = {
      ...createSceneDraft(sceneDocument),
      layers: [
        {
          assetId: "dock-fog",
          depth: "85",
          height: "180",
          id: "foreground-fog",
          locked: false,
          name: "Foreground Fog",
          opacity: "0.8",
          visible: true,
          width: "1280",
          x: "0",
          y: "540"
        }
      ]
    };

    const dirty = getDirtyState(project, session);
    expect(dirty.sceneIds.has("moonlit-dock")).toBe(true);
    expect(dirty.count).toBe(1);
  });

  it("tracks scene generation guide draft changes as dirty state", () => {
    const session = initializeEditorSession(project);
    session.sceneDrafts["moonlit-dock"] = {
      ...createSceneDraft(sceneDocument),
      generationGuides: [
        {
          id: "door-mask",
          name: "Door Mask",
          role: "hotspot",
          source: { kind: "hotspot", id: "tavern-entrance" },
          shape: { type: "rect", bounds: { x: 820, y: 310, width: 140, height: 220 } },
          visible: true
        }
      ]
    };

    const dirty = getDirtyState(project, session);
    expect(dirty.sceneIds.has("moonlit-dock")).toBe(true);
    expect(dirty.count).toBe(1);

    const recovery = buildRecoverySnapshot(project.directory, project, session);
    expect(recovery?.session.sceneDrafts["moonlit-dock"]?.generationGuides[0]?.id).toBe("door-mask");
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

describe("editor-session geometry helpers", () => {
  it("clamps scene points inside the viewport", () => {
    expect(clampScenePoint({ x: -14, y: 810 }, { width: 1280, height: 720 })).toEqual({
      x: 0,
      y: 720
    });
  });

  it("moves a scene point while keeping it in bounds", () => {
    expect(
      moveScenePoint(
        { x: 510, y: 590 },
        { x: 900, y: -700 },
        { width: 1280, height: 720 }
      )
    ).toEqual({
      x: 1280,
      y: 0
    });
  });

  it("moves a scene rect while preserving its size", () => {
    expect(
      moveSceneRect(
        { x: 850, y: 335, width: 125, height: 215 },
        { x: 900, y: 300 },
        { width: 1280, height: 720 }
      )
    ).toEqual({
      x: 1155,
      y: 505,
      width: 125,
      height: 215
    });
  });

  it("resizes a scene rect from the bottom-right handle", () => {
    expect(
      resizeSceneRectFromBottomRight(
        { x: 850, y: 335, width: 125, height: 215 },
        { x: 600, y: 400 },
        { width: 1280, height: 720 }
      )
    ).toEqual({
      x: 850,
      y: 335,
      width: 430,
      height: 385
    });
  });

  it("clamps rect size and origin into the scene frame", () => {
    expect(
      clampSceneRect(
        { x: -20, y: -10, width: 1600, height: 900 },
        { width: 1280, height: 720 }
      )
    ).toEqual({
      x: 0,
      y: 0,
      width: 1280,
      height: 720
    });
  });

  it("inserts a walk-area point after the selected edge", () => {
    expect(
      insertDraftPointAfter(
        [
          { x: "10", y: "20" },
          { x: "30", y: "40" },
          { x: "50", y: "60" }
        ],
        1,
        { x: "35", y: "45" }
      )
    ).toEqual([
      { x: "10", y: "20" },
      { x: "30", y: "40" },
      { x: "35", y: "45" },
      { x: "50", y: "60" }
    ]);
  });
});
