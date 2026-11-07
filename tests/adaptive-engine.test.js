/**
 * Universal Website Performance Optimizer
 * Adaptive Engine & Profile Evaluator Test Suite
 */

import test from 'node:test';
import assert from 'node:assert/strict';

function evaluateEffectiveMode(userMode, autoAdaptive, isLowEnd, domNodeCount) {
  if (autoAdaptive || userMode === 'adaptive_custom') {
    if (isLowEnd || domNodeCount > 3000) {
      return 'extreme';
    } else if (domNodeCount > 1500) {
      return 'performance';
    } else {
      return 'balanced';
    }
  }
  return userMode;
}

test('Adaptive engine escalates to Extreme Lite mode when device is low-end', () => {
  const mode = evaluateEffectiveMode('balanced', true, true, 800);
  assert.equal(mode, 'extreme');
});

test('Adaptive engine escalates to Extreme Lite mode when DOM node count exceeds threshold', () => {
  const mode = evaluateEffectiveMode('balanced', true, false, 4500);
  assert.equal(mode, 'extreme');
});

test('Adaptive engine stays Balanced on high-end device with lightweight DOM', () => {
  const mode = evaluateEffectiveMode('balanced', true, false, 400);
  assert.equal(mode, 'balanced');
});

test('Manual mode overrides auto adaptive when autoAdaptive is false', () => {
  const mode = evaluateEffectiveMode('performance', false, true, 5000);
  assert.equal(mode, 'performance');
});

