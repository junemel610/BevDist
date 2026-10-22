import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// Load the pure ES module without changing the Expo package module mode.
const source = await readFile(new URL('../src/components/dashboard/chartGeometry.js', import.meta.url), 'utf8');
const { chartGeometry } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('empty and zero sales do not create invalid coordinates', () => {
  assert.deepEqual(chartGeometry([]).points, []);
  const chart = chartGeometry([0, 0, 0]);
  assert.ok(chart.ceiling > 0);
  assert.ok(chart.points.every(point => Number.isFinite(point.x) && point.y === chart.bottom));
});
test('sales stay inside chart bounds and taller values plot higher', () => {
  const chart = chartGeometry([4500, 7100, 6800]);
  assert.ok(chart.ceiling >= 7100);
  assert.ok(chart.points.every(point => point.x > chart.left && point.x < chart.right && point.y >= chart.top && point.y <= chart.bottom));
  assert.ok(chart.points[1].y < chart.points[0].y);
});
