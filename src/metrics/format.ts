/** Presentation helpers. Every displayed measurement carries an explicit state label. */
import type { Measurement } from '../shared/measure';
import type { Unit } from './compare';

export type Badge = 'Measured' | 'Estimated' | 'Unavailable';

export interface Display {
  text: string;
  badge: Badge;
  /** Longer explanation for tooltips and screen readers. */
  detail: string;
}

export function formatValue(value: number, unit: Unit): string {
  switch (unit) {
    case 'ms':
      return `${Math.round(value)} ms`;
    case 'bytes':
      if (value >= 1048576) return `${(value / 1048576).toFixed(2)} MB`;
      return `${Math.round(value / 1024)} KB`;
    case 'MB':
      return `${value} MB`;
    default:
      return String(Math.round(value));
  }
}

export function display(m: Measurement<number>, unit: Unit): Display {
  switch (m.state) {
    case 'measured':
      return { text: formatValue(m.value, unit), badge: 'Measured', detail: m.note ?? 'Read from a browser API.' };
    case 'estimated':
      return { text: `about ${formatValue(m.value, unit)}`, badge: 'Estimated', detail: `Estimation method: ${m.method}` };
    default:
      return { text: 'Unavailable', badge: 'Unavailable', detail: m.reason };
  }
}
