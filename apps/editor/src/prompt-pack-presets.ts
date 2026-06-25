export interface PromptPresetBlock {
  id: string;
  label: string;
  value: string;
  negative?: string;
}

export interface SceneDirectionPreset {
  id: string;
  label: string;
  artBrief: string;
  gameplayEmphasis: string[];
  moodPreset: string;
  palettePreset: string;
  settingPreset: string;
  visualStylePreset: string;
}

export interface ComfyOutputPreset {
  id: string;
  label: string;
  height: number;
  timeoutMinutes: number;
  useCase: string;
  width: number;
}

export const visualStylePresets: PromptPresetBlock[] = [
  {
    id: "classic_comic_adventure_original",
    label: "Classic Comic Adventure - Original IP",
    value:
      "Hand-painted 2D comedic point-and-click adventure game aesthetic, expressive cartoon shapes, readable silhouettes, slightly exaggerated proportions, warm painterly lighting, whimsical pirate-fantasy mood, original IP, not based on any existing franchise.",
    negative:
      "no existing franchise characters, no Monkey Island characters, no LucasArts logos, no copyrighted characters, no readable text, no UI, no photorealism, no 3D render look"
  },
  {
    id: "storybook_painterly",
    label: "Painterly Storybook",
    value:
      "Painterly 2D storybook illustration style, soft brush strokes, rich atmosphere, charming hand-made imperfections, warm cinematic composition, readable game-ready shapes.",
    negative: "no photorealism, no overly detailed noise, no hard sci-fi elements, no UI, no text"
  },
  {
    id: "clean_cartoon_game_asset",
    label: "Clean Cartoon Game Asset",
    value:
      "Clean 2D cartoon game asset style, crisp silhouettes, simple shading, controlled color palette, transparent-background friendly, suitable for modular game objects and animation sprites.",
    negative: "no painterly background, no clutter, no dramatic camera angle, no text, no UI, no merged objects"
  },
  {
    id: "dark_cozy_pirate_mystery",
    label: "Dark Cozy Pirate Mystery",
    value:
      "Cozy mysterious pirate adventure aesthetic, moonlit colors, warm lantern highlights, foggy atmosphere, humorous but slightly eerie mood, hand-painted 2D adventure game look.",
    negative: "no horror gore, no realistic violence, no grimdark tone, no photorealism, no unreadable darkness"
  }
];

export const moodPresets: PromptPresetBlock[] = [
  {
    id: "comic_mystery",
    label: "Comic Mystery",
    value:
      "Funny, suspicious, slightly mysterious, full of visual jokes and odd details, but still readable as a puzzle scene."
  },
  {
    id: "warm_adventure",
    label: "Warm Adventure",
    value: "Warm, adventurous, inviting, playful, colorful, with a sense of discovery and light comedy."
  },
  {
    id: "moonlit_intrigue",
    label: "Moonlit Intrigue",
    value: "Moonlit, quiet, secretive, atmospheric, with blue shadows and warm lantern accents."
  },
  {
    id: "chaotic_harbor_comedy",
    label: "Chaotic Harbor Comedy",
    value:
      "Busy but readable harbor comedy mood, crooked props, silly signs without readable text, eccentric details, exaggerated shapes."
  },
  {
    id: "cozy_tavern",
    label: "Cozy Tavern",
    value:
      "Warm indoor tavern mood, candlelight, wood textures, cozy clutter, comic pirate atmosphere, inviting but full of suspicious objects."
  }
];

export const settingPresets: PromptPresetBlock[] = [
  {
    id: "moonlit_dock",
    label: "Moonlit Dock",
    value:
      "A small crooked wooden dock at night, moonlit sea, distant island silhouettes, ropes, barrels, lanterns, fishing nets, tavern entrance, clear walkable area in the lower half of the scene."
  },
  {
    id: "sunset_harbor",
    label: "Sunset Harbor",
    value:
      "A warm pirate harbor at sunset, orange and purple sky, wooden piers, old boats, tavern entrance, sea breeze, comic props, readable adventure-game layout."
  },
  {
    id: "tavern_interior",
    label: "Tavern Interior",
    value:
      "A crooked pirate tavern interior, wooden beams, candlelit tables, strange bottles, old maps, locked back door, suspicious counter, cozy but comedic atmosphere."
  },
  {
    id: "foggy_market",
    label: "Foggy Market",
    value:
      "A small foggy pirate market street, canvas stalls, odd merchants, hanging lanterns, crates, fish baskets, narrow walkable path, puzzle-friendly prop placement."
  },
  {
    id: "jungle_ruins",
    label: "Jungle Ruins",
    value:
      "A comic tropical jungle ruin, oversized leaves, broken stone doorway, ancient pirate markings without readable text, vines, hidden path, foreground foliage for occlusion."
  }
];

export const palettePresets: PromptPresetBlock[] = [
  {
    id: "moon_blue_lantern_gold",
    label: "Moon Blue + Lantern Gold",
    value:
      "Deep navy blue shadows, muted teal sea tones, warm golden lantern highlights, pale moonlight, small accents of rusty orange."
  },
  {
    id: "sunset_orange_purple",
    label: "Sunset Orange + Purple",
    value: "Warm sunset oranges, soft purples, dusty pink sky, dark brown wood, turquoise sea accents."
  },
  {
    id: "tavern_amber_wood",
    label: "Tavern Amber + Wood",
    value: "Amber candlelight, dark walnut wood, red cloth accents, brass details, warm shadows, cozy interior contrast."
  },
  {
    id: "foggy_teal_gray",
    label: "Foggy Teal + Gray",
    value:
      "Muted teal fog, blue-gray shadows, desaturated wood, pale yellow lanterns, low contrast background with readable foreground props."
  },
  {
    id: "jungle_green_gold",
    label: "Jungle Green + Gold",
    value:
      "Layered jungle greens, mossy stone gray, warm golden sunlight accents, saturated flowers as small color pops."
  }
];

export const gameplayEmphasisPresets: PromptPresetBlock[] = [
  {
    id: "puzzle_readability",
    label: "Puzzle Readability",
    value:
      "Prioritize clear readable hotspots, uncluttered object silhouettes, obvious interaction areas, and a clean walkable zone."
  },
  {
    id: "exploration_atmosphere",
    label: "Exploration Atmosphere",
    value:
      "Prioritize mood, environmental storytelling, hidden details, layered depth, and a sense of place while keeping the scene playable."
  },
  {
    id: "dialogue_npc_focus",
    label: "Dialogue / NPC Focus",
    value:
      "Leave clear staging space for one or two characters, with a readable background and enough negative space for dialogue composition."
  },
  {
    id: "inventory_puzzle_scene",
    label: "Inventory Puzzle Scene",
    value:
      "Include several distinct props that can become inventory items or interactive hotspots, each visually separated and easy to isolate."
  },
  {
    id: "walkable_2_5d_depth",
    label: "2.5D Walkable Depth",
    value:
      "Design the scene with clear foreground, midground, background, occlusion objects, and a walkable area that supports character scaling by vertical position."
  }
];

export const sceneDirectionPresets: SceneDirectionPreset[] = [
  {
    id: "moonlit_dock_adventure",
    label: "Moonlit Dock Adventure",
    visualStylePreset: "classic_comic_adventure_original",
    moodPreset: "moonlit_intrigue",
    settingPreset: "moonlit_dock",
    palettePreset: "moon_blue_lantern_gold",
    gameplayEmphasis: ["puzzle_readability", "inventory_puzzle_scene", "walkable_2_5d_depth"],
    artBrief:
      "A moonlit pirate dock for a comedic point-and-click adventure. The scene should feel mysterious, charming, and puzzle-ready, with clear hotspots, warm lanterns, layered depth, and a readable walkable area."
  },
  {
    id: "sunset_harbor_comedy",
    label: "Sunset Harbor Comedy",
    visualStylePreset: "classic_comic_adventure_original",
    moodPreset: "chaotic_harbor_comedy",
    settingPreset: "sunset_harbor",
    palettePreset: "sunset_orange_purple",
    gameplayEmphasis: ["puzzle_readability", "exploration_atmosphere", "inventory_puzzle_scene"],
    artBrief:
      "A warm and funny pirate harbor scene with crooked wooden structures, visual jokes, exaggerated props, and clear interaction zones for a classic point-and-click adventure."
  },
  {
    id: "cozy_tavern_puzzle_room",
    label: "Cozy Tavern Puzzle Room",
    visualStylePreset: "classic_comic_adventure_original",
    moodPreset: "cozy_tavern",
    settingPreset: "tavern_interior",
    palettePreset: "tavern_amber_wood",
    gameplayEmphasis: ["dialogue_npc_focus", "inventory_puzzle_scene", "puzzle_readability"],
    artBrief:
      "A warm crooked pirate tavern interior designed as a dialogue and inventory puzzle room. It should include readable props, space for NPC staging, cozy lighting, and humorous environmental details."
  },
  {
    id: "foggy_market_investigation",
    label: "Foggy Market Investigation",
    visualStylePreset: "dark_cozy_pirate_mystery",
    moodPreset: "comic_mystery",
    settingPreset: "foggy_market",
    palettePreset: "foggy_teal_gray",
    gameplayEmphasis: ["exploration_atmosphere", "inventory_puzzle_scene", "puzzle_readability"],
    artBrief:
      "A foggy pirate market street for a comedic mystery sequence. The layout should support exploration, suspicious merchants, readable props, and inventory-based puzzle interactions."
  }
];

export const pointClickCoreNegativePrompt =
  "photorealistic, realistic 3D render, anime, manga, pixel art, low resolution, blurry, noisy, muddy details, unreadable clutter, bad perspective, inconsistent scale, inconsistent lighting, extra limbs, malformed hands, duplicate character, modern objects, sci-fi objects, guns, gore, horror, UI elements, subtitles, text, logos, watermarks, signature, existing franchise character, copyrighted character, Monkey Island character, LucasArts logo";

export const comfyOutputPresets: ComfyOutputPreset[] = [
  {
    id: "target_default",
    label: "Target Default",
    width: 0,
    height: 0,
    timeoutMinutes: 20,
    useCase: "Use the prompt-pack target dimensions."
  },
  {
    id: "room_background_hd",
    label: "Room Background HD",
    width: 1536,
    height: 864,
    timeoutMinutes: 7,
    useCase: "16:9 point-and-click room backgrounds."
  },
  {
    id: "fast_draft_square",
    label: "Fast Draft Square",
    width: 1024,
    height: 1024,
    timeoutMinutes: 3,
    useCase: "Quick visual tests, props, icons, and rough concepts."
  },
  {
    id: "prop_sheet_large",
    label: "Prop Sheet Large",
    width: 2048,
    height: 2048,
    timeoutMinutes: 10,
    useCase: "Large isolated prop sheets for later slicing."
  },
  {
    id: "character_portrait_tall",
    label: "Character Portrait Tall",
    width: 1024,
    height: 1536,
    timeoutMinutes: 7,
    useCase: "Full-body characters on chroma key background."
  }
];

export const defaultPromptPresetSelection = {
  sceneDirectionPreset: "moonlit_dock_adventure",
  visualStylePreset: "classic_comic_adventure_original",
  moodPreset: "moonlit_intrigue",
  settingPreset: "moonlit_dock",
  palettePreset: "moon_blue_lantern_gold",
  gameplayEmphasisPresets: ["puzzle_readability", "inventory_puzzle_scene", "walkable_2_5d_depth"],
  comfyOutputPreset: "room_background_hd"
};

function findPreset(presets: PromptPresetBlock[], id: string) {
  return presets.find((preset) => preset.id === id) ?? null;
}

export function sceneDirectionPresetById(id: string) {
  return sceneDirectionPresets.find((preset) => preset.id === id) ?? null;
}

export function comfyOutputPresetById(id: string) {
  return comfyOutputPresets.find((preset) => preset.id === id) ?? comfyOutputPresets[0]!;
}

export function buildGuidedArtBrief(
  baseBrief: string,
  guidedAnswers: {
    customGameplayFocus: string;
    customMood: string;
    customPalette: string;
    customSetting: string;
    customStyle: string;
    gameplayEmphasisPresetIds: string[];
    moodPresetId: string;
    palettePresetId: string;
    settingPresetId: string;
    visualStylePresetId: string;
  }
) {
  const visualStyle = findPreset(visualStylePresets, guidedAnswers.visualStylePresetId);
  const mood = findPreset(moodPresets, guidedAnswers.moodPresetId);
  const setting = findPreset(settingPresets, guidedAnswers.settingPresetId);
  const palette = findPreset(palettePresets, guidedAnswers.palettePresetId);
  const gameplay = guidedAnswers.gameplayEmphasisPresetIds
    .map((id) => findPreset(gameplayEmphasisPresets, id))
    .filter((preset): preset is PromptPresetBlock => preset !== null);

  const presetAnswers: Array<[string, string]> = [
    ["Visual style preset", visualStyle?.value ?? ""],
    ["Mood preset", mood?.value ?? ""],
    ["Setting preset", setting?.value ?? ""],
    ["Palette preset", palette?.value ?? ""],
    ...gameplay.map((preset): [string, string] => [`Gameplay emphasis: ${preset.label}`, preset.value])
  ];

  const customAnswers: Array<[string, string]> = [
    ["Custom mood", guidedAnswers.customMood],
    ["Custom setting", guidedAnswers.customSetting],
    ["Custom visual style", guidedAnswers.customStyle],
    ["Custom palette", guidedAnswers.customPalette],
    ["Custom gameplay emphasis", guidedAnswers.customGameplayFocus]
  ];

  const negativeGuidance = [pointClickCoreNegativePrompt, visualStyle?.negative ?? ""]
    .filter(Boolean)
    .join(", ");
  const answers = [...presetAnswers, ...customAnswers].filter(
    (entry): entry is [string, string] => entry[1].trim().length > 0
  );

  return [
    baseBrief.trim(),
    "Guided scene preset blocks:",
    ...answers.map(([label, value]) => `- ${label}: ${value.trim()}`),
    `- Negative guidance: ${negativeGuidance}`,
    "- IP safety: original IP only, avoid existing franchise characters and logos."
  ]
    .filter(Boolean)
    .join("\n");
}
