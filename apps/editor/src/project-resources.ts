import type {
  AnimationPackDocument,
  AssetDocument,
  AssetGenerationRecipeDocument,
  FlowDocument,
  ItemDocument,
  LocaleDocument,
  ProjectManifest,
  PromptPackDocument,
  SceneDocument,
  StyleBibleDocument,
  WorkflowTemplateDocument
} from "@pointclick/contracts";
import type { ProjectDiagnostic } from "@pointclick/project-io";
import type { EditorNavigationTarget } from "./editor-session";

export type ProjectResourceKind =
  | "scene"
  | "image"
  | "audio"
  | "animation-pack"
  | "flow"
  | "locale"
  | "item"
  | "prompt-pack"
  | "style-bible"
  | "workflow-template"
  | "generation-recipe";

export type ProjectResourceHealth = "healthy" | "warning" | "error";

export interface ProjectResourceUse {
  detail: string;
  ownerId: string;
  target: EditorNavigationTarget;
}

/** Federated, derived resource representation. It is never written to project files. */
export interface ProjectResourceDescriptor {
  health: ProjectResourceHealth;
  id: string;
  kind: ProjectResourceKind;
  label: string;
  owner: EditorNavigationTarget;
  path: string | undefined;
  searchText: string;
  uses: ProjectResourceUse[];
}

export interface ProjectResourceSource {
  animationPacks: AnimationPackDocument[];
  assets: AssetDocument[];
  diagnostics: ProjectDiagnostic[];
  flows: FlowDocument[];
  generationRecipes: AssetGenerationRecipeDocument[];
  items: ItemDocument[];
  locales: LocaleDocument[];
  manifest: ProjectManifest;
  promptPacks: PromptPackDocument[];
  scenes: SceneDocument[];
  styleBibles: StyleBibleDocument[];
  workflowTemplates: WorkflowTemplateDocument[];
}

function healthFor(id: string, diagnostics: readonly ProjectDiagnostic[]): ProjectResourceHealth {
  const matching = diagnostics.filter((diagnostic) => diagnostic.documentId === id);
  if (matching.some((diagnostic) => diagnostic.severity === "error")) return "error";
  if (matching.length > 0) return "warning";
  return "healthy";
}

function manifestPath(
  entries: readonly { id: string; path: string }[] | undefined,
  id: string
): string | undefined {
  return entries?.find((entry) => entry.id === id)?.path;
}

function manifestLocalePath(
  entries: readonly { locale: string; path: string }[] | undefined,
  locale: string
): string | undefined {
  return entries?.find((entry) => entry.locale === locale)?.path;
}

function descriptor(
  diagnostics: readonly ProjectDiagnostic[],
  value: Omit<ProjectResourceDescriptor, "health" | "searchText">
): ProjectResourceDescriptor {
  return {
    ...value,
    health: healthFor(value.id, diagnostics),
    searchText: `${value.id} ${value.label} ${value.kind} ${value.path ?? ""}`.toLocaleLowerCase()
  };
}

function assetUses(asset: AssetDocument, source: ProjectResourceSource): ProjectResourceUse[] {
  const uses: ProjectResourceUse[] = [];
  for (const scene of source.scenes) {
    if (scene.type !== "layered-2d") continue;
    const target = (detail: string): ProjectResourceUse => ({
      detail,
      ownerId: scene.id,
      target: { workspace: "scene", sceneId: scene.id }
    });
    if (scene.background === asset.path) uses.push(target("Scene background"));
    if (scene.player?.assetId === asset.id) uses.push(target("Player art"));
    for (const layer of scene.layers ?? []) {
      if (layer.assetId === asset.id) uses.push(target(`Layer · ${layer.name}`));
    }
    for (const actor of scene.actors) {
      if (actor.assetId === asset.id) {
        uses.push({ ...target(`Actor · ${actor.id}`), target: { workspace: "scene", sceneId: scene.id, entityKind: "actor", entityId: actor.id } });
      }
    }
    for (const pickup of scene.pickups) {
      if (pickup.assetId === asset.id) {
        uses.push({ ...target(`Pickup · ${pickup.id}`), target: { workspace: "scene", sceneId: scene.id, entityKind: "pickup", entityId: pickup.id } });
      }
    }
  }
  for (const flow of source.flows) {
    for (const node of flow.nodes) {
      if (asset.kind === "audio" && node.type === "cue" && node.cue.type === "sound" && node.cue.key === asset.id) {
        uses.push({ detail: `Sound cue · ${node.id}`, ownerId: flow.id, target: { workspace: "narrative", flowId: flow.id } });
      }
    }
  }
  return uses;
}

export function buildProjectResourceIndex(source: ProjectResourceSource): ProjectResourceDescriptor[] {
  const diagnostics = source.diagnostics;
  const resources: ProjectResourceDescriptor[] = [];

  for (const scene of source.scenes) {
    resources.push(descriptor(diagnostics, {
      id: scene.id,
      kind: "scene",
      label: scene.name,
      owner: { workspace: "scene", sceneId: scene.id },
      path: manifestPath(source.manifest.scenes, scene.id),
      uses: []
    }));
  }
  for (const asset of source.assets) {
    resources.push(descriptor(diagnostics, {
      id: asset.id,
      kind: asset.kind,
      label: asset.id,
      owner: { workspace: "assets", assetId: asset.id },
      path: asset.path,
      uses: assetUses(asset, source)
    }));
  }
  for (const flow of source.flows) {
    resources.push(descriptor(diagnostics, {
      id: flow.id,
      kind: "flow",
      label: flow.name,
      owner: { workspace: "narrative", flowId: flow.id },
      path: manifestPath(source.manifest.flows, flow.id),
      uses: []
    }));
  }
  for (const locale of source.locales) {
    resources.push(descriptor(diagnostics, {
      id: locale.locale,
      kind: "locale",
      label: locale.locale.toUpperCase(),
      owner: { workspace: "narrative" },
      path: manifestLocalePath(source.manifest.locales, locale.locale),
      uses: []
    }));
  }
  for (const item of source.items) {
    resources.push(descriptor(diagnostics, {
      id: item.id,
      kind: "item",
      label: item.name,
      owner: { workspace: "narrative" },
      path: manifestPath(source.manifest.items, item.id),
      uses: []
    }));
  }

  const specialized: Array<{
    id: string;
    kind: ProjectResourceKind;
    label: string;
    owner: EditorNavigationTarget;
    path: string | undefined;
  }> = [
    ...source.animationPacks.map((entry) => ({ id: entry.id, kind: "animation-pack" as const, label: entry.name, owner: { workspace: "assets" as const }, path: manifestPath(source.manifest.animationPacks, entry.id) })),
    ...source.promptPacks.map((entry) => ({ id: entry.id, kind: "prompt-pack" as const, label: entry.name, owner: { workspace: "ai" as const, sceneId: entry.sceneId }, path: manifestPath(source.manifest.promptPacks, entry.id) })),
    ...source.styleBibles.map((entry) => ({ id: entry.id, kind: "style-bible" as const, label: entry.name, owner: { workspace: "ai" as const }, path: manifestPath(source.manifest.styleBibles, entry.id) })),
    ...source.workflowTemplates.map((entry) => ({ id: entry.id, kind: "workflow-template" as const, label: entry.name, owner: { workspace: "ai" as const }, path: manifestPath(source.manifest.workflowTemplates, entry.id) })),
    ...source.generationRecipes.map((entry) => ({
      id: entry.id,
      kind: "generation-recipe" as const,
      label: entry.id,
      owner: { workspace: "ai" as const, ...(entry.sceneId ? { sceneId: entry.sceneId } : {}) },
      path: manifestPath(source.manifest.generationRecipes, entry.id)
    }))
  ];
  for (const entry of specialized) {
    resources.push(descriptor(diagnostics, { ...entry, uses: [] }));
  }

  return resources.sort((left, right) => left.kind.localeCompare(right.kind) || left.label.localeCompare(right.label));
}

export function filterProjectResources(
  resources: readonly ProjectResourceDescriptor[],
  query: string,
  kinds: ReadonlySet<ProjectResourceKind> = new Set()
): ProjectResourceDescriptor[] {
  const normalized = query.trim().toLocaleLowerCase();
  return resources.filter((resource) => {
    if (kinds.size > 0 && !kinds.has(resource.kind)) return false;
    return !normalized || resource.searchText.includes(normalized);
  });
}
