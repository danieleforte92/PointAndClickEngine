export interface RgbColor {
  b: number;
  g: number;
  r: number;
}

export interface ChromaImageData {
  data: Uint8ClampedArray;
  height: number;
  width: number;
}

export interface ChromaKeyOptions {
  feather: number;
  keyColor: RgbColor;
  spillReduction: boolean;
  tolerance: number;
}

export interface ChromaKeySummary {
  alphaPixels: number;
  opaquePixels: number;
  totalPixels: number;
  transparentPixels: number;
}

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function parseHexColor(value: string): RgbColor | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const hex = match[1]!;
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16)
  };
}

export function rgbToHex(color: RgbColor): string {
  return `#${[color.r, color.g, color.b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, "0").toUpperCase())
    .join("")}`;
}

export function colorDistance(left: RgbColor, right: RgbColor) {
  const dr = left.r - right.r;
  const dg = left.g - right.g;
  const db = left.b - right.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function alphaMultiplier(distance: number, tolerance: number, feather: number) {
  if (distance <= tolerance) return 0;
  if (feather <= 0) return 1;
  if (distance >= tolerance + feather) return 1;
  return (distance - tolerance) / feather;
}

function reduceSpill(channel: number, keyChannel: number, multiplier: number) {
  return clampChannel(channel - Math.max(0, keyChannel - channel) * (1 - multiplier) * 0.35);
}

export function applyChromaKeyToImageData(
  source: ChromaImageData,
  options: ChromaKeyOptions
): { imageData: ChromaImageData; summary: ChromaKeySummary } {
  const data = new Uint8ClampedArray(source.data);
  const tolerance = Math.max(0, options.tolerance);
  const feather = Math.max(0, options.feather);
  let alphaPixels = 0;
  let opaquePixels = 0;
  let transparentPixels = 0;

  for (let index = 0; index < data.length; index += 4) {
    const color = { r: data[index]!, g: data[index + 1]!, b: data[index + 2]! };
    const multiplier = alphaMultiplier(colorDistance(color, options.keyColor), tolerance, feather);
    const nextAlpha = clampChannel(data[index + 3]! * multiplier);
    data[index + 3] = nextAlpha;

    if (options.spillReduction && multiplier < 1) {
      data[index] = reduceSpill(data[index]!, options.keyColor.r, multiplier);
      data[index + 1] = reduceSpill(data[index + 1]!, options.keyColor.g, multiplier);
      data[index + 2] = reduceSpill(data[index + 2]!, options.keyColor.b, multiplier);
    }

    if (nextAlpha === 0) {
      transparentPixels += 1;
    } else if (nextAlpha === 255) {
      opaquePixels += 1;
    } else {
      alphaPixels += 1;
    }
  }

  return {
    imageData: {
      data,
      height: source.height,
      width: source.width
    },
    summary: {
      alphaPixels,
      opaquePixels,
      totalPixels: source.width * source.height,
      transparentPixels
    }
  };
}
