/**
 * Portable, local-only saved place GeoJSON interchange (WGS84 longitude,latitude).
 * No network calls, provider identifiers or user metadata are included.
 */
import {validPoint, cleanLabel} from './geo.js';

export const MAX_SAVED_PLACES = 100;
export const MAX_IMPORT_BYTES = 131072;

function normalizePlace(value) {
  if (!value || !validPoint(value.point)) throw new Error('A saved place has invalid coordinates.');
  const label = cleanLabel(value.label);
  if (!label) throw new Error('Every saved place needs a name.');
  return {point: [...value.point], label};
}

export function exportSavedGeoJSON(places) {
  if (!Array.isArray(places) || places.length > MAX_SAVED_PLACES) {
    throw new Error('The saved-place collection is invalid or too large.');
  }
  return {
    type:'FeatureCollection',
    features:places.map((entry) => {
      const place = normalizePlace(entry);
      return {type:'Feature', geometry:{type:'Point', coordinates:place.point}, properties:{name:place.label}};
    })
  };
}

export function importSavedGeoJSON(raw) {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).byteLength > MAX_IMPORT_BYTES) {
    throw new Error('Choose a GeoJSON file smaller than 128 KiB.');
  }
  let value;
  try { value = JSON.parse(raw); }
  catch { throw new Error('The file does not contain valid JSON.'); }
  if (!value || value.type !== 'FeatureCollection' || !Array.isArray(value.features) ||
    value.features.length > MAX_SAVED_PLACES) {
    throw new Error('Import requires a GeoJSON FeatureCollection with at most 100 features.');
  }
  return value.features.map((feature) => {
    if (!feature || feature.type !== 'Feature' || feature.geometry?.type !== 'Point' ||
      !validPoint(feature.geometry.coordinates) || typeof feature.properties?.name !== 'string') {
      throw new Error('Every imported feature must be a named geographic point.');
    }
    return normalizePlace({point:feature.geometry.coordinates, label:feature.properties.name});
  });
}

export function mergeSavedPlaces(existing, incoming) {
  if (!Array.isArray(existing) || !Array.isArray(incoming)) throw new Error('Invalid place list.');
  const result = [];
  const seen = new Set();
  for (const entry of [...existing, ...incoming]) {
    const place = normalizePlace(entry);
    const key = place.point.join(',');
    if (!seen.has(key)) { seen.add(key); result.push(place); }
    if (result.length > MAX_SAVED_PLACES) throw new Error('Import would exceed the 100-place limit. Export or remove places first.');
  }
  return result;
}
