import { BlurFilter } from "pixi.js";
import type { Filter, Texture } from "pixi.js";
import { ChromaticAberrationFilter } from "./ChromaticAberrationFilter";
import { CrtFilter } from "./CrtFilter";
import { GrainFilter } from "./GrainFilter";
import { HalationCompositeFilter } from "./HalationCompositeFilter";
import { HalationExtractFilter } from "./HalationExtractFilter";
import { LensFlareFilter } from "./LensFlareFilter";
import { LutFilter } from "./LutFilter";
import { SpinBlurFilter } from "./SpinBlurFilter";
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
  grainSeed?: number;
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
    crt,
    dot,
    glitch,
    glow,
    grain,
    lensFlare,
    lightLeak,
    lut,
    motionBlur,
    noise,
    spinBlur,
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

    if (lutTexture !== undefined && lutTexture.source) {
      filters.push(
        new LutFilter({
          intensity: lut.intensity,
          texture: lutTexture,
        }),
      );
    } else if (lut.presetId) {
      console.warn(`[LutFilter] texture not found for preset "${lut.presetId}"`);
    }
  }

  if (blur.enabled && blur.strength > 0) {
    const gaussianBlur = new BlurFilter({
      strength: blur.strength,
      quality: 4,
      kernelSize: 9,
    });
    gaussianBlur.repeatEdgePixels = true;

    filters.push(gaussianBlur);
  }

  if (grain.enabled && grain.amount > 0) {
    filters.push(
      new GrainFilter({
        amount: grain.amount,
        size: grain.size,
        chroma: grain.chroma,
        shadows: grain.shadows,
        midtones: grain.midtones,
        highlights: grain.highlights,
        grainShape: grain.grainShape,
        positive: grain.positive,
        resolutionLoss: grain.resolutionLoss,
        seed: context?.grainSeed ?? Math.random(),
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
    const shortSide = context ? Math.min(context.width, context.height) : 0;
    filters.push(
      new ZoomBlurFilter({
        strength: zoomBlur.strength,
        center: context
          ? {
              x: context.width * (zoomBlur.centerX / 100),
              y: context.height * (zoomBlur.centerY / 100),
            }
          : undefined,
        innerRadius: shortSide * (zoomBlur.innerRadius / 100),
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

  if (lensFlare.enabled) {
    filters.push(
      new LensFlareFilter({
        intensity: lensFlare.intensity,
        power: lensFlare.power,
        positionX: lensFlare.positionX,
        positionY: lensFlare.positionY,
        artifacts: lensFlare.artifacts,
        rings: lensFlare.rings,
        streaks: lensFlare.streaks,
        rotation: lensFlare.rotation,
        hue: lensFlare.hue,
        fringe: lensFlare.fringe,
      }),
    );
  }

  if (spinBlur.enabled) {
    filters.push(
      new SpinBlurFilter({
        intensity: spinBlur.intensity,
        blurAmount: spinBlur.blurAmount,
        // positionX/Y in PixiFilterValues are normalised [0,1]; multiply by
        // actual image dimensions to get pixel coordinates (matches ZoomBlur).
        positionX: context ? context.width * spinBlur.positionX : 0,
        positionY: context ? context.height * spinBlur.positionY : 0,
        size: spinBlur.size,
      }),
    );
  }

  if (crt.enabled) {
    filters.push(
      new CrtFilter({
        aberration: crt.aberration,
        noise: crt.noise,
        vignette: crt.vignette,
        rounded: crt.rounded,
        pixelate: crt.pixelate,
        mask: crt.mask,
        bloom: crt.bloom,
        distortion: crt.distortion,
        frame: crt.frame,
      }),
    );
  }

  return filters;
}

export function createHalationSignalFilters(values: PixiFilterValues["halation"]): {
  extract: HalationExtractFilter;
  blur: KawaseBlurFilter;
} {
  const extract = new HalationExtractFilter({
    sourceLimiter: values.sourceLimiter,
    smoothness: values.smoothness,
    hue: values.hue,
  });

  const blur = new KawaseBlurFilter({
    strength: values.localDiffusion * 24 + values.globalDiffusion * 36,
    quality: 5,
  });

  return { extract, blur };
}

export function createHalationCompositeFilter(
  values: PixiFilterValues["halation"],
  halationTexture: Texture,
): HalationCompositeFilter {
  return new HalationCompositeFilter({
    backgroundGain: values.backgroundGain,
    globalDiffusion: values.globalDiffusion,
    amplify: values.amplify,
    blueComp: values.blueComp,
    impact: values.impact,
    halationTexture,
  });
}

function getLightLeakColor(warmth: number): number {
  const t = Math.max(0, Math.min(100, warmth)) / 100;

  // Piecewise lerp: blue (0%) → lavender (50%) → warm (100%)
  let r: number;
  let g: number;
  let b: number;

  if (t < 0.5) {
    const f = t * 2;
    r = 0x9d + (0xcd - 0x9d) * f;
    g = 0xb9 + (0xcd - 0xb9) * f;
    b = 0xff;
  } else {
    const f = (t - 0.5) * 2;
    r = 0xcd + (0xf3 - 0xcd) * f;
    g = 0xcd + (0xff - 0xcd) * f;
    b = 0xff + (0xcc - 0xff) * f;
  }

  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
