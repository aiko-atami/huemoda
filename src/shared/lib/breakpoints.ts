/**
 * Breakpoint values shared across CSS media queries, the Panda config, and the
 * `useBreakpoint` hook. Keep these aligned with the `@media` queries authored in
 * `src/app/styles/index.css` so layout decisions have a single source of truth.
 *
 * IMPORTANT: `panda.config.ts` imports this module and runs it under Node at
 * build time. Keep this file a pure constant module — no React, DOM, or other
 * browser-only imports — or the Panda codegen will break.
 */
export const BREAKPOINTS = {
  /** Mobile — compact action rows, full-bleed pickers. */
  sm: 560,
  /** Tablet portrait / large phone — side panel stacks below the canvas. */
  md: 900,
  /** Smaller desktop — side panel narrows. */
  lg: 1180,
} as const;

export type BreakpointName = keyof typeof BREAKPOINTS;

/**
 * Viewport at or below this width uses the "compact" layout: the filter panel
 * becomes a bottom sheet instead of a docked side column. Matches the `900px`
 * media query that stacks the editor shell.
 */
export const COMPACT_MAX_WIDTH = BREAKPOINTS.md;
