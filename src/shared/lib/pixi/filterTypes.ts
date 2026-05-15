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
  advancedBloom: {
    enabled: boolean;
    threshold: number;
    bloomScale: number;
    brightness: number;
    blur: number;
  };
  dot: {
    enabled: boolean;
    scale: number;
    angle: number;
  };
  glitch: {
    enabled: boolean;
    slices: number;
    offset: number;
    direction: number;
  };
  glow: {
    enabled: boolean;
    distance: number;
    outerStrength: number;
    innerStrength: number;
  };
  motionBlur: {
    enabled: boolean;
    velocityX: number;
    velocityY: number;
    kernelSize: number;
  };
  noise: {
    enabled: boolean;
    strength: number;
    noiseScale: number;
  };
  zoomBlur: {
    enabled: boolean;
    strength: number;
    innerRadius: number;
  };
  chromaticAberration: {
    enabled: boolean;
    offsetX: number;
    offsetY: number;
    redX: number;
    redY: number;
    blueX: number;
    blueY: number;
    radial: number;
    twist: number;
    centerX: number;
    centerY: number;
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
    advancedBloom: {
      enabled: false,
      threshold: 0.5,
      bloomScale: 1,
      brightness: 1,
      blur: 2,
    },
    dot: {
      enabled: false,
      scale: 1,
      angle: 5,
    },
    glitch: {
      enabled: false,
      slices: 5,
      offset: 100,
      direction: 0,
    },
    glow: {
      enabled: false,
      distance: 10,
      outerStrength: 4,
      innerStrength: 0,
    },
    motionBlur: {
      enabled: false,
      velocityX: 0,
      velocityY: 0,
      kernelSize: 5,
    },
    noise: {
      enabled: false,
      strength: 0.5,
      noiseScale: 10,
    },
    zoomBlur: {
      enabled: false,
      strength: 0.1,
      innerRadius: 0,
    },
    chromaticAberration: {
      enabled: false,
      offsetX: 0.01,
      offsetY: 0,
      redX: 0,
      redY: 0,
      blueX: 0,
      blueY: 0,
      radial: 0,
      twist: 0,
      centerX: 0.5,
      centerY: 0.5,
    },
  };
}
