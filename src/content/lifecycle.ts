/** A window whose global constructors (MutationObserver, HTMLElement, ...) are typed. */
export type Win = Window & typeof globalThis;

/** Collects cleanup callbacks so that every listener, observer and timer a module creates is released together. */
export class Disposer {
  private fns: Array<() => void> = [];

  add(fn: () => void): void {
    this.fns.push(fn);
  }

  listen(target: EventTarget, type: string, handler: EventListener, opts?: AddEventListenerOptions | boolean): void {
    target.addEventListener(type, handler, opts);
    this.fns.push(() => target.removeEventListener(type, handler, opts));
  }

  observer(o: { disconnect(): void }): void {
    this.fns.push(() => o.disconnect());
  }

  timeout(win: Window, fn: () => void, ms: number): void {
    const id = win.setTimeout(fn, ms);
    this.fns.push(() => win.clearTimeout(id));
  }

  /** Runs all cleanups (newest first). Safe to call more than once. Errors never abort the remaining cleanups. */
  dispose(): void {
    const fns = this.fns;
    this.fns = [];
    for (let i = fns.length - 1; i >= 0; i--) {
      try {
        (fns[i] as () => void)();
      } catch {
        /* keep going */
      }
    }
  }
}
