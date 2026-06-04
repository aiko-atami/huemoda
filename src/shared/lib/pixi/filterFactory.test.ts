import { beforeAll, describe, expect, it, vi } from "vitest";
import { createEmptyPixiFilterValues } from "./filterTypes";
import type { PixiFilterHandles } from "./filterFactory";

vi.mock("pixi.js", () => {
  class BlurFilter {
    readonly options: unknown;
    repeatEdgePixels = false;

    constructor(options: unknown) {
      this.options = options;
    }

    destroy() {}
  }

  class Filter {
    readonly filterOptions: unknown;
    resources: Record<string, { uniforms?: Record<string, number> }>;

    constructor(options: { resources?: Record<string, unknown> } = {}) {
      this.filterOptions = options;
      this.resources = {};

      for (const [key, value] of Object.entries(options.resources ?? {})) {
        if (value !== null && typeof value === "object") {
          const uniforms: Record<string, number> = {};

          for (const [uniformKey, uniformValue] of Object.entries(
            value as Record<string, { value?: number }>,
          )) {
            if (
              uniformValue !== null &&
              typeof uniformValue === "object" &&
              typeof uniformValue.value === "number"
            ) {
              uniforms[uniformKey] = uniformValue.value;
            }
          }

          if (Object.keys(uniforms).length > 0) {
            this.resources[key] = { uniforms };
          }
        }
      }
    }

    destroy() {}
  }

  return {
    BlurFilter,
    Filter,
    GlProgram: { from: vi.fn((options) => options) },
    GpuProgram: { from: vi.fn((options) => options) },
  };
});

vi.mock("pixi-filters", () => {
  class StubFilter {
    readonly options: unknown;

    constructor(options: unknown) {
      this.options = options;
    }

    destroy() {}
  }

  return {
    AdvancedBloomFilter: StubFilter,
    AdjustmentFilter: StubFilter,
    ColorOverlayFilter: StubFilter,
    DotFilter: StubFilter,
    GlitchFilter: StubFilter,
    GlowFilter: StubFilter,
    KawaseBlurFilter: StubFilter,
    MotionBlurFilter: StubFilter,
    SimplexNoiseFilter: StubFilter,
    ZoomBlurFilter: StubFilter,
  };
});

type FilterFactoryModule = typeof import("./filterFactory");
let filterFactory: FilterFactoryModule;

/**
 * A bag of writable properties limited to `allowed`. Writing any other key
 * throws, so it surfaces property-name drift between `updateFilterUniforms` and
 * the real filter classes (which expose only specific setters).
 */
function makeStrictStub(allowed: string[]): Record<string, unknown> {
  const store: Record<string, unknown> = {};

  return new Proxy(store, {
    set(target, prop, value) {
      if (typeof prop === "string" && !allowed.includes(prop)) {
        throw new Error(`Unexpected write to "${prop}" (allowed: ${allowed.join(", ")})`);
      }
      target[prop as string] = value;

      return true;
    },
  });
}

function makeStubTexture() {
  return {
    source: {
      style: {
        scaleMode: "nearest",
        addressMode: "repeat",
        update() {},
      },
      autoGenerateMipmaps: true,
      update() {},
    },
  };
}

function getGpuFragmentSource(filter: unknown) {
  return (
    filter as {
      filterOptions: {
        gpuProgram: { fragment: { source: string } };
      };
    }
  ).filterOptions.gpuProgram.fragment.source;
}

function expectUniformGroupBinding(filter: unknown, resourceName: string) {
  expect(filter).toMatchObject({
    resources: {
      [resourceName]: { uniforms: expect.any(Object) },
    },
  });

  expect(getGpuFragmentSource(filter)).toContain(
    `@group(1) @binding(0) var<uniform> ${resourceName}:`,
  );
}

describe("Pixi filter factory", () => {
  beforeAll(async () => {
    filterFactory = await import("./filterFactory");
  });

  it("keeps halation out of the regular filter chain", () => {
    const values = createEmptyPixiFilterValues();
    values.halation.enabled = true;

    expect(filterFactory.createPixiFilters(values)).toEqual([]);
  });

  it("creates regular Gaussian blur with mirrored canvas edges", () => {
    const values = createEmptyPixiFilterValues();
    values.blur.enabled = true;
    values.blur.strength = 4;

    const filters = filterFactory.createPixiFilters(values);

    expect(filters).toHaveLength(2);
    expect(filters[0]).toMatchObject({
      resources: {
        mirroredBlurUniforms: {
          uniforms: {
            uStrength: 4,
            uRadius: 12,
            uDirectionX: 1,
            uDirectionY: 0,
          },
        },
      },
    });
    expect(filters[1]).toMatchObject({
      resources: {
        mirroredBlurUniforms: {
          uniforms: {
            uStrength: 4,
            uRadius: 12,
            uDirectionX: 0,
            uDirectionY: 1,
          },
        },
      },
    });
    expectUniformGroupBinding(filters[0], "mirroredBlurUniforms");
    expect(getGpuFragmentSource(filters[0])).toContain("fn mirroredCoord");
  });

  it("samples strong mirrored blur densely to avoid sampling ripples", () => {
    const values = createEmptyPixiFilterValues();
    values.blur.enabled = true;
    values.blur.strength = 18;

    const filters = filterFactory.createPixiFilters(values);

    expect(filters).toHaveLength(2);
    for (const filter of filters) {
      expect(filter).toMatchObject({
        resources: {
          mirroredBlurUniforms: {
            uniforms: {
              uStrength: 18,
              uRadius: 54,
            },
          },
        },
      });
    }
    expect(getGpuFragmentSource(filters[0])).toContain("for (var i: i32 = -MAX_RADIUS");
  });

  it("binds grain uniforms with the same name used by the WGSL program", () => {
    const values = createEmptyPixiFilterValues();
    values.grain.enabled = true;
    values.grain.amount = 0.25;

    const filters = filterFactory.createPixiFilters(values, {
      width: 1920,
      height: 1080,
      grainSeed: 0.42,
    });

    expect(filters).toHaveLength(1);
    expect(filters[0]).toMatchObject({
      resources: {
        grainUniforms: {
          uniforms: {
            uAmount: 0.25,
            uSeed: 0.42,
          },
        },
      },
    });

    expectUniformGroupBinding(filters[0], "grainUniforms");
    expect(getGpuFragmentSource(filters[0])).toContain("let u = grainUniforms;");
  });

  it("keeps WebGPU uniform binding names aligned for custom filters", () => {
    const values = createEmptyPixiFilterValues();
    values.chromaticAberration.enabled = true;
    values.crt.enabled = true;
    values.grain.enabled = true;
    values.lensFlare.enabled = true;
    values.spinBlur.enabled = true;

    const filters = filterFactory.createPixiFilters(values, {
      width: 1920,
      height: 1080,
      grainSeed: 0.42,
    });

    expect(filters).toHaveLength(5);
    expectUniformGroupBinding(filters[0], "grainUniforms");
    expectUniformGroupBinding(filters[1], "chromaticAberrationUniforms");
    expectUniformGroupBinding(filters[2], "lensFlareUniforms");
    expectUniformGroupBinding(filters[3], "spinBlurUniforms");
    expectUniformGroupBinding(filters[4], "crtUniforms");
  });

  it("creates halation signal and composite filters from mapped values", () => {
    const values = createEmptyPixiFilterValues().halation;
    const signal = filterFactory.createHalationSignalFilters(values);
    const composite = filterFactory.createHalationCompositeFilter(
      values,
      makeStubTexture() as never,
    );

    expect(values.sourceLimiter).toBe(0.75);
    expect(signal.extract.sourceLimiter).toBe(values.sourceLimiter);
    expect(signal.extract.smoothness).toBe(values.smoothness);
    expect(signal.extract.hue).toBe(values.hue);
    expect(composite.backgroundGain).toBe(values.backgroundGain);
    expect(composite.globalDiffusion).toBe(values.globalDiffusion);
    expect(composite.amplify).toBe(values.amplify);
    expect(composite.blueComp).toBe(values.blueComp);
    expect(composite.impact).toBe(values.impact);
  });

  it("computes enabled filter fingerprints from topology gates", () => {
    const values = createEmptyPixiFilterValues();

    expect(filterFactory.getFilterFingerprint(values)).toBe("");

    values.tone.enabled = true;
    values.blur.enabled = true;
    values.blur.strength = 0;
    values.grain.enabled = true;
    values.grain.amount = 0;
    values.lightLeak.enabled = true;
    values.lightLeak.intensity = 0;
    values.lut.enabled = true;
    values.lut.intensity = 0;

    expect(filterFactory.getFilterFingerprint(values)).toBe("tone");

    values.lut.intensity = 0.7;
    values.blur.strength = 3;
    values.grain.amount = 0.2;
    values.lightLeak.intensity = 0.4;
    values.advancedBloom.enabled = true;
    values.dot.enabled = true;
    values.glitch.enabled = true;
    values.glow.enabled = true;
    values.motionBlur.enabled = true;
    values.noise.enabled = true;
    values.zoomBlur.enabled = true;
    values.chromaticAberration.enabled = true;
    values.lensFlare.enabled = true;
    values.spinBlur.enabled = true;
    values.crt.enabled = true;
    values.halation.enabled = true;

    expect(filterFactory.getFilterFingerprint(values)).toBe(
      [
        "tone",
        "lut:warmEditorial",
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
        "lensFlare",
        "spinBlur",
        "crt",
        "halation",
      ].join("|"),
    );
  });

  it("includes LUT preset id in fingerprints so preset changes rebuild the chain", () => {
    const values = createEmptyPixiFilterValues();
    values.lut.enabled = true;
    values.lut.intensity = 0.8;
    values.lut.presetId = "warmEditorial";

    expect(filterFactory.getFilterFingerprint(values)).toContain("lut:warmEditorial");

    values.lut.presetId = "coolFade";

    expect(filterFactory.getFilterFingerprint(values)).toContain("lut:coolFade");
  });

  it("converts shared filter values for build and live-update paths", () => {
    const zoom = createEmptyPixiFilterValues().zoomBlur;
    zoom.centerX = 25;
    zoom.centerY = 75;
    zoom.innerRadius = 10;

    const spin = createEmptyPixiFilterValues().spinBlur;
    spin.positionX = 0.25;
    spin.positionY = 0.75;

    expect(filterFactory.motionBlurKernelSize(4.2)).toBe(5);
    expect(filterFactory.motionBlurKernelSize(8)).toBe(9);
    expect(filterFactory.motionBlurKernelSize(11.4)).toBe(11);
    expect(filterFactory.zoomBlurCenter(zoom, { width: 800, height: 600 })).toEqual({
      x: 200,
      y: 450,
    });
    expect(filterFactory.zoomBlurInnerRadius(zoom, { width: 800, height: 600 })).toBe(60);
    expect(filterFactory.spinBlurPosition(spin, { width: 800, height: 600 })).toEqual({
      x: 200,
      y: 450,
    });
  });

  it("updates retained filter handles with converted live values", () => {
    const values = createEmptyPixiFilterValues();
    values.tone.enabled = true;
    values.tone.brightness = 1.2;
    values.tone.contrast = 0.8;
    values.tone.saturation = 1.4;
    values.blur.enabled = true;
    values.blur.strength = 6;
    values.motionBlur.enabled = true;
    values.motionBlur.velocityX = 3;
    values.motionBlur.velocityY = -2;
    values.motionBlur.kernelSize = 8;
    values.zoomBlur.enabled = true;
    values.zoomBlur.centerX = 25;
    values.zoomBlur.centerY = 75;
    values.zoomBlur.innerRadius = 10;
    values.zoomBlur.strength = 0.3;
    values.spinBlur.enabled = true;
    values.spinBlur.positionX = 0.25;
    values.spinBlur.positionY = 0.75;
    values.spinBlur.intensity = 0.6;
    values.spinBlur.blurAmount = 4;
    values.spinBlur.size = 0.8;

    // Strict stubs: any write to a property not in the allow-list throws, so a
    // typo'd property name in `updateFilterUniforms` (e.g. a renamed setter that
    // no longer matches the real filter API) fails the test instead of silently
    // landing on a junk key.
    const handles = {
      tone: makeStrictStub(["brightness", "contrast", "saturation"]),
      blur: [makeStrictStub(["strength"]), makeStrictStub(["strength"])],
      motionBlur: makeStrictStub(["velocity", "kernelSize"]),
      zoomBlur: makeStrictStub(["strength", "center", "innerRadius"]),
      spinBlur: makeStrictStub(["intensity", "blurAmount", "positionX", "positionY", "size"]),
    } as unknown as PixiFilterHandles;

    filterFactory.updateFilterUniforms(handles, values, { width: 800, height: 600 });

    expect(handles.tone).toMatchObject({ brightness: 1.2, contrast: 0.8, saturation: 1.4 });
    expect(handles.blur?.[0]).toMatchObject({ strength: 6 });
    expect(handles.blur?.[1]).toMatchObject({ strength: 6 });
    expect(handles.motionBlur).toMatchObject({ velocity: { x: 3, y: -2 }, kernelSize: 9 });
    expect(handles.zoomBlur).toMatchObject({
      strength: 0.3,
      center: { x: 200, y: 450 },
      innerRadius: 60,
    });
    expect(handles.spinBlur).toMatchObject({
      intensity: 0.6,
      blurAmount: 4,
      positionX: 200,
      positionY: 450,
      size: 0.8,
    });
  });

  it("keeps composite halation signal premultiplied in shader math", () => {
    const values = createEmptyPixiFilterValues().halation;
    const composite = filterFactory.createHalationCompositeFilter(
      values,
      makeStubTexture() as never,
    );
    const compositeOptions = (
      composite as unknown as {
        filterOptions: {
          glProgram: { fragment: string };
          gpuProgram: { fragment: { source: string } };
        };
      }
    ).filterOptions;
    const shaderSource = `${compositeOptions.glProgram.fragment}\n${compositeOptions.gpuProgram.fragment.source}`;

    expect(shaderSource).not.toContain("halSample.rgb / halSample.a");
    expect(shaderSource).not.toContain("gs.rgb / gs.a");
    expect(shaderSource).toContain("vec4 origPma = texture(uTexture, uv);");
    expect(shaderSource).toContain("vec4 halSample = texture(uHalationTexture, uv);");
    expect(shaderSource).toContain("let origPma = textureSample(uTexture, uSampler, uv);");
    expect(shaderSource).toContain(
      "let halSample = textureSample(uHalationTexture, uHalationSampler, uv);",
    );
  });
});
