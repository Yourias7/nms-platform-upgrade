// static/js/config.js
// Configuration constants for the NMS Platform

// We use this flag to decide whether the page is 3skelion or not.
// Default behavior stays EXACTLY the same for 4skelion pages.
const PLATFORM = globalThis.NMS_PLATFORM || '4skelion';

// If 3skelion page: prefix all API calls with /3skelion
const API_PREFIX = (PLATFORM === '3skelion') ? '/3skelion' : '';

export const CONFIG = {
  // API Endpoints
  API: {
    SERIALS: `${API_PREFIX}/systems/Live/serials`,
    SYSTEMS: `${API_PREFIX}/Systems/Live`,
    SERIAL_NAME_MAP: `${API_PREFIX}/systems/Live/names`,
    EXPORT: `${API_PREFIX}/export/Live`,
    LOCATIONS: `${API_PREFIX}/systems/Live/locations`,
    HISTORIC_SERIALS: `${API_PREFIX}/playback/Historic/serials`,
    HISTORIC_SYSTEMS: `${API_PREFIX}/playback/Historic`,
    ALARM_SYSTEMS: `${API_PREFIX}/alarms/systems`,
    ALARM_STATISTICS: `${API_PREFIX}/alarms/statistics`,
    HISTORIC_EXPORT: `${API_PREFIX}/export/Historic`,
    HISTORIC_LOCATIONS: `${API_PREFIX}/playback/Historic/locations`,
    PROBE_SERIALS: `${API_PREFIX}/probes/Live/serials`,
    PROBE_SYSTEMS: `${API_PREFIX}/Probes/Live`,
    PROBE_NAME_MAP: `${API_PREFIX}/probes/Live/names`,
    PROBE_HISTORIC_NAME_MAP: `${API_PREFIX}/probes/playback/Historic/names`,
    PROBE_HISTORIC_SERIALS: `${API_PREFIX}/probes/playback/Historic/serials`,
    PROBE_HISTORIC_SYSTEMS: `${API_PREFIX}/Probes/playback/Historic`,
  },

  // Map settings

  MAP: {
    INITIAL_LAT: 38.241804,
    INITIAL_LON: 24.584192,
    INITIAL_ZOOM: 9,
    MAX_ZOOM: 10,
    TILE_URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    TILE_ATTRIBUTION: '&copy; OpenStreetMap contributors',
    FIT_BOUNDS_PADDING: [50, 50]
  },

  // Marker icon settings
  MARKER: {
    ICON_SIZE: [40, 40],
    ICON_ANCHOR: [20, 40],
    POPUP_ANCHOR: [0, -40],
    PNG_PATH: '/static/img/marker-thumb.png',
    SVG_PATH: '/static/img/marker-thumb.svg',
    FALLBACK_SVG: `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><circle cx='20' cy='15' r='10' fill='%23ff3b3b' stroke='%23b30000' stroke-width='1'/></svg>`
  },

  // LED indicator thresholds
  LED: {
    RSRP_THRESHOLD: -120,
    SINR_THRESHOLD: 0, 
    TEMP_THRESHOLD: 80
  },

  // UI settings
  UI: {
    FILTER_DEBOUNCE_MS: 250,
    AUTO_REFRESH_MS: 60000
  }
};