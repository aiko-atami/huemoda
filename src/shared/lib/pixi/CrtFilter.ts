import { Filter, GlProgram, GpuProgram } from "pixi.js";

import { defaultGlVertex, defaultWgslVertex } from "./shaderUtils";

// ─── GLSL fragment ───────────────────────────────────────────────────────────
//
// CRT / retro-TV post-processing effect.
// Ported from ENDESGA's Shadertoy (CC0).
//
// The original uses three buffers applied in sequence:
//   Buffer A – chromatic aberration, RGB grain, vignette, rounded corners
//   Buffer B – 7×4 pixelation, hex-offset, sub-pixel RGB mask
//   Image   – bloom, barrel distortion
//
// Here all three passes are collapsed into a single fragment shader.
// Coordinates are computed relative to uInputClamp bounds so that
// centering is correct regardless of atlas packing.
//
// Pipeline order (for single-pass correctness):
//   1. Barrel distortion (warp UV)
//   2. Chromatic aberration (sample R/G/B)
//   3. Pixelation (mix block average — applied early so later effects stay)
//   4. RGB grain        (always on top)
//   5. Vignette         (always on top)
//   6. Rounded corners  (always on top)
//   7. Sub-pixel mask   (always on top)
//   8. Bloom
//   9. Distortion edge mask
//
const glFragment = `
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform vec4 uInputClamp;

uniform float uAberration;
uniform float uNoise;
uniform float uVignette;
uniform float uRounded;
uniform float uPixelate;
uniform float uMask;
uniform float uBloom;
uniform float uDistortion;
uniform float uFrame;

// ─── Hash / noise helpers (ENDESGA) ──────────────────────────────────────────

float hash3(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
}

float noise3(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    vec3 m = f * f * (3.0 - 2.0 * f);
    vec3 i = p + vec3(1.0, 0.0, 0.0);
    vec4 h = vec4(
        hash3(p),
        hash3(i),
        hash3(p + vec3(0.0, 1.0, 0.0)),
        hash3(i + vec3(0.0, 1.0, 0.0))
    );
    return mix(mix(h.x, h.y, m.x), mix(h.z, h.w, m.x), m.y);
}

float grain(vec3 x) {
    return 0.5 + (4.0 * noise3(x) - noise3(x + 1.0) + noise3(x - 1.0)) / 4.0;
}

// ─── Sub-pixel mask LUT (7x4, row-major) ─────────────────────────────────────

vec3 getMask(int idx) {
    if (idx < 7) return vec3(0.0);
    if (idx ==  7) return vec3(0.0);
    if (idx ==  8 || idx ==  9) return vec3(1.0, 0.0, 0.0);
    if (idx == 10 || idx == 11) return vec3(0.0, 1.0, 0.0);
    if (idx == 12 || idx == 13) return vec3(0.0, 0.0, 1.0);
    if (idx == 14) return vec3(0.0);
    if (idx == 15 || idx == 16) return vec3(1.0, 0.0, 0.0);
    if (idx == 17 || idx == 18) return vec3(0.0, 1.0, 0.0);
    if (idx == 19 || idx == 20) return vec3(0.0, 0.0, 1.0);
    if (idx == 21) return vec3(0.0);
    if (idx == 22 || idx == 23) return vec3(1.0, 0.0, 0.0);
    if (idx == 24 || idx == 25) return vec3(0.0, 1.0, 0.0);
    if (idx == 26 || idx == 27) return vec3(0.0, 0.0, 1.0);
    return vec3(0.0);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

vec2 barrelDistort(vec2 luv, float amount) {
    vec2 p = luv * 2.0 - 1.0;
    float r = length(p);
    if (r < 0.0001) return luv;          // avoid /0 at dead centre
    float ar = amount * r * r;
    p /= (0.2 * ar);
    p = (p * (1.0 - sqrt(max(1.0 - 0.4 * ar, 0.0))) + 1.0) / 2.0;
    return p;
}

float getBloomWeight(int i) {
    if (i == 0 || i == 6) return 0.25;
    if (i == 1 || i == 5) return 0.5;
    if (i == 2 || i == 4) return 1.0;
    return 2.0;
}

void main(void) {
    vec2 cMin  = uInputClamp.xy;
    vec2 cMax  = uInputClamp.zw;
    vec2 cSize = cMax - cMin;
    vec2 imgRes = cSize * uInputSize.xy;

    vec2 luv = (vTextureCoord - cMin) / cSize;

    // ── 1. Barrel distortion ─────────────────────────────────────────────
    if (uDistortion > 0.001) {
        luv = barrelDistort(luv, uDistortion);
    }

    // ── 2. Pixelation (snap UV to 7×4 block center) ─────────────────────
    //   Snapping the UV makes all texture reads (aberration, bloom) pick the
    //   same block texel, so pixelation never overwrites other effects.
    vec2 blockSize = vec2(7.0, 4.0);
    vec2 pixLuv = (floor(luv * imgRes / blockSize) + 0.5) * blockSize / imgRes;
    vec2 sLuv = mix(luv, pixLuv, uPixelate);

    vec2 sUv = cMin + sLuv * cSize;
    vec2 F   = luv * imgRes;

    vec2 blockUv = floor(luv * imgRes / blockSize);
    float hexOff = mod(blockUv.x, 2.0) * 2.0;

    // ── 3. Chromatic aberration ──────────────────────────────────────────
    vec2 aberOff = (sLuv - 0.5) * uAberration * length(sLuv - 0.5) * 0.05 * cSize;
    vec3 color = vec3(
        texture(uTexture, clamp(sUv,                 cMin, cMax)).r,
        texture(uTexture, clamp(sUv - aberOff,       cMin, cMax)).g,
        texture(uTexture, clamp(sUv - 2.0 * aberOff, cMin, cMax)).b
    );

    // ── 4. RGB grain (full-res, always on top) ──────────────────────────
    float frame = floor(uFrame);
    vec3 rgbGrain = vec3(
        grain(vec3(F, frame)),
        grain(vec3(F, frame + 9.0)),
        grain(vec3(F, frame - 9.0))
    );
    color = mix(color, mix(color * rgbGrain, color + (rgbGrain - 1.0), 0.5), uNoise);

    // ── 5. Vignette (full-res) ──────────────────────────────────────────
    float vigR = length((luv - 0.5) * vec2(1.0, imgRes.y / imgRes.x * 2.0));
    color *= mix(1.0, 1.0 - clamp(smoothstep(0.25, 1.0, vigR), 0.0, 1.0), uVignette);

    // ── 6. Rounded corners (full-res) ───────────────────────────────────
    float radius = uRounded * ((imgRes.x + imgRes.y) * 0.5) * 0.06;
    float cd = length(max(abs(F - imgRes * 0.5) - (imgRes * 0.5) + radius, 0.0)) - radius;
    float cornerMask = 1.0 - smoothstep(0.0, 1.5, cd);
    color *= cornerMask;

    // ── 7. Sub-pixel RGB mask (full-res) ────────────────────────────────
    if (uMask > 0.001) {
        int maskIdx = int(mod(F.y + hexOff, 4.0)) * 7 + int(mod(F.x, 7.0));
        color *= mix(vec3(1.0), getMask(maskIdx), uMask);
    }

    // ── 8. Bloom (samples at snapped UV) ────────────────────────────────
    if (uBloom > 0.001) {
        vec4 bloomSum = vec4(0.0);
        for (int bx = -3; bx <= 3; ++bx) {
            for (int by = -3; by <= 3; ++by) {
                vec2 off = vec2(float(bx), float(by)) / uInputSize.xy;
                bloomSum += getBloomWeight(bx + 3) * getBloomWeight(by + 3)
                    * texture(uTexture, clamp(sUv + off, cMin, cMax));
            }
        }
        color = mix(color, (bloomSum / 7.0).rgb, uBloom);
    }

    // ── 9. Barrel distortion edge mask ───────────────────────────────────
    if (uDistortion > 0.001) {
        float v = min(min(luv.x, 1.0 - luv.x), min(luv.y, 1.0 - luv.y));
        float AA = 2.0 / min(imgRes.x, imgRes.y);
        color *= smoothstep(-AA, AA, v);
    }

    finalColor = vec4(color, cornerMask);
}
`.trim();

// ─── WGSL fragment ───────────────────────────────────────────────────────────
const wgslFragment = `
struct CrtUniforms {
  uAberration: f32,
  uNoise: f32,
  uVignette: f32,
  uRounded: f32,
  uPixelate: f32,
  uMask: f32,
  uBloom: f32,
  uDistortion: f32,
  uFrame: f32,
};

struct GlobalFilterUniforms {
  uInputSize:vec4<f32>,
  uInputPixel:vec4<f32>,
  uInputClamp:vec4<f32>,
  uOutputFrame:vec4<f32>,
  uGlobalFrame:vec4<f32>,
  uOutputTexture:vec4<f32>,
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> crt: CrtUniforms;

fn hash3(p_in: vec3<f32>) -> f32 {
  var p = fract(p_in * 0.1031);
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

fn noise3(x: vec3<f32>) -> f32 {
  let p = floor(x);
  let f = fract(x);
  let m = f * f * (3.0 - 2.0 * f);
  let i = p + vec3<f32>(1.0, 0.0, 0.0);
  let h = vec4<f32>(
    hash3(p),
    hash3(i),
    hash3(p + vec3<f32>(0.0, 1.0, 0.0)),
    hash3(i + vec3<f32>(0.0, 1.0, 0.0))
  );
  return mix(mix(h.x, h.y, m.x), mix(h.z, h.w, m.x), m.y);
}

fn grainFn(x: vec3<f32>) -> f32 {
  return 0.5 + (4.0 * noise3(x) - noise3(x + 1.0) + noise3(x - 1.0)) / 4.0;
}

fn getMask(idx: i32) -> vec3<f32> {
  if (idx < 7) { return vec3<f32>(0.0); }
  if (idx == 7 || idx == 14 || idx == 21) { return vec3<f32>(0.0); }
  let col = (idx - 7) % 7;
  if (col == 1 || col == 2) { return vec3<f32>(1.0, 0.0, 0.0); }
  if (col == 3 || col == 4) { return vec3<f32>(0.0, 1.0, 0.0); }
  if (col == 5 || col == 6) { return vec3<f32>(0.0, 0.0, 1.0); }
  return vec3<f32>(0.0);
}

fn barrelDistort(luv: vec2<f32>, amount: f32) -> vec2<f32> {
  var p = luv * 2.0 - 1.0;
  let r = length(p);
  if (r < 0.0001) { return luv; }
  let ar = amount * r * r;
  p /= (0.2 * ar);
  p = (p * (1.0 - sqrt(max(1.0 - 0.4 * ar, 0.0))) + 1.0) / 2.0;
  return p;
}

fn getBloomWeight(i: i32) -> f32 {
  if (i == 0 || i == 6) { return 0.25; }
  if (i == 1 || i == 5) { return 0.5; }
  if (i == 2 || i == 4) { return 1.0; }
  return 2.0;
}

@fragment
fn mainFragment(
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
) -> @location(0) vec4<f32> {
  let cMin  = gfu.uInputClamp.xy;
  let cMax  = gfu.uInputClamp.zw;
  let cSize = cMax - cMin;
  let imgRes = cSize * gfu.uInputSize.xy;

  var luv = (uv - cMin) / cSize;

  // 1. Barrel distortion
  if (crt.uDistortion > 0.001) {
    luv = barrelDistort(luv, crt.uDistortion);
  }

  let sUv = cMin + luv * cSize;
  let F   = luv * imgRes;

  // 2. Chromatic aberration
  let aberOff = (luv - 0.5) * crt.uAberration * length(luv - 0.5) * 0.05 * cSize;
  let aber = vec3<f32>(
    textureSample(uTexture, uSampler, clamp(sUv, cMin, cMax)).r,
    textureSample(uTexture, uSampler, clamp(sUv - aberOff, cMin, cMax)).g,
    textureSample(uTexture, uSampler, clamp(sUv - 2.0 * aberOff, cMin, cMax)).b
  );

  var color = aber;

  // 3. Pixelation
  let blockUv = floor(luv * (imgRes / vec2<f32>(7.0, 4.0)));
  let hexOff = (blockUv.x % 2.0) * 2.0;

  if (crt.uPixelate > 0.001) {
    var pBlock = blockUv;
    pBlock.y += floor((F.y % 4.0) / 2.0) * hexOff * 0.5;

    var blockColor = vec4<f32>(0.0);
    for (var y: f32 = 0.0; y < 4.0; y += 1.0) {
      for (var x: f32 = 0.0; x < 7.0; x += 1.0) {
        let sl = (pBlock * vec2<f32>(7.0, 4.0) + vec2<f32>(x, y)) / imgRes;
        blockColor += textureSample(uTexture, uSampler, clamp(cMin + sl * cSize, cMin, cMax));
      }
    }
    color = mix(color, (blockColor / 28.0).rgb, crt.uPixelate);
  }

  // 4. RGB grain
  let frame = floor(crt.uFrame);
  let rgbGrain = vec3<f32>(
    grainFn(vec3<f32>(F, frame)),
    grainFn(vec3<f32>(F, frame + 9.0)),
    grainFn(vec3<f32>(F, frame - 9.0))
  );
  color = mix(color, mix(color * rgbGrain, color + (rgbGrain - 1.0), 0.5), crt.uNoise);

  // 5. Vignette
  let vigR = length((luv - 0.5) * vec2<f32>(1.0, imgRes.y / imgRes.x * 2.0));
  color *= mix(1.0, 1.0 - clamp(smoothstep(0.25, 1.0, vigR), 0.0, 1.0), crt.uVignette);

  // 6. Rounded corners
  let radius = crt.uRounded * ((imgRes.x + imgRes.y) * 0.5) * 0.06;
  let cd = length(max(abs(F - imgRes * 0.5) - (imgRes * 0.5) + radius, vec2<f32>(0.0))) - radius;
  let cornerMask = 1.0 - smoothstep(0.0, 1.5, cd);
  color *= cornerMask;

  // 7. Sub-pixel RGB mask
  if (crt.uMask > 0.001) {
    let maskIdx = i32((F.y + hexOff) % 4.0) * 7 + i32(F.x % 7.0);
    color *= mix(vec3<f32>(1.0), getMask(maskIdx), crt.uMask);
  }

  // 8. Bloom
  if (crt.uBloom > 0.001) {
    var bloomSum = vec4<f32>(0.0);
    for (var bx: i32 = -3; bx <= 3; bx++) {
      for (var by: i32 = -3; by <= 3; by++) {
        let off = vec2<f32>(f32(bx), f32(by)) / gfu.uInputSize.xy;
        bloomSum += getBloomWeight(bx + 3) * getBloomWeight(by + 3)
          * textureSample(uTexture, uSampler, clamp(sUv + off, cMin, cMax));
      }
    }
    color = mix(color, (bloomSum / 7.0).rgb, crt.uBloom);
  }

  // 9. Barrel distortion edge mask
  if (crt.uDistortion > 0.001) {
    let v = min(min(luv.x, 1.0 - luv.x), min(luv.y, 1.0 - luv.y));
    let AA = 2.0 / min(imgRes.x, imgRes.y);
    color *= smoothstep(-AA, AA, v);
  }

  return vec4<f32>(color, cornerMask);
}
`.trim();

// ─── Filter options ──────────────────────────────────────────────────────────

export type CrtOptions = {
  /** Chromatic aberration strength. Default 0.7 */
  aberration?: number;
  /** RGB grain noise amount. Default 0.7 */
  noise?: number;
  /** Vignette darkening. Default 0.7 */
  vignette?: number;
  /** Rounded corner radius factor. Default 0.7 */
  rounded?: number;
  /** 7×4 pixelation mix. Default 0.7 */
  pixelate?: number;
  /** Sub-pixel RGB mask mix. Default 0.7 */
  mask?: number;
  /** Bloom glow strength. Default 0.7 */
  bloom?: number;
  /** Barrel distortion strength. Default 0.7 */
  distortion?: number;
  /** Animation frame counter (drives grain variation). Default 0 */
  frame?: number;
};

// ─── Filter class ────────────────────────────────────────────────────────────

export class CrtFilter extends Filter {
  static readonly defaults: Required<CrtOptions> = {
    aberration: 0.7,
    noise: 0.7,
    vignette: 0.7,
    rounded: 0.7,
    pixelate: 0.7,
    mask: 0.7,
    bloom: 0.7,
    distortion: 0.7,
    frame: 0,
  };

  private readonly _uniforms: Record<string, number>;

  constructor(options: CrtOptions = {}) {
    const opts = { ...CrtFilter.defaults, ...options };

    const gpuProgram = GpuProgram.from({
      vertex: { source: defaultWgslVertex, entryPoint: "mainVertex" },
      fragment: { source: wgslFragment, entryPoint: "mainFragment" },
    });

    const glProgram = GlProgram.from({
      vertex: defaultGlVertex,
      fragment: glFragment,
      name: "crt-filter",
    });

    super({
      gpuProgram,
      glProgram,
      resources: {
        crtUniforms: {
          uAberration: { value: opts.aberration, type: "f32" },
          uNoise: { value: opts.noise, type: "f32" },
          uVignette: { value: opts.vignette, type: "f32" },
          uRounded: { value: opts.rounded, type: "f32" },
          uPixelate: { value: opts.pixelate, type: "f32" },
          uMask: { value: opts.mask, type: "f32" },
          uBloom: { value: opts.bloom, type: "f32" },
          uDistortion: { value: opts.distortion, type: "f32" },
          uFrame: { value: opts.frame, type: "f32" },
        },
      },
    });

    this._uniforms = (
      this.resources as Record<string, { uniforms: Record<string, number> }>
    ).crtUniforms.uniforms;
  }

  get aberration(): number {
    return this._uniforms.uAberration;
  }
  set aberration(v: number) {
    this._uniforms.uAberration = v;
  }

  get noise(): number {
    return this._uniforms.uNoise;
  }
  set noise(v: number) {
    this._uniforms.uNoise = v;
  }

  get vignette(): number {
    return this._uniforms.uVignette;
  }
  set vignette(v: number) {
    this._uniforms.uVignette = v;
  }

  get rounded(): number {
    return this._uniforms.uRounded;
  }
  set rounded(v: number) {
    this._uniforms.uRounded = v;
  }

  get pixelate(): number {
    return this._uniforms.uPixelate;
  }
  set pixelate(v: number) {
    this._uniforms.uPixelate = v;
  }

  get mask(): number {
    return this._uniforms.uMask;
  }
  set mask(v: number) {
    this._uniforms.uMask = v;
  }

  get bloom(): number {
    return this._uniforms.uBloom;
  }
  set bloom(v: number) {
    this._uniforms.uBloom = v;
  }

  get distortion(): number {
    return this._uniforms.uDistortion;
  }
  set distortion(v: number) {
    this._uniforms.uDistortion = v;
  }

  get frame(): number {
    return this._uniforms.uFrame;
  }
  set frame(v: number) {
    this._uniforms.uFrame = v;
  }
}
