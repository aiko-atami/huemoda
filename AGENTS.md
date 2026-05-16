# Project Instructions

## Workflow

- Prefer Vite+ commands through `vp` (`vp dev`, `vp build`, `vp check`, `vp test`) and keep `package.json` scripts aligned with them.

## Architecture

- follow Feature-Sliced Design (FSD) v2.1.
- Keep code in the standard layers: `app`, `pages`, `widgets`, `features`, `entities`, and `shared`.
- Respect the FSD import direction: a layer may import only from layers below it.
- Keep slices isolated. Import other slices through their public `index.ts` API, not through internal files.
- Use the FSD "Pages First" approach: keep page-specific logic in `pages`/`widgets` until reuse justifies extracting it to `features`, `entities`, or `shared`.

## UI And Styling

- `DESIGN.md` is the design source of truth. Read it before changing visual language, layout density, colors, typography, spacing, or component treatment.
- Use Base UI (`@base-ui/react`) primitives for accessible interactive components when adding or replacing headless UI behavior.
- Use Panda CSS for authored styling when styling infrastructure is added or migrated. Prefer generated `styled-system` helpers (`css`, `cva`, recipes, patterns, `styled`) over ad hoc class generation.
- Keep UI utilitarian and editor-focused: dense controls, stable dimensions, restrained panels, and content-first canvas behavior.

## State And Rendering

- Use Effector.js for application state and business dataflow; prefer `sample`, `attach`, and explicit events/stores over imperative state reads in UI.
- Use `effector-react` `useUnit` for React bindings.
- Pixi.js owns image/canvas rendering. Keep rendering-specific code in `shared/lib/pixi` unless a higher FSD layer needs orchestration.

# Using Vite+, the Unified Toolchain for the Web

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `pnpm install` after pulling remote changes and before getting started.
- [ ] Run `pnpm lint` and `pnpm test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `pnpm run <script>`.
