import type {
  AssetDocument,
  Hotspot,
  Layered2DScene,
  Rect,
  SceneActor,
  SceneGenerationGuide,
  SceneGenerationGuideShape,
  ScenePickup
} from "@pointclick/contracts";
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from "react";
import type { ImageGenerationSceneContext } from "../../shared/editor-feature-handoff";
import type { SceneDraft, SceneSelectionTool, Workspace } from "../../../editor-session";

export interface SceneViewPreferences {
  gridVisible: boolean;
  minimapVisible: boolean;
  overlaysVisible: boolean;
  zoom: number;
}

export interface ScenePreviewLayer {
  assetId: string;
  assetUrl?: string | undefined;
  bounds?: Rect;
  depth: number;
  id: string;
  opacity?: number;
  visible?: boolean;
}

export interface SceneViewportIssue {
  detail: string;
  hasIssues: boolean;
  issueCount: number;
  tone: string;
}

export interface SceneViewportProps {
  activeImageGenerationContext: ImageGenerationSceneContext | null;
  activeSceneTool: SceneSelectionTool;
  assetPathById: ReadonlyMap<string, string>;
  assetPreviewUrls: Readonly<Record<string, string>>;
  boundsForGenerationGuideShape: (shape: SceneGenerationGuideShape) => Rect;
  canEditViewportScene: boolean;
  currentGenerationGuides: SceneGenerationGuide[];
  generationGuideColor: (guide: SceneGenerationGuide) => string;
  imageAssets: AssetDocument[];
  insertGenerationGuidePointFromEvent: (
    guide: SceneGenerationGuide,
    afterIndex: number,
    event: ReactPointerEvent
  ) => void;
  insertWalkAreaPointFromEvent: (afterIndex: number, event: ReactPointerEvent) => void;
  onCreateActor: () => void | Promise<void>;
  onCreateHotspot: () => void | Promise<void>;
  onCreateSceneLayer: () => void;
  onSelectActor: (actor: SceneActor) => void;
  onSelectHotspot: (hotspot: Hotspot) => void;
  onSelectPickup: (pickup: ScenePickup) => void;
  onSelectPlayerInScene: () => void;
  onSetActiveSceneTool: (tool: SceneSelectionTool) => void;
  onSetSceneInspectorTarget: (target: "scene" | "player") => void;
  onSetSelectedGenerationGuideId: (guideId: string | null) => void;
  onStartActorInteraction: (mode: "move" | "resize", actor: SceneActor, event: ReactPointerEvent) => void;
  onStartActorSpotInteraction: (spot: "interact" | "look", point: { x: number; y: number }, event: ReactPointerEvent) => void;
  onStartGenerationGuidePointInteraction: (
    guide: SceneGenerationGuide,
    pointIndex: number,
    point: { x: number; y: number },
    event: ReactPointerEvent
  ) => void;
  onStartGenerationGuideShapeInteraction: (
    guide: SceneGenerationGuide,
    mode: "move" | "resize",
    event: ReactPointerEvent
  ) => void;
  onStartHotspotInteraction: (mode: "move" | "resize", hotspot: Hotspot, event: ReactPointerEvent) => void;
  onStartHotspotSpotInteraction: (spot: "interact" | "look", point: { x: number; y: number }, event: ReactPointerEvent) => void;
  onStartPickupInteraction: (mode: "move" | "resize", pickup: ScenePickup, event: ReactPointerEvent) => void;
  onStartPlayerStartInteraction: (event: ReactPointerEvent) => void;
  onStartWalkAreaPointInteraction: (pointIndex: number, point: { x: number; y: number }, event: ReactPointerEvent) => void;
  previewActorIssueMap: Readonly<Record<string, SceneViewportIssue>>;
  previewActors: SceneActor[];
  previewHotspotIssueMap: Readonly<Record<string, SceneViewportIssue>>;
  previewHotspots: Hotspot[];
  previewPickups: ScenePickup[];
  previewPickupIssueMap: Readonly<Record<string, SceneViewportIssue>>;
  previewPlayerAssetUrl?: string | undefined;
  previewPlayerStart: Layered2DScene["playerStart"] | null;
  previewSceneBackground: string;
  previewSceneColor: string;
  previewSceneBackgroundUrl?: string | undefined;
  previewSceneLayers: ScenePreviewLayer[];
  previewSceneSize: { height: number; width: number };
  previewSelectedActor: SceneActor | null;
  previewSelectedHotspot: Hotspot | null;
  previewWalkArea: Layered2DScene["walkArea"] | null;
  previewWalkAreaPoints: string;
  sceneBackgroundStyle: CSSProperties;
  sceneViewPreferences: SceneViewPreferences;
  isPlayerInspectorSelected: boolean;
  selectedActor: SceneActor | null;
  selectedGenerationGuide: SceneGenerationGuide | null;
  selectedHotspot: Hotspot | null;
  selectedPickup: ScenePickup | null;
  selectedScene: Layered2DScene | null;
  selectedSceneLayerId: string | null;
  selectedSceneToolHint: string;
  selectedSceneToolLabel: string;
  viewportRef: RefObject<HTMLDivElement | null>;
  workspace: Workspace;
  updateSceneDraft: (field: keyof SceneDraft, value: string) => void;
}

export function SceneViewport({
  activeImageGenerationContext,
  activeSceneTool,
  assetPathById,
  assetPreviewUrls,
  boundsForGenerationGuideShape,
  canEditViewportScene,
  currentGenerationGuides,
  generationGuideColor,
  imageAssets,
  insertGenerationGuidePointFromEvent,
  insertWalkAreaPointFromEvent,
  onCreateActor: createActor,
  onCreateHotspot: createHotspot,
  onCreateSceneLayer: createSceneLayer,
  onSelectActor: selectActor,
  onSelectHotspot: selectHotspot,
  onSelectPickup: selectPickup,
  onSelectPlayerInScene: selectPlayerInScene,
  onSetActiveSceneTool: setActiveSceneTool,
  onSetSceneInspectorTarget: setSceneInspectorTarget,
  onSetSelectedGenerationGuideId: setSelectedGenerationGuideId,
  onStartActorInteraction: startActorInteraction,
  onStartActorSpotInteraction: startActorSpotInteraction,
  onStartGenerationGuidePointInteraction: startGenerationGuidePointInteraction,
  onStartGenerationGuideShapeInteraction: startGenerationGuideShapeInteraction,
  onStartHotspotInteraction: startHotspotInteraction,
  onStartHotspotSpotInteraction: startHotspotSpotInteraction,
  onStartPickupInteraction: startPickupInteraction,
  onStartPlayerStartInteraction: startPlayerStartInteraction,
  onStartWalkAreaPointInteraction: startWalkAreaPointInteraction,
  previewActorIssueMap,
  previewActors,
  previewHotspotIssueMap,
  previewHotspots,
  previewPickups,
  previewPickupIssueMap,
  previewPlayerAssetUrl,
  previewPlayerStart,
  previewSceneBackground,
  previewSceneColor,
  previewSceneBackgroundUrl,
  previewSceneLayers,
  previewSceneSize,
  previewSelectedActor,
  previewSelectedHotspot,
  previewWalkArea,
  previewWalkAreaPoints,
  sceneBackgroundStyle,
  sceneViewPreferences,
  isPlayerInspectorSelected,
  selectedActor,
  selectedGenerationGuide,
  selectedHotspot,
  selectedPickup,
  selectedScene,
  selectedSceneLayerId,
  selectedSceneToolHint,
  selectedSceneToolLabel,
  viewportRef,
  workspace,
  updateSceneDraft
}: SceneViewportProps) {
  return (
            <div
              className={`scene-viewport ${
                selectedScene &&
                activeImageGenerationContext?.entityKind === "scene-background" &&
                activeImageGenerationContext.sceneId === selectedScene.id
                  ? "is-generating-background"
                  : ""
              } ${sceneViewPreferences.gridVisible ? "show-authoring-grid" : ""} ${sceneViewPreferences.overlaysVisible ? "" : "hide-editor-overlays"}`}
              ref={viewportRef}
              style={
                selectedScene
                  ? {
                      ...sceneBackgroundStyle,
                      aspectRatio: `${previewSceneSize.width} / ${previewSceneSize.height}`,
                      zoom: sceneViewPreferences.zoom
                    }
                  : { background: "#24384a" }
              }
            >
              {selectedScene &&
              activeImageGenerationContext?.entityKind === "scene-background" &&
              activeImageGenerationContext.sceneId === selectedScene.id ? (
                <div className="viewport-generation-banner">
                  <span className="viewport-generation-spinner" aria-hidden="true" />
                  <strong>Generating background</strong>
                </div>
              ) : null}
              {selectedScene && workspace === "scene" ? (
                <div className="viewport-instruction">
                  <strong>{selectedSceneToolLabel}</strong>
                  <span>{selectedSceneToolHint}</span>
                </div>
              ) : null}
              {selectedScene && workspace === "scene" ? (
                <div className="viewport-quick-actions">
                  <label className="viewport-color-control" title="Set color background draft">
                    <span>BG</span>
                    <input
                      aria-label="Scene background color"
                      type="color"
                      value={previewSceneColor}
                      onChange={(event) => updateSceneDraft("background", event.target.value)}
                    />
                  </label>
                  <select
                    aria-label="Scene background asset"
                    value={imageAssets.some((asset) => asset.path === previewSceneBackground) ? previewSceneBackground : ""}
                    onChange={(event) => {
                      if (event.target.value) {
                        updateSceneDraft("background", event.target.value);
                      }
                    }}
                  >
                    <option value="">Image background</option>
                    {imageAssets.map((asset) => (
                      <option key={`viewport-bg-${asset.id}`} value={asset.path}>
                        {asset.id}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setActiveSceneTool("walk-area")}>
                    Walk
                  </button>
                  <button type="button" onClick={createHotspot}>
                    + Hotspot
                  </button>
                  <button type="button" onClick={createActor}>
                    + Actor
                  </button>
                  <button type="button" onClick={createSceneLayer}>
                    + Layer
                  </button>
                </div>
              ) : null}
              {selectedScene && workspace === "scene" && sceneViewPreferences.minimapVisible ? (
                <div className="scene-minimap" aria-label="Scene minimap" role="img">
                  <span
                    className="scene-minimap-point player"
                    style={{
                      left: `${((previewPlayerStart ?? selectedScene.playerStart).x / previewSceneSize.width) * 100}%`,
                      top: `${((previewPlayerStart ?? selectedScene.playerStart).y / previewSceneSize.height) * 100}%`
                    }}
                  />
                  {previewActors.map((actor) => (
                    <span className="scene-minimap-point actor" key={`minimap-actor-${actor.id}`} style={{ left: `${((actor.bounds.x + actor.bounds.width / 2) / previewSceneSize.width) * 100}%`, top: `${((actor.bounds.y + actor.bounds.height / 2) / previewSceneSize.height) * 100}%` }} />
                  ))}
                  {previewPickups.map((pickup) => (
                    <span className="scene-minimap-point pickup" key={`minimap-pickup-${pickup.id}`} style={{ left: `${((pickup.bounds.x + pickup.bounds.width / 2) / previewSceneSize.width) * 100}%`, top: `${((pickup.bounds.y + pickup.bounds.height / 2) / previewSceneSize.height) * 100}%` }} />
                  ))}
                  {previewHotspots.map((hotspot) => (
                    <span className="scene-minimap-point hotspot" key={`minimap-hotspot-${hotspot.id}`} style={{ left: `${((hotspot.bounds.x + hotspot.bounds.width / 2) / previewSceneSize.width) * 100}%`, top: `${((hotspot.bounds.y + hotspot.bounds.height / 2) / previewSceneSize.height) * 100}%` }} />
                  ))}
                </div>
              ) : null}
              {selectedScene ? (
              <>
                {previewSceneLayers.map((layer) =>
                  layer.visible !== false && layer.assetUrl && layer.bounds ? (
                    <div
                      className={`scene-layer-plane ${selectedSceneLayerId === layer.id ? "selected" : ""}`}
                      key={`scene-layer-preview-${layer.id}`}
                      style={{
                        backgroundImage: `url("${layer.assetUrl}")`,
                        height: `${(layer.bounds.height / previewSceneSize.height) * 100}%`,
                        left: `${(layer.bounds.x / previewSceneSize.width) * 100}%`,
                        opacity: layer.opacity ?? 1,
                        top: `${(layer.bounds.y / previewSceneSize.height) * 100}%`,
                        width: `${(layer.bounds.width / previewSceneSize.width) * 100}%`,
                        zIndex: layer.depth
                      }}
                    />
                  ) : null
                )}
                {selectedScene.shapes.map((shape) => (
                  <div
                    className={`scene-shape ${shape.shape}`}
                    key={shape.id}
                    style={{
                      background: shape.fill,
                      height: `${(shape.bounds.height / previewSceneSize.height) * 100}%`,
                      left: `${(shape.bounds.x / previewSceneSize.width) * 100}%`,
                      top: `${(shape.bounds.y / previewSceneSize.height) * 100}%`,
                      width: `${(shape.bounds.width / previewSceneSize.width) * 100}%`,
                      zIndex: shape.depth
                    }}
                  />
                ))}
                {currentGenerationGuides.length ? (
                  <svg
                    className="generation-guide-overlay"
                    viewBox={`0 0 ${previewSceneSize.width} ${previewSceneSize.height}`}
                    preserveAspectRatio="none"
                  >
                    {currentGenerationGuides
                      .filter((guide) => guide.visible !== false)
                      .map((guide) => {
                        const bounds = boundsForGenerationGuideShape(guide.shape);
                        const color = generationGuideColor(guide);
                        const selected = selectedGenerationGuide?.id === guide.id;
                        return (
                          <g
                            className={`generation-guide-mark ${selected ? "selected" : ""}`}
                            key={`generation-guide-${guide.id}`}
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              setSelectedGenerationGuideId(guide.id);
                              setSceneInspectorTarget("scene");
                            }}
                          >
                            {guide.shape.type === "polygon" ? (
                              <>
                                <polygon
                                  className="generation-guide-shape-hit"
                                  fill={color}
                                  points={guide.shape.points.map((point) => `${point.x},${point.y}`).join(" ")}
                                  stroke={color}
                                  onPointerDown={(event) => startGenerationGuideShapeInteraction(guide, "move", event)}
                                />
                                {selected
                                  ? guide.shape.points.map((point, index) => {
                                      const nextPoint = guide.shape.type === "polygon"
                                        ? guide.shape.points[(index + 1) % guide.shape.points.length]!
                                        : point;
                                      return (
                                        <line
                                          className="generation-guide-edge-hit"
                                          key={`generation-guide-edge-${guide.id}-${index}`}
                                          x1={point.x}
                                          x2={nextPoint.x}
                                          y1={point.y}
                                          y2={nextPoint.y}
                                          onPointerDown={(event) => insertGenerationGuidePointFromEvent(guide, index, event)}
                                        />
                                      );
                                    })
                                  : null}
                                {selected
                                  ? guide.shape.points.map((point, index) => (
                                      <g key={`generation-guide-point-${guide.id}-${index}`}>
                                        <circle
                                          className="generation-guide-point"
                                          cx={point.x}
                                          cy={point.y}
                                          r="7"
                                          onPointerDown={(event) =>
                                            startGenerationGuidePointInteraction(guide, index, point, event)
                                          }
                                        />
                                        <text className="generation-guide-point-label" x={point.x + 10} y={point.y - 10}>
                                          {index + 1}
                                        </text>
                                      </g>
                                    ))
                                  : null}
                              </>
                            ) : guide.shape.type === "ellipse" ? (
                              <ellipse
                                className="generation-guide-shape-hit"
                                cx={bounds.x + bounds.width / 2}
                                cy={bounds.y + bounds.height / 2}
                                fill={color}
                                rx={bounds.width / 2}
                                ry={bounds.height / 2}
                                stroke={color}
                                onPointerDown={(event) => startGenerationGuideShapeInteraction(guide, "move", event)}
                              />
                            ) : (
                              <rect
                                className="generation-guide-shape-hit"
                                fill={color}
                                height={bounds.height}
                                stroke={color}
                                width={bounds.width}
                                x={bounds.x}
                                y={bounds.y}
                                onPointerDown={(event) => startGenerationGuideShapeInteraction(guide, "move", event)}
                              />
                            )}
                            {selected && guide.shape.type !== "polygon" ? (
                              <rect
                                className="generation-guide-resize-handle"
                                height="14"
                                width="14"
                                x={bounds.x + bounds.width - 7}
                                y={bounds.y + bounds.height - 7}
                                onPointerDown={(event) => startGenerationGuideShapeInteraction(guide, "resize", event)}
                              />
                            ) : null}
                            <text x={bounds.x + 8} y={Math.max(18, bounds.y - 8)}>
                              {guide.name}
                            </text>
                          </g>
                        );
                      })}
                  </svg>
                ) : null}
                {previewWalkArea ? (
                  <svg
                    className="walk-region"
                    viewBox={`0 0 ${previewSceneSize.width} ${previewSceneSize.height}`}
                    preserveAspectRatio="none"
                  >
                    <polygon className="walk-region-fill" points={previewWalkAreaPoints} />
                    <polygon className="walk-region-outline" points={previewWalkAreaPoints} />
                    {canEditViewportScene
                      ? previewWalkArea.points.map((point, index) => {
                          const nextPoint =
                            previewWalkArea.points[(index + 1) % previewWalkArea.points.length]!;
                          return (
                            <line
                              className="walk-region-edge-hit"
                              key={`walk-edge-hit-${index}`}
                              x1={point.x}
                              x2={nextPoint.x}
                              y1={point.y}
                              y2={nextPoint.y}
                              onPointerDown={(event) => insertWalkAreaPointFromEvent(index, event)}
                            />
                          );
                        })
                      : null}
                    {previewWalkArea.points.map((point, index) => (
                      <g key={`walk-point-${index}`}>
                        <circle
                          className={`walk-region-point ${canEditViewportScene ? "editable" : ""}`}
                          cx={point.x}
                          cy={point.y}
                          r="7"
                          onPointerDown={(event) =>
                            startWalkAreaPointInteraction(index, point, event)
                          }
                        />
                        <text className="walk-region-label" x={point.x + 10} y={point.y - 10}>
                          {index + 1}
                        </text>
                      </g>
                    ))}
                  </svg>
                ) : null}
                {previewActors.map((actor) => (
                  (() => {
                    const actorIssues = previewActorIssueMap[actor.id];
                    const actorAssetPath = actor.assetId ? assetPathById.get(actor.assetId) : null;
                    const actorAssetUrl = actorAssetPath ? assetPreviewUrls[actorAssetPath] : undefined;
                    const actorIsGenerating =
                      activeImageGenerationContext?.entityKind === "actor" &&
                      activeImageGenerationContext.sceneId === selectedScene.id &&
                      activeImageGenerationContext.entityId === actor.id;
                    return (
                  <button
                    className={`actor-box ${selectedActor?.id === actor.id ? "selected" : ""} ${actorIssues?.hasIssues ? `has-issues ${actorIssues.tone}` : ""} ${actorIsGenerating ? "is-generating" : ""}`}
                    key={actor.id}
                    type="button"
                    onClick={() => selectActor(actor)}
                    onPointerDown={(event) => startActorInteraction("move", actor, event)}
                    style={{
                      height: `${(actor.bounds.height / previewSceneSize.height) * 100}%`,
                      left: `${(actor.bounds.x / previewSceneSize.width) * 100}%`,
                      top: `${(actor.bounds.y / previewSceneSize.height) * 100}%`,
                      width: `${(actor.bounds.width / previewSceneSize.width) * 100}%`,
                      backgroundImage: actorAssetUrl ? `url("${actorAssetUrl}")` : undefined,
                      backgroundPosition: actorAssetUrl ? "center" : undefined,
                      backgroundRepeat: actorAssetUrl ? "no-repeat" : undefined,
                      backgroundSize: actorAssetUrl ? "100% 100%" : undefined,
                      zIndex: actor.depth
                    }}
                    title={
                      actorIssues?.hasIssues
                        ? actorIssues.detail
                        : activeSceneTool === "actor"
                        ? "Click to inspect, drag to move"
                        : "Click to inspect, drag to select and move"
                    }
                  >
                    <span className="viewport-label">
                      actor: {actor.id}
                      {actorIssues?.hasIssues ? (
                        <span className={`viewport-issue-badge ${actorIssues.tone}`}>
                          {actorIssues.issueCount}
                        </span>
                      ) : null}
                    </span>
                    {actorIsGenerating ? (
                      <span className="viewport-generation-indicator">
                        <span className="viewport-generation-spinner" aria-hidden="true" />
                        Generating
                      </span>
                    ) : null}
                    {selectedActor?.id === actor.id ? (
                      <span
                        className="viewport-resize-handle"
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => startActorInteraction("resize", actor, event)}
                      />
                    ) : null}
                  </button>
                    );
                  })()
                ))}
                {previewSelectedActor?.interactSpot ? (
                  <button
                    className="viewport-spot actor-interact-spot"
                    type="button"
                    style={{
                      left: `${(previewSelectedActor.interactSpot.x / previewSceneSize.width) * 100}%`,
                      top: `${(previewSelectedActor.interactSpot.y / previewSceneSize.height) * 100}%`
                    }}
                    title="Actor interact spot"
                    onPointerDown={(event) =>
                      startActorSpotInteraction("interact", previewSelectedActor.interactSpot!, event)
                    }
                  >
                    I
                  </button>
                ) : null}
                {previewSelectedActor?.lookSpot ? (
                  <button
                    className="viewport-spot actor-look-spot"
                    type="button"
                    style={{
                      left: `${(previewSelectedActor.lookSpot.x / previewSceneSize.width) * 100}%`,
                      top: `${(previewSelectedActor.lookSpot.y / previewSceneSize.height) * 100}%`
                    }}
                    title="Actor look spot"
                    onPointerDown={(event) =>
                      startActorSpotInteraction("look", previewSelectedActor.lookSpot!, event)
                    }
                  >
                    L
                  </button>
                ) : null}
                {(() => {
                  const playerIsGenerating =
                    activeImageGenerationContext?.entityKind === "player" &&
                    activeImageGenerationContext.sceneId === selectedScene.id;
                  return (
                <div
                  className={`character ${previewPlayerAssetUrl ? "has-player-asset" : ""} ${
                    isPlayerInspectorSelected ? "selected" : ""
                  } ${playerIsGenerating ? "is-generating" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={selectPlayerInScene}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectPlayerInScene();
                    }
                  }}
                  onPointerDown={startPlayerStartInteraction}
                    style={{
                      backgroundImage: previewPlayerAssetUrl ? `url("${previewPlayerAssetUrl}")` : undefined,
                      backgroundPosition: previewPlayerAssetUrl ? "center bottom" : undefined,
                      backgroundRepeat: previewPlayerAssetUrl ? "no-repeat" : undefined,
                      backgroundSize: previewPlayerAssetUrl ? "contain" : undefined,
                      left: `${((previewPlayerStart ?? selectedScene.playerStart).x / previewSceneSize.width) * 100}%`,
                      top: `${((previewPlayerStart ?? selectedScene.playerStart).y / previewSceneSize.height) * 100}%`
                    }}
                    title={
                      activeSceneTool === "player-start"
                        ? "Drag to move player start"
                        : "Drag to select and move player start"
                    }
                  >
                    <span />
                    {playerIsGenerating ? (
                      <span className="viewport-generation-indicator player-generation-indicator">
                        <span className="viewport-generation-spinner" aria-hidden="true" />
                        Generating
                      </span>
                    ) : null}
                </div>
                  );
                })()}
                {previewHotspots.map((hotspot) => (
                  (() => {
                    const hotspotIssues = previewHotspotIssueMap[hotspot.id];
                    return (
                  <button
                    className={`hotspot-box ${selectedHotspot?.id === hotspot.id ? "selected" : ""} ${hotspotIssues?.hasIssues ? `has-issues ${hotspotIssues.tone}` : ""}`}
                    key={hotspot.id}
                    type="button"
                    onClick={() => selectHotspot(hotspot)}
                    onPointerDown={(event) => startHotspotInteraction("move", hotspot, event)}
                    style={{
                      height: `${(hotspot.bounds.height / previewSceneSize.height) * 100}%`,
                      left: `${(hotspot.bounds.x / previewSceneSize.width) * 100}%`,
                      top: `${(hotspot.bounds.y / previewSceneSize.height) * 100}%`,
                      width: `${(hotspot.bounds.width / previewSceneSize.width) * 100}%`
                    }}
                    title={
                      hotspotIssues?.hasIssues
                        ? hotspotIssues.detail
                        : activeSceneTool === "hotspot"
                          ? "Click to inspect, drag to move"
                          : "Click to inspect, drag to select and move"
                    }
                  >
                    <span className="viewport-label">
                      {hotspot.id}
                      {hotspotIssues?.hasIssues ? (
                        <span className={`viewport-issue-badge ${hotspotIssues.tone}`}>
                          {hotspotIssues.issueCount}
                        </span>
                      ) : null}
                    </span>
                    {selectedHotspot?.id === hotspot.id ? (
                      <span
                        className="viewport-resize-handle"
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => startHotspotInteraction("resize", hotspot, event)}
                      />
                    ) : null}
                  </button>
                    );
                  })()
                ))}
                {previewSelectedHotspot?.interactSpot ? (
                  <button
                    className="viewport-spot hotspot-interact-spot"
                    type="button"
                    style={{
                      left: `${(previewSelectedHotspot.interactSpot.x / previewSceneSize.width) * 100}%`,
                      top: `${(previewSelectedHotspot.interactSpot.y / previewSceneSize.height) * 100}%`
                    }}
                    title="Hotspot interact spot"
                    onPointerDown={(event) =>
                      startHotspotSpotInteraction("interact", previewSelectedHotspot.interactSpot!, event)
                    }
                  >
                    I
                  </button>
                ) : null}
                {previewSelectedHotspot?.lookSpot ? (
                  <button
                    className="viewport-spot hotspot-look-spot"
                    type="button"
                    style={{
                      left: `${(previewSelectedHotspot.lookSpot.x / previewSceneSize.width) * 100}%`,
                      top: `${(previewSelectedHotspot.lookSpot.y / previewSceneSize.height) * 100}%`
                    }}
                    title="Hotspot look spot"
                    onPointerDown={(event) =>
                      startHotspotSpotInteraction("look", previewSelectedHotspot.lookSpot!, event)
                    }
                  >
                    L
                  </button>
                ) : null}
                {previewPickups.map((pickup) => (
                  (() => {
                    const pickupIssues = previewPickupIssueMap[pickup.id];
                    const pickupAssetPath = pickup.assetId ? assetPathById.get(pickup.assetId) : null;
                    const pickupAssetUrl = pickupAssetPath ? assetPreviewUrls[pickupAssetPath] : undefined;
                    const pickupIsGenerating =
                      activeImageGenerationContext?.entityKind === "pickup" &&
                      activeImageGenerationContext.sceneId === selectedScene.id &&
                      activeImageGenerationContext.entityId === pickup.id;
                    return (
                  <button
                    className={`pickup-box ${selectedPickup?.id === pickup.id ? "selected" : ""} ${pickupIssues?.hasIssues ? `has-issues ${pickupIssues.tone}` : ""} ${pickupIsGenerating ? "is-generating" : ""}`}
                    key={pickup.id}
                    type="button"
                    onClick={() => selectPickup(pickup)}
                    onPointerDown={(event) => startPickupInteraction("move", pickup, event)}
                    style={{
                      height: `${(pickup.bounds.height / previewSceneSize.height) * 100}%`,
                      left: `${(pickup.bounds.x / previewSceneSize.width) * 100}%`,
                      top: `${(pickup.bounds.y / previewSceneSize.height) * 100}%`,
                      width: `${(pickup.bounds.width / previewSceneSize.width) * 100}%`,
                      backgroundImage: pickupAssetUrl ? `url("${pickupAssetUrl}")` : undefined,
                      backgroundPosition: pickupAssetUrl ? "center" : undefined,
                      backgroundRepeat: pickupAssetUrl ? "no-repeat" : undefined,
                      backgroundSize: pickupAssetUrl ? "100% 100%" : undefined
                    }}
                    title={
                      pickupIssues?.hasIssues
                        ? pickupIssues.detail
                        : activeSceneTool === "pickup"
                          ? "Click to inspect, drag to move"
                          : "Click to inspect, drag to select and move"
                    }
                  >
                    <span className="viewport-label">
                      {pickup.id}
                      {pickupIssues?.hasIssues ? (
                        <span className={`viewport-issue-badge ${pickupIssues.tone}`}>
                          {pickupIssues.issueCount}
                        </span>
                      ) : null}
                    </span>
                    {pickupIsGenerating ? (
                      <span className="viewport-generation-indicator">
                        <span className="viewport-generation-spinner" aria-hidden="true" />
                        Generating
                      </span>
                    ) : null}
                    {selectedPickup?.id === pickup.id ? (
                      <span
                        className="viewport-resize-handle"
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => startPickupInteraction("resize", pickup, event)}
                      />
                    ) : null}
                  </button>
                    );
                  })()
                ))}
              </>
            ) : (
              <div className="empty-scene">Open a project to inspect a scene.</div>
            )}
            </div>
  );
}
