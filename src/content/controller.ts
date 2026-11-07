/**
 * Content controller: applies a Plan to the page and can undo everything.
 * Environment (document, window, messaging) is injected so it can be tested.
 */
import type { Level, Plan } from '../shared/types';
import { emptyActionCounts } from '../shared/measure';
import type { ActionCounts, PageSample } from '../shared/measure';
import { decideLevel, maxLevel } from '../adaptive/decide';
import { isEssentialPath, SENSITIVE_INPUT_SELECTOR } from '../safety/safety';
import { DomWatcher } from './dom-watcher';
import { SelfMeter } from './meter';
import { createImages } from './modules/images';
import { createVideos } from './modules/videos';
import { createRendering } from './modules/rendering';
import { createDom } from './modules/dom';
import type { ModuleCtx, OptModule } from './modules/types';
import { collectSample } from './sampler';
import { readDeviceSignals, withPageEvidence } from './signals';
import { Disposer } from './lifecycle';
import type { Win } from './lifecycle';

export interface Env {
  doc: Document;
  win: Win;
  /** Reports a sample to the background. */
  reportSample(sample: PageSample, runId: string | null): void;
  /** Tells the background a safety check fired on this page. */
  reportTrip(reason: 'sensitive-input' | 'essential-path'): void;
  /** Delay after load before the automatic sample (ms). */
  settleMs?: number;
}

export class Controller {
  private disposer = new Disposer();
  private modules: OptModule[] = [];
  private watcher: DomWatcher | null = null;
  private meter = new SelfMeter();
  private counts: ActionCounts = emptyActionCounts();
  private plan: Plan | null = null;
  private level: Level | null = null;
  private active = false;

  constructor(private readonly env: Env) {}

  get isActive(): boolean {
    return this.active;
  }

  /** Applies a plan. Any previous state is fully restored first. */
  apply(plan: Plan): void {
    this.restore();
    this.plan = plan;
    this.meter = new SelfMeter();
    this.counts = emptyActionCounts();
    const dev = readDeviceSignals(this.env.win.navigator);

    if (plan.active) {
      this.level = plan.mode === 'adaptive' ? decideLevel(dev, 'start').level : (plan.mode as Level);
      this.startModules(plan, this.level);
    } else {
      this.level = null;
    }
    this.scheduleSample(plan, dev);
  }

  private startModules(plan: Plan, level: Level): void {
    const { doc, win } = this.env;
    const watcher = new DomWatcher(doc, win, this.meter);
    const ctx: ModuleCtx = { doc, win, watcher, counts: this.counts, level };
    const s = plan.settings;
    const mods: OptModule[] = [];
    if (s.images.enabled) mods.push(createImages(ctx, s.images));
    if (s.videos.enabled) mods.push(createVideos(ctx, s.videos));
    if (s.rendering.enabled) mods.push(createRendering(ctx, s.rendering));
    if (s.dom.enabled) mods.push(createDom(ctx, s.dom));

    // Safety re-checks run on every processed batch: cheap string compare plus a selector test.
    let lastPath = win.location.pathname + win.location.hash;
    watcher.subscribe(SENSITIVE_INPUT_SELECTOR, () => this.trip('sensitive-input'));
    watcher.onBatch(() => {
      const p = win.location.pathname + win.location.hash;
      if (p !== lastPath) {
        lastPath = p;
        if (isEssentialPath(win.location.pathname, win.location.hash)) this.trip('essential-path');
      }
    });

    for (const m of mods) m.start();
    watcher.start();
    this.watcher = watcher;
    this.modules = mods;
    this.active = true;
  }

  private trip(reason: 'sensitive-input' | 'essential-path'): void {
    if (!this.active) return;
    this.restore();
    this.env.reportTrip(reason);
  }

  private scheduleSample(plan: Plan, dev: ReturnType<typeof readDeviceSignals>): void {
    if (plan.autoSample === 'none') return;
    const { win, doc } = this.env;
    const run = () => {
      this.disposer.timeout(
        win,
        () => {
          void this.sample().then((sample) => {
            if (!sample) return;
            if (plan.autoSample === 'adaptive' && this.active && this.level) {
              const next = decideLevel(withPageEvidence(dev, sample), 'settled').level;
              const escalated = maxLevel(this.level, next); // monotonic: never lowers
              if (escalated !== this.level) {
                const keepSample = sample;
                this.level = escalated;
                this.restartModules(plan, escalated);
                this.env.reportSample({ ...keepSample, level: escalated }, plan.runId);
                return;
              }
            }
            this.env.reportSample(sample, plan.runId);
          });
        },
        this.env.settleMs ?? 1000
      );
    };
    if (doc.readyState === 'complete') run();
    else this.disposer.listen(win, 'load', run, { once: true });
  }

  private restartModules(plan: Plan, level: Level): void {
    this.stopModules();
    this.startModules(plan, level);
  }

  /** A fresh sample of the current page. */
  async sample(): Promise<PageSample | null> {
    if (!this.plan) return null;
    return collectSample({
      win: this.env.win,
      active: this.active,
      level: this.level,
      actions: this.counts,
      selfTimeMs: this.meter.totalMs,
      selfLimited: this.watcher?.selfLimited ?? false
    });
  }

  private stopModules(): void {
    for (const m of this.modules) {
      try {
        m.stop();
      } catch {
        /* keep restoring */
      }
    }
    this.modules = [];
    this.watcher?.stop();
    this.watcher = null;
    this.active = false;
  }

  /** Undo everything: modules, observers, listeners, timers. The page returns to its native behaviour. */
  restore(): void {
    this.stopModules();
    this.disposer.dispose();
    this.disposer = new Disposer();
  }
}
