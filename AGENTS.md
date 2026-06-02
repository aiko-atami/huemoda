## Workflow

- Prefer Vite+ commands through `vp` (`vp dev`, `vp build`, `vp check`, `vp test`) and keep `package.json` scripts aligned with them.

## Architecture

- follow Feature-Sliced Design (FSD) v2.1.
- Keep code in the standard layers: `app`, `pages`, `widgets`, `features`, `entities`, and `shared`.
- Respect the FSD import direction: a layer may import only from layers below it.
  - `shared` must not import from `entities`, `features`, `widgets`, or `pages`.
  - `entities` must not import from `features`, `widgets`, or `pages`.
  - `widgets` should not depend on feature internals.
- Keep slices isolated. Import other slices through their public `index.ts` API, not through internal files.
- Use the FSD "Pages First" approach: keep page-specific logic in `pages`/`widgets` until reuse justifies extracting it to `features`, `entities`, or `shared`.
- If a helper is needed by a widget model and a feature, move it to `shared/lib` instead of importing from the feature.
- Cross-slice imports should go through public `index.ts` APIs unless there is a deliberate direct import from `shared`.

## UI And Styling

- `DESIGN.md` is the design source of truth. Read it before changing visual language, layout density, colors, typography, spacing, or component treatment.
- Use Base UI (`@base-ui/react`) primitives and skill for accessible interactive components when adding or replacing headless UI behavior.
- Use Panda CSS (and skill) for authored styling when styling infrastructure is added or migrated. Prefer generated `styled-system` helpers (`css`, `cva`, recipes, patterns, `styled`) over ad hoc class generation.
- Keep UI utilitarian and editor-focused: dense controls, stable dimensions, restrained panels, and content-first canvas behavior.

## State And Rendering

- Use Effector.js (and skill) for application state and business dataflow; prefer `sample`, `attach`, and explicit events/stores over imperative state reads in UI.
- Use `effector-react` `useUnit` for React bindings.
- Pixi.js owns image/canvas rendering. Keep rendering-specific code in `shared/lib/pixi` unless a higher FSD layer needs orchestration.

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
