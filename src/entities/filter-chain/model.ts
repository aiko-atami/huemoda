import { createEvent, createStore } from "effector";
import type { PixiFilterValues } from "../../shared/lib/pixi/filterTypes";

const FILTER_IDS = ["tone", "blur", "grain", "lightLeak"] as const;

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
    title: "Soft Blur",
    description: "GPU blur for diffusion and polish.",
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
];

export const filterToggled = createEvent<FilterId>();
export const filterParameterChanged = createEvent<FilterParameterChangedPayload>();
export const filtersReset = createEvent();

export const $filterChain = createStore<FilterChainState>(createInitialFilterState())
  .on(filterToggled, toggleFilterState)
  .on(filterParameterChanged, updateFilterParameterState)
  .reset(filtersReset);

export const $hasActiveFilters = $filterChain.map((state) =>
  FILTER_DEFINITIONS.some((definition) => state[definition.id].enabled),
);

export function createInitialFilterState(): FilterChainState {
  const state = {} as FilterChainState;

  for (const definition of FILTER_DEFINITIONS) {
    state[definition.id] = {
      enabled: false,
      parameters: createDefaultParameters(definition),
    };
  }

  return state;
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
