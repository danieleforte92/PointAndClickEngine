import { Bug, ExternalLink, PanelRightClose, PanelRightOpen, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import type { RuntimeDebugSnapshot, RuntimeInputAction } from "@pointclick/contracts";
import type { EditorPreviewSessionDescriptor } from "../preload";
import { firstRuntimeTraceDivergence } from "../trace-diff";

type DebugTab = "state" | "inventory" | "dialogue" | "events" | "audio" | "compare";

export interface TestLabProps {
  actions: RuntimeInputAction[];
  browserActions: RuntimeInputAction[];
  browserTrace?: RuntimeDebugSnapshot[];
  onClose(): void;
  onOpenBrowser(): void;
  onRefreshTelemetry(): void;
  session: EditorPreviewSessionDescriptor;
  snapshots: RuntimeDebugSnapshot[];
}

function JsonBlock({ value }: { value: unknown }) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}

export function TestLab({ actions, browserActions, browserTrace = [], onClose, onOpenBrowser, onRefreshTelemetry, session, snapshots }: TestLabProps) {
  const [debugOpen, setDebugOpen] = useState(true);
  const [tab, setTab] = useState<DebugTab>("state");
  const latest = snapshots.at(-1) ?? null;
  const divergence = firstRuntimeTraceDivergence(snapshots, browserTrace);
  const tabs: Array<{ id: DebugTab; label: string }> = [
    { id: "state", label: "State" },
    { id: "inventory", label: "Inventory" },
    { id: "dialogue", label: "Dialogue" },
    { id: "events", label: "Events" },
    { id: "audio", label: "Audio" },
    { id: "compare", label: "Compare" }
  ];

  return (
    <main className={`test-lab ${debugOpen ? "debug-open" : ""}`}>
      <header className="test-lab-header">
        <div>
          <span>Test Lab</span>
          <strong>Runtime session</strong>
          <small>Expires {new Date(session.expiresAt).toLocaleTimeString()}</small>
        </div>
        <div className="test-lab-actions">
          <button type="button" onClick={onRefreshTelemetry}><RefreshCw size={14} /> Refresh</button>
          <button type="button" onClick={onOpenBrowser}><ExternalLink size={14} /> Browser</button>
          <button type="button" onClick={() => setDebugOpen((open) => !open)}>
            {debugOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />} Debug
          </button>
          <button className="test-lab-close" type="button" onClick={onClose}><X size={15} /> Close Test Lab</button>
        </div>
      </header>
      <section className="test-lab-player">
        <iframe
          allow="autoplay"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin"
          src={session.embeddedUrl}
          title="Point & Click runtime preview"
        />
      </section>
      {debugOpen ? (
        <aside className="test-lab-debug">
          <div className="test-lab-debug-title"><Bug size={15} /><strong>Runtime Debug</strong><span>{actions.length} action(s) · {snapshots.length} snapshot(s)</span></div>
          <nav aria-label="Runtime debug views">
            {tabs.map((item) => <button aria-current={tab === item.id ? "page" : undefined} className={tab === item.id ? "active" : ""} key={item.id} type="button" onClick={() => setTab(item.id)}>{item.label}</button>)}
          </nav>
          <div className="test-lab-debug-content">
            {!latest ? <p>No telemetry yet. Interact with the embedded player, then refresh.</p> : null}
            {latest && tab === "state" ? <JsonBlock value={{ sequence: latest.sequence, sceneId: latest.sceneId, player: latest.player, flags: latest.flags, flow: latest.activeFlowId, node: latest.activeNodeId, path: latest.path }} /> : null}
            {latest && tab === "inventory" ? <JsonBlock value={latest.inventory} /> : null}
            {latest && tab === "dialogue" ? <JsonBlock value={{ flow: latest.activeFlowId, node: latest.activeNodeId, textKey: latest.dialogueKey }} /> : null}
            {latest && tab === "events" ? <JsonBlock value={latest.events} /> : null}
            {latest && tab === "audio" ? <JsonBlock value={latest.audio} /> : null}
            {tab === "compare" ? (
              <div className={`trace-comparison ${divergence ? "diverged" : "aligned"}`}>
                <strong>{browserTrace.length === 0 ? "Awaiting Browser replay" : divergence ? `Diverged at ${divergence.field}` : "No divergence"}</strong>
                <p>{divergence ? `First mismatch at snapshot ${divergence.index}, sequence ${divergence.sequence ?? "n/a"}.` : `Electron recorded ${actions.length} action(s); Browser replayed ${browserActions.length}. Logical state is compared without DOM timing.`}</p>
                {divergence ? <JsonBlock value={divergence} /> : null}
              </div>
            ) : null}
          </div>
        </aside>
      ) : null}
    </main>
  );
}
