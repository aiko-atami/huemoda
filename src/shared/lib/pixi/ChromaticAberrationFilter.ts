import { Filter, GlProgram, GpuProgram } from "pixi.js";

// ─── GLSL vertex (same default used by pixi-filters) ────────────────────────
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

// ─── GLSL fragment ───────────────────────────────────────────────────────────
const glFragment = `
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputClamp;

uniform float uOffsetX;
uniform float uOffsetY;
uniform float uRedX;
uniform float uRedY;
uniform float uBlueX;
uniform float uBlueY;
uniform float uRadial;
uniform float uTwist;
uniform float uCenterX;
uniform float uCenterY;

const float PI = 3.141592653589793;

void main(void) {
    vec2 uv = vTextureCoord;

    // Map user center [0,1] to texture coordinate space
    vec2 texCenter = mix(uInputClamp.xy, uInputClamp.zw, vec2(uCenterX, uCenterY));
    vec2 toPixel = uv - texCenter;
    float dist = length(toPixel);

    // Twist: rotate base offset direction
    float twistRad = uTwist * PI / 180.0;
    float ca = cos(twistRad);
    float sa = sin(twistRad);
    vec2 offset = vec2(uOffsetX, uOffsetY);
    vec2 twistedOffset = vec2(
        offset.x * ca - offset.y * sa,
        offset.x * sa + offset.y * ca
    );

    // Radial mode: displacement direction points away from center,
    // magnitude scales with distance for true lens chromatic aberration
    vec2 radialDir = (dist > 0.0001) ? normalize(toPixel) : vec2(1.0, 0.0);
    vec2 radialDisp = radialDir * length(twistedOffset) * dist * 4.0;

    // Blend between uniform and radial displacement
    vec2 dispBase = mix(twistedOffset, radialDisp, uRadial);

    // Per-channel fine-tuning (independent offsets on top of the base)
    vec2 redShift  =  dispBase + vec2(uRedX,  uRedY);
    vec2 blueShift = -dispBase + vec2(uBlueX, uBlueY);

    // Sample RGB channels from their shifted coordinates
    vec2 redCoord  = clamp(uv + redShift,  uInputClamp.xy, uInputClamp.zw);
    vec2 blueCoord = clamp(uv + blueShift, uInputClamp.xy, uInputClamp.zw);

    float r = texture(uTexture, redCoord).r;
    float g = texture(uTexture, uv).g;
    float b = texture(uTexture, blueCoord).b;
    float a = texture(uTexture, uv).a;

    finalColor = vec4(r, g, b, a);
}
`.trim();

// ─── WGSL vertex (same default used by pixi-filters) ────────────────────────
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

// ─── WGSL fragment ───────────────────────────────────────────────────────────
const wgslFragment = `
struct ChromaticAberrationUniforms {
  uOffsetX: f32,
  uOffsetY: f32,
  uRedX: f32,
  uRedY: f32,
  uBlueX: f32,
  uBlueY: f32,
  uRadial: f32,
  uTwist: f32,
  uCenterX: f32,
  uCenterY: f32,
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
@group(1) @binding(0) var<uniform> chromaticAberrationUniforms: ChromaticAberrationUniforms;

const PI: f32 = 3.141592653589793;

@fragment
fn mainFragment(
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
) -> @location(0) vec4<f32> {
  let u = chromaticAberrationUniforms;

  let texCenter = mix(gfu.uInputClamp.xy, gfu.uInputClamp.zw, vec2<f32>(u.uCenterX, u.uCenterY));
  let toPixel = uv - texCenter;
  let dist = length(toPixel);

  let twistRad = u.uTwist * PI / 180.0;
  let ca = cos(twistRad);
  let sa = sin(twistRad);
  let offset = vec2<f32>(u.uOffsetX, u.uOffsetY);
  let twistedOffset = vec2<f32>(
    offset.x * ca - offset.y * sa,
    offset.x * sa + offset.y * ca
  );

  var radialDir: vec2<f32>;
  if (dist > 0.0001) {
    radialDir = normalize(toPixel);
  } else {
    radialDir = vec2<f32>(1.0, 0.0);
  }
  let radialDisp = radialDir * length(twistedOffset) * dist * 4.0;

  let dispBase = mix(twistedOffset, radialDisp, u.uRadial);

  let redShift  =  dispBase + vec2<f32>(u.uRedX,  u.uRedY);
  let blueShift = -dispBase + vec2<f32>(u.uBlueX, u.uBlueY);

  let redCoord  = clamp(uv + redShift,  gfu.uInputClamp.xy, gfu.uInputClamp.zw);
  let blueCoord = clamp(uv + blueShift, gfu.uInputClamp.xy, gfu.uInputClamp.zw);

  let r   = textureSample(uTexture, uSampler, redCoord).r;
  let mid = textureSample(uTexture, uSampler, uv);
  let b   = textureSample(uTexture, uSampler, blueCoord).b;

  return vec4<f32>(r, mid.g, b, mid.a);
}
`.trim();

// ─── Filter options ──────────────────────────────────────────────────────────

export type ChromaticAberrationOptions = {
  /** Base horizontal RGB split (red+X / blue−X). Default 0.01 */
  offsetX?: number;
  /** Base vertical RGB split (red+Y / blue−Y). Default 0 */
  offsetY?: number;
  /** Red channel extra horizontal nudge. Default 0 */
  redX?: number;
  /** Red channel extra vertical nudge. Default 0 */
  redY?: number;
  /** Blue channel extra horizontal nudge. Default 0 */
  blueX?: number;
  /** Blue channel extra vertical nudge. Default 0 */
  blueY?: number;
  /** 0 = uniform shift everywhere, 1 = radial from center. Default 0 */
  radial?: number;
  /** Rotate displacement direction in degrees. Default 0 */
  twist?: number;
  /** Radial center X in [0,1]. Default 0.5 */
  centerX?: number;
  /** Radial center Y in [0,1]. Default 0.5 */
  centerY?: number;
};

// ─── Filter class ────────────────────────────────────────────────────────────

export class ChromaticAberrationFilter extends Filter {
  static readonly defaults: Required<ChromaticAberrationOptions> = {
    offsetX: 0.01,
    offsetY: 0,
    redX: 0,
    redY: 0,
    blueX: 0,
    blueY: 0,
    radial: 0,
    twist: 0,
    centerX: 0.5,
    centerY: 0.5,
  };

  private readonly _uniforms: Record<string, number>;

  constructor(options: ChromaticAberrationOptions = {}) {
    const opts = { ...ChromaticAberrationFilter.defaults, ...options };

    const gpuProgram = GpuProgram.from({
      vertex: { source: wgslVertex, entryPoint: "mainVertex" },
      fragment: { source: wgslFragment, entryPoint: "mainFragment" },
    });

    const glProgram = GlProgram.from({
      vertex: glVertex,
      fragment: glFragment,
      name: "chromatic-aberration-filter",
    });

    super({
      gpuProgram,
      glProgram,
      // Prevent the filter area from being clipped to the viewport.
      // Without this, when the image extends beyond the screen (zoom > 1) the
      // filter bounds are cropped to the viewport, so UV [0,1] covers only the
      // visible slice instead of the full image — making the aberration offset
      // represent a smaller and smaller fraction of the image as you zoom in.
      clipToViewport: false,
      resources: {
        chromaticAberrationUniforms: {
          uOffsetX: { value: opts.offsetX, type: "f32" },
          uOffsetY: { value: opts.offsetY, type: "f32" },
          uRedX: { value: opts.redX, type: "f32" },
          uRedY: { value: opts.redY, type: "f32" },
          uBlueX: { value: opts.blueX, type: "f32" },
          uBlueY: { value: opts.blueY, type: "f32" },
          uRadial: { value: opts.radial, type: "f32" },
          uTwist: { value: opts.twist, type: "f32" },
          uCenterX: { value: opts.centerX, type: "f32" },
          uCenterY: { value: opts.centerY, type: "f32" },
        },
      },
    });

    this._uniforms = (
      this.resources as Record<string, { uniforms: Record<string, number> }>
    ).chromaticAberrationUniforms.uniforms;
  }

  get offsetX(): number {
    return this._uniforms.uOffsetX;
  }
  set offsetX(v: number) {
    this._uniforms.uOffsetX = v;
  }

  get offsetY(): number {
    return this._uniforms.uOffsetY;
  }
  set offsetY(v: number) {
    this._uniforms.uOffsetY = v;
  }

  get redX(): number {
    return this._uniforms.uRedX;
  }
  set redX(v: number) {
    this._uniforms.uRedX = v;
  }

  get redY(): number {
    return this._uniforms.uRedY;
  }
  set redY(v: number) {
    this._uniforms.uRedY = v;
  }

  get blueX(): number {
    return this._uniforms.uBlueX;
  }
  set blueX(v: number) {
    this._uniforms.uBlueX = v;
  }

  get blueY(): number {
    return this._uniforms.uBlueY;
  }
  set blueY(v: number) {
    this._uniforms.uBlueY = v;
  }

  get radial(): number {
    return this._uniforms.uRadial;
  }
  set radial(v: number) {
    this._uniforms.uRadial = v;
  }

  get twist(): number {
    return this._uniforms.uTwist;
  }
  set twist(v: number) {
    this._uniforms.uTwist = v;
  }

  get centerX(): number {
    return this._uniforms.uCenterX;
  }
  set centerX(v: number) {
    this._uniforms.uCenterX = v;
  }

  get centerY(): number {
    return this._uniforms.uCenterY;
  }
  set centerY(v: number) {
    this._uniforms.uCenterY = v;
  }
}
