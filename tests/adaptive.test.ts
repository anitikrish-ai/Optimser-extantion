import test from 'node:test';
import assert from 'node:assert/strict';
import { decideLevel, EMPTY_SIGNALS, maxLevel, THRESHOLDS } from '../src/adaptive/decide';
import type { Signals } from '../src/adaptive/decide';

const s = (p: Partial<Signals>): Signals => ({ ...EMPTY_SIGNALS, ...p });

test('no signals available: balanced, nothing is guessed', () => {
  const d = decideLevel(EMPTY_SIGNALS, 'settled');
  assert.equal(d.level, 'balanced');
  assert.equal(d.pressure, 0);
  assert.ok(d.unavailable.includes('memory') && d.unavailable.includes('cores') && d.unavailable.includes('longTasks'));
});

test('a strong device on a light page stays balanced', () => {
  const d = decideLevel(s({ cores: 8, memoryGB: 8, effectiveType: '4g', saveData: false, domNodes: 400, resourceCount: 40, longTaskMs: 50 }), 'settled');
  assert.equal(d.level, 'balanced');
});

test('weak device and network raise the level to performance but not extreme at start', () => {
  const d = decideLevel(s({ cores: 2, memoryGB: 2, effectiveType: '2g', saveData: true }), 'start');
  assert.ok(d.pressure >= THRESHOLDS.extremeAt);
  assert.equal(d.level, 'performance', 'extreme needs page evidence');
});

test('page evidence can reach extreme', () => {
  const d = decideLevel(s({ cores: 2, memoryGB: 2, domNodes: 4000, resourceCount: 300, longTaskMs: 2000 }), 'settled');
  assert.equal(d.level, 'extreme');
  assert.ok(d.contributions.every((c) => c.why.length > 0), 'every contribution is explainable');
});

test('page signals are ignored in the start phase', () => {
  assert.equal(decideLevel(s({ domNodes: 99999, resourceCount: 999, longTaskMs: 9999 }), 'start').level, 'balanced');
});

test('thresholds are inclusive/exclusive exactly as documented', () => {
  assert.equal(decideLevel(s({ domNodes: THRESHOLDS.domModerate }), 'settled').pressure, 0);
  assert.equal(decideLevel(s({ domNodes: THRESHOLDS.domModerate + 1 }), 'settled').pressure, 1);
  assert.equal(decideLevel(s({ cores: THRESHOLDS.coresModerate }), 'start').pressure, 1);
  assert.equal(decideLevel(s({ cores: THRESHOLDS.coresLow }), 'start').pressure, 2);
});

test('maxLevel is monotonic', () => {
  assert.equal(maxLevel('performance', 'balanced'), 'performance');
  assert.equal(maxLevel('balanced', 'extreme'), 'extreme');
  assert.equal(maxLevel('extreme', 'extreme'), 'extreme');
});
