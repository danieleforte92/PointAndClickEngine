import type { Rect, SceneGenerationGuide, SceneGenerationGuideShape } from "@pointclick/contracts";

export interface ImagePixelData {
  data: Uint8ClampedArray;
  height: number;
  width: number;
}

export function alphaContentBounds(image: ImagePixelData): Rect | null {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (image.data[(y * image.width + x) * 4 + 3] === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX < minX || maxY < minY
    ? null
    : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export type BezierCropNodeMode = "corner" | "smooth";

export interface BezierCropNode {
  inHandle?: { x: number; y: number };
  mode: BezierCropNodeMode;
  outHandle?: { x: number; y: number };
  x: number;
  y: number;
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

export type ImageOptimizePresetId = "sprite-pixel-art" | "transparent-art" | "background-web";

export interface ImageOptimizePreset {
  format: "png" | "webp" | "jpeg";
  id: ImageOptimizePresetId;
  label: string;
  lossless: boolean;
  quality?: number;
  resize: "nearest-neighbor" | "high-quality";
  trimAlpha: boolean;
}

export const imageOptimizePresets: readonly ImageOptimizePreset[] = [
  {
    format: "png",
    id: "sprite-pixel-art",
    label: "Sprite / pixel art",
    lossless: true,
    resize: "nearest-neighbor",
    trimAlpha: false
  },
  {
    format: "png",
    id: "transparent-art",
    label: "Transparency",
    lossless: true,
    resize: "high-quality",
    trimAlpha: true
  },
  {
    format: "webp",
    id: "background-web",
    label: "Background",
    lossless: false,
    quality: 88,
    resize: "high-quality",
    trimAlpha: false
  }
];

export function imageOptimizePreset(id: ImageOptimizePresetId): ImageOptimizePreset {
  return imageOptimizePresets.find((preset) => preset.id === id) ?? imageOptimizePresets[0]!;
}

function clampWhole(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampPoint(point: { x: number; y: number }, size: { height: number; width: number }) {
  return {
    x: clampWhole(point.x, 0, Math.max(0, size.width)),
    y: clampWhole(point.y, 0, Math.max(0, size.height))
  };
}

function formatPathNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function cropNodePoint(node: BezierCropNode) {
  return { x: node.x, y: node.y };
}

function handleOrNode(node: BezierCropNode, handle: "inHandle" | "outHandle") {
  return node[handle] ?? cropNodePoint(node);
}

function reflectedHandle(point: { x: number; y: number }, handle: { x: number; y: number }) {
  return {
    x: point.x * 2 - handle.x,
    y: point.y * 2 - handle.y
  };
}

function defaultSmoothHandles(
  nodes: BezierCropNode[],
  index: number,
  size: { height: number; width: number }
) {
  const node = nodes[index]!;
  const previous = nodes[(index - 1 + nodes.length) % nodes.length]!;
  const next = nodes[(index + 1) % nodes.length]!;
  const direction = { x: next.x - previous.x, y: next.y - previous.y };
  const length = Math.hypot(direction.x, direction.y) || 1;
  const previousDistance = Math.hypot(node.x - previous.x, node.y - previous.y);
  const nextDistance = Math.hypot(next.x - node.x, next.y - node.y);
  const handleLength = Math.max(8, Math.min(previousDistance, nextDistance) / 3);
  const unit = { x: direction.x / length, y: direction.y / length };
  return {
    inHandle: clampPoint({ x: node.x - unit.x * handleLength, y: node.y - unit.y * handleLength }, size),
    outHandle: clampPoint({ x: node.x + unit.x * handleLength, y: node.y + unit.y * handleLength }, size)
  };
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

export function createDefaultBezierCropPath(
  size: { height: number; width: number },
  padding = 0
): BezierCropNode[] {
  const left = clampWhole(padding, 0, Math.max(0, size.width - 1));
  const top = clampWhole(padding, 0, Math.max(0, size.height - 1));
  const right = clampWhole(size.width - padding, left + 1, size.width);
  const bottom = clampWhole(size.height - padding, top + 1, size.height);
  return [
    { mode: "corner", x: left, y: top },
    { mode: "corner", x: right, y: top },
    { mode: "corner", x: right, y: bottom },
    { mode: "corner", x: left, y: bottom }
  ];
}

export function buildBezierCropSvgPath(nodes: BezierCropNode[]): string {
  if (nodes.length < 2) return "";
  const commands = [`M ${formatPathNumber(nodes[0]!.x)} ${formatPathNumber(nodes[0]!.y)}`];
  for (let index = 0; index < nodes.length; index += 1) {
    const current = nodes[index]!;
    const next = nodes[(index + 1) % nodes.length]!;
    const outHandle = handleOrNode(current, "outHandle");
    const inHandle = handleOrNode(next, "inHandle");
    commands.push(
      [
        "C",
        formatPathNumber(outHandle.x),
        formatPathNumber(outHandle.y),
        formatPathNumber(inHandle.x),
        formatPathNumber(inHandle.y),
        formatPathNumber(next.x),
        formatPathNumber(next.y)
      ].join(" ")
    );
  }
  commands.push("Z");
  return commands.join(" ");
}

export function buildBezierCropSegmentSvgPath(nodes: BezierCropNode[], index: number): string {
  if (nodes.length < 2 || index < 0 || index >= nodes.length) return "";
  const current = nodes[index]!;
  const next = nodes[(index + 1) % nodes.length]!;
  const outHandle = handleOrNode(current, "outHandle");
  const inHandle = handleOrNode(next, "inHandle");
  return [
    `M ${formatPathNumber(current.x)} ${formatPathNumber(current.y)}`,
    [
      "C",
      formatPathNumber(outHandle.x),
      formatPathNumber(outHandle.y),
      formatPathNumber(inHandle.x),
      formatPathNumber(inHandle.y),
      formatPathNumber(next.x),
      formatPathNumber(next.y)
    ].join(" ")
  ].join(" ");
}

export function bezierCropPathBounds(
  nodes: BezierCropNode[],
  image?: { height: number; width: number }
): Rect {
  const points = nodes.flatMap((node) => [
    cropNodePoint(node),
    ...(node.inHandle ? [node.inHandle] : []),
    ...(node.outHandle ? [node.outHandle] : [])
  ]);
  if (!points.length) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  const rect = {
    x: Math.floor(minX),
    y: Math.floor(minY),
    width: Math.max(1, Math.ceil(maxX) - Math.floor(minX)),
    height: Math.max(1, Math.ceil(maxY) - Math.floor(minY))
  };
  return image ? clampCropRect(rect, image) : rect;
}

export function moveBezierCropNode(
  nodes: BezierCropNode[],
  index: number,
  point: { x: number; y: number },
  size: { height: number; width: number }
): BezierCropNode[] {
  const node = nodes[index];
  if (!node) return nodes;
  const nextPoint = clampPoint(point, size);
  const delta = { x: nextPoint.x - node.x, y: nextPoint.y - node.y };
  return nodes.map((current, currentIndex) => {
    if (currentIndex !== index) return current;
    const moved: BezierCropNode = {
      ...current,
      x: nextPoint.x,
      y: nextPoint.y
    };
    if (current.inHandle) {
      moved.inHandle = clampPoint({ x: current.inHandle.x + delta.x, y: current.inHandle.y + delta.y }, size);
    }
    if (current.outHandle) {
      moved.outHandle = clampPoint({ x: current.outHandle.x + delta.x, y: current.outHandle.y + delta.y }, size);
    }
    return moved;
  });
}

export function moveBezierCropHandle(
  nodes: BezierCropNode[],
  index: number,
  handle: "inHandle" | "outHandle",
  point: { x: number; y: number },
  size: { height: number; width: number }
): BezierCropNode[] {
  const node = nodes[index];
  if (!node) return nodes;
  const nextHandle = clampPoint(point, size);
  const oppositeHandle = handle === "inHandle" ? "outHandle" : "inHandle";
  return nodes.map((current, currentIndex) => {
    if (currentIndex !== index) return current;
    const nextNode = {
      ...current,
      [handle]: nextHandle
    };
    if (current.mode === "smooth") {
      nextNode[oppositeHandle] = clampPoint(reflectedHandle(cropNodePoint(current), nextHandle), size);
    }
    return nextNode;
  });
}

export function setBezierCropNodeMode(
  nodes: BezierCropNode[],
  index: number,
  mode: BezierCropNodeMode,
  size: { height: number; width: number }
): BezierCropNode[] {
  const node = nodes[index];
  if (!node) return nodes;
  const smoothHandles = mode === "smooth" ? defaultSmoothHandles(nodes, index, size) : {};
  return nodes.map((current, currentIndex) =>
    currentIndex === index
      ? {
          ...current,
          ...smoothHandles,
          mode
        }
      : current
  );
}

export function insertBezierCropNodeAfter(
  nodes: BezierCropNode[],
  afterIndex: number,
  point: { x: number; y: number },
  size: { height: number; width: number }
): BezierCropNode[] {
  const nextNodes = [...nodes];
  nextNodes.splice(afterIndex + 1, 0, { ...clampPoint(point, size), mode: "corner" });
  return nextNodes;
}

export function removeBezierCropNode(nodes: BezierCropNode[], index: number): BezierCropNode[] {
  if (nodes.length <= 3) return nodes;
  return nodes.filter((_, currentIndex) => currentIndex !== index);
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
