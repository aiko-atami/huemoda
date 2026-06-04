import { describe, expect, it } from "vitest";
import {
  getQualityProfileSettings,
  previewResolutionScale,
  resolveQualityProfile,
} from "./qualityProfile";

describe("resolveQualityProfile", () => {
  it("returns mobile for a coarse pointer", () => {
    expect(resolveQualityProfile({ coarsePointer: true, hardwareConcurrency: 16 })).toBe("mobile");
  });

  it("returns mobile for low core counts", () => {
    expect(resolveQualityProfile({ coarsePointer: false, hardwareConcurrency: 4 })).toBe("mobile");
  });

  it("returns desktop for a fine pointer with many cores", () => {
    expect(resolveQualityProfile({ coarsePointer: false, hardwareConcurrency: 12 })).toBe(
      "desktop",
    );
  });

  it("falls back to desktop when signals are absent", () => {
    expect(resolveQualityProfile({})).toBe("desktop");
  });
});

describe("previewResolutionScale", () => {
  it("does not upscale images already within the cap", () => {
    expect(previewResolutionScale(800, 600, "mobile")).toBe(1);
    expect(previewResolutionScale(2000, 1000, "desktop")).toBe(1);
  });

  it("scales down the longest side to the profile cap", () => {
    // mobile cap = 1600; a 3200px-wide image scales to 0.5.
    expect(previewResolutionScale(3200, 1800, "mobile")).toBeCloseTo(0.5, 5);
    // desktop cap = 2560; a 5120px-tall image scales to 0.5.
    expect(previewResolutionScale(2000, 5120, "desktop")).toBeCloseTo(0.5, 5);
  });

  it("returns 1 for degenerate dimensions", () => {
    expect(previewResolutionScale(0, 0, "mobile")).toBe(1);
  });

  it("mobile caps lower than desktop", () => {
    expect(getQualityProfileSettings("mobile").previewMaxDimension).toBeLessThan(
      getQualityProfileSettings("desktop").previewMaxDimension,
    );
  });
});
