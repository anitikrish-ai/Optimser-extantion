/**
 * One-shot page sampling. There is NO continuous observer: PerformanceObservers are created with
 * `buffered: true`, read once, and disconnected immediately, so they cost nothing between samples.
 *
 * Every value is a Measurement: measured, or unavailable with the reason. Nothing is fabricated.
 */
import { measured, unavailable } from '../shared/measure';
import type { ActionCounts, Measurement, PageSample } from '../shared/measure';
import type { Level } from '../shared/types';

const NAV_NOT_READY = 'Not finished yet';

type PerfWithMemory = Performance & { memory?: { usedJSHeapSize: number } };

function collectBuffered(win: Window, type: string, waitMs: number): Promise<PerformanceEntry[] | null> {
  const PO = (win as Window & { PerformanceObserver?: typeof PerformanceObserver }).PerformanceObserver;
  if (!PO || !PO.supportedEntryTypes?.includes(type)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const entries: PerformanceEntry[] = [];
    let obs: PerformanceObserver;
    try {
      obs = new PO((list) => entries.push(...list.getEntries()));
      obs.observe({ type, buffered: true });
    } catch {
      resolve(null);
      return;
    }
    win.setTimeout(() => {
      entries.push(...obs.takeRecords());
      obs.disconnect();
      resolve(entries);
    }, waitMs);
  });
}

export interface SampleInput {
  win: Window;
  active: boolean;
  level: Level | null;
  actions: ActionCounts;
  selfTimeMs: number;
  selfLimited: boolean;
  waitMs?: number;
}

export async function collectSample(inp: SampleInput): Promise<PageSample> {
  const { win } = inp;
  const perf = win.performance as PerfWithMemory;
  const wait = inp.waitMs ?? 60;
  const [lcpEntries, longTasks] = await Promise.all([
    collectBuffered(win, 'largest-contentful-paint', wait),
    collectBuffered(win, 'longtask', wait)
  ]);

  const nav = perf.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  const fromNav = (v: number | undefined): Measurement<number> =>
    nav && typeof v === 'number' && v > 0 ? measured(Math.round(v)) : unavailable(nav ? NAV_NOT_READY : 'Navigation Timing is not available');

  const paint = perf.getEntriesByType('paint').find((e) => e.name === 'first-contentful-paint');
  const fcp: Measurement<number> = paint ? measured(Math.round(paint.startTime)) : unavailable('First Contentful Paint was not reported');

  let lcp: Measurement<number>;
  if (lcpEntries === null) lcp = unavailable('Largest Contentful Paint is not supported by this browser');
  else if (lcpEntries.length === 0) lcp = unavailable('No Largest Contentful Paint recorded yet');
  else lcp = measured(Math.round((lcpEntries[lcpEntries.length - 1] as PerformanceEntry).startTime), 'May still change until the user interacts');

  const resources = perf.getEntriesByType('resource') as PerformanceResourceTiming[];
  let bytes = 0;
  let hidden = 0;
  for (const r of resources) {
    if (r.transferSize > 0) bytes += r.transferSize;
    else if (r.encodedBodySize === 0 && r.decodedBodySize === 0) hidden++;
  }

  let ltCount: Measurement<number>;
  let ltTotal: Measurement<number>;
  if (longTasks === null) {
    ltCount = unavailable('Long Tasks API is not supported by this browser');
    ltTotal = unavailable('Long Tasks API is not supported by this browser');
  } else {
    ltCount = measured(longTasks.length);
    ltTotal = measured(Math.round(longTasks.reduce((n, e) => n + e.duration, 0)));
  }

  const heap = perf.memory?.usedJSHeapSize;
  const jsHeap: Measurement<number> =
    typeof heap === 'number' && heap > 0
      ? measured(Math.round((heap / 1048576) * 10) / 10, 'Coarse value; the browser limits its precision')
      : unavailable('This browser does not expose JavaScript heap size');

  return {
    takenAtEpochMs: Date.now(),
    timeOriginEpochMs: Math.round(perf.timeOrigin),
    optimizerActive: inp.active,
    level: inp.level,
    ttfbMs: fromNav(nav?.responseStart),
    domContentLoadedMs: fromNav(nav?.domContentLoadedEventEnd),
    loadMs: fromNav(nav?.loadEventEnd),
    fcpMs: fcp,
    lcpMs: lcp,
    requestCount: measured(resources.length, 'Counts requests the browser recorded; blocked requests are not included'),
    transferredBytes: measured(bytes, 'Lower bound: sizes of cross-origin resources are hidden by the browser'),
    sizeHiddenResources: measured(hidden),
    domNodes: measured(win.document.getElementsByTagName('*').length),
    longTaskCount: ltCount,
    longTaskTotalMs: ltTotal,
    jsHeapUsedMB: jsHeap,
    selfTimeMs: measured(Math.round(inp.selfTimeMs * 10) / 10, 'Time inside this extension\'s own callbacks on this page'),
    selfLimited: inp.selfLimited,
    actions: { ...inp.actions }
  };
}
