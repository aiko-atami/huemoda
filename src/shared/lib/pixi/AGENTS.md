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

