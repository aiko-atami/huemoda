# Performance Optimization Plan for Mobile Devices (v2 — Superplan)

## Context

HueModa is a Pixi.js v8 photo editor (FSD + Effector + effector-react + Panda CSS).
The performance-sensitive path is **live filter preview + canvas gestures on mobile**.

> **Status (post-implementation):** all four PRs below are done. The headline fix
> is **in-place uniform updates** (no per-tick shader-program recreation) plus rAF
> render coalescing. An "interaction mode" cheap-preview was attempted and removed
> because its preview/settle split caused a visible re-render on slider release;
> the renderer now uses one identical bake path during a drag and on release. The
> sections below keep the original problem statement for context and annotate each
> item with what actually shipped.

The architecture is fundamentally sound — rendering is on-demand (no continuous
ticker), DPR is capped at 2, LUT textures are loaded once and cached. The real
problem **was** the cost and frequency of updates during interaction:

- A native range `Slider` (`src/shared/ui/Slider.tsx`) fires `onChange` on every
  tick (~60–120 Hz). There is **no throttle/debounce/sample** between the slider
  and the Effector store.
- Each change produces a new `$pixiFilterValues` object → `PixiCanvas` effect →
  `renderer.setFilterValues()` → **full filter-chain teardown + rebuild + a
  render-to-texture bake**, *synchronously*, every time.
- With halation enabled, `applyFilters()` performs **three** full-size bakes
  (base → signal → composite) per call.
- Canvas `pan`/`zoomAt`/`wheelZoom` each call `render()` synchronously per
  pointer event; pinch can render twice per event.
- `FilterPanelBody` re-renders ~50 control components on any `$filterChain`
  change (no `React.memo`).

**Intended outcome:** dragging a slider or doing a pinch/pan on a mid-range phone
stays at one GPU render per animation frame, with no per-tick shader-program
recreation, while export remains full-resolution and full-quality.

---

## Key discovery that reshapes the plan

**Every filter in the repo already exposes live uniform setters.** Verified:

- Custom: `GrainFilter` (`amount/size/chroma/shadows/midtones/highlights/grainShape/positive/resolutionLoss`),
  `SpinBlurFilter` (`intensity/blurAmount/positionX/positionY/size`),
  `ChromaticAberrationFilter`, `CrtFilter`, `LensFlareFilter`,
  `HalationExtractFilter`, `HalationCompositeFilter`, `LutFilter.intensity`,
  `MirroredBlurFilter.strength` — all write straight into `this._uniforms`.
- Built-in pixi-filters (`AdjustmentFilter`, `KawaseBlurFilter`, `AdvancedBloomFilter`,
  `DotFilter`, `GlitchFilter`, `GlowFilter`, `MotionBlurFilter`, `SimplexNoiseFilter`,
  `ZoomBlurFilter`, `ColorOverlayFilter`) expose settable properties.

Because of this, **"persist filter instances and update uniforms in place"** is a
*low-risk* change, not the deep-architecture endgame the previous plan framed it
as. It is promoted into the core of the plan: when the **set of enabled filters
is unchanged** (only parameter values moved — the common slider-drag case), we
skip teardown/recreate entirely and just write uniforms + schedule one render.

---

## Roadmap

### P0 — Render coalescing (highest impact, lowest risk)

**Status:** ✅ Done in PR 1. Pixi `Application` now runs with `autoStart: false`; interactive updates use `requestRender()` and coalesce through rAF; pending rAF is cancelled on destroy; export keeps synchronous extraction semantics.

**Goal:** collapse all transform/filter updates within a frame into a single GPU render.

File: `src/shared/lib/pixi/PixiPhotoRenderer.ts`

1. Add a private rAF scheduler:
   - `private rafId: number | null = null;`
   - `private requestRender(): void` — if `rafId === null`, schedule
     `requestAnimationFrame(() => { this.rafId = null; this.renderNow(); })`.
   - Rename the existing private `render()` to `renderNow()` (synchronous, used by
     export and any path that must render immediately before reading pixels).
2. Replace the synchronous `this.render()` calls in `pan()`, `zoomAt()`,
   `wheelZoom()` (delegates to `zoomAt`), `resize()`, and `setImage()`'s final
   render with `this.requestRender()`.
3. In `destroy()`, cancel a pending frame: `if (this.rafId !== null) cancelAnimationFrame(this.rafId)`.
4. `exportImage()` must keep using `renderNow()` semantics — it already calls
   `updateFilteredTexture()` + `extract.canvas()` which read synchronously, so do
   **not** route export through the scheduler.

**Risk:** very low. Pinch's "pan + zoom in one event" now coalesces for free.

---

### P1 — In-place uniform updates (eliminate per-tick shader churn)

**Status:** ✅ Done in PR 2. `filterFactory` now exposes an enabled-set fingerprint, typed filter-handle registry, shared conversion helpers, `createPixiFilterChain()`, and `updateFilterUniforms()`. `PixiPhotoRenderer` stores the current fingerprint/handles and uses an in-place update fast path when the non-halation topology is unchanged; topology changes and any halation path still rebuild. The bake refreshes synchronously after the uniform write and `requestRender()` coalesces to one render per frame — this is the single render path for both an active drag and its release (no separate preview path), so it is what actually fixes the slider-lag. Validated with `vp check`, `vp test`, and `vp build`.

**Goal:** during a slider drag where the enabled-filter set is unchanged, update
uniforms on the existing filter instances instead of destroying + recreating the
whole chain.

Files: `src/shared/lib/pixi/PixiPhotoRenderer.ts`, `src/shared/lib/pixi/filterFactory.ts`

1. Compute an enabled-set **fingerprint** from `PixiFilterValues`: an ordered
   string/array of the filter keys whose effective `enabled` (and presence
   gates like `lut.intensity > 0`, `blur.strength > 0`, `grain.amount > 0`,
   `lightLeak.intensity > 0`) match the conditions in `createPixiFilters`. Also
   include `halation.enabled` because halation switches the entire pipeline shape.
   Put this helper next to `createPixiFilters` so the two stay in lockstep.
2. In `setFilterValues(next)`:
   - If `next` fingerprint **equals** the current one **and** halation is off
     (and was off): call a new `updateFilterUniforms(next)` that writes setters on
     the retained instances, then `requestRender()`. No teardown.
   - Otherwise (topology changed, or halation involved): fall back to the existing
     `applyFilters()` rebuild.
3. Add `updateFilterUniforms(values)` to the renderer. To map a retained instance
   back to its source values, keep a small typed registry while building: e.g.
   `applyFilters()` stores `this.filterHandles: { tone?: AdjustmentFilter; grain?: GrainFilter; ... }`.
   `updateFilterUniforms` then sets only the present handles' properties from
   `values`, mirroring the construction in `createPixiFilters`. Reuse the exact
   same value conversions already in `createPixiFilters` (e.g. `getLightLeakColor`,
   `MotionBlur` odd-kernel rounding, `zoomBlur` center/innerRadius math,
   `spinBlur` pixel-coordinate conversion) — extract them into small pure helpers
   so factory and updater cannot drift.
4. **MirroredBlur special case:** `createMirroredBlurFilters(strength)` returns
   two instances and both expose `set strength`. Store both handles and update
   both. (If `strength` crosses the `> 0` gate, the fingerprint changes → rebuild.)
5. **Non-halation bake:** after uniform update, the display still needs the baked
   `filteredTexture` refreshed. `updateFilteredTexture()` runs synchronously after
   the uniform write, then `requestRender()` coalesces to one GPU render per frame
   (PR 0). A slider drag therefore does at most one bake per frame, not one per
   event, and the **same** bake path runs during the drag and on release — so
   releasing a slider produces no visible re-render.

**Risk:** medium-low. The fingerprint must exactly track `createPixiFilters`'
gating, or a stale instance shows wrong output — mitigate by deriving both from
shared helpers and adding a unit test (below). Halation always rebuilds, so its
correctness is unchanged.

---

### P1 — Interaction mode: ❌ Tried and removed

**Status:** ❌ Implemented in PR 2, then **reverted**. A `setInteracting(active)`
mode showed a cheaper preview during drags (live chain on `displaySprite`, no bake;
halation previewing its flat base chain) and settled via `applyFilters()` on
release, driven by shared Effector events with a debounce + watchdog.

In practice it caused exactly the regression it was meant to avoid: the **preview
path and the settle path were visually different** (preview = filters over the
full-res source texture at the canvas's AA; settle = a resolution-capped, separately
AA'd render-to-texture bake), so releasing any slider produced a visible "jump"/
re-render. Coordinate-dependent filters (`zoomBlur`, `spinBlur`, `lensFlare`)
compounded it, since their centers/radii are computed from full-res image
dimensions while `displaySprite` is downscaled to fit the canvas.

It also turned out to be unnecessary: the **in-place uniform update** above already
removes the only real cost (per-tick shader-program recreation), and PR 0 rAF
coalescing already caps drags/gestures at one render per frame. So the mode was
deleted entirely — `setInteracting`, the `interactionStarted`/`interactionEnded`
events, the `src/shared/model` slice, the editor-workspace bridge/debounce/watchdog,
and the `onInteractStart`/`onInteractEnd` props on `Slider`/`PointPicker`.

**Decision:** during a drag and on release the renderer runs **one identical path**
(in-place uniforms → single capped bake → coalesced render). No preview/settle split,
no halation drop on pan. The `Slider` rAF-throttle and `React.memo` work below were
kept; only the texture/chain-swapping preview mode was removed.

---

### P1 — UI → state coalescing + control memoization

**Status:** ✅ Partially done in PR 2. The slider keeps its `<input>` visually
immediate via local draft state while rAF-throttling the store dispatch to one call
per frame, flushing the exact final value synchronously on pointer/key release (a
private `isDraggingRef` set on `pointerdown`/`keydown` and cleared on `pointerup`/
`pointercancel`/`keyup`/`blur` — no external interaction events; that lifecycle was
removed with interaction mode). `Slider`, `PointPicker`, and `ListControl` are
wrapped in `React.memo`, but `FilterPanelBody` still passes inline callbacks, so
the memoization benefit is limited; full control-level render isolation remains
future work.

**Goal:** stop flooding Effector at 60–120 Hz; reduce control re-renders where
props stay stable. Full isolation of ~50 controls is not yet complete.

Files: `src/shared/ui/Slider.tsx`, `src/shared/ui/PointPicker.tsx`,
`src/features/filter-controls/ui/FilterPanelBody*`, optionally
`src/entities/filter-chain/model.ts`

1. Memoize the leaf controls: wrap `Slider`, `PointPicker`, `ListControl` in
   `React.memo`. Ensure their `onValueChange` handlers are stable
   (`useCallback` keyed by `filterId`/`parameterId`) so memo actually holds.
2. Coalesce the slider's own emission to one per animation frame: keep the
   `<input>` controlled/visually immediate, but rAF-throttle the call to
   `onValueChange` so the store updates at most once per frame during a drag.
   (Keep the final value flushed on `pointerup` so the settle value is exact.)
   Alternatively/additionally coalesce in the model with a `sample` + rAF clock —
   prefer the component-level rAF throttle to keep the model simple and because
   the interaction lifecycle already lives there.
3. Verify `FilterPanelBody` passes per-filter parameter slices (not the whole
   `filterChain`) into each control so a single change re-renders only that
   filter's controls. Split the rendered control list by filter section.

**Risk:** low-medium. Watch for controlled-input lag if throttling is too
aggressive — the input value itself should update every event; only the
*store dispatch* is throttled.

---

### P2 — Adaptive quality profiles (mobile / desktop / export)

**Status:** ✅ Done in PR 3. `src/shared/lib/pixi/qualityProfile.ts` resolves a
`mobile`/`desktop` profile from coarse-pointer + `hardwareConcurrency` and exposes
`previewResolutionScale()`. The renderer caps the baked preview texture's longest
side (mobile 1600, desktop 2560); bakes always use `antialias: true` (the
"AA off during interaction" idea was dropped along with interaction mode, since a
drag and its release now share one bake path and differing AA would re-introduce a
visible jump). The halation Kawase blur drops to quality 3 for the mobile bake.
**Export always re-bakes the full pipeline at `resolution: 1`** inside an
`exporting` guard so a preview-capped texture can never leak into the export — the
quality counterpart to the model-level export guard. Profile/scale logic is unit
tested in `qualityProfile.test.ts`.

**Goal:** cut shader cost on low-end devices for the live preview while keeping
export pristine.

Files: `src/shared/lib/pixi/PixiPhotoRenderer.ts`, `filterFactory.ts`,
`MirroredBlurFilter.ts`, `SpinBlurFilter.ts`, `CrtFilter.ts`, `Halation* / KawaseBlur`

1. Introduce a `QualityProfile = "mobile" | "desktop" | "export"` resolved once
   at init from device signals (coarse pointer + `navigator.hardwareConcurrency`
   + `devicePixelRatio` + renderer backend). Reuse the existing `useIsCompact`
   breakpoint signal where a viewport heuristic suffices.
2. **Preview resolution cap (biggest single GPU win):** cap the *baked preview
   texture* longest side (mobile ~1280–1600px, desktop ~2048–2560px). The
   `displaySprite` is already downscaled for layout, so a capped preview bake is
   visually equivalent on screen. Export bake stays at native `texture.width/height`.
   This touches `bakeToRenderTexture()`/`updateFilteredTexture()` frame sizing —
   add a `previewResolution` factor while `exportImage` forces `resolution: 1`
   at full frame.
3. Per-filter caps under `mobile`/interaction:
   - Halation `KawaseBlurFilter` quality `5 → 2–3`; bake signal at half resolution.
   - `MirroredBlurFilter`: lower `MAX_RADIUS`/sample budget or downsample large radii.
   - `SpinBlurFilter`: lower the 128-sample clamp ceiling for preview.
   - `CrtFilter`: simplify bloom/pixelate sample counts for preview.
   - Disable `antialias` on intermediate bakes during interaction.
4. Keep the **export path on the full-quality profile** unconditionally — this is
   the model-level export guard's quality counterpart; never let a preview-quality
   texture leak into `exportImage`.

**Risk:** medium. Shader changes must stay parameterized (uniform/const swap),
not forked shaders, to avoid maintaining two GLSL/WGSL variants. Validate visual
parity between preview-capped and export output.

---

### P2 — LUT lazy loading + PWA cache

**Status:** ✅ Done in PR 4. `initialize()` no longer awaits the bulk LUT load; the
editor is interactive as soon as the Pixi app is up. `ensureLutLoaded(presetId)`
loads a single preset on demand (deduped via an in-flight set) and, when the
texture resolves for the still-active preset, re-applies filters + schedules a
render so the LUT appears without flicker. The default preset is warmed in the
background after ready. `setFilterValues` triggers the load whenever LUT is enabled
(so a previewed preset is fetched too). Workbox now excludes `**/luts/**` from
precache and serves `/luts/*` via a `CacheFirst` runtime route (`lut-textures`).
Build confirmed: 0 LUT PNGs in the precache manifest, runtime route present.

**Goal:** don't block renderer-ready on ~7 MB of LUT PNGs (15 files, several
600–800 KB each).

Files: `src/shared/lib/pixi/PixiPhotoRenderer.ts`, `lutPresets.ts`, `vite.config.ts`

> Note: `initialize()` currently `await`s `loadLutTextures()` before
> `this.initialized = true`, so the editor canvas is gated on all LUT downloads.

1. Remove the eager `await this.loadLutTextures()` from `initialize()`. Mark ready
   as soon as the Pixi `Application` + first paint are up.
2. Load a single LUT texture on demand: when `lut.enabled && intensity > 0` for a
   preset not yet cached, or when a preset is previewed
   (`lutPreviewPresetChanged`). Cache by preset id in the existing `lutTextures`
   map. When the async texture resolves, **re-apply filters + `requestRender()`**
   so the LUT appears (today `filterFactory.ts:77` just warns and silently drops
   it if the texture is missing — that path must instead trigger a deferred load).
3. Optionally warm the default preset (`warmEditorial`, 52 KB) in the background
   after ready.
4. PWA/Workbox: exclude `/luts/*.png` from precache; serve via a
   `CacheFirst`/`StaleWhileRevalidate` runtime route so first use caches them.

**Risk:** low-medium. The "texture not ready yet" UX must not flicker — keep the
previous output until the new LUT arrives, then swap.

---

### P3 — Barrel-import hygiene + telemetry (cleanup)

Files: editor workspace + features importing from `shared/lib/pixi`

**Status:** ✅ Done. P3.1 barrel hygiene completed in PR 1. P3.2 dev-only
instrumentation added in PR 4 follow-up: `src/shared/lib/pixi/perfLog.ts` provides
`perfLog`/`perfTime`/`perfTimeAsync`, gated on `import.meta.env.DEV` plus a runtime
opt-in (`localStorage["huemoda:perf"] = "1"` or `window.__HUEMODA_PERF__`), so it is
zero-cost and tree-shaken in production. Instrumented: Pixi init, image decode,
image upload + preview dimensions, LUT load, filtered-texture bake, and export.

1. Audit imports of `shared/lib/pixi` in `EditorWorkspace.tsx`, `PixiCanvas.tsx`,
   features, and the workspace model. Anything that only needs **types**
   (`PixiFilterValues`, `PixiRendererBackend`, `ExportMimeType`) should import
   `import type` from the specific module, not the runtime barrel. The single
   place that should pull Pixi runtime is the `lazy()`-loaded `PixiCanvas`
   subtree. Confirm tree-shaking actually keeps Pixi out of the main chunk.
2. Dev-only instrumentation: timing logs (behind a flag) for Pixi init, image
   decode/upload, LUT load, filter bake, export, and the preview texture
   dimensions. Keep zero-cost in production.

**Risk:** low.

---

## Sequencing into PRs

**PR 1 — Render coalescing + barrel hygiene (P0 + P3.1). — ✅ Done**
rAF scheduler (`requestRender`/`renderNow`), route pan/zoom/pinch/resize through
it, cancel on destroy, disable Pixi auto ticker via `autoStart: false`, convert
type-only barrel imports to direct `import type`. Behavior-preserving.
Validated with `vp check`, `vp lint`, `vp test`, and `vp build`.

**PR 2 — In-place uniform updates + UI coalescing (P1). — ✅ Done**
✅ Fingerprint + `updateFilterUniforms` + filter-handle registry integrated for
non-halation same-topology updates (the actual lag fix — no per-tick shader churn).
✅ rAF-throttled slider dispatch with exact flush on release. ⚠️
`React.memo` wrappers exist on `Slider`/`PointPicker`/`ListControl`, but inline
callbacks from `FilterPanelBody` mean full control render isolation was not
completed in this PR.
❌ Interaction mode (`setInteracting` + shared `interactionStarted/Ended` events +
bridge/debounce/watchdog + `onInteract*` props) was built here, then **reverted** —
its preview/settle split caused a visible re-render on slider release. See the
"Interaction mode: tried and removed" section above.

**PR 3 — Quality profiles + preview resolution cap (P2 quality). — ✅ Done**
Profile resolution (`qualityProfile.ts`), preview-bake longest-side cap, halation
Kawase quality cap for mobile. Bakes always use `antialias: true` (no AA toggle —
the per-interaction AA idea died with interaction mode). Export re-bakes full
quality under an `exporting` guard. Unit tests added.

**PR 4 — LUT lazy load + PWA runtime cache (P2 LUT) + P3.2 telemetry. — ✅ Done**
Renderer-ready no longer blocks on LUTs; on-demand `ensureLutLoaded` with
re-render-on-arrival + background warm of the default preset; Workbox `CacheFirst`
runtime cache for `/luts/*` with `**/luts/**` excluded from precache. Dev-only
`perfLog` instrumentation added (zero-cost in production).

---

## Verification

- **Automated:** `vp check` (then `vp check --fix` if formatting), `vp lint`,
  `vp test`, `vp build` after each PR.
- **New unit tests (node Vitest, no real GL — mock filters per CLAUDE.md):**
  - ✅ Enabled-set fingerprint equals/differs correctly across representative
    `PixiFilterValues` (toggle each gate: `enabled`, `lut.intensity`,
    `blur.strength`, `grain.amount`, `lightLeak.intensity`, `halation.enabled`).
  - ✅ Shared conversion helpers are covered for `motionBlur` odd kernel,
    `zoomBlur` center/innerRadius, and `spinBlur` pixel coords.
  - ✅ `updateFilterUniforms` writes converted live values onto mocked retained
    handles for representative filters including blur, motion blur, zoom blur,
    and spin blur.
  - Export guard unchanged: `$canExport` still requires `renderer !== null &&
    loadedImage !== null`; preview-quality profile never reaches `exportImage`.
- **Manual / device:**
  - DevTools mobile emulation + CPU 4–6× throttle: drag the Grain `amount` and
    Blur `strength` sliders; confirm in the Performance panel **one render per
    frame**, no per-event shader-program creation, and **no visible re-render when
    the slider is released** (drag and release share one bake path).
  - Enable halation, drag a halation slider: full rebuild per frame is expected
    (halation is multi-pass and always rebuilds); confirm release does not jump.
  - Pinch-zoom/pan on a touch device or emulation: one render per frame, no
    double-render per pointer event.
  - Cold load: editor canvas becomes interactive before all LUTs download; pick a
    LUT preset → it loads on demand and renders; reload → served from cache.
  - Export a filtered image: output is full native resolution and full quality.
- **Optional:** `/run` to launch the app and `chrome-devtools` MCP
  `performance_start_trace` for before/after frame-time comparison on a
  representative drag.

## Acceptance criteria

- Slider drag and pinch/pan produce **≤ 1 render per animation frame** and
  **no shader-program recreation** when the enabled-filter set is unchanged, and
  **no visible re-render on release** (one identical bake path during drag and on
  settle — no preview/settle split).
- ~50 filter controls no longer all re-render on a single parameter change.
- Editor becomes interactive without downloading all LUTs; presets load and cache
  on demand and render once available.
- Export output remains full native resolution and full-quality filter path; the
  Effector export guard (`renderer && loadedImage`) is intact.
- FSD boundaries and CLAUDE.md rules respected: object-URL lifecycle and export
  guards stay in Effector; halation excluded from base bake; atomic point events;
  no heavy `shared/lib/pixi` barrel import for type-only needs.
- `vp check`, `vp lint`, `vp test`, `vp build` pass.