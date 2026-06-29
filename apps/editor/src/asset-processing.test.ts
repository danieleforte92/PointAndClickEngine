import { describe, expect, it } from "vitest";
import { clampCropRect, createGuideMask, cropImageData } from "./asset-processing";

describe("asset processing helpers", () => {
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
});
