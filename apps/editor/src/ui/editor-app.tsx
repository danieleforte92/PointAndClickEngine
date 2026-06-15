import type {
  AssetDocument,
  CursorValue,
  FlowDocument,
  Hotspot,
  ItemDocument,
  LocaleDocument,
  SceneDocument,
  ScenePickup
} from "@pointclick/contracts";
import { startTransition, useEffect, useMemo, useState } from "react";
import {
  capabilityBadgeLabel,
  capabilityStatusTone,
  toolCapabilities,
  workspaceCapabilities
} from "../editor-capabilities";
import {
  buildHotspotUseItemFlows,
  buildFlowNodes,
  buildRecoverySnapshot,
  commitHistory,
  createFlowDraft,
  createHistoryState,
  createHotspotDraft,
  createItemDraft,
  createNewFlowNode,
  createPickupDraft,
  createSceneDraft,
  createHotspotKey,
  createPickupKey,
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
import { buildDraftProjectBundle } from "../preview-session";
import type { EditorProjectSnapshot } from "../preload";
import type { EditorValidationReport, EditorValidationRunState } from "../validation-report";
import { createValidationReport } from "../validation-report";

const emptyHistory = createHistoryState(
  initializeEditorSession({
    activeFlowId: null,
    activeHotspotId: null,
    activeItemId: null,
    activeLocale: null,
    activePickupId: null,
    activeSceneId: "",
    directory: "",
    flows: [],
    items: [],
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

function itemFromSnapshot(snapshot: EditorProjectSnapshot | null, itemId: string | null) {
  if (!snapshot || !itemId) return null;
  return snapshot.items.find((item) => item.id === itemId) ?? null;
}

function pickupFromSnapshot(
  snapshot: EditorProjectSnapshot | null,
  sceneId: string | null,
  pickupId: string | null
) {
  const scene = sceneFromSnapshot(snapshot, sceneId);
  if (!scene || !pickupId) return null;
  return scene.pickups.find((pickup) => pickup.id === pickupId) ?? null;
}

function assetFromSnapshot(snapshot: EditorProjectSnapshot | null, assetId: string | null) {
  if (!snapshot || !assetId) return null;
  return snapshot.assets.find((asset) => asset.id === assetId) ?? null;
}

function isHexColor(value: string): boolean {
  return hexColorPattern.test(value);
}

function sceneBackgroundStyle(background: string, assetBase = "") {
  if (isHexColor(background)) {
    return { background };
  }
  const normalizedBase = assetBase.replace(/\\/g, "/").replace(/\/?$/, "/");
  const assetUrl = assetBase
    ? normalizedBase.startsWith("http")
      ? `${normalizedBase}${background}`
      : `file:///${normalizedBase}${background}`
    : background;
  return {
    background: "#24384a",
    backgroundImage: `url("${assetUrl}")`,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover"
  };
}

function assetUsage(asset: AssetDocument, snapshot: EditorProjectSnapshot | null) {
  if (!snapshot) return [];
  return sceneItems(snapshot.scenes)
    .filter((scene) => scene.background === asset.path)
    .map((scene) => ({ sceneId: scene.id, sceneName: scene.name }));
}

function assetHealth(asset: AssetDocument, snapshot: EditorProjectSnapshot | null) {
  if (!snapshot) return "available";
  return snapshot.diagnostics.some(
    (diagnostic) =>
      diagnostic.code === "asset.file-missing" && diagnostic.documentId === asset.id
  )
    ? "missing"
    : "available";
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

function healthSummary(
  diagnostics: EditorProjectSnapshot["diagnostics"],
  dirtyDraftCount: number
) {
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warningCount = diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;

  if (errorCount > 0) {
    return {
      detail: `${dirtyDraftCount} dirty draft(s)`,
      label: `${errorCount} error(s), ${warningCount} warning(s)`,
      tone: "error" as const
    };
  }
  if (warningCount > 0 || dirtyDraftCount > 0) {
    return {
      detail: `${dirtyDraftCount} dirty draft(s)`,
      label: `${warningCount} warning(s), project needs review`,
      tone: "warn" as const
    };
  }
  return {
    detail: "No draft changes pending",
    label: "Project ready for preview",
    tone: "good" as const
  };
}

function formatValidationTimestamp(timestamp: string | null): string {
  if (!timestamp) return "Not run yet";
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) return timestamp;
  return value.toLocaleString("it-IT", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function validationTone(report: EditorValidationReport | null): "good" | "warn" | "error" | "muted" {
  if (!report) return "muted";
  if (report.summary.errorCount > 0) return "error";
  if (report.summary.warningCount > 0) return "warn";
  return "good";
}

function validationSummaryLabel(report: EditorValidationReport | null): string {
  if (!report) return "No validation run yet";
  if (report.summary.errorCount > 0) {
    return `${report.summary.errorCount} error(s), ${report.summary.warningCount} warning(s)`;
  }
  if (report.summary.warningCount > 0) {
    return `${report.summary.warningCount} warning(s), review recommended`;
  }
  return "Validation passed";
}

export function EditorApp() {
  const [workspace, setWorkspace] = useState<Workspace>("overview");
  const [status, setStatus] = useState("Loading project...");
  const [project, setProject] = useState<EditorProjectSnapshot | null>(null);
  const [history, setHistory] = useState<EditorHistoryState>(emptyHistory);
  const [pendingRecovery, setPendingRecovery] = useState<EditorRecoverySnapshot | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [validationRunState, setValidationRunState] = useState<EditorValidationRunState>("idle");
  const [validationReport, setValidationReport] = useState<EditorValidationReport | null>(null);
  const [validationStatus, setValidationStatus] = useState("Validation uses saved project files.");

  const session = history.present;
  const scenes = project ? sceneItems(project.scenes) : [];
  const selectedScene =
    sceneFromSnapshot(project, session.activeSceneId) ?? project?.selectedScene ?? scenes[0] ?? null;
  const selectedHotspot =
    hotspotFromSnapshot(project, session.activeSceneId, session.activeHotspotId) ?? null;
  const selectedLocale = localeFromSnapshot(project, session.activeLocale) ?? null;
  const selectedFlow = flowFromSnapshot(project, session.activeFlowId) ?? null;
  const selectedItem = itemFromSnapshot(project, session.activeItemId) ?? project?.selectedItem ?? null;
  const selectedPickup =
    pickupFromSnapshot(project, session.activeSceneId, session.activePickupId) ?? null;
  const selectedAsset =
    assetFromSnapshot(project, selectedAssetId) ?? project?.selectedAsset ?? project?.assets[0] ?? null;

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
  const currentItemDraft = selectedItem
    ? session.itemDrafts[selectedItem.id] ?? createItemDraft(selectedItem)
    : createItemDraft(null);
  const currentPickupDraft =
    selectedScene && selectedPickup
      ? session.pickupDrafts[createPickupKey(selectedScene.id, selectedPickup.id)] ??
        createPickupDraft(selectedPickup)
      : createPickupDraft(null);

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
            itemIds: new Set<string>(),
            localeIds: new Set<string>(),
            pickupKeys: new Set<string>(),
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
  const workspaceCapability = workspaceCapabilities.find((item) => item.workspace === workspace) ?? workspaceCapabilities[0]!;
  const previewRequest = project
    ? {
        bundle: buildDraftProjectBundle(project, history.present),
        sceneId: selectedScene?.id ?? project.activeSceneId
      }
    : undefined;
  const projectHealth = project ? healthSummary(project.diagnostics, dirtyState.count) : null;
  const currentValidationReport =
    validationReport ??
    (project ? createValidationReport(project.directory, project.diagnostics, "") : null);
  const previewReadinessLabel =
    currentValidationReport?.summary.errorCount
      ? "Preview blocked for saved project content"
      : currentValidationReport?.summary.warningCount
        ? "Preview available, but saved project needs review"
        : dirtyState.count > 0
          ? "Preview can include unsaved drafts"
          : "Preview aligned with saved project";
  const selectedAssetUsage = selectedAsset ? assetUsage(selectedAsset, project) : [];
  const selectedAssetHealth = selectedAsset ? assetHealth(selectedAsset, project) : "available";

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
      setSelectedAssetId(snapshot.selectedAsset?.id ?? snapshot.assets[0]?.id ?? null);
      setValidationRunState("idle");
      setValidationReport(null);
      setValidationStatus("Validation uses saved project files.");
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
    setStatus("Opening isolated preview...");
    await window.pointClick.openPreview(previewRequest);
    setStatus("Preview connected to the current project");
  };

  const openBrowser = async () => {
    await window.pointClick.openInBrowser(previewRequest);
    setStatus("Browser preview opened with the current project");
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

  const importAssets = async () => {
    setStatus("Importing assets...");
    try {
      const snapshot = await window.pointClick.importAssets();
      if (!snapshot) {
        setStatus(project ? `Loaded ${project.manifest.title}` : "Asset import cancelled");
        return;
      }
      setProject(snapshot);
      setSelectedAssetId(snapshot.selectedAsset?.id ?? snapshot.assets.at(-1)?.id ?? null);
      setWorkspace("assets");
      setStatus(`Imported asset library now contains ${snapshot.assetCount} asset(s)`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Assets could not be imported");
    }
  };

  const assignAssetBackground = async () => {
    if (!selectedScene || !selectedAsset) return;
    setStatus(`Assigning ${selectedAsset.id} to ${selectedScene.id}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "scene/update",
        patch: {
          background: selectedAsset.path,
          name: selectedScene.name,
          playerStart: selectedScene.playerStart,
          walkArea: selectedScene.walkArea
        },
        sceneId: selectedScene.id
      });
      setProject(snapshot);
      setStatus(`Assigned ${selectedAsset.id} as the background for ${selectedScene.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Asset background could not be assigned");
    }
  };

  const runValidation = async () => {
    if (!project) return;
    setValidationRunState("running");
    setValidationStatus("Validating saved project files...");
    try {
      const report = await window.pointClick.runValidation();
      setValidationReport(report);
      setValidationRunState("completed");
      setValidationStatus(
        report.summary.errorCount > 0
          ? "Validation completed with blocking errors."
          : report.summary.warningCount > 0
            ? "Validation completed with warnings."
            : "Validation completed successfully."
      );
    } catch (error) {
      setValidationRunState("failed-to-run");
      setValidationStatus(error instanceof Error ? error.message : "Validation could not be completed");
    }
  };

  const selectScene = (sceneId: string) => {
    updateSessionSelection((current) => ({
      ...current,
      activeFlowId: null,
      activeHotspotId: null,
      activeItemId: null,
      activeLocale: null,
      activePickupId: null,
      activeSceneId: sceneId
    }));
  };

  const selectHotspot = (hotspot: Hotspot) => {
    updateSessionSelection((current) => ({
      ...current,
      activeFlowId: null,
      activeHotspotId: hotspot.id,
      activeItemId: null,
      activeLocale: null,
      activePickupId: null
    }));
  };

  const selectPickup = (pickup: ScenePickup) => {
    updateSessionSelection((current) => ({
      ...current,
      activeFlowId: null,
      activeHotspotId: null,
      activeItemId: null,
      activeLocale: null,
      activePickupId: pickup.id
    }));
  };

  const selectLocale = (locale: LocaleDocument) => {
    updateSessionSelection((current) => ({
      ...current,
      activeFlowId: null,
      activeHotspotId: null,
      activeItemId: null,
      activeLocale: locale.locale,
      activePickupId: null
    }));
  };

  const selectFlow = (flow: FlowDocument) => {
    updateSessionSelection((current) => ({
      ...current,
      activeFlowId: flow.id,
      activeHotspotId: null,
      activeItemId: null,
      activeLocale: null,
      activePickupId: null
    }));
  };

  const selectItem = (item: ItemDocument) => {
    updateSessionSelection((current) => ({
      ...current,
      activeFlowId: null,
      activeHotspotId: null,
      activeItemId: item.id,
      activeLocale: null,
      activePickupId: null
    }));
  };

  const updateHotspotDraft = <K extends keyof typeof currentHotspotDraft>(
    field: K,
    value: (typeof currentHotspotDraft)[K]
  ) => {
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

  const updatePickupDraft = <K extends keyof typeof currentPickupDraft>(
    field: K,
    value: (typeof currentPickupDraft)[K]
  ) => {
    if (!selectedScene || !selectedPickup) return;
    const key = createPickupKey(selectedScene.id, selectedPickup.id);
    updateDraftWithHistory((current) => ({
      ...current,
      pickupDrafts: {
        ...current.pickupDrafts,
        [key]: {
          ...(current.pickupDrafts[key] ?? createPickupDraft(selectedPickup)),
          [field]: value
        }
      }
    }));
  };

  const updateItemDraft = <K extends keyof typeof currentItemDraft>(
    field: K,
    value: (typeof currentItemDraft)[K]
  ) => {
    if (!selectedItem) return;
    updateDraftWithHistory((current) => ({
      ...current,
      itemDrafts: {
        ...current.itemDrafts,
        [selectedItem.id]: {
          ...(current.itemDrafts[selectedItem.id] ?? createItemDraft(selectedItem)),
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
    const lookFlowId = currentHotspotDraft.lookFlowId.trim();
    const talkFlowId = currentHotspotDraft.talkFlowId.trim();
    const useFlowId = currentHotspotDraft.useFlowId.trim();
    const cursor = currentHotspotDraft.cursor.trim();

    if (x === null || y === null || width === null || height === null) {
      setStatus("Bounds must be valid numbers, with width and height above zero");
      return;
    }
    if (!labelKey) {
      setStatus("Label key is required");
      return;
    }
    if (cursor && !cursorOptions.includes(cursor as CursorValue)) {
      setStatus("Cursor must be blank, look, talk, use, or enter");
      return;
    }

    setStatus(`Saving ${selectedHotspot.id}...`);
    try {
      const patch = {
        actions: {
          lookFlowId: lookFlowId || undefined,
          talkFlowId: talkFlowId || undefined,
          useFlowId: useFlowId || undefined,
          useItemFlows: buildHotspotUseItemFlows(currentHotspotDraft.useItemFlows)
        },
        bounds: { x, y, width, height },
        labelKey
      } as {
        actions: {
          lookFlowId?: string;
          talkFlowId?: string;
          useFlowId?: string;
          useItemFlows: Array<{ itemId: string; flowId: string }>;
        };
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
    if (!background) {
      setStatus("Background is required");
      return;
    }
    if (background.startsWith("#") && !hexColorPattern.test(background)) {
      setStatus("Background color must be a valid #RRGGBB value");
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

  const applyPickupChanges = async () => {
    if (!selectedScene || !selectedPickup) return;

    const x = parseNumber(currentPickupDraft.x);
    const y = parseNumber(currentPickupDraft.y);
    const width = parsePositiveNumber(currentPickupDraft.width);
    const height = parsePositiveNumber(currentPickupDraft.height);
    const itemId = currentPickupDraft.itemId.trim();
    const labelKey = currentPickupDraft.labelKey.trim();
    const pickupFlowId = currentPickupDraft.pickupFlowId.trim();

    if (x === null || y === null || width === null || height === null) {
      setStatus("Pickup bounds must be valid numbers, with width and height above zero");
      return;
    }
    if (!itemId) {
      setStatus("Pickup item id is required");
      return;
    }
    if (!labelKey) {
      setStatus("Pickup label key is required");
      return;
    }

    setStatus(`Saving ${selectedPickup.id}...`);
    try {
      const patch = {
        bounds: { x, y, width, height },
        itemId,
        labelKey
      } as {
        bounds: { x: number; y: number; width: number; height: number };
        itemId: string;
        labelKey: string;
        pickupFlowId?: string;
      };
      if (pickupFlowId) {
        patch.pickupFlowId = pickupFlowId;
      }

      const snapshot = await window.pointClick.applyCommand({
        type: "pickup/update",
        pickupId: selectedPickup.id,
        patch,
        sceneId: selectedScene.id
      });
      setProject(snapshot);
      setHistory((current) => ({
        ...current,
        present: discardSavedDraft(
          current.present,
          "pickup",
          createPickupKey(selectedScene.id, selectedPickup.id)
        )
      }));
      setStatus(`Saved ${selectedPickup.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save pickup");
    }
  };

  const applyItemChanges = async () => {
    if (!selectedItem) return;

    const name = currentItemDraft.name.trim();
    const labelKey = currentItemDraft.labelKey.trim();

    if (!name) {
      setStatus("Item name is required");
      return;
    }
    if (!labelKey) {
      setStatus("Item label key is required");
      return;
    }

    setStatus(`Saving ${selectedItem.id}...`);
    try {
      const snapshot = await window.pointClick.applyCommand({
        type: "item/update",
        itemId: selectedItem.id,
        patch: {
          labelKey,
          name
        }
      });
      setProject(snapshot);
      setHistory((current) => ({
        ...current,
        present: discardSavedDraft(current.present, "item", selectedItem.id)
      }));
      setStatus(`Saved ${selectedItem.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save item");
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
          {workspaceCapabilities.map((item) => (
            <button
              className={workspace === item.workspace ? "active" : ""}
              key={item.id}
              title={item.detail}
              type="button"
              onClick={() => setWorkspace(item.workspace)}
            >
              <span>{item.label}</span>
              <span className={`capability-badge ${capabilityStatusTone(item.status)}`}>
                {capabilityBadgeLabel(item.status)}
              </span>
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
            Open in Browser
          </button>
          <button className="play-action" type="button" onClick={play}>
            <span>&#9654;</span> {dirtyState.count > 0 ? "Play Draft Preview" : "Play Project"}
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
              Open
            </button>
          </div>
          <div className="tree">
            <div className="tree-group open">Scenes</div>
            {scenes.map((scene) => (
              <button
                className={`tree-item ${session.activeLocale === null && session.activeFlowId === null && !session.activeHotspotId && !session.activePickupId && !session.activeItemId && selectedScene?.id === scene.id ? "selected" : ""}`}
                key={scene.id}
                type="button"
                onClick={() => selectScene(scene.id)}
              >
                <span className="scene-dot" /> {scene.name}
                {dirtyState.sceneIds.has(scene.id) ? <span className="dirty-mark">*</span> : null}
              </button>
            ))}
            <div className="tree-group open">Pickups ({selectedScene?.pickups.length ?? 0})</div>
            {selectedScene?.pickups.map((pickup) => (
              <button
                className={`tree-item tree-child ${session.activePickupId === pickup.id ? "selected" : ""}`}
                key={pickup.id}
                type="button"
                onClick={() => selectPickup(pickup)}
              >
                <span className="scene-dot muted" /> {pickup.id}
                {dirtyState.pickupKeys.has(createPickupKey(selectedScene.id, pickup.id)) ? (
                  <span className="dirty-mark">*</span>
                ) : null}
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
            <div className="tree-group open">Items ({project?.itemCount ?? 0})</div>
            {project?.items.map((item) => (
              <button
                className={`tree-item ${session.activeItemId === item.id ? "selected" : ""}`}
                key={item.id}
                type="button"
                onClick={() => selectItem(item)}
              >
                <span className="scene-dot muted" /> {item.id}
                {dirtyState.itemIds.has(item.id) ? <span className="dirty-mark">*</span> : null}
              </button>
            ))}
            <div className="tree-group open">Assets ({project?.assetCount ?? 0})</div>
            {project?.assets.map((asset) => (
              <button
                className={`tree-item ${selectedAsset?.id === asset.id && workspace === "assets" ? "selected" : ""}`}
                key={asset.id}
                type="button"
                onClick={() => {
                  setSelectedAssetId(asset.id);
                  setWorkspace("assets");
                }}
              >
                <span className="scene-dot muted" /> {asset.id}
                {assetHealth(asset, project) === "missing" ? <span className="dirty-mark">!</span> : null}
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
            <span className={`health-light ${projectHealth?.tone ?? "warn"}`} />
            <div>
              <strong>{projectHealth?.label ?? "Loading project health..."}</strong>
              <small>
                {projectHealth ? `${projectHealth.detail} - ${localeLabel}` : status}
              </small>
            </div>
          </div>
        </aside>

        <section className="canvas-panel panel">
          <div className="canvas-toolbar">
            <div className="toolset">
              {toolCapabilities.map((tool) => (
                <button
                  className={tool.id === "tool-select" && workspace === "scene" ? "active" : ""}
                  disabled={tool.status !== "available"}
                  key={tool.id}
                  title={`${capabilityBadgeLabel(tool.status)}: ${tool.detail}`}
                  type="button"
                >
                  {tool.label}
                </button>
              ))}
            </div>
            <div className="canvas-meta">
              {workspace === "overview"
                ? "Editor overview and capability status"
                : workspace === "scene" && selectedScene
                  ? `Layered 2D - ${sceneLabel} - ${selectedScene.hotspots.length} hotspot(s) - ${selectedScene.pickups.length} pickup(s)`
                  : workspace === "narrative"
                    ? "Structured flow and locale editing"
                    : workspaceCapability.summary}
            </div>
          </div>

          {workspace === "overview" ? (
            <div className="workspace-overview">
              <section className="overview-card">
                <span className="overview-label">Project health</span>
                <strong>{projectHealth?.label ?? "Loading project..."}</strong>
                <p>{status}</p>
              </section>
              <section className="overview-card">
                <span className="overview-label">Preview target</span>
                <strong>{dirtyState.count > 0 ? "Draft bundle" : "Saved project bundle"}</strong>
                <p>
                  {selectedScene
                    ? `Preview starts from ${selectedScene.id} in the currently opened project.`
                    : "Open a project to prepare a preview bundle."}
                </p>
              </section>
              <section className="overview-card">
                <span className="overview-label">Capabilities</span>
                <div className="capability-list">
                  {workspaceCapabilities.map((item) => (
                    <div className="capability-card" key={item.id}>
                      <div>
                        <strong>{item.label}</strong>
                        <p>{item.summary}</p>
                      </div>
                      <span className={`capability-badge ${capabilityStatusTone(item.status)}`}>
                        {capabilityBadgeLabel(item.status)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
              <section className="overview-card">
                <span className="overview-label">Diagnostics</span>
                <div className="diagnostic-list">
                  {project?.diagnostics.length ? (
                    project.diagnostics.slice(0, 6).map((diagnostic, index) => (
                      <div className={`diagnostic-item ${diagnostic.severity}`} key={`${diagnostic.code}-${index}`}>
                        <strong>{diagnostic.code}</strong>
                        <p>{diagnostic.message}</p>
                      </div>
                    ))
                  ) : (
                    <p>No project diagnostics right now.</p>
                  )}
                </div>
              </section>
            </div>
          ) : workspace === "build" ? (
            <div className="workspace-overview build-workspace">
              <section className="overview-card">
                <span className="overview-label">Project validation</span>
                <strong>{validationSummaryLabel(currentValidationReport)}</strong>
                <p>{validationStatus}</p>
                <div className="build-actions">
                  <button
                    className="play-action"
                    disabled={!project || validationRunState === "running"}
                    type="button"
                    onClick={runValidation}
                  >
                    {validationRunState === "running" ? "Validating..." : "Validate Project"}
                  </button>
                </div>
              </section>
              <section className="overview-card">
                <span className="overview-label">Last validation</span>
                <strong>{formatValidationTimestamp(validationReport?.ranAt ?? null)}</strong>
                <p>Saved target: {project?.directory ?? "No project loaded"}</p>
              </section>
              <section className="overview-card">
                <span className="overview-label">Preview readiness</span>
                <strong>{previewReadinessLabel}</strong>
                <p>
                  {dirtyState.count > 0
                    ? `${dirtyState.count} draft change(s) exist outside saved-file validation.`
                    : "Saved validation and preview target currently match."}
                </p>
              </section>
              <section className="overview-card">
                <span className="overview-label">Diagnostics</span>
                <div className="diagnostic-list">
                  {currentValidationReport?.diagnostics.length ? (
                    currentValidationReport.diagnostics.map((diagnostic, index) => (
                      <div className={`diagnostic-item ${diagnostic.severity}`} key={`${diagnostic.code}-${index}`}>
                        <div>
                          <strong>{diagnostic.code}</strong>
                          <p>{diagnostic.message}</p>
                          {diagnostic.path ? <p className="diagnostic-meta">{diagnostic.path}</p> : null}
                        </div>
                        <span
                          className={`capability-badge ${
                            diagnostic.severity === "error" ? "warn" : "muted"
                          }`}
                        >
                          {diagnostic.severity}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p>No diagnostics found for the saved project.</p>
                  )}
                </div>
              </section>
            </div>
          ) : workspace === "assets" ? (
            <div className="workspace-overview build-workspace">
              <section className="overview-card">
                <span className="overview-label">Project library</span>
                <strong>{project?.assetCount ?? 0} registered asset(s)</strong>
                <p>{selectedAsset ? `${selectedAsset.id} selected` : "Import images into the project library."}</p>
                <div className="build-actions">
                  <button className="play-action" disabled={!project} type="button" onClick={importAssets}>
                    Import Assets
                  </button>
                </div>
              </section>
              <section className="overview-card">
                <span className="overview-label">Selected asset</span>
                <strong>{selectedAsset?.id ?? "No asset selected"}</strong>
                <p>
                  {selectedAsset
                    ? `${selectedAsset.kind} - ${selectedAsset.path}`
                    : "Choose an asset from the project tree to inspect it."}
                </p>
              </section>
              <section className="overview-card">
                <span className="overview-label">Usage</span>
                <strong>{selectedAssetUsage.length} scene reference(s)</strong>
                <div className="diagnostic-list">
                  {selectedAssetUsage.length ? (
                    selectedAssetUsage.map((usage) => (
                      <div className="diagnostic-item" key={usage.sceneId}>
                        <div>
                          <strong>{usage.sceneId}</strong>
                          <p>{usage.sceneName}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p>No scene background is using this asset yet.</p>
                  )}
                </div>
              </section>
              <section className="overview-card">
                <span className="overview-label">Health</span>
                <strong>{selectedAsset ? selectedAssetHealth : "n/a"}</strong>
                <p>
                  {selectedAssetHealth === "missing"
                    ? "The asset is registered, but its file is missing on disk."
                    : "The asset file is available to the project."}
                </p>
                {selectedAsset ? (
                  <div className="build-actions">
                    <button
                      className="secondary-action"
                      disabled={!selectedScene || selectedAsset.kind !== "image" || selectedAssetHealth === "missing"}
                      type="button"
                      onClick={assignAssetBackground}
                    >
                      Set As Scene Background
                    </button>
                  </div>
                ) : null}
              </section>
            </div>
          ) : (
            <div
              className="scene-viewport"
              style={
                selectedScene
                  ? sceneBackgroundStyle(selectedScene.background, project?.directory ?? "")
                  : { background: "#24384a" }
              }
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
                {selectedScene.pickups.map((pickup) => (
                  <button
                    className={`pickup-box ${selectedPickup?.id === pickup.id ? "selected" : ""}`}
                    key={pickup.id}
                    type="button"
                    onClick={() => selectPickup(pickup)}
                    style={{
                      height: `${(pickup.bounds.height / selectedScene.size.height) * 100}%`,
                      left: `${(pickup.bounds.x / selectedScene.size.width) * 100}%`,
                      top: `${(pickup.bounds.y / selectedScene.size.height) * 100}%`,
                      width: `${(pickup.bounds.width / selectedScene.size.width) * 100}%`
                    }}
                  >
                    <span>{pickup.id}</span>
                  </button>
                ))}
              </>
            ) : (
              <div className="empty-scene">Open a project to inspect a scene.</div>
            )}
            </div>
          )}

          <div className="timeline-strip">
            <span>Project</span>
            <div className="timeline-node selected">{project?.sceneCount ?? 0} scene(s)</div>
            <div className="timeline-node">{project?.flowCount ?? 0} flow(s)</div>
            <div className="timeline-node">{project?.itemCount ?? 0} item(s)</div>
            <div className="timeline-node">{project?.localeCount ?? 0} locale(s)</div>
            <div className="timeline-node">{project?.diagnostics.length ?? 0} diagnostic(s)</div>
            <div className="timeline-node">{project?.directory ?? "No folder"}</div>
          </div>
        </section>

        <aside className="inspector-panel panel">
          <div className="panel-heading">
            <span>Inspector</span>
            <small>
              {workspace === "overview"
                ? "Status"
                : workspace === "assets"
                  ? "Library"
                  : workspace === "build"
                    ? "Validation"
                  : selectedFlow
                ? "Flow"
                : selectedLocale
                  ? "Locale"
                  : selectedHotspot
                    ? "Hotspot"
                    : selectedPickup
                      ? "Pickup"
                      : selectedItem
                        ? "Item"
                    : selectedScene
                      ? "Scene"
                      : ""}
            </small>
          </div>
          <div className="inspector-content">
            {workspace === "overview" ? (
              <>
                <div className="flow-link">
                  <span>Current workspace</span>
                  <strong>{workspaceCapability.label}</strong>
                  <p className="inspector-copy">{workspaceCapability.detail}</p>
                </div>
                <div className="flow-link">
                  <span>Project diagnostics</span>
                  <strong>{project?.diagnostics.length ?? 0} total</strong>
                  <p className="inspector-copy">
                    {project?.diagnostics.filter((item) => item.severity === "error").length ?? 0} error(s),{" "}
                    {project?.diagnostics.filter((item) => item.severity === "warning").length ?? 0} warning(s)
                  </p>
                </div>
                <div className="flow-link">
                  <span>Draft status</span>
                  <strong>{dirtyState.count} dirty draft(s)</strong>
                  <p className="inspector-copy">
                    {dirtyState.count > 0
                      ? "Preview will use a temporary validated draft bundle."
                      : "Preview will use the saved project bundle."}
                  </p>
                </div>
              </>
            ) : workspace === "assets" ? (
              <div className="workspace-placeholder compact">
                <span className={`capability-badge ${selectedAssetHealth === "missing" ? "error" : "good"}`}>
                  {selectedAsset ? selectedAsset.kind : "Library"}
                </span>
                <strong>{selectedAsset?.id ?? workspaceCapability.summary}</strong>
                <p>{selectedAsset?.path ?? workspaceCapability.detail}</p>
                {selectedAsset ? (
                  <>
                    <p className="inspector-copy">Source: {selectedAsset.source}</p>
                    <p className="inspector-copy">Usage: {selectedAssetUsage.length} scene reference(s)</p>
                    <p className="inspector-copy">Health: {selectedAssetHealth}</p>
                  </>
                ) : null}
              </div>
            ) : workspace === "build" ? (
              <div className="workspace-placeholder compact">
                <span className={`capability-badge ${validationTone(currentValidationReport)}`}>
                  {validationRunState === "running" ? "Running" : "Validation"}
                </span>
                <strong>{validationSummaryLabel(currentValidationReport)}</strong>
                <p>{validationStatus}</p>
                <p className="inspector-copy">
                  Last run: {formatValidationTimestamp(validationReport?.ranAt ?? null)}
                </p>
                <p className="inspector-copy">Preview note: {previewReadinessLabel}</p>
              </div>
            ) : selectedFlow && currentFlowDraft ? (
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
                  Look flow
                  <input
                    value={currentHotspotDraft.lookFlowId}
                    onChange={(event) => updateHotspotDraft("lookFlowId", event.target.value)}
                  />
                </label>
                <label>
                  Talk flow
                  <input
                    value={currentHotspotDraft.talkFlowId}
                    onChange={(event) => updateHotspotDraft("talkFlowId", event.target.value)}
                  />
                </label>
                <label>
                  Use flow
                  <input
                    value={currentHotspotDraft.useFlowId}
                    onChange={(event) => updateHotspotDraft("useFlowId", event.target.value)}
                  />
                </label>
                <div className="field-group">
                  <span>Use item overrides</span>
                  <div className="use-item-flows">
                    {currentHotspotDraft.useItemFlows.map((entry, index) => (
                      <div className="use-item-flow-card" key={`use-item-flow-${index}`}>
                        <div className="four-fields">
                          <input
                            aria-label={`Use item ${index + 1}`}
                            placeholder="item-id"
                            value={entry.itemId}
                            onChange={(event) => {
                              const next = [...currentHotspotDraft.useItemFlows];
                              next[index] = { ...entry, itemId: event.target.value };
                              updateHotspotDraft("useItemFlows", next);
                            }}
                          />
                          <input
                            aria-label={`Use flow ${index + 1}`}
                            placeholder="flow-id"
                            value={entry.flowId}
                            onChange={(event) => {
                              const next = [...currentHotspotDraft.useItemFlows];
                              next[index] = { ...entry, flowId: event.target.value };
                              updateHotspotDraft("useItemFlows", next);
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateHotspotDraft(
                        "useItemFlows",
                        [...currentHotspotDraft.useItemFlows, { itemId: "", flowId: "" }]
                      )
                    }
                  >
                    Add item override
                  </button>
                </div>
                <div className="flow-link">
                  <span>Verb-aware hotspot</span>
                  <strong>
                    {currentHotspotDraft.useFlowId || currentHotspotDraft.lookFlowId || currentHotspotDraft.talkFlowId || "missing"}
                    {selectedScene && dirtyState.hotspotKeys.has(createHotspotKey(selectedScene.id, selectedHotspot.id))
                      ? " - unsaved draft"
                      : ""}
                  </strong>
                  <button type="button" onClick={applyHotspotChanges}>
                    Apply changes -&gt;
                  </button>
                </div>
              </>
            ) : selectedPickup ? (
              <>
                <label>
                  Pickup
                  <input value={selectedPickup.id} readOnly />
                </label>
                <label>
                  Item id
                  <input
                    value={currentPickupDraft.itemId}
                    onChange={(event) => updatePickupDraft("itemId", event.target.value)}
                  />
                </label>
                <label>
                  Display label
                  <input
                    value={currentPickupDraft.labelKey}
                    onChange={(event) => updatePickupDraft("labelKey", event.target.value)}
                  />
                </label>
                <label>
                  Pickup flow
                  <input
                    value={currentPickupDraft.pickupFlowId}
                    onChange={(event) => updatePickupDraft("pickupFlowId", event.target.value)}
                  />
                </label>
                <div className="field-group">
                  <span>Bounds</span>
                  <div className="four-fields">
                    <input
                      aria-label="Pickup X"
                      value={currentPickupDraft.x}
                      onChange={(event) => updatePickupDraft("x", event.target.value)}
                    />
                    <input
                      aria-label="Pickup Y"
                      value={currentPickupDraft.y}
                      onChange={(event) => updatePickupDraft("y", event.target.value)}
                    />
                    <input
                      aria-label="Pickup Width"
                      value={currentPickupDraft.width}
                      onChange={(event) => updatePickupDraft("width", event.target.value)}
                    />
                    <input
                      aria-label="Pickup Height"
                      value={currentPickupDraft.height}
                      onChange={(event) => updatePickupDraft("height", event.target.value)}
                    />
                  </div>
                </div>
                <div className="flow-link">
                  <span>Scene pickup</span>
                  <strong>
                    {currentPickupDraft.itemId || "unbound item"}
                    {selectedScene &&
                    dirtyState.pickupKeys.has(createPickupKey(selectedScene.id, selectedPickup.id))
                      ? " - unsaved draft"
                      : ""}
                  </strong>
                  <button type="button" onClick={applyPickupChanges}>
                    Apply changes -&gt;
                  </button>
                </div>
              </>
            ) : selectedItem ? (
              <>
                <label>
                  Item
                  <input value={selectedItem.id} readOnly />
                </label>
                <label>
                  Name
                  <input
                    value={currentItemDraft.name}
                    onChange={(event) => updateItemDraft("name", event.target.value)}
                  />
                </label>
                <label>
                  Label key
                  <input
                    value={currentItemDraft.labelKey}
                    onChange={(event) => updateItemDraft("labelKey", event.target.value)}
                  />
                </label>
                <div className="flow-link">
                  <span>Inventory item</span>
                  <strong>
                    {currentItemDraft.name || "unnamed item"}
                    {dirtyState.itemIds.has(selectedItem.id) ? " - unsaved draft" : ""}
                  </strong>
                  <button type="button" onClick={applyItemChanges}>
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
                <p className="inspector-copy">
                  Use `#RRGGBB` for color backgrounds or a registered asset path such as
                  `assets/imported/example.png`.
                </p>
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
