# PixiJS Custom Filters — Workflow & Conventions

## Architecture

All custom filters live in `src/shared/lib/pixi/`. Each filter is a single
self-contained `.ts` file with inline GLSL and WGSL fragment shaders. No
separate `.frag`/`.vert` files — every existing filter embeds shaders as
template literals.

## Files to Touch (in order)

When adding a new filter, **all five** of these must be updated:

| # | File | What to add |
|---|------|-------------|
| 1 | `src/shared/lib/pixi/<Name>Filter.ts` | Filter class + options type + both shaders |
| 2 | `src/shared/lib/pixi/filterTypes.ts` | Entry in `PixiFilterValues` type + default in `createEmptyPixiFilterValues()` |
| 3 | `src/shared/lib/pixi/filterFactory.ts` | Import class, add `if (xxx.enabled)` block in `createPixiFilters()` |
| 4 | `src/shared/lib/pixi/index.ts` | `export { XxxFilter }` + `export type { XxxOptions }` |
| 5 | `src/entities/filter-chain/model.ts` | Add to `FILTER_IDS`, add `FilterDefinition` with parameters, add to `toPixiFilterValues()` |

## Filter Class Pattern

Every filter follows this exact structure (copy from any existing file):

```ts
import { Filter, GlProgram, GpuProgram } from "pixi.js";
import { defaultGlVertex, defaultWgslVertex } from "./shaderUtils";

const glFragment = ` ... `.trim();
const wgslFragment = ` ... `.trim();

export type XxxOptions = { ... };

export class XxxFilter extends Filter {
  static readonly defaults: Required<XxxOptions> = { ... };
  private readonly _uniforms: Record<string, number>;

  constructor(options: XxxOptions = {}) {
    const opts = { ...XxxFilter.defaults, ...options };

    const gpuProgram = GpuProgram.from({
      vertex: { source: defaultWgslVertex, entryPoint: "mainVertex" },
      fragment: { source: wgslFragment, entryPoint: "mainFragment" },
    });

    const glProgram = GlProgram.from({
      vertex: defaultGlVertex,
      fragment: glFragment,
      name: "xxx-filter",
    });

    super({
      gpuProgram,
      glProgram,
      resources: {
        xxxUniforms: { uField: { value: opts.field, type: "f32" }, ... },
      },
    });

    this._uniforms = (
      this.resources as Record<string, { uniforms: Record<string, number> }>
    ).xxxUniforms.uniforms;
  }

  get field(): number { return this._uniforms.uField; }
  set field(v: number) { this._uniforms.uField = v; }
}
```

## Shader Conventions

### Vertex shader

**Never** write a custom vertex shader. Import `defaultGlVertex` /
`defaultWgslVertex` from `./shaderUtils`. They provide `vTextureCoord` (GLSL)
or `uv` (WGSL) and the standard pixi uniform bindings.

### GlobalFilterUniforms

The shared vertex exposes these — **use them, do not re-declare**:

| Uniform | Type | Use for |
|---------|------|---------|
| `uInputSize` | `vec4<f32>` | `.xy` = texture dims in px. Use **instead of** a custom `uResolution` uniform. |
| `uInputPixel` | `vec4<f32>` | `.xy` = 1/textureSize |
| `uInputClamp` | `vec4<f32>` | `.xy` = min UV, `.zw` = max UV. Use for edge-clamping texture samples. |
| `uOutputFrame` | `vec4<f32>` | Output viewport rect |
| `uGlobalFrame` | `vec4<f32>` | Global frame |
| `uOutputTexture` | `vec4<f32>` | Output texture dims |

### GLSL fragment boilerplate

```glsl
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform vec4 uInputClamp;
// ... custom uniforms ...

void main(void) {
    vec2 uv = vTextureCoord;
    // ...
    finalColor = vec4(result, 1.0);
}
```

### WGSL fragment boilerplate

```wgsl
struct GlobalFilterUniforms {
  uInputSize:vec4<f32>,
  uInputPixel:vec4<f32>,
  uInputClamp:vec4<f32>,
  uOutputFrame:vec4<f32>,
  uGlobalFrame:vec4<f32>,
  uOutputTexture:vec4<f32>,
};

struct XxxUniforms {
  uField: f32,
  // ...
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> xu: XxxUniforms;

@fragment
fn mainFragment(
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
) -> @location(0) vec4<f32> {
  let u = xu;
  // ...
}
```

## Common Pitfalls

### 0. Always target WebGL2 (GLSL ES 3.00), not WebGL1 (GLSL ES 1.00)

WebGL 1.0 / GLSL ES 1.00 is a legacy standard (OpenGL ES 2.0, 2007). It lacks
array constructors, dynamic loops, and modern GLSL features. **All GLSL
shaders must target GLSL ES 3.00** (WebGL 2.0) or WGSL (WebGPU). The
renderer is configured with `preference: "webgl2"` to ensure WebGL2 context.

This means you can safely use:
- Array constructors: `const vec2 POISSON[16] = vec2[16](...)`
- `for` loops with constant iteration counts
- `texelFetch`, integer operations, etc.

Never write shaders that limit themselves to GLSL ES 1.00 compatibility.

### 1. Never add `uResolution` — use `uInputSize.xy`

External shader code often declares its own `uResolution` uniform for pixel
dimensions. In this codebase, `uInputSize.xy` already provides texture
dimensions in pixels via the shared vertex. Adding a duplicate uniform wastes
a binding slot and must be manually kept in sync.

**Before (wrong):**
```glsl
uniform vec2 uResolution;
vec2 px = uv * uResolution / uSize;
```

**After (correct):**
```glsl
vec2 px = uv * uInputSize.xy / uSize;
```

### 2. GLSL 300 es is strict about vector/scalar ops

GLSL 300 es does **not** allow implicit scalar-to-vector promotion in function
arguments or binary ops where the other operand is a vector.

**Wrong:** `clusteredGrain(px + 17.13, seed + 1.0, s)` — second arg is `float`,
function expects `vec2`.

**Fix:** `clusteredGrain(px + vec2(17.13, 0.0), vec2(seed, seed) + 1.0, s)`

Or restructure the function to accept `float seed` and build the vec2 inside.

### 3. Always clamp texture sample UVs with `uInputClamp`

Sampling out-of-bounds UVs wraps or produces black. When a shader does spatial
offsets (blur, aberration, resolution loss), clamp the coordinates:

```glsl
texture(uTexture, clamp(uv + offset, uInputClamp.xy, uInputClamp.zw))
```

WGSL equivalent:
```wgsl
textureSample(uTexture, uSampler, clamp(uv + offset, gfu.uInputClamp.xy, gfu.uInputClamp.zw))
```

### 4. No per-frame uniforms (no `uTime`, no ticker update)

Filters in this project are created once by `filterFactory` and never updated
per-frame. The architecture has no ticker loop for filter uniforms. If a
shader needs variation, use a `uSeed` uniform set at construction time
(via `Math.random()` from the factory context).

### 5. No separate shader files

Do not create `.frag` / `.vert` / `.glsl` files. All shaders are inline
template literals in the TS class file. This is consistent with every existing
filter and avoids Vite raw-import configuration.

### 6. Map UI-friendly values in `toPixiFilterValues`, not in the shader

The `FILTER_DEFINITIONS` in `model.ts` use UI-friendly parameters (select
options, percentage ranges, degree angles). Map them to shader-compatible
values in `toPixiFilterValues()`:

- Select `"negative"` / `"positive"` → `positive: 0 | 1`
- Percentage `0..100` → divide by 100 or 200
- Degrees → radians or degrees (depends on shader)
- Pixel coords normalised `0..100` → divide by 100

### 7. `clipToViewport: false` for spatial filters

If the filter samples neighbouring pixels (blur, aberration, resolution loss)
and the image can be zoomed beyond the viewport, add `clipToViewport: false`
in the `super()` call. Without it, UV `[0,1]` covers only the visible slice
when zoomed in, breaking spatial offsets.

### 8. Uniform struct field order must match TS declaration order

WebGPU uniform buffers are laid out sequentially. The WGSL struct field order
must exactly match the order of keys in the `resources` object passed to
`super()`. Reordering will silently break uniform values.

### 9. WGSL `textureSampleLevel` needs explicit LOD

When sampling in a non-uniform control flow (loops, if/else), use
`textureSampleLevel(uTexture, uSampler, uv, 0.0)` instead of `textureSample`.
The latter requires uniform control flow and will cause validation errors
inside loops.

## Validation Checklist

After creating a new filter, run:

```bash
pnpm lint        # BiomeJS lint + format
npx tsc --noEmit # TypeScript type check
pnpm test        # Vitest unit tests
```

Verify these manually:

- [ ] Filter class has `static readonly defaults`
- [ ] Both GLSL and WGSL fragment shaders are present
- [ ] No custom vertex shader — using shared `defaultGlVertex`/`defaultWgslVertex`
- [ ] No `uResolution` uniform — using `uInputSize.xy` instead
- [ ] All texture samples with spatial offsets are UV-clamped via `uInputClamp`
- [ ] No `uTime`/per-frame uniforms — using `uSeed` instead
- [ ] `filterTypes.ts` has entry in both `PixiFilterValues` and `createEmptyPixiFilterValues()`
- [ ] `filterFactory.ts` imports and instantiates the filter
- [ ] `index.ts` exports class + options type
- [ ] `model.ts` has entry in `FILTER_IDS`, `FILTER_DEFINITIONS`, and `toPixiFilterValues()`
