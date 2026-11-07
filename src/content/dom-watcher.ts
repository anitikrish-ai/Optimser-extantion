/**
 * One shared MutationObserver for all modules (instead of one per module).
 *
 * Self-overhead controls:
 *  - Records are only queued in the callback; the actual work runs later in idle time.
 *  - Work is sliced: at most SLICE_MS per slice, so a slice never becomes a long task (>50 ms).
 *  - The pending queue is capped; on overflow it degrades to one full rescan.
 *  - The observer is disconnected while the tab is hidden and a single rescan runs when it is visible again.
 *  - Hard stop after MAX_TOTAL_MS of cumulative own time; the page is then left as-is (self-limited).
 */
import type { SelfMeter } from './meter';
import { Disposer } from './lifecycle';
import type { Win } from './lifecycle';

export const SLICE_MS = 8;
export const MAX_TOTAL_MS = 1000;
export const MAX_PENDING = 2000;

interface Sub {
  selector: string;
  cb: (els: Element[]) => void;
}

export class DomWatcher {
  private subs: Sub[] = [];
  private batchHooks: Array<() => void> = [];
  private pending: Element[] = [];
  private observer: MutationObserver | null = null;
  private scheduled = false;
  private idleHandle: number | null = null;
  private stopped = true;
  private limited = false;
  private readonly d = new Disposer();

  constructor(
    private readonly doc: Document,
    private readonly win: Win,
    private readonly meter: SelfMeter,
    private readonly maxTotalMs: number = MAX_TOTAL_MS
  ) {}

  get selfLimited(): boolean {
    return this.limited;
  }

  subscribe(selector: string, cb: (els: Element[]) => void): void {
    this.subs.push({ selector, cb });
  }

  /** Called after each processed batch; used for cheap per-batch checks such as "did the path change". */
  onBatch(fn: () => void): void {
    this.batchHooks.push(fn);
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.connect();
    this.queueFullScan();
    this.d.listen(this.doc, 'visibilitychange', () => {
      if (this.doc.hidden) {
        this.disconnect();
        this.pending = [];
      } else if (!this.stopped) {
        this.connect();
        this.queueFullScan();
      }
    });
  }

  stop(): void {
    this.stopped = true;
    this.disconnect();
    this.pending = [];
    this.cancelSchedule();
    this.d.dispose();
    this.subs = [];
    this.batchHooks = [];
  }

  private connect(): void {
    if (this.observer || this.stopped) return;
    const root = this.doc.documentElement;
    if (!root) return;
    this.observer = new this.win.MutationObserver((records: MutationRecord[]) => {
      // Callback does the minimum: queue added elements.
      for (const r of records) {
        for (const n of Array.from(r.addedNodes)) {
          if (n.nodeType === 1) this.pending.push(n as Element);
        }
      }
      if (this.pending.length > MAX_PENDING) this.queueFullScan();
      this.schedule();
    });
    this.observer.observe(root, { childList: true, subtree: true });
  }

  private disconnect(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  private queueFullScan(): void {
    const root = this.doc.documentElement;
    this.pending = root ? [root] : [];
    this.schedule();
  }

  private schedule(): void {
    if (this.scheduled || this.stopped || this.doc.hidden) return;
    this.scheduled = true;
    const run = () => {
      this.scheduled = false;
      this.idleHandle = null;
      this.process();
    };
    const w = this.win as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (typeof w.requestIdleCallback === 'function') this.idleHandle = w.requestIdleCallback(run, { timeout: 1000 });
    else this.idleHandle = this.win.setTimeout(run, 50);
  }

  private cancelSchedule(): void {
    if (this.idleHandle === null) return;
    const w = this.win as Window & { cancelIdleCallback?: (h: number) => void };
    if (typeof w.cancelIdleCallback === 'function') w.cancelIdleCallback(this.idleHandle);
    this.win.clearTimeout(this.idleHandle);
    this.idleHandle = null;
    this.scheduled = false;
  }

  private process(): void {
    if (this.stopped) return;
    const t0 = performance.now();
    this.meter.time(() => {
      while (this.pending.length > 0 && performance.now() - t0 < SLICE_MS) {
        const root = this.pending.shift() as Element;
        for (const sub of this.subs) {
          const found: Element[] = [];
          try {
            if (root.matches(sub.selector)) found.push(root);
            if (root.firstElementChild) found.push(...Array.from(root.querySelectorAll(sub.selector)));
          } catch {
            continue;
          }
          if (found.length > 0) sub.cb(found);
        }
      }
      for (const h of this.batchHooks) h();
    });
    if (this.meter.totalMs > this.maxTotalMs) {
      this.limited = true;
      this.stop();
      return;
    }
    if (this.pending.length > 0) this.schedule();
  }
}
