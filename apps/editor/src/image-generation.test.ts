import { describe, expect, it } from "vitest";
import { bitmapHasAlphaPixels, generatedImageOutputWarning } from "./image-generation";

describe("generated image output contract", () => {
  it("detects alpha pixels in nativeImage RGBA bitmaps", () => {
    expect(bitmapHasAlphaPixels(Uint8Array.from([10, 20, 30, 255, 40, 50, 60, 120]))).toBe(true);
  });

  it("treats fully opaque bitmaps as having no alpha pixels", () => {
    expect(bitmapHasAlphaPixels(Uint8Array.from([10, 20, 30, 255, 40, 50, 60, 255]))).toBe(false);
  });

  it("warns when an alpha target produces an opaque image", () => {
    expect(
      generatedImageOutputWarning({
        backgroundMode: "transparent-alpha",
        expectedAlpha: true,
        hasAlphaPixels: false
      })
    ).toContain("expected transparent PNG alpha");
  });

  it("does not mark opaque chroma output as transparent-ready", () => {
    expect(
      generatedImageOutputWarning({
        backgroundMode: "chroma-blue",
        expectedAlpha: false,
        hasAlphaPixels: false
      })
    ).toBeUndefined();
  });
});
