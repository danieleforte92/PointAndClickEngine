import type { PromptPackGenerationTarget } from "@pointclick/contracts";

export interface ClipPreviewDraft {
  fps: string;
  frames: string;
  id: string;
  loop: boolean;
}

export interface AnimationPreviewDraft {
  assetId: string;
  frameHeight: string;
  frameWidth: string;
  gridColumns: string;
  gridRows: string;
  clips: ClipPreviewDraft[];
}

export interface AnimationClipPreviewFrame {
  column: number;
  frame: number;
  row: number;
}

export interface AnimationClipPreviewState {
  backgroundPosition: string;
  backgroundSize: string;
  frame: AnimationClipPreviewFrame;
  height: number;
  status: string;
  width: number;
}

export interface ComfyOutputPresetLike {
  id: string;
  label: string;
  useCase: string;
}

export type ImageTargetWorkflowMode = "opaque" | "transparent" | "chroma";

export interface ImageTargetWorkflowDescription {
  detail: string;
  label: string;
  mode: ImageTargetWorkflowMode;
}

function parsePositiveInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function chooseAnimationPreviewClip(
  clips: ClipPreviewDraft[],
  selectedClipId: string | null
): ClipPreviewDraft | null {
  return (
    (selectedClipId ? clips.find((clip) => clip.id === selectedClipId) : null) ??
    clips.find((clip) => clip.id === "idle") ??
    clips[0] ??
    null
  );
}

export function parsePreviewFrameList(value: string): number[] | null {
  const frames = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => Number(entry));
  if (frames.length === 0 || frames.some((frame) => !Number.isInteger(frame) || frame < 0)) {
    return null;
  }
  return frames;
}

export function buildAnimationClipPreviewState(
  draft: AnimationPreviewDraft,
  clip: ClipPreviewDraft | null,
  elapsedMs: number
): AnimationClipPreviewState | null {
  if (!clip) return null;

  const frameWidth = parsePositiveInteger(draft.frameWidth);
  const frameHeight = parsePositiveInteger(draft.frameHeight);
  const gridColumns = parsePositiveInteger(draft.gridColumns);
  const gridRows = parsePositiveInteger(draft.gridRows);
  if (!frameWidth || !frameHeight || !gridColumns || !gridRows) {
    return null;
  }

  const fps = parsePositiveNumber(clip.fps);
  const frames = parsePreviewFrameList(clip.frames);
  if (!fps || !frames) {
    return null;
  }

  const frameCount = gridColumns * gridRows;
  if (frames.some((frame) => frame >= frameCount)) {
    return null;
  }

  const rawFrameOffset = Math.floor((Math.max(0, elapsedMs) / 1000) * fps);
  const frameOffset = clip.loop
    ? rawFrameOffset % frames.length
    : Math.min(rawFrameOffset, frames.length - 1);
  const frame = frames[frameOffset] ?? frames[0]!;
  const column = frame % gridColumns;
  const row = Math.floor(frame / gridColumns);

  return {
    backgroundPosition: `${gridColumns === 1 ? 0 : (column / (gridColumns - 1)) * 100}% ${
      gridRows === 1 ? 0 : (row / (gridRows - 1)) * 100
    }%`,
    backgroundSize: `${gridColumns * 100}% ${gridRows * 100}%`,
    frame: {
      column,
      frame,
      row
    },
    height: frameHeight,
    status: `${clip.id} frame ${frame}`,
    width: frameWidth
  };
}

export function animationPreviewIssue(
  draft: AnimationPreviewDraft,
  clip: ClipPreviewDraft | null,
  assetUrl?: string
): string | null {
  if (!draft.assetId.trim()) {
    return "Select an image spritesheet asset to preview this pack.";
  }
  if (!assetUrl) {
    return "Spritesheet preview is loading or the asset file is unavailable.";
  }
  if (!clip) {
    return "Add a clip to preview the animation.";
  }

  const frameWidth = parsePositiveInteger(draft.frameWidth);
  const frameHeight = parsePositiveInteger(draft.frameHeight);
  const gridColumns = parsePositiveInteger(draft.gridColumns);
  const gridRows = parsePositiveInteger(draft.gridRows);
  if (!frameWidth || !frameHeight || !gridColumns || !gridRows) {
    return "Frame size and grid must be positive whole numbers.";
  }

  const fps = parsePositiveNumber(clip.fps);
  const frames = parsePreviewFrameList(clip.frames);
  if (!fps) {
    return `Clip "${clip.id}" needs a positive fps value.`;
  }
  if (!frames) {
    return `Clip "${clip.id}" needs comma-separated frame numbers.`;
  }

  const frameCount = gridColumns * gridRows;
  const invalidFrame = frames.find((frame) => frame >= frameCount);
  if (invalidFrame !== undefined) {
    return `Clip "${clip.id}" references frame ${invalidFrame}, but the grid has ${frameCount} frame(s).`;
  }

  return null;
}

function textIncludesChroma(value: string): boolean {
  return /\b(chroma|key color|green screen|blue screen|flat green|flat blue)\b/i.test(value);
}

export function describeImageTargetWorkflow(
  target: PromptPackGenerationTarget | null,
  preset: ComfyOutputPresetLike,
  promptText = ""
): ImageTargetWorkflowDescription {
  if (!target) {
    return {
      detail: "Choose a prompt-pack generation target before queueing ComfyUI.",
      label: "No target selected",
      mode: "opaque"
    };
  }

  const searchableText = `${target.id} ${target.intendedUse} ${preset.label} ${preset.useCase} ${promptText}`;
  if (textIncludesChroma(searchableText)) {
    return {
      detail:
        "Use a workflow that generates the subject on a flat key color. The editor will import the PNG as-is in this slice.",
      label: "Chroma workflow expected",
      mode: "chroma"
    };
  }

  if (target.transparent) {
    return {
      detail:
        "Use a ComfyUI workflow that removes the background and saves PNG alpha. The editor does not guarantee transparency by itself.",
      label: "Alpha workflow expected",
      mode: "transparent"
    };
  }

  return {
    detail: "Opaque output is fine for this target. No alpha or chroma cleanup is expected.",
    label: "Opaque output",
    mode: "opaque"
  };
}
