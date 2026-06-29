import { describe, expect, it } from "vitest";
import { applyChromaKeyToImageData, parseHexColor, rgbToHex } from "./chroma-key";

describe("chroma key helpers", () => {
  it("parses and formats hex colors", () => {
    expect(parseHexColor("#00A2FF")).toEqual({ r: 0, g: 162, b: 255 });
    expect(rgbToHex({ r: 0, g: 162, b: 255 })).toBe("#00A2FF");
  });

  it("removes exact key color pixels", () => {
    const result = applyChromaKeyToImageData(
      {
        width: 2,
        height: 1,
        data: new Uint8ClampedArray([0, 162, 255, 255, 120, 20, 10, 255])
      },
      {
        feather: 0,
        keyColor: { r: 0, g: 162, b: 255 },
        spillReduction: false,
        tolerance: 0
      }
    );

    expect(result.imageData.data[3]).toBe(0);
    expect(result.imageData.data[7]).toBe(255);
    expect(result.summary.transparentPixels).toBe(1);
    expect(result.summary.opaquePixels).toBe(1);
  });

  it("creates partial alpha inside feather range", () => {
    const result = applyChromaKeyToImageData(
      {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([0, 170, 255, 255])
      },
      {
        feather: 20,
        keyColor: { r: 0, g: 162, b: 255 },
        spillReduction: false,
        tolerance: 0
      }
    );

    expect(result.imageData.data[3]).toBeGreaterThan(0);
    expect(result.imageData.data[3]).toBeLessThan(255);
    expect(result.summary.alphaPixels).toBe(1);
  });

  it("keeps opaque pixels when no key color matches", () => {
    const result = applyChromaKeyToImageData(
      {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([120, 20, 10, 255])
      },
      {
        feather: 0,
        keyColor: { r: 0, g: 162, b: 255 },
        spillReduction: false,
        tolerance: 10
      }
    );

    expect(result.imageData.data[3]).toBe(255);
    expect(result.summary.transparentPixels).toBe(0);
  });
});
