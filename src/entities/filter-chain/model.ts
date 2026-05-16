import { createEvent, createStore } from "effector";
import type { PixiFilterValues } from "../../shared/lib/pixi/filterTypes";

const FILTER_IDS = [
  "tone",
  "blur",
  "grain",
  "lightLeak",
  "advancedBloom",
  "dot",
  "glitch",
  "glow",
  "motionBlur",
  "noise",
  "zoomBlur",
  "chromaticAberration",
] as const;

export type FilterId = (typeof FILTER_IDS)[number];

export type FilterParameterDefinition = {
  defaultValue: number;
  id: string;
  label: string;
  max: number;
  min: number;
  step: number;
  unit?: string;
};

export type FilterDefinition = {
  description: string;
  id: FilterId;
  parameters: readonly FilterParameterDefinition[];
  title: string;
};

export type FilterState = {
  added: boolean;
  enabled: boolean;
  parameters: Record<string, number>;
};

export type FilterChainState = Record<FilterId, FilterState>;

export type FilterParameterChangedPayload = {
  filterId: FilterId;
  parameterId: string;
  value: number;
};

export const FILTER_DEFINITIONS: readonly FilterDefinition[] = [
  {
    id: "tone",
    title: "Tone",
    description: "Brightness, contrast and color density.",
    parameters: [
      {
        id: "brightness",
        label: "Brightness",
        min: 0.6,
        max: 1.4,
        step: 0.01,
        defaultValue: 1,
      },
      {
        id: "contrast",
        label: "Contrast",
        min: 0.6,
        max: 1.6,
        step: 0.01,
        defaultValue: 1,
      },
      {
        id: "saturation",
        label: "Saturation",
        min: 0,
        max: 2,
        step: 0.01,
        defaultValue: 1,
      },
    ],
  },
  {
    id: "blur",
    title: "Blur",
    description: "Kawase GPU blur for diffusion and polish.",
    parameters: [
      {
        id: "strength",
        label: "Strength",
        min: 0,
        max: 18,
        step: 0.5,
        defaultValue: 4,
        unit: "px",
      },
    ],
  },
  {
    id: "grain",
    title: "Grain",
    description: "Fine noise for film texture.",
    parameters: [
      {
        id: "intensity",
        label: "Intensity",
        min: 0,
        max: 0.55,
        step: 0.01,
        defaultValue: 0.14,
      },
    ],
  },
  {
    id: "lightLeak",
    title: "Light Leak",
    description: "Tinted overlay for editorial warmth.",
    parameters: [
      {
        id: "intensity",
        label: "Intensity",
        min: 0,
        max: 0.36,
        step: 0.01,
        defaultValue: 0.16,
      },
      {
        id: "warmth",
        label: "Warmth",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 68,
        unit: "%",
      },
    ],
  },
  {
    id: "advancedBloom",
    title: "Advanced Bloom",
    description: "Bloom glow with brightness threshold control.",
    parameters: [
      {
        id: "threshold",
        label: "Threshold",
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.5,
      },
      {
        id: "bloomScale",
        label: "Bloom Scale",
        min: 0,
        max: 3,
        step: 0.05,
        defaultValue: 1,
        unit: "x",
      },
      {
        id: "brightness",
        label: "Brightness",
        min: 0,
        max: 2,
        step: 0.05,
        defaultValue: 1,
      },
      {
        id: "blur",
        label: "Blur",
        min: 0,
        max: 20,
        step: 0.5,
        defaultValue: 2,
        unit: "px",
      },
    ],
  },
  {
    id: "dot",
    title: "Dot",
    description: "Halftone dot-screen effect.",
    parameters: [
      {
        id: "scale",
        label: "Scale",
        min: 0.3,
        max: 5,
        step: 0.1,
        defaultValue: 1,
        unit: "x",
      },
      {
        id: "angle",
        label: "Angle",
        min: 0,
        max: 360,
        step: 1,
        defaultValue: 5,
        unit: "°",
      },
    ],
  },
  {
    id: "glitch",
    title: "Glitch",
    description: "Displaced scan-line glitch effect.",
    parameters: [
      {
        id: "slices",
        label: "Slices",
        min: 2,
        max: 20,
        step: 1,
        defaultValue: 5,
        unit: "int",
      },
      {
        id: "offset",
        label: "Offset",
        min: 0,
        max: 200,
        step: 1,
        defaultValue: 100,
        unit: "px",
      },
      {
        id: "direction",
        label: "Direction",
        min: 0,
        max: 360,
        step: 1,
        defaultValue: 0,
        unit: "°",
      },
    ],
  },
  {
    id: "glow",
    title: "Glow",
    description: "Edge glow emanating from bright areas.",
    parameters: [
      {
        id: "distance",
        label: "Distance",
        min: 2,
        max: 30,
        step: 1,
        defaultValue: 10,
        unit: "px",
      },
      {
        id: "outerStrength",
        label: "Outer Strength",
        min: 0,
        max: 10,
        step: 0.1,
        defaultValue: 4,
        unit: "x",
      },
      {
        id: "innerStrength",
        label: "Inner Strength",
        min: 0,
        max: 5,
        step: 0.1,
        defaultValue: 0,
        unit: "x",
      },
    ],
  },
  {
    id: "motionBlur",
    title: "Motion Blur",
    description: "Directional velocity blur.",
    parameters: [
      {
        id: "velocityX",
        label: "Velocity X",
        min: -50,
        max: 50,
        step: 1,
        defaultValue: 0,
        unit: "px",
      },
      {
        id: "velocityY",
        label: "Velocity Y",
        min: -50,
        max: 50,
        step: 1,
        defaultValue: 0,
        unit: "px",
      },
      {
        id: "kernelSize",
        label: "Kernel Size",
        min: 5,
        max: 25,
        step: 2,
        defaultValue: 5,
        unit: "int",
      },
    ],
  },
  {
    id: "noise",
    title: "Noise",
    description: "Simplex noise texture overlay.",
    parameters: [
      {
        id: "strength",
        label: "Strength",
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.5,
      },
      {
        id: "noiseScale",
        label: "Scale",
        min: 1,
        max: 50,
        step: 1,
        defaultValue: 10,
        unit: "int",
      },
    ],
  },
  {
    id: "zoomBlur",
    title: "Zoom Blur",
    description: "Radial zoom blur from the center.",
    parameters: [
      {
        id: "strength",
        label: "Strength",
        min: 0,
        max: 0.5,
        step: 0.005,
        defaultValue: 0.1,
      },
      {
        id: "innerRadius",
        label: "Inner Radius",
        min: 0,
        max: 500,
        step: 5,
        defaultValue: 0,
        unit: "px",
      },
    ],
  },
  {
    id: "chromaticAberration",
    title: "Chromatic Aberration",
    description: "RGB channel dispersion effect.",
    parameters: [
      {
        id: "intensity",
        label: "Intensity",
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0,
      },
      {
        id: "offset",
        label: "Offset",
        min: 0,
        max: 0.05,
        step: 0.001,
        defaultValue: 0.01,
      },
      {
        id: "angle",
        label: "Angle",
        min: -180,
        max: 180,
        step: 1,
        defaultValue: 0,
        unit: "°",
      },
    ],
  },
];

export const filterAdded = createEvent<FilterId>();
export const filterRemoved = createEvent<FilterId>();
export const filterToggled = createEvent<FilterId>();
export const filterParameterChanged = createEvent<FilterParameterChangedPayload>();
export const filtersReset = createEvent();

export const $filterChain = createStore<FilterChainState>(createInitialFilterState())
  .on(filterAdded, addFilterToChain)
  .on(filterRemoved, removeFilterFromChain)
  .on(filterToggled, toggleFilterState)
  .on(filterParameterChanged, updateFilterParameterState)
  .reset(filtersReset);

export const $addedFilterDefinitions = $filterChain.map((state) =>
  FILTER_DEFINITIONS.filter((definition) => state[definition.id].added),
);

export const $hasActiveFilters = $filterChain.map((state) =>
  FILTER_DEFINITIONS.some((definition) => state[definition.id].added),
);

export function createInitialFilterState(): FilterChainState {
  const state = {} as FilterChainState;

  for (const definition of FILTER_DEFINITIONS) {
    state[definition.id] = {
      added: false,
      enabled: false,
      parameters: createDefaultParameters(definition),
    };
  }

  return state;
}

export function addFilterToChain(state: FilterChainState, filterId: FilterId): FilterChainState {
  return {
    ...state,
    [filterId]: {
      ...state[filterId],
      added: true,
      enabled: true,
    },
  };
}

export function removeFilterFromChain(
  state: FilterChainState,
  filterId: FilterId,
): FilterChainState {
  return {
    ...state,
    [filterId]: {
      ...state[filterId],
      added: false,
      enabled: false,
    },
  };
}

export function toggleFilterState(state: FilterChainState, filterId: FilterId): FilterChainState {
  return {
    ...state,
    [filterId]: {
      ...state[filterId],
      enabled: !state[filterId].enabled,
    },
  };
}

export function updateFilterParameterState(
  state: FilterChainState,
  payload: FilterParameterChangedPayload,
): FilterChainState {
  const parameter = findFilterParameterDefinition(payload.filterId, payload.parameterId);

  if (parameter === undefined) {
    return state;
  }

  return {
    ...state,
    [payload.filterId]: {
      ...state[payload.filterId],
      parameters: {
        ...state[payload.filterId].parameters,
        [payload.parameterId]: clamp(payload.value, parameter.min, parameter.max),
      },
    },
  };
}

export function findFilterDefinition(filterId: FilterId): FilterDefinition {
  const definition = FILTER_DEFINITIONS.find((item) => item.id === filterId);

  if (definition === undefined) {
    throw new Error(`Unknown filter: ${filterId}`);
  }

  return definition;
}

export function findFilterParameterDefinition(
  filterId: FilterId,
  parameterId: string,
): FilterParameterDefinition | undefined {
  return findFilterDefinition(filterId).parameters.find(
    (parameter) => parameter.id === parameterId,
  );
}

export function formatParameterValue(parameter: FilterParameterDefinition, value: number): string {
  if (parameter.unit === "%") {
    return `${Math.round(value)}%`;
  }

  if (parameter.unit === "px") {
    return `${value.toFixed(value % 1 === 0 ? 0 : 1)}px`;
  }

  if (parameter.unit === "°") {
    return `${Math.round(value)}°`;
  }

  if (parameter.unit === "int") {
    return `${Math.round(value)}`;
  }

  if (parameter.unit === "x") {
    return `${value.toFixed(1)}×`;
  }

  return `${Math.round(value * 100)}%`;
}

export function toPixiFilterValues(filterChain: FilterChainState): PixiFilterValues {
  return {
    tone: {
      enabled: filterChain.tone.enabled,
      brightness: filterChain.tone.parameters.brightness,
      contrast: filterChain.tone.parameters.contrast,
      saturation: filterChain.tone.parameters.saturation,
    },
    blur: {
      enabled: filterChain.blur.enabled,
      strength: filterChain.blur.parameters.strength,
    },
    grain: {
      enabled: filterChain.grain.enabled,
      intensity: filterChain.grain.parameters.intensity,
    },
    lightLeak: {
      enabled: filterChain.lightLeak.enabled,
      intensity: filterChain.lightLeak.parameters.intensity,
      warmth: filterChain.lightLeak.parameters.warmth,
    },
    advancedBloom: {
      enabled: filterChain.advancedBloom.enabled,
      threshold: filterChain.advancedBloom.parameters.threshold,
      bloomScale: filterChain.advancedBloom.parameters.bloomScale,
      brightness: filterChain.advancedBloom.parameters.brightness,
      blur: filterChain.advancedBloom.parameters.blur,
    },
    dot: {
      enabled: filterChain.dot.enabled,
      scale: filterChain.dot.parameters.scale,
      angle: filterChain.dot.parameters.angle,
    },
    glitch: {
      enabled: filterChain.glitch.enabled,
      slices: filterChain.glitch.parameters.slices,
      offset: filterChain.glitch.parameters.offset,
      direction: filterChain.glitch.parameters.direction,
    },
    glow: {
      enabled: filterChain.glow.enabled,
      distance: filterChain.glow.parameters.distance,
      outerStrength: filterChain.glow.parameters.outerStrength,
      innerStrength: filterChain.glow.parameters.innerStrength,
    },
    motionBlur: {
      enabled: filterChain.motionBlur.enabled,
      velocityX: filterChain.motionBlur.parameters.velocityX,
      velocityY: filterChain.motionBlur.parameters.velocityY,
      kernelSize: filterChain.motionBlur.parameters.kernelSize,
    },
    noise: {
      enabled: filterChain.noise.enabled,
      strength: filterChain.noise.parameters.strength,
      noiseScale: filterChain.noise.parameters.noiseScale,
    },
    zoomBlur: {
      enabled: filterChain.zoomBlur.enabled,
      strength: filterChain.zoomBlur.parameters.strength,
      innerRadius: filterChain.zoomBlur.parameters.innerRadius,
    },
    chromaticAberration: {
      enabled: filterChain.chromaticAberration.enabled,
      offsetX: filterChain.chromaticAberration.parameters.offset,
      offsetY: 0,
      redX: 0,
      redY: 0,
      blueX: 0,
      blueY: 0,
      radial: filterChain.chromaticAberration.parameters.intensity,
      twist: filterChain.chromaticAberration.parameters.angle,
      centerX: 0.5,
      centerY: 0.5,
    },
  };
}

function createDefaultParameters(definition: FilterDefinition): Record<string, number> {
  return Object.fromEntries(
    definition.parameters.map((parameter) => [parameter.id, parameter.defaultValue]),
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
