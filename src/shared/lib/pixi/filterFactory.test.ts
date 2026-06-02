import { beforeAll, describe, expect, it, vi } from "vitest";
import { createEmptyPixiFilterValues } from "./filterTypes";

vi.mock("pixi.js", () => {
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

describe("Pixi filter factory", () => {
  beforeAll(async () => {
    filterFactory = await import("./filterFactory");
  });

  it("keeps halation out of the regular filter chain", () => {
    const values = createEmptyPixiFilterValues();
    values.halation.enabled = true;

    expect(filterFactory.createPixiFilters(values)).toEqual([]);
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
