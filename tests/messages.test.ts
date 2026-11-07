import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySender, isAuthorized, parseRequest, sanitizeSample } from '../src/shared/messages';
import { emptyActionCounts } from '../src/shared/measure';
import { sample } from './helpers';

const BASE = 'chrome-extension://ext-id/';
test('sender classification: only our own extension contexts are trusted', () => {
  assert.equal(classifySender({ id: 'ext-id', url: BASE + 'popup/index.html' }, 'ext-id', BASE), 'extension-page');
  assert.equal(classifySender({ id: 'ext-id', url: 'https://site.com/', tab: { id: 3 }, frameId: 0 }, 'ext-id', BASE), 'content');
  assert.equal(classifySender({ id: 'ext-id', url: 'https://site.com/', tab: { id: 3 }, frameId: 2 }, 'ext-id', BASE), 'unknown', 'subframes are not trusted');
  assert.equal(classifySender({ id: 'other', url: BASE + 'x' }, 'ext-id', BASE), 'unknown');
  assert.equal(classifySender({ url: BASE + 'x' }, 'ext-id', BASE), 'unknown');
  assert.equal(classifySender(undefined, 'ext-id', BASE), 'unknown');
  assert.equal(classifySender({ id: 'ext-id', url: 'https://evil.com/' + BASE }, 'ext-id', BASE), 'unknown');
});

test('content scripts may not change configuration or tab state', () => {
  for (const t of ['SET_CONFIG', 'TAB_PAUSE', 'TAB_RESUME', 'COMPARE_START', 'COMPARE_CANCEL', 'REQUEST_SAMPLE', 'CLEAR_SESSION', 'RESET_ALL', 'GET_STATE'] as const) {
    assert.equal(isAuthorized(t, 'content'), false, t);
    assert.equal(isAuthorized(t, 'extension-page'), true, t);
    assert.equal(isAuthorized(t, 'unknown'), false, t);
  }
  for (const t of ['GET_PLAN', 'REPORT_SAMPLE', 'SAFETY_TRIP'] as const) assert.equal(isAuthorized(t, 'content'), true, t);
});

test('parseRequest rejects malformed messages', () => {
  for (const bad of [null, undefined, 5, 'GET_PLAN', [], {}, { type: 5 }, { type: 'NOPE' }, { type: 'TAB_PAUSE' }, { type: 'TAB_PAUSE', tabId: -1 }, { type: 'TAB_PAUSE', tabId: '1' }, { type: 'TAB_PAUSE', tabId: 1.5 }, { type: 'SAFETY_TRIP', reason: 'x' }, { type: 'REPORT_SAMPLE', sample: {} }]) {
    assert.equal(parseRequest(bad), null, JSON.stringify(bad));
  }
  assert.deepEqual(parseRequest({ type: 'TAB_PAUSE', tabId: 4, extra: 1 }), { type: 'TAB_PAUSE', tabId: 4 });
  assert.deepEqual(parseRequest({ type: 'GET_STATE', tabId: 'x' }), { type: 'GET_STATE', tabId: null, skipBlocked: false });
});

test('sample validation accepts real samples and rejects fabricated or malformed ones', () => {
  assert.ok(sanitizeSample(sample()));
  assert.equal(sanitizeSample({ ...sample(), loadMs: { state: 'measured', value: NaN } }), null);
  assert.equal(sanitizeSample({ ...sample(), loadMs: { state: 'measured', value: 'fast' } }), null);
  assert.equal(sanitizeSample({ ...sample(), loadMs: { state: 'estimated', value: 5 } }), null, 'an estimate without a method is rejected');
  assert.equal(sanitizeSample({ ...sample(), loadMs: 30 }), null, 'bare numbers are rejected');
  assert.equal(sanitizeSample({ ...sample(), actions: { ...emptyActionCounts(), imagesLazy: -1 } }), null);
  const long = sanitizeSample({ ...sample(), loadMs: { state: 'unavailable', reason: 'x'.repeat(5000) } });
  assert.equal(long?.loadMs.state === 'unavailable' && long.loadMs.reason.length, 200);
});
