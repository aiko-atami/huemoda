import { useSyncExternalStore } from "react";
import { COMPACT_MAX_WIDTH } from "./breakpoints";

const COMPACT_QUERY = `(max-width: ${COMPACT_MAX_WIDTH}px)`;

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }

  const mql = window.matchMedia(COMPACT_QUERY);

  mql.addEventListener("change", onChange);

  return () => mql.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia(COMPACT_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Returns `true` when the viewport is at or below the compact breakpoint
 * ({@link COMPACT_MAX_WIDTH}). Drives layout decisions that need a different
 * component tree — e.g. docked side panel vs. bottom-sheet filter controls.
 *
 * Pure layout restructuring should prefer CSS media queries; reach for this hook
 * only when the rendered markup must differ between desktop and compact.
 */
export function useIsCompact(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
