import { Map, Marker, LngLatBounds, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import { WORLD_CENTER, validPoint, parsePoint, formatPoint, cleanLabel, readSaved, formatDuration, formatDistance } from './lib/geo.js';

setWorkerUrl(workerUrl);
const el = (id) => document.getElementById(id);
const SAVE_KEY = 'goreecloud.maps.saved.v1';
const THEME_KEY = 'goreecloud.maps.theme.v1';
const state = { map: null, start: null, end: null, selection: null, pick: 'end', markerStart: null, markerEnd: null, saved: [], config: null };
const safeStore = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } },
  remove(key) { try { localStorage.removeItem(key); } catch {} }
};
state.saved = readSaved(safeStore.get(SAVE_KEY));
const status = (message) => { el('status').textContent = message; };
const hasMap = () => { if (state.map) return true; status('Load the map before choosing a point.'); return false; };
const chooseView = (view) => {
  document.querySelectorAll('[data-panel]').forEach((panel) => { panel.hidden = panel.dataset.panel !== view; });
  document.querySelectorAll('[data-view]').forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  if (view === 'saved') renderSaved();
  state.map?.resize();
};
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => chooseView(button.dataset.view)));
const initialTheme = safeStore.get(THEME_KEY) === 'light' ? 'light' : 'dark';
document.documentElement.dataset.theme = initialTheme;
el('theme-toggle').addEventListener('click', () => {
  const value = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = value;
  safeStore.set(THEME_KEY, value);
});

function renderSelection() {
  const panel = el('selection-card');
  panel.replaceChildren();
  panel.classList.remove('empty');
  if (!state.selection) {
    panel.classList.add('empty');
    const p = document.createElement('p'); p.textContent = 'Tap the map to select a destination.'; panel.append(p);
    el('save-selection').disabled = true;
    return;
  }
  const title = document.createElement('strong');
  title.textContent = state.selection.label;
  const coords = document.createElement('small'); coords.textContent = formatPoint(state.selection.point);
  panel.append(title, coords);
  el('save-selection').disabled = false;
}

function setMarker(which, point) {
  if (!state.map || !validPoint(point)) return;
  const key = which === 'start' ? 'markerStart' : 'markerEnd';
  state[key]?.remove();
  state[key] = new Marker({ color: which === 'start' ? '#16a38a' : '#5369eb' })
    .setLngLat(point).addTo(state.map);
}

function selectPoint(point, label) {
  if (!validPoint(point)) return;
  const title = cleanLabel(label) || 'Pinned location';
  state.selection = { point: [...point], label: title };
  renderSelection();
  if (document.querySelector('[data-panel="route"]').hidden === false) {
    const which = state.pick;
    state[which] = [...point];
    el(which === 'start' ? 'start-label' : 'end-label').textContent = title;
    setMarker(which, point);
    status((which === 'start' ? 'Start' : 'Destination') + ' selected. ' + formatPoint(point));
  } else {
    state.end = [...point];
    el('end-label').textContent = title;
    setMarker('end', point);
    status('Selected ' + formatPoint(point) + '. Save or plan a route.');
  }
}

function routeFeature(coordinates) {
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } };
}
function drawRoute(coords) {
  if (!state.map || !state.map.isStyleLoaded()) return;
  const source = state.map.getSource('goree-route');
  const data = routeFeature(coords);
  if (source) source.setData(data);
  else {
    state.map.addSource('goree-route', {type: 'geojson', data});
    state.map.addLayer({id: 'goree-route-line', type: 'line', source: 'goree-route', paint: {'line-color': '#5369eb', 'line-width': 6, 'line-opacity': 0.9}, layout: {'line-cap': 'round', 'line-join': 'round'}});
  }
  const bounds = coords.reduce((box, point) => box.extend(point), new LngLatBounds(coords[0], coords[0]));
  state.map.fitBounds(bounds, {padding: 85, maxZoom: 13});
}

function mapStyle() {
  return {
    version: 8,
    sources: { osm: { type: 'raster', tiles: [state.config.tileUrl], tileSize: 256, attribution: state.config.attribution } },
    layers: [{id: 'osm', type: 'raster', source: 'osm'}]
  };
}

async function loadMap() {
  if (state.map) return;
  if (!state.config) { status('Map configuration unavailable. Please reload.'); return; }
  try {
    state.map = new Map({container: 'map', style: mapStyle(), center: WORLD_CENTER, zoom: 3.6, attributionControl: true, maxZoom: 19});
    state.map.on('click', (event) => selectPoint([event.lngLat.lng, event.lngLat.lat], 'Pinned location'));
    state.map.on('moveend', () => {
      el('map-coordinates').textContent = formatPoint([state.map.getCenter().lng, state.map.getCenter().lat]);
    });
    state.map.on('load', () => status('Ready. Tap or click anywhere to select a destination.'));
    state.map.on('error', () => status('Some map tiles may be unavailable. Check the selected map provider.'));
    el('map-consent').hidden = true;
    el('map-mode').textContent = 'Interactive map · ' + state.config.provider;
    for (const id of ['zoom-in','zoom-out','reset-view']) el(id).disabled = false;
  } catch (error) {
    state.map?.remove(); state.map = null;
    status('Unable to start map rendering on this device.');
  }
}
el('load-map').addEventListener('click', loadMap);
el('zoom-in').addEventListener('click', () => state.map?.zoomIn());
el('zoom-out').addEventListener('click', () => state.map?.zoomOut());
el('reset-view').addEventListener('click', () => state.map?.flyTo({center: WORLD_CENTER, zoom: 3.6}));
el('reload-tiles').addEventListener('click', () => {
  state.map?.remove(); state.map = null;
  state.markerStart = null; state.markerEnd = null;
  el('map-consent').hidden = false;
  el('map-mode').textContent = 'Map not loaded';
  for (const id of ['zoom-in','zoom-out','reset-view']) el(id).disabled = true;
  chooseView('privacy');
  status('Map requests stopped. Previously sent requests cannot be recalled.');
});

el('save-selection').addEventListener('click', () => {
  if (!state.selection) return;
  const label = window.prompt('Name this saved place', state.selection.label);
  if (label === null) return;
  const clean = cleanLabel(label);
  if (!clean) { status('Enter a name for the place.'); return; }
  const entry = {point: state.selection.point, label: clean};
  state.saved = [entry, ...state.saved.filter((p) => formatPoint(p.point) !== formatPoint(entry.point))].slice(0, 100);
  if (!safeStore.set(SAVE_KEY, JSON.stringify(state.saved))) status('Browser storage unavailable. The place could not be saved.');
  else status('Saved to this browser only.');
});

function renderSaved() {
  const list = el('saved-list'); list.replaceChildren();
  if (!state.saved.length) {
    const empty = document.createElement('p'); empty.className = 'empty-message';
    empty.textContent = 'Nothing saved yet. Choose a point on the map, then save it.';
    list.append(empty); return;
  }
  state.saved.forEach((item, index) => {
    const row = document.createElement('div'); row.className = 'result-card saved-card';
    const button = document.createElement('button'); button.type = 'button'; button.className = 'result-main';
    const title = document.createElement('strong'); title.textContent = item.label;
    const description = document.createElement('small'); description.textContent = formatPoint(item.point);
    button.append(title, description);
    button.addEventListener('click', () => {
      chooseView('explore'); selectPoint(item.point, item.label);
      if (state.map) state.map.flyTo({center: item.point, zoom: 14});
    });
    const remove = document.createElement('button'); remove.className = 'remove'; remove.type = 'button';
    remove.textContent = 'Remove'; remove.setAttribute('aria-label', 'Remove ' + item.label);
    remove.addEventListener('click', () => { state.saved.splice(index, 1); safeStore.set(SAVE_KEY, JSON.stringify(state.saved)); renderSaved(); });
    row.append(button, remove); list.append(row);
  });
}
el('clear-saved').addEventListener('click', () => {
  if (!state.saved.length) { status('No saved places to erase.'); return; }
  if (!window.confirm('Erase all saved GoreeCloud Maps places from this browser?')) return;
  state.saved = []; safeStore.remove(SAVE_KEY); renderSaved();
  status('Saved places erased from this browser.');
});

el('choose-start').addEventListener('click', () => { state.pick = 'start'; status('Tap the map to choose your starting point.'); });
el('choose-end').addEventListener('click', () => { state.pick = 'end'; status('Tap the map to choose your destination.'); });
el('use-location').addEventListener('click', () => {
  if (!hasMap()) return;
  if (!navigator.geolocation) { status('Geolocation is not available in this browser.'); return; }
  status('Requesting location permission from your browser…');
  navigator.geolocation.getCurrentPosition(({coords}) => {
    state.start = [coords.longitude, coords.latitude]; state.pick = 'end';
    el('start-label').textContent = 'My current location (this session)';
    setMarker('start', state.start);
    state.map.flyTo({center: state.start, zoom: 13});
    status('Location available for this session. Choose a destination.');
  }, () => status('Location unavailable or permission declined. Select a starting point on the map.'), {enableHighAccuracy: false, timeout: 12000, maximumAge: 0});
});

el('route-button').addEventListener('click', async () => {
  if (!state.config?.routing) { status('Routing requires an operator-configured OSRM service.'); return; }
  if (!validPoint(state.start) || !validPoint(state.end)) { status('Choose a start and destination first.'); return; }
  const btn = el('route-button'); btn.disabled = true;
  const summary = el('route-summary'); summary.textContent = 'Calculating driving route…';
  try {
    const params = new URLSearchParams({start: state.start.join(','), end: state.end.join(',')});
    const response = await fetch('/api/route?' + params, {cache: 'no-store'});
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Routing provider unavailable.');
    if (!Array.isArray(payload.coordinates) || payload.coordinates.length < 2) throw new Error('No usable route was returned.');
    drawRoute(payload.coordinates);
    summary.replaceChildren();
    const heading = document.createElement('strong'); heading.textContent = formatDuration(payload.duration) + ' · ' + formatDistance(payload.distance);
    const note = document.createElement('p'); note.textContent = 'Driving route · Based on configured OSRM data, not live traffic.';
    summary.append(heading, note);
    status('Route found. Guidance and traffic updates are not enabled in this preview.');
  } catch (error) { summary.textContent = error.message || 'Route calculation failed.'; status('Could not calculate route.'); }
  finally { btn.disabled = false; }
});

el('search-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const query = el('search-input').value.trim();
  const directPoint = parsePoint(query);
  if (directPoint) {
    selectPoint(directPoint, 'Coordinates ' + formatPoint(directPoint));
    if (state.map) state.map.flyTo({center: directPoint, zoom: 13});
    el('search-results').textContent = 'Coordinate located locally. No geocoding request sent.';
    return;
  }
  if (!state.config?.search) { status('Place search requires an operator-configured geocoder. Coordinates work without one.'); return; }
  if (query.length < 2) { status('Search for at least two characters.'); return; }
  const list = el('search-results'); list.textContent = 'Searching…';
  try {
    const response = await fetch('/api/search?q=' + encodeURIComponent(query), {cache: 'no-store'});
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Search unavailable.');
    list.replaceChildren();
    if (!payload.results.length) { list.textContent = 'No matching places found.'; return; }
    payload.results.forEach((result) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'result-card result-main';
      const title = document.createElement('strong'); title.textContent = result.name;
      const hint = document.createElement('small'); hint.textContent = formatPoint([result.lon, result.lat]);
      button.append(title, hint);
      button.addEventListener('click', () => {
        const point = [result.lon, result.lat];
        selectPoint(point, result.name);
        if (state.map) state.map.flyTo({center: point, zoom: 14});
        else status('Place found. Load the map to view it.');
      });
      list.append(button);
    });
  } catch (error) { list.textContent = error.message || 'Search failed.'; }
});

async function loadConfig() {
  try {
    const response = await fetch('/api/config', {cache: 'no-store'});
    if (!response.ok) throw new Error('Service configuration unavailable.');
    const data = await response.json();
    if (!data.tileUrl || !data.attribution) throw new Error('Incomplete map configuration.');
    state.config = data;
    el('search-hint').textContent = data.search ? 'Coordinate searches are local. Place names use your configured geocoder.' : 'Enter longitude,latitude to look up coordinates locally. Place names require a configured geocoder.';
    if (!data.routing) el('route-summary').textContent = 'Routing is disabled until an operator configures OSRM.';
  } catch {
    status('The GoreeCloud Maps API is offline. Start the API service and reload.');
  }
}
renderSelection();
renderSaved();
loadConfig();
