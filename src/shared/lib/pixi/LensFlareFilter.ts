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
// Lens flare rendered as an additive overlay with 4 layers:
//
//  1. Central glow  — two radial falloffs (wide soft + tight bright core).
//  2. Streaks       — starburst using pow(abs(cos(N/2 * θ)), sharpness),
//                     which produces N evenly-spaced blades with no loop.
//  3. Rings         — 2 concentric halos centred on the glow.
//  4. Artifacts     — 5 soft amber blobs along the same axis.
//
// All distance calculations use aspect-ratio-corrected UV coordinates so
// circles remain circular regardless of image dimensions.
//
// uFringe offsets the spread per R/G/B channel (R wider, B tighter), creating
// chromatic dispersion on every layer.  uHue rotates the total flare color via
// Rodrigues rotation around the achromatic (1,1,1)/√3 axis.
//
const glFragment = `
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputSize;

uniform float uIntensity;
uniform float uPower;
uniform float uPositionX;
uniform float uPositionY;
uniform float uArtifacts;
uniform float uRings;
uniform float uStreaks;
uniform float uRotation;
uniform float uHue;
uniform float uFringe;

const float PI = 3.14159265358979;

// Thin ring SDF: returns 1 at radius r, falls off with half-width w.
float ring(float d, float r, float w) {
    return smoothstep(0.0, w, w - abs(d - r));
}

// Rodrigues hue rotation around the (1,1,1)/√3 axis.
vec3 hueShift(vec3 col, float angle) {
    float cosA = cos(angle);
    float sinA = sin(angle);
    vec3 k = vec3(0.57735, 0.57735, 0.57735);
    return col * cosA + cross(k, col) * sinA + k * dot(k, col) * (1.0 - cosA);
}

void main(void) {
    vec4 color = texture(uTexture, vTextureCoord);
    vec2 uv = vTextureCoord;

    float aspect = uInputSize.x / uInputSize.y;
    vec2 flarePos = vec2(uPositionX, uPositionY);

    // Aspect-corrected displacement from flare position to current pixel.
    vec2 dirAR = vec2((uv.x - flarePos.x) * aspect, uv.y - flarePos.y);
    float dist = length(dirAR);
    float spread = uPower;

    // Fringe: per-channel spread offset (R softer/wider, B harder/tighter).
    float fo = uFringe * 0.25;
    float spreadR = spread * (1.0 - fo);
    float spreadB = spread * (1.0 + fo);

    // Accumulate all flare light here so hue rotation applies to the whole flare.
    vec3 flare = vec3(0.0);

    // ── 1. Central glow ──────────────────────────────────────────────────────
    float glowR = pow(max(0.0, 1.0 - dist * spreadR),       2.5);
    float glowG = pow(max(0.0, 1.0 - dist * spread),         2.5);
    float glowB = pow(max(0.0, 1.0 - dist * spreadB),       2.5);
    float core  = pow(max(0.0, 1.0 - dist * spread * 4.0),  8.0);
    // Warm white for wide glow, pure white for tight core.
    vec3 warmWhite = mix(vec3(1.0, 0.92, 0.75), vec3(1.0), core);
    flare += vec3(glowR, glowG, glowB) * warmWhite * (0.8 + core * 1.2) * uIntensity;

    // ── 2. Streaks ───────────────────────────────────────────────────────────
    // Blades are symmetric (each blade extends both ways), so N even blades
    // are produced by cos(N/2 * theta).  uStreaks is always even (step 2).
    float axisAngle = atan(0.5 - flarePos.y, (0.5 - flarePos.x) * aspect);
    float rotRad = uRotation * PI / 180.0;
    float angle  = atan(dirAR.y, dirAR.x);
    float blade  = pow(abs(cos(uStreaks * 0.5 * (angle - axisAngle - rotRad))), 30.0);
    float fadeR = 1.0 / (1.0 + dist * spreadR * 2.5);
    float fadeG = 1.0 / (1.0 + dist * spread  * 2.5);
    float fadeB = 1.0 / (1.0 + dist * spreadB * 2.5);
    flare += vec3(fadeR, fadeG * 0.97, fadeB * 0.82) * blade * uIntensity * 0.45;

    // ── Flare axis (for artifacts) ────────────────────────────────────────────
    // The axis vector in UV space goes from the light source towards the
    // image center and beyond.  t=1 lands at centre, t=2 at the mirror point.
    vec2 axis = vec2(0.5, 0.5) - flarePos;

    // ── 3. Rings ─────────────────────────────────────────────────────────────
    // Two concentric halos centred on the glow (flare position).
    if (uRings > 0.0) {
        float rr[2];
        rr[0] = 0.070; rr[1] = 0.140;

        for (int i = 0; i < 2; i++) {
            float fw = rr[i] * uFringe * 0.5;
            float rR = ring(dist, rr[i] + fw, 0.004);
            float rG = ring(dist, rr[i],       0.004);
            float rB = ring(dist, rr[i] - fw,  0.004);
            flare += vec3(0.75 * rR, 0.90 * rG, 1.0 * rB) * uRings * uIntensity;
        }
    }

    // ── 4. Artifacts (bokeh blobs) ────────────────────────────────────────────
    if (uArtifacts > 0.0) {
        float at[5];
        at[0] = 0.60; at[1] = 0.88; at[2] = 1.20; at[3] = 1.50; at[4] = 1.85;
        float ar[5];
        ar[0] = 0.022; ar[1] = 0.038; ar[2] = 0.018; ar[3] = 0.030; ar[4] = 0.014;
        float ab[5];
        ab[0] = 0.50; ab[1] = 0.70; ab[2] = 0.40; ab[3] = 0.55; ab[4] = 0.30;

        for (int i = 0; i < 5; i++) {
            vec2 artCenter = flarePos + axis * at[i];
            vec2 toArt = vec2((uv.x - artCenter.x) * aspect, uv.y - artCenter.y);
            float d = length(toArt);
            float arR = ar[i] * (1.0 + uFringe * 0.3);
            float arB = ar[i] * (1.0 - uFringe * 0.3);
            float bR = smoothstep(arR,   arR * 0.1,   d);
            float bG = smoothstep(ar[i], ar[i] * 0.1, d);
            float bB = smoothstep(arB,   arB * 0.1,   d);
            flare += vec3(bR, bG * 0.70, bB * 0.28) * ab[i] * uArtifacts * uIntensity;
        }
    }

    // ── Hue rotation applied to the total flare contribution ─────────────────
    if (uHue > 0.001) {
        flare = hueShift(flare, uHue * PI / 180.0);
    }

    color.rgb += flare;
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

struct LensFlareUniforms {
  uIntensity: f32,
  uPower: f32,
  uPositionX: f32,
  uPositionY: f32,
  uArtifacts: f32,
  uRings: f32,
  uStreaks: f32,
  uRotation: f32,
  uHue: f32,
  uFringe: f32,
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> lfu: LensFlareUniforms;

const PI: f32 = 3.14159265358979;

fn ring(d: f32, r: f32, w: f32) -> f32 {
  return smoothstep(0.0, w, w - abs(d - r));
}

// Rodrigues hue rotation around the (1,1,1)/√3 axis.
fn hueShift(col: vec3<f32>, angle: f32) -> vec3<f32> {
  let cosA = cos(angle);
  let sinA = sin(angle);
  let k = vec3<f32>(0.57735, 0.57735, 0.57735);
  return col * cosA + cross(k, col) * sinA + k * dot(k, col) * (1.0 - cosA);
}

@fragment
fn mainFragment(
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
) -> @location(0) vec4<f32> {
  var color = textureSample(uTexture, uSampler, uv);

  let aspect   = gfu.uInputSize.x / gfu.uInputSize.y;
  let flarePos = vec2<f32>(lfu.uPositionX, lfu.uPositionY);
  let dirAR    = vec2<f32>((uv.x - flarePos.x) * aspect, uv.y - flarePos.y);
  let dist     = length(dirAR);
  let spread   = lfu.uPower;

  // Fringe: per-channel spread offset (R softer/wider, B harder/tighter).
  let fo      = lfu.uFringe * 0.25;
  let spreadR = spread * (1.0 - fo);
  let spreadB = spread * (1.0 + fo);

  // Accumulate all flare light here so hue rotation applies to the whole flare.
  var flare = vec3<f32>(0.0, 0.0, 0.0);

  // ── 1. Central glow ────────────────────────────────────────────────────────
  let glowR    = pow(max(0.0, 1.0 - dist * spreadR),       2.5);
  let glowG    = pow(max(0.0, 1.0 - dist * spread),         2.5);
  let glowB    = pow(max(0.0, 1.0 - dist * spreadB),       2.5);
  let core     = pow(max(0.0, 1.0 - dist * spread * 4.0),  8.0);
  // Warm white for wide glow, pure white for tight core.
  let warmWhite = mix(vec3<f32>(1.0, 0.92, 0.75), vec3<f32>(1.0, 1.0, 1.0), core);
  flare += vec3<f32>(glowR, glowG, glowB) * warmWhite * (0.8 + core * 1.2) * lfu.uIntensity;

  // ── 2. Streaks ─────────────────────────────────────────────────────────────
  // Blades are symmetric (each blade extends both ways), so N even blades
  // are produced by cos(N/2 * theta).  uStreaks is always even (step 2).
  let axisAngle = atan2(0.5 - flarePos.y, (0.5 - flarePos.x) * aspect);
  let rotRad = lfu.uRotation * PI / 180.0;
  let angle  = atan2(dirAR.y, dirAR.x);
  let blade  = pow(abs(cos(lfu.uStreaks * 0.5 * (angle - axisAngle - rotRad))), 30.0);
  let fadeR  = 1.0 / (1.0 + dist * spreadR * 2.5);
  let fadeG  = 1.0 / (1.0 + dist * spread  * 2.5);
  let fadeB  = 1.0 / (1.0 + dist * spreadB * 2.5);
  flare += vec3<f32>(fadeR, fadeG * 0.97, fadeB * 0.82) * blade * lfu.uIntensity * 0.45;

  // ── Flare axis ─────────────────────────────────────────────────────────────
  // t=1 lands at centre, t=2 at the mirror point.
  let axis = vec2<f32>(0.5, 0.5) - flarePos;

  // ── 3. Rings ───────────────────────────────────────────────────────────────
  // Two concentric halos centred on the glow (flare position).
  if (lfu.uRings > 0.0) {
    let rr = array<f32, 2>(0.070, 0.140);

    for (var i: i32 = 0; i < 2; i++) {
      let fw = rr[i] * lfu.uFringe * 0.5;
      let rR = ring(dist, rr[i] + fw, 0.004);
      let rG = ring(dist, rr[i],       0.004);
      let rB = ring(dist, rr[i] - fw,  0.004);
      flare += vec3<f32>(0.75 * rR, 0.90 * rG, 1.0 * rB) * lfu.uRings * lfu.uIntensity;
    }
  }

  // ── 4. Artifacts ───────────────────────────────────────────────────────────
  if (lfu.uArtifacts > 0.0) {
    let at = array<f32, 5>(0.60, 0.88, 1.20, 1.50, 1.85);
    let ar = array<f32, 5>(0.022, 0.038, 0.018, 0.030, 0.014);
    let ab = array<f32, 5>(0.50, 0.70, 0.40, 0.55, 0.30);

    for (var i: i32 = 0; i < 5; i++) {
      let artCenter = flarePos + axis * at[i];
      let toArt = vec2<f32>((uv.x - artCenter.x) * aspect, uv.y - artCenter.y);
      let d = length(toArt);
      let arR = ar[i] * (1.0 + lfu.uFringe * 0.3);
      let arB = ar[i] * (1.0 - lfu.uFringe * 0.3);
      let bR = smoothstep(arR,    arR * 0.1,    d);
      let bG = smoothstep(ar[i],  ar[i] * 0.1,  d);
      let bB = smoothstep(arB,    arB * 0.1,    d);
      flare += vec3<f32>(bR, bG * 0.70, bB * 0.28) * ab[i] * lfu.uArtifacts * lfu.uIntensity;
    }
  }

  // ── Hue rotation applied to the total flare contribution ───────────────────
  if (lfu.uHue > 0.001) {
    flare = hueShift(flare, lfu.uHue * PI / 180.0);
  }

  return vec4<f32>(color.rgb + flare, color.a);
}
`.trim();

// ─── Filter options ───────────────────────────────────────────────────────────

export type LensFlareOptions = {
  /** Master brightness of the entire flare effect [0, 1]. Default 0.5 */
  intensity?: number;
  /** Central glow falloff sharpness — higher = tighter, harder core [1, 10]. Default 3 */
  power?: number;
  /** Light source X position in UV space [0, 1]. Default 0.3 */
  positionX?: number;
  /** Light source Y position in UV space [0, 1]. Default 0.25 */
  positionY?: number;
  /** Artifact blob intensity [0, 1]. Default 0.5 */
  artifacts?: number;
  /** Ring halo intensity [0, 1]. Default 0.3 */
  rings?: number;
  /**
   * Number of starburst blades (must be even; step 2).
   * Uses pow(abs(cos(N/2 * θ)), sharpness) — no loop required.
   * Default 6
   */
  streaks?: number;
  /** Starburst rotation offset in degrees [0, 360]. Default 0 */
  rotation?: number;
  /** Hue rotation of the entire flare in degrees [0, 360]. Default 0 */
  hue?: number;
  /**
   * Chromatic fringe: splits R/G/B channel spreads so R is wider/softer and
   * B is tighter/harder, creating a prismatic dispersion on every flare layer.
   * [0, 0.1]. Default 0
   */
  fringe?: number;
};

// ─── Filter class ─────────────────────────────────────────────────────────────

export class LensFlareFilter extends Filter {
  static readonly defaults: Required<LensFlareOptions> = {
    intensity: 0.5,
    power: 3,
    positionX: 0.3,
    positionY: 0.25,
    artifacts: 0.5,
    rings: 0.3,
    streaks: 2,
    rotation: 0,
    hue: 0,
    fringe: 0,
  };

  private readonly _uniforms: Record<string, number>;

  constructor(options: LensFlareOptions = {}) {
    const opts = { ...LensFlareFilter.defaults, ...options };

    const gpuProgram = GpuProgram.from({
      vertex: { source: wgslVertex, entryPoint: "mainVertex" },
      fragment: { source: wgslFragment, entryPoint: "mainFragment" },
    });

    const glProgram = GlProgram.from({
      vertex: glVertex,
      fragment: glFragment,
      name: "lens-flare-filter",
    });

    super({
      gpuProgram,
      glProgram,
      // Prevent the filter area from being clipped to the viewport so that
      // flare elements near the edges remain visible at any zoom level.
      clipToViewport: false,
      resources: {
        lensFlareUniforms: {
          uIntensity: { value: opts.intensity, type: "f32" },
          uPower: { value: opts.power, type: "f32" },
          uPositionX: { value: opts.positionX, type: "f32" },
          uPositionY: { value: opts.positionY, type: "f32" },
          uArtifacts: { value: opts.artifacts, type: "f32" },
          uRings: { value: opts.rings, type: "f32" },
          uStreaks: { value: opts.streaks, type: "f32" },
          uRotation: { value: opts.rotation, type: "f32" },
          uHue: { value: opts.hue, type: "f32" },
          uFringe: { value: opts.fringe, type: "f32" },
        },
      },
    });

    this._uniforms = (
      this.resources as Record<string, { uniforms: Record<string, number> }>
    ).lensFlareUniforms.uniforms;
  }

  get intensity(): number {
    return this._uniforms.uIntensity;
  }
  set intensity(v: number) {
    this._uniforms.uIntensity = v;
  }

  get power(): number {
    return this._uniforms.uPower;
  }
  set power(v: number) {
    this._uniforms.uPower = v;
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

  get artifacts(): number {
    return this._uniforms.uArtifacts;
  }
  set artifacts(v: number) {
    this._uniforms.uArtifacts = v;
  }

  get rings(): number {
    return this._uniforms.uRings;
  }
  set rings(v: number) {
    this._uniforms.uRings = v;
  }

  get streaks(): number {
    return this._uniforms.uStreaks;
  }
  set streaks(v: number) {
    this._uniforms.uStreaks = v;
  }

  get rotation(): number {
    return this._uniforms.uRotation;
  }
  set rotation(v: number) {
    this._uniforms.uRotation = v;
  }

  get hue(): number {
    return this._uniforms.uHue;
  }
  set hue(v: number) {
    this._uniforms.uHue = v;
  }

  get fringe(): number {
    return this._uniforms.uFringe;
  }
  set fringe(v: number) {
    this._uniforms.uFringe = v;
  }
}
