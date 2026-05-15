export type PixiFilterValues = {
  blur: {
    enabled: boolean;
    strength: number;
  };
  grain: {
    enabled: boolean;
    intensity: number;
  };
  lightLeak: {
    enabled: boolean;
    intensity: number;
    warmth: number;
  };
  tone: {
    brightness: number;
    contrast: number;
    enabled: boolean;
    saturation: number;
  };
};

export function createEmptyPixiFilterValues(): PixiFilterValues {
  return {
    tone: {
      enabled: false,
      brightness: 1,
      contrast: 1,
      saturation: 1,
    },
    blur: {
      enabled: false,
      strength: 0,
    },
    grain: {
      enabled: false,
      intensity: 0,
    },
    lightLeak: {
      enabled: false,
      intensity: 0,
      warmth: 68,
    },
  };
}
