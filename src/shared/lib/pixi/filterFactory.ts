import type { Filter, Texture } from "pixi.js";
import { ChromaticAberrationFilter } from "./ChromaticAberrationFilter";
import { CrtFilter } from "./CrtFilter";
import { GrainFilter } from "./GrainFilter";
import { HalationCompositeFilter } from "./HalationCompositeFilter";
import { HalationExtractFilter } from "./HalationExtractFilter";
import { LensFlareFilter } from "./LensFlareFilter";
import { LutFilter } from "./LutFilter";
import { createMirroredBlurFilters } from "./MirroredBlurFilter";
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

// ---------------------------------------------------------------------------
// Pure value conversions
//
// These translate raw `PixiFilterValues` into the exact arguments the filter
// constructors and live setters expect. Both `createPixiFilters` (build) and
// `updateFilterUniforms` (in-place update) route through them, so the two paths
// can never drift apart.
// ---------------------------------------------------------------------------

export function motionBlurKernelSize(kernelSize: number): number {
  const rounded = Math.round(kernelSize);
  const odd = rounded % 2 === 0 ? rounded + 1 : rounded;

  return Math.max(5, odd);
}

export function zoomBlurCenter(
  values: PixiFilterValues["zoomBlur"],
  context?: PixiFilterContext,
): { x: number; y: number } | undefined {
  return context
    ? {
        x: context.width * (values.centerX / 100),
        y: context.height * (values.centerY / 100),
      }
    : undefined;
}

export function zoomBlurInnerRadius(
  values: PixiFilterValues["zoomBlur"],
  context?: PixiFilterContext,
): number {
  const shortSide = context ? Math.min(context.width, context.height) : 0;

  return shortSide * (values.innerRadius / 100);
}

export function spinBlurPosition(
  values: PixiFilterValues["spinBlur"],
  context?: PixiFilterContext,
): { x: number; y: number } {
  // positionX/Y in PixiFilterValues are normalised [0,1]; multiply by actual
  // image dimensions to get pixel coordinates (matches ZoomBlur).
  return {
    x: context ? context.width * values.positionX : 0,
    y: context ? context.height * values.positionY : 0,
  };
}

/**
 * Typed registry of the filter instances retained by the renderer so that a
 * slider drag can write uniforms back onto the live chain instead of rebuilding
 * it. Only filters whose enabled gate is currently satisfied appear here; the
 * keys mirror the enabled-set fingerprint.
 */
export type PixiFilterHandles = {
  tone?: AdjustmentFilter;
  lut?: LutFilter;
  blur?: ReturnType<typeof createMirroredBlurFilters>;
  grain?: GrainFilter;
  lightLeak?: ColorOverlayFilter;
  advancedBloom?: AdvancedBloomFilter;
  dot?: DotFilter;
  glitch?: GlitchFilter;
  glow?: GlowFilter;
  motionBlur?: MotionBlurFilter;
  noise?: SimplexNoiseFilter;
  zoomBlur?: ZoomBlurFilter;
  chromaticAberration?: ChromaticAberrationFilter;
  lensFlare?: LensFlareFilter;
  spinBlur?: SpinBlurFilter;
  crt?: CrtFilter;
};

export function createPixiFilters(
  filterChain: PixiFilterValues,
  context?: PixiFilterContext,
): Filter[] {
  return createPixiFilterChain(filterChain, context).filters;
}

/**
 * Build the live filter chain along with a typed handle registry. The renderer
 * keeps the registry so subsequent value-only changes can update uniforms in
 * place (see {@link updateFilterUniforms}) instead of tearing the chain down.
 */
export function createPixiFilterChain(
  filterChain: PixiFilterValues,
  context?: PixiFilterContext,
): { filters: Filter[]; handles: PixiFilterHandles } {
  const filters: Filter[] = [];
  const handles: PixiFilterHandles = {};
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
    const filter = new AdjustmentFilter({
      brightness: tone.brightness,
      contrast: tone.contrast,
      saturation: tone.saturation,
    });
    handles.tone = filter;
    filters.push(filter);
  }

  if (lut.enabled && lut.intensity > 0) {
    const lutTexture = context?.lutTextures?.get(lut.presetId);

    if (lutTexture !== undefined && lutTexture.source) {
      const filter = new LutFilter({
        intensity: lut.intensity,
        texture: lutTexture,
      });
      handles.lut = filter;
      filters.push(filter);
    } else if (lut.presetId) {
      console.warn(`[LutFilter] texture not found for preset "${lut.presetId}"`);
    }
  }

  if (blur.enabled && blur.strength > 0) {
    const pair = createMirroredBlurFilters(blur.strength);
    handles.blur = pair;
    filters.push(...pair);
  }

  if (grain.enabled && grain.amount > 0) {
    const filter = new GrainFilter({
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
    });
    handles.grain = filter;
    filters.push(filter);
  }

  if (lightLeak.enabled && lightLeak.intensity > 0) {
    const filter = new ColorOverlayFilter({
      color: getLightLeakColor(lightLeak.warmth),
      alpha: lightLeak.intensity,
    });
    handles.lightLeak = filter;
    filters.push(filter);
  }

  if (advancedBloom.enabled) {
    const filter = new AdvancedBloomFilter({
      threshold: advancedBloom.threshold,
      bloomScale: advancedBloom.bloomScale,
      brightness: advancedBloom.brightness,
      blur: advancedBloom.blur,
    });
    handles.advancedBloom = filter;
    filters.push(filter);
  }

  if (dot.enabled) {
    const filter = new DotFilter({
      scale: dot.scale,
      angle: dot.angle,
      grayscale: false,
    });
    handles.dot = filter;
    filters.push(filter);
  }

  if (glitch.enabled) {
    const filter = new GlitchFilter({
      slices: Math.round(glitch.slices),
      offset: glitch.offset,
      direction: glitch.direction,
    });
    handles.glitch = filter;
    filters.push(filter);
  }

  if (glow.enabled) {
    const filter = new GlowFilter({
      distance: glow.distance,
      outerStrength: glow.outerStrength,
      innerStrength: glow.innerStrength,
    });
    handles.glow = filter;
    filters.push(filter);
  }

  if (motionBlur.enabled) {
    const filter = new MotionBlurFilter({
      velocity: { x: motionBlur.velocityX, y: motionBlur.velocityY },
      kernelSize: motionBlurKernelSize(motionBlur.kernelSize),
    });
    handles.motionBlur = filter;
    filters.push(filter);
  }

  if (noise.enabled) {
    const filter = new SimplexNoiseFilter({
      strength: noise.strength,
      noiseScale: noise.noiseScale,
    });
    handles.noise = filter;
    filters.push(filter);
  }

  if (zoomBlur.enabled) {
    const filter = new ZoomBlurFilter({
      strength: zoomBlur.strength,
      center: zoomBlurCenter(zoomBlur, context),
      innerRadius: zoomBlurInnerRadius(zoomBlur, context),
    });
    handles.zoomBlur = filter;
    filters.push(filter);
  }

  if (chromaticAberration.enabled) {
    const filter = new ChromaticAberrationFilter({
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
    });
    handles.chromaticAberration = filter;
    filters.push(filter);
  }

  if (lensFlare.enabled) {
    const filter = new LensFlareFilter({
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
    });
    handles.lensFlare = filter;
    filters.push(filter);
  }

  if (spinBlur.enabled) {
    const position = spinBlurPosition(spinBlur, context);
    const filter = new SpinBlurFilter({
      intensity: spinBlur.intensity,
      blurAmount: spinBlur.blurAmount,
      positionX: position.x,
      positionY: position.y,
      size: spinBlur.size,
    });
    handles.spinBlur = filter;
    filters.push(filter);
  }

  if (crt.enabled) {
    const filter = new CrtFilter({
      aberration: crt.aberration,
      noise: crt.noise,
      vignette: crt.vignette,
      rounded: crt.rounded,
      pixelate: crt.pixelate,
      mask: crt.mask,
      bloom: crt.bloom,
      distortion: crt.distortion,
      frame: crt.frame,
    });
    handles.crt = filter;
    filters.push(filter);
  }

  return { filters, handles };
}

/**
 * Ordered list of the filter keys whose enabled gate is currently satisfied —
 * the exact gates `createPixiFilterChain` uses. Two value sets with the same
 * fingerprint produce the same chain *topology*, so a drag between them can be
 * served by an in-place uniform update. `halation.enabled` is included because
 * it switches the whole pipeline shape; the renderer additionally forces a
 * rebuild whenever halation is involved.
 */
export function getFilterFingerprint(values: PixiFilterValues): string {
  const keys: string[] = [];

  if (values.tone.enabled) keys.push("tone");
  if (values.lut.enabled && values.lut.intensity > 0) keys.push(`lut:${values.lut.presetId}`);
  if (values.blur.enabled && values.blur.strength > 0) keys.push("blur");
  if (values.grain.enabled && values.grain.amount > 0) keys.push("grain");
  if (values.lightLeak.enabled && values.lightLeak.intensity > 0) keys.push("lightLeak");
  if (values.advancedBloom.enabled) keys.push("advancedBloom");
  if (values.dot.enabled) keys.push("dot");
  if (values.glitch.enabled) keys.push("glitch");
  if (values.glow.enabled) keys.push("glow");
  if (values.motionBlur.enabled) keys.push("motionBlur");
  if (values.noise.enabled) keys.push("noise");
  if (values.zoomBlur.enabled) keys.push("zoomBlur");
  if (values.chromaticAberration.enabled) keys.push("chromaticAberration");
  if (values.lensFlare.enabled) keys.push("lensFlare");
  if (values.spinBlur.enabled) keys.push("spinBlur");
  if (values.crt.enabled) keys.push("crt");
  if (values.halation.enabled) keys.push("halation");

  return keys.join("|");
}

/**
 * Write the latest values onto retained filter instances. Caller guarantees the
 * enabled-set fingerprint is unchanged, so every present handle still has a
 * matching enabled gate. LUT preset and texture identity never change here (a
 * preset switch changes the fingerprint and forces a rebuild), so only the LUT
 * intensity is updated.
 */
export function updateFilterUniforms(
  handles: PixiFilterHandles,
  values: PixiFilterValues,
  context?: PixiFilterContext,
): void {
  if (handles.tone) {
    handles.tone.brightness = values.tone.brightness;
    handles.tone.contrast = values.tone.contrast;
    handles.tone.saturation = values.tone.saturation;
  }

  if (handles.lut) {
    handles.lut.intensity = values.lut.intensity;
  }

  if (handles.blur) {
    for (const pass of handles.blur) {
      pass.strength = values.blur.strength;
    }
  }

  if (handles.grain) {
    const grain = values.grain;
    handles.grain.amount = grain.amount;
    handles.grain.size = grain.size;
    handles.grain.chroma = grain.chroma;
    handles.grain.shadows = grain.shadows;
    handles.grain.midtones = grain.midtones;
    handles.grain.highlights = grain.highlights;
    handles.grain.grainShape = grain.grainShape;
    handles.grain.positive = grain.positive;
    handles.grain.resolutionLoss = grain.resolutionLoss;
  }

  if (handles.lightLeak) {
    handles.lightLeak.color = getLightLeakColor(values.lightLeak.warmth);
    handles.lightLeak.alpha = values.lightLeak.intensity;
  }

  if (handles.advancedBloom) {
    const bloom = values.advancedBloom;
    handles.advancedBloom.threshold = bloom.threshold;
    handles.advancedBloom.bloomScale = bloom.bloomScale;
    handles.advancedBloom.brightness = bloom.brightness;
    handles.advancedBloom.blur = bloom.blur;
  }

  if (handles.dot) {
    handles.dot.scale = values.dot.scale;
    handles.dot.angle = values.dot.angle;
  }

  if (handles.glitch) {
    handles.glitch.slices = Math.round(values.glitch.slices);
    handles.glitch.offset = values.glitch.offset;
    handles.glitch.direction = values.glitch.direction;
  }

  if (handles.glow) {
    handles.glow.distance = values.glow.distance;
    handles.glow.outerStrength = values.glow.outerStrength;
    handles.glow.innerStrength = values.glow.innerStrength;
  }

  if (handles.motionBlur) {
    handles.motionBlur.velocity = {
      x: values.motionBlur.velocityX,
      y: values.motionBlur.velocityY,
    };
    handles.motionBlur.kernelSize = motionBlurKernelSize(values.motionBlur.kernelSize);
  }

  if (handles.noise) {
    handles.noise.strength = values.noise.strength;
    handles.noise.noiseScale = values.noise.noiseScale;
  }

  if (handles.zoomBlur) {
    const center = zoomBlurCenter(values.zoomBlur, context);
    handles.zoomBlur.strength = values.zoomBlur.strength;
    if (center) {
      handles.zoomBlur.center = center;
    }
    handles.zoomBlur.innerRadius = zoomBlurInnerRadius(values.zoomBlur, context);
  }

  if (handles.chromaticAberration) {
    const ca = values.chromaticAberration;
    handles.chromaticAberration.offsetX = ca.offsetX;
    handles.chromaticAberration.offsetY = ca.offsetY;
    handles.chromaticAberration.redX = ca.redX;
    handles.chromaticAberration.redY = ca.redY;
    handles.chromaticAberration.blueX = ca.blueX;
    handles.chromaticAberration.blueY = ca.blueY;
    handles.chromaticAberration.radial = ca.radial;
    handles.chromaticAberration.twist = ca.twist;
    handles.chromaticAberration.centerX = ca.centerX;
    handles.chromaticAberration.centerY = ca.centerY;
  }

  if (handles.lensFlare) {
    const flare = values.lensFlare;
    handles.lensFlare.intensity = flare.intensity;
    handles.lensFlare.power = flare.power;
    handles.lensFlare.positionX = flare.positionX;
    handles.lensFlare.positionY = flare.positionY;
    handles.lensFlare.artifacts = flare.artifacts;
    handles.lensFlare.rings = flare.rings;
    handles.lensFlare.streaks = flare.streaks;
    handles.lensFlare.rotation = flare.rotation;
    handles.lensFlare.hue = flare.hue;
    handles.lensFlare.fringe = flare.fringe;
  }

  if (handles.spinBlur) {
    const position = spinBlurPosition(values.spinBlur, context);
    handles.spinBlur.intensity = values.spinBlur.intensity;
    handles.spinBlur.blurAmount = values.spinBlur.blurAmount;
    handles.spinBlur.positionX = position.x;
    handles.spinBlur.positionY = position.y;
    handles.spinBlur.size = values.spinBlur.size;
  }

  if (handles.crt) {
    const crt = values.crt;
    handles.crt.aberration = crt.aberration;
    handles.crt.noise = crt.noise;
    handles.crt.vignette = crt.vignette;
    handles.crt.rounded = crt.rounded;
    handles.crt.pixelate = crt.pixelate;
    handles.crt.mask = crt.mask;
    handles.crt.bloom = crt.bloom;
    handles.crt.distortion = crt.distortion;
    handles.crt.frame = crt.frame;
  }
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
