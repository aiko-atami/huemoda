export type PixiFilterValues = {
  blur: {
    enabled: boolean;
    strength: number;
  };
  grain: {
    enabled: boolean;
    intensity: number;
    grainSize: number;
  };
  grainV2: {
    enabled: boolean;
    amount: number;
    size: number;
    chroma: number;
    shadows: number;
    midtones: number;
    highlights: number;
    grainShape: number;
    positive: number;
    resolutionLoss: number;
  };
  lut: {
    enabled: boolean;
    intensity: number;
    presetId: string;
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
    centerX: number;
    centerY: number;
    enabled: boolean;
    innerRadius: number;
    strength: number;
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
  lensFlare: {
    enabled: boolean;
    intensity: number;
    power: number;
    positionX: number;
    positionY: number;
    artifacts: number;
    rings: number;
    streaks: number;
    rotation: number;
    hue: number;
    fringe: number;
  };
  spinBlur: {
    enabled: boolean;
    intensity: number;
    blurAmount: number;
    positionX: number;
    positionY: number;
    size: number;
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
      grainSize: 1.25,
    },
    grainV2: {
      enabled: false,
      amount: 0.1,
      size: 0.5,
      chroma: 0.3,
      shadows: 0.7,
      midtones: 0.4,
      highlights: 0.8,
      grainShape: 0.0,
      positive: 1.0,
      resolutionLoss: 0.12,
    },
    lut: {
      enabled: false,
      intensity: 0.8,
      presetId: "warmEditorial",
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
      centerX: 50,
      centerY: 50,
      enabled: false,
      innerRadius: 0,
      strength: 0.1,
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
    lensFlare: {
      enabled: false,
      intensity: 0.5,
      power: 3,
      positionX: 0.3,
      positionY: 0.25,
      artifacts: 0.5,
      rings: 0.3,
      streaks: 2,
      rotation: 0,
      hue: 0,
      fringe: 0,
    },
    spinBlur: {
      enabled: false,
      intensity: 0.8,
      blurAmount: 3.6,
      positionX: 0.5,
      positionY: 0.5,
      size: 0.5,
    },
  };
}
