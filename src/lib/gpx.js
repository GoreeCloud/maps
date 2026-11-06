/**
 * Export browser-local saved places as GPX 1.1 waypoints.
 * No network requests, timestamps, device identifiers, or route geometries.
 */
import {validPoint, cleanLabel} from './geo.js';
import {MAX_SAVED_PLACES} from './geojson.js';

const entities = Object.freeze({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'});

function safeXmlName(input) {
  const safe = [...cleanLabel(input)]
    .filter((char) => {
      const code = char.codePointAt(0);
      return code === 9 || code === 10 || code === 13 ||
        (code >= 0x20 && code <= 0xD7FF) ||
        (code >= 0xE000 && code <= 0xFFFD) ||
        (code >= 0x10000 && code <= 0x10FFFF);
    }).join('').trim();
  if (!safe) throw new Error('Every exported waypoint needs a valid name.');
  return safe.replace(/[&<>"']/g, (char) => entities[char]);
}

function decimal(value) {
  // GPX decimal degrees do not require scientific notation.
  return value.toFixed(12).replace(/\.?0+$/, '');
}

export function exportSavedGPX(places) {
  if (!Array.isArray(places) || places.length > MAX_SAVED_PLACES) {
    throw new Error('The saved-place collection is invalid or too large.');
  }
  const waypoints = places.map((place) => {
    if (!place || !validPoint(place.point)) {
      throw new Error('A saved waypoint has invalid coordinates.');
    }
    const [lon,lat] = place.point;
    const name = safeXmlName(place.label);
    return '  <wpt lat="' + decimal(lat) + '" lon="' + decimal(lon) +
      '"><name>' + name + '</name></wpt>';
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="GoreeCloud Maps" xmlns="http://www.topografix.com/GPX/1/1">',
    ...waypoints,
    '</gpx>',
    ''
  ].join('\n');
}
