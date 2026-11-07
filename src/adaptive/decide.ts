/**
 * Adaptive engine: pure decision logic.
 *
 * Input: signals that the browser actually exposes. A signal that is not exposed is `null`
 * and contributes zero points. Nothing is guessed or defaulted.
 *
 * Output: a Level plus the list of contributions, so the decision is explainable.
 *
 * IMPORTANT: the thresholds below are HEURISTICS. They are not derived from benchmarks of this
 * extension. They are named constants so they can be reviewed and tuned in one place.
 */
import type { Level } from '../shared/types';

export interface Signals {
  /** navigator.hardwareConcurrency (logical cores). May be clamped by browser privacy settings. */
  cores: number | null;
  /** navigator.deviceMemory in GiB. Chromium only; bucketed and capped at 8 by the browser. */
  memoryGB: number | null;
  /** navigator.connection.effectiveType. Chromium only. */
  effectiveType: string | null;
  /** navigator.connection.saveData. Chromium only. */
  saveData: boolean | null;
  /** Element count of the document, measured after load. */
  domNodes: number | null;
  /** Resource Timing entry count, measured after load. */
  resourceCount: number | null;
  /** Sum of Long Task durations (ms). Chromium only. */
  longTaskMs: number | null;
}

export const EMPTY_SIGNALS: Signals = {
  cores: null,
  memoryGB: null,
  effectiveType: null,
  saveData: null,
  domNodes: null,
  resourceCount: null,
  longTaskMs: null
};

/**
 * Rationale for each threshold:
 *
 * cores <= 2 / <= 4: Entry-level and older devices commonly expose 2-4 logical cores. A page's main
 *   thread is single-threaded, so fewer cores also means less spare capacity for GC, decoding and
 *   compositing running beside it. Heuristic.
 * memory <= 2 / <= 4 GiB: Devices with <= 4 GiB RAM are commonly treated as memory-constrained in
 *   adaptive-loading guidance. deviceMemory is bucketed (0.25..8), so these map to buckets.
 * network: effectiveType is the browser's own estimate (based on recent RTT/downlink). 2g classes
 *   score highest, 3g lower. saveData is an explicit user request to reduce data use.
 * domNodes > 800 / > 1500: Lighthouse's "Avoid an excessive DOM size" audit warns around 800 nodes
 *   and fails around 1,400. 1500 is used as the "high" mark.
 * resources > 100 / > 200: Pages in the region of tens of requests are typical content pages; counts
 *   above 100 and 200 are used as "heavy" and "very heavy" marks. Heuristic, not a standard.
 * long tasks > 300 ms / > 1000 ms total: Long Tasks are main-thread tasks over 50 ms (W3C spec).
 *   Lighthouse treats Total Blocking Time of 200 ms as good and 600 ms as poor on mobile; the
 *   marks here are cumulative over the whole load, so they are set above those figures.
 */
export const THRESHOLDS = {
  coresLow: 2,
  coresModerate: 4,
  memoryLowGB: 2,
  memoryModerateGB: 4,
  domModerate: 800,
  domHigh: 1500,
  resourcesModerate: 100,
  resourcesHigh: 200,
  longTaskModerateMs: 300,
  longTaskHighMs: 1000,
  /** pressure >= this: performance */
  performanceAt: 3,
  /** pressure >= this: extreme (only reachable from page evidence, see decideLevel) */
  extremeAt: 6
} as const;

export interface Contribution {
  signal: string;
  points: number;
  why: string;
}

export interface Decision {
  level: Level;
  pressure: number;
  contributions: Contribution[];
  /** Signals the browser did not expose; they were not guessed. */
  unavailable: string[];
}

export type Phase = 'start' | 'settled';

/**
 * phase "start": only device and network signals exist; the level is capped at "performance"
 *   because escalating to "extreme" without evidence about the page itself is not justified.
 * phase "settled": page evidence (DOM size, resources, long tasks) is available.
 */
export function decideLevel(s: Signals, phase: Phase): Decision {
  const contributions: Contribution[] = [];
  const unavailable: string[] = [];
  const add = (signal: string, points: number, why: string) => {
    if (points > 0) contributions.push({ signal, points, why });
  };

  if (s.cores === null) unavailable.push('cores');
  else if (s.cores <= THRESHOLDS.coresLow) add('cores', 2, `${s.cores} logical cores`);
  else if (s.cores <= THRESHOLDS.coresModerate) add('cores', 1, `${s.cores} logical cores`);

  if (s.memoryGB === null) unavailable.push('memory');
  else if (s.memoryGB <= THRESHOLDS.memoryLowGB) add('memory', 2, `${s.memoryGB} GiB reported`);
  else if (s.memoryGB <= THRESHOLDS.memoryModerateGB) add('memory', 1, `${s.memoryGB} GiB reported`);

  if (s.effectiveType === null) unavailable.push('network');
  else if (s.effectiveType === 'slow-2g' || s.effectiveType === '2g') add('network', 2, `effective type ${s.effectiveType}`);
  else if (s.effectiveType === '3g') add('network', 1, 'effective type 3g');

  if (s.saveData === null) unavailable.push('saveData');
  else if (s.saveData) add('saveData', 1, 'Data Saver requested by the user or browser');

  if (phase === 'settled') {
    if (s.domNodes === null) unavailable.push('domNodes');
    else if (s.domNodes > THRESHOLDS.domHigh) add('domNodes', 2, `${s.domNodes} elements`);
    else if (s.domNodes > THRESHOLDS.domModerate) add('domNodes', 1, `${s.domNodes} elements`);

    if (s.resourceCount === null) unavailable.push('resources');
    else if (s.resourceCount > THRESHOLDS.resourcesHigh) add('resources', 2, `${s.resourceCount} requests`);
    else if (s.resourceCount > THRESHOLDS.resourcesModerate) add('resources', 1, `${s.resourceCount} requests`);

    if (s.longTaskMs === null) unavailable.push('longTasks');
    else if (s.longTaskMs > THRESHOLDS.longTaskHighMs) add('longTasks', 2, `${Math.round(s.longTaskMs)} ms in long tasks`);
    else if (s.longTaskMs > THRESHOLDS.longTaskModerateMs) add('longTasks', 1, `${Math.round(s.longTaskMs)} ms in long tasks`);
  }

  const pressure = contributions.reduce((n, c) => n + c.points, 0);
  let level: Level = 'balanced';
  if (pressure >= THRESHOLDS.extremeAt && phase === 'settled') level = 'extreme';
  else if (pressure >= THRESHOLDS.performanceAt) level = 'performance';
  return { level, pressure, contributions, unavailable };
}

const ORDER: Record<Level, number> = { balanced: 0, performance: 1, extreme: 2 };

/** Adaptive escalation is monotonic within a page: it never lowers an already applied level. */
export function maxLevel(a: Level, b: Level): Level {
  return ORDER[a] >= ORDER[b] ? a : b;
}
