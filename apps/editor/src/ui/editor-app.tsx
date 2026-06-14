import type {
  CursorValue,
  Hotspot,
  Layered2DScene,
  LocaleDocument,
  SceneDocument
} from "@pointclick/contracts";
import { startTransition, useEffect, useMemo, useState } from "react";
import type { EditorProjectSnapshot } from "../preload";

type Workspace = "scene" | "narrative" | "assets" | "build";

interface HotspotDraft {
  actionFlowId: string;
  cursor: string;
  height: string;
  labelKey: string;
  width: string;
  x: string;
  y: string;
}

interface SceneDraft {
  background: string;
  name: string;
  playerStartX: string;
  playerStartY: string;
  walkAreaHeight: string;
  walkAreaWidth: string;
  walkAreaX: string;
  walkAreaY: string;
}

const workspaces: { id: Workspace; label: string }[] = [
  { id: "scene", label: "Scene" },
  { id: "narrative", label: "Narrative" },
  { id: "assets", label: "Asset Studio" },
  { id: "build", label: "Build" }
];

const cursorOptions: CursorValue[] = ["look", "talk", "use", "enter"];
const hexColorPattern = /^#[0-9a-fA-F]{6}$/;

function sceneItems(scenes: SceneDocument[]) {
  return scenes.filter((scene): scene is Layered2DScene => scene.type === "layered-2d");
}

function createHotspotDraft(hotspot: Hotspot | null): HotspotDraft {
  return {
    actionFlowId: hotspot?.actionFlowId ?? "",
    cursor: hotspot?.cursor ?? "",
    height: hotspot ? String(hotspot.bounds.height) : "",
    labelKey: hotspot?.labelKey ?? "",
    width: hotspot ? String(hotspot.bounds.width) : "",
    x: hotspot ? String(hotspot.bounds.x) : "",
    y: hotspot ? String(hotspot.bounds.y) : ""
  };
}

function createSceneDraft(scene: Layered2DScene | null): SceneDraft {
  return {
    background: scene?.background ?? "",
    name: scene?.name ?? "",
    playerStartX: scene ? String(scene.playerStart.x) : "",
    playerStartY: scene ? String(scene.playerStart.y) : "",
    walkAreaHeight: scene ? String(scene.walkArea.height) : "",
    walkAreaWidth: scene ? String(scene.walkArea.width) : "",
    walkAreaX: scene ? String(scene.walkArea.x) : "",
    walkAreaY: scene ? String(scene.walkArea.y) : ""
  };
}

function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseNumber(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export function EditorApp() {
  const [workspace, setWorkspace] = useState<Workspace>("scene");
  const [status, setStatus] = useState("Loading project...");
  const [project, setProject] = useState<EditorProjectSnapshot | null>(null);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);
  const [activeLocale, setActiveLocale] = useState<string | null>(null);
  const [hotspotDraft, setHotspotDraft] = useState<HotspotDraft>(() => createHotspotDraft(null));
  const [sceneDraft, setSceneDraft] = useState<SceneDraft>(() => createSceneDraft(null));
  const [localeDraft, setLocaleDraft] = useState<Record<string, string>>({});
  const [newLocaleKey, setNewLocaleKey] = useState("");
  const [newLocaleValue, setNewLocaleValue] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadInitialProject() {
      try {
        const snapshot = await window.pointClick.loadProject();
        if (cancelled) return;
        startTransition(() => {
          setProject(snapshot);
          setActiveSceneId(snapshot.activeSceneId);
          setActiveHotspotId(snapshot.activeHotspotId);
          setActiveLocale(null);
          setHotspotDraft(createHotspotDraft(snapshot.selectedHotspot));
          setSceneDraft(createSceneDraft(snapshot.selectedScene));
          setLocaleDraft(snapshot.selectedLocale?.strings ?? {});
          setNewLocaleKey("");
          setNewLocaleValue("");
        });
        setStatus(`Loaded ${snapshot.manifest.title}`);
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

  const scenes = project ? sceneItems(project.scenes) : [];
  const selectedScene =
    scenes.find((scene) => scene.id === activeSceneId) ??
    project?.selectedScene ??
    scenes[0] ??
    null;
  const selectedHotspot =
    activeHotspotId && selectedScene
      ? selectedScene.hotspots.find((hotspot) => hotspot.id === activeHotspotId) ?? null
      : null;
  const selectedLocale =
    activeLocale && project
      ? project.locales.find((locale) => locale.locale === activeLocale) ?? null
      : null;
  const localeEntries = useMemo(
    () => Object.entries(localeDraft).sort(([left], [right]) => left.localeCompare(right)),
    [localeDraft]
  );
  const sceneLabel = selectedScene
    ? `${selectedScene.size.width} x ${selectedScene.size.height}`
    : "No scene";
  const localeLabel = project?.manifest.defaultLocale ?? "n/a";

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
    startTransition(() => {
      setProject(snapshot);
      setActiveSceneId(snapshot.activeSceneId);
      setActiveHotspotId(snapshot.activeHotspotId);
      setActiveLocale(null);
      setHotspotDraft(createHotspotDraft(snapshot.selectedHotspot));
      setSceneDraft(createSceneDraft(snapshot.selectedScene));
      setLocaleDraft(snapshot.selectedLocale?.strings ?? {});
      setNewLocaleKey("");
      setNewLocaleValue("");
    });
    setStatus(`Loaded ${snapshot.manifest.title}`);
  };

  const selectScene = (sceneId: string) => {
    const scene = scenes.find((entry) => entry.id === sceneId) ?? null;
    startTransition(() => {
      setActiveSceneId(sceneId);
      setActiveHotspotId(null);
      setActiveLocale(null);
      setSceneDraft(createSceneDraft(scene));
      setHotspotDraft(createHotspotDraft(null));
    });
  };

  const selectHotspot = (hotspot: Hotspot) => {
    startTransition(() => {
      setActiveHotspotId(hotspot.id);
      setActiveLocale(null);
      setHotspotDraft(createHotspotDraft(hotspot));
    });
  };

  const selectLocale = (locale: LocaleDocument) => {
    startTransition(() => {
      setActiveLocale(locale.locale);
      setActiveHotspotId(null);
      setLocaleDraft(locale.strings);
      setNewLocaleKey("");
      setNewLocaleValue("");
    });
  };

  const updateHotspotDraft = (field: keyof HotspotDraft, value: string) => {
    setHotspotDraft((current) => ({ ...current, [field]: value }));
  };

  const updateSceneDraft = (field: keyof SceneDraft, value: string) => {
    setSceneDraft((current) => ({ ...current, [field]: value }));
  };

  const updateLocaleValue = (key: string, value: string) => {
    setLocaleDraft((current) => ({ ...current, [key]: value }));
  };

  const applyHotspotChanges = async () => {
    if (!selectedScene || !selectedHotspot) return;

    const x = parseNumber(hotspotDraft.x);
    const y = parseNumber(hotspotDraft.y);
    const width = parsePositiveNumber(hotspotDraft.width);
    const height = parsePositiveNumber(hotspotDraft.height);
    const labelKey = hotspotDraft.labelKey.trim();
    const actionFlowId = hotspotDraft.actionFlowId.trim();
    const cursor = hotspotDraft.cursor.trim();

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

      const refreshedScene =
        sceneItems(snapshot.scenes).find((scene) => scene.id === selectedScene.id) ??
        snapshot.selectedScene;
      const refreshedHotspot =
        refreshedScene?.hotspots.find((hotspot) => hotspot.id === selectedHotspot.id) ?? null;

      startTransition(() => {
        setProject(snapshot);
        setActiveSceneId(selectedScene.id);
        setActiveHotspotId(refreshedHotspot?.id ?? selectedHotspot.id);
        setActiveLocale(null);
        setHotspotDraft(createHotspotDraft(refreshedHotspot));
        setSceneDraft(createSceneDraft(refreshedScene ?? null));
      });
      setStatus(`Saved ${selectedHotspot.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save hotspot");
    }
  };

  const applySceneChanges = async () => {
    if (!selectedScene) return;

    const playerStartX = parseNumber(sceneDraft.playerStartX);
    const playerStartY = parseNumber(sceneDraft.playerStartY);
    const walkAreaX = parseNumber(sceneDraft.walkAreaX);
    const walkAreaY = parseNumber(sceneDraft.walkAreaY);
    const walkAreaWidth = parsePositiveNumber(sceneDraft.walkAreaWidth);
    const walkAreaHeight = parsePositiveNumber(sceneDraft.walkAreaHeight);
    const name = sceneDraft.name.trim();
    const background = sceneDraft.background.trim();

    if (!name) {
      setStatus("Scene name is required");
      return;
    }
    if (!hexColorPattern.test(background)) {
      setStatus("Background must be a valid #RRGGBB color");
      return;
    }
    if (
      playerStartX === null ||
      playerStartY === null ||
      walkAreaX === null ||
      walkAreaY === null ||
      walkAreaWidth === null ||
      walkAreaHeight === null
    ) {
      setStatus("Scene coordinates must be valid numbers, with walk area size above zero");
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
          walkArea: {
            x: walkAreaX,
            y: walkAreaY,
            width: walkAreaWidth,
            height: walkAreaHeight
          }
        },
        sceneId: selectedScene.id
      });

      const refreshedScene =
        sceneItems(snapshot.scenes).find((scene) => scene.id === selectedScene.id) ?? null;

      startTransition(() => {
        setProject(snapshot);
        setActiveSceneId(selectedScene.id);
        setActiveHotspotId(null);
        setActiveLocale(null);
        setSceneDraft(createSceneDraft(refreshedScene));
      });
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

      const refreshedLocale =
        snapshot.locales.find((locale) => locale.locale === selectedLocale.locale) ?? null;

      startTransition(() => {
        setProject(snapshot);
        setActiveLocale(selectedLocale.locale);
        setActiveHotspotId(null);
        setLocaleDraft(refreshedLocale?.strings ?? {});
        if (normalizedKey === newLocaleKey.trim()) {
          setNewLocaleKey("");
          setNewLocaleValue("");
        }
      });
      setStatus(`Saved ${normalizedKey}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save locale string");
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
                className={`tree-item ${activeLocale === null && selectedScene?.id === scene.id ? "selected" : ""}`}
                key={scene.id}
                type="button"
                onClick={() => selectScene(scene.id)}
              >
                <span className="scene-dot" /> {scene.name}
              </button>
            ))}
            <div className="tree-group">Flows ({project?.flowCount ?? 0})</div>
            {project?.manifest.flows.map((flow) => (
              <div className="tree-item tree-meta" key={flow.id}>
                {flow.id}
              </div>
            ))}
            <div className="tree-group open">Locales ({project?.localeCount ?? 0})</div>
            {project?.locales.map((locale) => (
              <button
                className={`tree-item ${activeLocale === locale.locale ? "selected" : ""}`}
                key={locale.locale}
                type="button"
                onClick={() => selectLocale(locale)}
              >
                <span className="scene-dot muted" /> {locale.locale}
              </button>
            ))}
          </div>
          <div className="project-health">
            <span className="health-light" />
            <div>
              <strong>{status}</strong>
              <small>Schema v1 - {localeLabel}</small>
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
                <div
                  className="walk-region"
                  style={{
                    height: `${(selectedScene.walkArea.height / selectedScene.size.height) * 100}%`,
                    left: `${(selectedScene.walkArea.x / selectedScene.size.width) * 100}%`,
                    top: `${(selectedScene.walkArea.y / selectedScene.size.height) * 100}%`,
                    width: `${(selectedScene.walkArea.width / selectedScene.size.width) * 100}%`
                  }}
                >
                  walk-area
                </div>
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
              {selectedLocale ? "Locale" : selectedHotspot ? "Hotspot" : selectedScene ? "Scene" : ""}
            </small>
          </div>
          <div className="inspector-content">
            {selectedLocale ? (
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
                      <button type="button" onClick={() => applyLocaleUpsert(key, localeDraft[key] ?? "")}>
                        Save string
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flow-link">
                  <span>Add string</span>
                  <input
                    placeholder="key.path"
                    value={newLocaleKey}
                    onChange={(event) => setNewLocaleKey(event.target.value)}
                  />
                  <textarea
                    placeholder="Localized text"
                    value={newLocaleValue}
                    onChange={(event) => setNewLocaleValue(event.target.value)}
                  />
                  <button type="button" onClick={() => applyLocaleUpsert(newLocaleKey, newLocaleValue)}>
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
                    value={hotspotDraft.labelKey}
                    onChange={(event) => updateHotspotDraft("labelKey", event.target.value)}
                  />
                </label>
                <div className="field-group">
                  <span>Bounds</span>
                  <div className="four-fields">
                    <input
                      aria-label="X"
                      value={hotspotDraft.x}
                      onChange={(event) => updateHotspotDraft("x", event.target.value)}
                    />
                    <input
                      aria-label="Y"
                      value={hotspotDraft.y}
                      onChange={(event) => updateHotspotDraft("y", event.target.value)}
                    />
                    <input
                      aria-label="Width"
                      value={hotspotDraft.width}
                      onChange={(event) => updateHotspotDraft("width", event.target.value)}
                    />
                    <input
                      aria-label="Height"
                      value={hotspotDraft.height}
                      onChange={(event) => updateHotspotDraft("height", event.target.value)}
                    />
                  </div>
                </div>
                <label>
                  Cursor
                  <select
                    value={hotspotDraft.cursor}
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
                    value={hotspotDraft.actionFlowId}
                    onChange={(event) => updateHotspotDraft("actionFlowId", event.target.value)}
                  />
                </label>
                <div className="flow-link">
                  <span>On activate</span>
                  <strong>{hotspotDraft.actionFlowId || "missing"}</strong>
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
                    value={sceneDraft.name}
                    onChange={(event) => updateSceneDraft("name", event.target.value)}
                  />
                </label>
                <label>
                  Background
                  <input
                    value={sceneDraft.background}
                    onChange={(event) => updateSceneDraft("background", event.target.value)}
                  />
                </label>
                <div className="field-group">
                  <span>Player start</span>
                  <div className="four-fields">
                    <input
                      aria-label="Player start X"
                      value={sceneDraft.playerStartX}
                      onChange={(event) => updateSceneDraft("playerStartX", event.target.value)}
                    />
                    <input
                      aria-label="Player start Y"
                      value={sceneDraft.playerStartY}
                      onChange={(event) => updateSceneDraft("playerStartY", event.target.value)}
                    />
                  </div>
                </div>
                <div className="field-group">
                  <span>Walk area</span>
                  <div className="four-fields">
                    <input
                      aria-label="Walk area X"
                      value={sceneDraft.walkAreaX}
                      onChange={(event) => updateSceneDraft("walkAreaX", event.target.value)}
                    />
                    <input
                      aria-label="Walk area Y"
                      value={sceneDraft.walkAreaY}
                      onChange={(event) => updateSceneDraft("walkAreaY", event.target.value)}
                    />
                    <input
                      aria-label="Walk area width"
                      value={sceneDraft.walkAreaWidth}
                      onChange={(event) => updateSceneDraft("walkAreaWidth", event.target.value)}
                    />
                    <input
                      aria-label="Walk area height"
                      value={sceneDraft.walkAreaHeight}
                      onChange={(event) => updateSceneDraft("walkAreaHeight", event.target.value)}
                    />
                  </div>
                </div>
                <div className="flow-link">
                  <span>Layered 2D scene</span>
                  <strong>{selectedScene.name}</strong>
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
