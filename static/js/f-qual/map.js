// static/js/map.js
// Map initialization and marker management

import { CONFIG } from '../shared/config.js';
import { fetchSerialData } from '../shared/api.js';
import { getFieldCaseInsensitive, safeParseFloat } from '../shared/utils.js';

// Module state
let map = null;
let markers = [];

// Define your default system color here
const SYSTEM_DEFAULT_COLOR = '#0d6efd'; 

// Used to cancel outdated async updates (prevents “snap back” after click)
let updateSeq = 0;

// Generate a directional arrow icon based on heading and color
export function getDirectionalIcon(heading, color) {
  const html = `
    <div style="transform: rotate(${heading}deg); transform-origin: center; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.4));">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="${color}" stroke="#ffffff" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L22 22L12 18L2 22L12 2Z" />
      </svg>
    </div>
  `;
  
  return L.divIcon({
    html: html,
    className: 'system-directional-marker', // Avoids default white leaflet background
    iconSize: [28, 28],
    iconAnchor: [14, 14], // Centers the icon over the coordinate
    popupAnchor: [0, -14]
  });
}

function getLastUpdatedText(dateValue) {
  const lastUpdate = dateValue ? new Date(dateValue) : null;
  const now = new Date();
  let timeDiffText = 'N/A';

  if (lastUpdate instanceof Date && !isNaN(lastUpdate.getTime())) {
    const diffInSeconds = Math.floor((now - lastUpdate) / 1000);
    if (diffInSeconds < 60) timeDiffText = `${diffInSeconds}s ago`;
    else if (diffInSeconds < 3600) timeDiffText = `${Math.floor(diffInSeconds / 60)}m ago`;
    else if (diffInSeconds < 86400) timeDiffText = `${Math.floor(diffInSeconds / 3600)}h ago`;
    else timeDiffText = `${Math.floor(diffInSeconds / 86400)}d ago`;
  }

  return timeDiffText;
}

export function buildMarkerTooltipContent(row, serial) {
  const lat = getFieldCaseInsensitive(row, ['latitude', 'lat']);
  const lon = getFieldCaseInsensitive(row, ['longitude', 'lon']);
  const rsrp = getFieldCaseInsensitive(row, ['rsrp', 'RSRP']);
  const sinr = getFieldCaseInsensitive(row, ['sinr', 'SINR']);
  const temp = getFieldCaseInsensitive(row, ['temp', 'TEMP', 'temperature']);
  const name = getFieldCaseInsensitive(row, ['name', 'NAME']);
  const earfcn = getFieldCaseInsensitive(row, ['earfcn', 'EARFCN']);
  const pci = getFieldCaseInsensitive(row, ['pci', 'PCI']);
  const antennaUsed = getFieldCaseInsensitive(row, ['antenna used', 'ANTENNA USED']);
  const cid = getFieldCaseInsensitive(row, ['cid', 'CID']);
  const date = getFieldCaseInsensitive(row, ['datetime', 'DATETIME']);

  const latf = safeParseFloat(lat);
  const lonf = safeParseFloat(lon);
  const rsrpVal = rsrp !== null ? safeParseFloat(rsrp).toFixed(1) : 'N/A';
  const sinrVal = sinr !== null ? safeParseFloat(sinr).toFixed(1) : 'N/A';
  const tempVal = temp !== null ? safeParseFloat(temp).toFixed(1) : 'N/A';
  const timeDiffText = getLastUpdatedText(date);

  return (
    `<b>${name ?? ''}</b><br>${serial}` +
    `<br>Lat: ${latf}, Lon: ${lonf}` +
    `<br>RSRP: ${rsrpVal} dBm` +
    `<br>SINR: ${sinrVal} dB` +
    `<br>TEMP: ${tempVal}°C` +
    `<br>EARFCN: ${earfcn ?? ''}` +
    `<br>PCI: ${pci ?? ''}` +
    `<br>Antenna Used: ${antennaUsed ?? ''}` +
    `<br>CID: ${cid ?? ''}` +
    `<br>Last Updated: ${timeDiffText}`
  );
}

export function tooltipHtmlToPlainText(html) {
  return String(html)
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/?b>/gi, '')
    .trim();
}

/**
 * Initialize Leaflet map
 * @returns {L.Map} Leaflet map instance
 */
export function initMap() {
  map = L.map('map').setView(
    [CONFIG.MAP.INITIAL_LAT, CONFIG.MAP.INITIAL_LON],
    CONFIG.MAP.INITIAL_ZOOM
  );

  L.tileLayer(CONFIG.MAP.TILE_URL, {
    maxZoom: CONFIG.MAP.MAX_ZOOM,
    attribution: CONFIG.MAP.TILE_ATTRIBUTION
  }).addTo(map);

  return map;
}

/**
 * Get the map instance
 * @returns {L.Map|null}
 */
export function getMap() {
  return map;
}

/**
 * Safely stubbed to prevent breaking legacy calls. 
 * Old PNG/SVG loading logic removed in favor of inline SVG.
 */
export function preloadCustomIcon() {
  console.log('[map] preloadCustomIcon bypassed: Using inline SVG getDirectionalIcon instead.');
}

/**
 * Clear all markers from the map
 */
export function clearMapMarkers() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
}

/**
 * Get all current markers
 * @returns {L.Marker[]}
 */
export function getMarkers() {
  return markers;
}

/**
 * Show map loading overlay
 */
export function showMapLoading() {
  const overlay = document.getElementById('mapLoadingOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
  }
}

/**
 * Hide map loading overlay
 */
export function hideMapLoading() {
  const overlay = document.getElementById('mapLoadingOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

/**
 * Update map markers for given serial list
 * @param {string[]} serialList - Array of serial numbers to display
 * @param {{fit?: boolean}} options - if fit=false, will NOT change viewport (prevents snap-back after click)
 */
export async function updateMapMarkers(serialList, { fit = true } = {}) {
  // Show loading overlay
  showMapLoading();
  
  // Cancel any previous in-flight update
  const seq = ++updateSeq;

  clearMapMarkers();
  const bounds = [];

  for (const serial of serialList) {
    try {
      const data = await fetchSerialData(serial);

      // If a newer update started, stop immediately
      if (seq !== updateSeq) return;

      if (!data || data.length === 0) continue;

      data.forEach(row => {
        const lat = getFieldCaseInsensitive(row, ['latitude', 'lat']);
        const lon = getFieldCaseInsensitive(row, ['longitude', 'lon']);
        const heading = getFieldCaseInsensitive(row, ['heading', 'he']);
        const date = getFieldCaseInsensitive(row, ['datetime', 'DATETIME']);

        const latf = safeParseFloat(lat);
        const lonf = safeParseFloat(lon);

        // Robust coordinate validation
        if (!Number.isFinite(latf) || !Number.isFinite(lonf)) return;
        if (latf === 0 && lonf === 0) return;

        // Parse heading safely
        const headingDeg = safeParseFloat(heading, 0);

        // Render the new directional SVG Icon
        const icon = getDirectionalIcon(headingDeg, SYSTEM_DEFAULT_COLOR);
        
        const marker = L.marker([latf, lonf], { 
          icon: icon,
          zIndexOffset: 100
        }).addTo(map);

        const tooltipContent = buildMarkerTooltipContent(row, serial);

        // Bind popup for click interaction
        marker.bindPopup(tooltipContent);

        // Bind tooltip for hover interaction
        marker.bindTooltip(tooltipContent, {
          direction: 'top',
          offset: [0, -15] // Adjusted slightly closer to fit the SVG sizing
        });

        markers.push(marker);
        bounds.push([latf, lonf]);
      });

      // If a newer update started, stop immediately
      if (seq !== updateSeq) return;
    } catch (err) {
      console.error(`Error fetching data for ${serial}:`, err);
    }
  }

  // Final cancel check before fitting
  if (seq !== updateSeq) return;

  // Fit map to bounds only if requested
  if (fit && bounds.length > 0) {
    try {
      map.fitBounds(bounds, {
        padding: CONFIG.MAP.FIT_BOUNDS_PADDING,
        maxZoom: CONFIG.MAP.MAX_ZOOM
      });
    } catch (e) {
      // Ignore fitBounds errors
    }
  }
  
  // Hide loading overlay after markers are loaded
  hideMapLoading();
}