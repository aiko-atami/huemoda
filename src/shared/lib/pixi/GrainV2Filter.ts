import { Filter, GlProgram, GpuProgram } from "pixi.js";

import { defaultGlVertex, defaultWgslVertex } from "./shaderUtils";

// ─── GLSL fragment ────────────────────────────────────────────────────────────
//
// Dehancer-style grain v3: projection model, multi-layer emulsion,
// tonal floor, residual halides, positive-process grain, grain shape.
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
uniform float uGrainShape;
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

float hash1(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec2 hash2(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}

float clusteredGrain(vec2 cell, float seed, float structure) {
    vec2 sv = vec2(seed, seed * 1.7 + 0.3);

    vec2 jitter = hash2(cell + sv) * 2.0 - 1.0;
    float sizeVar = hash1(cell + sv + vec2(19.7, 43.1)) * 0.6 + 0.7;
    vec2 px = cell + jitter * 0.45 / sizeVar;

    float angle = hash1(cell + vec2(53.0, 97.0) + sv) * 6.2832;
    float ca = cos(angle); float sa = sin(angle);
    mat2 cellRot = mat2(ca, -sa, sa, ca);

    mat2 r1 = cellRot * mat2( 0.80, -0.60,  0.60,  0.80);
    mat2 r2 = cellRot * mat2( 0.36, -0.93,  0.93,  0.36);

    float n1 = snoise(px * sizeVar + sv) * 0.5 + 0.5;
    float n2 = snoise(r1 * px * sizeVar * 2.17 + sv + vec2(37.1, 59.3)) * 0.5 + 0.5;
    float n3 = snoise(r2 * px * sizeVar * 5.13 + sv + vec2(71.7, 113.1)) * 0.5 + 0.5;
    float g = n1 * 0.55 + n2 * 0.30 + n3 * 0.15;

    float thVar = hash1(cell + vec2(131.0, 173.0) + sv) * 0.08 - 0.04;
    float lo = mix(0.40, 0.30, structure) + thVar;
    float hi = mix(0.60, 0.70, structure) + thVar;
    float mid = mix(lo, hi, 0.5);
    float k = 6.0;
    g = 1.0 / (1.0 + exp(-k * (g - mid)));
    g = mix(0.08, g, 0.92);

    return g - 0.5;
}

float luma(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

float bellMid(float x) {
    float d = (x - 0.5) * 2.0;
    return exp(-d * d * 2.5);
}

vec4 softenedColor(vec2 uv, float radiusPx) {
    vec2 px = vec2(radiusPx) / uInputSize.xy;
    vec4 c  = texture(uTexture, uv) * 0.40;
    c += texture(uTexture, clamp(uv + vec2( px.x, 0.0), uInputClamp.xy, uInputClamp.zw)) * 0.15;
    c += texture(uTexture, clamp(uv + vec2(-px.x, 0.0), uInputClamp.xy, uInputClamp.zw)) * 0.15;
    c += texture(uTexture, clamp(uv + vec2(0.0,  px.y), uInputClamp.xy, uInputClamp.zw)) * 0.15;
    c += texture(uTexture, clamp(uv + vec2(0.0, -px.y), uInputClamp.xy, uInputClamp.zw)) * 0.15;
    c += texture(uTexture, clamp(uv + vec2( px.x,  px.y), uInputClamp.xy, uInputClamp.zw)) * 0.075;
    c += texture(uTexture, clamp(uv + vec2(-px.x,  px.y), uInputClamp.xy, uInputClamp.zw)) * 0.075;
    c += texture(uTexture, clamp(uv + vec2( px.x, -px.y), uInputClamp.xy, uInputClamp.zw)) * 0.075;
    c += texture(uTexture, clamp(uv + vec2(-px.x, -px.y), uInputClamp.xy, uInputClamp.zw)) * 0.075;
    return c;
}

void main(void) {
    vec2 uv = vTextureCoord;

    vec4 src = texture(uTexture, uv);
    float a = src.a;

    // 1. Source color with resolution loss
    vec3 sharp = a > 0.0 ? src.rgb / a : vec3(0.0);
    vec4 softPma = softenedColor(uv, uResolutionLoss * 20.0 + 0.5);
    vec3 soft  = softPma.a > 0.0 ? softPma.rgb / softPma.a : vec3(0.0);
    vec3 color = mix(sharp, soft, smoothstep(0.0, 0.4, uResolutionLoss));
    float L = luma(color);

    // 2. Tonal masks with guaranteed minimum grain presence
    float maskS = pow(1.0 - L, 2.0);
    float maskM = bellMid(L);
    float maskH = pow(L, 2.0);
    float tonalWeight = maskS * uShadows + maskM * uMidtones + maskH * uHighlights;
    tonalWeight = max(0.12, tonalWeight);

    // 3. Effective structure: classic vs T-grain
    float effectiveStructure = uStructure * mix(1.0, 0.3, uGrainShape);

    // 4. Physical-pixel coordinates
    float effectiveSize = max(uSize, 1.0);
    vec2 cell = floor(uv * uInputSize.xy / effectiveSize);
    float seed = uSeed;

    // 5. Multi-layer grain (emulsion depth)
    vec2 shift1 = vec2(0.3, 0.2) * effectiveSize / uInputSize.xy;
    vec2 cell1 = floor((uv + shift1) * uInputSize.xy / effectiveSize);
    float g1 = clusteredGrain(cell1, seed, effectiveStructure);

    vec2 shift2 = vec2(-0.2, 0.4) * effectiveSize / uInputSize.xy;
    vec2 cell2 = floor((uv + shift2) * uInputSize.xy / effectiveSize);
    float g2 = clusteredGrain(cell2, seed + 5.17, effectiveStructure * 0.8);

    float gMono = g1 * 0.6 + g2 * 0.4;

    // 6. Chroma variation: independent seed per channel
    float gR = mix(gMono, clusteredGrain(cell + vec2(17.13, 0.0), seed + 1.0, effectiveStructure), uChroma);
    float gG = mix(gMono, clusteredGrain(cell + vec2(71.59, 0.0), seed + 2.0, effectiveStructure), uChroma);
    float gB = mix(gMono, clusteredGrain(cell + vec2(31.77, 0.0), seed + 3.0, effectiveStructure), uChroma);
    vec3 grain = vec3(gR, gG, gB);

    // 7. Residual halides in deep shadows
    float halideNoise = snoise(cell * 2.7 + vec2(seed * 2.3, seed * 1.1 + 7.0)) * 0.5 + 0.5;
    float shadowDepth = smoothstep(0.12, 0.0, L);
    vec3 halideResidue = vec3(halideNoise * shadowDepth * 0.06);

    // 8. Positive-process wheat: different per film type
    vec2 cellPos = floor(uv * uInputSize.xy / max(effectiveSize * 1.3, 1.0));
    float posGrain = clusteredGrain(cellPos, seed + 7.31, effectiveStructure * 0.6);
    float hlMask = smoothstep(0.75, 1.0, L);
    float shMask = smoothstep(0.25, 0.0, L);
    float posProcessGrain = mix(
        posGrain * shMask,
        posGrain * hlMask,
        clamp(uPositive, 0.0, 1.0)
    ) * 0.15;

    // 9. Film response curve (positive vs negative)
    float sig = 1.0 / (1.0 + exp(-6.0 * (L - 0.5)));
    float posCurve = mix(1.20, 0.70, sig);
    float negCurve = mix(0.65, 1.40, sig);
    float filmCurve = mix(posCurve, negCurve, clamp(uPositive, 0.0, 1.0));

    // 10. Density response
    vec3 density = mix(vec3(0.75), sqrt(max(color, vec3(0.001))), 0.65);

    // 11. Projection model: image formed from grain
    float coverageStrength = uAmount * tonalWeight * filmCurve;

    vec3 coverage = grain + vec3(0.5);
    vec3 attenuation = (1.0 - coverage) * 0.20 * coverageStrength;
    vec3 reconstruct = color * (1.0 - attenuation);

    vec3 grainModulation = grain * coverageStrength * density * 0.55;

    // 12. Composite
    vec3 outc = reconstruct + grainModulation + halideResidue + vec3(posProcessGrain);

    finalColor = vec4(clamp(outc, 0.0, 1.0) * a, a);
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
  uGrainShape: f32,
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

fn hash1(p: vec2<f32>) -> f32 {
  var p3 = fract(vec3<f32>(p.x, p.y, p.x) * 0.1031);
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn hash2(p: vec2<f32>) -> vec2<f32> {
  var p3 = fract(vec3<f32>(p.x, p.y, p.x) * vec3<f32>(0.1031, 0.1030, 0.0973));
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((vec2<f32>(p3.x, p3.x) + p3.yz) * p3.zy);
}

fn clusteredGrain(cell: vec2<f32>, seed: f32, structure: f32) -> f32 {
  let sv = vec2<f32>(seed, seed * 1.7 + 0.3);

  let jitter = hash2(cell + sv) * 2.0 - 1.0;
  let sizeVar = hash1(cell + sv + vec2<f32>(19.7, 43.1)) * 0.6 + 0.7;
  let px = cell + jitter * 0.45 / sizeVar;

  let angle = hash1(cell + vec2<f32>(53.0, 97.0) + sv) * 6.2832;
  let ca = cos(angle);
  let sa = sin(angle);
  let cellRot = mat2x2<f32>(ca, -sa, sa, ca);

  let r1 = cellRot * mat2x2<f32>( 0.80, -0.60,  0.60,  0.80);
  let r2 = cellRot * mat2x2<f32>( 0.36, -0.93,  0.93,  0.36);

  let n1 = snoise(px * sizeVar + sv) * 0.5 + 0.5;
  let n2 = snoise(r1 * px * sizeVar * 2.17 + sv + vec2<f32>(37.1, 59.3)) * 0.5 + 0.5;
  let n3 = snoise(r2 * px * sizeVar * 5.13 + sv + vec2<f32>(71.7, 113.1)) * 0.5 + 0.5;
  var g = n1 * 0.55 + n2 * 0.30 + n3 * 0.15;

  let thVar = hash1(cell + vec2<f32>(131.0, 173.0) + sv) * 0.08 - 0.04;
  let lo = mix(0.40, 0.30, structure) + thVar;
  let hi = mix(0.60, 0.70, structure) + thVar;
  let mid = mix(lo, hi, 0.5);
  let k = 6.0;
  g = 1.0 / (1.0 + exp(-k * (g - mid)));
  g = mix(0.08, g, 0.92);

  return g - 0.5;
}

fn luma(c: vec3<f32>) -> f32 {
  return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
}

fn bellMid(x: f32) -> f32 {
  let d = (x - 0.5) * 2.0;
  return exp(-d * d * 2.5);
}

fn softenedColor(uv: vec2<f32>, radiusPx: f32) -> vec4<f32> {
  let px = vec2<f32>(radiusPx) / gfu.uInputSize.xy;
  var c = textureSample(uTexture, uSampler, uv) * 0.40;
  c += textureSample(uTexture, uSampler, clamp(uv + vec2<f32>( px.x, 0.0), gfu.uInputClamp.xy, gfu.uInputClamp.zw)) * 0.15;
  c += textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(-px.x, 0.0), gfu.uInputClamp.xy, gfu.uInputClamp.zw)) * 0.15;
  c += textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(0.0,  px.y), gfu.uInputClamp.xy, gfu.uInputClamp.zw)) * 0.15;
  c += textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(0.0, -px.y), gfu.uInputClamp.xy, gfu.uInputClamp.zw)) * 0.15;
  c += textureSample(uTexture, uSampler, clamp(uv + vec2<f32>( px.x,  px.y), gfu.uInputClamp.xy, gfu.uInputClamp.zw)) * 0.075;
  c += textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(-px.x,  px.y), gfu.uInputClamp.xy, gfu.uInputClamp.zw)) * 0.075;
  c += textureSample(uTexture, uSampler, clamp(uv + vec2<f32>( px.x, -px.y), gfu.uInputClamp.xy, gfu.uInputClamp.zw)) * 0.075;
  c += textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(-px.x, -px.y), gfu.uInputClamp.xy, gfu.uInputClamp.zw)) * 0.075;
  return c;
}

@fragment
fn mainFragment(
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
) -> @location(0) vec4<f32> {
  let u = gu;

  let src = textureSample(uTexture, uSampler, uv);
  let a = src.a;

  let sharp = select(vec3<f32>(0.0), src.rgb / a, a > 0.0);
  let softPma = softenedColor(uv, u.uResolutionLoss * 20.0 + 0.5);
  let soft = select(vec3<f32>(0.0), softPma.rgb / softPma.a, softPma.a > 0.0);
  var color = mix(sharp, soft, smoothstep(0.0, 0.4, u.uResolutionLoss));
  let L = luma(color);

  let maskS = pow(1.0 - L, 2.0);
  let maskM = bellMid(L);
  let maskH = pow(L, 2.0);
  var tonalWeight = maskS * u.uShadows + maskM * u.uMidtones + maskH * u.uHighlights;
  tonalWeight = max(0.12, tonalWeight);

  let effectiveStructure = u.uStructure * mix(1.0, 0.3, u.uGrainShape);

  let effectiveSize = max(u.uSize, 1.0);
  let cell = floor(uv * gfu.uInputSize.xy / effectiveSize);
  let seed = u.uSeed;

  let shift1 = vec2<f32>(0.3, 0.2) * effectiveSize / gfu.uInputSize.xy;
  let cell1 = floor((uv + shift1) * gfu.uInputSize.xy / effectiveSize);
  let g1 = clusteredGrain(cell1, seed, effectiveStructure);

  let shift2 = vec2<f32>(-0.2, 0.4) * effectiveSize / gfu.uInputSize.xy;
  let cell2 = floor((uv + shift2) * gfu.uInputSize.xy / effectiveSize);
  let g2 = clusteredGrain(cell2, seed + 5.17, effectiveStructure * 0.8);

  let gMono = g1 * 0.6 + g2 * 0.4;

  let gR = mix(gMono, clusteredGrain(cell + vec2<f32>(17.13, 0.0), seed + 1.0, effectiveStructure), u.uChroma);
  let gG = mix(gMono, clusteredGrain(cell + vec2<f32>(71.59, 0.0), seed + 2.0, effectiveStructure), u.uChroma);
  let gB = mix(gMono, clusteredGrain(cell + vec2<f32>(31.77, 0.0), seed + 3.0, effectiveStructure), u.uChroma);
  let grain = vec3<f32>(gR, gG, gB);

  let halideNoise = snoise(cell * 2.7 + vec2<f32>(seed * 2.3, seed * 1.1 + 7.0)) * 0.5 + 0.5;
  let shadowDepth = smoothstep(0.12, 0.0, L);
  let halideResidue = vec3<f32>(halideNoise * shadowDepth * 0.06);

  let cellPos = floor(uv * gfu.uInputSize.xy / max(effectiveSize * 1.3, 1.0));
  let posGrain = clusteredGrain(cellPos, seed + 7.31, effectiveStructure * 0.6);
  let hlMask = smoothstep(0.75, 1.0, L);
  let shMask = smoothstep(0.25, 0.0, L);
  let posProcessGrain = mix(
    posGrain * shMask,
    posGrain * hlMask,
    clamp(u.uPositive, 0.0, 1.0)
  ) * 0.15;

  let sig = 1.0 / (1.0 + exp(-6.0 * (L - 0.5)));
  let posCurve = mix(1.20, 0.70, sig);
  let negCurve = mix(0.65, 1.40, sig);
  let filmCurve = mix(posCurve, negCurve, clamp(u.uPositive, 0.0, 1.0));

  let density = mix(vec3<f32>(0.75), sqrt(max(color, vec3<f32>(0.001))), 0.65);

  let coverageStrength = u.uAmount * tonalWeight * filmCurve;

  let coverage = grain + vec3<f32>(0.5);
  let attenuation = (1.0 - coverage) * 0.20 * coverageStrength;
  let reconstruct = color * (1.0 - attenuation);

  let grainModulation = grain * coverageStrength * density * 0.55;

  let outc = reconstruct + grainModulation + halideResidue + vec3<f32>(posProcessGrain);

  return vec4<f32>(clamp(outc, vec3<f32>(0.0), vec3<f32>(1.0)) * a, a);
}
`.trim();

// ─── Filter options ───────────────────────────────────────────────────────────

export type GrainV2Options = {
  amount?: number;
  size?: number;
  chroma?: number;
  shadows?: number;
  midtones?: number;
  highlights?: number;
  structure?: number;
  grainShape?: number;
  positive?: number;
  resolutionLoss?: number;
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
    grainShape: 0.0,
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
      clipToViewport: false,
      resources: {
        grainV2Uniforms: {
          uAmount: { value: opts.amount, type: "f32" },
          uSize: { value: opts.size, type: "f32" },
          uChroma: { value: opts.chroma, type: "f32" },
          uShadows: { value: opts.shadows, type: "f32" },
          uMidtones: { value: opts.midtones, type: "f32" },
          uHighlights: { value: opts.highlights, type: "f32" },
          uStructure: { value: opts.structure, type: "f32" },
          uGrainShape: { value: opts.grainShape, type: "f32" },
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

  get grainShape(): number {
    return this._uniforms.uGrainShape;
  }
  set grainShape(v: number) {
    this._uniforms.uGrainShape = v;
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
    this._uniforms.uSize = Math.max(1.0, sizeAt1920px * (rendererWidth / 1920));
  }
}
