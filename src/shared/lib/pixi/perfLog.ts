/**
 * Dev-only performance instrumentation for the Pixi rendering layer.
 *
 * Zero-cost in production: every entry point short-circuits on `isPerfLogEnabled`,
 * which is `false` unless the build is a dev build AND the flag is opted in. Opt
 * in from the browser console with `localStorage.setItem("huemoda:perf", "1")`
 * (or `window.__HUEMODA_PERF__ = true`) and reload. Production bundles tree-shake
 * the `import.meta.env.DEV` branch away.
 */

const isDev = typeof import.meta !== "undefined" && import.meta.env?.DEV === true;

function readOptIn(): boolean {
  if (!isDev || typeof window === "undefined") {
    return false;
  }

  if ((window as { __HUEMODA_PERF__?: boolean }).__HUEMODA_PERF__ === true) {
    return true;
  }

  try {
    return window.localStorage?.getItem("huemoda:perf") === "1";
  } catch {
    return false;
  }
}

export const isPerfLogEnabled = readOptIn();

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/** Log a single labelled metric (e.g. a dimension or count). No-op unless enabled. */
export function perfLog(label: string, detail?: Record<string, unknown>): void {
  if (!isPerfLogEnabled) {
    return;
  }

  console.debug(`[huemoda:perf] ${label}`, detail ?? "");
}

/**
 * Time a synchronous block and log its duration. Returns the block's result.
 * No measurement overhead when disabled (the callback still runs).
 */
export function perfTime<T>(label: string, fn: () => T): T {
  if (!isPerfLogEnabled) {
    return fn();
  }

  const start = now();

  try {
    return fn();
  } finally {
    console.debug(`[huemoda:perf] ${label} ${(now() - start).toFixed(1)}ms`);
  }
}

/** Async counterpart to {@link perfTime}. */
export async function perfTimeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!isPerfLogEnabled) {
    return fn();
  }

  const start = now();

  try {
    return await fn();
  } finally {
    console.debug(`[huemoda:perf] ${label} ${(now() - start).toFixed(1)}ms`);
  }
}
