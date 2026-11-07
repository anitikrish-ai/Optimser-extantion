import test from 'node:test';
import assert from 'node:assert/strict';
import { BackgroundState } from '../src/background/state';
import { Handlers } from '../src/background/handlers';
import { NetworkApplier } from '../src/adapters/network-applier';
import { defaultConfig } from '../src/shared/config';
import { RULE_ID_BASE } from '../src/shared/tracker-list';
import { fakeApi, sample } from './helpers';
import type { FakeOpts } from './helpers';

function setup(opts?: FakeOpts) {
  const f = fakeApi(opts);
  const state = new BackgroundState(f.ext);
  const h = new Handlers({ ext: f.ext, state, applier: new NetworkApplier(f.ext) });
  return { ...f, state, h };
}
const tabRule = (log: { sessionRules: Array<{ id: number; condition: { tabIds?: number[] } }> }) => log.sessionRules.find((r) => r.id === RULE_ID_BASE.sessionAllowTabs);
const URL1 = 'https://news.example.com/story';

test('getPlan: active on a normal page, adaptive sampling requested, host recorded (not the URL)', async () => {
  const { h, state } = setup();
  const plan = await h.getPlan(1, URL1);
  assert.equal(plan.active, true);
  assert.equal(plan.autoSample, 'adaptive');
  assert.equal(state.getTab(1)?.host, 'news.example.com');
  assert.ok(!JSON.stringify(state.getTab(1)).includes('/story'), 'path must not be stored');
});

test('getPlan: safety reasons are reported', async () => {
  const { h, state } = setup();
  await state.ready();
  const c = defaultConfig(); c.allowlist = ['mybank.com'];
  await h.setConfig(c);
  assert.equal((await h.getPlan(1, 'https://www.mybank.com/home')).reason, 'allowlisted');
  assert.equal((await h.getPlan(2, 'https://shop.example.com/checkout')).reason, 'essential-path');
  assert.equal((await h.getPlan(3, 'about:blank')).reason, 'unsupported-page');
  assert.equal((await h.getPlan(4, undefined)).active, false);
});

test('recovery: pausing a tab disarms blocking for that tab, restores the page and reloads', async () => {
  const { h, log, state } = setup();
  await h.getPlan(5, URL1);
  const ack = await h.tabPause(5);
  assert.equal(ack.ok, true);
  assert.deepEqual(tabRule(log)?.condition.tabIds, [5]);
  assert.ok(log.tabMessages.some((m) => m.id === 5 && m.msg.type === 'RESTORE_NOW'));
  assert.deepEqual(log.reloads.at(-1), [5, { bypassCache: false }]);
  assert.equal((await h.getPlan(5, URL1)).reason, 'tab-paused');
  await h.tabResume(5);
  assert.equal(tabRule(log), undefined);
  assert.equal(state.getTab(5)?.bypass, null);
  assert.equal((await h.getPlan(5, URL1)).active, true);
});

test('recovery: a tab pause ends when the tab moves to a different site', async () => {
  const { h, log } = setup();
  await h.getPlan(6, URL1);
  await h.tabPause(6);
  const plan = await h.getPlan(6, 'https://other.example.org/');
  assert.equal(plan.active, true);
  assert.equal(tabRule(log), undefined, 'the tab-scoped allow rule is removed again');
});

test('pausing is refused where nothing can be optimized', async () => {
  const { h } = setup();
  assert.equal((await h.tabPause(99)).ok, false);
});

test('setConfig sanitizes malformed input, applies rules and notifies every tab', async () => {
  const { h, log } = setup();
  const res = await h.setConfig({ enabled: true, mode: 'bogus', customRules: ['ads.example.com', 'js.stripe.com', 'x.js'], allowlist: ['ok.com', '<bad>'] });
  assert.equal(res.ok, true);
  assert.ok((res.issues ?? []).length >= 3);
  assert.ok(log.sessionRules.some((r) => r.condition.urlFilter === '||ads.example.com^'));
  assert.ok(!log.sessionRules.some((r) => /stripe/.test(r.condition.urlFilter ?? '')));
  assert.deepEqual(log.tabMessages.filter((m) => m.msg.type === 'PLAN_CHANGED').map((m) => m.id).sort(), [1, 2, 3]);
});

test('master switch off disables all bundled rulesets and user rules immediately', async () => {
  const { h, log, state } = setup();
  await state.ready();
  const c = state.getConfig(); c.customRules = ['ads.example.com'];
  await h.setConfig(c);
  assert.ok(log.enabled.size > 0 && log.sessionRules.length > 0);
  await h.setConfig({ ...c, enabled: false });
  assert.equal(log.enabled.size, 0);
  assert.equal(log.sessionRules.length, 0);
});

test('session cleanup: closing a tab deletes its data and any bypass rule', async () => {
  const { h, log, state } = setup();
  await h.getPlan(8, URL1);
  await h.tabPause(8);
  assert.ok(tabRule(log));
  await h.onTabRemoved(8);
  assert.equal(state.getTab(8), undefined);
  assert.equal(tabRule(log), undefined);
  const persisted = log.storage.get('uwpo_session_state') as { tabs: Record<string, unknown> };
  assert.deepEqual(persisted.tabs, {});
});

test('session-only: state lives in session storage, survives worker restart, vanishes with the browser session', async () => {
  const a = setup();
  const c = defaultConfig(); c.allowlist = ['kept.com'];
  await a.h.setConfig(c);
  await a.h.getPlan(1, URL1);
  // Worker restart: new state object over the same session storage.
  const restarted = new BackgroundState(a.ext);
  await restarted.ready();
  assert.deepEqual(restarted.getConfig().allowlist, ['kept.com']);
  assert.equal(restarted.getTab(1)?.host, 'news.example.com');
  // Browser restart: session storage is empty, so defaults return.
  const fresh = setup();
  await fresh.state.ready();
  assert.deepEqual(fresh.state.getConfig(), defaultConfig());
  // storage.local throws if touched; none of the above threw, so it was never used.
});

test('without session storage the extension still works (memory only)', async () => {
  const { h, state } = setup({ sessionStorage: false });
  const plan = await h.getPlan(1, URL1);
  assert.equal(plan.active, true);
  assert.equal(state.getTab(1)?.host, 'news.example.com');
});

test('emergency reset and clear: resetAll restores defaults and erases stored data; clearSession keeps settings', async () => {
  const { h, state, log } = setup();
  const c = defaultConfig(); c.allowlist = ['x.com']; c.customRules = ['ads.example.com'];
  await h.setConfig(c);
  await h.getPlan(1, URL1);
  await h.tabPause(1);
  await h.clearSession();
  assert.equal(state.getTab(1), undefined);
  assert.deepEqual(state.getConfig().allowlist, ['x.com']);
  assert.equal(tabRule(log), undefined);
  await h.resetAll();
  assert.deepEqual(state.getConfig(), defaultConfig());
  assert.equal(log.sessionRules.some((r) => /ads\.example/.test(r.condition?.urlFilter ?? '')), false);
});

test('safety trip: sensitive input switches the tab to bypass until the site changes', async () => {
  const { h, log } = setup();
  await h.getPlan(2, URL1);
  await h.safetyTrip(2);
  assert.deepEqual(tabRule(log)?.condition.tabIds, [2]);
  assert.equal((await h.getPlan(2, URL1)).reason, 'sensitive-input');
  await h.getPlan(2, 'https://elsewhere.example.net/');
  assert.equal(tabRule(log), undefined);
});

test('comparison: baseline (unoptimized) then optimized run, both measured', async () => {
  const { h, log, state } = setup();
  await h.getPlan(3, URL1);
  assert.equal((await h.compareStart(3)).ok, true);
  assert.deepEqual(log.reloads.at(-1), [3, { bypassCache: true }]);
  assert.deepEqual(tabRule(log)?.condition.tabIds, [3]);

  const p1 = await h.getPlan(3, URL1);
  assert.equal(p1.active, false);
  assert.equal(p1.reason, 'compare-baseline');
  assert.equal(p1.autoSample, 'compare');
  const runId = p1.runId as string;

  await h.reportSample(3, sample({ optimizerActive: false, loadMs: { state: 'measured', value: 900 } }), 'wrong-id');
  assert.equal(state.getTab(3)?.compare?.phase, 'baseline', 'a sample with a foreign run id is ignored');

  await h.reportSample(3, sample({ optimizerActive: false, loadMs: { state: 'measured', value: 900 } }), runId);
  assert.equal(state.getTab(3)?.compare?.phase, 'optimized');
  assert.equal(tabRule(log), undefined, 'blocking is re-armed for the optimized run');
  assert.deepEqual(log.reloads.at(-1), [3, { bypassCache: true }]);

  const p2 = await h.getPlan(3, URL1);
  assert.equal(p2.active, true);
  assert.equal(p2.autoSample, 'compare');
  await h.reportSample(3, sample({ optimizerActive: true, loadMs: { state: 'measured', value: 600 } }), runId);
  const view = (await h.getState(3)).tab?.compare;
  assert.equal(view?.phase, 'done');
  assert.equal(view?.baseline?.loadMs.state === 'measured' && view.baseline.loadMs.value, 900);
  assert.equal(view?.optimized?.loadMs.state === 'measured' && view.optimized.loadMs.value, 600);
});

test('comparison refuses to run, or fails cleanly, when it would be meaningless', async () => {
  const { h, state } = setup();
  const c = defaultConfig(); c.allowlist = ['news.example.com'];
  await h.setConfig(c);
  await h.getPlan(4, URL1);
  assert.equal((await h.compareStart(4)).ok, false);

  await h.setConfig(defaultConfig());
  await h.getPlan(4, URL1);
  await h.compareStart(4);
  const runId = (await h.getPlan(4, URL1)).runId as string;
  await h.reportSample(4, sample({ optimizerActive: true }), runId);
  assert.equal(state.getTab(4)?.compare?.phase, 'failed', 'a baseline that was optimized is discarded');
  assert.equal(state.getTab(4)?.bypass, null);
});

test('blocked-request count comes only from block-rule matches and is unavailable when the browser cannot say', async () => {
  const matched = [1000, 2001, 9000, 1, 2, 100, 3002].map((ruleId) => ({ ruleId, rulesetId: 'x' }));
  const a = setup({ matched });
  await a.h.getPlan(1, URL1);
  const blocked = (await a.h.getState(1)).tab?.blockedRequests;
  assert.deepEqual(blocked && blocked.state === 'measured' ? blocked.value : blocked, 4, 'allow rules (1, 2) and the essential ruleset (9000) are not counted');
  const b = setup();
  await b.h.getPlan(1, URL1);
  assert.equal((await b.h.getState(1)).tab?.blockedRequests.state, 'unavailable');
  const c = setup({ matched: 'throw' });
  await c.h.getPlan(1, URL1);
  assert.equal((await c.h.getState(1)).tab?.blockedRequests.state, 'unavailable');
});
