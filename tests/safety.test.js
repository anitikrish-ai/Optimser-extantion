/**
 * Universal Website Performance Optimizer
 * Safety & Allowlist Test Suite (Node.js Test Runner)
 * Tests the actual SafetyManager implementation from src/
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { safetyManager } from '../src/safety/safety-manager.js';

test('SafetyManager: allowlist accurately identifies exact domains and subdomains', () => {
  const allowlist = ['mybank.com', 'localhost', 'accounts.google.com', 'https://secure.pay.net:8080/path'];

  assert.equal(safetyManager.isDomainAllowlisted('mybank.com', allowlist), true);
  assert.equal(safetyManager.isDomainAllowlisted('online.mybank.com', allowlist), true);
  assert.equal(safetyManager.isDomainAllowlisted('localhost', allowlist), true);
  assert.equal(safetyManager.isDomainAllowlisted('accounts.google.com', allowlist), true);
  assert.equal(safetyManager.isDomainAllowlisted('secure.pay.net', allowlist), true);

  // Loose matches must never pass
  assert.equal(safetyManager.isDomainAllowlisted('notmybank.com', allowlist), false);
  assert.equal(safetyManager.isDomainAllowlisted('othergoogle.com', allowlist), false);
  assert.equal(safetyManager.isDomainAllowlisted('randomblog.org', allowlist), false);
});

test('SafetyManager: essential flow detector matches authentication and checkout paths', () => {
  assert.equal(safetyManager.isEssentialFlow('https://shop.example.com/checkout/step2'), true);
  assert.equal(safetyManager.isEssentialFlow('https://portal.example.com/login?redirect=dashboard'), true);
  assert.equal(safetyManager.isEssentialFlow('https://sso.company.com/oauth/authorize'), true);
  assert.equal(safetyManager.isEssentialFlow('https://app.example.com/user/billing'), true);
  assert.equal(safetyManager.isEssentialFlow('https://news.example.com/articles/2026/tech-review'), false);
});

test('SafetyManager: essential script detector protects CAPTCHA, authentication, and payment providers', () => {
  assert.equal(safetyManager.isEssentialScript('https://challenges.cloudflare.com/turnstile/v0/api.js'), true);
  assert.equal(safetyManager.isEssentialScript('https://www.google.com/recaptcha/api.js'), true);
  assert.equal(safetyManager.isEssentialScript('https://js.stripe.com/v3/'), true);
  assert.equal(safetyManager.isEssentialScript('https://www.paypal.com/sdk/js?client-id=test'), true);
  assert.equal(safetyManager.isEssentialScript('https://cdn.auth0.com/js/auth0-spa-js/2.0/auth0-spa-js.production.js'), true);

  // Bloatware must return false
  assert.equal(safetyManager.isEssentialScript('https://static.hotjar.com/c/hotjar-123.js'), false);
  assert.equal(safetyManager.isEssentialScript('https://fullstory.com/s/fs.js'), false);
});
