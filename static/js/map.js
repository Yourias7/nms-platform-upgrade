
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
 */
export async function updateMapMarkers(serialList) {
  clearMapMarkers();
  const bounds = [];
  
  for (const serial of serialList) {
    try {
      const data = await fetchSerialData(serial);
      if (!data || data.length === 0) continue;
      
      data.forEach(row => {
        const lat = getFieldCaseInsensitive(row, ['latitude', 'lat']);
        const lon = getFieldCaseInsensitive(row, ['longitude', 'lon']);
        const heading = getFieldCaseInsensitive(row, ['heading', 'he', 'heading']);
        const rsrp = getFieldCaseInsensitive(row, ['rsrp', 'RSRP']);
        const sinr = getFieldCaseInsensitive(row, ['sinr', 'SINR']);
        const temp = getFieldCaseInsensitive(row, ['temp', 'TEMP', 'temperature']);
        
        if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0)) {
          const latf = safeParseFloat(lat);
          const lonf = safeParseFloat(lon);
          
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
                html: html,
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
          
          const tooltipContent = `<b>${serial}</b><br>Lat: ${latf}, Lon: ${lonf}<br>Azimuth: ${headingDeg}°<br>RSRP: ${rsrpVal} dBm<br>SINR: ${sinrVal} dB<br>TEMP: ${tempVal}°C`;
          
          // Bind popup for click interaction
          marker.bindPopup(tooltipContent);
          
          // Bind tooltip for hover interaction
          marker.bindTooltip(tooltipContent, {
            direction: 'top',
            offset: [0, -45]
          });
          
          markers.push(marker);
          bounds.push([latf, lonf]);
        }
      });
    } catch (err) {
      console.error(`Error fetching data for ${serial}:`, err);
    }
  }
  
  // Fit map to bounds if we have markers
  if (bounds.length > 0) {
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
