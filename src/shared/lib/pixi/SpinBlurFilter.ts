import { Filter, GlProgram, GpuProgram } from "pixi.js";
import { defaultGlVertex, defaultWgslVertex } from "./shaderUtils";

// ─── GLSL fragment ────────────────────────────────────────────────────────────
//
// Spin blur: simulates camera rotation around a controllable center point.
//
//  Algorithm:
//    1. Convert the current pixel to polar coordinates (angle, radius) relative
//       to the spin center, correcting for image aspect ratio so samples trace
//       a true circle in image space.
//    2. Compute an adaptive sample count so arc-step ≤ 0.5 px at the current
//       radius, clamped to [8, 128].
//    3. Dither the phase offset with a per-pixel hash so discrete steps become
//       high-frequency noise rather than visible banding.
//    4. Accumulate samples at evenly-spaced (jittered) angles within ±blurAmount/2°.
//    5. Average the samples into a blurred result.
//    6. Blend blurred ↔ original using: intensity × falloff, where falloff
//       fades smoothly to zero at the `size` radius boundary (UV-space).
//
const glFragment = `#version 300 es
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform vec4 uInputClamp;

uniform float uIntensity;
uniform float uBlurAmount;
uniform float uPositionX;
uniform float uPositionY;
uniform float uSize;

const float PI = 3.14159265358979;
// Hard upper bound keeps the outer loop constant — required by GLSL ES 1.00.
const int   MAX_SAMPLES = 128;

// Classic hash (Lopes & Mikhail) — fast, uniform, good spectral properties.
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main(void) {
    vec4 original = texture(uTexture, vTextureCoord);
    vec2 uv = vTextureCoord;

    // uPositionX/Y are pixel coordinates (same units as uInputSize.xy).
    // vTextureCoord * uInputSize.xy = pixel position, so divide to convert back.
    vec2 centerUV = vec2(uPositionX / uInputSize.x, uPositionY / uInputSize.y);

    float aspect = uInputSize.x / uInputSize.y;

    // Aspect-corrected polar coords so rotation stays circular in image space.
    vec2  delta = vec2((uv.x - centerUV.x) * aspect, uv.y - centerUV.y);
    float dist  = length(delta);
    float angle = atan(delta.y, delta.x);

    // UV-space distance for the size falloff.
    float uvDist = length(uv - centerUV);
    // Blur grows from the edges inward: uSize=0 → no blur, uSize=1 → full image.
    float innerRadius = 1.0 - uSize;
    float falloff = smoothstep(innerRadius, innerRadius + 0.08, uvDist);

    float halfBlur = uBlurAmount * PI / 360.0;

    // Adaptive sample count (float, to stay legal in GLSL ES 1.00):
    // enough steps so arc-step ≤ 0.5 px at this radius.
    // arcLen (UV) = dist * blurAmount_rad; pixelUV = 1 / min(w,h).
    float arcLen   = dist * uBlurAmount * PI / 180.0;
    float pixelUV  = 1.0 / min(uInputSize.x, uInputSize.y);
    float samplesF = clamp(arcLen / (0.5 * pixelUV) + 1.0, 8.0, 128.0);

    // Per-pixel dither: jitter the phase so banding becomes imperceptible noise.
    float noise = hash(uv * uInputSize.xy);

    // Outer bound is a compile-time constant; float(i) >= samplesF exits early.
    vec4 blurred = vec4(0.0);
    for (int i = 0; i < MAX_SAMPLES; i++) {
        if (float(i) >= samplesF) break;
        float t     = (float(i) + noise) / samplesF;
        float theta = mix(-halfBlur, halfBlur, t);
        // Rotate the delta vector in aspect-corrected space, then convert back.
        vec2 samplePos = centerUV + dist * vec2(cos(angle + theta) / aspect, sin(angle + theta));
        samplePos = clamp(samplePos, uInputClamp.xy, uInputClamp.zw);
        blurred += texture(uTexture, samplePos);
    }
    blurred /= samplesF;

    finalColor = mix(original, blurred, uIntensity * falloff);
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

struct SpinBlurUniforms {
  uIntensity:   f32,
  uBlurAmount:  f32,
  uPositionX:   f32,
  uPositionY:   f32,
  uSize:        f32,
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> spinBlurUniforms: SpinBlurUniforms;

const PI: f32 = 3.14159265358979;

// Classic hash (Lopes & Mikhail) — fast, uniform, good spectral properties.
fn hash2(p: vec2<f32>) -> f32 {
  return fract(sin(dot(p, vec2<f32>(12.9898, 78.233))) * 43758.5453);
}

@fragment
fn mainFragment(
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
) -> @location(0) vec4<f32> {
  let original = textureSample(uTexture, uSampler, uv);

  // uPositionX/Y are pixel coordinates; divide by input texture dimensions
  // to land in the same UV space as the vTextureCoord interpolant.
  let centerUV = vec2<f32>(spinBlurUniforms.uPositionX / gfu.uInputSize.x, spinBlurUniforms.uPositionY / gfu.uInputSize.y);

  let aspect = gfu.uInputSize.x / gfu.uInputSize.y;

  // Aspect-corrected polar coords.
  let delta = vec2<f32>((uv.x - centerUV.x) * aspect, uv.y - centerUV.y);
  let dist  = length(delta);
  let angle = atan2(delta.y, delta.x);

  // UV-space distance for the size falloff.
  // Blur grows from the edges inward: uSize=0 → no blur, uSize=1 → full image.
  let uvDist      = length(uv - centerUV);
  let innerRadius = 1.0 - spinBlurUniforms.uSize;
  let falloff     = smoothstep(innerRadius, innerRadius + 0.08, uvDist);

  let halfBlur = spinBlurUniforms.uBlurAmount * PI / 360.0;

  // Adaptive sample count: enough steps so arc-step ≤ 0.5 px at this radius.
  // arcLen (UV) = dist * blurAmount_rad; pixelUV = 1 / min(w,h).
  let arcLen   = dist * spinBlurUniforms.uBlurAmount * PI / 180.0;
  let pixelUV  = 1.0 / min(gfu.uInputSize.x, gfu.uInputSize.y);
  let samples  = clamp(i32(arcLen / (0.5 * pixelUV)) + 1, 8, 128);

  // Per-pixel dither: jitter the phase so banding becomes imperceptible noise.
  let noise = hash2(uv * gfu.uInputSize.xy);

  var blurred = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  for (var i: i32 = 0; i < samples; i = i + 1) {
    let t     = (f32(i) + noise) / f32(samples);
    let theta = mix(-halfBlur, halfBlur, t);
    let samplePos = clamp(
      centerUV + dist * vec2<f32>(cos(angle + theta) / aspect, sin(angle + theta)),
      gfu.uInputClamp.xy,
      gfu.uInputClamp.zw,
    );
    blurred += textureSampleLevel(uTexture, uSampler, samplePos, 0.0);
  }
  blurred /= f32(samples);

  return mix(original, blurred, spinBlurUniforms.uIntensity * falloff);
}
`.trim();

// ─── Filter options ───────────────────────────────────────────────────────────

export type SpinBlurOptions = {
  /** Overall blend of the blur effect [0, 1]. Default 0.8 */
  intensity?: number;
  /**
   * Angular blur range in degrees. Pixels are sampled across ±blurAmount/2°
   * of rotation around the spin center.
   * Pass `blurPercent * 3.6` to convert from a 0–5 % UI value.  Default 3.6 (= 1 %)
   */
  blurAmount?: number;
  /** Spin center X in pixel coordinates. Default 0 */
  positionX?: number;
  /** Spin center Y in pixel coordinates. Default 0 */
  positionY?: number;
  /**
   * Radius of the affected area in UV space [0, 1].  The blur fades
   * smoothly to zero at this radius.  A value of 0.5 reaches the nearest
   * image edge when the center is at (0.5, 0.5).  Default 0.5
   */
  size?: number;
};

// ─── Filter class ─────────────────────────────────────────────────────────────

export class SpinBlurFilter extends Filter {
  static readonly defaults: Required<SpinBlurOptions> = {
    intensity: 0.8,
    blurAmount: 3.6,
    positionX: 0,
    positionY: 0,
    size: 0.5,
  };

  private readonly _uniforms: Record<string, number>;

  constructor(options: SpinBlurOptions = {}) {
    const opts = { ...SpinBlurFilter.defaults, ...options };

    const gpuProgram = GpuProgram.from({
      vertex: { source: defaultWgslVertex, entryPoint: "mainVertex" },
      fragment: { source: wgslFragment, entryPoint: "mainFragment" },
    });

    const glProgram = GlProgram.from({
      vertex: defaultGlVertex,
      fragment: glFragment,
      name: "spin-blur-filter",
    });

    super({
      gpuProgram,
      glProgram,
      // Prevent clipping so the effect stays correct when the image is zoomed.
      clipToViewport: false,
      resources: {
        spinBlurUniforms: {
          uIntensity: { value: opts.intensity, type: "f32" },
          uBlurAmount: { value: opts.blurAmount, type: "f32" },
          uPositionX: { value: opts.positionX, type: "f32" },
          uPositionY: { value: opts.positionY, type: "f32" },
          uSize: { value: opts.size, type: "f32" },
        },
      },
    });

    this._uniforms = (
      this.resources as Record<string, { uniforms: Record<string, number> }>
    ).spinBlurUniforms.uniforms;
  }

  get intensity(): number {
    return this._uniforms.uIntensity;
  }
  set intensity(v: number) {
    this._uniforms.uIntensity = v;
  }

  get blurAmount(): number {
    return this._uniforms.uBlurAmount;
  }
  set blurAmount(v: number) {
    this._uniforms.uBlurAmount = v;
  }

  get positionX(): number {
    return this._uniforms.uPositionX;
  }
  set positionX(v: number) {
    this._uniforms.uPositionX = v;
  }

  get positionY(): number {
    return this._uniforms.uPositionY;
  }
  set positionY(v: number) {
    this._uniforms.uPositionY = v;
  }

  get size(): number {
    return this._uniforms.uSize;
  }
  set size(v: number) {
    this._uniforms.uSize = v;
  }
}
