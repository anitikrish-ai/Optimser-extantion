/**
 * Universal Website Performance Optimizer
 * Bloatware & Tracker Rule Pattern Matching Tests
 * Tests actual BLOATWARE_SCRIPT_PATTERNS from src/
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOATWARE_SCRIPT_PATTERNS } from '../src/shared/constants.js';

function isBloatware(url) {
  return BLOATWARE_SCRIPT_PATTERNS.some((pattern) => pattern.test(url));
}

test('Rule patterns successfully detect heavy session replay scripts', () => {
  assert.equal(isBloatware('https://static.hotjar.com/c/hotjar-123456.js?sv=6'), true);
  assert.equal(isBloatware('https://edge.fullstory.com/s/fs.js'), true);
  assert.equal(isBloatware('https://script.crazyegg.com/pages/scripts/0012/3456.js'), true);
  assert.equal(isBloatware('https://cdn.mouseflow.com/projects/a1b2c3d4.js'), true);
  assert.equal(isBloatware('https://www.clarity.ms/tag/abc123xyz'), true);
});

test('Rule patterns successfully detect heavy ad telemetry & tracking pixels', () => {
  assert.equal(isBloatware('https://connect.facebook.net/en_US/fbevents.js'), true);
  assert.equal(isBloatware('https://analytics.tiktok.com/i18n/pixel/events.js'), true);
  assert.equal(isBloatware('https://static.criteo.net/js/ld/ld.js'), true);
  assert.equal(isBloatware('https://widgets.outbrain.com/outbrain.js'), true);
});

test('Legitimate scripts are never matched by bloatware patterns', () => {
  assert.equal(isBloatware('https://cdn.jsdelivr.net/npm/vue@3.4.21/dist/vue.global.prod.js'), false);
  assert.equal(isBloatware('https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js'), false);
  assert.equal(isBloatware('https://app.mysite.com/assets/index-D7b39.js'), false);
});
