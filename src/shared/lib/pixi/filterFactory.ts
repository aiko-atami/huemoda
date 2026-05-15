import { BlurFilter, NoiseFilter } from "pixi.js";
import type { Filter } from "pixi.js";
import { AdjustmentFilter, ColorOverlayFilter } from "pixi-filters";
import type { PixiFilterValues } from "./filterTypes";

export function createPixiFilters(filterChain: PixiFilterValues): Filter[] {
  const filters: Filter[] = [];
  const tone = filterChain.tone;
  const blur = filterChain.blur;
  const grain = filterChain.grain;
  const lightLeak = filterChain.lightLeak;

  if (tone.enabled) {
    filters.push(
      new AdjustmentFilter({
        brightness: tone.brightness,
        contrast: tone.contrast,
        saturation: tone.saturation,
      }),
    );
  }

  if (blur.enabled && blur.strength > 0) {
    filters.push(
      new BlurFilter({
        strength: blur.strength,
        quality: 4,
        kernelSize: 7,
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
