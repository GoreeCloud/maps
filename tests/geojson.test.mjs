import test from 'node:test';
import assert from 'node:assert/strict';
import {exportSavedGeoJSON, importSavedGeoJSON, mergeSavedPlaces, MAX_IMPORT_BYTES} from '../src/lib/geojson.js';

test('round trip of named coordinates through GeoJSON', () => {
  const places = [{point:[-86.801,33.518], label:'Saved location'}];
  assert.deepEqual(importSavedGeoJSON(JSON.stringify(exportSavedGeoJSON(places))), places);
});
test('oversized and malformed files fail without partial import', () => {
  assert.throws(() => importSavedGeoJSON(' '.repeat(MAX_IMPORT_BYTES+1)),/smaller/);
  assert.throws(() => importSavedGeoJSON('{'),/valid JSON/);
  assert.throws(() => importSavedGeoJSON(JSON.stringify({type:'FeatureCollection', features:[
    {type:'Feature',geometry:{type:'Point',coordinates:[2,3]},properties:{name:'Valid'}},
    {type:'Feature',geometry:{type:'LineString',coordinates:[[1,2],[3,4]]},properties:{name:'Invalid'}}
  ]})),/geographic point/);
});
test('invalid coordinates and empty labels fail', () => {
  assert.throws(() => exportSavedGeoJSON([{point:[181,0],label:'Bad'}]),/invalid coordinates/);
  assert.throws(() => importSavedGeoJSON(JSON.stringify({type:'FeatureCollection',features:[
    {type:'Feature',geometry:{type:'Point',coordinates:[0,91]},properties:{name:'X'}}
  ]})),/geographic point/);
  assert.throws(() => exportSavedGeoJSON([{point:[0,0],label:'  '}]),/needs a name/);
});
test('duplicate coordinates retain the existing name and enforce capacity', () => {
  assert.deepEqual(mergeSavedPlaces([{point:[1,2],label:'Original'}], [
    {point:[1,2],label:'New name'},{point:[3,4],label:'Added'}]),
    [{point:[1,2],label:'Original'},{point:[3,4],label:'Added'}]);
  const places = Array.from({length:100},(_,i)=>({point:[i,0],label:'Place '+i}));
  assert.throws(() => mergeSavedPlaces(places,[{point:[101,0],label:'Excess'}]),/100-place limit/);
});
test('unrelated properties do not become saved place metadata', () => {
  const raw = JSON.stringify({type:'FeatureCollection', features:[{
    type:'Feature',geometry:{type:'Point',coordinates:[10,11]},
    properties:{name:'Safe',other:'private'}
  }]});
  assert.deepEqual(importSavedGeoJSON(raw), [{point:[10,11],label:'Safe'}]);
});
