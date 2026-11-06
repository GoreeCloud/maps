import test from 'node:test';
import assert from 'node:assert/strict';
import {createRouteRequestGuard} from '../src/lib/route-request.js';

test('new route request is accepted only for its generation', () => {
  const guard = createRouteRequestGuard();
  assert.equal(guard.isCurrent(1), false);
  const first = guard.begin();
  assert.equal(guard.isCurrent(first), true);
  const second = guard.begin();
  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), true);
});
test('point changes invalidate inflight routing responses', () => {
  const guard = createRouteRequestGuard();
  const request = guard.begin();
  guard.invalidate();
  assert.equal(guard.isCurrent(request), false);
  assert.equal(guard.isCurrent(guard.begin()), true);
});
test('rejects invalid and unissued tokens', () => {
  const guard = createRouteRequestGuard();
  assert.equal(guard.isCurrent(0), false);
  assert.equal(guard.isCurrent(NaN), false);
  assert.equal(guard.isCurrent(1.5), false);
});
