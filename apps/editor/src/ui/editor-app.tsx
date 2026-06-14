import type { CursorValue, FlowDocument, Hotspot, LocaleDocument, SceneDocument } from "@pointclick/contracts";
import { startTransition, useEffect, useMemo, useState } from "react";
import {
  buildFlowNodes,
  buildRecoverySnapshot,
  commitHistory,
  createFlowDraft,
  createHistoryState,
  createHotspotDraft,
  createNewFlowNode,
  createSceneDraft,
  createHotspotKey,
  cursorOptions,
  discardSavedDraft,
  getDirtyState,
  hexColorPattern,
  initializeEditorSession,
  parseNumber,
  parsePositiveNumber,
  polygonArea,
  redoHistory,
  restoreSessionFromRecovery,
  sceneItems,
  type DraftNodeType,
  type EditorHistoryState,
  type EditorRecoverySnapshot,
  type FlowDraft,
  type FlowDraftNode,
  undoHistory,
  type Workspace
} from "../editor-session";
import type { EditorProjectSnapshot } from "../preload";

const workspaces: { id: Workspace; label: string }[] = [
  { id: "scene", label: "Scene" },
  { id: "narrative", label: "Narrative" },
  { id: "assets", label: "Asset Studio" },
  { id: "build", label: "Build" }
];

const emptyHistory = createHistoryState(
  initializeEditorSession({
    activeFlowId: null,
    activeHotspotId: null,
    activeLocale: null,
    activeSceneId: "",
    directory: "",
    flows: [],
    locales: [],
    scenes: []
  })
);

const emptyLocaleEntry = { key: "", value: "" };

function sceneFromSnapshot(snapshot: EditorProjectSnapshot | null, sceneId: string | null) {
  if (!snapshot || !sceneId) return null;
  return sceneItems(snapshot.scenes).find((scene) => scene.id === sceneId) ?? null;
}

function hotspotFromSnapshot(
  snapshot: EditorProjectSnapshot | null,
  sceneId: string | null,
  hotspotId: string | null
) {
  const scene = sceneFromSnapshot(snapshot, sceneId);
  if (!scene || !hotspotId) return null;
  return scene.hotspots.find((hotspot) => hotspot.id === hotspotId) ?? null;
}

function localeFromSnapshot(snapshot: EditorProjectSnapshot | null, localeId: string | null) {
  if (!snapshot || !localeId) return null;
  return snapshot.locales.find((locale) => locale.locale === localeId) ?? null;
}

function flowFromSnapshot(snapshot: EditorProjectSnapshot | null, flowId: string | null) {
  if (!snapshot || !flowId) return null;
  return snapshot.flows.find((flow) => flow.id === flowId) ?? null;
}

function parseWalkAreaDraft(
  walkAreaPoints: Array<{ x: string; y: string }>
): { points: Array<{ x: number; y: number }> } | null {
  const points = walkAreaPoints.map((point) => {
    const x = parseNumber(point.x);
    const y = parseNumber(point.y);
    return x === null || y === null ? null : { x, y };
  });

  if (points.some((point) => point === null)) {
    return null;
  }

  return {
    points: points as Array<{ x: number; y: number }>
  };
}

export function EditorApp() {
  const [workspace, setWorkspace] = useState<Workspace>("scene");
  const [status, setStatus] = useState("Loading project...");
  const [project, setProject] = useState<EditorProjectSnapshot | null>(null);
  const [history, setHistory] = useState<EditorHistoryState>(emptyHistory);
  const [pendingRecovery, setPendingRecovery] = useState<EditorRecoverySnapshot | null>(null);

  const session = history.present;
  const scenes = project ? sceneItems(project.scenes) : [];
  const selectedScene =
    sceneFromSnapshot(project, session.activeSceneId) ?? project?.selectedScene ?? scenes[0] ?? null;
  const selectedHotspot =
    hotspotFromSnapshot(project, session.activeSceneId, session.activeHotspotId) ?? null;
  const selectedLocale = localeFromSnapshot(project, session.activeLocale) ?? null;
  const selectedFlow = flowFromSnapshot(project, session.activeFlowId) ?? null;

  const currentSceneDraft = selectedScene
    ? session.sceneDrafts[selectedScene.id] ?? createSceneDraft(selectedScene)
    : createSceneDraft(null);
  const currentHotspotDraft = selectedHotspot
    ? session.hotspotDrafts[createHotspotKey(selectedScene?.id ?? "", selectedHotspot.id)] ??
      createHotspotDraft(selectedHotspot)
    : createHotspotDraft(null);
  const currentLocaleDraft = selectedLocale
    ? session.localeDrafts[selectedLocale.locale] ?? selectedLocale.strings
    : {};
  const currentLocaleEntryDraft = selectedLocale
    ? session.localeEntryDrafts[selectedLocale.locale] ?? emptyLocaleEntry
    : emptyLocaleEntry;
  const currentFlowDraft = selectedFlow
    ? session.flowDrafts[selectedFlow.id] ?? createFlowDraft(selectedFlow)
    : null;

  const localeEntries = useMemo(
    () => Object.entries(currentLocaleDraft).sort(([left], [right]) => left.localeCompare(right)),
    [currentLocaleDraft]
  );
  const flowNodeIds = useMemo(
    () => (currentFlowDraft ? currentFlowDraft.nodes.map((node) => node.id) : []),
    [currentFlowDraft]
  );
  const dirtyState = useMemo(
    () =>
      project
        ? getDirtyState(project, session)
        : {
            count: 0,
            flowIds: new Set<string>(),
            hotspotKeys: new Set<string>(),
            localeIds: new Set<string>(),
            sceneIds: new Set<string>()
          },
    [project, session]
  );
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const sceneLabel = selectedScene
    ? `${selectedScene.size.width} x ${selectedScene.size.height}`
    : "No scene";
  const localeLabel = project?.manifest.defaultLocale ?? "n/a";
  const draftWalkArea = parseWalkAreaDraft(currentSceneDraft.walkAreaPoints);
  const previewWalkArea = draftWalkArea ?? selectedScene?.walkArea ?? null;
  const previewWalkAreaPoints = previewWalkArea
    ? previewWalkArea.points.map((point) => `${point.x},${point.y}`).join(" ")
    : "";

  const replaceSession = (recipe: (current: EditorHistoryState) => EditorHistoryState) => {
    setHistory((current) => recipe(current));
  };

  const updateSessionSelection = (
    recipe: (current: EditorHistoryState["present"]) => EditorHistoryState["present"]
  ) => {
    setHistory((current) => ({
      ...current,
      present: recipe(current.present)
    }));
  };

  const updateDraftWithHistory = (
    recipe: (current: EditorHistoryState["present"]) => EditorHistoryState["present"]
  ) => {
    setHistory((current) => commitHistory(current, recipe(current.present)));
  };

  const loadRecoveryForProject = async (projectDirectory: string) => {
    try {
      return await window.pointClick.loadRecovery(projectDirectory);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Recovery snapshot could not be loaded");
      return null;
    }
  };

  const hydrateProject = async (snapshot: EditorProjectSnapshot) => {
    const baseHistory = createHistoryState(initializeEditorSession(snapshot));
    const recovery = await loadRecoveryForProject(snapshot.directory);

    startTransition(() => {
      setProject(snapshot);
      setHistory(baseHistory);
      setPendingRecovery(recovery);
    });

    if (recovery) {
      setStatus(`Loaded ${snapshot.manifest.title} - recovery available`);
    } else {
      setStatus(`Loaded ${snapshot.manifest.title}`);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function loadInitialProject() {
      try {
        const snapshot = await window.pointClick.loadProject();
        if (cancelled) return;
        await hydrateProject(snapshot);
      } catch (error) {
        if (cancelled) return;
        setStatus(error instanceof Error ? error.message : "Failed to load project");
      }
    }

    void loadInitialProject();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey) return;
      const wantsCommand = event.ctrlKey || event.metaKey;
      if (!wantsCommand) return;

      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        replaceSession((current) => undoHistory(current));
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        replaceSession((current) => redoHistory(current));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!project || pendingRecovery) return;

    const timeout = window.setTimeout(async () => {
      try {
        const snapshot = buildRecoverySnapshot(project.directory, project, history.present);
        if (snapshot) {
          await window.pointClick.saveRecovery(snapshot);
        } else {
          await window.pointClick.clearRecovery(project.directory);
        }
      } catch {
        // Recovery issues should not block normal editing.
      }
    }, 800);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [history.present, pendingRecovery, project]);

  const restoreRecovery = () => {
    if (!project || !pendingRecovery) return;
    startTransition(() => {
      setHistory(createHistoryState(restoreSessionFromRecovery(project, pendingRecovery)));
      setPendingRecovery(null);
    });
    setStatus("Restored unapplied drafts");
  };

  const discardRecovery = async () => {
    if (!project) return;
    await window.pointClick.clearRecovery(project.directory);
    setPendingRecovery(null);
    setStatus(`Loaded ${project.manifest.title}`);
  };

  const play = async () => {
    const sceneId = selectedScene?.id ?? project?.activeSceneId;
    setStatus("Opening isolated preview...");
    await window.pointClick.openPreview(sceneId ?? undefined);
    setStatus("Preview connected");
  };

  const openBrowser = async () => {
    await window.pointClick.openInBrowser();
    setStatus("Opened in default browser");
  };

  const openProject = async () => {
    setStatus("Waiting for a project folder...");
    const snapshot = await window.pointClick.pickProject();
    if (!snapshot) {
      setStatus(project ? `Loaded ${project.manifest.title}` : "Project selection cancelled");
      return;
    }
    await hydrateProject(snapshot);
  };

  const selectScene = (sceneId: string) => {
    updateSessionSelection((current) => ({
      ...current,
      activeFlowId: null,
      activeHotspotId: null,
      activeLocale: null,
      activeSceneId: sceneId
    }));
  };

  const selectHotspot = (hotspot: Hotspot) => {
    updateSessionSelection((current) => ({
      ...current,
      activeFlowId: null,
      activeHotspotId: hotspot.id,
      activeLocale: null
    }));
  };

  const selectLocale = (locale: LocaleDocument) => {
    updateSessionSelection((current) => ({
      ...current,
      activeFlowId: null,
      activeHotspotId: null,
      activeLocale: locale.locale
    }));
  };

  const selectFlow = (flow: FlowDocument) => {
    updateSessionSelection((current) => ({
      ...current,
      activeFlowId: flow.id,
      activeHotspotId: null,
      activeLocale: null
    }));
  };

  const updateHotspotDraft = (field: keyof typeof currentHotspotDraft, value: string) => {
    if (!selectedScene || !selectedHotspot) return;
    const key = createHotspotKey(selectedScene.id, selectedHotspot.id);
    updateDraftWithHistory((current) => ({
      ...current,
      hotspotDrafts: {
        ...current.hotspotDrafts,
        [key]: {
          ...(current.hotspotDrafts[key] ?? createHotspotDraft(selectedHotspot)),
          [field]: value
        }
      }
    }));
  };

  const updateSceneDraft = (field: keyof typeof currentSceneDraft, value: string) => {
    if (!selectedScene) return;
    updateDraftWithHistory((current) => ({
      ...current,
      sceneDrafts: {
        ...current.sceneDrafts,
        [selectedScene.id]: {
          ...(current.sceneDrafts[selectedScene.id] ?? createSceneDraft(selectedScene)),
          [field]: value
        }
      }
    }));
  };

  const updateWalkAreaPoint = (index: number, axis: "x" | "y", value: string) => {
    if (!selectedScene) return;
    updateDraftWithHistory((current) => {
      const sceneDraft = current.sceneDrafts[selectedScene.id] ?? createSceneDraft(selectedScene);
      const walkAreaPoints = sceneDraft.walkAreaPoints.map((point, pointIndex) =>
        pointIndex === index ? { ...point, [axis]: value } : point
      );
      return {
        ...current,
        sceneDrafts: {
          ...current.sceneDrafts,
          [selectedScene.id]: {
            ...sceneDraft,
            walkAreaPoints
          }
        }
      };
    });
  };

  const addWalkAreaPoint = () => {
    if (!selectedScene) return;
    updateDraftWithHistory((current) => {
      const sceneDraft = current.sceneDrafts[selectedScene.id] ?? createSceneDraft(selectedScene);
      const lastPoint =
        sceneDraft.walkAreaPoints[sceneDraft.walkAreaPoints.length - 1] ?? { x: "0", y: "0" };
      return {
        ...current,
        sceneDrafts: {
          ...current.sceneDrafts,
          [selectedScene.id]: {
            ...sceneDraft,
            walkAreaPoints: [
              ...sceneDraft.walkAreaPoints,
              { x: lastPoint.x, y: lastPoint.y }
            ]
          }
        }
      };
    });
  };

  const removeWalkAreaPoint = (index: number) => {
    if (!selectedScene || currentSceneDraft.walkAreaPoints.length <= 3) return;
    updateDraftWithHistory((current) => {
      const sceneDraft = current.sceneDrafts[selectedScene.id] ?? createSceneDraft(selectedScene);
      return {
        ...current,
        sceneDrafts: {
          ...current.sceneDrafts,
          [selectedScene.id]: {
            ...sceneDraft,
            walkAreaPoints: sceneDraft.walkAreaPoints.filter((_, pointIndex) => pointIndex !== index)
          }
        }
      };
    });
  };

  const updateLocaleValue = (key: string, value: string) => {
    if (!selectedLocale) return;
    updateDraftWithHistory((current) => ({
      ...current,
      localeDrafts: {
        ...current.localeDrafts,
        [selectedLocale.locale]: {
          ...(current.localeDrafts[selectedLocale.locale] ?? selectedLocale.strings),
          [key]: value
        }
      }
    }));
  };

  const updateLocaleEntryDraft = (field: "key" | "value", value: string) => {
    if (!selectedLocale) return;
    updateDraftWithHistory((current) => ({
      ...current,
      localeEntryDrafts: {
        ...current.localeEntryDrafts,
        [selectedLocale.locale]: {
          ...(current.localeEntryDrafts[selectedLocale.locale] ?? emptyLocaleEntry),
          [field]: value
        }
      }
    }));
  };

  const updateFlowDraft = (recipe: (current: FlowDraft) => FlowDraft) => {
    if (!selectedFlow || !currentFlowDraft) return;
    updateDraftWithHistory((current) => ({
      ...current,
      flowDrafts: {
        ...current.flowDrafts,
        [selectedFlow.id]: recipe(current.flowDrafts[selectedFlow.id] ?? currentFlowDraft)
      }
    }));
  };

  const updateFlowNode = (index: number, recipe: (node: FlowDraftNode) => FlowDraftNode) => {
    updateFlowDraft((current) => {
      const nodes = [...current.nodes];
      nodes[index] = recipe(nodes[index]!);
      return { ...current, nodes };
    });
  };

  const addFlowNode = (type: DraftNodeType) => {
    updateFlowDraft((current) => ({
      ...current,
      nodes: [...current.nodes, createNewFlowNode(type, current.nodes)]
    }));
  };

  const removeFlowNode = (index: number) => {
    updateFlowDraft((current) => {
      const nodeId = current.nodes[index]?.id;
      if (!nodeId) return current;
      const nodes = current.nodes.filter((_, nodeIndex) => nodeIndex !== index);
      const nextStartNodeId =
        current.startNodeId === nodeId ? nodes[0]?.id ?? current.startNodeId : current.startNodeId;
      return {
        ...current,
        nodes,
        startNodeId: nextStartNodeId
      };
    });
  };

  const applyHotspotChanges = async () => {
    if (!selectedScene || !selectedHotspot) return;

    const x = parseNumber(currentHotspotDraft.x);
    const y = parseNumber(currentHotspotDraft.y);
    const width = parsePositiveNumber(currentHotspotDraft.width);
    const height = parsePositiveNumber(currentHotspotDraft.height);
    const labelKey = currentHotspotDraft.labelKey.trim();
    const actionFlowId = currentHotspotDraft.actionFlowId.trim();
    const cursor = currentHotspotDraft.cursor.trim();

    if (x === null || y === null || width === null || height === null) {
      setStatus("Bounds must be valid numbers, with width and height above zero");
      return;
    }
    if (!labelKey || !actionFlowId) {
      setStatus("Label key and flow ID are required");
      return;
    }
    if (cursor && !cursorOptions.includes(cursor as CursorValue)) {
      setStatus("Cursor must be blank, look, talk, use, or enter");
      return;
    }

    setStatus(`Saving ${selectedHotspot.id}...`);
    try {
      const patch = {
        actionFlowId,
        bounds: { x, y, width, height },
        labelKey
      } as {
        actionFlowId: string;
        bounds: { x: number; y: number; width: number; height: number };
        cursor?: CursorValue;
        labelKey: string;
      };
      if (cursor !== "") {
        patch.cursor = cursor as CursorValue;
      }

      const snapshot = await window.pointClick.applyCommand({
        type: "hotspot/update",
        hotspotId: selectedHotspot.id,
        patch,
        sceneId: selectedScene.id
      });
      setProject(snapshot);
      setHistory((current) =>
        ({
          ...current,
          present: discardSavedDraft(
            current.present,
            "hotspot",
            createHotspotKey(selectedScene.id, selectedHotspot.id)
          )
        })
      );
      setStatus(`Saved ${selectedHotspot.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save hotspot");
    }
  };

  const applySceneChanges = async () => {
    if (!selectedScene) return;

    const playerStartX = parseNumber(currentSceneDraft.playerStartX);
    const playerStartY = parseNumber(currentSceneDraft.playerStartY);
    const name = currentSceneDraft.name.trim();
    const background = currentSceneDraft.background.trim();
    const walkArea = parseWalkAreaDraft(currentSceneDraft.walkAreaPoints);

    if (!name) {
      setStatus("Scene name is required");
      return;
    }
    if (!hexColorPattern.test(background)) {
      setStatus("Background must be a valid #RRGGBB color");
      return;
    }
    if (playerStartX === null || playerStartY === null) {
      setStatus("Scene coordinates must be valid numbers");
      return;
    }
    if (currentSceneDraft.walkAreaPoints.length < 3) {
      setStatus("Walk area needs at least three points");
      return;
    }
    if (!walkArea) {
      setStatus("Walk area points must be valid numbers");
      return;
    }
    if (polygonArea(walkArea) <= 0) {
      setStatus("Walk area must enclose a non-zero area");
      return;
    }

    setStatus(`Saving ${selectedScene.id}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "scene/update",
        patch: {
          background,
          name,
          playerStart: {
            x: playerStartX,
            y: playerStartY
          },
          walkArea
        },
        sceneId: selectedScene.id
      });
      setProject(snapshot);
      setHistory((current) => ({
        ...current,
        present: discardSavedDraft(current.present, "scene", selectedScene.id)
      }));
      setStatus(`Saved ${selectedScene.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save scene");
    }
  };

  const applyLocaleUpsert = async (key: string, value: string) => {
    if (!selectedLocale) return;

    const normalizedKey = key.trim();
    if (!normalizedKey) {
      setStatus("Locale keys cannot be empty");
      return;
    }

    setStatus(`Saving ${normalizedKey}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "locale/upsert",
        locale: selectedLocale.locale,
        patch: {
          key: normalizedKey,
          value
        }
      });
      setProject(snapshot);
      setHistory((current) => ({
        ...current,
        present: discardSavedDraft(current.present, "locale", selectedLocale.locale)
      }));
      setStatus(`Saved ${normalizedKey}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save locale string");
    }
  };

  const applyFlowChanges = async () => {
    if (!selectedFlow || !currentFlowDraft) return;

    const name = currentFlowDraft.name.trim();
    const startNodeId = currentFlowDraft.startNodeId.trim();
    const ids = currentFlowDraft.nodes.map((node) => node.id.trim());

    if (!name) {
      setStatus("Flow name is required");
      return;
    }
    if (currentFlowDraft.nodes.length === 0) {
      setStatus("A flow must contain at least one node");
      return;
    }
    if (ids.some((id) => id.length === 0)) {
      setStatus("Each node needs a non-empty id");
      return;
    }
    if (new Set(ids).size !== ids.length) {
      setStatus("Node ids must be unique");
      return;
    }
    if (!ids.includes(startNodeId)) {
      setStatus("Start node must reference an existing node id");
      return;
    }
    if (!currentFlowDraft.nodes.some((node) => node.type === "end")) {
      setStatus("A flow must contain at least one end node");
      return;
    }
    for (const node of currentFlowDraft.nodes) {
      if (node.type === "line") {
        if (!node.speakerId.trim() || !node.textKey.trim() || !node.next.trim()) {
          setStatus(`Line node "${node.id}" is incomplete`);
          return;
        }
        if (!ids.includes(node.next.trim())) {
          setStatus(`Line node "${node.id}" points to a missing next node`);
          return;
        }
      }
      if (node.type === "set-flag") {
        if (!node.key.trim() || !node.next.trim() || node.value.trim() === "") {
          setStatus(`Set-flag node "${node.id}" is incomplete`);
          return;
        }
        if (!ids.includes(node.next.trim())) {
          setStatus(`Set-flag node "${node.id}" points to a missing next node`);
          return;
        }
        if (node.valueKind === "number" && Number.isNaN(Number(node.value))) {
          setStatus(`Set-flag node "${node.id}" needs a valid numeric value`);
          return;
        }
      }
    }

    setStatus(`Saving ${selectedFlow.id}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "flow/update",
        flowId: selectedFlow.id,
        patch: {
          name,
          nodes: buildFlowNodes(currentFlowDraft.nodes),
          startNodeId
        }
      });
      setProject(snapshot);
      setHistory((current) => ({
        ...current,
        present: discardSavedDraft(current.present, "flow", selectedFlow.id)
      }));
      setStatus(`Saved ${selectedFlow.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save flow");
    }
  };

  return (
    <div className="studio-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">P/C</span>
          <div>
            <strong>Point & Click Studio</strong>
            <small>{project?.manifest.title ?? "Loading project..."}</small>
          </div>
        </div>

        <nav className="workspace-tabs" aria-label="Workspaces">
          {workspaces.map((item) => (
            <button
              className={workspace === item.id ? "active" : ""}
              key={item.id}
              type="button"
              onClick={() => setWorkspace(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="preview-actions">
          <button
            className="secondary-action"
            disabled={!canUndo}
            type="button"
            onClick={() => replaceSession((current) => undoHistory(current))}
          >
            Undo
          </button>
          <button
            className="secondary-action"
            disabled={!canRedo}
            type="button"
            onClick={() => replaceSession((current) => redoHistory(current))}
          >
            Redo
          </button>
          <button className="secondary-action" type="button" onClick={openProject}>
            Open Project
          </button>
          <button className="secondary-action" type="button" onClick={openBrowser}>
            Browser
          </button>
          <button className="play-action" type="button" onClick={play}>
            <span>&#9654;</span> Play from here
          </button>
        </div>
      </header>

      {pendingRecovery ? (
        <div className="recovery-banner">
          <div>
            <strong>Recovered draft available</strong>
            <small>We found unapplied local edits for this project.</small>
          </div>
          <div className="recovery-actions">
            <button className="secondary-action" type="button" onClick={discardRecovery}>
              Discard
            </button>
            <button className="play-action" type="button" onClick={restoreRecovery}>
              Restore drafts
            </button>
          </div>
        </div>
      ) : null}

      <div className="workspace-grid">
        <aside className="project-panel panel">
          <div className="panel-heading">
            <span>Project</span>
            <button type="button" aria-label="Open project" onClick={openProject}>
              +
            </button>
          </div>
          <div className="tree">
            <div className="tree-group open">Scenes</div>
            {scenes.map((scene) => (
              <button
                className={`tree-item ${session.activeLocale === null && session.activeFlowId === null && selectedScene?.id === scene.id ? "selected" : ""}`}
                key={scene.id}
                type="button"
                onClick={() => selectScene(scene.id)}
              >
                <span className="scene-dot" /> {scene.name}
                {dirtyState.sceneIds.has(scene.id) ? <span className="dirty-mark">*</span> : null}
              </button>
            ))}
            <div className="tree-group open">Flows ({project?.flowCount ?? 0})</div>
            {project?.flows.map((flow) => (
              <button
                className={`tree-item ${session.activeFlowId === flow.id ? "selected" : ""}`}
                key={flow.id}
                type="button"
                onClick={() => selectFlow(flow)}
              >
                <span className="scene-dot muted" /> {flow.id}
                {dirtyState.flowIds.has(flow.id) ? <span className="dirty-mark">*</span> : null}
              </button>
            ))}
            <div className="tree-group open">Locales ({project?.localeCount ?? 0})</div>
            {project?.locales.map((locale) => (
              <button
                className={`tree-item ${session.activeLocale === locale.locale ? "selected" : ""}`}
                key={locale.locale}
                type="button"
                onClick={() => selectLocale(locale)}
              >
                <span className="scene-dot muted" /> {locale.locale}
                {dirtyState.localeIds.has(locale.locale) ? <span className="dirty-mark">*</span> : null}
              </button>
            ))}
          </div>
          <div className="project-health">
            <span className="health-light" />
            <div>
              <strong>{status}</strong>
              <small>
                Schema v1 - {localeLabel} - {dirtyState.count} dirty draft(s)
              </small>
            </div>
          </div>
        </aside>

        <section className="canvas-panel panel">
          <div className="canvas-toolbar">
            <div className="toolset">
              <button className="active" type="button">
                Select
              </button>
              <button type="button">Hotspot</button>
              <button type="button">Walk area</button>
              <button type="button">Occluder</button>
            </div>
            <div className="canvas-meta">
              {selectedScene
                ? `Layered 2D - ${sceneLabel} - ${selectedScene.hotspots.length} hotspot(s)`
                : "No scene loaded"}
            </div>
          </div>

          <div
            className="scene-viewport"
            style={{ background: selectedScene?.background ?? "#24384a" }}
          >
            {selectedScene ? (
              <>
                {selectedScene.shapes.map((shape) => (
                  <div
                    className={`scene-shape ${shape.shape}`}
                    key={shape.id}
                    style={{
                      background: shape.fill,
                      height: `${(shape.bounds.height / selectedScene.size.height) * 100}%`,
                      left: `${(shape.bounds.x / selectedScene.size.width) * 100}%`,
                      top: `${(shape.bounds.y / selectedScene.size.height) * 100}%`,
                      width: `${(shape.bounds.width / selectedScene.size.width) * 100}%`,
                      zIndex: shape.depth
                    }}
                  />
                ))}
                {previewWalkArea ? (
                  <svg
                    className="walk-region"
                    viewBox={`0 0 ${selectedScene.size.width} ${selectedScene.size.height}`}
                    preserveAspectRatio="none"
                  >
                    <polygon className="walk-region-fill" points={previewWalkAreaPoints} />
                    <polygon className="walk-region-outline" points={previewWalkAreaPoints} />
                    {previewWalkArea.points.map((point, index) => (
                      <g key={`walk-point-${index}`}>
                        <circle className="walk-region-point" cx={point.x} cy={point.y} r="7" />
                        <text className="walk-region-label" x={point.x + 10} y={point.y - 10}>
                          {index + 1}
                        </text>
                      </g>
                    ))}
                  </svg>
                ) : null}
                <div
                  className="character"
                  style={{
                    left: `${(selectedScene.playerStart.x / selectedScene.size.width) * 100}%`,
                    top: `${(selectedScene.playerStart.y / selectedScene.size.height) * 100}%`
                  }}
                >
                  <span />
                </div>
                {selectedScene.hotspots.map((hotspot) => (
                  <button
                    className={`hotspot-box ${selectedHotspot?.id === hotspot.id ? "selected" : ""}`}
                    key={hotspot.id}
                    type="button"
                    onClick={() => selectHotspot(hotspot)}
                    style={{
                      height: `${(hotspot.bounds.height / selectedScene.size.height) * 100}%`,
                      left: `${(hotspot.bounds.x / selectedScene.size.width) * 100}%`,
                      top: `${(hotspot.bounds.y / selectedScene.size.height) * 100}%`,
                      width: `${(hotspot.bounds.width / selectedScene.size.width) * 100}%`
                    }}
                  >
                    <span>{hotspot.id}</span>
                  </button>
                ))}
              </>
            ) : (
              <div className="empty-scene">Open a project to inspect a scene.</div>
            )}
          </div>

          <div className="timeline-strip">
            <span>Project</span>
            <div className="timeline-node selected">{project?.sceneCount ?? 0} scene(s)</div>
            <div className="timeline-node">{project?.flowCount ?? 0} flow(s)</div>
            <div className="timeline-node">{project?.localeCount ?? 0} locale(s)</div>
            <div className="timeline-node">{project?.directory ?? "No folder"}</div>
          </div>
        </section>

        <aside className="inspector-panel panel">
          <div className="panel-heading">
            <span>Inspector</span>
            <small>
              {selectedFlow
                ? "Flow"
                : selectedLocale
                  ? "Locale"
                  : selectedHotspot
                    ? "Hotspot"
                    : selectedScene
                      ? "Scene"
                      : ""}
            </small>
          </div>
          <div className="inspector-content">
            {selectedFlow && currentFlowDraft ? (
              <>
                <label>
                  Flow
                  <input value={currentFlowDraft.id} readOnly />
                </label>
                <label>
                  Name
                  <input
                    value={currentFlowDraft.name}
                    onChange={(event) =>
                      updateFlowDraft((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Start node
                  <select
                    value={currentFlowDraft.startNodeId}
                    onChange={(event) =>
                      updateFlowDraft((current) => ({ ...current, startNodeId: event.target.value }))
                    }
                  >
                    {flowNodeIds.map((nodeId) => (
                      <option key={nodeId} value={nodeId}>
                        {nodeId}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flow-nodes">
                  {currentFlowDraft.nodes.map((node, index) => (
                    <div className="flow-node-card" key={`${node.type}-${index}-${node.id}`}>
                      <div className="flow-node-header">
                        <strong>{node.type}</strong>
                        <button type="button" onClick={() => removeFlowNode(index)}>
                          Remove
                        </button>
                      </div>
                      <label>
                        Node id
                        <input
                          value={node.id}
                          onChange={(event) =>
                            updateFlowNode(index, (current) => ({ ...current, id: event.target.value }))
                          }
                        />
                      </label>
                      {node.type === "line" ? (
                        <>
                          <label>
                            Speaker id
                            <input
                              value={node.speakerId}
                              onChange={(event) =>
                                updateFlowNode(index, (current) =>
                                  current.type === "line"
                                    ? { ...current, speakerId: event.target.value }
                                    : current
                                )
                              }
                            />
                          </label>
                          <label>
                            Text key
                            <input
                              value={node.textKey}
                              onChange={(event) =>
                                updateFlowNode(index, (current) =>
                                  current.type === "line"
                                    ? { ...current, textKey: event.target.value }
                                    : current
                                )
                              }
                            />
                          </label>
                          <label>
                            Next
                            <select
                              value={node.next}
                              onChange={(event) =>
                                updateFlowNode(index, (current) =>
                                  current.type === "line" ? { ...current, next: event.target.value } : current
                                )
                              }
                            >
                              {flowNodeIds.map((nodeId) => (
                                <option key={nodeId} value={nodeId}>
                                  {nodeId}
                                </option>
                              ))}
                            </select>
                          </label>
                        </>
                      ) : null}
                      {node.type === "set-flag" ? (
                        <>
                          <label>
                            Flag key
                            <input
                              value={node.key}
                              onChange={(event) =>
                                updateFlowNode(index, (current) =>
                                  current.type === "set-flag" ? { ...current, key: event.target.value } : current
                                )
                              }
                            />
                          </label>
                          <label>
                            Value type
                            <select
                              value={node.valueKind}
                              onChange={(event) =>
                                updateFlowNode(index, (current) =>
                                  current.type === "set-flag"
                                    ? { ...current, valueKind: event.target.value as "string" | "number" | "boolean" }
                                    : current
                                )
                              }
                            >
                              <option value="boolean">boolean</option>
                              <option value="number">number</option>
                              <option value="string">string</option>
                            </select>
                          </label>
                          <label>
                            Value
                            <input
                              value={node.value}
                              onChange={(event) =>
                                updateFlowNode(index, (current) =>
                                  current.type === "set-flag" ? { ...current, value: event.target.value } : current
                                )
                              }
                            />
                          </label>
                          <label>
                            Next
                            <select
                              value={node.next}
                              onChange={(event) =>
                                updateFlowNode(index, (current) =>
                                  current.type === "set-flag"
                                    ? { ...current, next: event.target.value }
                                    : current
                                )
                              }
                            >
                              {flowNodeIds.map((nodeId) => (
                                <option key={nodeId} value={nodeId}>
                                  {nodeId}
                                </option>
                              ))}
                            </select>
                          </label>
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="flow-link">
                  <span>Add node</span>
                  <strong>
                    {currentFlowDraft.nodes.length} node(s)
                    {dirtyState.flowIds.has(selectedFlow.id) ? " - unsaved draft" : ""}
                  </strong>
                  <div className="flow-actions">
                    <button type="button" onClick={() => addFlowNode("line")}>
                      Add line
                    </button>
                    <button type="button" onClick={() => addFlowNode("set-flag")}>
                      Add set-flag
                    </button>
                    <button type="button" onClick={() => addFlowNode("end")}>
                      Add end
                    </button>
                    <button type="button" onClick={applyFlowChanges}>
                      Apply changes -&gt;
                    </button>
                  </div>
                </div>
              </>
            ) : selectedLocale ? (
              <>
                <label>
                  Locale
                  <input value={selectedLocale.locale} readOnly />
                </label>
                <div className="locale-strings">
                  {localeEntries.map(([key, value]) => (
                    <div className="locale-entry" key={key}>
                      <label>
                        Key
                        <input value={key} readOnly />
                      </label>
                      <label>
                        Value
                        <input
                          value={value}
                          onChange={(event) => updateLocaleValue(key, event.target.value)}
                        />
                      </label>
                      <button type="button" onClick={() => applyLocaleUpsert(key, currentLocaleDraft[key] ?? "")}>
                        Save string
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flow-link">
                  <span>Add string</span>
                  <input
                    placeholder="key.path"
                    value={currentLocaleEntryDraft.key}
                    onChange={(event) => updateLocaleEntryDraft("key", event.target.value)}
                  />
                  <textarea
                    placeholder="Localized text"
                    value={currentLocaleEntryDraft.value}
                    onChange={(event) => updateLocaleEntryDraft("value", event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      applyLocaleUpsert(currentLocaleEntryDraft.key, currentLocaleEntryDraft.value)
                    }
                  >
                    Add or update
                  </button>
                </div>
              </>
            ) : selectedHotspot ? (
              <>
                <label>
                  Name
                  <input value={selectedHotspot.id} readOnly />
                </label>
                <label>
                  Display label
                  <input
                    value={currentHotspotDraft.labelKey}
                    onChange={(event) => updateHotspotDraft("labelKey", event.target.value)}
                  />
                </label>
                <div className="field-group">
                  <span>Bounds</span>
                  <div className="four-fields">
                    <input
                      aria-label="X"
                      value={currentHotspotDraft.x}
                      onChange={(event) => updateHotspotDraft("x", event.target.value)}
                    />
                    <input
                      aria-label="Y"
                      value={currentHotspotDraft.y}
                      onChange={(event) => updateHotspotDraft("y", event.target.value)}
                    />
                    <input
                      aria-label="Width"
                      value={currentHotspotDraft.width}
                      onChange={(event) => updateHotspotDraft("width", event.target.value)}
                    />
                    <input
                      aria-label="Height"
                      value={currentHotspotDraft.height}
                      onChange={(event) => updateHotspotDraft("height", event.target.value)}
                    />
                  </div>
                </div>
                <label>
                  Cursor
                  <select
                    value={currentHotspotDraft.cursor}
                    onChange={(event) => updateHotspotDraft("cursor", event.target.value)}
                  >
                    <option value="">Default</option>
                    <option value="enter">Enter</option>
                    <option value="look">Look</option>
                    <option value="talk">Talk</option>
                    <option value="use">Use</option>
                  </select>
                </label>
                <label>
                  Flow
                  <input
                    value={currentHotspotDraft.actionFlowId}
                    onChange={(event) => updateHotspotDraft("actionFlowId", event.target.value)}
                  />
                </label>
                <div className="flow-link">
                  <span>On activate</span>
                  <strong>
                    {currentHotspotDraft.actionFlowId || "missing"}
                    {selectedScene && dirtyState.hotspotKeys.has(createHotspotKey(selectedScene.id, selectedHotspot.id))
                      ? " - unsaved draft"
                      : ""}
                  </strong>
                  <button type="button" onClick={applyHotspotChanges}>
                    Apply changes -&gt;
                  </button>
                </div>
              </>
            ) : selectedScene ? (
              <>
                <label>
                  Scene
                  <input value={selectedScene.id} readOnly />
                </label>
                <label>
                  Name
                  <input
                    value={currentSceneDraft.name}
                    onChange={(event) => updateSceneDraft("name", event.target.value)}
                  />
                </label>
                <label>
                  Background
                  <input
                    value={currentSceneDraft.background}
                    onChange={(event) => updateSceneDraft("background", event.target.value)}
                  />
                </label>
                <div className="field-group">
                  <span>Player start</span>
                  <div className="four-fields">
                    <input
                      aria-label="Player start X"
                      value={currentSceneDraft.playerStartX}
                      onChange={(event) => updateSceneDraft("playerStartX", event.target.value)}
                    />
                    <input
                      aria-label="Player start Y"
                      value={currentSceneDraft.playerStartY}
                      onChange={(event) => updateSceneDraft("playerStartY", event.target.value)}
                    />
                  </div>
                </div>
                <div className="field-group">
                  <span>Walk area</span>
                  <div className="walk-points">
                    {currentSceneDraft.walkAreaPoints.map((point, index) => (
                      <div className="walk-point-card" key={`walk-point-editor-${index}`}>
                        <strong>Point {index + 1}</strong>
                        <div className="four-fields">
                          <input
                            aria-label={`Walk area point ${index + 1} X`}
                            value={point.x}
                            onChange={(event) => updateWalkAreaPoint(index, "x", event.target.value)}
                          />
                          <input
                            aria-label={`Walk area point ${index + 1} Y`}
                            value={point.y}
                            onChange={(event) => updateWalkAreaPoint(index, "y", event.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          disabled={currentSceneDraft.walkAreaPoints.length <= 3}
                          onClick={() => removeWalkAreaPoint(index)}
                        >
                          Remove point
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addWalkAreaPoint}>
                    Add point
                  </button>
                </div>
                <div className="flow-link">
                  <span>Layered 2D scene</span>
                  <strong>
                    {selectedScene.name}
                    {dirtyState.sceneIds.has(selectedScene.id) ? " - unsaved draft" : ""}
                  </strong>
                  <button type="button" onClick={applySceneChanges}>
                    Apply changes -&gt;
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-inspector">No project loaded.</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
