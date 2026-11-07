import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig } from '../src/shared/config';
import { hasSiteOverride, resetSite, setMode, setModule, toggleAllowlist } from '../src/policy/edit';

test('scope "all" edits the global config; scope "site" creates an override and leaves global alone', () => {
  const base = defaultConfig();
  const g = setMode(base, 'all', 'a.com', 'extreme');
  assert.equal(g.mode, 'extreme');
  assert.deepEqual(g.sites, {});
  const s = setMode(base, 'site', 'a.com', 'extreme');
  assert.equal(s.mode, 'adaptive');
  assert.deepEqual(s.sites, { 'a.com': { mode: 'extreme' } });
  const m = setModule(s, 'site', 'a.com', 'images', false);
  assert.deepEqual(m.sites['a.com'], { mode: 'extreme', modules: { images: false } });
  assert.equal(m.modules.images, true);
  assert.equal(setModule(base, 'all', null, 'dom', false).modules.dom, false);
});

test('edits never mutate their input, and resetSite removes the override', () => {
  const base = defaultConfig();
  const snapshot = JSON.stringify(base);
  const edited = setModule(base, 'site', 'a.com', 'videos', false);
  assert.equal(JSON.stringify(base), snapshot);
  assert.equal(hasSiteOverride(edited, 'a.com'), true);
  assert.equal(hasSiteOverride(resetSite(edited, 'a.com'), 'a.com'), false);
  assert.equal(hasSiteOverride(base, 'constructor'), false, 'inherited properties are not overrides');
});

test('toggleAllowlist normalizes, adds and removes', () => {
  let c = toggleAllowlist(defaultConfig(), 'https://WWW.Bank.com:8443/x');
  assert.deepEqual(c.allowlist, ['www.bank.com']);
  c = toggleAllowlist(c, 'www.bank.com');
  assert.deepEqual(c.allowlist, []);
  assert.deepEqual(toggleAllowlist(defaultConfig(), 'not a host').allowlist, []);
});
