import type { AssetDocument } from "@pointclick/contracts";
import { Image } from "lucide-react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import {
  buildBezierCropSegmentSvgPath,
  type BezierCropNode
} from "../../../asset-processing";
import type { AssetStudioTool } from "./asset-studio-state";

export interface ImageOptimizationPreview {
  dataUrl: string;
  height: number;
  hasAlpha: boolean;
  outputBytes: number;
  sourceBytes: number;
  sourceHasAlpha: boolean;
  width: number;
}

export interface AssetStudioPreviewProps {
  activeAssetTool: AssetStudioTool;
  buildAssetBytesLabel: (bytes: number) => string;
  cropControlRadius: number;
  cropImageFrameRef: RefObject<HTMLDivElement | null>;
  cropImageSize: { height: number; width: number };
  cropPath: BezierCropNode[];
  cropPreviewPath: string;
  insertCropNodeFromEvent: (index: number, event: ReactPointerEvent) => void;
  optimizePreview: ImageOptimizationPreview | null;
  selectedAsset: AssetDocument | null;
  selectedAssetHealth: string;
  selectedAssetUrl?: string | undefined;
  selectedCropNode: BezierCropNode | null;
  selectedCropNodeIndex: number;
  startCropHandleInteraction: (
    index: number,
    handle: "inHandle" | "outHandle",
    event: ReactPointerEvent
  ) => void;
  startCropNodeInteraction: (index: number, event: ReactPointerEvent) => void;
}

export function AssetStudioPreview({
  activeAssetTool,
  buildAssetBytesLabel: formatAssetBytes,
  cropControlRadius,
  cropImageFrameRef,
  cropImageSize,
  cropPath,
  cropPreviewPath: cropSvgPath,
  insertCropNodeFromEvent,
  optimizePreview,
  selectedAsset,
  selectedAssetHealth,
  selectedAssetUrl,
  selectedCropNode,
  selectedCropNodeIndex,
  startCropHandleInteraction,
  startCropNodeInteraction
}: AssetStudioPreviewProps) {
  return (
                <div className="asset-studio-preview">
                  {activeAssetTool === "optimize" && selectedAssetUrl ? (
                    <div className="optimize-comparison-preview" aria-label="Image optimization comparison">
                      <figure>
                        <div className="optimize-comparison-image checkerboard"><img src={selectedAssetUrl} alt="Source asset preview" /></div>
                        <figcaption>
                          <strong>Before</strong>
                          <span>{cropImageSize.width} × {cropImageSize.height}</span>
                          <span>{optimizePreview ? formatAssetBytes(optimizePreview.sourceBytes) : "Calculating size"}</span>
                          <span>{optimizePreview?.sourceHasAlpha ? "Alpha" : "Opaque"}</span>
                        </figcaption>
                      </figure>
                      <figure>
                        <div className="optimize-comparison-image checkerboard">
                          {optimizePreview ? <img src={optimizePreview.dataUrl} alt="Optimized asset preview" /> : <span>Rendering preview…</span>}
                        </div>
                        <figcaption>
                          <strong>After</strong>
                          <span>{optimizePreview ? `${optimizePreview.width} × ${optimizePreview.height}` : "Pending"}</span>
                          <span>{optimizePreview ? formatAssetBytes(optimizePreview.outputBytes) : "Calculating size"}</span>
                          <span>{optimizePreview ? (optimizePreview.hasAlpha ? "Alpha" : "Opaque") : "Pending"}</span>
                        </figcaption>
                      </figure>
                    </div>
                  ) : (
                  <div
                    className={`asset-studio-image ${selectedAssetUrl ? "has-preview" : ""} ${activeAssetTool === "crop" ? "crop-editor-active" : ""}`}
                    ref={activeAssetTool === "crop" ? cropImageFrameRef : undefined}
                    style={selectedAssetUrl ? { backgroundImage: `url("${selectedAssetUrl}")` } : undefined}
                    aria-label={selectedAsset ? `${selectedAsset.id} preview` : "No asset preview"}
                    role="img"
                  >
                    {selectedAssetUrl && activeAssetTool === "crop" ? (
                      <svg
                        className="asset-crop-overlay"
                        viewBox={`0 0 ${cropImageSize.width} ${cropImageSize.height}`}
                        preserveAspectRatio="xMidYMid meet"
                      >
                        <path className="asset-crop-mask" d={cropSvgPath} />
                        <path className="asset-crop-outline" d={cropSvgPath} />
                        {cropPath.map((_, index) => (
                          <path
                            className="asset-crop-segment-hit"
                            d={buildBezierCropSegmentSvgPath(cropPath, index)}
                            key={`crop-segment-${index}`}
                            onPointerDown={(event) => insertCropNodeFromEvent(index, event)}
                          />
                        ))}
                        {cropPath.map((node, index) => {
                          const inHandle = node.inHandle;
                          const outHandle = node.outHandle;
                          const selected = selectedCropNodeIndex === index;
                          return (
                            <g className={`asset-crop-node-group ${selected ? "selected" : ""}`} key={`crop-node-${index}`}>
                              {inHandle ? (
                                <>
                                  <line className="asset-crop-handle-line" x1={node.x} x2={inHandle.x} y1={node.y} y2={inHandle.y} />
                                  <circle
                                    className="asset-crop-handle in"
                                    cx={inHandle.x}
                                    cy={inHandle.y}
                                    r={Math.max(6, cropControlRadius * 0.75)}
                                    onPointerDown={(event) => startCropHandleInteraction(index, "inHandle", event)}
                                  />
                                </>
                              ) : null}
                              {outHandle ? (
                                <>
                                  <line className="asset-crop-handle-line" x1={node.x} x2={outHandle.x} y1={node.y} y2={outHandle.y} />
                                  <circle
                                    className="asset-crop-handle out"
                                    cx={outHandle.x}
                                    cy={outHandle.y}
                                    r={Math.max(6, cropControlRadius * 0.75)}
                                    onPointerDown={(event) => startCropHandleInteraction(index, "outHandle", event)}
                                  />
                                </>
                              ) : null}
                              <circle
                                className={`asset-crop-node ${node.mode}`}
                                cx={node.x}
                                cy={node.y}
                                r={cropControlRadius}
                                onPointerDown={(event) => startCropNodeInteraction(index, event)}
                              />
                              <text className="asset-crop-node-label" x={node.x + cropControlRadius + 6} y={node.y - cropControlRadius}>
                                {index + 1}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    ) : selectedAssetUrl ? null : (
                      <Image size={32} />
                    )}
                  </div>
                  )}
                  <div className="asset-studio-meta">
                    <span className={`target-mode-pill ${selectedAssetHealth === "missing" ? "warn" : "good"}`}>
                      {selectedAsset ? selectedAssetHealth : "no asset"}
                    </span>
                    <span>{selectedAsset?.kind ?? "image"}</span>
                    <span>{selectedAsset?.path ?? "No path"}</span>
                  </div>
                </div>
  );
}
