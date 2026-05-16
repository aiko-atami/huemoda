import { describe, expect, it } from "vitest";
import {
  addFilterToChain,
  createInitialFilterState,
  removeFilterFromChain,
  toPixiFilterValues,
  toggleFilterState,
  updateFilterParameterState,
} from ".";

describe("filter chain model", () => {
  it("creates unadded, disabled filters with default parameters", () => {
    const state = createInitialFilterState();

    expect(state.tone.added).toBe(false);
    expect(state.tone.enabled).toBe(false);
    expect(state.tone.parameters.brightness).toBe(1);
    expect(state.lut.parameters.presetId).toBe("warmEditorial");
    expect(state.lut.parameters.intensity).toBe(0.8);
    expect(state.grain.parameters.intensity).toBe(0.14);
  });

  it("adds a filter and auto-enables it", () => {
    const state = createInitialFilterState();
    const nextState = addFilterToChain(state, "blur");

    expect(state.blur.added).toBe(false);
    expect(nextState.blur.added).toBe(true);
    expect(nextState.blur.enabled).toBe(true);
  });

  it("removes a filter and disables it", () => {
    const state = addFilterToChain(createInitialFilterState(), "grain");
    const nextState = removeFilterFromChain(state, "grain");

    expect(state.grain.added).toBe(true);
    expect(nextState.grain.added).toBe(false);
    expect(nextState.grain.enabled).toBe(false);
  });

  it("toggles a filter without mutating the previous state", () => {
    const state = createInitialFilterState();
    const nextState = toggleFilterState(state, "blur");

    expect(state.blur.enabled).toBe(false);
    expect(nextState.blur.enabled).toBe(true);
  });

  it("clamps parameter changes to the configured range", () => {
    const state = createInitialFilterState();
    const nextState = updateFilterParameterState(state, {
      filterId: "lightLeak",
      parameterId: "intensity",
      value: 2,
    });

    expect(nextState.lightLeak.parameters.intensity).toBe(0.36);
  });

  it("updates valid select parameter values", () => {
    const state = createInitialFilterState();
    const nextState = updateFilterParameterState(state, {
      filterId: "lut",
      parameterId: "presetId",
      value: "coolFade",
    });

    expect(nextState.lut.parameters.presetId).toBe("coolFade");
  });

  it("ignores invalid select values without mutating state", () => {
    const state = createInitialFilterState();
    const nextState = updateFilterParameterState(state, {
      filterId: "lut",
      parameterId: "presetId",
      value: "unknown",
    });

    expect(nextState).toBe(state);
    expect(nextState.lut.parameters.presetId).toBe("warmEditorial");
  });

  it("maps LUT values to Pixi filter values", () => {
    const state = updateFilterParameterState(addFilterToChain(createInitialFilterState(), "lut"), {
      filterId: "lut",
      parameterId: "presetId",
      value: "neutral",
    });

    const pixiValues = toPixiFilterValues(state);

    expect(pixiValues.lut).toEqual({
      enabled: true,
      intensity: 0.8,
      presetId: "neutral",
    });
  });
});
