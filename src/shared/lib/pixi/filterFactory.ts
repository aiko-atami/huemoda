import { NoiseFilter } from "pixi.js";
import type { Filter, Texture } from "pixi.js";
import { ChromaticAberrationFilter } from "./ChromaticAberrationFilter";
import { LutFilter } from "./LutFilter";
import {
  AdvancedBloomFilter,
  AdjustmentFilter,
  ColorOverlayFilter,
  DotFilter,
  GlitchFilter,
  GlowFilter,
  KawaseBlurFilter,
  MotionBlurFilter,
  SimplexNoiseFilter,
  ZoomBlurFilter,
} from "pixi-filters";
import type { PixiFilterValues } from "./filterTypes";

export type PixiFilterContext = {
  height: number;
  lutTextures?: ReadonlyMap<string, Texture>;
  width: number;
};

export function createPixiFilters(
  filterChain: PixiFilterValues,
  context?: PixiFilterContext,
): Filter[] {
  const filters: Filter[] = [];
  const {
    advancedBloom,
    blur,
    chromaticAberration,
    dot,
    glitch,
    glow,
    grain,
    lightLeak,
    lut,
    motionBlur,
    noise,
    tone,
    zoomBlur,
  } = filterChain;

  if (tone.enabled) {
    filters.push(
      new AdjustmentFilter({
        brightness: tone.brightness,
        contrast: tone.contrast,
        saturation: tone.saturation,
      }),
    );
  }

  if (lut.enabled && lut.intensity > 0) {
    const lutTexture = context?.lutTextures?.get(lut.presetId);

    if (lutTexture !== undefined) {
      filters.push(
        new LutFilter({
          intensity: lut.intensity,
          texture: lutTexture,
        }),
      );
    }
  }

  if (blur.enabled && blur.strength > 0) {
    filters.push(
      new KawaseBlurFilter({
        strength: blur.strength,
        quality: 3,
      }),
    );
  }

  if (grain.enabled && grain.intensity > 0) {
    filters.push(
      new NoiseFilter({
        noise: grain.intensity,
        seed: 0.43,
      }),
    );
  }

  if (lightLeak.enabled && lightLeak.intensity > 0) {
    filters.push(
      new ColorOverlayFilter({
        color: getLightLeakColor(lightLeak.warmth),
        alpha: lightLeak.intensity,
      }),
    );
  }

  if (advancedBloom.enabled) {
    filters.push(
      new AdvancedBloomFilter({
        threshold: advancedBloom.threshold,
        bloomScale: advancedBloom.bloomScale,
        brightness: advancedBloom.brightness,
        blur: advancedBloom.blur,
      }),
    );
  }

  if (dot.enabled) {
    filters.push(
      new DotFilter({
        scale: dot.scale,
        angle: dot.angle,
        grayscale: false,
      }),
    );
  }

  if (glitch.enabled) {
    filters.push(
      new GlitchFilter({
        slices: Math.round(glitch.slices),
        offset: glitch.offset,
        direction: glitch.direction,
      }),
    );
  }

  if (glow.enabled) {
    filters.push(
      new GlowFilter({
        distance: glow.distance,
        outerStrength: glow.outerStrength,
        innerStrength: glow.innerStrength,
      }),
    );
  }

  if (motionBlur.enabled) {
    const kernelSize = Math.round(motionBlur.kernelSize);
    const oddKernelSize = kernelSize % 2 === 0 ? kernelSize + 1 : kernelSize;

    filters.push(
      new MotionBlurFilter({
        velocity: { x: motionBlur.velocityX, y: motionBlur.velocityY },
        kernelSize: Math.max(5, oddKernelSize),
      }),
    );
  }

  if (noise.enabled) {
    filters.push(
      new SimplexNoiseFilter({
        strength: noise.strength,
        noiseScale: noise.noiseScale,
      }),
    );
  }

  if (zoomBlur.enabled) {
    filters.push(
      new ZoomBlurFilter({
        strength: zoomBlur.strength,
        center: context === undefined ? undefined : { x: context.width / 2, y: context.height / 2 },
        innerRadius: zoomBlur.innerRadius,
      }),
    );
  }

  if (chromaticAberration.enabled) {
    filters.push(
      new ChromaticAberrationFilter({
        offsetX: chromaticAberration.offsetX,
        offsetY: chromaticAberration.offsetY,
        redX: chromaticAberration.redX,
        redY: chromaticAberration.redY,
        blueX: chromaticAberration.blueX,
        blueY: chromaticAberration.blueY,
        radial: chromaticAberration.radial,
        twist: chromaticAberration.twist,
        centerX: chromaticAberration.centerX,
        centerY: chromaticAberration.centerY,
      }),
    );
  }

  return filters;
}

function getLightLeakColor(warmth: number): number {
  if (warmth >= 65) {
    return 0xf3ffcc;
  }

  if (warmth >= 35) {
    return 0xcdcdff;
  }

  return 0x9db9ff;
}
