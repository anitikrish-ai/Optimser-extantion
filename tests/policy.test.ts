import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig } from '../src/shared/config';
import { findSiteKey, resolveEffective } from '../src/policy/resolve';
import type { PageContext } from '../src/policy/resolve';
import { EMPTY_SIGNALS } from '../src/adaptive/decide';
import type { Config } from '../src/shared/types';

const ctx = (over: Partial<PageContext> = {}): PageContext => ({ protocol: 'https:', hostname: 'news.example.com', pathname: '/story', hash: '', tabBypass: null, ...over });
const cfg = (f: (c: Config) => void): Config => { const c = defaultConfig(); f(c); return c; };

test('1. global settings apply when nothing overrides them', () => {
  const e = resolveEffective(cfg((c) => { c.mode = 'performance'; c.modules.videos = false; }), ctx(), null, 'start');
  assert.equal(e.active, true);
  assert.equal(e.level, 'performance');
  assert.equal(e.settings.videos.enabled, false);
  assert.equal(e.settings.images.enabled, true);
});

test('2. site override beats global; most specific site wins', () => {
  const c = cfg((c) => { c.mode = 'balanced'; c.sites = { 'example.com': { mode: 'performance' }, 'news.example.com': { mode: 'extreme', modules: { dom: false } } }; });
  assert.equal(findSiteKey(c, 'news.example.com'), 'news.example.com');
  assert.equal(findSiteKey(c, 'www.example.com'), 'example.com');
  assert.equal(findSiteKey(c, 'notexample.com'), null);
  const e = resolveEffective(c, ctx(), null, 'start');
  assert.equal(e.level, 'extreme');
  assert.equal(e.settings.dom.enabled, false);
  assert.equal(resolveEffective(c, ctx({ hostname: 'www.example.com' }), null, 'start').level, 'performance');
});

test('3. adaptive chooses a level only in adaptive mode and never enables a disabled module', () => {
  const c = cfg((c) => { c.mode = 'adaptive'; c.modules.images = false; });
  assert.equal(resolveEffective(c, ctx(), null, 'start').level, null, 'pending until signals exist');
  const heavy = { ...EMPTY_SIGNALS, cores: 2, memoryGB: 2, domNodes: 5000, resourceCount: 400, longTaskMs: 3000 };
  const e = resolveEffective(c, ctx(), heavy, 'settled');
  assert.equal(e.level, 'extreme');
  assert.equal(e.settings.images.enabled, false);
  const fixed = cfg((c) => { c.mode = 'balanced'; });
  assert.equal(resolveEffective(fixed, ctx(), heavy, 'settled').level, 'balanced', 'adaptive signals do not override a fixed mode');
});

test('4. safety overrides everything, including a site that asks for extreme', () => {
  const c = cfg((c) => { c.sites = { 'news.example.com': { mode: 'extreme' } }; c.allowlist = ['news.example.com']; });
  const e = resolveEffective(c, ctx(), null, 'start');
  assert.equal(e.active, false);
  assert.equal(e.reason, 'allowlisted');
});

test('safety reasons: master, scheme, protected host, essential path, tab bypass, sensitive input', () => {
  const base = defaultConfig();
  assert.equal(resolveEffective({ ...base, enabled: false }, ctx(), null, 'start').reason, 'master-off');
  assert.equal(resolveEffective(base, ctx({ protocol: 'file:' }), null, 'start').reason, 'unsupported-page');
  assert.equal(resolveEffective(base, ctx({ hostname: 'accounts.google.com' }), null, 'start').reason, 'builtin-protected');
  assert.equal(resolveEffective(base, ctx({ pathname: '/checkout' }), null, 'start').reason, 'essential-path');
  assert.equal(resolveEffective(base, ctx({ tabBypass: 'user' }), null, 'start').reason, 'tab-paused');
  assert.equal(resolveEffective(base, ctx({ tabBypass: 'compare' }), null, 'start').reason, 'compare-baseline');
  assert.equal(resolveEffective(base, ctx({ tabBypass: 'safety' }), null, 'start').reason, 'sensitive-input');
  assert.equal(resolveEffective(base, ctx(), null, 'start', { sensitiveInput: true }).reason, 'sensitive-input');
  assert.equal(resolveEffective(base, ctx(), null, 'start').active, true);
});

test('resolution leaves an explainable trace', () => {
  const e = resolveEffective(defaultConfig(), ctx({ pathname: '/login' }), null, 'start');
  assert.ok(e.trace[0]?.startsWith('global'));
  assert.ok(e.trace.at(-1)?.includes('safety'));
});
