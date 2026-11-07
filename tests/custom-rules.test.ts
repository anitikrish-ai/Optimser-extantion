import test from 'node:test';
import assert from 'node:assert/strict';
import { compileCustomRules, MAX_CUSTOM_RULES, toUrlFilter, validateCustomRule } from '../src/safety/custom-rules';
import { RULE_ID_BASE, RULE_PRIORITY } from '../src/shared/tracker-list';

const ok = (s: string) => { const v = validateCustomRule(s); assert.equal(v.ok, true, `${s}: ${v.ok ? '' : v.error}`); return v.ok ? v.normalized : ''; };
const bad = (s: unknown) => assert.equal(validateCustomRule(s).ok, false, `should reject ${String(s)}`);

test('valid custom rules normalize to host[/path]', () => {
  assert.equal(ok('AdService.Example.com'), 'adservice.example.com');
  assert.equal(ok('||tracker.example.com'), 'tracker.example.com');
  assert.equal(ok('cdn.example.com/widgets/*'), 'cdn.example.com/widgets/*');
});

test('malformed and over-broad rules are rejected', () => {
  for (const s of [
    '', '   ', '*', '||*', '.js', 'tracking-script.js', 'ad', 'com', '.com', 'co.uk', 'example',
    'https://example.com/x', 'exa mple.com', '*.example.com', '1.2.3.4', '[::1]', 'example.com/', 'example.com/***',
    'example.com/<script>', 'x'.repeat(201) + '.com', '(a+)+$', '^.*$', 'example.c', 'example.123', null, 42, {}, ['a.com']
  ]) bad(s);
});

test('rules that target authentication, payment or CAPTCHA providers are refused', () => {
  bad('js.stripe.com');
  bad('www.paypal.com');
  bad('challenges.cloudflare.com');
  bad('www.google.com/recaptcha/api.js');
  ok('www.google.com/ads/*');
});

test('regex-like input cannot cause pathological work', () => {
  const t0 = performance.now();
  for (let i = 0; i < 200; i++) validateCustomRule('a'.repeat(190) + '!!!!!!!!!!!!!!!!!!!!');
  assert.ok(performance.now() - t0 < 500, 'validation must be linear-time');
});

test('compileCustomRules emits blocking session rules below the essential-allow priority', () => {
  const rules = compileCustomRules(['ads.example.com', 'ads.example.com', 'bad rule', 'cdn.example.com/x*']);
  assert.equal(rules.length, 2, 'duplicates and invalid entries are dropped');
  assert.equal(rules[0]?.id, RULE_ID_BASE.sessionCustomBase);
  assert.equal(rules[0]?.condition.urlFilter, '||ads.example.com^');
  assert.equal(rules[1]?.condition.urlFilter, '||cdn.example.com/x*');
  assert.ok(rules.every((r) => r.priority === RULE_PRIORITY.customBlock && r.priority < RULE_PRIORITY.essentialAllow));
  assert.ok(rules.every((r) => !r.condition.resourceTypes?.includes('main_frame')), 'never blocks page navigations');
  assert.equal(toUrlFilter('a.example.com'), '||a.example.com^');
});

test('custom rule count is capped', () => {
  const many = Array.from({ length: MAX_CUSTOM_RULES + 20 }, (_, i) => `h${i}.example.com`);
  assert.equal(compileCustomRules(many).length, MAX_CUSTOM_RULES);
});
