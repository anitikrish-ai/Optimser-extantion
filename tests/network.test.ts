import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNetworkPlan } from '../src/adapters/network-plan';
import { NetworkApplier } from '../src/adapters/network-applier';
import { defaultConfig } from '../src/shared/config';
import { RULE_ID_BASE, RULE_PRIORITY } from '../src/shared/tracker-list';
import { fakeApi } from './helpers';

test('master off or network module off: no rulesets and no user rules', () => {
  const c = defaultConfig();
  c.enabled = false;
  assert.deepEqual(buildNetworkPlan(c, []), { enableRulesets: [], userRules: [] });
  const d = defaultConfig();
  d.modules.network = false;
  d.customRules = ['ads.example.com'];
  assert.deepEqual(buildNetworkPlan(d, [1]), { enableRulesets: [], userRules: [] });
});

test('category toggles map to bundled rulesets; essential ruleset accompanies any blocking', () => {
  const c = defaultConfig();
  c.network.blockAds = false;
  c.network.blockAnalytics = false;
  assert.deepEqual(buildNetworkPlan(c, []).enableRulesets, ['replay', 'essential']);
  c.network.blockSessionReplay = false;
  assert.deepEqual(buildNetworkPlan(c, []).enableRulesets, []);
});

test('allowlisted sites and sites with network off become exempt initiators', () => {
  const c = defaultConfig();
  c.allowlist = ['mybank.com'];
  c.sites = { 'shop.example.com': { modules: { network: false } }, 'other.com': { modules: { images: false } } };
  const rule = buildNetworkPlan(c, []).userRules.find((r) => r.id === RULE_ID_BASE.sessionAllowSites);
  assert.ok(rule);
  const init = rule.condition.initiatorDomains ?? [];
  assert.ok(init.includes('mybank.com') && init.includes('shop.example.com') && init.includes('localhost'));
  assert.ok(!init.includes('other.com'));
  assert.ok(!init.includes('google.com'), 'a path-scoped essential entry must not exempt a whole domain');
  assert.equal(rule.priority, RULE_PRIORITY.userAllow);
});

test('tab bypass creates a tab-scoped allow rule at the highest priority', () => {
  const plan = buildNetworkPlan(defaultConfig(), [7, 7, 9, -1, 1.5]);
  const rule = plan.userRules.find((r) => r.id === RULE_ID_BASE.sessionAllowTabs);
  assert.deepEqual(rule?.condition.tabIds, [7, 9]);
  assert.equal(rule?.priority, RULE_PRIORITY.userAllow);
});

test('priority ladder keeps safety above user rules above bundled blocks', () => {
  assert.ok(RULE_PRIORITY.userAllow > RULE_PRIORITY.essentialAllow);
  assert.ok(RULE_PRIORITY.essentialAllow > RULE_PRIORITY.customBlock);
  assert.ok(RULE_PRIORITY.customBlock > RULE_PRIORITY.bundledBlock);
});

test('applier toggles bundled rulesets by diff and replaces session rules', async () => {
  const { ext, log } = fakeApi();
  const applier = new NetworkApplier(ext);
  const c = defaultConfig();
  c.network.blockAds = false;
  c.customRules = ['ads.example.com'];
  const r = await applier.apply(buildNetworkPlan(c, []));
  assert.equal(r.ok, true);
  assert.deepEqual([...log.enabled].sort(), ['analytics', 'essential', 'replay']);
  assert.ok(log.sessionRules.some((x) => x.condition.urlFilter === '||ads.example.com^'));
  // Re-applying the same plan must not fail on duplicate ids and must not touch rulesets again.
  const calls = log.rulesetCalls;
  assert.equal((await applier.apply(buildNetworkPlan(c, []))).ok, true);
  assert.equal(log.rulesetCalls, calls);
});

test('turning the master switch off removes every user rule and disables all bundled rulesets', async () => {
  const { ext, log } = fakeApi();
  const applier = new NetworkApplier(ext);
  const c = defaultConfig();
  c.customRules = ['ads.example.com'];
  await applier.apply(buildNetworkPlan(c, [4]));
  assert.ok(log.sessionRules.length > 0);
  c.enabled = false;
  await applier.apply(buildNetworkPlan(c, [4]));
  assert.equal(log.enabled.size, 0);
  assert.equal(log.sessionRules.length, 0);
});

test('overlapping applies are serialized and end in the last requested state', async () => {
  const { ext, log } = fakeApi();
  const applier = new NetworkApplier(ext);
  const a = defaultConfig(); a.customRules = ['one.example.com'];
  const b = defaultConfig(); b.customRules = ['two.example.com'];
  await Promise.all([applier.apply(buildNetworkPlan(a, [])), applier.apply(buildNetworkPlan(b, []))]);
  assert.ok(log.sessionRules.some((r) => r.condition.urlFilter === '||two.example.com^'));
  assert.ok(!log.sessionRules.some((r) => r.condition.urlFilter === '||one.example.com^'));
});

test('browser without declarativeNetRequest: reported honestly, nothing thrown', async () => {
  const { ext } = fakeApi({ dnr: false });
  const r = await new NetworkApplier(ext).apply(buildNetworkPlan(defaultConfig(), []));
  assert.equal(r.ok, false);
  assert.match(r.warnings[0] ?? '', /not available/);
});

test('browser without session rules falls back to dynamic rules and says so', async () => {
  const { ext, log } = fakeApi({ sessionRules: false });
  const c = defaultConfig(); c.customRules = ['ads.example.com'];
  const r = await new NetworkApplier(ext).apply(buildNetworkPlan(c, []));
  assert.ok(log.dynamicRules.length > 0);
  assert.ok(r.warnings.some((w) => /dynamic/.test(w)));
});
