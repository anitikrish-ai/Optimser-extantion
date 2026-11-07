/**
 * Truthful metric representation.
 *
 * measured     - read directly from a browser API.
 * estimated    - computed from a documented method (the method string is mandatory).
 * unavailable  - the browser does not expose enough information.
 *
 * Nothing in the codebase may produce a number outside this type for display.
 */
import type { Level } from './types';

export type Measurement<T> =
  | { state: 'measured'; value: T; note?: string }
  | { state: 'estimated'; value: T; method: string }
  | { state: 'unavailable'; reason: string };

export const measured = <T>(value: T, note?: string): Measurement<T> =>
  note ? { state: 'measured', value, note } : { state: 'measured', value };

export const estimated = <T>(value: T, method: string): Measurement<T> => {
  if (!method || !method.trim()) {
    throw new Error('An estimated value must document its estimation method.');
  }
  return { state: 'estimated', value, method };
};

export const unavailable = <T = number>(reason: string): Measurement<T> => ({ state: 'unavailable', reason });

export function isMeasuredNumber(
  m: Measurement<number> | undefined
): m is { state: 'measured'; value: number; note?: string } {
  return !!m && m.state === 'measured' && Number.isFinite(m.value);
}

/** Counters of changes the extension itself made on the page. These are actions, not results. */
export interface ActionCounts {
  imagesLazy: number;
  imagesAsyncDecode: number;
  videosAutoplayPaused: number;
  videosOffscreenPaused: number;
  videosBackgroundPaused: number;
  animationsPausedOffscreen: number;
  sectionsDeferred: number;
  effectsReduced: boolean;
}

export const emptyActionCounts = (): ActionCounts => ({
  imagesLazy: 0,
  imagesAsyncDecode: 0,
  videosAutoplayPaused: 0,
  videosOffscreenPaused: 0,
  videosBackgroundPaused: 0,
  animationsPausedOffscreen: 0,
  sectionsDeferred: 0,
  effectsReduced: false
});

export interface PageSample {
  /** Date.now() when the sample was taken. */
  takenAtEpochMs: number;
  /** performance.timeOrigin of the sampled document (epoch ms), used to scope rule matches. */
  timeOriginEpochMs: number;
  optimizerActive: boolean;
  level: Level | null;
  ttfbMs: Measurement<number>;
  domContentLoadedMs: Measurement<number>;
  loadMs: Measurement<number>;
  fcpMs: Measurement<number>;
  lcpMs: Measurement<number>;
  requestCount: Measurement<number>;
  /** Sum of transferSize for resources whose size the browser exposes. A lower bound. */
  transferredBytes: Measurement<number>;
  /** Resources whose sizes are hidden (cross-origin without Timing-Allow-Origin). */
  sizeHiddenResources: Measurement<number>;
  domNodes: Measurement<number>;
  longTaskCount: Measurement<number>;
  longTaskTotalMs: Measurement<number>;
  jsHeapUsedMB: Measurement<number>;
  /** Main-thread time spent inside this extension's own callbacks on this page. */
  selfTimeMs: Measurement<number>;
  selfLimited: boolean;
  actions: ActionCounts;
}
