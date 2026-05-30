import { Filter, GlProgram, GpuProgram } from "pixi.js";

import { defaultGlVertex, defaultWgslVertex } from "./shaderUtils";

// ─── GLSL fragment ────────────────────────────────────────────────────────────
//
// Dehancer-style grain v2: tonal masks + clustering + chroma + film curve
// (positive/negative) + resolution loss + density response.
//
const glFragment = `
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform vec4 uInputClamp;

uniform float uAmount;
uniform float uSize;
uniform float uChroma;
uniform float uShadows;
uniform float uMidtones;
uniform float uHighlights;
uniform float uStructure;
uniform float uPositive;
uniform float uResolutionLoss;
uniform float uSeed;

vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289v2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289v3(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187,
                        0.366025403784439,
                       -0.577350269189626,
                        0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289v2(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x_ = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x_) - 0.5;
    vec3 ox = floor(x_ + 0.5);
    vec3 a0 = x_ - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

float clusteredGrain(vec2 uv, float seed, float structure) {
    vec2 sv = vec2(seed, seed * 1.7 + 0.3);
    float n1 = snoise(uv + sv) * 0.5 + 0.5;
    float n2 = snoise(uv * 2.17 + sv + vec2(37.1, 59.3)) * 0.5 + 0.5;
    float n3 = snoise(uv * 5.13 + sv + vec2(71.7, 113.1)) * 0.5 + 0.5;
    float g = n1 * 0.55 + n2 * 0.30 + n3 * 0.15;
    float lo = mix(0.40, 0.30, structure);
    float hi = mix(0.60, 0.70, structure);
    g = smoothstep(lo, hi, g);
    return g - 0.5;
}

float luma(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

float bellMid(float x) {
    float d = (x - 0.5) * 2.0;
    return exp(-d * d * 2.5);
}

vec3 softenedColor(vec2 uv, float radiusPx) {
    vec2 px = vec2(radiusPx) / uInputSize.xy;
    vec3 c  = texture(uTexture, uv).rgb * 0.40;
    c += texture(uTexture, clamp(uv + vec2( px.x, 0.0), uInputClamp.xy, uInputClamp.zw)).rgb * 0.15;
    c += texture(uTexture, clamp(uv + vec2(-px.x, 0.0), uInputClamp.xy, uInputClamp.zw)).rgb * 0.15;
    c += texture(uTexture, clamp(uv + vec2(0.0,  px.y), uInputClamp.xy, uInputClamp.zw)).rgb * 0.15;
    c += texture(uTexture, clamp(uv + vec2(0.0, -px.y), uInputClamp.xy, uInputClamp.zw)).rgb * 0.15;
    return c;
}

void main(void) {
    vec2 uv = vTextureCoord;

    // 1. Film resolution loss
    vec3 sharp = texture(uTexture, uv).rgb;
    vec3 soft  = softenedColor(uv, uResolutionLoss * 4.0 + 0.3);
    vec3 color = mix(sharp, soft, clamp(uResolutionLoss, 0.0, 1.0));
    float L = luma(color);

    // 2. Tonal masks (bell curves)
    float maskS = pow(1.0 - L, 2.0);
    float maskM = bellMid(L);
    float maskH = pow(L, 2.0);
    float tonalWeight = maskS * uShadows + maskM * uMidtones + maskH * uHighlights;

    // 3. Physical-pixel coordinates, size-independent of canvas
    vec2 px = uv * uInputSize.xy / max(uSize, 0.0001);
    float seed = uSeed;

    // 4. Monochrome clustered grain
    float gMono = clusteredGrain(px, seed, uStructure);

    // 5. Chroma variation: independent seed per channel
    float gR = mix(gMono, clusteredGrain(px + vec2(17.13, 0.0), seed + 1.0, uStructure), uChroma);
    float gG = mix(gMono, clusteredGrain(px + vec2(71.59, 0.0), seed + 2.0, uStructure), uChroma);
    float gB = mix(gMono, clusteredGrain(px + vec2(31.77, 0.0), seed + 3.0, uStructure), uChroma);
    vec3 grain = vec3(gR, gG, gB);

    // 6. Micro-shadow from grain (3D emulsion depth)
    vec3 shadowSide = -max(-grain, 0.0) * 0.35;
    grain += shadowSide;

    // 7. Film response curve: positive vs negative
    float sig = 1.0 / (1.0 + exp(-6.0 * (L - 0.5)));
    float posCurve = mix(1.20, 0.70, sig);
    float negCurve = mix(0.65, 1.40, sig);
    float filmCurve = mix(posCurve, negCurve, clamp(uPositive, 0.0, 1.0));

    // 8. Density response (dye clouds)
    vec3 density = mix(vec3(0.75), sqrt(max(color, 0.001)), 0.65);

    // 9. Apply
    float strength = uAmount * tonalWeight * filmCurve;
    vec3 mult = 1.0 + grain * strength * density * 1.1;
    vec3 add  = grain * strength * density * 0.4;
    vec3 outc = color * mult + add;

    finalColor = vec4(clamp(outc, 0.0, 1.0), 1.0);
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

struct GrainV2Uniforms {
  uAmount: f32,
  uSize: f32,
  uChroma: f32,
  uShadows: f32,
  uMidtones: f32,
  uHighlights: f32,
  uStructure: f32,
  uPositive: f32,
  uResolutionLoss: f32,
  uSeed: f32,
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> gu: GrainV2Uniforms;

fn mod289v3(x: vec3<f32>) -> vec3<f32> {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn mod289v2(x: vec2<f32>) -> vec2<f32> {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn permute(x: vec3<f32>) -> vec3<f32> {
  return mod289v3(((x * 34.0) + 1.0) * x);
}

fn snoise(v: vec2<f32>) -> f32 {
  let C = vec4<f32>(0.211324865405187,
                    0.366025403784439,
                   -0.577350269189626,
                    0.024390243902439);
  var i = floor(v + dot(v, C.yy));
  let x0 = v - i + dot(i, C.xx);
  let i1 = select(vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 0.0), x0.x > x0.y);
  var x12 = x0.xyxy + C.xxzz;
  x12 = vec4<f32>(x12.x - i1.x, x12.y - i1.y, x12.z, x12.w);
  i = mod289v2(i);
  let p = permute(permute(i.y + vec3<f32>(0.0, i1.y, 1.0)) + i.x + vec3<f32>(0.0, i1.x, 1.0));
  var m = max(0.5 - vec3<f32>(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), vec3<f32>(0.0));
  m = m * m;
  m = m * m;
  let xn = 2.0 * fract(p * C.www) - 1.0;
  let h = abs(xn) - 0.5;
  let ox = floor(xn + 0.5);
  let a0 = xn - ox;
  m = m * (1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h));
  let gx = a0.x * x0.x + h.x * x0.y;
  let gy = a0.y * x12.x + h.y * x12.y;
  let gz = a0.z * x12.z + h.z * x12.w;
  let g = vec3<f32>(gx, gy, gz);
  return 130.0 * dot(m, g);
}

fn clusteredGrain(uv: vec2<f32>, seed: f32, structure: f32) -> f32 {
  let sv = vec2<f32>(seed, seed * 1.7 + 0.3);
  let n1 = snoise(uv + sv) * 0.5 + 0.5;
  let n2 = snoise(uv * 2.17 + sv + vec2<f32>(37.1, 59.3)) * 0.5 + 0.5;
  let n3 = snoise(uv * 5.13 + sv + vec2<f32>(71.7, 113.1)) * 0.5 + 0.5;
  var g = n1 * 0.55 + n2 * 0.30 + n3 * 0.15;
  let lo = mix(0.40, 0.30, structure);
  let hi = mix(0.60, 0.70, structure);
  g = smoothstep(lo, hi, g);
  return g - 0.5;
}

fn luma(c: vec3<f32>) -> f32 {
  return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
}

fn bellMid(x: f32) -> f32 {
  let d = (x - 0.5) * 2.0;
  return exp(-d * d * 2.5);
}

fn softenedColor(uv: vec2<f32>, radiusPx: f32) -> vec3<f32> {
  let px = vec2<f32>(radiusPx) / gfu.uInputSize.xy;
  var c = textureSample(uTexture, uSampler, uv).rgb * 0.40;
  c += textureSample(uTexture, uSampler, clamp(uv + vec2<f32>( px.x, 0.0), gfu.uInputClamp.xy, gfu.uInputClamp.zw)).rgb * 0.15;
  c += textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(-px.x, 0.0), gfu.uInputClamp.xy, gfu.uInputClamp.zw)).rgb * 0.15;
  c += textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(0.0,  px.y), gfu.uInputClamp.xy, gfu.uInputClamp.zw)).rgb * 0.15;
  c += textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(0.0, -px.y), gfu.uInputClamp.xy, gfu.uInputClamp.zw)).rgb * 0.15;
  return c;
}

@fragment
fn mainFragment(
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
) -> @location(0) vec4<f32> {
  let u = gu;

  let sharp = textureSample(uTexture, uSampler, uv).rgb;
  let soft = softenedColor(uv, u.uResolutionLoss * 4.0 + 0.3);
  var color = mix(sharp, soft, clamp(u.uResolutionLoss, 0.0, 1.0));
  let L = luma(color);

  let maskS = pow(1.0 - L, 2.0);
  let maskM = bellMid(L);
  let maskH = pow(L, 2.0);
  let tonalWeight = maskS * u.uShadows + maskM * u.uMidtones + maskH * u.uHighlights;

  let px = uv * gfu.uInputSize.xy / max(u.uSize, 0.0001);
  let seed = u.uSeed;

  let gMono = clusteredGrain(px, seed, u.uStructure);

  let gR = mix(gMono, clusteredGrain(px + vec2<f32>(17.13, 0.0), seed + 1.0, u.uStructure), u.uChroma);
  let gG = mix(gMono, clusteredGrain(px + vec2<f32>(71.59, 0.0), seed + 2.0, u.uStructure), u.uChroma);
  let gB = mix(gMono, clusteredGrain(px + vec2<f32>(31.77, 0.0), seed + 3.0, u.uStructure), u.uChroma);
  var grain = vec3<f32>(gR, gG, gB);

  let shadowSide = -max(-grain, vec3<f32>(0.0)) * 0.35;
  grain += shadowSide;

  let sig = 1.0 / (1.0 + exp(-6.0 * (L - 0.5)));
  let posCurve = mix(1.20, 0.70, sig);
  let negCurve = mix(0.65, 1.40, sig);
  let filmCurve = mix(posCurve, negCurve, clamp(u.uPositive, 0.0, 1.0));

  let density = mix(vec3<f32>(0.75), sqrt(max(color, vec3<f32>(0.001))), 0.65);

  let strength = u.uAmount * tonalWeight * filmCurve;
  let mult = 1.0 + grain * strength * density * 1.1;
  let add = grain * strength * density * 0.4;
  let outc = color * mult + add;

  return vec4<f32>(clamp(outc, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}
`.trim();

// ─── Filter options ───────────────────────────────────────────────────────────

export type GrainV2Options = {
  /** Overall grain amount in [0, 1]. Default 0.55 */
  amount?: number;
  /** Average grain granule size in pixels [0.5, 4]. Default 1.8 */
  size?: number;
  /** Chroma variation in [0, 1]. 0 = monochrome, 1 = full per-channel. Default 0.30 */
  chroma?: number;
  /** Shadows tonal mask weight [0, 1]. Default 0.70 */
  shadows?: number;
  /** Midtones tonal mask weight [0, 1]. Default 0.40 */
  midtones?: number;
  /** Highlights tonal mask weight [0, 1]. Default 0.80 */
  highlights?: number;
  /** Grain clustering strength [0, 1]. Higher = more clumping. Default 0.55 */
  structure?: number;
  /** Film type: 0 = positive (slide), 1 = negative. Default 1.0 */
  positive?: number;
  /** Micro-detail loss [0, 0.35]. Simulates emulsion softness. Default 0.12 */
  resolutionLoss?: number;
  /** Random seed in [0, 1]. Default 0.5 */
  seed?: number;
};

// ─── Filter class ─────────────────────────────────────────────────────────────

export class GrainV2Filter extends Filter {
  static readonly defaults: Required<GrainV2Options> = {
    amount: 0.55,
    size: 1.8,
    chroma: 0.3,
    shadows: 0.7,
    midtones: 0.4,
    highlights: 0.8,
    structure: 0.55,
    positive: 1.0,
    resolutionLoss: 0.12,
    seed: 0.5,
  };

  private readonly _uniforms: Record<string, number>;

  constructor(options: GrainV2Options = {}) {
    const opts = { ...GrainV2Filter.defaults, ...options };

    const gpuProgram = GpuProgram.from({
      vertex: { source: defaultWgslVertex, entryPoint: "mainVertex" },
      fragment: { source: wgslFragment, entryPoint: "mainFragment" },
    });

    const glProgram = GlProgram.from({
      vertex: defaultGlVertex,
      fragment: glFragment,
      name: "grain-v2-filter",
    });

    super({
      gpuProgram,
      glProgram,
      resources: {
        grainV2Uniforms: {
          uAmount: { value: opts.amount, type: "f32" },
          uSize: { value: opts.size, type: "f32" },
          uChroma: { value: opts.chroma, type: "f32" },
          uShadows: { value: opts.shadows, type: "f32" },
          uMidtones: { value: opts.midtones, type: "f32" },
          uHighlights: { value: opts.highlights, type: "f32" },
          uStructure: { value: opts.structure, type: "f32" },
          uPositive: { value: opts.positive, type: "f32" },
          uResolutionLoss: { value: opts.resolutionLoss, type: "f32" },
          uSeed: { value: opts.seed, type: "f32" },
        },
      },
    });

    this._uniforms = (
      this.resources as Record<string, { uniforms: Record<string, number> }>
    ).grainV2Uniforms.uniforms;
  }

  get amount(): number {
    return this._uniforms.uAmount;
  }
  set amount(v: number) {
    this._uniforms.uAmount = v;
  }

  get size(): number {
    return this._uniforms.uSize;
  }
  set size(v: number) {
    this._uniforms.uSize = v;
  }

  get chroma(): number {
    return this._uniforms.uChroma;
  }
  set chroma(v: number) {
    this._uniforms.uChroma = v;
  }

  get shadows(): number {
    return this._uniforms.uShadows;
  }
  set shadows(v: number) {
    this._uniforms.uShadows = v;
  }

  get midtones(): number {
    return this._uniforms.uMidtones;
  }
  set midtones(v: number) {
    this._uniforms.uMidtones = v;
  }

  get highlights(): number {
    return this._uniforms.uHighlights;
  }
  set highlights(v: number) {
    this._uniforms.uHighlights = v;
  }

  get structure(): number {
    return this._uniforms.uStructure;
  }
  set structure(v: number) {
    this._uniforms.uStructure = v;
  }

  get positive(): number {
    return this._uniforms.uPositive;
  }
  set positive(v: number) {
    this._uniforms.uPositive = v;
  }

  get resolutionLoss(): number {
    return this._uniforms.uResolutionLoss;
  }
  set resolutionLoss(v: number) {
    this._uniforms.uResolutionLoss = v;
  }

  setNormalizedSize(sizeAt1920px: number, rendererWidth: number) {
    this._uniforms.uSize = sizeAt1920px * (rendererWidth / 1920);
  }
}
