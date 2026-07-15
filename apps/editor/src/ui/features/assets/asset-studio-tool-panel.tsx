import type { AssetDocument, PromptPackDocument, PromptPackGenerationTarget } from "@pointclick/contracts";
import { Crosshair, ExternalLink, Image, Scissors, Trash2, WandSparkles } from "lucide-react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import type { BezierCropNode, ImageOptimizePresetId } from "../../../asset-processing";
import type { ImageOptimizationPreview } from "./asset-studio-preview";
import type { AssetStudioTool } from "./asset-studio-state";

export interface AssetUsageSummary {
  detail: string;
  sceneId?: string | undefined;
  sceneName?: string | undefined;
  type: string;
}

export interface AssetGuideSourceOption {
  id: string;
  label: string;
}

export interface AssetOptimizePreset {
  format: string;
  id: ImageOptimizePresetId;
  label: string;
  lossless: boolean;
  quality?: number;
}

export interface AssetStudioToolPanelProps {
  activeAssetTool: AssetStudioTool;
  assetEditTarget: boolean;
  assetPathDraft: string;
  buildAssetBytesLabel: (bytes: number) => string;
  cleanupFeather: string;
  cleanupKeyColor: string;
  cleanupOutputCanvasRef: RefObject<HTMLCanvasElement | null>;
  cleanupSourceCanvasRef: RefObject<HTMLCanvasElement | null>;
  cleanupSpillReduction: boolean;
  cleanupStatus: string;
  cleanupTolerance: string;
  cropImageSize: { height: number; width: number };
  cropPath: BezierCropNode[];
  cropPreviewBounds: { height: number; width: number };
  cropStatus: string;
  hasBackgroundCleanupTarget: boolean;
  iconSize: number;
  imageOptimizePreset: (presetId: ImageOptimizePresetId) => { resize: string };
  imageOptimizePresets: ReadonlyArray<AssetOptimizePreset>;
  onApplyAssetRelink: () => void | Promise<void>;
  onApplyOptimizedAsset: () => void | Promise<void>;
  onAssignAssetBackground: () => void | Promise<void>;
  onAssignSelectedProcessedAsset: () => void | Promise<void>;
  onDeleteSelectedAsset: () => void | Promise<void>;
  onOpenAiStudioForAssetUsage: () => void;
  onPickCleanupColor: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onRenderBackgroundCleanupPreview: () => void | Promise<void>;
  onResetCropPath: () => void;
  onSaveBackgroundCleanupAsset: () => void | Promise<void>;
  onSaveCroppedAsset: () => void | Promise<void>;
  onSaveGuideMaskAsset: () => void | Promise<void>;
  onSetCleanupFeather: (value: string) => void;
  onSetCleanupKeyColor: (value: string) => void;
  onSetCleanupSpillReduction: (value: boolean) => void;
  onSetCleanupTolerance: (value: string) => void;
  onSetGuideShape: (value: "rect" | "ellipse") => void;
  onSetGuideSourceId: (value: string) => void;
  onSetOptimizeHeight: (value: string) => void;
  onSetOptimizePresetId: (value: ImageOptimizePresetId) => void;
  onSetOptimizeWidth: (value: string) => void;
  onSetSelectedCropNodeIndex: (value: number) => void;
  onSetSelectedGenerationTargetId: (value: string) => void;
  onSetSelectedPromptPackId: (value: string | null) => void;
  onUpdateAssetPathDraft: (value: string) => void;
  onUpdateCropNodeMode: (index: number, mode: BezierCropNode["mode"]) => void;
  onUpdateCropNodePosition: (index: number, axis: "x" | "y", value: string) => void;
  optimizePresetId: ImageOptimizePresetId;
  optimizePreview: ImageOptimizationPreview | null;
  optimizeStatus: string;
  optimizeHeight: string;
  optimizeWidth: string;
  promptPacks: PromptPackDocument[];
  savedPromptPackTargets: PromptPackGenerationTarget[];
  selectedAsset: AssetDocument | null;
  selectedAssetHealth: string;
  selectedAssetUsage: ReadonlyArray<AssetUsageSummary>;
  selectedAssetUrl?: string | undefined;
  selectedGuideSource: AssetGuideSourceOption | null;
  selectedPromptPack: PromptPackDocument | null;
  selectedSavedGenerationTarget: PromptPackGenerationTarget | null;
  selectedCropNode: BezierCropNode | null;
  selectedCropNodeIndex: number;
  guideSourceOptions: ReadonlyArray<AssetGuideSourceOption>;
  guideShape: "rect" | "ellipse";
  guideStatus: string;
  hasSceneSelection: boolean;
}

export function AssetStudioToolPanel({
  activeAssetTool,
  assetEditTarget: hasAssetEditTarget,
  assetPathDraft,
  buildAssetBytesLabel: formatAssetBytes,
  cleanupFeather,
  cleanupKeyColor,
  cleanupOutputCanvasRef,
  cleanupSourceCanvasRef,
  cleanupSpillReduction,
  cleanupStatus,
  cleanupTolerance,
  cropImageSize,
  cropPath,
  cropPreviewBounds,
  cropStatus,
  hasBackgroundCleanupTarget,
  iconSize,
  imageOptimizePreset,
  imageOptimizePresets,
  onApplyAssetRelink: applyAssetRelink,
  onApplyOptimizedAsset: applyOptimizedAsset,
  onAssignAssetBackground: assignAssetBackground,
  onAssignSelectedProcessedAsset: assignSelectedProcessedAsset,
  onDeleteSelectedAsset: deleteSelectedAsset,
  onOpenAiStudioForAssetUsage: openAiStudioForAssetUsage,
  onPickCleanupColor: pickCleanupColor,
  onRenderBackgroundCleanupPreview: renderBackgroundCleanupPreview,
  onResetCropPath: resetCropPath,
  onSaveBackgroundCleanupAsset: saveBackgroundCleanupAsset,
  onSaveCroppedAsset: saveCroppedAsset,
  onSaveGuideMaskAsset: saveGuideMaskAsset,
  onSetCleanupFeather: setCleanupFeather,
  onSetCleanupKeyColor: setCleanupKeyColor,
  onSetCleanupSpillReduction: setCleanupSpillReduction,
  onSetCleanupTolerance: setCleanupTolerance,
  onSetGuideShape: setGuideShape,
  onSetGuideSourceId: setGuideSourceId,
  onSetOptimizeHeight: setOptimizeHeight,
  onSetOptimizePresetId: setOptimizePresetId,
  onSetOptimizeWidth: setOptimizeWidth,
  onSetSelectedCropNodeIndex: setSelectedCropNodeIndex,
  onSetSelectedGenerationTargetId: setSelectedGenerationTargetId,
  onSetSelectedPromptPackId: setSelectedPromptPackId,
  onUpdateAssetPathDraft: setAssetPathDraft,
  onUpdateCropNodeMode: updateCropNodeMode,
  onUpdateCropNodePosition: updateCropNodePosition,
  optimizePresetId,
  optimizePreview,
  optimizeStatus,
  optimizeHeight,
  optimizeWidth,
  promptPacks,
  savedPromptPackTargets,
  selectedAsset,
  selectedAssetHealth,
  selectedAssetUsage,
  selectedAssetUrl,
  selectedGuideSource,
  selectedPromptPack,
  selectedSavedGenerationTarget,
  selectedCropNode,
  selectedCropNodeIndex,
  guideSourceOptions,
  guideShape,
  guideStatus,
  hasSceneSelection
}: AssetStudioToolPanelProps) {
  return (
                <div className="asset-studio-tool-panel">
                  {activeAssetTool === "info" ? (
                    <>
                      <span className="overview-label">Selected asset</span>
                      <strong>{selectedAsset?.id ?? "No asset selected"}</strong>
                      <p>{selectedAsset ? `${selectedAsset.kind} - ${selectedAsset.path}` : "Choose an asset from the project tree."}</p>
                      {selectedAsset ? (
                        <div className="asset-path-editor">
                          <label>
                            Asset path
                            <input value={assetPathDraft} onChange={(event) => setAssetPathDraft(event.target.value)} />
                          </label>
                          <div className="build-actions">
                            <button className="secondary-action compact-action" type="button" onClick={applyAssetRelink}>
                              <ExternalLink size={iconSize} /> Relink
                            </button>
                            <button
                              className="secondary-action compact-action"
                              disabled={!hasSceneSelection || selectedAsset.kind !== "image" || selectedAssetHealth === "missing"}
                              type="button"
                              onClick={assignAssetBackground}
                            >
                              <Image size={iconSize} /> Set Background
                            </button>
                            <button
                              className="secondary-action compact-action"
                              disabled={selectedAsset.kind !== "image"}
                              type="button"
                              onClick={openAiStudioForAssetUsage}
                            >
                              <WandSparkles size={iconSize} /> AI Target
                            </button>
                            <button
                              className="secondary-action compact-action"
                              disabled={selectedAssetUsage.length > 0}
                              type="button"
                              onClick={deleteSelectedAsset}
                            >
                              <Trash2 size={iconSize} /> Delete Unused
                            </button>
                          </div>
                        </div>
                      ) : null}
                      <div className="diagnostic-list">
                        {selectedAssetUsage.length ? (
                          selectedAssetUsage.map((usage, index) => (
                            <div className="diagnostic-item" key={`asset-usage-${index}-${usage.detail}`}>
                              <div>
                                <strong>{usage.detail}</strong>
                                <p>{usage.sceneName ? `${usage.sceneName} (${usage.sceneId})` : usage.type}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p>No saved reference uses this asset yet.</p>
                        )}
                      </div>
                    </>
                  ) : activeAssetTool === "chroma" ? (
                    <>
                      <span className="overview-label">Chroma Key</span>
                      <strong>{selectedAsset?.id ?? "Select an asset"}</strong>
                      <div className="cleanup-preview-grid compact">
                        <div className="cleanup-preview-pane">
                          <span>Source</span>
                          <canvas ref={cleanupSourceCanvasRef} className="cleanup-canvas" onPointerDown={pickCleanupColor} />
                        </div>
                        <div className="cleanup-preview-pane checkerboard-pane">
                          <span>Preview</span>
                          <canvas ref={cleanupOutputCanvasRef} className="cleanup-canvas" />
                        </div>
                      </div>
                      <div className="cleanup-controls">
                        <label>Key color<input value={cleanupKeyColor} onChange={(event) => setCleanupKeyColor(event.target.value)} /></label>
                        <label>Tolerance<input min="0" max="255" type="range" value={cleanupTolerance} onChange={(event) => setCleanupTolerance(event.target.value)} /><small>{cleanupTolerance}</small></label>
                        <label>Feather<input min="0" max="120" type="range" value={cleanupFeather} onChange={(event) => setCleanupFeather(event.target.value)} /><small>{cleanupFeather}</small></label>
                        <label className="checkbox-field"><input checked={cleanupSpillReduction} type="checkbox" onChange={(event) => setCleanupSpillReduction(event.target.checked)} />Reduce spill</label>
                      </div>
                      <div className="cleanup-status-row"><p>{cleanupStatus}</p></div>
                      <div className="build-actions">
                        <button className="secondary-action compact-action" disabled={!hasBackgroundCleanupTarget} type="button" onClick={renderBackgroundCleanupPreview}>Refresh</button>
                        <button className="play-action compact-action" disabled={!hasBackgroundCleanupTarget} type="button" onClick={saveBackgroundCleanupAsset}>Save New PNG</button>
                      </div>
                    </>
                  ) : activeAssetTool === "crop" ? (
                    <>
                      <span className="overview-label">Crop</span>
                      <strong>{selectedAsset?.id ?? "Select an asset"}</strong>
                      <div className="crop-stats-grid">
                        <div><span>Image</span><strong>{cropImageSize.width} x {cropImageSize.height}</strong></div>
                        <div><span>Output</span><strong>{cropPreviewBounds.width} x {cropPreviewBounds.height}</strong></div>
                        <div><span>Nodes</span><strong>{cropPath.length}</strong></div>
                        <div><span>Mode</span><strong>{selectedCropNode?.mode ?? "corner"}</strong></div>
                      </div>
                      {selectedCropNode ? (
                        <div className="crop-node-editor">
                          <div className="crop-node-editor-header">
                            <strong>Node {selectedCropNodeIndex + 1}</strong>
                            <div className="crop-mode-toggle" role="group" aria-label="Crop node mode">
                              {(["corner", "smooth"] as const).map((mode) => (
                                <button
                                  className={selectedCropNode.mode === mode ? "active" : ""}
                                  key={`crop-node-mode-${mode}`}
                                  type="button"
                                  onClick={() => updateCropNodeMode(selectedCropNodeIndex, mode)}
                                >
                                  {mode}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="player-field-grid">
                            <label>
                              X
                              <input
                                value={String(selectedCropNode.x)}
                                onChange={(event) => updateCropNodePosition(selectedCropNodeIndex, "x", event.target.value)}
                              />
                            </label>
                            <label>
                              Y
                              <input
                                value={String(selectedCropNode.y)}
                                onChange={(event) => updateCropNodePosition(selectedCropNodeIndex, "y", event.target.value)}
                              />
                            </label>
                          </div>
                        </div>
                      ) : null}
                      <div className="crop-node-list">
                        {cropPath.map((node, index) => (
                          <button
                            className={selectedCropNodeIndex === index ? "active" : ""}
                            key={`crop-node-select-${index}`}
                            type="button"
                            onClick={() => setSelectedCropNodeIndex(index)}
                          >
                            {index + 1}
                            <span>{node.mode}</span>
                          </button>
                        ))}
                      </div>
                      <p>{cropStatus}</p>
                      <div className="build-actions">
                        <button className="play-action compact-action" disabled={!selectedAssetUrl} type="button" onClick={saveCroppedAsset}>
                          <Scissors size={iconSize} /> Save Cutout PNG
                        </button>
                        <button className="secondary-action compact-action" disabled={!selectedAssetUrl} type="button" onClick={resetCropPath}>
                          Reset Path
                        </button>
                      </div>
                    </>
                  ) : activeAssetTool === "optimize" ? (
                    <>
                      <span className="overview-label">Optimize</span>
                      <strong>{selectedAsset?.id ?? "Select an image"}</strong>
                      <p>Apply never overwrites the source. The derived asset records its parent, operations, format, dimensions, and timestamp.</p>
                      <div className="optimize-preset-grid">
                        {imageOptimizePresets.map((preset) => (
                          <button
                            className={optimizePresetId === preset.id ? "active" : ""}
                            key={preset.id}
                            type="button"
                            onClick={() => setOptimizePresetId(preset.id)}
                          >
                            <strong>{preset.label}</strong>
                            <small>{preset.format.toUpperCase()} · {preset.lossless ? "lossless" : `quality ${preset.quality}`}</small>
                          </button>
                        ))}
                      </div>
                      <div className="crop-stats-grid">
                        <div><span>Before</span><strong>{optimizePreview ? formatAssetBytes(optimizePreview.sourceBytes) : "…"}</strong></div>
                        <div><span>After</span><strong>{optimizePreview ? formatAssetBytes(optimizePreview.outputBytes) : "…"}</strong></div>
                        <div><span>Alpha</span><strong>{optimizePreview ? `${optimizePreview.sourceHasAlpha ? "yes" : "no"} → ${optimizePreview.hasAlpha ? "yes" : "no"}` : "…"}</strong></div>
                        <div><span>Resize</span><strong>{imageOptimizePreset(optimizePresetId).resize}</strong></div>
                      </div>
                      <div className="player-field-grid">
                        <label>Width<input min={1} placeholder={String(cropImageSize.width)} type="number" value={optimizeWidth} onChange={(event) => setOptimizeWidth(event.target.value)} /></label>
                        <label>Height<input min={1} placeholder={String(cropImageSize.height)} type="number" value={optimizeHeight} onChange={(event) => setOptimizeHeight(event.target.value)} /></label>
                      </div>
                      <p>{optimizeStatus}</p>
                      <div className="build-actions">
                        <button className="play-action compact-action" disabled={!optimizePreview || selectedAsset?.kind !== "image"} type="button" onClick={applyOptimizedAsset}>Apply Derived Asset</button>
                        <button className="secondary-action compact-action" disabled={!hasAssetEditTarget || selectedAsset?.kind !== "image"} type="button" onClick={assignSelectedProcessedAsset}>Assign To Target</button>
                      </div>
                    </>
                  ) : activeAssetTool === "guide" ? (
                    <>
                      <span className="overview-label">Generation Guide</span>
                      <strong>{selectedSavedGenerationTarget?.id ?? "No saved target"}</strong>
                      <p>Creates reusable reference and mask assets for custom ComfyUI workflows with LoadImage/LoadImageMask nodes.</p>
                      <div className="prompt-studio-controls">
                        <label className="prompt-studio-field">Saved prompt pack<select value={selectedPromptPack?.id ?? ""} onChange={(event) => setSelectedPromptPackId(event.target.value || null)}><option value="">Select pack</option>{promptPacks.map((pack) => <option key={`guide-pack-${pack.id}`} value={pack.id}>{pack.id}</option>)}</select></label>
                        <label className="prompt-studio-field">Target<select value={selectedSavedGenerationTarget?.id ?? ""} onChange={(event) => setSelectedGenerationTargetId(event.target.value)}><option value="">Select target</option>{savedPromptPackTargets.map((target) => <option key={`guide-target-${target.id}`} value={target.id}>{target.id} ({target.intendedUse})</option>)}</select></label>
                        <label className="prompt-studio-field">Scene source<select value={selectedGuideSource?.id ?? ""} onChange={(event) => setGuideSourceId(event.target.value)}>{guideSourceOptions.map((source) => <option key={`guide-source-${source.id}`} value={source.id}>{source.label}</option>)}</select></label>
                        <label className="prompt-studio-field">Mask shape<select value={guideShape} onChange={(event) => setGuideShape(event.target.value === "ellipse" ? "ellipse" : "rect")}><option value="rect">rect</option><option value="ellipse">ellipse</option></select></label>
                      </div>
                      <p>{guideStatus}</p>
                      <div className="build-actions">
                        <button className="play-action compact-action" disabled={!selectedAsset || !selectedPromptPack || !selectedSavedGenerationTarget || !selectedGuideSource} type="button" onClick={saveGuideMaskAsset}>
                          <Crosshair size={iconSize} /> Save Mask And Link Target
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
  );
}
