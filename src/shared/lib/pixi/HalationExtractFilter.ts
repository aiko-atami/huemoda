import { Filter, GlProgram, GpuProgram } from "pixi.js";

import { defaultGlVertex, defaultWgslVertex } from "./shaderUtils";

const glFragment = `#version 300 es
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform vec4 uInputClamp;

uniform float uSourceLimiter;
uniform float uSmoothness;
uniform float uHue;

float luma(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

void main(void) {
    vec2 uv = vTextureCoord;

    vec4 src = texture(uTexture, uv);
    vec3 color = src.a > 0.0 ? src.rgb / src.a : vec3(0.0);
    float L = luma(color);

    float sourceMask = smoothstep(uSourceLimiter, uSourceLimiter + 0.15, L);

    float radius = uSmoothness * 4.0;
    vec2 px = vec2(radius) / uInputSize.xy;

    float sum = 0.0;
    vec4 s;
    vec3 sc; float sL;
    s = texture(uTexture, clamp(uv + vec2( px.x, 0.0), uInputClamp.xy, uInputClamp.zw));
    sc = s.a > 0.0 ? s.rgb / s.a : vec3(0.0); sL = luma(sc);
    sum += smoothstep(uSourceLimiter, uSourceLimiter + 0.15, sL);
    s = texture(uTexture, clamp(uv + vec2(-px.x, 0.0), uInputClamp.xy, uInputClamp.zw));
    sc = s.a > 0.0 ? s.rgb / s.a : vec3(0.0); sL = luma(sc);
    sum += smoothstep(uSourceLimiter, uSourceLimiter + 0.15, sL);
    s = texture(uTexture, clamp(uv + vec2(0.0,  px.y), uInputClamp.xy, uInputClamp.zw));
    sc = s.a > 0.0 ? s.rgb / s.a : vec3(0.0); sL = luma(sc);
    sum += smoothstep(uSourceLimiter, uSourceLimiter + 0.15, sL);
    s = texture(uTexture, clamp(uv + vec2(0.0, -px.y), uInputClamp.xy, uInputClamp.zw));
    sc = s.a > 0.0 ? s.rgb / s.a : vec3(0.0); sL = luma(sc);
    sum += smoothstep(uSourceLimiter, uSourceLimiter + 0.15, sL);

    float blurred = 0.40 * sourceMask + 0.15 * sum;

    vec3 baseRed = vec3(1.0, 0.1, 0.05);
    vec3 orange  = vec3(1.0, 0.5, 0.1);
    vec3 halationColor = mix(baseRed, orange, uHue * L);

    finalColor = vec4(halationColor * blurred, blurred);
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

struct HalationExtractUniforms {
  uSourceLimiter: f32,
  uSmoothness: f32,
  uHue: f32,
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> hu: HalationExtractUniforms;

fn luma(c: vec3<f32>) -> f32 {
  return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
}

@fragment
fn mainFragment(
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
) -> @location(0) vec4<f32> {
  let src = textureSample(uTexture, uSampler, uv);
  var color = vec3<f32>(0.0);
  if (src.a > 0.0) {
    color = src.rgb / src.a;
  }
  let L = luma(color);

  let sourceMask = smoothstep(hu.uSourceLimiter, hu.uSourceLimiter + 0.15, L);

  let radius = hu.uSmoothness * 4.0;
  let px = vec2<f32>(radius) / gfu.uInputSize.xy;

  let s0 = textureSample(uTexture, uSampler, clamp(uv + vec2<f32>( px.x, 0.0), gfu.uInputClamp.xy, gfu.uInputClamp.zw));
  let s1 = textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(-px.x, 0.0), gfu.uInputClamp.xy, gfu.uInputClamp.zw));
  let s2 = textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(0.0,  px.y), gfu.uInputClamp.xy, gfu.uInputClamp.zw));
  let s3 = textureSample(uTexture, uSampler, clamp(uv + vec2<f32>(0.0, -px.y), gfu.uInputClamp.xy, gfu.uInputClamp.zw));

  var c0 = vec3<f32>(0.0);
  var c1 = vec3<f32>(0.0);
  var c2 = vec3<f32>(0.0);
  var c3 = vec3<f32>(0.0);
  if (s0.a > 0.0) { c0 = s0.rgb / s0.a; }
  if (s1.a > 0.0) { c1 = s1.rgb / s1.a; }
  if (s2.a > 0.0) { c2 = s2.rgb / s2.a; }
  if (s3.a > 0.0) { c3 = s3.rgb / s3.a; }

  let m0 = smoothstep(hu.uSourceLimiter, hu.uSourceLimiter + 0.15, luma(c0));
  let m1 = smoothstep(hu.uSourceLimiter, hu.uSourceLimiter + 0.15, luma(c1));
  let m2 = smoothstep(hu.uSourceLimiter, hu.uSourceLimiter + 0.15, luma(c2));
  let m3 = smoothstep(hu.uSourceLimiter, hu.uSourceLimiter + 0.15, luma(c3));

  let blurred = 0.40 * sourceMask + 0.15 * (m0 + m1 + m2 + m3);

  let baseRed = vec3<f32>(1.0, 0.1, 0.05);
  let orange  = vec3<f32>(1.0, 0.5, 0.1);
  let halationColor = mix(baseRed, orange, hu.uHue * L);

  return vec4<f32>(halationColor * blurred, blurred);
}
`.trim();

export type HalationExtractOptions = {
  sourceLimiter?: number;
  smoothness?: number;
  hue?: number;
};

export class HalationExtractFilter extends Filter {
  static readonly defaults: Required<HalationExtractOptions> = {
    sourceLimiter: 0.75,
    smoothness: 0.5,
    hue: 0.3,
  };

  private readonly _uniforms: Record<string, number>;

  constructor(options: HalationExtractOptions = {}) {
    const opts = { ...HalationExtractFilter.defaults, ...options };

    const gpuProgram = GpuProgram.from({
      vertex: { source: defaultWgslVertex, entryPoint: "mainVertex" },
      fragment: { source: wgslFragment, entryPoint: "mainFragment" },
    });

    const glProgram = GlProgram.from({
      vertex: defaultGlVertex,
      fragment: glFragment,
      name: "halation-extract-filter",
    });

    super({
      gpuProgram,
      glProgram,
      clipToViewport: false,
      resources: {
        halationExtractUniforms: {
          uSourceLimiter: { value: opts.sourceLimiter, type: "f32" },
          uSmoothness: { value: opts.smoothness, type: "f32" },
          uHue: { value: opts.hue, type: "f32" },
        },
      },
    });

    this._uniforms = (
      this.resources as Record<string, { uniforms: Record<string, number> }>
    ).halationExtractUniforms.uniforms;
  }

  get sourceLimiter(): number {
    return this._uniforms.uSourceLimiter;
  }
  set sourceLimiter(v: number) {
    this._uniforms.uSourceLimiter = v;
  }

  get smoothness(): number {
    return this._uniforms.uSmoothness;
  }
  set smoothness(v: number) {
    this._uniforms.uSmoothness = v;
  }

  get hue(): number {
    return this._uniforms.uHue;
  }
  set hue(v: number) {
    this._uniforms.uHue = v;
  }
}
