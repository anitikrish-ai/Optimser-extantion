/**
 * Universal Website Performance Optimizer
 * Metrics Formatting & Truthfulness Test Suite
 * Tests actual StatsAggregator from src/
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { StatsAggregator } from '../src/performance-monitor/stats-aggregator.js';

test('StatsAggregator: explicitly marks memory as unavailable when browser denies access', () => {
  const stats = {
    loadEventMs: 420,
    domContentLoadedMs: 180,
    jsHeapUsedMB: null,
    totalRequests: 14,
    blockedRequests: 2,
    transferredBytes: 524288,
    estimatedSavedBytes: 90000,
    isOptimized: true,
    mode: 'balanced'
  };

  const report = StatsAggregator.formatStats(stats);
  assert.equal(report.memoryStatus, 'unavailable');
  assert.equal(report.memoryUsageLabel, 'Restricted by browser API');
  assert.equal(report.loadTimeLabel, '420 ms');
  assert.equal(report.estimatedSavingsLabel, '88 KB (est.)');
  assert.equal(report.statusBadge, 'OPTIMIZED');
});

test('StatsAggregator: correctly displays measured heap memory when available', () => {
  const stats = {
    loadEventMs: 310,
    domContentLoadedMs: 120,
    jsHeapUsedMB: 34.2,
    jsHeapTotalMB: 48.0,
    totalRequests: 20,
    blockedRequests: 4,
    transferredBytes: 1048576,
    estimatedSavedBytes: 45000,
    isOptimized: true,
    mode: 'performance'
  };

  const report = StatsAggregator.formatStats(stats);
  assert.equal(report.memoryStatus, 'measured');
  assert.equal(report.memoryUsageLabel, '34.2 MB (48 MB total)');
  assert.equal(report.modeLabel, 'PERFORMANCE');
});
