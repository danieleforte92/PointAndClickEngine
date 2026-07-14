import { describe, expect, it } from "vitest";
import {
  bezierCropPathBounds,
  alphaContentBounds,
  buildBezierCropSegmentSvgPath,
  buildBezierCropSvgPath,
  clampCropRect,
  createCompositeGuideMask,
  createDefaultBezierCropPath,
  createGuideMask,
  cropImageData,
  imageOptimizePreset,
  insertBezierCropNodeAfter,
  moveBezierCropHandle,
  moveBezierCropNode,
  removeBezierCropNode,
  setBezierCropNodeMode
} from "./asset-processing";

describe("asset processing helpers", () => {
  it("finds the non-transparent image bounds", () => {
    const data = new Uint8ClampedArray(3 * 2 * 4);
    data[(1 * 3 + 1) * 4 + 3] = 255;
    data[(1 * 3 + 2) * 4 + 3] = 120;
    expect(alphaContentBounds({ data, width: 3, height: 2 })).toEqual({ x: 1, y: 1, width: 2, height: 1 });
  });

  it("keeps safe optimization defaults for backgrounds and sprites", () => {
    expect(imageOptimizePreset("background-web")).toMatchObject({ format: "webp", quality: 88 });
    expect(imageOptimizePreset("sprite-pixel-art")).toMatchObject({
      format: "png",
      lossless: true,
      resize: "nearest-neighbor"
    });
  });

  it("clamps crop rectangles to image bounds", () => {
    expect(clampCropRect({ x: 8, y: -3, width: 10, height: 20 }, { width: 12, height: 10 })).toEqual({
      x: 8,
      y: 0,
      width: 4,
      height: 10
    });
  });

  it("crops image data into a new image buffer", () => {
    const source = new Uint8ClampedArray([
      1, 0, 0, 255, 2, 0, 0, 255,
      3, 0, 0, 255, 4, 0, 0, 255
    ]);
    const result = cropImageData({ data: source, width: 2, height: 2 }, { x: 1, y: 0, width: 1, height: 2 });
    expect(result.width).toBe(1);
    expect(result.height).toBe(2);
    expect([...result.data]).toEqual([2, 0, 0, 255, 4, 0, 0, 255]);
  });

  it("creates closed bezier crop paths from default rectangle nodes", () => {
    const path = createDefaultBezierCropPath({ width: 100, height: 80 }, 10);
    expect(path).toEqual([
      { mode: "corner", x: 10, y: 10 },
      { mode: "corner", x: 90, y: 10 },
      { mode: "corner", x: 90, y: 70 },
      { mode: "corner", x: 10, y: 70 }
    ]);
    expect(buildBezierCropSvgPath(path)).toBe(
      "M 10 10 C 10 10 90 10 90 10 C 90 10 90 70 90 70 C 90 70 10 70 10 70 C 10 70 10 10 10 10 Z"
    );
    expect(buildBezierCropSegmentSvgPath(path, 1)).toBe("M 90 10 C 90 10 90 70 90 70");
  });

  it("keeps bezier crop node handles attached when moving a node", () => {
    const path = [
      { mode: "corner" as const, x: 0, y: 0 },
      {
        inHandle: { x: 30, y: 10 },
        mode: "corner" as const,
        outHandle: { x: 70, y: 10 },
        x: 50,
        y: 20
      },
      { mode: "corner" as const, x: 100, y: 0 }
    ];
    const moved = moveBezierCropNode(path, 1, { x: 60, y: 30 }, { width: 120, height: 80 });
    expect(moved[1]).toEqual({
      inHandle: { x: 40, y: 20 },
      mode: "corner",
      outHandle: { x: 80, y: 20 },
      x: 60,
      y: 30
    });
  });

  it("mirrors handles for smooth bezier crop nodes", () => {
    const path = setBezierCropNodeMode(
      createDefaultBezierCropPath({ width: 100, height: 100 }),
      1,
      "smooth",
      { width: 100, height: 100 }
    );
    const moved = moveBezierCropHandle(path, 1, "outHandle", { x: 80, y: 30 }, { width: 100, height: 100 });
    expect(moved[1]?.outHandle).toEqual({ x: 80, y: 30 });
    expect(moved[1]?.inHandle).toEqual({ x: 100, y: 0 });
  });

  it("inserts and removes bezier crop nodes", () => {
    const path = createDefaultBezierCropPath({ width: 100, height: 100 });
    const inserted = insertBezierCropNodeAfter(path, 0, { x: 50, y: 5 }, { width: 100, height: 100 });
    expect(inserted).toHaveLength(5);
    expect(inserted[1]).toEqual({ mode: "corner", x: 50, y: 5 });
    expect(removeBezierCropNode(inserted, 1)).toEqual(path);
    expect(removeBezierCropNode(path.slice(0, 3), 1)).toHaveLength(3);
  });

  it("computes bezier crop path bounds from nodes and handles", () => {
    const bounds = bezierCropPathBounds(
      [
        { mode: "corner", x: 10, y: 10, outHandle: { x: 5, y: 30 } },
        { mode: "corner", x: 90, y: 20, inHandle: { x: 95, y: 40 } },
        { mode: "corner", x: 60, y: 80 }
      ],
      { width: 100, height: 100 }
    );
    expect(bounds).toEqual({ x: 5, y: 10, width: 90, height: 70 });
  });

  it("creates rectangular guide masks", () => {
    const result = createGuideMask({
      bounds: { x: 1, y: 0, width: 1, height: 2 },
      height: 2,
      shape: "rect",
      width: 2
    });
    expect([...result.data.filter((_, index) => index % 4 === 0)]).toEqual([0, 255, 0, 255]);
  });

  it("creates ellipse guide masks", () => {
    const result = createGuideMask({
      bounds: { x: 0, y: 0, width: 3, height: 3 },
      height: 3,
      shape: "ellipse",
      width: 3
    });
    const red = [...result.data.filter((_, index) => index % 4 === 0)];
    expect(red.filter((value) => value === 255).length).toBeGreaterThan(1);
    expect(red.filter((value) => value === 0).length).toBeGreaterThan(0);
  });

  it("creates polygon guide masks", () => {
    const result = createGuideMask({
      bounds: { x: 0, y: 0, width: 3, height: 3 },
      height: 3,
      points: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 3 }],
      shape: "polygon",
      width: 3
    });
    const red = [...result.data.filter((_, index) => index % 4 === 0)];
    expect(red.filter((value) => value === 255).length).toBeGreaterThan(0);
    expect(red.filter((value) => value === 0).length).toBeGreaterThan(0);
  });

  it("creates composite masks from multiple guides", () => {
    const result = createCompositeGuideMask({
      width: 4,
      height: 2,
      guides: [
        {
          id: "left",
          name: "Left",
          role: "mask",
          shape: { type: "rect", bounds: { x: 0, y: 0, width: 1, height: 2 } }
        },
        {
          id: "right",
          name: "Right",
          role: "mask",
          shape: { type: "rect", bounds: { x: 3, y: 0, width: 1, height: 2 } }
        }
      ]
    });
    expect([...result.data.filter((_, index) => index % 4 === 0)]).toEqual([255, 0, 0, 255, 255, 0, 0, 255]);
  });

  it("clips partially out-of-scene guide masks", () => {
    const result = createGuideMask({
      bounds: { x: -2, y: 0, width: 3, height: 1 },
      height: 1,
      shape: "rect",
      width: 3
    });
    expect([...result.data.filter((_, index) => index % 4 === 0)]).toEqual([255, 0, 0]);
  });
});
