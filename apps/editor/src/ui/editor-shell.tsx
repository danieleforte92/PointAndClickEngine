import {
  Bot,
  Boxes,
  Clapperboard,
  ExternalLink,
  FilePlus2,
  FolderOpen,
  Hammer,
  Library,
  MousePointer2,
  Package,
  Play,
  Plus,
  Redo2,
  Route,
  Search,
  Undo2,
  UserRound
} from "lucide-react";
import {
  capabilityBadgeLabel,
  capabilityStatusTone,
  toolCapabilities,
  workspaceCapabilities
} from "../editor-capabilities";
import type { Workspace } from "../editor-session";

export const iconSize = 15;

export function WorkspaceIcon({ workspace }: { workspace: Workspace }) {
  switch (workspace) {
    case "overview":
      return <Search size={iconSize} />;
    case "scene":
      return <Clapperboard size={iconSize} />;
    case "narrative":
      return <Route size={iconSize} />;
    case "assets":
      return <Library size={iconSize} />;
    case "ai":
      return <Bot size={iconSize} />;
    case "build":
      return <Hammer size={iconSize} />;
  }
}

export function SceneToolIcon({ toolId }: { toolId: string }) {
  switch (toolId) {
    case "tool-select":
      return <MousePointer2 size={iconSize} />;
    case "tool-hotspot":
      return <Package size={iconSize} />;
    case "tool-actor":
      return <UserRound size={iconSize} />;
    case "tool-pickup":
      return <Boxes size={iconSize} />;
    case "tool-player-start":
      return <Play size={iconSize} />;
    case "tool-walk-area":
      return <Route size={iconSize} />;
    default:
      return <Plus size={iconSize} />;
  }
}

interface WorkspaceTabsProps {
  activeWorkspace: Workspace;
  onWorkspaceChange: (workspace: Workspace) => void;
}

export function WorkspaceTabs({ activeWorkspace, onWorkspaceChange }: WorkspaceTabsProps) {
  return (
    <nav className="workspace-tabs" aria-label="Workspaces">
      {workspaceCapabilities.map((item) => (
        <button
          className={activeWorkspace === item.workspace ? "active" : ""}
          key={item.id}
          title={item.detail}
          type="button"
          onClick={() => onWorkspaceChange(item.workspace)}
        >
          <WorkspaceIcon workspace={item.workspace} />
          <span className="workspace-tab-label">{item.label}</span>
          <span className={`capability-badge compact ${capabilityStatusTone(item.status)}`}>
            {capabilityBadgeLabel(item.status)}
          </span>
        </button>
      ))}
    </nav>
  );
}

interface TopbarActionsProps {
  canRedo: boolean;
  canUndo: boolean;
  hasProject: boolean;
  isDirty: boolean;
  onCreateBlankProject: () => void;
  onCreateProjectFromStarter: () => void;
  onOpenBrowser: () => void;
  onOpenProject: () => void;
  onPlay: () => void;
  onRedo: () => void;
  onUndo: () => void;
}

export function TopbarActions({
  canRedo,
  canUndo,
  hasProject,
  isDirty,
  onCreateBlankProject,
  onCreateProjectFromStarter,
  onOpenBrowser,
  onOpenProject,
  onPlay,
  onRedo,
  onUndo
}: TopbarActionsProps) {
  return (
    <div className="preview-actions">
      <div className="action-cluster history-cluster" aria-label="History">
        <button className="icon-action" disabled={!canUndo} title="Undo" type="button" onClick={onUndo}>
          <Undo2 size={iconSize} />
        </button>
        <button className="icon-action" disabled={!canRedo} title="Redo" type="button" onClick={onRedo}>
          <Redo2 size={iconSize} />
        </button>
      </div>
      <div className="action-cluster project-cluster" aria-label="Project actions">
        <button className="secondary-action compact-action" type="button" onClick={onOpenProject}>
          <FolderOpen size={iconSize} /> Open
        </button>
        <button className="secondary-action compact-action" type="button" onClick={onCreateProjectFromStarter}>
          <FilePlus2 size={iconSize} /> Starter
        </button>
        <button className="secondary-action compact-action" type="button" onClick={onCreateBlankProject}>
          <Plus size={iconSize} /> Blank
        </button>
      </div>
      <div className="action-cluster run-cluster" aria-label="Preview actions">
        <button className="secondary-action compact-action" disabled={!hasProject} type="button" onClick={onOpenBrowser}>
          <ExternalLink size={iconSize} /> Browser
        </button>
        <button className="play-action compact-action" disabled={!hasProject} type="button" onClick={onPlay}>
          <Play size={iconSize} /> {isDirty ? "Draft Preview" : "Play Project"}
        </button>
      </div>
    </div>
  );
}

export { toolCapabilities };
