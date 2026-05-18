import { Filter, GlProgram, GpuProgram } from "pixi.js";

// ─── GLSL vertex ─────────────────────────────────────────────────────────────
const glVertex = `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void) {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`.trim();

// ─── GLSL fragment ────────────────────────────────────────────────────────────
//
// Key improvements over the built-in NoiseFilter:
//
//  1. "Hash without Sine" by David Hoskins (shadertoy.com/view/4djSRW).
//     Avoids the periodic banding that sin-based hashes produce at high
//     intensities.
//
//  2. uGrainSize quantises pixel coordinates so adjacent pixels share the
//     same grain value. Values > 1 make grain visibly coarser — closer to
//     analogue film grain.
//
//  3. Luminance-adaptive blend: grain is strongest in midtones and tapers
//     towards pure black / pure white, matching how silver-halide film grain
//     responds to exposure.
//
const glFragment = `
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform vec4 uInputClamp;
uniform float uIntensity;
uniform float uGrainSize;
uniform float uSeed;

// Hash without Sine — no visible periodicity at high intensities.
float hash(vec2 p) {
    p = fract(p * vec2(0.1031, 0.1030));
    p += dot(p, p.yx + 33.33);
    return fract((p.x + p.y) * p.x);
}

void main(void) {
    vec4 color = texture(uTexture, vTextureCoord);

    // Quantise to grain-size blocks in image-pixel space.
    vec2 pixelCoord = floor(vTextureCoord * uInputSize.xy / uGrainSize);

    // Offset by seed so every filter creation produces a unique pattern.
    float grain = hash(pixelCoord + vec2(uSeed * 17.0, uSeed * 31.0));

    // Remap [0, 1] → [-0.5, 0.5].
    grain -= 0.5;

    // Luminance-adaptive mask: peaks at midtones (luma ≈ 0.5),
    // tapers to 0.4× at pure black/white.
    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    float lumaMask = 1.0 - abs(luma * 2.0 - 1.0) * 0.6;

    color.rgb = clamp(color.rgb + grain * uIntensity * lumaMask, 0.0, 1.0);

    finalColor = color;
}
`.trim();

// ─── WGSL vertex ──────────────────────────────────────────────────────────────
const wgslVertex = `
struct GlobalFilterUniforms {
  uInputSize:vec4<f32>,
  uInputPixel:vec4<f32>,
  uInputClamp:vec4<f32>,
  uOutputFrame:vec4<f32>,
  uGlobalFrame:vec4<f32>,
  uOutputTexture:vec4<f32>,
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;

struct VSOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
};

fn filterVertexPosition(aPosition: vec2<f32>) -> vec4<f32> {
  var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;
  position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}

fn filterTextureCoord(aPosition: vec2<f32>) -> vec2<f32> {
  return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);
}

@vertex
fn mainVertex(@location(0) aPosition: vec2<f32>) -> VSOutput {
  return VSOutput(filterVertexPosition(aPosition), filterTextureCoord(aPosition));
}
`.trim();

// ─── WGSL fragment ────────────────────────────────────────────────────────────
const wgslFragment = `
struct GlobalFilterUniforms {
  uInputSize:vec4<f32>,
  uInputPixel:vec4<f32>,
  uInputClamp:vec4<f32>,
  uOutputFrame:vec4<f32>,
  uGlobalFrame:vec4<f32>,
  uOutputTexture:vec4<f32>,
};

struct GrainUniforms {
  uIntensity: f32,
  uGrainSize: f32,
  uSeed: f32,
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> grainUniforms: GrainUniforms;

fn hash(p: vec2<f32>) -> f32 {
  var q = fract(p * vec2<f32>(0.1031, 0.1030));
  q += dot(q, q.yx + 33.33);
  return fract((q.x + q.y) * q.x);
}

@fragment
fn mainFragment(
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
) -> @location(0) vec4<f32> {
  let u = grainUniforms;

  var color = textureSample(uTexture, uSampler, uv);

  let pixelCoord = floor(uv * gfu.uInputSize.xy / u.uGrainSize);
  var grain = hash(pixelCoord + vec2<f32>(u.uSeed * 17.0, u.uSeed * 31.0));
  grain -= 0.5;

  let luma = dot(color.rgb, vec3<f32>(0.299, 0.587, 0.114));
  let lumaMask = 1.0 - abs(luma * 2.0 - 1.0) * 0.6;

  color = vec4<f32>(
    clamp(color.rgb + grain * u.uIntensity * lumaMask, vec3<f32>(0.0), vec3<f32>(1.0)),
    color.a,
  );

  return color;
}
`.trim();

// ─── Filter options ───────────────────────────────────────────────────────────

export type GrainOptions = {
  /** Grain strength in [0, 1]. Default 0.07 */
  intensity?: number;
  /**
   * Side length (in source image pixels) of each grain block.
   * 1 = single-pixel noise (sharp/digital), 2–4 = coarser/analogue-looking.
   * Default 1.5
   */
  grainSize?: number;
  /**
   * Random seed in [0, 1]. Pass `Math.random()` to get a unique pattern
   * on every filter creation. Default 0.5
   */
  seed?: number;
};

// ─── Filter class ─────────────────────────────────────────────────────────────

export class GrainFilter extends Filter {
  static readonly defaults: Required<GrainOptions> = {
    intensity: 0.07,
    grainSize: 1.25,
    seed: 0.5,
  };

  private readonly _uniforms: Record<string, number>;

  constructor(options: GrainOptions = {}) {
    const opts = { ...GrainFilter.defaults, ...options };

    const gpuProgram = GpuProgram.from({
      vertex: { source: wgslVertex, entryPoint: "mainVertex" },
      fragment: { source: wgslFragment, entryPoint: "mainFragment" },
    });

    const glProgram = GlProgram.from({
      vertex: glVertex,
      fragment: glFragment,
      name: "grain-filter",
    });

    super({
      gpuProgram,
      glProgram,
      resources: {
        grainUniforms: {
          uIntensity: { value: opts.intensity, type: "f32" },
          uGrainSize: { value: opts.grainSize, type: "f32" },
          uSeed: { value: opts.seed, type: "f32" },
        },
      },
    });

    this._uniforms = (
      this.resources as Record<string, { uniforms: Record<string, number> }>
    ).grainUniforms.uniforms;
  }

  get intensity(): number {
    return this._uniforms.uIntensity;
  }
  set intensity(v: number) {
    this._uniforms.uIntensity = v;
  }

  get grainSize(): number {
    return this._uniforms.uGrainSize;
  }
  set grainSize(v: number) {
    this._uniforms.uGrainSize = v;
  }

  get seed(): number {
    return this._uniforms.uSeed;
  }
  set seed(v: number) {
    this._uniforms.uSeed = v;
  }
}
