// static/js/config.js
// Configuration constants for the NMS Platform

export const CONFIG = {
  // API Endpoints
  API: {
    SERIALS: '/systems/Live/serials',
    SYSTEMS: '/Systems/Live',
    SERIAL_NAME_MAP: '/systems/Live/serial_name_map',
    EXPORT: '/export/Live',
    LOCATIONS: '/systems/Live/locations',
    HISTORIC_SERIALS: '/systems/Historic/serials',
    HISTORIC_SYSTEMS: '/Systems/Historic',
    HISTORIC_EXPORT: '/export/Historic',
    HISTORIC_LOCATIONS: '/systems/Historic/locations',
  },

  // Map settings

  MAP: {
    INITIAL_LAT: 38.241804,
    INITIAL_LON: 24.584192,
    INITIAL_ZOOM: 7,
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
