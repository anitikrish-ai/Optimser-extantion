import test from 'node:test';
import assert from 'node:assert/strict';
import { hostMatches, isAllowlisted, isBuiltinProtectedHost, isEssentialPath, normalizeHostname, touchesEssentialTarget } from '../src/safety/safety';

test('normalizeHostname accepts hosts and URLs, lowercases, strips ports and paths', () => {
  assert.equal(normalizeHostname('Example.COM'), 'example.com');
  assert.equal(normalizeHostname('https://secure.pay.net:8080/path?x=1'), 'secure.pay.net');
  assert.equal(normalizeHostname('*.example.com'), 'example.com');
  assert.equal(normalizeHostname('localhost:3000'), 'localhost');
  assert.equal(normalizeHostname('example.com.'), 'example.com');
  assert.equal(normalizeHostname('[::1]'), '[::1]');
});

test('normalizeHostname rejects malformed or dangerous input', () => {
  for (const bad of ['', '   ', 'javascript:alert(1)', 'data:text/html,x', 'exa mple.com', 'a'.repeat(300) + '.com', 'http://', '<script>', 'a..b', '-bad.com', 42, null, undefined, {}]) {
    assert.equal(normalizeHostname(bad as unknown), null, `should reject ${String(bad)}`);
  }
});

test('allowlist matches exact domains and subdomains on label boundaries only', () => {
  const list = ['mybank.com', 'https://secure.pay.net:8080/p'];
  assert.equal(isAllowlisted('mybank.com', list), true);
  assert.equal(isAllowlisted('online.mybank.com', list), true);
  assert.equal(isAllowlisted('secure.pay.net', list), true);
  assert.equal(isAllowlisted('notmybank.com', list), false);
  assert.equal(isAllowlisted('mybank.com.evil.io', list), false);
  assert.equal(isAllowlisted('pay.net', list), false);
  assert.equal(isAllowlisted('x.com', []), false);
  assert.equal(isAllowlisted('x.com', ['', 'bad host', null as unknown as string]), false);
  assert.equal(hostMatches('a.b.c', 'b.c'), true);
  assert.equal(hostMatches('ab.c', 'b.c'), false);
});

test('built-in protection covers identity, payment, CAPTCHA and local hosts', () => {
  for (const h of ['accounts.google.com', 'js.stripe.com', 'www.paypal.com', 'challenges.cloudflare.com', 'localhost', '127.0.0.1', 'app.localhost', 'tenant.auth0.com']) {
    assert.equal(isBuiltinProtectedHost(h), true, h);
  }
  for (const h of ['example.com', 'news.google.com', 'stripe.com.evil.io', 'notpaypal.com']) {
    assert.equal(isBuiltinProtectedHost(h), false, h);
  }
});

test('essential path detection matches whole segments only', () => {
  for (const p of ['/login', '/user/billing', '/checkout/step2', '/oauth/authorize', '/a/Sign-In/', '/cart', '/account/2fa']) {
    assert.equal(isEssentialPath(p), true, p);
  }
  for (const p of ['/author/jane', '/authors', '/cartoon/1', '/articles/2026/tech-review', '/payments-history-report', '/', '']) {
    assert.equal(isEssentialPath(p), false, p);
  }
  assert.equal(isEssentialPath('/', '#/login'), true);
  assert.equal(isEssentialPath('/', '#section-2'), false);
  assert.equal(isEssentialPath('/%6Cogin'), true, 'percent-encoded segment is decoded');
});

test('essential targets: authentication, payment and CAPTCHA providers are detected', () => {
  assert.equal(touchesEssentialTarget('js.stripe.com', '/v3/'), true);
  assert.equal(touchesEssentialTarget('www.google.com', '/recaptcha/api.js'), true);
  assert.equal(touchesEssentialTarget('www.google.com', '/search'), false);
  assert.equal(touchesEssentialTarget('hotjar.com', ''), false);
});
