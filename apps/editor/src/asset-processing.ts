import type { Rect, SceneGenerationGuide, SceneGenerationGuideShape } from "@pointclick/contracts";

export interface ImagePixelData {
  data: Uint8ClampedArray;
  height: number;
  width: number;
}

export interface GuideMaskOptions {
  bounds: Rect;
  height: number;
  shape: "rect" | "ellipse" | "polygon";
  width: number;
  points?: Array<{ x: number; y: number }>;
}

export interface CompositeGuideMaskOptions {
  guides: SceneGenerationGuide[];
  height: number;
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

function intersectRect(rect: Rect, image: { height: number; width: number }): Rect | null {
  const x1 = Math.max(0, Math.round(rect.x));
  const y1 = Math.max(0, Math.round(rect.y));
  const x2 = Math.min(image.width, Math.round(rect.x + rect.width));
  const y2 = Math.min(image.height, Math.round(rect.y + rect.height));
  if (x2 <= x1 || y2 <= y1) return null;
  return {
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1
  };
}

function boundsForShape(shape: SceneGenerationGuideShape): Rect {
  if (shape.type !== "polygon") return shape.bounds;
  const xs = shape.points.map((point) => point.x);
  const ys = shape.points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

function pointInPolygon(x: number, y: number, points: Array<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let currentIndex = 0, previousIndex = points.length - 1; currentIndex < points.length; previousIndex = currentIndex++) {
    const current = points[currentIndex]!;
    const previous = points[previousIndex]!;
    const intersects =
      current.y > y !== previous.y > y &&
      x < ((previous.x - current.x) * (y - current.y)) / (previous.y - current.y) + current.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function guideMaskContains(options: GuideMaskOptions, x: number, y: number): boolean {
  if (options.shape === "polygon") {
    return options.points ? pointInPolygon(x + 0.5, y + 0.5, options.points) : false;
  }

  const bounds = intersectRect(options.bounds, options);
  if (!bounds) return false;
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const radiusX = Math.max(1, bounds.width / 2);
  const radiusY = Math.max(1, bounds.height / 2);

  return options.shape === "rect"
    ? x >= bounds.x && x < bounds.x + bounds.width && y >= bounds.y && y < bounds.y + bounds.height
    : ((x - centerX) * (x - centerX)) / (radiusX * radiusX) +
        ((y - centerY) * (y - centerY)) / (radiusY * radiusY) <=
        1;
}

export function createGuideMask(options: GuideMaskOptions): ImagePixelData {
  const data = new Uint8ClampedArray(options.width * options.height * 4);

  for (let y = 0; y < options.height; y += 1) {
    for (let x = 0; x < options.width; x += 1) {
      const index = (y * options.width + x) * 4;
      const channel = guideMaskContains(options, x, y) ? 255 : 0;
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

function guideShapeToMaskOptions(
  guide: SceneGenerationGuide,
  size: { height: number; width: number }
): GuideMaskOptions {
  if (guide.shape.type === "polygon") {
    return {
      bounds: boundsForShape(guide.shape),
      height: size.height,
      points: guide.shape.points,
      shape: "polygon",
      width: size.width
    };
  }
  return {
    bounds: guide.shape.bounds,
    height: size.height,
    shape: guide.shape.type,
    width: size.width
  };
}

export function createCompositeGuideMask(options: CompositeGuideMaskOptions): ImagePixelData {
  const data = new Uint8ClampedArray(options.width * options.height * 4);
  const guideOptions = options.guides
    .filter((guide) => guide.visible !== false)
    .map((guide) => guideShapeToMaskOptions(guide, options));

  for (let y = 0; y < options.height; y += 1) {
    for (let x = 0; x < options.width; x += 1) {
      const index = (y * options.width + x) * 4;
      const channel = guideOptions.some((guide) => guideMaskContains(guide, x, y)) ? 255 : 0;
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
