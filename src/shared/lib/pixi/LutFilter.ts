import { Filter, GlProgram, GpuProgram, Texture } from "pixi.js";
import { PROJECT_LUT_SIZE, PROJECT_LUT_TILE_COUNT } from "./lutLayout";
import { defaultGlVertex, defaultWgslVertex } from "./shaderUtils";

const glFragment = `#version 300 es
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uLutTexture;

uniform float uIntensity;
uniform float uLutSize;
uniform float uTileCount;

vec2 lutCoord(vec3 color, float slice) {
    float maxIndex = uLutSize - 1.0;
    float tileX = mod(slice, uTileCount);
    float tileY = floor(slice / uTileCount);
    vec2 tileOrigin = vec2(tileX, tileY) / uTileCount;
    vec2 inTile = (clamp(color.rg, 0.0, 1.0) * maxIndex + 0.5) / uLutSize;

    return tileOrigin + inTile / uTileCount;
}

vec3 sampleLut(vec3 color) {
    float maxIndex = uLutSize - 1.0;
    float slice = clamp(color.b, 0.0, 1.0) * maxIndex;
    float lowerSlice = floor(slice);
    float upperSlice = min(lowerSlice + 1.0, maxIndex);
    float sliceMix = slice - lowerSlice;
    vec3 lowerColor = texture(uLutTexture, lutCoord(color, lowerSlice)).rgb;
    vec3 upperColor = texture(uLutTexture, lutCoord(color, upperSlice)).rgb;

    return mix(lowerColor, upperColor, sliceMix);
}

void main(void) {
    vec4 source = texture(uTexture, vTextureCoord);
    vec3 color = source.rgb;

    if (source.a > 0.0) {
        color /= source.a;
    }

    vec3 graded = sampleLut(color);
    vec3 mixedColor = mix(color, graded, clamp(uIntensity, 0.0, 1.0));

    finalColor = vec4(mixedColor * source.a, source.a);
}
`.trim();

const wgslFragment = `
struct LutUniforms {
  uIntensity: f32,
  uLutSize: f32,
  uTileCount: f32,
};

@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> lutUniforms: LutUniforms;
@group(1) @binding(1) var uLutTexture: texture_2d<f32>;
@group(1) @binding(2) var uLutSampler: sampler;

fn lutCoord(color: vec3<f32>, slice: f32) -> vec2<f32> {
  let maxIndex = lutUniforms.uLutSize - 1.0;
  let tileY = floor(slice / lutUniforms.uTileCount);
  let tileX = slice - tileY * lutUniforms.uTileCount;
  let tileOrigin = vec2<f32>(tileX, tileY) / lutUniforms.uTileCount;
  let inTile = (clamp(color.rg, vec2<f32>(0.0), vec2<f32>(1.0)) * maxIndex + vec2<f32>(0.5)) / lutUniforms.uLutSize;

  return tileOrigin + inTile / lutUniforms.uTileCount;
}

fn sampleLut(color: vec3<f32>) -> vec3<f32> {
  let maxIndex = lutUniforms.uLutSize - 1.0;
  let slice = clamp(color.b, 0.0, 1.0) * maxIndex;
  let lowerSlice = floor(slice);
  let upperSlice = min(lowerSlice + 1.0, maxIndex);
  let sliceMix = slice - lowerSlice;
  let lowerColor = textureSample(uLutTexture, uLutSampler, lutCoord(color, lowerSlice)).rgb;
  let upperColor = textureSample(uLutTexture, uLutSampler, lutCoord(color, upperSlice)).rgb;

  return mix(lowerColor, upperColor, sliceMix);
}

@fragment
fn mainFragment(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let source = textureSample(uTexture, uSampler, uv);
  var color = source.rgb;

  if (source.a > 0.0) {
    color = color / source.a;
  }

  let graded = sampleLut(color);
  let mixedColor = mix(color, graded, clamp(lutUniforms.uIntensity, 0.0, 1.0));

  return vec4<f32>(mixedColor * source.a, source.a);
}
`.trim();

export type LutFilterOptions = {
  intensity?: number;
  texture: Texture;
};

export class LutFilter extends Filter {
  private readonly _uniforms: Record<string, number>;

  constructor({ intensity = 1, texture }: LutFilterOptions) {
    const source = texture.source;
    if (!source) {
      throw new Error("[LutFilter] texture.source is null — cannot create filter");
    }

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
      name: "lut-filter",
    });

    const resources: Record<string, unknown> = {
      lutUniforms: {
        uIntensity: { value: intensity, type: "f32" },
        uLutSize: { value: PROJECT_LUT_SIZE, type: "f32" },
        uTileCount: { value: PROJECT_LUT_TILE_COUNT, type: "f32" },
      },
      uLutTexture: source,
      uLutSampler: source.style,
    };

    super({
      gpuProgram,
      glProgram,
      resources,
    });

    this._uniforms = (
      this.resources as Record<string, { uniforms: Record<string, number> }>
    ).lutUniforms.uniforms;
  }

  get intensity(): number {
    return this._uniforms.uIntensity;
  }

  set intensity(value: number) {
    this._uniforms.uIntensity = value;
  }
}
