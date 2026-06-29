import type { Rect } from "@pointclick/contracts";

export interface ImagePixelData {
  data: Uint8ClampedArray;
  height: number;
  width: number;
}

export interface GuideMaskOptions {
  bounds: Rect;
  height: number;
  shape: "rect" | "ellipse";
  width: number;
}

function clampWhole(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function clampCropRect(rect: Rect, image: { height: number; width: number }): Rect {
  const x = clampWhole(rect.x, 0, Math.max(0, image.width - 1));
  const y = clampWhole(rect.y, 0, Math.max(0, image.height - 1));
  const maxWidth = Math.max(1, image.width - x);
  const maxHeight = Math.max(1, image.height - y);
  return {
    x,
    y,
    width: clampWhole(rect.width, 1, maxWidth),
    height: clampWhole(rect.height, 1, maxHeight)
  };
}

export function cropImageData(source: ImagePixelData, rect: Rect): ImagePixelData {
  const crop = clampCropRect(rect, source);
  const data = new Uint8ClampedArray(crop.width * crop.height * 4);

  for (let y = 0; y < crop.height; y += 1) {
    for (let x = 0; x < crop.width; x += 1) {
      const sourceIndex = ((crop.y + y) * source.width + crop.x + x) * 4;
      const targetIndex = (y * crop.width + x) * 4;
      data[targetIndex] = source.data[sourceIndex]!;
      data[targetIndex + 1] = source.data[sourceIndex + 1]!;
      data[targetIndex + 2] = source.data[sourceIndex + 2]!;
      data[targetIndex + 3] = source.data[sourceIndex + 3]!;
    }
  }

  return {
    data,
    height: crop.height,
    width: crop.width
  };
}

export function createGuideMask(options: GuideMaskOptions): ImagePixelData {
  const bounds = clampCropRect(options.bounds, options);
  const data = new Uint8ClampedArray(options.width * options.height * 4);
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const radiusX = Math.max(1, bounds.width / 2);
  const radiusY = Math.max(1, bounds.height / 2);

  for (let y = 0; y < options.height; y += 1) {
    for (let x = 0; x < options.width; x += 1) {
      const inBounds =
        options.shape === "rect"
          ? x >= bounds.x && x < bounds.x + bounds.width && y >= bounds.y && y < bounds.y + bounds.height
          : ((x - centerX) * (x - centerX)) / (radiusX * radiusX) +
              ((y - centerY) * (y - centerY)) / (radiusY * radiusY) <=
            1;
      const index = (y * options.width + x) * 4;
      const channel = inBounds ? 255 : 0;
      data[index] = channel;
      data[index + 1] = channel;
      data[index + 2] = channel;
      data[index + 3] = 255;
    }
  }

  return {
    data,
    height: options.height,
    width: options.width
  };
}
