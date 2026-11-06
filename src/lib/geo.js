export const WORLD_CENTER = [-98, 39.5];

export function validPoint(value) {
  return Array.isArray(value) && value.length === 2 &&
    value.every((number) => typeof number === 'number' && Number.isFinite(number)) &&
    Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
}

export function parsePoint(value) {
  if (typeof value !== 'string' || value.length > 60) return null;
  const parts = value.split(',');
  if (parts.length !== 2 || parts.some((part) => !/^-?\d+(?:\.\d+)?$/.test(part.trim()))) return null;
  const point = parts.map((part) => Number(part.trim()));
  return validPoint(point) ? point : null;
}

export function formatPoint(point) {
  if (!validPoint(point)) return 'Unknown coordinates';
  return point[1].toFixed(5) + '°, ' + point[0].toFixed(5) + '°';
}

export function cleanLabel(value) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 100) : '';
}

export function readSaved(raw) {
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.slice(0, 100).filter((item) => item && validPoint(item.point) && cleanLabel(item.label))
      .map((item) => ({point: item.point, label: cleanLabel(item.label)}));
  } catch { return []; }
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return 'Unknown time';
  const mins = Math.round(seconds / 60);
  return mins < 60 ? mins + ' min' : Math.floor(mins / 60) + ' hr ' + (mins % 60) + ' min';
}

export function formatDistance(metres) {
  if (!Number.isFinite(metres) || metres < 0) return 'Unknown distance';
  return (metres / 1000).toFixed(1) + ' km';
}
