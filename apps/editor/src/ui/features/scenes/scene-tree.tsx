import type { Hotspot, Layered2DScene, SceneActor, SceneGenerationGuide, ScenePickup } from "@pointclick/contracts";
import { useMemo, useState } from "react";
import {
  createActorKey,
  createHotspotKey,
  createPickupKey,
  type EditorSessionState,
  type SceneDraft,
  type SceneSelectionTool,
  type Workspace
} from "../../../editor-session";
export interface SceneTreeDirtyState {
  actorKeys: ReadonlySet<string>;
  hotspotKeys: ReadonlySet<string>;
  pickupKeys: ReadonlySet<string>;
  sceneIds: ReadonlySet<string>;
}

export interface SceneTreeProps {
  activeSceneTool: SceneSelectionTool;
  assetPreviewUrls: Readonly<Record<string, string>>;
  createActor: () => void | Promise<void>;
  createBlankGenerationGuide: (shapeType: "rect" | "ellipse" | "polygon") => void;
  createHotspot: () => void | Promise<void>;
  createPickup: () => void | Promise<void>;
  createScene: () => void | Promise<void>;
  createSceneLayer: () => void;
  currentGenerationGuides: SceneGenerationGuide[];
  currentSceneDraft: SceneDraft;
  dirtyState: SceneTreeDirtyState;
  generationGuideColor: (guide: SceneGenerationGuide) => string;
  isPlayerInspectorSelected: boolean;
  previewSceneBackground: string;
  onSelectActor: (actor: SceneActor) => void;
  onSelectHotspot: (hotspot: Hotspot) => void;
  onSelectPickup: (pickup: ScenePickup) => void;
  onSelectScene: (sceneId: string) => void;
  onSelectPlayerInScene: () => void;
  onSetActiveSceneTool: (tool: SceneSelectionTool) => void;
  onSetSceneInspectorTarget: (target: "scene" | "player") => void;
  onSetSelectedGenerationGuideId: (guideId: string | null) => void;
  onSetSelectedSceneLayerId: (layerId: string | null) => void;
  onSetWorkspace: (workspace: Workspace) => void;
  onUpdateSessionSelection: (updater: (current: EditorSessionState) => EditorSessionState) => void;
  projectAvailable: boolean;
  scenes: Layered2DScene[];
  selectedGenerationGuide: SceneGenerationGuide | null;
  selectedGenerationGuideId: string | null;
  selectedScene: Layered2DScene | null;
  selectedSceneLayerId: string | null;
  session: EditorSessionState;
}

export function SceneTree({
  activeSceneTool,
  assetPreviewUrls,
  createActor,
  createBlankGenerationGuide,
  createHotspot,
  createPickup,
  createScene,
  createSceneLayer,
  currentGenerationGuides,
  currentSceneDraft,
  dirtyState,
  generationGuideColor,
  isPlayerInspectorSelected,
  previewSceneBackground,
  onSelectActor: selectActor,
  onSelectHotspot: selectHotspot,
  onSelectPickup: selectPickup,
  onSelectScene: selectScene,
  onSelectPlayerInScene: selectPlayerInScene,
  onSetActiveSceneTool: setActiveSceneTool,
  onSetSceneInspectorTarget: setSceneInspectorTarget,
  onSetSelectedGenerationGuideId: setSelectedGenerationGuideId,
  onSetSelectedSceneLayerId: setSelectedSceneLayerId,
  onSetWorkspace: setWorkspace,
  onUpdateSessionSelection: updateSessionSelection,
  projectAvailable,
  scenes,
  selectedGenerationGuide,
  selectedGenerationGuideId,
  selectedScene,
  selectedSceneLayerId,
  session
}: SceneTreeProps) {
  const [sceneQuery, setSceneQuery] = useState("");
  const filteredScenes = useMemo(() => {
    const query = sceneQuery.trim().toLocaleLowerCase();
    if (!query) return scenes;
    return scenes.filter((scene) => `${scene.name} ${scene.id}`.toLocaleLowerCase().includes(query));
  }, [sceneQuery, scenes]);

  if (!projectAvailable) {
    return <div className="tree-item tree-meta">No project loaded</div>;
  }

  return (
    <>
          <div className="scene-navigator-heading">
            <div>
              <span className="tree-section-label">Scene navigator</span>
              <small>{scenes.length} scene(s)</small>
            </div>
            <button type="button" onClick={createScene}>+ Add scene</button>
          </div>
          <label className="scene-navigator-search">
            <span>Search scenes</span>
            <input
              aria-label="Search scenes"
              placeholder="Name or id"
              type="search"
              value={sceneQuery}
              onChange={(event) => setSceneQuery(event.target.value)}
            />
          </label>
          <div className="scene-navigator-list" aria-label="Scenes">
            {filteredScenes.map((scene) => (
              <button
                className={`scene-navigator-card ${selectedScene?.id === scene.id ? "active" : ""}`}
                key={`scene-navigator-${scene.id}`}
                type="button"
                onClick={() => selectScene(scene.id)}
              >
                <span
                  className="scene-navigator-thumb"
                  style={scene.background && assetPreviewUrls[scene.background] ? { backgroundImage: `url("${assetPreviewUrls[scene.background]}")` } : undefined}
                  aria-hidden="true"
                />
                <span>
                  <strong>{scene.name}</strong>
                  <small>{scene.id}{dirtyState.sceneIds.has(scene.id) ? " · dirty" : ""}</small>
                </span>
                {selectedScene?.id === scene.id ? <span aria-hidden="true" className="scene-navigator-state">●</span> : null}
              </button>
            ))}
            {filteredScenes.length === 0 ? <span className="tree-item tree-meta">No matching scenes</span> : null}
          </div>
          <div className="tree-section-label">Scenes</div>
          <div className="scene-compact-selector">
            <div
              className="scene-compact-thumbnail"
              style={previewSceneBackground && assetPreviewUrls[previewSceneBackground]
                ? { backgroundImage: `url("${assetPreviewUrls[previewSceneBackground]}")` }
                : undefined}
              aria-hidden="true"
            />
            <label>
              <span>Active scene</span>
              <select aria-label="Active scene" value={selectedScene?.id ?? ""} onChange={(event) => selectScene(event.target.value)}>
                {scenes.map((scene) => <option key={`scene-selector-${scene.id}`} value={scene.id}>{scene.name}</option>)}
              </select>
            </label>
          </div>
          <button className="tree-item tree-child" type="button" onClick={createScene}>
            <span className="scene-dot muted" /> + New scene
          </button>
          <div className="tree-group open">Scene hierarchy</div>
          {scenes.filter((scene) => scene.id === selectedScene?.id).map((scene) => {
            const isActiveScene = selectedScene?.id === scene.id;
            const isSceneRootSelected =
              session.activeLocale === null &&
              session.activeFlowId === null &&
              !session.activeActorId &&
              !session.activeHotspotId &&
              !session.activePickupId &&
              !session.activeItemId &&
              isActiveScene &&
              !isPlayerInspectorSelected &&
              !selectedSceneLayerId &&
              !selectedGenerationGuideId &&
              activeSceneTool === "select";

            return (
              <div className={`scene-tree-branch ${isActiveScene ? "open" : ""}`} key={scene.id}>
                <button
                  className={`tree-item scene-tree-root ${isSceneRootSelected ? "selected" : ""}`}
                  type="button"
                  onClick={() => selectScene(scene.id)}
                >
                  <span className="scene-dot" /> {scene.name}
                  {dirtyState.sceneIds.has(scene.id) ? <span className="dirty-mark">*</span> : null}
                </button>
                {isActiveScene && selectedScene ? (
                  <div className="scene-tree-children">
                    <button
                      className={`tree-item tree-child ${isSceneRootSelected ? "selected" : ""}`}
                      type="button"
                      onClick={() => selectScene(scene.id)}
                    >
                      <span className="scene-dot muted" /> Background
                    </button>
                    <div className="tree-group open">Layers ({currentSceneDraft.layers.length})</div>
                    <button className="tree-item tree-child" type="button" onClick={createSceneLayer}>
                      <span className="scene-dot muted" /> + New layer
                    </button>
                    {currentSceneDraft.layers.map((layer) => (
                      <button
                        className={`tree-item tree-child ${selectedSceneLayerId === layer.id ? "selected" : ""}`}
                        key={`scene-layer-tree-${layer.id}`}
                        type="button"
                        onClick={() => {
                          setWorkspace("scene");
                          setActiveSceneTool("select");
                          setSceneInspectorTarget("scene");
                          setSelectedSceneLayerId(layer.id);
                          setSelectedGenerationGuideId(null);
                          updateSessionSelection((current) => ({
                            ...current,
                            activeActorId: null,
                            activeFlowId: null,
                            activeHotspotId: null,
                            activeItemId: null,
                            activeLocale: null,
                            activePickupId: null,
                            activeSceneId: selectedScene.id
                          }));
                        }}
                      >
                        <span className="scene-dot muted" /> {layer.name || layer.id}
                        {dirtyState.sceneIds.has(selectedScene.id) ? <span className="dirty-mark">*</span> : null}
                      </button>
                    ))}
                    <button
                      className={`tree-item tree-child ${activeSceneTool === "walk-area" ? "selected" : ""}`}
                      type="button"
                      onClick={() => {
                        selectScene(scene.id);
                        setActiveSceneTool("walk-area");
                      }}
                    >
                      <span className="scene-dot muted" /> Walk area
                    </button>
                    <button
                      className={`tree-item tree-child ${isPlayerInspectorSelected ? "selected" : ""}`}
                      type="button"
                      onClick={selectPlayerInScene}
                    >
                      <span className="scene-dot muted" /> Player start
                      {dirtyState.sceneIds.has(selectedScene.id) ? <span className="dirty-mark">*</span> : null}
                    </button>
                    <div className="tree-group open">Actors ({selectedScene.actors.length})</div>
                    <button className="tree-item tree-child" type="button" onClick={createActor}>
                      <span className="scene-dot muted" /> + New actor
                    </button>
                    {selectedScene.actors.map((actor) => (
                      <button
                        className={`tree-item tree-child ${session.activeActorId === actor.id ? "selected" : ""}`}
                        key={actor.id}
                        type="button"
                        onClick={() => selectActor(actor)}
                      >
                        <span className="scene-dot muted" /> {actor.id}
                        {dirtyState.actorKeys.has(createActorKey(selectedScene.id, actor.id)) ? (
                          <span className="dirty-mark">*</span>
                        ) : null}
                      </button>
                    ))}
                    <div className="tree-group open">Pickups ({selectedScene.pickups.length})</div>
                    <button className="tree-item tree-child" type="button" onClick={createPickup}>
                      <span className="scene-dot muted" /> + New pickup
                    </button>
                    {selectedScene.pickups.map((pickup) => (
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
                    <div className="tree-group open">Hotspots ({selectedScene.hotspots.length})</div>
                    <button className="tree-item tree-child" type="button" onClick={createHotspot}>
                      <span className="scene-dot muted" /> + New hotspot
                    </button>
                    {selectedScene.hotspots.map((hotspot) => (
                      <button
                        className={`tree-item tree-child ${session.activeHotspotId === hotspot.id ? "selected" : ""}`}
                        key={hotspot.id}
                        type="button"
                        onClick={() => selectHotspot(hotspot)}
                      >
                        <span className="scene-dot muted" /> {hotspot.id}
                        {dirtyState.hotspotKeys.has(createHotspotKey(selectedScene.id, hotspot.id)) ? (
                          <span className="dirty-mark">*</span>
                        ) : null}
                      </button>
                    ))}
                    <div className="tree-group open">Guides / AI masks ({currentGenerationGuides.length})</div>
                    <button
                      className="tree-item tree-child"
                      type="button"
                      onClick={() => createBlankGenerationGuide("rect")}
                    >
                      <span className="scene-dot muted" /> + New guide
                    </button>
                    {currentGenerationGuides.map((guide) => (
                      <button
                        className={`tree-item tree-child ${selectedGenerationGuide?.id === guide.id ? "selected" : ""}`}
                        key={`scene-guide-tree-${guide.id}`}
                        type="button"
                        onClick={() => {
                          setWorkspace("scene");
                          setActiveSceneTool("select");
                          setSceneInspectorTarget("scene");
                          setSelectedGenerationGuideId(guide.id);
                          setSelectedSceneLayerId(null);
                          updateSessionSelection((current) => ({
                            ...current,
                            activeActorId: null,
                            activeFlowId: null,
                            activeHotspotId: null,
                            activeItemId: null,
                            activeLocale: null,
                            activePickupId: null,
                            activeSceneId: selectedScene.id
                          }));
                        }}
                      >
                        <span
                          className="scene-dot muted"
                          style={{ backgroundColor: generationGuideColor(guide) }}
                        />{" "}
                        {guide.name || guide.id}
                        {dirtyState.sceneIds.has(selectedScene.id) ? <span className="dirty-mark">*</span> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
          {selectedScene ? null : (
            <div className="tree-item tree-meta">Select a scene to show player and scene entities.</div>
          )}
    </>
  );
}
