import test from 'node:test';
import assert from 'node:assert/strict';
import { Ext } from '../src/adapters/ext';
import { fakeApi } from './helpers';

test('detect prefers the promise-based browser namespace, then chrome, then null', () => {
  const b = { runtime: { id: 'b' } }, c = { runtime: { id: 'c' } };
  assert.equal(Ext.detect({ browser: b, chrome: c })?.runtimeId, 'b');
  assert.equal(Ext.detect({ chrome: c })?.runtimeId, 'c');
  assert.equal(Ext.detect({}), null);
  assert.equal(Ext.detect({ chrome: {} }), null);
});

test('capabilities come from feature detection, not user agent', () => {
  const full = fakeApi({ matched: [] }).ext.caps;
  assert.deepEqual(full, { dnr: true, dnrSessionRules: true, dnrRulesetToggle: true, dnrMatchedRules: true, dnrBadgeCount: false, sessionStorage: true });
  const none = fakeApi({ dnr: false, sessionStorage: false }).ext.caps;
  assert.deepEqual(none, { dnr: false, dnrSessionRules: false, dnrRulesetToggle: false, dnrMatchedRules: false, dnrBadgeCount: false, sessionStorage: false });
});

test('calls never throw when the underlying API fails or is missing', async () => {
  const api = { runtime: { id: 'x', sendMessage: async () => { throw new Error('no receiver'); } }, tabs: { query: async () => { throw new Error('boom'); }, sendMessage: async () => { throw new Error('x'); }, reload: async () => { throw new Error('x'); } } };
  const ext = new Ext(api);
  assert.equal(await ext.sendMessage({}), undefined);
  assert.equal(await ext.sendTabMessage(1, {}), undefined);
  assert.deepEqual(await ext.listTabIds(), []);
  assert.equal(await ext.activeTabId(), null);
  assert.equal(await ext.reloadTab(1, false), false);
  assert.equal(await ext.storageGet('k'), undefined);
  await ext.storageSet('k', 1);
  await ext.storageClear();
  assert.deepEqual(await ext.getEnabledRulesets(), []);
  assert.equal(await ext.getMatchedRules(1), null);
});

test('getMatchedRules degrades to null on quota errors and when unsupported', async () => {
  assert.equal(await fakeApi({ matched: 'throw' }).ext.getMatchedRules(1), null);
  assert.equal(await fakeApi().ext.getMatchedRules(1), null);
  const rules = await fakeApi({ matched: [{ ruleId: 1000, rulesetId: 'replay' }] }).ext.getMatchedRules(1);
  assert.deepEqual(rules, [{ ruleId: 1000, rulesetId: 'replay' }]);
});

test('session storage helper uses storage.session and never storage.local', async () => {
  const { ext, log } = fakeApi();
  await ext.storageSet('k', { a: 1 });
  assert.deepEqual(await ext.storageGet('k'), { a: 1 });
  await ext.storageClear();
  assert.equal(log.storage.size, 0);
});
