import { Filter, GlProgram, GpuProgram } from "pixi.js";
import { defaultGlVertex, defaultWgslVertex } from "./shaderUtils";

const MAX_RADIUS = 54;
const RADIUS_MULTIPLIER = 3;

const glFragment = `#version 300 es
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputPixel;
uniform vec4 uInputClamp;
uniform float uStrength;
uniform float uRadius;
uniform float uDirectionX;
uniform float uDirectionY;

const int MAX_RADIUS = ${MAX_RADIUS};

vec2 mirroredCoord(vec2 uv) {
    vec2 minUv = uInputClamp.xy;
    vec2 maxUv = uInputClamp.zw;
    vec2 span = max(maxUv - minUv, vec2(0.000001));
    vec2 p = mod((uv - minUv) / span, 2.0);
    p = mix(p, 2.0 - p, step(1.0, p));

    return minUv + p * span;
}

void main(void) {
    vec2 direction = vec2(uDirectionX, uDirectionY);
    float sigma = max(uStrength, 0.001);
    float sigma2 = sigma * sigma;
    vec4 color = vec4(0.0);
    float totalWeight = 0.0;

    for (int i = -MAX_RADIUS; i <= MAX_RADIUS; i++) {
        float sampleIndex = float(i);

        if (abs(sampleIndex) > uRadius) {
            continue;
        }

        float weight = exp(-0.5 * sampleIndex * sampleIndex / sigma2);
        vec2 offset = direction * sampleIndex * uInputPixel.zw;
        color += texture(uTexture, mirroredCoord(vTextureCoord + offset)) * weight;
        totalWeight += weight;
    }

    finalColor = color / totalWeight;
}
`.trim();

const wgslFragment = `
struct GlobalFilterUniforms {
  uInputSize:vec4<f32>,
  uInputPixel:vec4<f32>,
  uInputClamp:vec4<f32>,
  uOutputFrame:vec4<f32>,
  uGlobalFrame:vec4<f32>,
  uOutputTexture:vec4<f32>,
};

struct MirroredBlurUniforms {
  uStrength:f32,
  uRadius:f32,
  uDirectionX:f32,
  uDirectionY:f32,
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> mirroredBlurUniforms: MirroredBlurUniforms;

const MAX_RADIUS: i32 = ${MAX_RADIUS};

fn mirroredCoord(uv: vec2<f32>) -> vec2<f32> {
  let minUv = gfu.uInputClamp.xy;
  let maxUv = gfu.uInputClamp.zw;
  let span = max(maxUv - minUv, vec2<f32>(0.000001, 0.000001));
  var p = (uv - minUv) / span;
  p = p - floor(p / 2.0) * 2.0;
  p = mix(p, 2.0 - p, step(vec2<f32>(1.0, 1.0), p));

  return minUv + p * span;
}

@fragment
fn mainFragment(
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
) -> @location(0) vec4<f32> {
  let direction = vec2<f32>(mirroredBlurUniforms.uDirectionX, mirroredBlurUniforms.uDirectionY);
  let sigma = max(mirroredBlurUniforms.uStrength, 0.001);
  let sigma2 = sigma * sigma;
  var color = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  var totalWeight = 0.0;

  for (var i: i32 = -MAX_RADIUS; i <= MAX_RADIUS; i = i + 1) {
    let sampleIndex = f32(i);

    if (abs(sampleIndex) > mirroredBlurUniforms.uRadius) {
      continue;
    }

    let weight = exp(-0.5 * sampleIndex * sampleIndex / sigma2);
    let offset = direction * sampleIndex * gfu.uInputPixel.zw;
    color += textureSampleLevel(uTexture, uSampler, mirroredCoord(uv + offset), 0.0) * weight;
    totalWeight += weight;
  }

  return color / totalWeight;
}
`.trim();

export type MirroredBlurOptions = {
  /** Gaussian sigma in pixels. */
  strength?: number;
  /** Pass direction. The factory chains horizontal and vertical passes. */
  horizontal?: boolean;
};

export class MirroredBlurFilter extends Filter {
  static readonly defaults: Required<MirroredBlurOptions> = {
    strength: 4,
    horizontal: true,
  };

  private readonly _uniforms: Record<string, number>;

  constructor(options: MirroredBlurOptions = {}) {
    const opts = { ...MirroredBlurFilter.defaults, ...options };
    const radius = getBlurRadius(opts.strength);

    const gpuProgram = GpuProgram.from({
      vertex: { source: defaultWgslVertex, entryPoint: "mainVertex" },
      fragment: { source: wgslFragment, entryPoint: "mainFragment" },
    });

    const glProgram = GlProgram.from({
      vertex: defaultGlVertex,
      fragment: glFragment,
      name: `mirrored-blur-${opts.horizontal ? "horizontal" : "vertical"}-filter`,
    });

    super({
      gpuProgram,
      glProgram,
      resources: {
        mirroredBlurUniforms: {
          uStrength: { value: opts.strength, type: "f32" },
          uRadius: { value: radius, type: "f32" },
          uDirectionX: { value: opts.horizontal ? 1 : 0, type: "f32" },
          uDirectionY: { value: opts.horizontal ? 0 : 1, type: "f32" },
        },
      },
    });

    this._uniforms = (
      this.resources as Record<string, { uniforms: Record<string, number> }>
    ).mirroredBlurUniforms.uniforms;
  }

  get strength(): number {
    return this._uniforms.uStrength;
  }

  set strength(value: number) {
    this._uniforms.uStrength = value;
    this._uniforms.uRadius = getBlurRadius(value);
  }
}

export function createMirroredBlurFilters(strength: number): MirroredBlurFilter[] {
  return [
    new MirroredBlurFilter({ strength, horizontal: true }),
    new MirroredBlurFilter({ strength, horizontal: false }),
  ];
}

function getBlurRadius(strength: number): number {
  return Math.min(MAX_RADIUS, Math.ceil(Math.max(0, strength) * RADIUS_MULTIPLIER));
}
