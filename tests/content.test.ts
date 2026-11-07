/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeIO, makeEnv, setRect, sleep, stubVideo, waitFor } from './dom-env';
import { DomWatcher } from '../src/content/dom-watcher';
import { SelfMeter } from '../src/content/meter';
import { createImages } from '../src/content/modules/images';
import { createVideos } from '../src/content/modules/videos';
import { createDom } from '../src/content/modules/dom';
import { createRendering } from '../src/content/modules/rendering';
import { Controller } from '../src/content/controller';
import { emptyActionCounts } from '../src/shared/measure';
import { defaultConfig } from '../src/shared/config';
import { buildContentSettings } from '../src/policy/resolve';
import type { ModuleCtx } from '../src/content/modules/types';
import type { Level, Plan } from '../src/shared/types';

function ctxFor(e: ReturnType<typeof makeEnv>, level: Level = 'balanced', watcherMs?: number): ModuleCtx & { watcher: DomWatcher } {
  const watcher = new DomWatcher(e.doc, e.win, new SelfMeter(), watcherMs);
  return { doc: e.doc, win: e.win, watcher, counts: emptyActionCounts(), level };
}
const html = (e: ReturnType<typeof makeEnv>) => e.doc.documentElement.outerHTML;
const S = buildContentSettings(defaultConfig(), defaultConfig().modules);

test('DomWatcher: processes existing and added nodes, then stop() releases the observer and ignores later changes', async () => {
  const e = makeEnv('<img id="a">');
  const c = ctxFor(e);
  const seen: string[] = [];
  c.watcher.subscribe('img', (els) => els.forEach((x) => seen.push(x.id)));
  c.watcher.start();
  await waitFor(() => seen.includes('a'));
  const b = e.doc.createElement('img'); b.id = 'b'; e.doc.body.append(b);
  await waitFor(() => seen.includes('b'));
  assert.equal(e.counts.liveMutationObservers, 1);
  c.watcher.stop();
  assert.equal(e.counts.liveMutationObservers, 0);
  const d = e.doc.createElement('img'); d.id = 'd'; e.doc.body.append(d);
  await sleep(120);
  assert.ok(!seen.includes('d'));
});

test('DomWatcher: stops itself after its work budget is spent (runaway protection)', async () => {
  const e = makeEnv('<img id="a">');
  const c = ctxFor(e, 'balanced', -1);
  c.watcher.subscribe('img', () => undefined);
  c.watcher.start();
  await waitFor(() => c.watcher.selfLimited);
  assert.equal(e.counts.liveMutationObservers, 0);
});

test('DomWatcher: a burst larger than the queue cap still processes every node', async () => {
  const e = makeEnv();
  const c = ctxFor(e);
  const seen = new Set<Element>();
  c.watcher.subscribe('img', (els) => els.forEach((x) => seen.add(x)));
  c.watcher.start();
  await sleep(80);
  const frag = e.doc.createDocumentFragment();
  for (let i = 0; i < 2600; i++) frag.append(e.doc.createElement('img'));
  e.doc.body.append(frag);
  await waitFor(() => seen.size === 2600, 8000);
  c.watcher.stop();
});

test('images: lazy only below the fold and only when no explicit choice was made; fully reversible', async () => {
  const e = makeEnv('<img id="far"><img id="near"><img id="eager" loading="eager"><img id="hi" fetchpriority="high"><img id="done">');
  const q = (id: string) => e.doc.getElementById(id) as HTMLImageElement;
  for (const id of ['far', 'near', 'eager', 'hi', 'done']) Object.defineProperty(q(id), 'complete', { value: id === 'done' });
  setRect(q('far'), 5000, 100); setRect(q('near'), 100, 100); setRect(q('eager'), 5000, 100); setRect(q('hi'), 5000, 100); setRect(q('done'), 5000, 100);
  const before = html(e);
  const c = ctxFor(e);
  const m = createImages(c, S.images);
  m.start(); c.watcher.start();
  await waitFor(() => q('far').getAttribute('loading') === 'lazy');
  assert.equal(q('near').getAttribute('loading'), null, 'above the fold is not deferred');
  assert.equal(q('eager').getAttribute('loading'), 'eager', 'an explicit choice by the page is respected');
  assert.equal(q('hi').getAttribute('loading'), null, 'high-priority images are never deferred');
  assert.equal(q('done').getAttribute('loading'), null, 'an image that already loaded is not touched');
  assert.equal(q('near').getAttribute('decoding'), 'async');
  assert.equal(c.counts.imagesLazy, 1);
  c.watcher.stop(); m.stop();
  assert.equal(html(e), before, 'page is byte-identical after restore');
});

test('images: attributes the page changed after us are not clobbered on restore', async () => {
  const e = makeEnv('<img id="x">');
  const img = e.doc.getElementById('x') as HTMLImageElement;
  Object.defineProperty(img, 'complete', { value: false }); setRect(img, 5000, 10);
  const c = ctxFor(e); const m = createImages(c, S.images);
  m.start(); c.watcher.start();
  await waitFor(() => img.getAttribute('loading') === 'lazy');
  img.setAttribute('loading', 'eager');
  c.watcher.stop(); m.stop();
  assert.equal(img.getAttribute('loading'), 'eager');
});

test('videos: autoplay before interaction is paused; after interaction it is not; restore resumes', async () => {
  const e = makeEnv('<video id="v" controls></video><video id="w"></video>');
  const v = e.doc.getElementById('v') as HTMLVideoElement, w = e.doc.getElementById('w') as HTMLVideoElement;
  stubVideo(v, { playing: false, muted: true }); stubVideo(w, { playing: false, muted: true });
  const c = ctxFor(e); const m = createVideos(c, S.videos); m.start();
  v.play();
  assert.equal(v.paused, true);
  assert.equal(v.getAttribute('data-uwpo-paused'), 'autoplay');
  assert.equal(c.counts.videosAutoplayPaused, 1);
  e.doc.dispatchEvent(new (e.win as any).Event('pointerdown'));
  w.play();
  assert.equal(w.paused, false, 'playback after a user gesture is untouched');
  m.stop();
  assert.equal(v.paused, false, 'restore resumes what we paused');
  assert.equal(v.hasAttribute('data-uwpo-paused'), false);
});

test('videos: only muted playback is paused off-screen; audible video is never interrupted; resumes on return', () => {
  const e = makeEnv('<video id="m"></video><video id="a"></video>');
  const mv = e.doc.getElementById('m') as HTMLVideoElement, av = e.doc.getElementById('a') as HTMLVideoElement;
  stubVideo(mv, { playing: true, muted: true }); stubVideo(av, { playing: true, muted: false });
  const c = ctxFor(e, 'balanced', undefined);
  c.watcher.subscribe = (_s, cb) => cb([mv, av]); // deliver both videos immediately
  const m = createVideos(c, { ...S.videos, blockAutoplay: false, pauseInBackground: false }); m.start();
  const io = FakeIO.instances.at(-1) as FakeIO;
  io.fire(av, false); io.fire(mv, false);
  assert.equal(av.paused, false);
  assert.equal(mv.paused, true);
  io.fire(mv, true);
  assert.equal(mv.paused, false);
  m.stop();
  assert.equal(io.disconnected, true);
});

test('videos: a pause made by the user or page is never undone by us', () => {
  const e = makeEnv('<video id="m"></video>');
  const mv = e.doc.getElementById('m') as HTMLVideoElement;
  stubVideo(mv, { playing: true, muted: true });
  const c = ctxFor(e); c.watcher.subscribe = (_s, cb) => cb([mv]);
  const m = createVideos(c, { ...S.videos, blockAutoplay: false, pauseInBackground: false }); m.start();
  const io = FakeIO.instances.at(-1) as FakeIO;
  io.fire(mv, false);
  assert.equal(mv.paused, true);
  mv.play(); mv.pause(); // user starts then pauses it: the page owns the state now
  assert.equal(mv.hasAttribute('data-uwpo-paused'), false);
  io.fire(mv, true);
  assert.equal(mv.paused, true, 'we do not resume a video the user paused');
  m.stop();
});

test('videos: background tab pauses muted playback and resumes it when visible again', () => {
  const e = makeEnv('<video id="m"></video>');
  const mv = e.doc.getElementById('m') as HTMLVideoElement;
  stubVideo(mv, { playing: true, muted: true });
  const c = ctxFor(e); const m = createVideos(c, { ...S.videos, blockAutoplay: false, pauseOffscreen: false }); m.start();
  let hidden = true;
  Object.defineProperty(e.doc, 'hidden', { get: () => hidden, configurable: true });
  e.doc.dispatchEvent(new (e.win as any).Event('visibilitychange'));
  assert.equal(mv.paused, true);
  hidden = false;
  e.doc.dispatchEvent(new (e.win as any).Event('visibilitychange'));
  assert.equal(mv.paused, false);
  m.stop();
});

test('dom: content-visibility is applied to large far sections, skips risky ones, and restores prior inline styles', async () => {
  const e = makeEnv('<main><section id="far" style="color:red"></section><section id="form"><form></form></section><section id="fixed"></section><section id="small"></section><section id="near"></section></main>');
  const q = (id: string) => e.doc.getElementById(id) as HTMLElement;
  setRect(q('far'), 6000, 900); setRect(q('form'), 6000, 900); setRect(q('fixed'), 6000, 900); setRect(q('small'), 6000, 50); setRect(q('near'), 900, 900);
  (e.win as any).getComputedStyle = (el: Element) => ({ position: el.id === 'fixed' ? 'fixed' : 'static' });
  // The engine re-serializes inline styles when they are touched; this is an equivalent form.
  const before = html(e).replace('style="color:red"', 'style="color: red;"');
  const c = ctxFor(e); const m = createDom(c, S.dom); m.start(); c.watcher.start();
  await waitFor(() => q('far').style.getPropertyValue('content-visibility') === 'auto');
  assert.match(q('far').style.getPropertyValue('contain-intrinsic-height'), /^auto 900px$/);
  for (const id of ['form', 'fixed', 'small', 'near']) assert.equal(q(id).style.getPropertyValue('content-visibility'), '', id);
  assert.equal(c.counts.sectionsDeferred, 1);
  c.watcher.stop(); m.stop();
  assert.equal(html(e), before);
});

test('dom: does nothing on engines without content-visibility support', async () => {
  const e = makeEnv('<main><section id="far"></section></main>');
  (e.win as any).CSS = { supports: () => false };
  setRect(e.doc.getElementById('far') as Element, 6000, 900);
  const c = ctxFor(e); const m = createDom(c, S.dom); m.start(); c.watcher.start();
  await sleep(120);
  assert.equal(c.counts.sectionsDeferred, 0);
  c.watcher.stop(); m.stop();
});

test('rendering: backdrop-filter removal exists only at the extreme level and is removed on stop', () => {
  for (const [level, expected] of [['balanced', 0], ['performance', 0], ['extreme', 1]] as const) {
    const e = makeEnv();
    const m = createRendering(ctxFor(e, level), S.rendering); m.start();
    assert.equal(e.doc.querySelectorAll('#uwpo-rendering-style').length, expected, level);
    m.stop();
    assert.equal(e.doc.querySelectorAll('#uwpo-rendering-style').length, 0);
  }
});

test('rendering: pauses only infinite CSS animations that are off-screen, resumes them, and restores on stop', async () => {
  const e = makeEnv('<div id="spin"></div><div id="bg"></div><div id="once"></div>');
  const q = (id: string) => e.doc.getElementById(id) as HTMLElement;
  const mk = (el: HTMLElement, iterations: number, name: string | undefined) => {
    const a: any = { effect: { target: el, getComputedTiming: () => ({ iterations }) }, playState: 'running', pause() { this.playState = 'paused'; }, play() { this.playState = 'running'; } };
    if (name) a.animationName = name;
    return a;
  };
  const anims = [mk(q('spin'), Infinity, 'spin'), mk(q('bg'), Infinity, 'drift'), mk(q('once'), 1, 'fade'), mk(q('bg'), Infinity, undefined)];
  (e.doc as any).getAnimations = () => anims;
  const c = ctxFor(e); const m = createRendering(c, S.rendering); m.start();
  e.win.dispatchEvent(new (e.win as any).Event('scroll'));
  const io = FakeIO.instances.at(-1) as FakeIO;
  await waitFor(() => io.observed.size === 2, 2000);
  assert.ok(!io.observed.has(q('once')), 'finite animations are ignored');
  io.fire(q('spin'), true); io.fire(q('bg'), false);
  assert.equal(anims[0].playState, 'running', 'on-screen animations are never paused');
  assert.equal(anims[1].playState, 'paused');
  assert.equal(anims[3].playState, 'running', 'transitions (no animationName) are never touched');
  io.fire(q('bg'), true);
  assert.equal(anims[1].playState, 'running');
  io.fire(q('bg'), false);
  m.stop();
  assert.equal(anims[1].playState, 'running', 'stop restores paused animations');
  assert.equal(io.disconnected, true);
});

function planFor(over: Partial<Plan> = {}): Plan {
  return { active: true, reason: null, mode: 'balanced', settings: S, autoSample: 'none', runId: null, ...over };
}
function controller(e: ReturnType<typeof makeEnv>) {
  const reports: any[] = [], trips: string[] = [];
  const c = new Controller({ doc: e.doc, win: e.win, settleMs: 0, reportSample: (s, r) => reports.push({ s, r }), reportTrip: (t) => trips.push(t) });
  return { c, reports, trips };
}

test('controller: an inactive plan creates no observers and changes nothing', async () => {
  const e = makeEnv('<img id="x"><video></video>');
  const before = html(e);
  const { c } = controller(e);
  c.apply(planFor({ active: false, reason: 'allowlisted' }));
  await sleep(120);
  assert.equal(e.counts.mutationObservers, 0);
  assert.equal(FakeIO.instances.length, 0);
  assert.equal(html(e), before);
});

test('controller: restore() returns the page to byte-identical state and releases every observer', async () => {
  const e = makeEnv('<main><img id="i"><video id="v"></video><section id="s"></section></main>');
  const i = e.doc.getElementById('i') as HTMLImageElement; Object.defineProperty(i, 'complete', { value: false }); setRect(i, 5000, 10);
  const s = e.doc.getElementById('s') as HTMLElement; setRect(s, 6000, 900);
  (e.win as any).getComputedStyle = () => ({ position: 'static' });
  stubVideo(e.doc.getElementById('v') as HTMLVideoElement, { playing: false, muted: true });
  const before = html(e);
  const { c } = controller(e);
  c.apply(planFor({ mode: 'extreme' }));
  await waitFor(() => i.getAttribute('loading') === 'lazy' && s.style.getPropertyValue('content-visibility') === 'auto');
  assert.ok(html(e) !== before);
  c.restore();
  assert.equal(html(e), before);
  assert.equal(e.counts.liveMutationObservers, 0);
  assert.ok(FakeIO.instances.every((o) => o.disconnected));
  c.restore(); // idempotent
});

test('controller: applying a new plan fully undoes the previous one first', async () => {
  const e = makeEnv('<img id="i">');
  const i = e.doc.getElementById('i') as HTMLImageElement; Object.defineProperty(i, 'complete', { value: false }); setRect(i, 5000, 10);
  const { c } = controller(e);
  c.apply(planFor({ mode: 'balanced' }));
  await waitFor(() => i.getAttribute('loading') === 'lazy');
  c.apply(planFor({ active: false, reason: 'tab-paused' }));
  assert.equal(i.hasAttribute('loading'), false);
  assert.equal(e.counts.liveMutationObservers, 0);
});

test('controller safety: a password field switches everything off and tells the background', async () => {
  const e = makeEnv('<main><img id="i"></main>');
  const i = e.doc.getElementById('i') as HTMLImageElement; Object.defineProperty(i, 'complete', { value: false }); setRect(i, 5000, 10);
  const { c, trips } = controller(e);
  c.apply(planFor());
  await waitFor(() => i.getAttribute('loading') === 'lazy');
  const pw = e.doc.createElement('input'); pw.type = 'password'; e.doc.body.append(pw);
  await waitFor(() => trips.length === 1);
  assert.deepEqual(trips, ['sensitive-input']);
  assert.equal(i.hasAttribute('loading'), false, 'modifications are rolled back');
  assert.equal(c.isActive, false);
  assert.equal(e.counts.liveMutationObservers, 0);
});

test('controller safety: a single-page-app route change to a checkout path trips the safety check', async () => {
  const e = makeEnv('<main></main>');
  const { c, trips } = controller(e);
  c.apply(planFor());
  await sleep(100);
  e.win.history.pushState({}, '', '/checkout/payment');
  e.doc.body.append(e.doc.createElement('div'));
  await waitFor(() => trips.length === 1);
  assert.deepEqual(trips, ['essential-path']);
});

test('controller adaptive: after load, page evidence can raise the level once and never lowers it', async () => {
  const e = makeEnv('<main></main>');
  Object.defineProperty(e.win.navigator, 'hardwareConcurrency', { value: 2 });
  Object.defineProperty(e.win.navigator, 'deviceMemory', { value: 2, configurable: true });
  const bulk = e.doc.createDocumentFragment();
  for (let i = 0; i < 1600; i++) bulk.append(e.doc.createElement('span'));
  e.doc.body.append(bulk);
  Object.defineProperty(e.doc, 'readyState', { value: 'complete', configurable: true });
  const { c, reports } = controller(e);
  c.apply(planFor({ mode: 'adaptive', autoSample: 'adaptive' }));
  await waitFor(() => reports.length === 1, 3000);
  assert.equal(reports[0].s.level, 'extreme');
  assert.equal(reports[0].s.optimizerActive, true);
  assert.equal(e.doc.querySelectorAll('#uwpo-rendering-style').length, 1, 'extreme effects are applied after escalation');
  assert.equal((await c.sample())?.level, 'extreme');
  c.restore();
  assert.equal(e.doc.querySelectorAll('#uwpo-rendering-style').length, 0);
});

test('controller compare mode: an inactive baseline still reports an unoptimized sample with the run id', async () => {
  const e = makeEnv('<main></main>');
  Object.defineProperty(e.doc, 'readyState', { value: 'complete', configurable: true });
  const { c, reports } = controller(e);
  c.apply(planFor({ active: false, reason: 'compare-baseline', autoSample: 'compare', runId: 'r1' }));
  await waitFor(() => reports.length === 1, 3000);
  assert.equal(reports[0].r, 'r1');
  assert.equal(reports[0].s.optimizerActive, false);
  assert.equal(e.counts.mutationObservers, 0);
});

test('dom: the contentVisibility option really switches the behaviour off', async () => {
  const e = makeEnv('<main><section id="far"></section></main>');
  setRect(e.doc.getElementById('far') as Element, 6000, 900);
  (e.win as any).getComputedStyle = () => ({ position: 'static' });
  const c = ctxFor(e); const m = createDom(c, { ...S.dom, contentVisibility: false }); m.start(); c.watcher.start();
  await sleep(120);
  assert.equal(c.counts.sectionsDeferred, 0);
  c.watcher.stop(); m.stop();
});
