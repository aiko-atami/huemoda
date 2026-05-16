import { Filter, GlProgram, GpuProgram, Texture } from "pixi.js";
import { PROJECT_LUT_SIZE, PROJECT_LUT_TILE_COUNT } from "./lutLayout";

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

const glFragment = `
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
    texture.source.style.scaleMode = "linear";
    texture.source.style.addressMode = "clamp-to-edge";
    texture.source.autoGenerateMipmaps = false;
    texture.source.style.update();
    texture.source.update();

    const gpuProgram = GpuProgram.from({
      vertex: { source: wgslVertex, entryPoint: "mainVertex" },
      fragment: { source: wgslFragment, entryPoint: "mainFragment" },
    });

    const glProgram = GlProgram.from({
      vertex: glVertex,
      fragment: glFragment,
      name: "lut-filter",
    });

    super({
      gpuProgram,
      glProgram,
      resources: {
        lutUniforms: {
          uIntensity: { value: intensity, type: "f32" },
          uLutSize: { value: PROJECT_LUT_SIZE, type: "f32" },
          uTileCount: { value: PROJECT_LUT_TILE_COUNT, type: "f32" },
        },
        uLutTexture: texture.source,
        uLutSampler: texture.source.style,
      },
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
