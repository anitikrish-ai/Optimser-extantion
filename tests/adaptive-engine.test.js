/**
 * Universal Website Performance Optimizer
 * Adaptive Engine & Profile Evaluator Test Suite
 * Tests actual ProfileEvaluator implementation from src/
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { ProfileEvaluator } from '../src/adaptive-engine/profile-evaluator.js';
import { DEFAULT_CONFIG } from '../src/shared/constants.js';

test('Adaptive engine escalates to Extreme Lite mode when device is low-end', () => {
  const config = { ...DEFAULT_CONFIG, mode: 'balanced', autoAdaptive: true };
  const device = { isLowEndDevice: true, networkType: '4g' };
  const workload = { domNodeCount: 800, longTasksCount: 0 };

  const plan = ProfileEvaluator.evaluatePlan(config, device, workload);
  assert.equal(plan.mode, 'extreme');
  assert.equal(plan.shouldDisableBackdropBlur, true);
});

test('Adaptive engine escalates to Extreme Lite mode when DOM node count exceeds 3000', () => {
  const config = { ...DEFAULT_CONFIG, mode: 'balanced', autoAdaptive: true };
  const device = { isLowEndDevice: false, networkType: '4g' };
  const workload = { domNodeCount: 4500, longTasksCount: 0 };

  const plan = ProfileEvaluator.evaluatePlan(config, device, workload);
  assert.equal(plan.mode, 'extreme');
});

test('Adaptive engine stays Balanced on high-end device with lightweight DOM', () => {
  const config = { ...DEFAULT_CONFIG, mode: 'balanced', autoAdaptive: true };
  const device = { isLowEndDevice: false, networkType: '4g' };
  const workload = { domNodeCount: 400, longTasksCount: 0 };

  const plan = ProfileEvaluator.evaluatePlan(config, device, workload);
  assert.equal(plan.mode, 'balanced');
  assert.equal(plan.shouldDisableBackdropBlur, false); // Preserved in Balanced!
  assert.equal(plan.shouldDisableExpensiveFilters, false); // Preserved in Balanced!
});

test('Manual mode overrides auto adaptive when autoAdaptive is false', () => {
  const config = { ...DEFAULT_CONFIG, mode: 'performance', autoAdaptive: false };
  const device = { isLowEndDevice: true, networkType: '2g' };
  const workload = { domNodeCount: 5000, longTasksCount: 10 };

  const plan = ProfileEvaluator.evaluatePlan(config, device, workload);
  assert.equal(plan.mode, 'performance');
});
