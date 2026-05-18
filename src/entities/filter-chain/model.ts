import { createEvent, createStore } from "effector";
import type { PixiFilterValues } from "../../shared/lib/pixi";
import { DEFAULT_LUT_PRESET_ID, LUT_PRESETS } from "../../shared/lib/pixi";
import type { LutPreset, LutPresetId } from "../../shared/lib/pixi";

const FILTER_IDS = [
  "tone",
  "lut",
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

export { DEFAULT_LUT_PRESET_ID, LUT_PRESETS };
export type { LutPreset, LutPresetId };

export type RangeFilterParameterDefinition = {
  defaultValue: number;
  id: string;
  label: string;
  max: number;
  min: number;
  step: number;
  type: "range";
  unit?: string;
};

export type SelectFilterParameterDefinition = {
  defaultValue: string;
  id: string;
  label: string;
  options: readonly {
    label: string;
    value: string;
  }[];
  type: "select";
};

export type PointFilterParameterDefinition = {
  defaultX: number;
  defaultY: number;
  id: string;
  label: string;
  type: "point";
  xId: string;
  yId: string;
};

export type FilterParameterDefinition =
  | RangeFilterParameterDefinition
  | SelectFilterParameterDefinition
  | PointFilterParameterDefinition;

export type FilterDefinition = {
  description: string;
  id: FilterId;
  parameters: readonly FilterParameterDefinition[];
  title: string;
};

export type FilterState = {
  added: boolean;
  enabled: boolean;
  parameters: Record<string, number | string>;
};

export type FilterChainState = Record<FilterId, FilterState>;

export type FilterParameterChangedPayload = {
  filterId: FilterId;
  parameterId: string;
  value: number | string;
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
        type: "range",
        min: 0.6,
        max: 1.4,
        step: 0.01,
        defaultValue: 1,
      },
      {
        id: "contrast",
        label: "Contrast",
        type: "range",
        min: 0.6,
        max: 1.6,
        step: 0.01,
        defaultValue: 1,
      },
      {
        id: "saturation",
        label: "Saturation",
        type: "range",
        min: 0,
        max: 2,
        step: 0.01,
        defaultValue: 1,
      },
    ],
  },
  {
    id: "lut",
    title: "LUT",
    description: "Built-in color-grade atlas presets.",
    parameters: [
      {
        id: "presetId",
        label: "Preset",
        type: "select",
        defaultValue: DEFAULT_LUT_PRESET_ID,
        options: LUT_PRESETS.map((preset) => ({
          label: preset.label,
          value: preset.id,
        })),
      },
      {
        id: "intensity",
        label: "Intensity",
        type: "range",
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.35,
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
        type: "range",
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
        type: "range",
        min: 0,
        max: 0.55,
        step: 0.01,
        defaultValue: 0.07,
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
        type: "range",
        min: 0,
        max: 0.36,
        step: 0.01,
        defaultValue: 0.16,
      },
      {
        id: "warmth",
        label: "Warmth",
        type: "range",
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
        type: "range",
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.5,
      },
      {
        id: "bloomScale",
        label: "Bloom Scale",
        type: "range",
        min: 0,
        max: 3,
        step: 0.05,
        defaultValue: 1,
        unit: "x",
      },
      {
        id: "brightness",
        label: "Brightness",
        type: "range",
        min: 0,
        max: 2,
        step: 0.05,
        defaultValue: 1,
      },
      {
        id: "blur",
        label: "Blur",
        type: "range",
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
        type: "range",
        min: 0.3,
        max: 5,
        step: 0.1,
        defaultValue: 1,
        unit: "x",
      },
      {
        id: "angle",
        label: "Angle",
        type: "range",
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
        type: "range",
        min: 2,
        max: 20,
        step: 1,
        defaultValue: 5,
        unit: "int",
      },
      {
        id: "offset",
        label: "Offset",
        type: "range",
        min: 0,
        max: 200,
        step: 1,
        defaultValue: 100,
        unit: "px",
      },
      {
        id: "direction",
        label: "Direction",
        type: "range",
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
        type: "range",
        min: 2,
        max: 30,
        step: 1,
        defaultValue: 10,
        unit: "px",
      },
      {
        id: "outerStrength",
        label: "Outer Strength",
        type: "range",
        min: 0,
        max: 10,
        step: 0.1,
        defaultValue: 4,
        unit: "x",
      },
      {
        id: "innerStrength",
        label: "Inner Strength",
        type: "range",
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
        type: "range",
        min: -50,
        max: 50,
        step: 1,
        defaultValue: 0,
        unit: "px",
      },
      {
        id: "velocityY",
        label: "Velocity Y",
        type: "range",
        min: -50,
        max: 50,
        step: 1,
        defaultValue: 0,
        unit: "px",
      },
      {
        id: "kernelSize",
        label: "Kernel Size",
        type: "range",
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
        type: "range",
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.5,
      },
      {
        id: "noiseScale",
        label: "Scale",
        type: "range",
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
    description: "Radial zoom blur from a controllable center.",
    parameters: [
      {
        id: "strength",
        label: "Strength",
        type: "range",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 20,
        unit: "%",
      },
      {
        id: "innerRadius",
        label: "Inner Radius",
        type: "range",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 0,
        unit: "%",
      },
      {
        id: "center",
        label: "Center",
        type: "point",
        xId: "centerX",
        yId: "centerY",
        defaultX: 50,
        defaultY: 50,
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
        type: "range",
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.25,
      },
      {
        id: "offset",
        label: "Offset",
        type: "range",
        min: 0,
        max: 50,
        step: 1,
        defaultValue: 1,
        unit: "int",
      },
      {
        id: "angle",
        label: "Angle",
        type: "range",
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

  const nextValue = resolveParameterValue(parameter, payload.value);

  if (nextValue === undefined) {
    return state;
  }

  return {
    ...state,
    [payload.filterId]: {
      ...state[payload.filterId],
      parameters: {
        ...state[payload.filterId].parameters,
        [payload.parameterId]: nextValue,
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
  return findFilterDefinition(filterId).parameters.find((parameter) => {
    if (parameter.type === "point") {
      return parameter.xId === parameterId || parameter.yId === parameterId;
    }
    return parameter.id === parameterId;
  });
}

export function formatParameterValue(
  parameter: RangeFilterParameterDefinition,
  value: number,
): string {
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
      brightness: getNumericParameter(filterChain.tone, "brightness"),
      contrast: getNumericParameter(filterChain.tone, "contrast"),
      saturation: getNumericParameter(filterChain.tone, "saturation"),
    },
    lut: {
      enabled: filterChain.lut.enabled,
      intensity: getNumericParameter(filterChain.lut, "intensity"),
      presetId: getStringParameter(filterChain.lut, "presetId"),
    },
    blur: {
      enabled: filterChain.blur.enabled,
      strength: getNumericParameter(filterChain.blur, "strength"),
    },
    grain: {
      enabled: filterChain.grain.enabled,
      intensity: getNumericParameter(filterChain.grain, "intensity"),
    },
    lightLeak: {
      enabled: filterChain.lightLeak.enabled,
      intensity: getNumericParameter(filterChain.lightLeak, "intensity"),
      warmth: getNumericParameter(filterChain.lightLeak, "warmth"),
    },
    advancedBloom: {
      enabled: filterChain.advancedBloom.enabled,
      threshold: getNumericParameter(filterChain.advancedBloom, "threshold"),
      bloomScale: getNumericParameter(filterChain.advancedBloom, "bloomScale"),
      brightness: getNumericParameter(filterChain.advancedBloom, "brightness"),
      blur: getNumericParameter(filterChain.advancedBloom, "blur"),
    },
    dot: {
      enabled: filterChain.dot.enabled,
      scale: getNumericParameter(filterChain.dot, "scale"),
      angle: getNumericParameter(filterChain.dot, "angle"),
    },
    glitch: {
      enabled: filterChain.glitch.enabled,
      slices: getNumericParameter(filterChain.glitch, "slices"),
      offset: getNumericParameter(filterChain.glitch, "offset"),
      direction: getNumericParameter(filterChain.glitch, "direction"),
    },
    glow: {
      enabled: filterChain.glow.enabled,
      distance: getNumericParameter(filterChain.glow, "distance"),
      outerStrength: getNumericParameter(filterChain.glow, "outerStrength"),
      innerStrength: getNumericParameter(filterChain.glow, "innerStrength"),
    },
    motionBlur: {
      enabled: filterChain.motionBlur.enabled,
      velocityX: getNumericParameter(filterChain.motionBlur, "velocityX"),
      velocityY: getNumericParameter(filterChain.motionBlur, "velocityY"),
      kernelSize: getNumericParameter(filterChain.motionBlur, "kernelSize"),
    },
    noise: {
      enabled: filterChain.noise.enabled,
      strength: getNumericParameter(filterChain.noise, "strength"),
      noiseScale: getNumericParameter(filterChain.noise, "noiseScale"),
    },
    zoomBlur: {
      enabled: filterChain.zoomBlur.enabled,
      strength: getNumericParameter(filterChain.zoomBlur, "strength") / 200,
      innerRadius: getNumericParameter(filterChain.zoomBlur, "innerRadius"),
      centerX: getNumericParameter(filterChain.zoomBlur, "centerX"),
      centerY: getNumericParameter(filterChain.zoomBlur, "centerY"),
    },
    chromaticAberration: {
      enabled: filterChain.chromaticAberration.enabled,
      offsetX: getNumericParameter(filterChain.chromaticAberration, "offset") / 1000,
      offsetY: 0,
      redX: 0,
      redY: 0,
      blueX: 0,
      blueY: 0,
      radial: getNumericParameter(filterChain.chromaticAberration, "intensity"),
      twist: getNumericParameter(filterChain.chromaticAberration, "angle"),
      centerX: 0.5,
      centerY: 0.5,
    },
  };
}

function createDefaultParameters(definition: FilterDefinition): Record<string, number | string> {
  const entries: [string, number | string][] = [];
  for (const parameter of definition.parameters) {
    if (parameter.type === "point") {
      entries.push([parameter.xId, parameter.defaultX], [parameter.yId, parameter.defaultY]);
    } else {
      entries.push([parameter.id, parameter.defaultValue]);
    }
  }
  return Object.fromEntries(entries);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolveParameterValue(
  parameter: FilterParameterDefinition,
  value: number | string,
): number | string | undefined {
  if (parameter.type === "range") {
    const numericValue = Number(value);
    return Number.isFinite(numericValue)
      ? clamp(numericValue, parameter.min, parameter.max)
      : undefined;
  }

  if (parameter.type === "point") {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? clamp(numericValue, 0, 100) : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  return parameter.options.some((option) => option.value === value) ? value : undefined;
}

function getNumericParameter(filterState: FilterState, parameterId: string): number {
  const value = filterState.parameters[parameterId];

  return typeof value === "number" ? value : 0;
}

function getStringParameter(filterState: FilterState, parameterId: string): string {
  const value = filterState.parameters[parameterId];

  return typeof value === "string" ? value : "";
}
