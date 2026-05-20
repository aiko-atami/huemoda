import { describe, expect, it } from "vitest";
import {
  addFilterToChain,
  createInitialFilterState,
  removeFilterFromChain,
  toPixiFilterValues,
  toggleFilterState,
  updateFilterParameterState,
} from "./model";

describe("filter chain model", () => {
  it("creates unadded, disabled filters with default parameters", () => {
    const state = createInitialFilterState();

    expect(state.tone.added).toBe(false);
    expect(state.tone.enabled).toBe(false);
    expect(state.tone.parameters.brightness).toBe(1);
    expect(state.lut.parameters.presetId).toBe("warmEditorial");
    expect(state.lut.parameters.intensity).toBe(0.35);
    expect(state.grain.parameters.intensity).toBe(0.07);
    expect(state.chromaticAberration.parameters.intensity).toBe(0.25);
    expect(state.chromaticAberration.parameters.offset).toBe(1);
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
      intensity: 0.35,
      presetId: "neutral",
    });
  });

  it("maps chromatic aberration offset from control units to shader ratio", () => {
    const state = updateFilterParameterState(
      addFilterToChain(createInitialFilterState(), "chromaticAberration"),
      {
        filterId: "chromaticAberration",
        parameterId: "offset",
        value: 1,
      },
    );

    expect(toPixiFilterValues(state).chromaticAberration.offsetX).toBe(0.001);
  });

  it("maps lens flare position from 0-100 control range to 0-1 UV range", () => {
    let state = addFilterToChain(createInitialFilterState(), "lensFlare");
    state = updateFilterParameterState(state, {
      filterId: "lensFlare",
      parameterId: "positionX",
      value: 30,
    });
    state = updateFilterParameterState(state, {
      filterId: "lensFlare",
      parameterId: "positionY",
      value: 25,
    });

    const pixiValues = toPixiFilterValues(state);

    expect(pixiValues.lensFlare.positionX).toBeCloseTo(0.3);
    expect(pixiValues.lensFlare.positionY).toBeCloseTo(0.25);
    expect(pixiValues.lensFlare.enabled).toBe(true);
  });

  it("maps spin blur position from 0-100 control range to 0-1 UV range", () => {
    let state = addFilterToChain(createInitialFilterState(), "spinBlur");
    state = updateFilterParameterState(state, {
      filterId: "spinBlur",
      parameterId: "positionX",
      value: 75,
    });
    state = updateFilterParameterState(state, {
      filterId: "spinBlur",
      parameterId: "positionY",
      value: 40,
    });

    const pixiValues = toPixiFilterValues(state);

    expect(pixiValues.spinBlur.positionX).toBeCloseTo(0.75);
    expect(pixiValues.spinBlur.positionY).toBeCloseTo(0.4);
    expect(pixiValues.spinBlur.enabled).toBe(true);
  });

  it("maps spin blur size from 0-100 control range to 0-1 UV range", () => {
    let state = addFilterToChain(createInitialFilterState(), "spinBlur");
    state = updateFilterParameterState(state, {
      filterId: "spinBlur",
      parameterId: "size",
      value: 50,
    });

    const pixiValues = toPixiFilterValues(state);

    expect(pixiValues.spinBlur.size).toBeCloseTo(0.5);
  });

  it("creates spin blur with default parameters", () => {
    const state = createInitialFilterState();

    expect(state.spinBlur.added).toBe(false);
    expect(state.spinBlur.enabled).toBe(false);
    expect(state.spinBlur.parameters.intensity).toBe(0.8);
    expect(state.spinBlur.parameters.blurAmount).toBe(1);
    expect(state.spinBlur.parameters.positionX).toBe(50);
    expect(state.spinBlur.parameters.positionY).toBe(50);
    expect(state.spinBlur.parameters.size).toBe(50);
  });

  it("converts spin blur amount from % of rotation to degrees for the shader", () => {
    let state = addFilterToChain(createInitialFilterState(), "spinBlur");
    state = updateFilterParameterState(state, {
      filterId: "spinBlur",
      parameterId: "blurAmount",
      value: 1,
    });

    // 1 % of 360° = 3.6°
    expect(toPixiFilterValues(state).spinBlur.blurAmount).toBeCloseTo(3.6);
  });
});
