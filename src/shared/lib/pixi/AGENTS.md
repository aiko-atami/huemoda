# AGENTS.md instructions for /home/xs/aiko/huemoda

<INSTRUCTIONS>
- Use Conventional Commits.
- JS/TS: Use `pnpx` by default.
- Python: Use `uv`.
- GH actions: Use `checkout@v6`, `cache@v5`, `jdx/mise-action@v4`
- Use `mise` instead make for tasks
- Use `mise` for tool managment

--- project-doc ---

# Project Instructions

## Workflow

- Prefer Vite+ commands through `vp` (`vp dev`, `vp build`, `vp check`, `vp test`) and keep `package.json` scripts aligned with them.

## Architecture

- follow Feature-Sliced Design (FSD) v2.1.
- Keep code in the standard layers: `app`, `pages`, `widgets`, `features`, `entities`, and `shared`.
- Respect the FSD import direction: a layer may import only from layers below it.
- Keep slices isolated. Import other slices through their public `index.ts` API, not through internal files.
- Use the FSD "Pages First" approach: keep page-specific logic in `pages`/`widgets` until reuse justifies extracting it to `features`, `entities`, or `shared`.

### FSD Boundaries

- Respect Feature-Sliced Design import direction.
- Cross-slice imports should go through public `index.ts` APIs unless there is a deliberate direct import from `shared`.
- Do not import from a higher layer:
  - `shared` must not import from `entities`, `features`, `widgets`, or `pages`.
  - `entities` must not import from `features`, `widgets`, or `pages`.
  - `widgets` should not depend on feature internals.
- If a helper is needed by a widget model and a feature, move it to `shared/lib` instead of importing from the feature.

## UI And Styling

- `DESIGN.md` is the design source of truth. Read it before changing visual language, layout density, colors, typography, spacing, or component treatment.
- Use Base UI (`@base-ui/react`) primitives and skill for accessible interactive components when adding or replacing headless UI behavior.
- Use Panda CSS (+skill) for authored styling when styling infrastructure is added or migrated. Prefer generated `styled-system` helpers (`css`, `cva`, recipes, patterns, `styled`) over ad hoc class generation.
- Keep UI utilitarian and editor-focused: dense controls, stable dimensions, restrained panels, and content-first canvas behavior.

## State And Rendering

- Use Effector.js (+skill) for application state and business dataflow; prefer `sample`, `attach`, and explicit events/stores over imperative state reads in UI.
- Use `effector-react` `useUnit` for React bindings.
- Pixi.js owns image/canvas rendering. Keep rendering-specific code in `shared/lib/pixi` unless a higher FSD layer needs orchestration.

## Review Checklist

- [ ] Run `vp check`, `vp test`, and `vp build` after source changes. If `vp check` reports formatting issues, run `vp check --fix`, then rerun `vp check`.
- [ ] Run `vp lint` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation.

## Do-Not-Break Rules

- Do not import from the heavy `shared/lib/pixi` barrel unless Pixi runtime is intentionally needed.
- Do not instantiate real Pixi GL/WebGPU filters/classes in default node Vitest tests without mocks.
- Do not include halation in the base bake; use `createPixiFilters(values, context, { excludeHalation: true })`.
- Do not bypass Effector for object URL lifecycle or export guards.
- Do not fire two separate events for point X/Y updates; use an atomic point event such as `filterPointChanged`.
- 
## Gotchas For Future Agents

### Pixi Imports And Bundle Size

- Avoid importing from `src/shared/lib/pixi/index.ts` unless Pixi runtime is actually required.
  - That barrel exports `PixiPhotoRenderer` and filter classes, which can pull `pixi.js` into the importing chunk.
- For lightweight data/types, import directly from focused modules:
  - `shared/lib/pixi/filterTypes`
  - `shared/lib/pixi/lutPresets`
  - `shared/lib/pixi/lutLayout`
  - `shared/lib/pixi/cubeLut`
  - `shared/lib/pixi/exportTypes`
- Entity/model code must not import Pixi runtime values from the heavy Pixi barrel.
- LUT converter code should import cube/LUT helpers directly from `shared/lib/pixi/cubeLut` and `shared/lib/pixi/lutLayout`.

### Pixi Tests

- If testing filter factory wiring, prefer smoke tests that assert mapped options/uniform values without requiring a real renderer.
- Do not instantiate real Pixi GL/WebGPU objects in default Vitest node tests.
  - Pixi may access `document` through browser adapters.
  - Unit tests for filter factories/classes should mock `pixi.js` and `pixi-filters`, or explicitly use a DOM-capable test environment.

### Effector Model Boundaries

- Side effects belong in Effector effects, not React components.
  - Object URL creation should go through `createLoadedImageFx`.
  - Object URL release should go through `releaseImageFx`.
- File upload flow should be `imageFileAccepted` → `createLoadedImageFx` → `imageSelected`.
- Workspace unmount should be represented as a model event, e.g. `workspaceUnmounted`, and cleanup should be wired with `sample`.
- Do not use React-only cleanup helpers for business/resource lifecycle if an Effector event can represent the lifecycle.
- Export must be guarded in the model, not only by disabled UI.
  - Export requires both `renderer !== null` and `loadedImage !== null`.
  - Keep a model-level `$canExport` guard or equivalent `sample({ filter })`.

### Filter Chain Model

- Point controls must update atomically.
  - Use `filterPointChanged` for point controls.
  - Do not fire two sequential `filterParameterChanged` events for X/Y.
- Keep UI-friendly values converted in `toPixiFilterValues()`.
  - Example: percentages from controls should be converted to `0..1` ratios there, not inside shaders or UI components.
- Add tests when adding a new filter:
  - defaults in `createInitialFilterState()`
  - mapping in `toPixiFilterValues()`
  - any special factory/render-pipeline behavior

</INSTRUCTIONS>
