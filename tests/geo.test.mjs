import test from 'node:test';
import assert from 'node:assert/strict';
import {validPoint,parsePoint,cleanLabel,readSaved,formatDuration,formatDistance} from '../src/lib/geo.js';

test('validates longitude latitude and rejects malformed points', () => {
  assert.deepEqual(parsePoint('-86.801,33.518'),[-86.801,33.518]);
  for (const invalid of ['','1','0,','NaN,40','181,0','0,91','1,2,3','1e3,0',null]) assert.equal(parsePoint(invalid),null);
  assert.equal(validPoint([0,0]),true);
  assert.equal(validPoint([Infinity,0]),false);
});
test('saved places are bounded, validated and names cleaned', () => {
  const raw = JSON.stringify([{point:[10,20],label:'Good\u0000 place'},{point:[999,0],label:'Bad'}]);
  assert.deepEqual(readSaved(raw),[{point:[10,20],label:'Good  place'}]);
  assert.deepEqual(readSaved('not json'),[]);
  assert.equal(cleanLabel('  abc  '),'abc');
});
test('route units and time formatting are deterministic', () => {
  assert.equal(formatDuration(3720),'1 hr 2 min');
  assert.equal(formatDistance(2500),'2.5 km');
});
