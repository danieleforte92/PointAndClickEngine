import {
  Bot,
  Boxes,
  Clapperboard,
  Crosshair,
  Eraser,
  ExternalLink,
  FilePlus2,
  FolderOpen,
  Hammer,
  Image,
  Library,
  MousePointer2,
  Package,
  Play,
  Plus,
  Redo2,
  Route,
  Scissors,
  Trash2,
  Undo2,
  UserRound
} from "lucide-react";
import type { ReactNode } from "react";
import {
  capabilityBadgeLabel,
  capabilityStatusTone,
  toolCapabilities,
  workspaceCapabilities
} from "../editor-capabilities";
import type { CreatorPathStep, CreatorPathStepState } from "../creator-path";
import type { Workspace } from "../editor-session";
import { Badge, Button, IconButton } from "./components";

export const iconSize = 15;

export function WorkspaceIcon({ workspace }: { workspace: Workspace }) {
  switch (workspace) {
    case "overview":
      return <FolderOpen size={iconSize} />;
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
          <Badge className="compact" tone={capabilityStatusTone(item.status)}>
            {capabilityBadgeLabel(item.status)}
          </Badge>
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

interface StudioTopbarProps extends TopbarActionsProps {
  activeWorkspace: Workspace;
  projectTitle: string;
  onWorkspaceChange: (workspace: Workspace) => void;
}

interface ProjectMapPanelProps {
  children: ReactNode;
  healthDetail: string;
  healthLabel: string;
  healthTone: "good" | "warn" | "error";
  onOpenProject: () => void;
}

interface InspectorPanelProps {
  children: ReactNode;
  detail: string;
}

interface ProjectStartScreenProps {
  onCreateBlankProject: () => void;
  onCreateProjectFromStarter: () => void;
  onOpenProject: () => void;
  status: string;
}

interface WorkspaceOverviewDiagnostic {
  code: string;
  message: string;
  severity: string;
}

interface ProjectSettingsDraft {
  defaultLocale: string;
  initialSceneId: string;
  title: string;
  viewportHeight: string;
  viewportWidth: string;
}

interface ProjectSettingsOption {
  id: string;
  label: string;
}

interface WorkspaceOverviewProps {
  assetCount: number;
  creatorPathSteps: CreatorPathStep[];
  diagnostics: WorkspaceOverviewDiagnostic[];
  flowCount: number;
  hasProjectSettingsChanges: boolean;
  localeOptions: ProjectSettingsOption[];
  onOpenAi: () => void;
  onOpenAssets: () => void;
  onOpenBuild: () => void;
  onOpenCreatorPathStep: (step: CreatorPathStep) => void;
  onOpenNarrative: () => void;
  onOpenScenes: () => void;
  onProjectSettingsChange: (field: keyof ProjectSettingsDraft, value: string) => void;
  onSaveProjectSettings: () => void;
  previewDescription: string;
  previewLabel: string;
  projectSettings: ProjectSettingsDraft;
  projectHealthLabel: string;
  promptPackCount: number;
  sceneCount: number;
  sceneOptions: ProjectSettingsOption[];
  status: string;
  viewportDescription: string;
  viewportLabel: string;
}

interface BuildWorkspaceIssue {
  actionLabel?: string | undefined;
  canOpen: boolean;
  code: string;
  id: string;
  message: string;
  onOpen: () => void;
  path?: string | undefined;
  severity: string;
}

interface BuildWorkspaceProps {
  blockingIssueCount: number;
  creatorPathSteps: CreatorPathStep[];
  dirtyDraftCount: number;
  issues: BuildWorkspaceIssue[];
  onOpenCreatorPathStep: (step: CreatorPathStep) => void;
  onRunValidation: () => void;
  previewReadinessLabel: string;
  readinessSummary: string;
  readinessTone: "good" | "warn" | "error";
  savedTarget: string;
  validationLastRunLabel: string;
  validationRunState: string;
  validationStatus: string;
  validationSummary: string;
  warningIssueCount: number;
}

interface AiProviderBoundaryProps {
  description: string;
  providerLabel: string;
}

interface AiContextSummaryProps {
  detail: string;
  labels: Record<string, string> | null;
  summary: string;
}

interface SavedPromptPackSummary {
  id: string;
  model: string;
  name: string;
  provider: string;
  sceneId: string;
  targetCount: number;
}

interface SavedPromptPacksCardProps {
  packCount: number;
  selectedPromptPack: SavedPromptPackSummary | null;
}

interface WorkflowTemplateSummaryProps {
  family: string;
  hardwareProfile: string;
  notes: string;
  outputNodeId: string;
}

type AssetToolId = "info" | "chroma" | "crop" | "guide" | "animation";

interface AssetStudioSidebarProps {
  activeTool: AssetToolId;
  assetCount: number;
  canImport: boolean;
  onImportAssets: () => void;
  onToolChange: (tool: AssetToolId) => void;
  selectedAssetId: string | null;
}

interface RecoveryBannerProps {
  onDiscard: () => void;
  onRestore: () => void;
}

interface SceneToolPaletteProps {
  activeTool: string;
  disabled: boolean;
  isSceneWorkspace: boolean;
  onToolChange: (tool: string) => void;
}

interface WorkspaceStageToolbarProps {
  activeSceneTool: string;
  badgeLabel: string;
  badgeTone: "good" | "warn" | "error" | "muted";
  canUseSceneTools: boolean;
  detail: string;
  isSceneWorkspace: boolean;
  onSceneToolChange: (tool: string) => void;
  primaryLabel: string;
}

interface WorkspaceStagePanelProps {
  children: ReactNode;
  timeline: ReactNode;
  toolbar: ReactNode;
}

interface WorkspaceTimelineProps {
  diagnosticsCount: number;
  directory: string | null;
  flowCount: number;
  itemCount: number;
  localeCount: number;
  sceneCount: number;
}

function sceneToolFromCapabilityId(capabilityId: string): string | null {
  switch (capabilityId) {
    case "tool-select":
      return "select";
    case "tool-hotspot":
      return "hotspot";
    case "tool-actor":
      return "actor";
    case "tool-pickup":
      return "pickup";
    case "tool-player-start":
      return "player-start";
    case "tool-walk-area":
      return "walk-area";
    default:
      return null;
  }
}

export function StudioTopbar({
  activeWorkspace,
  projectTitle,
  onWorkspaceChange,
  ...actions
}: StudioTopbarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">P/C</span>
        <div>
          <strong>Point & Click Studio</strong>
          <small>{projectTitle}</small>
        </div>
      </div>

      <WorkspaceTabs activeWorkspace={activeWorkspace} onWorkspaceChange={onWorkspaceChange} />

      <TopbarActions {...actions} />
    </header>
  );
}

export function WorkspaceStageToolbar({
  activeSceneTool,
  badgeLabel,
  badgeTone,
  canUseSceneTools,
  detail,
  isSceneWorkspace,
  onSceneToolChange,
  primaryLabel
}: WorkspaceStageToolbarProps) {
  return (
    <div className="canvas-toolbar">
      {isSceneWorkspace ? (
        <SceneToolPalette
          activeTool={activeSceneTool}
          disabled={!canUseSceneTools}
          isSceneWorkspace={isSceneWorkspace}
          onToolChange={onSceneToolChange}
        />
      ) : null}
      <div className="canvas-meta">
        <span className="canvas-meta-primary">{primaryLabel}</span>
        <span>{detail}</span>
        <Badge className="compact" tone={badgeTone}>
          {badgeLabel}
        </Badge>
      </div>
    </div>
  );
}

export function WorkspaceStagePanel({ children, timeline, toolbar }: WorkspaceStagePanelProps) {
  return (
    <section className="canvas-panel panel">
      {toolbar}
      {children}
      {timeline}
    </section>
  );
}

export function WorkspaceTimeline({
  diagnosticsCount,
  directory,
  flowCount,
  itemCount,
  localeCount,
  sceneCount
}: WorkspaceTimelineProps) {
  return (
    <div className="timeline-strip">
      <span>Project</span>
      <div className="timeline-node selected">{sceneCount} scene(s)</div>
      <div className="timeline-node">{flowCount} flow(s)</div>
      <div className="timeline-node">{itemCount} item(s)</div>
      <div className="timeline-node">{localeCount} locale(s)</div>
      <div className="timeline-node">{diagnosticsCount} diagnostic(s)</div>
      <div className="timeline-node">{directory ?? "No folder"}</div>
    </div>
  );
}

export function RecoveryBanner({ onDiscard, onRestore }: RecoveryBannerProps) {
  return (
    <div className="recovery-banner">
      <div>
        <strong>Recovered draft available</strong>
        <small>We found unapplied local edits for this project.</small>
      </div>
      <div className="recovery-actions">
        <Button className="secondary-action" icon={<Trash2 size={iconSize} />} onClick={onDiscard}>
          Discard
        </Button>
        <Button className="play-action" icon={<Undo2 size={iconSize} />} variant="primary" onClick={onRestore}>
          Restore drafts
        </Button>
      </div>
    </div>
  );
}

export function ProjectStartScreen({
  onCreateBlankProject,
  onCreateProjectFromStarter,
  onOpenProject,
  status
}: ProjectStartScreenProps) {
  return (
    <main className="project-start-screen">
      <section className="project-start-panel">
        <span className="overview-label">Project bootstrap</span>
        <strong>Create or open an adventure project</strong>
        <p>{status}</p>
        <div className="project-start-actions">
          <Button
            className="play-action"
            icon={<FilePlus2 size={iconSize} />}
            variant="primary"
            onClick={onCreateProjectFromStarter}
          >
            New From Starter
          </Button>
          <Button className="secondary-action" icon={<Plus size={iconSize} />} onClick={onCreateBlankProject}>
            Blank Project
          </Button>
          <Button className="secondary-action" icon={<FolderOpen size={iconSize} />} onClick={onOpenProject}>
            Open Project
          </Button>
        </div>
      </section>
      <section className="project-start-grid" aria-label="Project creation options">
        <article>
          <span>01</span>
          <strong>Starter</strong>
          <p>Copies the checked-in starter into an empty folder, then opens it ready for scene editing.</p>
        </article>
        <article>
          <span>02</span>
          <strong>Blank</strong>
          <p>Creates a valid minimal project with one layered scene, one locale, and empty asset libraries.</p>
        </article>
        <article>
          <span>03</span>
          <strong>Open</strong>
          <p>Loads any existing folder that contains an `adventure.project.json` manifest.</p>
        </article>
      </section>
    </main>
  );
}

export function ProjectMapPanel({
  children,
  healthDetail,
  healthLabel,
  healthTone,
  onOpenProject
}: ProjectMapPanelProps) {
  return (
    <aside className="project-panel panel">
      <div className="panel-heading">
        <span>Project</span>
        <IconButton label="Open project" onClick={onOpenProject}>
          <FolderOpen size={13} />
        </IconButton>
      </div>
      <div className="tree">{children}</div>
      <div className="project-health">
        <span className={`health-light ${healthTone}`} />
        <div>
          <strong>{healthLabel}</strong>
          <small>{healthDetail}</small>
        </div>
      </div>
    </aside>
  );
}

function creatorPathBadgeLabel(state: CreatorPathStepState) {
  switch (state) {
    case "blocked":
      return "Blocked";
    case "warning":
      return "Review";
    case "pending":
      return "Next";
    case "optional":
      return "Optional";
    case "complete":
      return "Done";
  }
}

function creatorPathBadgeTone(state: CreatorPathStepState) {
  switch (state) {
    case "blocked":
      return "error";
    case "warning":
      return "warn";
    case "complete":
      return "good";
    case "optional":
    case "pending":
      return "muted";
  }
}

function CreatorPathChecklist({
  detail,
  onOpenStep,
  steps,
  title
}: {
  detail: string;
  onOpenStep: (step: CreatorPathStep) => void;
  steps: CreatorPathStep[];
  title: string;
}) {
  return (
    <section className="overview-card creator-path-card">
      <span className="overview-label">Creator path</span>
      <strong>{title}</strong>
      <p>{detail}</p>
      <div className="creator-path-list">
        {steps.map((step) => (
          <div className={`creator-path-step ${step.state}`} key={step.id}>
            <Badge tone={creatorPathBadgeTone(step.state)}>{creatorPathBadgeLabel(step.state)}</Badge>
            <div className="creator-path-step-copy">
              <strong>
                {step.label}
                {step.optional ? <span> Optional</span> : null}
              </strong>
              <p>{step.detail}</p>
            </div>
            <Button className="secondary-action compact-action" onClick={() => onOpenStep(step)}>
              {step.actionLabel}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function WorkspaceOverview({
  assetCount,
  creatorPathSteps,
  diagnostics,
  flowCount,
  hasProjectSettingsChanges,
  localeOptions,
  onOpenAi,
  onOpenAssets,
  onOpenBuild,
  onOpenCreatorPathStep,
  onOpenNarrative,
  onOpenScenes,
  onProjectSettingsChange,
  onSaveProjectSettings,
  previewDescription,
  previewLabel,
  projectSettings,
  projectHealthLabel,
  promptPackCount,
  sceneCount,
  sceneOptions,
  status,
  viewportDescription,
  viewportLabel
}: WorkspaceOverviewProps) {
  return (
    <div className="workspace-overview">
      <section className="overview-card">
        <span className="overview-label">Project command center</span>
        <strong>{projectHealthLabel}</strong>
        <p>{status}</p>
      </section>
      <section className="overview-card">
        <span className="overview-label">Preview target</span>
        <strong>{previewLabel}</strong>
        <p>{previewDescription}</p>
      </section>
      <CreatorPathChecklist
        detail="Follow the minimum production path from project setup to saved validation."
        steps={creatorPathSteps}
        title="Guided production checklist"
        onOpenStep={onOpenCreatorPathStep}
      />
      <section className="overview-card project-structure-card">
        <span className="overview-label">Project structure</span>
        <strong>Open a workspace</strong>
        <div className="project-jump-grid" aria-label="Project workspace shortcuts">
          <button type="button" onClick={onOpenScenes}>
            <span>{sceneCount}</span>
            <strong>Scenes</strong>
            <small>Scene hierarchy and viewport</small>
          </button>
          <button type="button" onClick={onOpenAssets}>
            <span>{assetCount}</span>
            <strong>Assets</strong>
            <small>Library, usage, cleanup</small>
          </button>
          <button type="button" onClick={onOpenNarrative}>
            <span>{flowCount}</span>
            <strong>Narrative</strong>
            <small>Flows and locale strings</small>
          </button>
          <button type="button" onClick={onOpenAi}>
            <span>{promptPackCount}</span>
            <strong>AI Studio</strong>
            <small>Briefs, recipes, generation</small>
          </button>
          <button type="button" onClick={onOpenBuild}>
            <span>{diagnostics.length}</span>
            <strong>Build</strong>
            <small>Diagnostics and readiness</small>
          </button>
        </div>
      </section>
      <section className="overview-card project-settings-card">
        <span className="overview-label">Project settings</span>
        <strong>Game identity and entry point</strong>
        <div className="project-settings-grid">
          <label>
            <span>Title</span>
            <input
              type="text"
              value={projectSettings.title}
              onChange={(event) => onProjectSettingsChange("title", event.target.value)}
            />
          </label>
          <label>
            <span>Initial scene</span>
            <select
              value={projectSettings.initialSceneId}
              onChange={(event) => onProjectSettingsChange("initialSceneId", event.target.value)}
            >
              {sceneOptions.map((scene) => (
                <option key={scene.id} value={scene.id}>
                  {scene.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Default locale</span>
            <select
              value={projectSettings.defaultLocale}
              onChange={(event) => onProjectSettingsChange("defaultLocale", event.target.value)}
            >
              {localeOptions.map((locale) => (
                <option key={locale.id} value={locale.id}>
                  {locale.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Viewport width</span>
            <input
              min={320}
              step={1}
              type="number"
              value={projectSettings.viewportWidth}
              onChange={(event) => onProjectSettingsChange("viewportWidth", event.target.value)}
            />
          </label>
          <label>
            <span>Viewport height</span>
            <input
              min={180}
              step={1}
              type="number"
              value={projectSettings.viewportHeight}
              onChange={(event) => onProjectSettingsChange("viewportHeight", event.target.value)}
            />
          </label>
        </div>
        <div className="build-actions">
          <Button
            className="play-action compact-action"
            disabled={!hasProjectSettingsChanges}
            variant="primary"
            onClick={onSaveProjectSettings}
          >
            Apply settings
          </Button>
        </div>
      </section>
      <section className="overview-card">
        <span className="overview-label">Viewport authoring</span>
        <strong>{viewportLabel}</strong>
        <p>{viewportDescription}</p>
      </section>
      <section className="overview-card">
        <span className="overview-label">Capabilities</span>
        <div className="capability-list">
          {workspaceCapabilities.map((item) => (
            <div className="capability-card" key={item.id}>
              <div>
                <strong>{item.label}</strong>
                <p>{item.summary}</p>
              </div>
              <Badge tone={capabilityStatusTone(item.status)}>
                {capabilityBadgeLabel(item.status)}
              </Badge>
            </div>
          ))}
        </div>
      </section>
      <section className="overview-card">
        <span className="overview-label">Diagnostics</span>
        <div className="diagnostic-list">
          {diagnostics.length ? (
            diagnostics.slice(0, 6).map((diagnostic, index) => (
              <div className={`diagnostic-item ${diagnostic.severity}`} key={`${diagnostic.code}-${index}`}>
                <strong>{diagnostic.code}</strong>
                <p>{diagnostic.message}</p>
              </div>
            ))
          ) : (
            <p>No project diagnostics right now.</p>
          )}
        </div>
        <div className="build-actions">
          <Button className="secondary-action compact-action" onClick={onOpenBuild}>
            Open Build
          </Button>
        </div>
      </section>
    </div>
  );
}

function readinessBadgeLabel(tone: BuildWorkspaceProps["readinessTone"]) {
  if (tone === "error") return "Blocked";
  if (tone === "warn") return "Review";
  return "Ready";
}

function readinessDescription({
  blockingIssueCount,
  dirtyDraftCount,
  warningIssueCount
}: Pick<BuildWorkspaceProps, "blockingIssueCount" | "dirtyDraftCount" | "warningIssueCount">) {
  if (blockingIssueCount > 0) {
    return "Resolve blocking saved-project diagnostics before relying on preview.";
  }
  if (warningIssueCount > 0) {
    return "Preview can run, but these saved-project warnings should be reviewed.";
  }
  if (dirtyDraftCount > 0) {
    return "Preview can include draft changes, while validation still reflects saved files.";
  }
  return "Saved validation and preview target currently match.";
}

export function BuildWorkspace({
  blockingIssueCount,
  creatorPathSteps,
  dirtyDraftCount,
  issues,
  onOpenCreatorPathStep,
  onRunValidation,
  previewReadinessLabel,
  readinessSummary,
  readinessTone,
  savedTarget,
  validationLastRunLabel,
  validationRunState,
  validationStatus,
  validationSummary,
  warningIssueCount
}: BuildWorkspaceProps) {
  return (
    <div className="workspace-overview build-workspace">
      <section className={`overview-card build-readiness-card ${readinessTone}`}>
        <div>
          <span className="overview-label">Preview readiness</span>
          <strong>{readinessSummary}</strong>
          <p>{readinessDescription({ blockingIssueCount, dirtyDraftCount, warningIssueCount })}</p>
        </div>
        <Badge tone={readinessTone}>{readinessBadgeLabel(readinessTone)}</Badge>
      </section>
      <section className="overview-card">
        <span className="overview-label">Project validation</span>
        <strong>{validationSummary}</strong>
        <p>{validationStatus}</p>
        <div className="build-actions">
          <Button
            className="play-action"
            disabled={validationRunState === "running"}
            icon={<Play size={iconSize} />}
            variant="primary"
            onClick={onRunValidation}
          >
            {validationRunState === "running" ? "Validating..." : "Validate Project"}
          </Button>
        </div>
      </section>
      <section className="overview-card">
        <span className="overview-label">Validation freshness</span>
        <strong>{previewReadinessLabel}</strong>
        <p>
          {dirtyDraftCount > 0
            ? `${dirtyDraftCount} draft change(s) exist outside saved-file validation.`
            : "Saved validation and preview target currently match."}
        </p>
        <p className="diagnostic-meta">Last run: {validationLastRunLabel}</p>
        <p className="diagnostic-meta">Saved target: {savedTarget}</p>
      </section>
      <CreatorPathChecklist
        detail="Use this as the handoff gate for the whole game, including optional AI production."
        steps={creatorPathSteps}
        title="Production readiness path"
        onOpenStep={onOpenCreatorPathStep}
      />
      <section className="overview-card build-issues-card">
        <span className="overview-label">Action checklist</span>
        <strong>{issues.length || dirtyDraftCount > 0 ? "Issues to review" : "No diagnostics found for the saved project"}</strong>
        <div className="diagnostic-list readiness-list">
          {dirtyDraftCount > 0 ? (
            <div className="diagnostic-item warning readiness-item">
              <div>
                <strong>Unsaved draft changes</strong>
                <p>{dirtyDraftCount} draft change(s) can be previewed, but validation uses saved files.</p>
              </div>
              <Badge tone="warn">Draft</Badge>
            </div>
          ) : null}
          {issues.length ? (
            issues.map((issue) => (
              <div className={`diagnostic-item ${issue.severity} readiness-item`} key={issue.id}>
                <div>
                  <strong>{issue.code}</strong>
                  <p>{issue.message}</p>
                  {issue.path ? <p className="diagnostic-meta">{issue.path}</p> : null}
                </div>
                <div className="readiness-actions">
                  <Badge tone={issue.severity === "error" ? "warn" : "muted"}>{issue.severity}</Badge>
                  {issue.actionLabel ? (
                    <Button
                      className="secondary-action compact-action"
                      disabled={!issue.canOpen}
                      onClick={issue.onOpen}
                    >
                      {issue.actionLabel}
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          ) : dirtyDraftCount === 0 ? (
            <p>No diagnostics found for the saved project.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export function AiProviderBoundary({ description, providerLabel }: AiProviderBoundaryProps) {
  return (
    <section className="overview-card">
      <span className="overview-label">Provider boundary</span>
      <strong>{providerLabel}</strong>
      <p>{description}</p>
      <div className="diagnostic-list">
        <div className="diagnostic-item">
          <div>
            <strong>ChatGPT Plus</strong>
            <p>Plus/Codex subscriptions do not replace API platform billing for app calls.</p>
          </div>
        </div>
        <div className="diagnostic-item">
          <div>
            <strong>Project mutation</strong>
            <p>Generation never writes files until you approve and save the pack.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AiContextSummary({ detail, labels, summary }: AiContextSummaryProps) {
  return (
    <section className="overview-card">
      <span className="overview-label">Extracted context</span>
      <strong>{summary}</strong>
      <p>{detail}</p>
      {labels ? (
        <div className="prompt-chip-list">
          {Object.entries(labels).map(([key, value]) => (
            <span className="prompt-chip" key={`ai-context-${key}`} title={key}>
              {value}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function SavedPromptPacksCard({ packCount, selectedPromptPack }: SavedPromptPacksCardProps) {
  return (
    <section className="overview-card">
      <span className="overview-label">Saved prompt packs</span>
      <strong>{packCount} pack(s)</strong>
      <p>
        {selectedPromptPack
          ? `${selectedPromptPack.id} targets ${selectedPromptPack.sceneId}`
          : "Approved packs will be written under project prompt-packs."}
      </p>
      {selectedPromptPack ? (
        <div className="diagnostic-list">
          <div className="diagnostic-item">
            <div>
              <strong>{selectedPromptPack.name}</strong>
              <p>{selectedPromptPack.provider} - {selectedPromptPack.model}</p>
            </div>
            <Badge tone="good">{selectedPromptPack.targetCount} target(s)</Badge>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function WorkflowTemplateSummary({
  family,
  hardwareProfile,
  notes,
  outputNodeId
}: WorkflowTemplateSummaryProps) {
  return (
    <div className="workflow-template-summary">
      <span className="prompt-chip">{family}</span>
      <span className="prompt-chip">{hardwareProfile}</span>
      <span className="prompt-chip">output {outputNodeId}</span>
      <p>{notes}</p>
    </div>
  );
}

export function AssetStudioSidebar({
  activeTool,
  assetCount,
  canImport,
  onImportAssets,
  onToolChange,
  selectedAssetId
}: AssetStudioSidebarProps) {
  const assetTools: Array<{ icon: typeof Image; id: AssetToolId; label: string }> = [
    { icon: Image, id: "info", label: "Info" },
    { icon: Eraser, id: "chroma", label: "Chroma Key" },
    { icon: Scissors, id: "crop", label: "Crop" },
    { icon: Crosshair, id: "guide", label: "Generation Guide" },
    { icon: Package, id: "animation", label: "Animation Pack" }
  ];

  return (
    <div className="asset-studio-sidebar">
      <span className="overview-label">Asset Studio</span>
      <strong>{assetCount} asset(s)</strong>
      <p>{selectedAssetId ?? "Import or select an image asset."}</p>
      <Button
        className="play-action compact-action"
        disabled={!canImport}
        icon={<Image size={iconSize} />}
        variant="primary"
        onClick={onImportAssets}
      >
        Import Assets
      </Button>
      <div className="asset-tool-rail" role="tablist" aria-label="Asset tools">
        {assetTools.map((tool) => {
          const ToolIcon = tool.icon;
          return (
            <button
              className={activeTool === tool.id ? "active" : ""}
              key={`asset-tool-${tool.id}`}
              type="button"
              onClick={() => onToolChange(tool.id)}
            >
              <ToolIcon size={iconSize} /> {tool.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function InspectorPanel({ children, detail }: InspectorPanelProps) {
  return (
    <aside className="inspector-panel panel">
      <div className="panel-heading">
        <span>Inspector</span>
        <small>{detail}</small>
      </div>
      <div className="inspector-content">{children}</div>
    </aside>
  );
}

export function SceneToolPalette({
  activeTool,
  disabled,
  isSceneWorkspace,
  onToolChange
}: SceneToolPaletteProps) {
  return (
    <div className="toolset" aria-label="Scene tools">
      {toolCapabilities.map((tool) => {
        const sceneTool = sceneToolFromCapabilityId(tool.id);
        return (
          <button
            className={sceneTool === activeTool && isSceneWorkspace ? "active" : ""}
            disabled={tool.status === "planned" || disabled || !isSceneWorkspace}
            key={tool.id}
            title={`${capabilityBadgeLabel(tool.status)}: ${tool.detail}`}
            type="button"
            onClick={() => {
              if (sceneTool) onToolChange(sceneTool);
            }}
          >
            <SceneToolIcon toolId={tool.id} />
            <span>{tool.label}</span>
          </button>
        );
      })}
    </div>
  );
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
        <IconButton className="icon-action" disabled={!canUndo} label="Undo" onClick={onUndo}>
          <Undo2 size={iconSize} />
        </IconButton>
        <IconButton className="icon-action" disabled={!canRedo} label="Redo" onClick={onRedo}>
          <Redo2 size={iconSize} />
        </IconButton>
      </div>
      <div className="action-cluster project-cluster" aria-label="Project actions">
        <details className="project-action-menu">
          <summary>
            <FolderOpen size={iconSize} />
            Project
          </summary>
          <div className="project-action-menu-popover">
            <Button className="secondary-action compact-action" icon={<FolderOpen size={iconSize} />} onClick={onOpenProject}>
              Open Project
            </Button>
            <Button className="secondary-action compact-action" icon={<FilePlus2 size={iconSize} />} onClick={onCreateProjectFromStarter}>
              New From Starter
            </Button>
            <Button className="secondary-action compact-action" icon={<Plus size={iconSize} />} onClick={onCreateBlankProject}>
              Blank Project
            </Button>
          </div>
        </details>
      </div>
      <div className="action-cluster run-cluster" aria-label="Preview actions">
        <Button className="secondary-action compact-action" disabled={!hasProject} icon={<ExternalLink size={iconSize} />} onClick={onOpenBrowser}>
          Browser
        </Button>
        <Button className="play-action compact-action" disabled={!hasProject} icon={<Play size={iconSize} />} variant="primary" onClick={onPlay}>
          {isDirty ? "Draft Preview" : "Play Project"}
        </Button>
      </div>
    </div>
  );
}

export { toolCapabilities };
