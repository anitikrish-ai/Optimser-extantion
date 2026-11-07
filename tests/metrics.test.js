/**
 * Universal Website Performance Optimizer
 * Metrics Formatting & Truthfulness Test Suite
 */

import test from 'node:test';
import assert from 'node:assert/strict';

function formatMetrics(stats) {
  const loadTimeLabel = stats.loadEventMs > 0 ? `${stats.loadEventMs} ms` : 'Measuring...';
  const memoryUsageLabel = stats.jsHeapUsedMB !== null ? `${stats.jsHeapUsedMB} MB` : 'Restricted by browser API';
  const memoryStatus = stats.jsHeapUsedMB !== null ? 'measured' : 'unavailable';
  const savedKB = Math.round(stats.estimatedSavedBytes / 1024);
  const estimatedSavingsLabel = `${savedKB} KB (est.)`;

  return {
    loadTimeLabel,
    memoryUsageLabel,
    memoryStatus,
    estimatedSavingsLabel
  };
}

test('Metrics formatter explicitly marks memory as unavailable when browser denies access', () => {
  const stats = {
    loadEventMs: 420,
    jsHeapUsedMB: null,
    estimatedSavedBytes: 90000
  };

  const report = formatMetrics(stats);
  assert.equal(report.memoryStatus, 'unavailable');
  assert.equal(report.memoryUsageLabel, 'Restricted by browser API');
  assert.equal(report.loadTimeLabel, '420 ms');
  assert.equal(report.estimatedSavingsLabel, '88 KB (est.)');
});

test('Metrics formatter correctly displays measured heap memory when available', () => {
  const stats = {
    loadEventMs: 310,
    jsHeapUsedMB: 34.2,
    estimatedSavedBytes: 45000
  };

  const report = formatMetrics(stats);
  assert.equal(report.memoryStatus, 'measured');
  assert.equal(report.memoryUsageLabel, '34.2 MB');
});

