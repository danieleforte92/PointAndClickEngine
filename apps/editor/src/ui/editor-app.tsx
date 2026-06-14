import type { Hotspot, Layered2DScene, SceneDocument } from "@pointclick/contracts";
import { startTransition, useEffect, useState } from "react";
import type { EditorProjectSnapshot } from "../preload";

type Workspace = "scene" | "narrative" | "assets" | "build";

const workspaces: { id: Workspace; label: string }[] = [
  { id: "scene", label: "Scene" },
  { id: "narrative", label: "Narrative" },
  { id: "assets", label: "Asset Studio" },
  { id: "build", label: "Build" }
];

function sceneItems(scenes: SceneDocument[]) {
  return scenes.filter((scene): scene is Layered2DScene => scene.type === "layered-2d");
}

function firstHotspot(scene: Layered2DScene | null): Hotspot | null {
  return scene?.hotspots[0] ?? null;
}

export function EditorApp() {
  const [workspace, setWorkspace] = useState<Workspace>("scene");
  const [status, setStatus] = useState("Loading project...");
  const [project, setProject] = useState<EditorProjectSnapshot | null>(null);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);

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
    selectedScene?.hotspots.find((hotspot) => hotspot.id === activeHotspotId) ??
    firstHotspot(selectedScene);
  const sceneLabel = selectedScene ? `${selectedScene.size.width} x ${selectedScene.size.height}` : "No scene";
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
    });
    setStatus(`Loaded ${snapshot.manifest.title}`);
  };

  const selectScene = (sceneId: string) => {
    const scene = scenes.find((entry) => entry.id === sceneId) ?? null;
    startTransition(() => {
      setActiveSceneId(sceneId);
      setActiveHotspotId(firstHotspot(scene)?.id ?? null);
    });
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
                className={`tree-item ${selectedScene?.id === scene.id ? "selected" : ""}`}
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
            <div className="tree-group">Locales ({project?.localeCount ?? 0})</div>
            {project?.manifest.locales.map((locale) => (
              <div className="tree-item tree-meta" key={locale.locale}>
                {locale.locale}
              </div>
            ))}
          </div>
          <div className="project-health">
            <span className="health-light" />
            <div>
              <strong>{status}</strong>
              <small>Schema v1 · {localeLabel}</small>
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
              {selectedScene ? `Layered 2D · ${sceneLabel} · ${selectedScene.hotspots.length} hotspot(s)` : "No scene loaded"}
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
                    onClick={() => setActiveHotspotId(hotspot.id)}
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
            <small>{selectedHotspot ? "Hotspot" : "Scene"}</small>
          </div>
          <div className="inspector-content">
            {selectedHotspot ? (
              <>
                <label>
                  Name
                  <input value={selectedHotspot.id} readOnly />
                </label>
                <label>
                  Display label
                  <input value={selectedHotspot.labelKey} readOnly />
                </label>
                <div className="field-group">
                  <span>Bounds</span>
                  <div className="four-fields">
                    <input aria-label="X" value={selectedHotspot.bounds.x} readOnly />
                    <input aria-label="Y" value={selectedHotspot.bounds.y} readOnly />
                    <input aria-label="Width" value={selectedHotspot.bounds.width} readOnly />
                    <input aria-label="Height" value={selectedHotspot.bounds.height} readOnly />
                  </div>
                </div>
                <label>
                  Cursor
                  <input value={selectedHotspot.cursor ?? "default"} readOnly />
                </label>
                <div className="flow-link">
                  <span>On activate</span>
                  <strong>{selectedHotspot.actionFlowId}</strong>
                  <button type="button">Open flow →</button>
                </div>
              </>
            ) : selectedScene ? (
              <>
                <label>
                  Scene
                  <input value={selectedScene.name} readOnly />
                </label>
                <label>
                  Identifier
                  <input value={selectedScene.id} readOnly />
                </label>
                <label>
                  Background
                  <input value={selectedScene.background} readOnly />
                </label>
                <div className="flow-link">
                  <span>Hotspots</span>
                  <strong>{selectedScene.hotspots.length}</strong>
                  <button type="button">Select one in the viewport</button>
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
