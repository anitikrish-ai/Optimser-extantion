/**
 * Before/after comparison of two single-run samples.
 *
 * Rules:
 *  - A row exists only when BOTH runs measured the value. Anything else is listed as skipped with the reason.
 *  - No overall "score" or "% faster" headline is produced. Each row is a plain difference.
 *  - Results are single runs; network conditions, cache state and page content (ads, A/B tests) vary
 *    between runs. The UI states this next to the table.
 */
import type { Measurement, PageSample } from '../shared/measure';

export type Unit = 'ms' | 'count' | 'bytes' | 'MB';

export interface CompareRow {
  key: string;
  label: string;
  unit: Unit;
  before: number;
  after: number;
  delta: number;
  /** Null when the baseline is zero. */
  deltaPct: number | null;
}

export interface Skipped {
  key: string;
  label: string;
  reason: string;
}

const METRICS: Array<{ key: keyof PageSample; label: string; unit: Unit }> = [
  { key: 'ttfbMs', label: 'Time to first byte', unit: 'ms' },
  { key: 'fcpMs', label: 'First contentful paint', unit: 'ms' },
  { key: 'lcpMs', label: 'Largest contentful paint', unit: 'ms' },
  { key: 'domContentLoadedMs', label: 'DOMContentLoaded', unit: 'ms' },
  { key: 'loadMs', label: 'Load event', unit: 'ms' },
  { key: 'requestCount', label: 'Requests recorded', unit: 'count' },
  { key: 'transferredBytes', label: 'Transferred (visible sizes only)', unit: 'bytes' },
  { key: 'domNodes', label: 'DOM elements', unit: 'count' },
  { key: 'longTaskCount', label: 'Long tasks', unit: 'count' },
  { key: 'longTaskTotalMs', label: 'Long task time', unit: 'ms' },
  { key: 'jsHeapUsedMB', label: 'JS heap (coarse)', unit: 'MB' }
];

const reasonOf = (m: Measurement<number>): string => (m.state === 'unavailable' ? m.reason : 'Not measured');

export function compareSamples(before: PageSample, after: PageSample): { rows: CompareRow[]; skipped: Skipped[] } {
  const rows: CompareRow[] = [];
  const skipped: Skipped[] = [];
  for (const { key, label, unit } of METRICS) {
    const b = before[key] as Measurement<number>;
    const a = after[key] as Measurement<number>;
    if (b.state === 'unavailable' || a.state === 'unavailable') {
      skipped.push({ key, label, reason: b.state === 'unavailable' ? reasonOf(b) : reasonOf(a) });
      continue;
    }
    const delta = Math.round((a.value - b.value) * 10) / 10;
    rows.push({
      key,
      label,
      unit,
      before: b.value,
      after: a.value,
      delta,
      deltaPct: b.value === 0 ? null : Math.round(((a.value - b.value) / b.value) * 1000) / 10
    });
  }
  return { rows, skipped };
}
