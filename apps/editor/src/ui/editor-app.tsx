import { useState } from "react";

type Workspace = "scene" | "narrative" | "assets" | "build";

const workspaces: { id: Workspace; label: string }[] = [
  { id: "scene", label: "Scene" },
  { id: "narrative", label: "Narrative" },
  { id: "assets", label: "Asset Studio" },
  { id: "build", label: "Build" }
];

export function EditorApp() {
  const [workspace, setWorkspace] = useState<Workspace>("scene");
  const [status, setStatus] = useState("Project valid");

  const play = async () => {
    setStatus("Opening isolated preview...");
    await window.pointClick.openPreview("moonlit-dock");
    setStatus("Preview connected");
  };

  const openBrowser = async () => {
    await window.pointClick.openInBrowser();
    setStatus("Opened in default browser");
  };

  return (
    <div className="studio-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">P/C</span>
          <div>
            <strong>Point & Click Studio</strong>
            <small>The Isle of Echoes</small>
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
          <button className="secondary-action" type="button" onClick={openBrowser}>
            Browser
          </button>
          <button className="play-action" type="button" onClick={play}>
            <span>▶</span> Play from here
          </button>
        </div>
      </header>

      <div className="workspace-grid">
        <aside className="project-panel panel">
          <div className="panel-heading">
            <span>Project</span>
            <button type="button" aria-label="Add item">
              +
            </button>
          </div>
          <div className="tree">
            <div className="tree-group open">Chapter One</div>
            <button className="tree-item selected" type="button">
              <span className="scene-dot" /> Moonlit Dock
            </button>
            <button className="tree-item" type="button">
              <span className="scene-dot muted" /> Tavern Interior
            </button>
            <div className="tree-group">Characters</div>
            <div className="tree-group">Inventory</div>
            <div className="tree-group">Flows</div>
            <div className="tree-group">Locales</div>
          </div>
          <div className="project-health">
            <span className="health-light" />
            <div>
              <strong>{status}</strong>
              <small>Schema v1 · English</small>
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
            <div className="canvas-meta">Layered 2D · 1280 × 720 · 64%</div>
          </div>

          <div className="scene-viewport">
            <div className="moon" />
            <div className="sea" />
            <div className="tavern">
              <div className="roof" />
              <div className="door" />
            </div>
            <div className="dock" />
            <div className="character">
              <span />
            </div>
            <div className="hotspot-box">
              <span>tavern-entrance</span>
            </div>
            <div className="walk-region">walk-area</div>
            <div className="crate" />
          </div>

          <div className="timeline-strip">
            <span>Scene graph</span>
            <div className="timeline-node selected">Background</div>
            <div className="timeline-node">Tavern</div>
            <div className="timeline-node">Hotspots</div>
            <div className="timeline-node">Foreground</div>
          </div>
        </section>

        <aside className="inspector-panel panel">
          <div className="panel-heading">
            <span>Inspector</span>
            <small>Hotspot</small>
          </div>
          <div className="inspector-content">
            <label>
              Name
              <input value="tavern-entrance" readOnly />
            </label>
            <label>
              Display label
              <input value="The Lantern & Gull" readOnly />
            </label>
            <div className="field-group">
              <span>Bounds</span>
              <div className="four-fields">
                <input aria-label="X" value="850" readOnly />
                <input aria-label="Y" value="335" readOnly />
                <input aria-label="Width" value="125" readOnly />
                <input aria-label="Height" value="215" readOnly />
              </div>
            </div>
            <label>
              Cursor
              <select defaultValue="enter">
                <option value="enter">Enter</option>
                <option value="look">Look</option>
                <option value="use">Use</option>
              </select>
            </label>
            <div className="flow-link">
              <span>On activate</span>
              <strong>inspect-tavern-door</strong>
              <button type="button">Open flow →</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

