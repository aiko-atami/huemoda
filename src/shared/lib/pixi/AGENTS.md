# Pixi Rendering Layer

This directory owns image/canvas rendering: the `PixiPhotoRenderer`, the filter
factory, and every custom filter class. Read this before adding or changing a filter.

> This file is surfaced to AI assistants via sibling `CLAUDE.md` / `GEMINI.md`
> symlinks (mirroring the repo-root convention). Edit `AGENTS.md`, not the links.

## Filter Chain Model

- Update point controls atomically: use `filterPointChanged` for point parameters.
  Never fire two sequential `filterParameterChanged` events for X/Y.
- Convert UI-friendly values to Pixi-native units in `toPixiFilterValues()`
  (`src/entities/filter-chain/model.ts`) — e.g. percent → `0..1` ratio. Conversions
  belong there, never in shaders or UI components.
- `createPixiFilterChain()`, `getFilterFingerprint()`, and `updateFilterUniforms()`
  in `filterFactory.ts` must stay in lockstep — they share the pure conversion
  helpers (`motionBlurKernelSize`, `zoomBlurCenter`, `spinBlurPosition`) so the
  build path and the in-place update path cannot drift.

## Pixi Imports And Bundle Size

- Do not import from `src/shared/lib/pixi/index.ts` unless Pixi runtime is actually
  required — that barrel exports `PixiPhotoRenderer` and filter classes, which pull
  `pixi.js` into the importing chunk.
- For lightweight data/types, import directly from the focused module:
  `filterTypes`, `lutPresets`, `lutLayout`, `cubeLut`, `exportTypes`.
- Entity/model code must not import Pixi runtime values from the heavy barrel.
- LUT converter code imports cube/LUT helpers directly from `cubeLut` and `lutLayout`.

## Pixi Tests

- Mock `pixi.js` and `pixi-filters`; do not instantiate real GL/WebGPU objects in
  default node Vitest tests (Pixi reaches `document` via browser adapters). Use a
  DOM-capable environment only when unavoidable.
- For factory wiring, prefer smoke tests that assert mapped options/uniform values
  without a real renderer (see `filterFactory.test.ts`).

---

## Adding a flat filter (the common case)

A "flat" filter is a single `Filter` instance appended to the
`sourceSprite.filters` chain — i.e. almost every filter. The UI renders from
declarative definitions, so **no UI component edits are needed**. Touch these in order:

1. **Definition / UI metadata** — `src/entities/filter-chain/model.ts`
   - add the id to `FILTER_IDS`
   - add a `FilterDefinition` to `FILTER_DEFINITIONS`; declare each parameter as
     `range` / `select` / `point` with `min`/`max`/`step`/`defaultValue`/`unit`.
2. **Pixi value shape** — `src/shared/lib/pixi/filterTypes.ts`
   - add the slice to `PixiFilterValues`
   - add its defaults to `createEmptyPixiFilterValues()` in **Pixi-native units**.
3. **UI → Pixi mapping** — `toPixiFilterValues()` in `filter-chain/model.ts`
   - map each parameter via `getNumericParameter` / `getStringParameter`, applying
     unit conversion here (e.g. `% / 100`, `0..100 → 0..1` UV).
4. **Filter construction + fast path** — `src/shared/lib/pixi/filterFactory.ts`
   (keep all four in sync):
   - `createPixiFilterChain()` — build the instance under its enabled gate, assign
     it to `handles`, push it to `filters`. Reuse or add a pure conversion helper so
     build and update can't diverge.
   - `PixiFilterHandles` — add the handle key.
   - `getFilterFingerprint()` — add the enabled gate (plus any value that changes
     topology, e.g. a preset id) so toggling/preset-switch forces a rebuild.
   - `updateFilterUniforms()` — write every live parameter back onto the handle.
5. **Tests**
   - `filter-chain/model.test.ts` — defaults + `toPixiFilterValues` mapping
     (including unit conversion).
   - `filterFactory.test.ts` — enabled gate creates the filter, fingerprint
     includes it, `updateFilterUniforms` writes all properties (use a strict stub).

### Files touched, in order

| File | Change |
| --- | --- |
| `entities/filter-chain/model.ts` | `FILTER_IDS` + `FILTER_DEFINITIONS` entry |
| `shared/lib/pixi/filterTypes.ts` | `PixiFilterValues` slice + empty defaults |
| `entities/filter-chain/model.ts` | `toPixiFilterValues()` mapping (unit conversion) |
| `shared/lib/pixi/filterFactory.ts` | build + `PixiFilterHandles` + fingerprint + update |
| `entities/filter-chain/model.test.ts` | defaults + mapping tests |
| `shared/lib/pixi/filterFactory.test.ts` | create + fingerprint + update tests |

> **Trap — silent live-drag degradation.** If you forget the
> `getFilterFingerprint` gate or a setter in `updateFilterUniforms`, there is no
> error: the slider just shows a stale frame mid-drag (the in-place fast path runs
> with missing/wrong uniforms), and `applyFilters()` only corrects it on release.
> The strict-stub test in `filterFactory.test.ts` is what catches a misnamed setter.

---

## Adding a multi-pass filter (rare)

A "multi-pass" filter bakes its own multi-stage render-to-texture pipeline instead
of a flat chain (today: **halation** — extract → blur → screen-composite). It has
no single retained instance, so it cannot use the in-place uniform fast path.
Beyond the flat-filter steps above:

1. **Register the key** in `MULTI_PASS_FILTER_KEYS` (`filterFactory.ts`). This makes
   `requiresFullRebuild()` skip the in-place fast path automatically — without this,
   the renderer would silently render a stale frame during a drag.
2. **Add a dedicated bake branch** in `PixiPhotoRenderer.applyFilters()` next to the
   halation branch: build → bake each stage to a `RenderTexture` → set
   `displaySprite.texture` / `filteredTexture`. Track and destroy intermediate
   textures the way `halationBaseTexture` / `halationSignalTexture` are handled.
3. **Do not** add a `PixiFilterHandles` key or an `updateFilterUniforms` entry —
   multi-pass filters never take the fast path.
4. **Keep it out of the flat chain / base bake.** `createPixiFilterChain()` builds
   no entry for a multi-pass filter — its values are consumed only by its bake
   branch in `applyFilters()`. Follow that pattern: never push a multi-pass filter
   into the `filters` array.
5. **Tests** — assert `requiresFullRebuild` is `true` when the new key is enabled.
