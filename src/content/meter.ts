/**
 * Measures main-thread time spent inside this extension's own callbacks on the page.
 * It does not include browser-internal cost of delivering observer records, so it is a lower bound.
 */
export class SelfMeter {
  totalMs = 0;
  calls = 0;
  constructor(private readonly now: () => number = () => performance.now()) {}

  time<T>(fn: () => T): T {
    const t0 = this.now();
    try {
      return fn();
    } finally {
      this.totalMs += this.now() - t0;
      this.calls++;
    }
  }
}
