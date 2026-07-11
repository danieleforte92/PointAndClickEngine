import type { Layered2DScene, ProjectBundle } from "@pointclick/contracts";

export type AuthoringSuggestionKind = "narrative" | "puzzle";

export interface AuthoringSuggestionContext {
  bundle: ProjectBundle;
  sceneId?: string;
}

export interface AuthoringProposal {
  kind: "dialogue" | "flag" | "item-use" | "scene-transition";
  summary: string;
}

export interface AuthoringSuggestion {
  contextHash: string;
  id: string;
  kind: AuthoringSuggestionKind;
  proposals: AuthoringProposal[];
  rationale: string;
  title: string;
  warnings: string[];
}

export interface AuthoringProvider {
  suggest(context: AuthoringSuggestionContext): Promise<AuthoringSuggestion[]>;
}

function fingerprint(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function selectedScene(context: AuthoringSuggestionContext): Layered2DScene | undefined {
  const selected = context.sceneId ? context.bundle.scenes[context.sceneId] : undefined;
  if (selected?.type === "layered-2d") return selected;
  const initial = context.bundle.scenes[context.bundle.manifest.initialSceneId];
  return initial?.type === "layered-2d" ? initial : undefined;
}

export const mockAuthoringProvider: AuthoringProvider = {
  async suggest(context) {
    const scene = selectedScene(context);
    if (!scene) return [];
    const contextHash = fingerprint(JSON.stringify({
      scene,
      items: context.bundle.items,
      title: context.bundle.manifest.title
    }));
    const label = scene.name || scene.id;
    const firstHotspot = scene.hotspots[0];
    const firstPickup = scene.pickups[0];
    const suggestions: AuthoringSuggestion[] = [];

    if (firstHotspot) {
      suggestions.push({
        contextHash,
        id: `${scene.id}-narrative-beat`,
        kind: "narrative",
        title: `Give ${label} a readable interaction beat`,
        rationale: `The scene already exposes hotspot "${firstHotspot.id}". A short look or talk line makes the player understand why it matters before solving anything.`,
        proposals: [
          { kind: "dialogue", summary: `Add a localized look line for ${firstHotspot.id}.` },
          { kind: "flag", summary: `Set a discovery flag only after the line is acknowledged.` }
        ],
        warnings: ["Review the wording and create the final Flow JSON before saving."]
      });
    }

    if (firstPickup) {
      suggestions.push({
        contextHash,
        id: `${scene.id}-puzzle-loop`,
        kind: "puzzle",
        title: `Connect ${firstPickup.id} to one visible obstacle`,
        rationale: `The project contains a collectible item, which supports a deterministic discover → collect → use loop without runtime AI.`,
        proposals: [
          { kind: "item-use", summary: `Add one explicit item-use flow for ${firstPickup.itemId}.` },
          { kind: "flag", summary: "Gate the resolved obstacle with a named boolean flag." },
          { kind: "scene-transition", summary: "Reveal a scene transition or new interaction after the flag is set." }
        ],
        warnings: ["Keep every proposed result expressible through items, flags, and Flow nodes in schema v1."]
      });
    }

    return suggestions;
  }
};
