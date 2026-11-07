import test from 'node:test';
import assert from 'node:assert/strict';
import { estimated, measured, unavailable, emptyActionCounts } from '../src/shared/measure';
import { compareSamples } from '../src/metrics/compare';
import { display, formatValue } from '../src/metrics/format';
import { collectSample } from '../src/content/sampler';
import { sample } from './helpers';

test('an estimate must document its method', () => {
  assert.throws(() => estimated(5, ''));
  assert.throws(() => estimated(5, '   '));
  assert.deepEqual(estimated(5, 'median of N'), { state: 'estimated', value: 5, method: 'median of N' });
});

test('display always carries an explicit state label', () => {
  assert.equal(display(measured(1200, 'note'), 'ms').badge, 'Measured');
  assert.equal(display(estimated(2048, 'method X'), 'bytes').badge, 'Estimated');
  assert.match(display(estimated(2048, 'method X'), 'bytes').text, /^about /);
  const u = display(unavailable('not exposed'), 'ms');
  assert.deepEqual([u.badge, u.text, u.detail], ['Unavailable', 'Unavailable', 'not exposed']);
  assert.equal(formatValue(1572864, 'bytes'), '1.50 MB');
});

test('comparison only includes metrics measured in BOTH runs and explains the rest', () => {
  const before = sample({ loadMs: measured(1000), requestCount: measured(100), jsHeapUsedMB: measured(50), lcpMs: measured(800) });
  const after = sample({ loadMs: measured(700), requestCount: measured(80), jsHeapUsedMB: unavailable('n/a'), lcpMs: unavailable('late') });
  const { rows, skipped } = compareSamples(before, after);
  const load = rows.find((r) => r.key === 'loadMs');
  assert.deepEqual([load?.before, load?.after, load?.delta, load?.deltaPct], [1000, 700, -300, -30]);
  assert.ok(!rows.some((r) => r.key === 'jsHeapUsedMB' || r.key === 'lcpMs'));
  assert.ok(skipped.some((s) => s.key === 'jsHeapUsedMB' && s.reason === 'n/a'));
});

test('comparison does not invent a headline score and shows worse results honestly', () => {
  const { rows } = compareSamples(sample({ loadMs: measured(500) }), sample({ loadMs: measured(900) }));
  assert.equal(rows.find((r) => r.key === 'loadMs')?.delta, 400);
  assert.deepEqual(Object.keys(compareSamples(sample(), sample())).sort(), ['rows', 'skipped']);
  assert.equal(compareSamples(sample({ requestCount: measured(0) }), sample({ requestCount: measured(5) })).rows.find((r) => r.key === 'requestCount')?.deltaPct, null);
});

test('sampler reports unavailable (not zero) when the browser exposes nothing', async () => {
  const win = {
    performance: { getEntriesByType: () => [], timeOrigin: 1000 },
    document: { getElementsByTagName: () => ({ length: 12 }) },
    setTimeout: (f: () => void) => { f(); return 0; }
  } as unknown as Window;
  const s = await collectSample({ win, active: true, level: 'balanced', actions: emptyActionCounts(), selfTimeMs: 3.14159, selfLimited: false, waitMs: 0 });
  assert.equal(s.loadMs.state, 'unavailable');
  assert.equal(s.fcpMs.state, 'unavailable');
  assert.equal(s.lcpMs.state, 'unavailable');
  assert.equal(s.longTaskCount.state, 'unavailable');
  assert.equal(s.jsHeapUsedMB.state, 'unavailable');
  assert.deepEqual(s.domNodes, { state: 'measured', value: 12 });
  assert.equal(s.selfTimeMs.state === 'measured' && s.selfTimeMs.value, 3.1);
});

test('sampler counts hidden cross-origin sizes separately instead of treating them as zero bytes', async () => {
  const res = [
    { transferSize: 5000, encodedBodySize: 4000, decodedBodySize: 9000 },
    { transferSize: 0, encodedBodySize: 0, decodedBodySize: 0 },
    { transferSize: 0, encodedBodySize: 700, decodedBodySize: 900 }
  ];
  const win = {
    performance: { getEntriesByType: (t: string) => (t === 'resource' ? res : []), timeOrigin: 1 },
    document: { getElementsByTagName: () => ({ length: 1 }) },
    setTimeout: (f: () => void) => { f(); return 0; }
  } as unknown as Window;
  const s = await collectSample({ win, active: false, level: null, actions: emptyActionCounts(), selfTimeMs: 0, selfLimited: false, waitMs: 0 });
  const val = (m: { state: string; value?: number }) => (m.state === 'measured' ? m.value : null);
  assert.equal(val(s.requestCount), 3);
  assert.equal(val(s.transferredBytes), 5000);
  assert.equal(val(s.sizeHiddenResources), 1, 'only the resource with all-zero sizes is counted as hidden; the cached one is not');
  assert.equal(s.transferredBytes.state === 'measured' && s.transferredBytes.note?.includes('Lower bound'), true);
});
