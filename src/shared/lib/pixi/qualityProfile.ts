/**
 * Adaptive quality profile for the live preview. Resolved once at renderer init
 * from device signals; it only affects the on-screen *preview* bake — the export
 * path always renders at full native resolution regardless of profile.
 */
export type QualityProfile = "mobile" | "desktop";

export type QualityProfileSettings = {
  /**
   * Longest-side pixel cap for the baked preview texture. The on-screen sprite is
   * already downscaled to fit the canvas, so a capped bake is visually equivalent
   * while costing far less GPU fill. Export ignores this.
   */
  previewMaxDimension: number;
};

const PROFILE_SETTINGS: Record<QualityProfile, QualityProfileSettings> = {
  mobile: { previewMaxDimension: 1600 },
  desktop: { previewMaxDimension: 2560 },
};

type DeviceSignals = {
  coarsePointer?: boolean;
  hardwareConcurrency?: number;
  devicePixelRatio?: number;
};

/**
 * Pick a quality profile from device signals. Treats coarse-pointer (touch) or
 * low core count as "mobile". Safe to call in non-DOM environments — falls back
 * to "desktop" when signals are unavailable.
 */
export function resolveQualityProfile(signals?: DeviceSignals): QualityProfile {
  const resolved: DeviceSignals = signals ?? readDeviceSignals();
  const lowCores =
    typeof resolved.hardwareConcurrency === "number" && resolved.hardwareConcurrency <= 4;

  if (resolved.coarsePointer === true || lowCores) {
    return "mobile";
  }

  return "desktop";
}

export function getQualityProfileSettings(profile: QualityProfile): QualityProfileSettings {
  return PROFILE_SETTINGS[profile];
}

/**
 * Resolution scale (≤ 1) for baking a `width × height` image under a profile so
 * its longest side does not exceed `previewMaxDimension`. Returns 1 when the
 * image already fits (never upscales).
 */
export function previewResolutionScale(
  width: number,
  height: number,
  profile: QualityProfile,
): number {
  const longestSide = Math.max(width, height);

  if (longestSide <= 0) {
    return 1;
  }

  const { previewMaxDimension } = PROFILE_SETTINGS[profile];

  return Math.min(1, previewMaxDimension / longestSide);
}

function readDeviceSignals(): DeviceSignals {
  if (typeof window === "undefined") {
    return {};
  }

  return {
    coarsePointer:
      typeof window.matchMedia === "function"
        ? window.matchMedia("(pointer: coarse)").matches
        : undefined,
    hardwareConcurrency:
      typeof navigator !== "undefined" ? navigator.hardwareConcurrency : undefined,
    devicePixelRatio: window.devicePixelRatio,
  };
}
