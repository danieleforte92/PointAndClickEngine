import type { AssetDocument } from "@pointclick/contracts";
import { useMemo } from "react";

export interface ResourceDockProps {
  assets: readonly AssetDocument[];
  height: number;
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  onHeightChange: (height: number) => void;
  onOpenAssets: () => void;
  onQueryChange: (query: string) => void;
  onSelectAsset: (assetId: string) => void;
  onViewModeChange: (mode: "grid" | "list") => void;
  previewUrls: Readonly<Record<string, string>>;
  query: string;
  selectedAssetId: string | null;
  viewMode: "grid" | "list";
}

export function ResourceDock({
  assets,
  height,
  isOpen,
  onClose,
  onOpen,
  onHeightChange,
  onOpenAssets,
  onQueryChange,
  onSelectAsset,
  onViewModeChange,
  previewUrls,
  query,
  selectedAssetId,
  viewMode
}: ResourceDockProps) {
  const filteredAssets = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return assets;
    return assets.filter((asset) => `${asset.id} ${asset.path} ${asset.kind}`.toLocaleLowerCase().includes(normalized));
  }, [assets, query]);

  if (!isOpen) {
    return <button aria-label="Open resource dock" className="resource-dock-collapsed" type="button" onClick={() => { onOpen?.(); onHeightChange(220); }}>Resources</button>;
  }

  return (
    <aside className="resource-dock" style={{ height }} aria-label="Resource dock">
      <div className="resource-dock-resize" role="separator" aria-label="Resize resource dock" tabIndex={0} onDoubleClick={() => onHeightChange(220)} onPointerDown={(event) => {
        const startY = event.clientY;
        const startHeight = height;
        const onMove = (move: PointerEvent) => onHeightChange(startHeight - (move.clientY - startY));
        const onEnd = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onEnd);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onEnd, { once: true });
      }} />
      <header className="resource-dock-header">
        <div><span>Quick resources</span><strong>{filteredAssets.length} / {assets.length}</strong></div>
        <div className="resource-dock-actions">
          <button aria-label="Open full Assets workspace" type="button" onClick={onOpenAssets}>Open Assets</button>
          <button aria-label="Collapse resource dock" type="button" onClick={onClose}>Collapse</button>
        </div>
      </header>
      <div className="resource-dock-toolbar">
        <input aria-label="Search resources" placeholder="Search resources" type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} />
        <button aria-label="Resource grid" aria-pressed={viewMode === "grid"} type="button" onClick={() => onViewModeChange("grid")}>Grid</button>
        <button aria-label="Resource list" aria-pressed={viewMode === "list"} type="button" onClick={() => onViewModeChange("list")}>List</button>
      </div>
      <div className={`resource-dock-grid ${viewMode}`}>
        {filteredAssets.map((asset) => (
          <button
            className={`resource-card ${selectedAssetId === asset.id ? "selected" : ""}`}
            draggable
            key={asset.id}
            type="button"
            onClick={() => onSelectAsset(asset.id)}
            onDragStart={(event) => event.dataTransfer.setData("application/x-pointclick-asset", asset.id)}
          >
            <span className="resource-card-preview" style={asset.kind === "image" && previewUrls[asset.path] ? { backgroundImage: `url("${previewUrls[asset.path]}")` } : undefined} aria-hidden="true">{asset.kind === "audio" ? "♫" : ""}</span>
            <span><strong>{asset.id}</strong><small>{asset.kind} · {asset.path}</small></span>
          </button>
        ))}
        {filteredAssets.length === 0 ? <p className="resource-dock-empty">No matching resources.</p> : null}
      </div>
    </aside>
  );
}
