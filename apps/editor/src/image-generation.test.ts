import { describe, expect, it } from "vitest";
import { bitmapHasAlphaPixels, estimateImageWorkflowFamily, generatedImageOutputWarning } from "./image-generation";

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

describe("image workflow family estimation", () => {
  it("prefers inpaint when a mask asset is linked", () => {
    expect(
      estimateImageWorkflowFamily({
        intendedUse: "scene-background",
        maskAssetId: "door-mask"
      })
    ).toBe("scene_inpaint_masked");
  });

  it("uses img2img layout when a reference asset is linked", () => {
    expect(
      estimateImageWorkflowFamily({
        intendedUse: "scene-background",
        referenceAssetId: "room-layout"
      })
    ).toBe("background_img2img_layout");
  });

  it("keeps transparent props in the isolated alpha or chroma family", () => {
    expect(
      estimateImageWorkflowFamily({
        backgroundMode: "transparent-alpha",
        intendedUse: "prop"
      })
    ).toBe("prop_isolated_alpha_or_chroma");
  });
});
