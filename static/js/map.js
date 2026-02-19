// static/js/map.js
// Map initialization and marker management

import { CONFIG } from './config.js';
import { fetchSerialData } from './api.js';
import { getFieldCaseInsensitive, safeParseFloat } from './utils.js';

// Module state
let map = null;
let markers = [];
let customIcon = null;
let useCustomIcon = false;
let customIconUrl = null;

// Used to cancel outdated async updates (prevents “snap back” after click)
let updateSeq = 0;

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
 * Preload custom marker icon with PNG -> SVG -> embedded fallback
 */
export function preloadCustomIcon() {
  console.log('[map] preloadCustomIcon: attempting PNG');
  const png = new Image();

  png.onload = () => {
    try {
      customIcon = L.icon({
        iconUrl: CONFIG.MARKER.PNG_PATH,
        iconSize: CONFIG.MARKER.ICON_SIZE,
        iconAnchor: CONFIG.MARKER.ICON_ANCHOR,
        popupAnchor: CONFIG.MARKER.POPUP_ANCHOR
      });
      customIconUrl = CONFIG.MARKER.PNG_PATH;
      useCustomIcon = true;
      console.log('[map] using PNG as marker icon');
    } catch (e) {
      console.warn('[map] failed to create icon from PNG', e);
      useCustomIcon = false;
    }
  };

  png.onerror = () => {
    console.log('[map] PNG not found, attempting SVG');
    const svgImg = new Image();

    svgImg.onload = () => {
      try {
        customIcon = L.icon({
          iconUrl: CONFIG.MARKER.SVG_PATH,
          iconSize: CONFIG.MARKER.ICON_SIZE,
          iconAnchor: CONFIG.MARKER.ICON_ANCHOR,
          popupAnchor: CONFIG.MARKER.POPUP_ANCHOR
        });
        customIconUrl = CONFIG.MARKER.SVG_PATH;
        useCustomIcon = true;
        console.log('[map] using SVG as marker icon');
      } catch (e) {
        console.warn('[map] failed to create icon from SVG', e);
        useCustomIcon = false;
      }
    };

    svgImg.onerror = () => {
      console.log('[map] SVG not found, using embedded fallback');
      const dataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(CONFIG.MARKER.FALLBACK_SVG);

      try {
        customIcon = L.icon({
          iconUrl: dataUrl,
          iconSize: CONFIG.MARKER.ICON_SIZE,
          iconAnchor: CONFIG.MARKER.ICON_ANCHOR,
          popupAnchor: CONFIG.MARKER.POPUP_ANCHOR
        });
        customIconUrl = dataUrl;
        useCustomIcon = true;
        console.log('[map] using embedded SVG as marker icon');
      } catch (e) {
        console.warn('[map] failed to create embedded icon', e);
        useCustomIcon = false;
        customIcon = null;
        customIconUrl = null;
      }
    };

    svgImg.src = CONFIG.MARKER.SVG_PATH;
  };

  png.src = CONFIG.MARKER.PNG_PATH;
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
 * Update map markers for given serial list
 * @param {string[]} serialList - Array of serial numbers to display
 * @param {{fit?: boolean}} options - if fit=false, will NOT change viewport (prevents snap-back after click)
 */
export async function updateMapMarkers(serialList, { fit = true } = {}) {
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
        const heading = getFieldCaseInsensitive(row, ['heading', 'he', 'heading']);
        const rsrp = getFieldCaseInsensitive(row, ['rsrp', 'RSRP']);
        const sinr = getFieldCaseInsensitive(row, ['sinr', 'SINR']);
        const temp = getFieldCaseInsensitive(row, ['temp', 'TEMP', 'temperature']);
        const name = getFieldCaseInsensitive(row, ['name', 'NAME']);
        const earfcn = getFieldCaseInsensitive(row, ['earfcn', 'EARFCN']);
        const pci = getFieldCaseInsensitive(row, ['pci', 'PCI']);
        const antenna_used = getFieldCaseInsensitive(row, ['antenna used', 'ANTENNA USED']);
        const cid = getFieldCaseInsensitive(row, ['cid', 'CID']);
        const date = getFieldCaseInsensitive(row, ['datetime', 'DATETIME']);

        const latf = safeParseFloat(lat);
        const lonf = safeParseFloat(lon);

        // Robust coordinate validation
        if (!Number.isFinite(latf) || !Number.isFinite(lonf)) return;
        if (latf === 0 && lonf === 0) return;

        const headingDeg = safeParseFloat(heading, 0);
        const rsrpVal = rsrp !== null ? safeParseFloat(rsrp).toFixed(1) : 'N/A';
        const sinrVal = sinr !== null ? safeParseFloat(sinr).toFixed(1) : 'N/A';
        const tempVal = temp !== null ? safeParseFloat(temp).toFixed(1) : 'N/A';

        let marker;
        if (useCustomIcon && customIconUrl) {
          if (headingDeg && headingDeg !== 0) {
            // Rotated marker using DivIcon
            const html = `<img src="${customIconUrl}" style="width:40px;height:40px;transform:rotate(${headingDeg}deg);transform-origin:20px 20px;"/>`;
            const divIcon = L.divIcon({
              html,
              className: '',
              iconSize: CONFIG.MARKER.ICON_SIZE,
              iconAnchor: CONFIG.MARKER.ICON_ANCHOR,
              popupAnchor: CONFIG.MARKER.POPUP_ANCHOR
            });
            marker = L.marker([latf, lonf], { icon: divIcon }).addTo(map);
          } else {
            marker = L.marker([latf, lonf], { icon: customIcon }).addTo(map);
          }
        } else {
          marker = L.marker([latf, lonf]).addTo(map);
        }

        // “Last updated” string (safe for missing/invalid date)
        const lastUpdate = date ? new Date(date) : null;
        const now = new Date();
        let timeDiffText = 'N/A';

        if (lastUpdate instanceof Date && !isNaN(lastUpdate.getTime())) {
          const diffInSeconds = Math.floor((now - lastUpdate) / 1000);
          if (diffInSeconds < 60) timeDiffText = `${diffInSeconds}s ago`;
          else if (diffInSeconds < 3600) timeDiffText = `${Math.floor(diffInSeconds / 60)}m ago`;
          else if (diffInSeconds < 86400) timeDiffText = `${Math.floor(diffInSeconds / 3600)}h ago`;
          else timeDiffText = `${Math.floor(diffInSeconds / 86400)}d ago`;
        }

        const tooltipContent =
          `<b>${name ?? ''}</b><br>${serial}` +
          `<br>Lat: ${latf}, Lon: ${lonf}` +
          `<br>RSRP: ${rsrpVal} dBm` +
          `<br>SINR: ${sinrVal} dB` +
          `<br>TEMP: ${tempVal}°C` +
          `<br>EARFCN: ${earfcn ?? ''}` +
          `<br>PCI: ${pci ?? ''}` +
          `<br>Antenna Used: ${antenna_used ?? ''}` +
          `<br>CID: ${cid ?? ''}` +
          `<br>Last Updated: ${timeDiffText}`;

        // Bind popup for click interaction
        marker.bindPopup(tooltipContent);

        // Bind tooltip for hover interaction
        marker.bindTooltip(tooltipContent, {
          direction: 'top',
          offset: [0, -45]
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
}