import test from 'node:test';
import assert from 'node:assert/strict';
import { preciseLocation } from '../lib/precise-location.mjs';
const point = accuracy => ({ coords: { latitude: 22.5, longitude: 88.3, accuracy }, timestamp: Date.now() });
function device() {
  const d = { success: null, failure: null, cleared: [], watchPosition(success, failure, options) { d.success = success; d.failure = failure; assert.equal(options.enableHighAccuracy, true); return 7; }, clearWatch(id) { d.cleared.push(id); } };
  return d;
}
test('waits through coarse GPS and returns original accurate reading', async () => {
  const d = device(); const result = preciseLocation(d, { timeout: 1000, maxAccuracy: 60 });
  d.success(point(1200)); assert.equal(d.cleared.length, 0);
  d.success(point(80)); assert.equal(d.cleared.length, 0);
  const fix = point(35); d.success(fix);
  assert.equal(await result, fix); assert.deepEqual(d.cleared, [7]);
});
test('coarse-only GPS explains accuracy and does not fabricate a precise fix', async () => {
  const d = device(); const result = preciseLocation(d, { timeout: 10 });
  d.success(point(2000)); d.success(point(750));
  await assert.rejects(result, /±750 m.*±100 m.*GPS simulator/);
  assert.deepEqual(d.cleared, [7]);
});
test('permission denial is actionable and stops the watcher', async () => {
  const d = device(); const result = preciseLocation(d);
  d.failure({ code: 1 });
  await assert.rejects(result, /permission denied/); assert.deepEqual(d.cleared, [7]);
});
test('cancellation clears GPS watcher and ignores late readings', async () => {
  const d = device(); const c = new AbortController();
  const result = preciseLocation(d, { signal: c.signal }); c.abort(); d.success(point(5));
  await assert.rejects(result, { name: 'AbortError' }); assert.deepEqual(d.cleared, [7]);
});
test('ignores stale or malformed readings and recovers from transient GPS errors', async () => {
  const d = device(); const result = preciseLocation(d, { timeout: 1000 });
  d.success({ ...point(5), timestamp: Date.now() - 60000 }); d.success(point(NaN));
  d.failure({ code: 2 }); assert.equal(d.cleared.length, 0);
  d.success(point(45)); assert.equal((await result).coords.accuracy, 45);
});
