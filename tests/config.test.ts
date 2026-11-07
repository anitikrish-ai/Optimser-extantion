import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig, sanitizeConfig, MAX_ALLOWLIST } from '../src/shared/config';

test('defaults are session-safe and conservative', () => {
  const c = defaultConfig();
  assert.equal(c.enabled, true);
  assert.equal(c.mode, 'adaptive');
  assert.deepEqual(c.allowlist, []);
  assert.deepEqual(c.customRules, []);
});

test('sanitizeConfig restores defaults for non-objects', () => {
  for (const raw of [null, undefined, 'x', 5, [], true]) assert.deepEqual(sanitizeConfig(raw).config, defaultConfig());
});

test('sanitizeConfig coerces wrong types and drops unknown keys', () => {
  const { config } = sanitizeConfig({ enabled: 'yes', mode: 'turbo', modules: { network: 'no', images: false }, evil: { a: 1 }, images: { lazyLoading: 1 } });
  assert.equal(config.enabled, true);
  assert.equal(config.mode, 'adaptive');
  assert.equal(config.modules.network, true);
  assert.equal(config.modules.images, false);
  assert.equal(config.images.lazyLoading, true);
  assert.equal((config as unknown as Record<string, unknown>).evil, undefined);
});

test('sanitizeConfig validates, dedupes and bounds lists', () => {
  const raw = {
    allowlist: ['A.com', 'a.com', 'bad host', 5, 'https://b.org/x'],
    customRules: ['ads.example.com', 'tracking.js', 'js.stripe.com', 'ads.example.com'],
    sites: { 'Shop.Example.com': { mode: 'extreme', modules: { images: false, bogus: true } }, 'not valid': { mode: 'extreme' }, 'x.com': { mode: 'nope' } }
  };
  const { config, issues } = sanitizeConfig(raw);
  assert.deepEqual(config.allowlist, ['a.com', 'b.org']);
  assert.deepEqual(config.customRules, ['ads.example.com']);
  assert.deepEqual(config.sites, { 'shop.example.com': { mode: 'extreme', modules: { images: false } } });
  assert.ok(issues.length >= 3);

  const huge = sanitizeConfig({ allowlist: Array.from({ length: MAX_ALLOWLIST + 50 }, (_, i) => `h${i}.com`) });
  assert.equal(huge.config.allowlist.length, MAX_ALLOWLIST);
});

test('sanitizeConfig is immune to prototype pollution payloads', () => {
  const payload = JSON.parse('{"__proto__":{"polluted":true},"sites":{"__proto__":{"mode":"extreme"},"constructor":{"mode":"extreme"}}}');
  const { config } = sanitizeConfig(payload);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(config.sites, '__proto__'), false);
  assert.equal(Object.keys(config.sites).includes('constructor'), true, 'a legal hostname label is kept as a plain key');
});
