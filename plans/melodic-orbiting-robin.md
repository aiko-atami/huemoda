# HueModa — Adaptive desktop/mobile layout + touch gestures + PWA shell

## Context

HueModa is a browser-based photo editor (FSD + Effector + Pixi.js + Panda CSS + Base UI). Today it is a render-only web app: a fixed desktop-oriented CSS-grid layout, single-pointer pan + wheel zoom on the canvas, no offline support, and no persistence.

The user wants to take it toward **local-first / installable PWA** with **mobile-first equal-priority** support, without the budget for a native app. Three product decisions were confirmed:

1. **Layout strategy — one adaptive layout.** A single `EditorWorkspace` composition that restructures by breakpoint: the filter panel is a docked side panel on desktop and a bottom sheet / drawer on mobile. No duplicated desktop/mobile widgets.
2. **Local-first scope — PWA shell only (this phase).** Installable, launches offline; the app shell + assets are cached by a service worker. Image and filter state stay in memory (lost on reload) for now. Session/project persistence is explicitly **out of scope** but the architecture should not preclude it later.
3. **Primary target — mobile-first / equal priority.** Touch gestures (pinch-zoom, two-finger pan) on the canvas land in this phase, not deferred.

Intended outcome: HueModa works and feels native on a phone, installs as a PWA, and continues to work well on desktop — all from one codebase and one layout.

---

## Top-level architecture

Keep the FSD layering intact. The work splits into four concerns, each landing in its natural layer:

| Concern | Layer | What lands there |
|---|---|---|
| Responsive primitives (breakpoints, `useBreakpoint`) | `shared` | Panda breakpoints config + a small viewport hook |
| Adaptive shell (side panel ↔ bottom sheet) | `widgets/editor-workspace` | layout swap driven by breakpoint |
| Touch gestures (pinch/two-finger pan) | `shared/lib/pixi` + `widgets` | new renderer `zoomAt` primitive + multi-pointer handling in `PixiCanvas` |
| PWA shell (manifest, service worker, install) | `app` + build config | `vite-plugin-pwa`, manifest, icons |

Guiding principle: the **canvas + features (upload/export/filter-controls) are platform-agnostic and shared**; only the *shell that arranges them* changes shape by breakpoint.

---

## 1. Responsive primitives (`shared`)

The current responsive logic is entirely raw `@media` queries in `src/app/styles/index.css`, and `panda.config.ts` defines **no breakpoints** (`tokens: {}`). To make Panda conditions (`md:`, `lg:`) usable and to drive the JS layout swap from one source of truth:

- **`panda.config.ts`** — add a `breakpoints` block aligned with the existing CSS breakpoints already in use (`560px`, `900px`, `1180px`). Map them to named tokens, e.g. `sm: 560px`, `md: 900px`, `lg: 1180px`. Re-run Panda codegen (happens via `vp` build/check) so `styled-system` exposes the conditions.
- **`src/shared/lib/useBreakpoint.ts`** (new) — a `matchMedia`-based hook returning the active breakpoint / a boolean like `isCompact` (viewport ≤ the panel-stacks-to-bottom breakpoint, currently `900px`). Use `window.matchMedia(...).addEventListener("change", ...)` with `useSyncExternalStore` for tear-free reads and SSR safety. Export via `src/shared/lib`'s public API.
  - Single source of truth: derive the media query string from the same breakpoint value used in Panda config (define the px constants in `shared/lib` and reference them, so CSS/Panda/JS agree).

> Note: layout-only restructuring should prefer CSS (`@media` / Panda conditions). `useBreakpoint` is for cases that genuinely need a *different component tree* (side panel vs. Base UI sheet) — see §2.

---

## 2. Adaptive shell — side panel ↔ bottom sheet (`widgets/editor-workspace`)

`EditorWorkspace.tsx` currently always renders `<FilterPanel />` as the right-hand `.editor-shell` grid column; `@media (max-width: 900px)` already restacks it *below* the canvas. The mobile-first improvement is to turn that stacked panel into a **bottom sheet / drawer** for ergonomics, while desktop keeps the docked side panel.

Approach:

- In `EditorWorkspace.tsx`, read `isCompact` from `useBreakpoint()`.
  - **Desktop (`!isCompact`):** render `<FilterPanel />` docked exactly as today (the `.editor-shell` grid column).
  - **Compact (`isCompact`):** render the canvas full-bleed, plus a **bottom sheet** containing the same `<FilterPanel />` content, opened by a floating "Filters" button. Use **Base UI** for the sheet — reuse the `Dialog` primitive already imported in `FilterPanel.tsx` (or `Popover`) styled as a bottom sheet, consistent with the existing `filter-picker` dialog pattern. This satisfies the project rule to use Base UI for headless interactive behavior.
- **Keep `FilterPanel` itself layout-agnostic.** Extract its inner content (header + filter list + footer + the add-filter `Dialog`) so the same component renders both inside the docked `aside.filter-panel` and inside the bottom sheet body. The cleanest move: `FilterPanel` keeps its current docked markup; introduce a thin `FilterPanelBody` (or pass a `presentation="docked" | "sheet"` prop) so there is **one controls implementation**, two containers. Avoid duplicating the filter-rendering logic.
- The editor topbar actions (Upload / Clear / Export) should remain reachable in compact mode — verify they don't get crowded; move to a compact action row if needed (CSS already has `@media (max-width: 560px)` rules to build on).

Files:
- `src/widgets/editor-workspace/ui/EditorWorkspace.tsx` — breakpoint-driven shell.
- `src/features/filter-controls/ui/FilterPanel.tsx` — split body from container.
- `src/app/styles/index.css` — bottom-sheet styles + compact tweaks (or migrate the relevant bits to Panda `css()` with the new breakpoint conditions; keep consistent with current global-CSS approach for layout).

---

## 3. Touch gestures on the canvas (`shared/lib/pixi` + `widgets`)

`PixiCanvas.tsx` handles a single pointer (pan) + non-passive `wheel` (zoom). `PixiPhotoRenderer` exposes `pan(dx,dy)`, `wheelZoom(deltaY,cx,cy)`, `resetView()`. There is **no multi-touch and no continuous zoom primitive** — `wheelZoom` hardcodes a `1.1` factor per tick, unsuitable for pinch.

Plan:

- **`PixiPhotoRenderer.ts`** — add `zoomAt(factor: number, cx: number, cy: number)` that applies an arbitrary continuous scale factor around a focal point (the existing `wheelZoom` math at lines 119–137, minus the fixed `1.1`). Refactor `wheelZoom` to compute its factor then delegate to `zoomAt`, so wheel and pinch share one clamped (`0.5..10`) implementation. Keep `clampViewport()` + `render()` behavior.
- **`PixiCanvas.tsx`** — track active pointers in a `Map<pointerId, {x,y}>` (pointer events already cover touch):
  - **1 pointer:** pan (current behavior).
  - **2 pointers:** compute the distance + midpoint each move; pan by midpoint delta and call `renderer.zoomAt(newDist/oldDist, midX, midY)`. Suppress single-pointer pan while two are down.
  - Double-tap → `resetView()` (mirror current double-click).
  - The host already has `touch-action: none` concerns — ensure the canvas host sets `touch-action: none` (via style/CSS) so the browser doesn't hijack pinch/scroll. Keep the existing non-passive `wheel` listener for desktop/trackpad.
- No Effector changes — viewport state lives in the renderer, consistent with "Pixi owns canvas rendering."

Files:
- `src/shared/lib/pixi/PixiPhotoRenderer.ts`
- `src/widgets/editor-workspace/ui/PixiCanvas.tsx`

---

## 4. PWA shell (`app` + build config)

No manifest, service worker, or PWA plugin exists today. Build is Vite via **vite-plus** (`defineConfig` from `"vite-plus"`); the `plugins` array is at the bottom of `vite.config.ts`. (This section incorporates the detailed PWA plan in `plans/vite-pwa-1.3-integration.md`, with corrections.)

### 4.0 Compatibility check — do this FIRST (de-risk)

`package.json` aliases `"vite"` to `npm:@voidzero-dev/vite-plus-core@^0.1.22` (a vite-plus core, **not** stock Vite), while `vite-plugin-pwa@1.3.0` declares peer `vite: ^3..^8` plus `workbox-build`/`workbox-window ^7.4.1`. vite-plus is designed to be Vite-plugin compatible, so this should work — but the peer range won't literally match `0.1.x`. **Before building anything else, install the plugin and run `vp build` to confirm the SW + manifest emit without peer/runtime errors.** If it fails, fall back to invoking the SW build via Workbox directly or pin a compatible plugin version. Treat this as the gating step.

### 4.1 Install

- `vp install -D vite-plugin-pwa@^1.3.0` (latest is `1.3.0`; `-D` saves to devDependencies). **Note:** the command is `vp install`, not `vp add`. Project uses `pnpm@11`, so peer warnings may surface here — see §4.0.

### 4.2 vite.config.ts

- `import { VitePWA } from "vite-plugin-pwa";` and add `VitePWA({...})` to the `plugins` array **after** `react()` / `babel(...)`.
- Config:
  - `registerType: "autoUpdate"`, `injectRegister: "auto"` (plugin auto-injects SW registration).
  - `includeAssets: ["favicon.svg", "pwa-192x192.png", "pwa-512x512.png", "apple-touch-icon.png"]`.
  - Workbox `globPatterns` to precache the app shell (HTML / JS / CSS chunks / fonts / icons). **Runtime caching minimal:** image data is user-supplied object URLs (never fetched), so precache + navigation fallback is enough for "launches offline." Do **not** cache blob/object URLs; no external/CDN caching.
  - `manifest`: `name: "HueModa"`, `short_name`, `description`, `display: "standalone"`, `start_url: "/"`, `scope: "/"`, `theme_color` / `background_color` = `#0f0c1b` (matches `--background` / DESIGN.md surface), flexible `orientation`, icons (see §4.3).

### 4.3 Icons (real blocker — only `favicon.svg` exists today)

- Add to `public/`: `pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png`, and `maskable-icon-512x512.png` (maskable for Android adaptive icons).
- Generate from the existing `favicon.svg` via `@vite-pwa/assets-generator`, or supply PNGs by hand. This is a required asset step, not optional.

### 4.4 index.html

- `viewport` meta already present and correct. Add only safe meta tags: `theme-color`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-title` for iOS install fidelity.
- **Do not** add a manual `<link rel="manifest">` — VitePWA injects it.

### 4.5 Architecture fit / non-goals

- PWA bootstrap stays in `app` + Vite config — SW registration is app infrastructure, **not** a feature/business concern.
- Generated SW only (no custom service worker) this phase.
- **Effector untouched:** no persistence this phase → no `serialize`/`hydrate`. SW must not touch image runtime lifecycle — object-URL lifecycle stays in `createLoadedImageFx`/`releaseImageFx`, export guard `$canExport` unchanged.
- Future local-first persistence (deferred) slots in cleanly as `entities/project|draft` + `shared/lib/storage` (IndexedDB/OPFS adapters) + Effector save/load/delete effects — not via SW cache.

Files:
- `vite.config.ts`
- `index.html`
- `public/` (icons)
- `package.json` (devDependency)

---

## Out of scope (explicitly deferred)

- Session/project persistence (IndexedDB/OPFS, filter-chain serialize/hydrate, last-image restore). Architecture above doesn't block adding it later as an `entities`/`shared/lib/persistence` concern.
- Separate desktop/mobile widget trees (rejected in favor of one adaptive layout).
- SW update-prompt UX, install-prompt button.

---

## Verification

1. `vp check` (run `vp check --fix` first if it flags formatting), `vp test`, `vp build` — per the project Review Checklist. Re-run Panda codegen via the build so new breakpoint conditions exist.
2. **Adaptive layout:** run `vp dev`; resize the window across 1180 / 900 / 560px. Confirm desktop shows the docked side panel; compact width shows full-bleed canvas + bottom-sheet filters opened via the Filters button. Confirm topbar actions remain reachable.
3. **Touch gestures:** use browser devtools device emulation (or a real phone on the dev server). Verify: one-finger pan, two-finger pinch-zoom around focal point, two-finger pan, double-tap reset. Verify desktop wheel-zoom + drag-pan still work unchanged.
4. **PWA:**
   - First run the §4.0 compatibility gate: `vp install -D vite-plugin-pwa@^1.3.0` then `vp build` — confirm a web manifest + service worker emit and assets land in precache, with no peer/runtime errors from the vite-plus alias.
   - `vp build` + `vp preview`; in Chrome DevTools → Application: manifest valid, service worker registered, installable (install prompt). Toggle Offline and reload — app shell loads (editor may open empty; that's expected this phase).
   - Confirm upload + export still work as before, and auto-update pulls a new SW on rebuild.
   - Lighthouse PWA audit passes installability.
5. Sanity: existing `widgets/editor-workspace/model.test.ts`, `entities/*` tests still green; no regression to export guard (`$canExport`) or object-URL cleanup on unmount.
