/**
 * Universal Website Performance Optimizer
 * Safety & Allowlist Test Suite (Node.js Test Runner)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

const ESSENTIAL_PATH_PATTERNS = [
  /\/login/i, /\/signin/i, /\/signup/i, /\/auth/i, /\/oauth/i, /\/sso/i,
  /\/2fa/i, /\/mfa/i, /\/checkout/i, /\/cart/i, /\/payment/i, /\/billing/i, /\/pay\//i
];

const ESSENTIAL_SCRIPT_PATTERNS = [
  /recaptcha/i, /turnstile/i, /hcaptcha/i, /stripe\.com/i,
  /paypal\.com/i, /braintree/i, /checkout/i, /auth0/i
];

function isDomainAllowlisted(hostname, allowlist) {
  if (!hostname || !allowlist) return false;
  const cleanHost = hostname.toLowerCase().trim();
  return allowlist.some(item => {
    const cleanItem = item.toLowerCase().trim();
    return cleanHost === cleanItem || cleanHost.endsWith('.' + cleanItem) || cleanHost === 'localhost' || cleanHost === '127.0.0.1';
  });
}

function isEssentialFlow(url) {
  return ESSENTIAL_PATH_PATTERNS.some(p => p.test(url));
}

function isEssentialScript(src) {
  return ESSENTIAL_SCRIPT_PATTERNS.some(p => p.test(src));
}

test('Allowlist accurately identifies exact domains and subdomains', () => {
  const allowlist = ['mybank.com', 'localhost', 'accounts.google.com'];

  assert.equal(isDomainAllowlisted('mybank.com', allowlist), true);
  assert.equal(isDomainAllowlisted('online.mybank.com', allowlist), true);
  assert.equal(isDomainAllowlisted('localhost', allowlist), true);
  assert.equal(isDomainAllowlisted('accounts.google.com', allowlist), true);
  assert.equal(isDomainAllowlisted('othergoogle.com', allowlist), false);
  assert.equal(isDomainAllowlisted('randomblog.org', allowlist), false);
});

test('Essential flow detector correctly matches authentication and checkout paths', () => {
  assert.equal(isEssentialFlow('https://shop.example.com/checkout/step2'), true);
  assert.equal(isEssentialFlow('https://portal.example.com/login?redirect=dashboard'), true);
  assert.equal(isEssentialFlow('https://sso.company.com/oauth/authorize'), true);
  assert.equal(isEssentialFlow('https://app.example.com/user/billing'), true);
  assert.equal(isEssentialFlow('https://news.example.com/articles/2026/tech-review'), false);
});

test('Essential script detector never flags authentication, CAPTCHA, or payment providers', () => {
  assert.equal(isEssentialScript('https://challenges.cloudflare.com/turnstile/v0/api.js'), true);
  assert.equal(isEssentialScript('https://www.google.com/recaptcha/api.js'), true);
  assert.equal(isEssentialScript('https://js.stripe.com/v3/'), true);
  assert.equal(isEssentialScript('https://www.paypal.com/sdk/js?client-id=test'), true);
  assert.equal(isEssentialScript('https://cdn.auth0.com/js/auth0-spa-js/2.0/auth0-spa-js.production.js'), true);

  // Trackers must return false
  assert.equal(isEssentialScript('https://static.hotjar.com/c/hotjar-123.js'), false);
  assert.equal(isEssentialScript('https://fullstory.com/s/fs.js'), false);
});

