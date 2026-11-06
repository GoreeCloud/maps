import test from 'node:test';
import assert from 'node:assert/strict';
import {exportSavedGPX} from '../src/lib/gpx.js';

test('exports GPX 1.1 waypoints in latitude,longitude attribute order', () => {
  const xml = exportSavedGPX([{point:[-86.801,33.518],label:'A place'}]);
  assert.match(xml,/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml,/<gpx version="1\.1" creator="GoreeCloud Maps" xmlns="http:\/\/www\.topografix\.com\/GPX\/1\/1">/);
  assert.match(xml,/<wpt lat="33\.518" lon="-86\.801"><name>A place<\/name><\/wpt>/);
  assert.doesNotMatch(xml,/<trk>|<rte>|<time>/);
});

test('escapes XML metadata names and preserves non-ASCII text', () => {
  const xml=exportSavedGPX([{point:[0,0],label:'Café & <South> "View" \u0027 Point 🗺️'}]);
  assert.match(xml,/<name>Café &amp; &lt;South&gt; &quot;View&quot; &apos; Point 🗺️<\/name>/);
  assert.doesNotMatch(xml,/<name>.*<South>/);
});

test('removes XML-invalid lone surrogates and rejects empty cleaned names', () => {
  assert.match(exportSavedGPX([{point:[1,2],label:'OK\uD800'}]),/<name>OK<\/name>/);
  assert.throws(()=>exportSavedGPX([{point:[1,2],label:'\uD800'}]),/valid name/);
  assert.throws(()=>exportSavedGPX([{point:[1,2],label:'  '}]),/valid name/);
});

test('invalid coordinates, malformed lists and over-limit exports fail', () => {
  assert.throws(()=>exportSavedGPX([{point:[181,0],label:'Outside'}]),/invalid coordinates/);
  assert.throws(()=>exportSavedGPX([{point:[NaN,0],label:'NaN'}]),/invalid coordinates/);
  assert.throws(()=>exportSavedGPX('not places'),/invalid or too large/);
  const many=Array.from({length:101},(_,i)=>({point:[i,0],label:'Waypoint '+i}));
  assert.throws(()=>exportSavedGPX(many),/invalid or too large/);
});

test('tiny decimal coordinates are represented without scientific notation', () => {
  const xml=exportSavedGPX([{point:[0.0000001,-0.0000002],label:'Tiny'}]);
  assert.match(xml,/lat="-0\.0000002" lon="0\.0000001"/);
  assert.doesNotMatch(xml,/e-[0-9]/i);
});

test('does not carry metadata or time fields from saved objects', () => {
  const xml=exportSavedGPX([{point:[1,2],label:'Public',private:'secret-marker',time:'2000-01-01'}]);
  assert.doesNotMatch(xml,/secret-marker|2000-01-01|<time>/);
  assert.equal((xml.match(/<wpt /g)||[]).length,1);
});
