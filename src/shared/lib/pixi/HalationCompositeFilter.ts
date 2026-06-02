import { Filter, GlProgram, GpuProgram, Texture } from "pixi.js";

import { defaultGlVertex, defaultWgslVertex } from "./shaderUtils";

const glFragment = `#version 300 es
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uHalationTexture;
uniform vec4 uInputSize;
uniform vec4 uInputClamp;

uniform float uBackgroundGain;
uniform float uGlobalDiffusion;
uniform float uAmplify;
uniform float uBlueComp;
uniform float uImpact;

float luma(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

void main(void) {
    vec2 uv = vTextureCoord;

    vec4 origPma = texture(uTexture, uv);
    vec4 halSample = texture(uHalationTexture, uv);
    vec3 halation = halSample.rgb;
    vec3 original = origPma.a > 0.0 ? origPma.rgb / origPma.a : vec3(0.0);
    float L = luma(original);
    float bgMask = (1.0 - L) * uBackgroundGain;
    float radiusPx = uGlobalDiffusion * 20.0;
    vec2 radiusUV = vec2(radiusPx) / uInputSize.xy;
    const vec2 POISSON[16] = vec2[16](
        vec2(-0.94201624, -0.39906216), vec2(0.94558609, -0.76890725),
        vec2(-0.09418410, -0.92938870), vec2(0.34495738, 0.29387760),
        vec2(-0.91588581, 0.45771432), vec2(-0.81544232, -0.87912464),
        vec2(-0.38277543, 0.27676845), vec2(0.97484398, 0.10695422),
        vec2(0.63097987, -0.48157239), vec2(-0.55125439, -0.43459283),
        vec2(0.18546537, 0.93190551), vec2(-0.60788015, 0.90292508),
        vec2(-0.28454814, -0.75256030), vec2(0.63638602, 0.64530970),
        vec2(-0.65087384, -0.07543927), vec2(0.62348546, -0.78438465)
    );
    vec3 globalGlow = vec3(0.0);
    for (int i = 0; i < 16; i++) {
        vec2 sampleUV = clamp(uv + POISSON[i] * radiusUV, uInputClamp.xy, uInputClamp.zw);
        vec4 gs = texture(uHalationTexture, sampleUV);
        globalGlow += gs.rgb;
    }
    globalGlow /= 16.0;
    float blueFactor = clamp(original.b / max(L, 0.05), 0.0, 4.0);
    bgMask = clamp(bgMask * (1.0 + uBlueComp * blueFactor), 0.0, 1.0);
    vec3 combined = (halation + globalGlow) * uAmplify * bgMask;
    vec3 result = clamp(original + combined * uImpact, 0.0, 1.0);
    finalColor = vec4(result * origPma.a, origPma.a);
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

struct HalationCompositeUniforms {
  uBackgroundGain: f32,
  uGlobalDiffusion: f32,
  uAmplify: f32,
  uBlueComp: f32,
  uImpact: f32,
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> hu: HalationCompositeUniforms;
@group(1) @binding(1) var uHalationTexture: texture_2d<f32>;
@group(1) @binding(2) var uHalationSampler: sampler;

fn luma(c: vec3<f32>) -> f32 {
  return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
}

@fragment
fn mainFragment(
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
) -> @location(0) vec4<f32> {
  let origPma = textureSample(uTexture, uSampler, uv);
  let halSample = textureSample(uHalationTexture, uHalationSampler, uv);
  let halation = halSample.rgb;
  var original = vec3<f32>(0.0);
  if (origPma.a > 0.0) {
    original = origPma.rgb / origPma.a;
  }
  let L = luma(original);
  var bgMask = (1.0 - L) * hu.uBackgroundGain;
  let radiusPx = hu.uGlobalDiffusion * 20.0;
  let radiusUV = vec2<f32>(radiusPx) / gfu.uInputSize.xy;
  let poisson = array<vec2<f32>, 16>(
    vec2<f32>(-0.94201624, -0.39906216), vec2<f32>(0.94558609, -0.76890725),
    vec2<f32>(-0.09418410, -0.92938870), vec2<f32>(0.34495738, 0.29387760),
    vec2<f32>(-0.91588581, 0.45771432), vec2<f32>(-0.81544232, -0.87912464),
    vec2<f32>(-0.38277543, 0.27676845), vec2<f32>(0.97484398, 0.10695422),
    vec2<f32>(0.63097987, -0.48157239), vec2<f32>(-0.55125439, -0.43459283),
    vec2<f32>(0.18546537, 0.93190551), vec2<f32>(-0.60788015, 0.90292508),
    vec2<f32>(-0.28454814, -0.75256030), vec2<f32>(0.63638602, 0.64530970),
    vec2<f32>(-0.65087384, -0.07543927), vec2<f32>(0.62348546, -0.78438465)
  );
  var globalGlow = vec3<f32>(0.0);
  for (var i: i32 = 0; i < 16; i = i + 1) {
    let sampleUV = clamp(uv + poisson[i] * radiusUV, gfu.uInputClamp.xy, gfu.uInputClamp.zw);
    let gs = textureSampleLevel(uHalationTexture, uHalationSampler, sampleUV, 0.0);
    globalGlow = globalGlow + gs.rgb;
  }
  globalGlow = globalGlow / 16.0;
  let blueFactor = clamp(original.b / max(L, 0.05), 0.0, 4.0);
  bgMask = clamp(bgMask * (1.0 + hu.uBlueComp * blueFactor), 0.0, 1.0);
  let combined = (halation + globalGlow) * hu.uAmplify * bgMask;
  let result = clamp(original + combined * hu.uImpact, vec3<f32>(0.0), vec3<f32>(1.0));
  return vec4<f32>(result * origPma.a, origPma.a);
}
`.trim();

export type HalationCompositeOptions = {
  backgroundGain?: number;
  globalDiffusion?: number;
  amplify?: number;
  blueComp?: number;
  impact?: number;
  halationTexture: Texture;
};

export class HalationCompositeFilter extends Filter {
  static readonly defaults: Omit<Required<HalationCompositeOptions>, "halationTexture"> = {
    backgroundGain: 1,
    globalDiffusion: 0.2,
    amplify: 0.5,
    blueComp: 0,
    impact: 0.5,
  };

  private readonly _uniforms: Record<string, number>;

  constructor(options: HalationCompositeOptions) {
    const opts = { ...HalationCompositeFilter.defaults, ...options };

    const source = options.halationTexture.source;

    source.style.scaleMode = "linear";
    source.style.addressMode = "clamp-to-edge";
    source.autoGenerateMipmaps = false;
    source.style.update();
    source.update();

    const gpuProgram = GpuProgram.from({
      vertex: { source: defaultWgslVertex, entryPoint: "mainVertex" },
      fragment: { source: wgslFragment, entryPoint: "mainFragment" },
    });

    const glProgram = GlProgram.from({
      vertex: defaultGlVertex,
      fragment: glFragment,
      name: "halation-composite-filter",
    });

    const resources: Record<string, unknown> = {
      halationCompositeUniforms: {
        uBackgroundGain: { value: opts.backgroundGain, type: "f32" },
        uGlobalDiffusion: { value: opts.globalDiffusion, type: "f32" },
        uAmplify: { value: opts.amplify, type: "f32" },
        uBlueComp: { value: opts.blueComp, type: "f32" },
        uImpact: { value: opts.impact, type: "f32" },
      },
      uHalationTexture: source,
      uHalationSampler: source.style,
    };

    super({
      gpuProgram,
      glProgram,
      clipToViewport: false,
      resources,
    });

    this._uniforms = (
      this.resources as Record<string, { uniforms: Record<string, number> }>
    ).halationCompositeUniforms.uniforms;
  }

  get backgroundGain(): number {
    return this._uniforms.uBackgroundGain;
  }
  set backgroundGain(v: number) {
    this._uniforms.uBackgroundGain = v;
  }

  get globalDiffusion(): number {
    return this._uniforms.uGlobalDiffusion;
  }
  set globalDiffusion(v: number) {
    this._uniforms.uGlobalDiffusion = v;
  }

  get amplify(): number {
    return this._uniforms.uAmplify;
  }
  set amplify(v: number) {
    this._uniforms.uAmplify = v;
  }

  get blueComp(): number {
    return this._uniforms.uBlueComp;
  }
  set blueComp(v: number) {
    this._uniforms.uBlueComp = v;
  }

  get impact(): number {
    return this._uniforms.uImpact;
  }
  set impact(v: number) {
    this._uniforms.uImpact = v;
  }
}
