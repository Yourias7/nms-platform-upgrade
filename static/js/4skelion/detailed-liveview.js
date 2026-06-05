// static/js/4skelion/detailed-liveview.js
// Detailed Liveview Map Dashboard

import { CONFIG } from '../shared/config.js';
import { loadCsvEnrichmentFromStorage } from '../shared/csv-enrichment.js';
import { fetchSerialsList, fetchSerialData, fetchSerialNameMap } from '../shared/api.js';
import { isInAlarm } from './settings.js';

console.log('[Detailed Liveview] Initializing');

let mapInstance = null;
let markersMap = new Map();
let cellMarkersMap = new Map();
let systemsData = new Map();
let selectedSerial = null;

const SYSTEM_DEFAULT_COLOR = '#0d6efd';
const SYSTEM_SELECTED_COLOR = '#dc3545';
const CELL_DEFAULT_COLOR = '#fd7e14';
const CELL_SELECTED_COLOR = '#28a745';

let csvCellIndex = {};
let csvEnbIndex = {};
let csvCellDetails = new Map();

let compassControl = null;

// Generate a directional arrow icon based on heading and color
function getDirectionalIcon(heading, color) {
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

// Add to your global variables at the top
let connectionLines = [];

// Add this helper function anywhere in the file (e.g., above selectSystem)
function clearConnectionLines() {
  connectionLines.forEach(line => {
    if (mapInstance) mapInstance.removeLayer(line);
  });
  connectionLines = [];
}

// Custom Leaflet Control for the Azimuth Compass
L.Control.Compass = L.Control.extend({
  options: {
    position: 'topleft' // Places it right under the zoom controls
  },
  onAdd: function(map) {
    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
    // Styling to match the sleek UI but stand out on the map
    container.style.backgroundColor = 'rgba(25, 30, 56, 0.9)';
    container.style.border = '1px solid rgba(102, 126, 234, 0.3)';
    container.style.padding = '10px';
    container.style.borderRadius = '8px';
    container.style.display = 'none'; // Hidden until a system is selected
    container.style.textAlign = 'center';
    container.style.width = '130px';
    container.style.backdropFilter = 'blur(4px)';

    container.innerHTML = `
      <h6 style="margin: 0 0 8px 0; font-size: 0.75rem; color: #adb5bd; text-transform: uppercase; letter-spacing: 0.5px;">Donor Azimuth</h6>
      <div style="width: 90px; height: 90px; margin: 0 auto;">
        <svg viewBox="0 0 100 100" class="w-100 h-100">
          <circle cx="50" cy="50" r="45" fill="rgba(10, 14, 39, 0.8)" stroke="#495057" stroke-width="2"/>
          <line x1="50" y1="5" x2="50" y2="10" stroke="#adb5bd" stroke-width="2"/>
          <line x1="50" y1="90" x2="50" y2="95" stroke="#adb5bd" stroke-width="2"/>
          <line x1="5" y1="50" x2="10" y2="50" stroke="#adb5bd" stroke-width="2"/>
          <line x1="90" y1="50" x2="95" y2="50" stroke="#adb5bd" stroke-width="2"/>
          
          <text x="50" y="18" text-anchor="middle" fill="#dc3545" font-weight="bold" font-size="10">N</text>
          <text x="83" y="53.5" text-anchor="middle" fill="#6c757d" font-weight="bold" font-size="9">E</text>
          <text x="50" y="88" text-anchor="middle" fill="#6c757d" font-weight="bold" font-size="9">S</text>
          <text x="17" y="53.5" text-anchor="middle" fill="#6c757d" font-weight="bold" font-size="9">W</text>
          
          <g id="mapCompassNeedle" style="transform-origin: 50px 50px; transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);">
            <polygon points="45,50 55,50 50,22" fill="#dc3545"/>
            <polygon points="45,50 55,50 50,78" fill="#adb5bd"/>
            <circle cx="50" cy="50" r="4" fill="#191e38" stroke="#adb5bd" stroke-width="1.5"/>
          </g>
        </svg>
      </div>
      <div style="margin-top: 8px; font-weight: bold; color: #0d6efd; font-size: 1.1rem;" id="mapCompassValue">--°</div>
    `;
    
    // Prevent map dragging/zooming when interacting with the compass
    L.DomEvent.disableClickPropagation(container);
    return container;
  },
  
  updateAzimuth: function(azimuth) {
    const container = this.getContainer();
    if (azimuth === null || azimuth === undefined || isNaN(azimuth)) {
      container.style.display = 'none'; // Hide if no azimuth data
      return;
    }
    
    container.style.display = 'block'; // Show it!
    const needle = container.querySelector('#mapCompassNeedle');
    const valueText = container.querySelector('#mapCompassValue');
    
    if (needle && valueText) {
      needle.style.transform = `rotate(${azimuth}deg)`;
      valueText.innerText = `${parseFloat(azimuth).toFixed(1)}°`;
    }
  },
  
  hide: function() {
    this.getContainer().style.display = 'none';
  }
});
// Draw lines between a selected system and its matching cells
function drawConnectionLines(serial) {
  clearConnectionLines();
  if (!mapInstance) return;

  const systemInfo = systemsData.get(serial);
  if (!systemInfo || !Number.isFinite(systemInfo.lat) || !Number.isFinite(systemInfo.lon)) return;

  const sysLatLng = [systemInfo.lat, systemInfo.lon];
  
  // 1. Get the Donor Sector index safely (handles "2", 2, or "Sector 2")
  let donorIndex = systemInfo.a_used;
  if (typeof donorIndex === 'string') {
    donorIndex = parseInt(donorIndex.replace(/\D/g, ''), 10);
  }
  
  // 2. Dynamically fetch the PCI, CID, and eCID for the donor sector
  let donorEcid, donorCid, donorPci;
  if (donorIndex !== null && donorIndex !== undefined && !isNaN(donorIndex)) {
    donorEcid = systemInfo[`s${donorIndex}_ecid`];
    donorCid = systemInfo[`s${donorIndex}_cid`];
    donorPci = systemInfo[`s${donorIndex}_pci`];
  }

  const normalLines = [];
  const donorLines = [];

  // Helper: Safely compare values (handles numbers vs strings and extra spaces)
  const safeMatch = (val1, val2) => {
    if (val1 === null || val1 === undefined || val1 === '' || 
        val2 === null || val2 === undefined || val2 === '') return false;
    
    // If they can both be numbers, compare them as numbers (handles "100.0" vs 100)
    if (!isNaN(Number(val1)) && !isNaN(Number(val2))) {
      return Number(val1) === Number(val2);
    }
    // Otherwise, string comparison
    return String(val1).trim().toUpperCase() === String(val2).trim().toUpperCase();
  };

  csvCellDetails.forEach(cell => {
    if (cell.associatedSerials.has(serial) && Number.isFinite(cell.lat) && Number.isFinite(cell.lon)) {
      
      let isDonor = false;
      if (donorIndex !== null && donorIndex !== undefined && !isNaN(donorIndex)) {
        const cEnr = cell.enrichment;
        
        // Helper: Case-insensitively grab CSV values
        const getCsvVal = (keyName) => {
          const key = Object.keys(cEnr).find(k => String(k).trim().toUpperCase() === keyName.toUpperCase());
          return key ? cEnr[key] : null;
        };

        const cBestPci = getCsvVal('BEST_PCI');
        const cCellId = getCsvVal('BEST_CELLID');
        const cEcid = getCsvVal('ENBID'); // In case it's specifically named eCID in CSV

        // 3. Check for a match using our safe matcher
        if (safeMatch(cBestPci, donorPci)) {
          isDonor = true;
        } else if (safeMatch(cCellId, donorCid)) {
          isDonor = true;
        } else if (safeMatch(cEcid, donorEcid)) {
          isDonor = true;
        }
      }

      // 4. Determine Styling
      const lineColor = isDonor ? CELL_SELECTED_COLOR : SYSTEM_SELECTED_COLOR; // Green if donor, Red if normal
      const lineWeight = isDonor ? 3 : 2;
      const lineOpacity = isDonor ? 0.9 : 0.6;

      const line = L.polyline([sysLatLng, [cell.lat, cell.lon]], {
        color: lineColor,
        weight: lineWeight,
        opacity: lineOpacity
      });
      
      if (isDonor) {
        donorLines.push(line);
      } else {
        normalLines.push(line);
      }
    }
  });

  // 5. Add to map (Normal red lines first, Green donor lines last to sit on top)
  normalLines.forEach(line => {
    line.addTo(mapInstance);
    connectionLines.push(line);
  });
  
  donorLines.forEach(line => {
    line.addTo(mapInstance);
    connectionLines.push(line);
  });
}


// Initialize map
function initMap() {
  if (mapInstance) return;
  
  const mapEl = document.getElementById('map');
  if (!mapEl) return;
  
  mapInstance = L.map(mapEl).setView([CONFIG.MAP.INITIAL_LAT, CONFIG.MAP.INITIAL_LON], CONFIG.MAP.INITIAL_ZOOM);
  
  L.tileLayer(CONFIG.MAP.TILE_URL, {
    attribution: CONFIG.MAP.TILE_ATTRIBUTION,
    // maxZoom: CONFIG.MAP.MAX_ZOOM
    maxZoom: 20, // Allow deeper zoom for better cell marker visibility
  }).addTo(mapInstance);

  compassControl = new L.Control.Compass();
  compassControl.addTo(mapInstance);
  
  console.log('[Detailed Liveview] Map initialized');
}

// Load all systems and populate dropdown
async function loadSystems() {
  try {
    const serials = await fetchSerialsList();
    const serialNameMap = await fetchSerialNameMap();
    const dropdownMenu = document.getElementById('serialOptions');
    
    if (!dropdownMenu) return;

    // Build array of {serial, displayName} pairs and sort by displayName
    const serialsWithNames = serials.map(serial => ({
      serial,
      displayName: serialNameMap && serialNameMap[serial] ? serialNameMap[serial] : serial
    }));
    
    serialsWithNames.sort((a, b) => a.displayName.localeCompare(b.displayName));
    
    // Clear existing options
    dropdownMenu.innerHTML = '';
    
    // Add systems to dropdown
    serialsWithNames.forEach(({serial, displayName}) => {
      const item = document.createElement('a');
      item.className = 'dropdown-item';
      item.href = '#';
      item.dataset.serial = serial;
      item.textContent = displayName;
      item.style.color = '#fff';
      item.style.padding = '10px 15px';
      item.style.display = 'block';
      item.style.textDecoration = 'none';
      item.addEventListener('click', (e) => {
        e.preventDefault();
        selectSystem(serial);
        dropdownMenu.style.display = 'none';
        const input = document.getElementById('serialInput');
        if (input) input.value = serial;
      });
      item.addEventListener('mouseenter', () => {
        item.style.background = 'rgba(13, 110, 253, 0.2)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.background = 'transparent';
      });
      dropdownMenu.appendChild(item);
      systemsData.set(serial, { serial });
    });
    
    console.log(`[Detailed Liveview] Loaded ${serials.length} systems`);
  } catch (err) {
    console.error('[Detailed Liveview] Error loading systems:', err);
  }
}

// Load system data and create marker
async function loadSystemData(serial) {
  try {
    const data = await fetchSerialData(serial);
    if (!data || data.length === 0) return;
    // GENERAL INFORMATION FIELDS
    const latest = data[0]; // Assuming first is most recent
    const lat = parseFloat(latest.LATITUDE);
    const lon = parseFloat(latest.LONGITUDE);
    const name = latest.NAME || serial;
    const lastUpdated = latest.DATETIME || null;
    const a_used = latest['ANTENNA USED'] !== undefined ? parseInt(latest['ANTENNA USED']) : null;
    const temp = latest.TEMP !== undefined ? parseFloat(latest.TEMP) : null;
    const heading = latest.HEADING !== undefined ? parseFloat(latest.HEADING) : 0;

    // BEST SECTOR KPI FIELDS
    const earfcn = latest.EARFCN || 'N/A';
    const band = latest.BAND !== undefined ? parseFloat(latest.BAND) : null;
    const rsrp = latest.RSRP !== undefined ? parseFloat(latest.RSRP) : null;
    const rsrq = latest.RSRQ !== undefined ? parseFloat(latest.RSRQ) : null;
    const sinr = latest.SINR !== undefined ? parseFloat(latest.SINR) : null;
    const pci = latest.PCI !== undefined ? parseFloat(latest.PCI) : null;
    const cid = latest.CID || null;
    const nodeid = latest.NODE_ID !== undefined ? parseFloat(latest.NODE_ID) : null;
    const sectorid = latest.SECTOR_ID !== undefined ? parseFloat(latest.SECTOR_ID) : null;
    // SECTOR 0 FIELDS
    const s0_earfcn = latest.S0_EARFCN || 'N/A';
    const s0_band = latest.S0_BAND !== undefined ? parseFloat(latest.S0_BAND) : null;
    const s0_rsrp = latest.S0_RSRP !== undefined ? parseFloat(latest.S0_RSRP) : null;
    const s0_rsrq = latest.S0_RSRQ !== undefined ? parseFloat(latest.S0_RSRQ) : null;
    const s0_sinr = latest.S0_SINR !== undefined ? parseFloat(latest.S0_SINR) : null;
    const s0_pci = latest.S0_PCI !== undefined ? parseFloat(latest.S0_PCI) : null;
    const s0_cid = latest.S0_CID || null;
    const s0_ecid = latest.S0_eCID !== undefined ? parseFloat(latest.S0_eCID) : null;
    // SECTOR 1 FIELDS
    const s1_earfcn = latest.S1_EARFCN || 'N/A';
    const s1_band = latest.S1_BAND !== undefined ? parseFloat(latest.S1_BAND) : null;
    const s1_rsrp = latest.S1_RSRP !== undefined ? parseFloat(latest.S1_RSRP) : null;
    const s1_rsrq = latest.S1_RSRQ !== undefined ? parseFloat(latest.S1_RSRQ) : null;
    const s1_sinr = latest.S1_SINR !== undefined ? parseFloat(latest.S1_SINR) : null;
    const s1_pci = latest.S1_PCI !== undefined ? parseFloat(latest.S1_PCI) : null;
    const s1_cid = latest.S1_CID || null;
    const s1_ecid = latest.S1_eCID !== undefined ? parseFloat(latest.S1_eCID) : null;
    // SECTOR 2 FIELDS
    const s2_earfcn = latest.S2_EARFCN || 'N/A';
    const s2_band = latest.S2_BAND !== undefined ? parseFloat(latest.S2_BAND) : null;
    const s2_rsrp = latest.S2_RSRP !== undefined ? parseFloat(latest.S2_RSRP) : null;
    const s2_rsrq = latest.S2_RSRQ !== undefined ? parseFloat(latest.S2_RSRQ) : null;
    const s2_sinr = latest.S2_SINR !== undefined ? parseFloat(latest.S2_SINR) : null;
    const s2_pci = latest.S2_PCI !== undefined ? parseFloat(latest.S2_PCI) : null;
    const s2_cid = latest.S2_CID || null;
    const s2_ecid = latest.S2_eCID !== undefined ? parseFloat(latest.S2_eCID) : null;
    // SECTOR 3 FIELDS
    const s3_earfcn = latest.S3_EARFCN || 'N/A';
    const s3_band = latest.S3_BAND !== undefined ? parseFloat(latest.S3_BAND) : null;
    const s3_rsrp = latest.S3_RSRP !== undefined ? parseFloat(latest.S3_RSRP) : null;
    const s3_rsrq = latest.S3_RSRQ !== undefined ? parseFloat(latest.S3_RSRQ) : null;
    const s3_sinr = latest.S3_SINR !== undefined ? parseFloat(latest.S3_SINR) : null;
    const s3_pci = latest.S3_PCI !== undefined ? parseFloat(latest.S3_PCI) : null;
    const s3_cid = latest.S3_CID || null;
    const s3_ecid = latest.S3_eCID !== undefined ? parseFloat(latest.S3_eCID) : null;

    if (!isNaN(lat) && !isNaN(lon)) {
      // Store system data
      systemsData.set(serial, {
        // General info - Best Sector
        serial,
        name,
        lat,
        lon,
        heading,
        earfcn,
        rsrp,
        rsrq,
        sinr,
        temp,
        a_used,
        lastUpdated,
        pci,
        cid,
        nodeid,
        sectorid,
        band,
        // Sector 0
        s0_earfcn,
        s0_band,
        s0_rsrp,
        s0_rsrq,
        s0_sinr,
        s0_pci,
        s0_cid,
        s0_ecid,
        // Sector 1
        s1_earfcn,
        s1_band,
        s1_rsrp,
        s1_rsrq,
        s1_sinr,
        s1_pci,
        s1_cid,
        s1_ecid,
        // Sector 2
        s2_earfcn,
        s2_band,
        s2_rsrp,  
        s2_rsrq,
        s2_sinr,
        s2_pci,
        s2_cid,
        s2_ecid,
        // Sector 3
        s3_earfcn,
        s3_band,
        s3_rsrp,
        s3_rsrq,
        s3_sinr,
        s3_pci,
        s3_cid,
        s3_ecid,
        data: latest
      });
      
      // Create marker
      createMarker(serial, lat, lon, name, earfcn, rsrp, rsrq, sinr, temp, lastUpdated, heading);
    }
  } catch (err) {
    console.error(`[Detailed Liveview] Error loading data for ${serial}:`, err);
  }
}

// Create marker on map
function createMarker(serial, lat, lon, name, earfcn, rsrp, rsrq, sinr, temp, lastUpdated, heading) {
  if (!mapInstance) return;
  
  // Remove existing marker
  if (markersMap.has(serial)) {
    mapInstance.removeLayer(markersMap.get(serial));
  }
  
  const icon = getDirectionalIcon(heading, SYSTEM_DEFAULT_COLOR);
  
  const marker = L.marker([lat, lon], {
    icon: icon,
    zIndexOffset: 100 // Keep systems visually above the cell markers
  }).addTo(mapInstance);
  
  marker.bindPopup(
    `<strong>${name}</strong><br/>
    Serial: ${serial}<br/>
    Serving EARFCN: ${earfcn}<br/>
    RSRP: ${rsrp !== null ? `${rsrp} dBm` : 'N/A'}<br/>
    RSRQ: ${rsrq !== null ? `${rsrq} dB` : 'N/A'}<br/>
    SINR: ${sinr !== null ? `${sinr} dB` : 'N/A'}<br/>
    Temperature: ${temp !== null ? `${temp} °C` : 'N/A'}<br/>
    Last Updated: ${lastUpdated ? String(lastUpdated).replace('T', ' ') : 'N/A'}<br/>
    `);
  marker.on('click', () => selectSystem(serial));
  
  markersMap.set(serial, marker);
}

function normalizeCellId(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function escapeHtml(text) {
  const str = String(text ?? '');
  return str.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCellCoordinatesFromEnrichment(enrichment) {
  if (!enrichment || typeof enrichment !== 'object') return null;
  
  const values = {};
  // Normalize all keys to lowercase for case-insensitive matching
  Object.entries(enrichment).forEach(([key, value]) => {
    if (!key) return;
    values[String(key).trim().toLowerCase()] = value;
  });

  // Look for standard location keys AND the specific Latitude_Sector / Longitude_Sector keys
  const lat = values.latitude ?? values.lat ?? values.latitude_sector;
  const lon = values.longitude ?? values.lon ?? values.long ?? values.longitude_sector;
  
  if (lat === undefined || lon === undefined || lat === '' || lon === '') return null;

  const parsedLat = parseFloat(lat);
  const parsedLon = parseFloat(lon);
  
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) return null;
  
  return { lat: parsedLat, lon: parsedLon };
}

function buildCellPopupHtml(cell) {
  let html = `<div style="min-width:220px; font-size:0.9rem;"><strong>Cell ID:</strong> ${escapeHtml(cell.cellid)}<br/>`;
  const associated = Array.from(cell.associatedSerials || []).map(escapeHtml).join(', ');
  if (associated) {
    html += `<strong>Associated Systems:</strong> ${associated}<br/>`;
  }
  if (cell.locationSource === 'system') {
    html += `<small class="text-muted">Location taken from associated system</small><br/>`;
  }

  const entries = Object.entries(cell.enrichment || {}).filter(([key]) => String(key).trim().toUpperCase() !== 'BEST_CELLID');
  entries.forEach(([key, value]) => {
    html += `<strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}<br/>`;
  });
  html += '</div>';
  return html;
}

function createCellMarker(cell, color = CELL_DEFAULT_COLOR) {
  if (!mapInstance || !cell || cell.lat === null || cell.lon === null) return;

  if (cellMarkersMap.has(cell.cellid)) {
    mapInstance.removeLayer(cellMarkersMap.get(cell.cellid));
  }

  const marker = L.circleMarker([cell.lat, cell.lon], {
    radius: 6,
    fillColor: color,
    color: color,
    weight: 2,
    opacity: 0.9,
    fillOpacity: 0.85
  }).addTo(mapInstance);

  marker.bindPopup(buildCellPopupHtml(cell));
  marker.on('click', () => marker.openPopup());

  cellMarkersMap.set(cell.cellid, marker);
}

function clearCellMarkers() {
  cellMarkersMap.forEach(marker => {
    if (mapInstance) mapInstance.removeLayer(marker);
  });
  cellMarkersMap.clear();
  csvCellDetails.clear();
}

function updateCsvCellStatusUI(count) {
  const badge = document.getElementById('cellEnrichmentBadge');
  const notLoaded = document.getElementById('cellRefNotLoaded');

  if (count > 0) {
    if (badge) {
      badge.style.display = 'inline-block';
      badge.textContent = `${count} cell${count === 1 ? '' : 's'}`;
    }
    if (notLoaded) {
      notLoaded.style.display = 'none';
    }
  } else {
    if (badge) {
      badge.style.display = 'none';
    }
    if (notLoaded) {
      notLoaded.style.display = 'inline';
    }
  }
}

function updateCellMarkerStyles(selectedSerial) {
  cellMarkersMap.forEach((marker, cellid) => {
    const cell = csvCellDetails.get(cellid);
    if (!cell) return;
    const isAssociated = selectedSerial && cell.associatedSerials.has(selectedSerial);
    const color = isAssociated ? CELL_SELECTED_COLOR : CELL_DEFAULT_COLOR;
    marker.setStyle({ fillColor: color, color: color });
  });
}

function buildCellMarkers() {
  clearCellMarkers();

  if (!csvEnbIndex || Object.keys(csvEnbIndex).length === 0) {
    updateCsvCellStatusUI(0);
    return;
  }

  const cellMap = new Map();

  systemsData.forEach(system => {
    if (!system) return;
    
    // 1. Gather and deduplicate system fields dynamically (O(1) dedup)
    const systemIdsToMatch = new Set([
      // system.nodeid, 
      system.s0_ecid, 
      system.s1_ecid, 
      system.s2_ecid, 
      system.s3_ecid
    ].map(normalizeCellId).filter(id => id !== ''));

    // 2. Cross-reference deduplicated IDs directly against the ENBID index
    systemIdsToMatch.forEach(idToMatch => {
      // O(1) Instant Lookup - gets array of cells under this ENBID
      const matchingCells = csvEnbIndex[idToMatch]; 
      if (!matchingCells) return;

      // 3. Process matched cells
      matchingCells.forEach(enrichment => {
        const cellid = enrichment.ENBID;
        const existing = cellMap.get(cellid);
        
        const coords = getCellCoordinatesFromEnrichment(enrichment);
        const lat = coords?.lat ?? (Number.isFinite(system.lat) ? system.lat : null);
        const lon = coords?.lon ?? (Number.isFinite(system.lon) ? system.lon : null);
        const locationSource = coords ? 'csv' : 'system';

        if (existing) {
          // If cell is mapped by multiple systems (e.g. overlapping IDs), attach serial
          existing.associatedSerials.add(system.serial);
          if ((existing.lat === null || existing.lon === null) && lat !== null && lon !== null) {
            existing.lat = lat;
            existing.lon = lon;
            existing.locationSource = locationSource;
          }
        } else {
          cellMap.set(cellid, {
            cellid,
            enrichment,
            associatedSerials: new Set([system.serial]),
            lat,
            lon,
            locationSource
          });
        }
      });
    });
  });

  // Plot the deduplicated maps
  let displayedCount = 0;
  cellMap.forEach(cell => {
    if (cell.lat !== null && cell.lon !== null) {
      createCellMarker(cell, CELL_DEFAULT_COLOR);
      csvCellDetails.set(cell.cellid, cell);
      displayedCount += 1;
    } else {
      console.warn(`[Detailed Liveview] Skipped CSV cell marker because coordinates were unavailable for ${cell.cellid}`);
    }
  });

  updateCsvCellStatusUI(displayedCount);
  updateCellMarkerStyles(selectedSerial);
}

// Update the loader to grab the new ENBID index
async function loadStoredCellReferenceCsv() {
  try {
    const stored = await loadCsvEnrichmentFromStorage();
    if (!stored || !stored.indexByEnb || Object.keys(stored.indexByEnb).length === 0) {
      csvCellIndex = {};
      csvEnbIndex = {};
      updateCsvCellStatusUI(0);
      return;
    }
    csvCellIndex = stored.index || {};
    csvEnbIndex = stored.indexByEnb || {}; // Assign the loaded ENBID index
    updateCsvCellStatusUI(0);
  } catch (error) {
    console.error('[Detailed Liveview] Failed to load stored CSV cell reference:', error);
    csvCellIndex = {};
    csvEnbIndex = {};
    updateCsvCellStatusUI(0);
  }
}

// Select system from dropdown
function selectSystem(serial) {
  selectedSerial = serial;
  const filter = document.getElementById('serialOptions');
  if (filter) filter.value = serial;
  
  const systemInfo = systemsData.get(serial);
  if (!systemInfo) return;
  
  // Zoom to marker
  if (systemInfo.lat && systemInfo.lon) {
    mapInstance.setView([systemInfo.lat, systemInfo.lon], 11);
  }
  
  // Show sidebar with details
  showSystemDetails(serial, systemInfo);
  
  // Highlight marker
  markersMap.forEach((marker, key) => {
    const sysInfo = systemsData.get(key);
    const heading = sysInfo ? (sysInfo.heading || 0) : 0;
    if (key === serial) {
      marker.setIcon(getDirectionalIcon(heading, SYSTEM_SELECTED_COLOR));
      marker.setZIndexOffset(1000); // Bring selected to front
    } else {
      marker.setIcon(getDirectionalIcon(heading, SYSTEM_DEFAULT_COLOR));
      marker.setZIndexOffset(100);
    }
  });

  updateCellMarkerStyles(serial);
  drawConnectionLines(serial);

  if (compassControl) {
    const azimuth = systemInfo.data ? systemInfo.data.AZIMUTH : null;
    compassControl.updateAzimuth(azimuth);
  }
}

// Display system details in sidebar
function showSystemDetails(serial, systemInfo) {
  const sidebar = document.getElementById('sidebar');
  const content = document.getElementById('sidebarContent');
  
  if (!content) return;
  
  const data = systemInfo.data || {};
  
  // 1. Master wrapper with smaller text and compact line-height
  let html = `<div style="font-size: 0.85rem; line-height: 1.3;">`;

  // 2. Header & General Info
  html += `
    <div class="mb-2">
      <h6 class="text-muted mb-1" style="font-size: 0.95rem;">Serial</h6>
      <div class="mb-1"><strong>${systemInfo.name || serial}</strong> <span class="text-secondary ms-1">(${serial})</span></div>`;

  if (data.TEMP !== undefined && data.TEMP !== null) {
    const tempAlarm = isInAlarm('temp', data.TEMP);
    const tempClass = tempAlarm ? 'text-danger' : 'text-success';
    html += `<div><strong class="${tempClass}">Temperature:</strong> ${data.TEMP} °C</div>`;
  }

  if (data.DATETIME) {
    html += `
      <div class="text-muted mt-1" style="font-size: 0.75rem;">
        Last Updated: ${String(data.DATETIME).replace('T', ' ')}
      </div>
    `;
  }
  
  html += `</div>`; // Close Header

  // 3. Location & Donor details combined to save space
  // Build the Donor Sector line dynamically to include the Compass Button if Azimuth exists
  // 3. Location & Donor details combined to save space
  let donorHtml = `<div><strong>Donor Sector:</strong> ${systemInfo.a_used ?? 'N/A'}`;
  
  if (data.AZIMUTH !== undefined && data.AZIMUTH !== null) {
    donorHtml += ` | <strong>Azimuth:</strong> ${data.AZIMUTH}°`;
  }
  donorHtml += `</div>`;

  html += `
    <hr class="my-1" />
    <div class="mb-2">
      <h6 class="text-muted mb-1" style="font-size: 0.95rem;">Location & Donor</h6>
      <div><strong>Lat:</strong> ${systemInfo.lat ? systemInfo.lat.toFixed(6) : 'N/A'} | <strong>Lon:</strong> ${systemInfo.lon ? systemInfo.lon.toFixed(6) : 'N/A'}</div>
      ${donorHtml}
    </div>
  `;
  // 4. DRY Helper function to cleanly generate Sectors
  const renderSector = (title, ecid, cid, earfcn, band, pci, rsrp, rsrq, sinr) => {
    // Skip rendering if no data exists for this sector
    if (ecid === undefined && earfcn === undefined && rsrp === undefined) return '';

    // --- NEW ROBUST LOGIC: Match via ENBID first, then pinpoint by PCI ---
    let cellName = "TBD";
    let matchedEnrichment = null;

    // Gather all possible IDs the system might use to refer to the ENBID
    const candIds = [ecid, cid, systemInfo.nodeid]
      .filter(id => id !== undefined && id !== null)
      .map(normalizeCellId);

    // 1. Search the ENBID Index (Since system IDs map to ENBID in the CSV)
    if (typeof csvEnbIndex !== 'undefined' && csvEnbIndex) {
      for (const id of candIds) {
        if (csvEnbIndex[id]) {
          const cellsUnderEnb = csvEnbIndex[id];
          
          // Try to pinpoint the exact sector using its unique PCI
          if (pci !== undefined && pci !== null) {
            matchedEnrichment = cellsUnderEnb.find(c => String(c.PCI) === String(pci) || String(c.BEST_PCI) === String(pci));
          }
          // Fallback 1: Try pinpointing by CID matching BEST_CELLID
          if (!matchedEnrichment && cid !== undefined && cid !== null) {
            matchedEnrichment = cellsUnderEnb.find(c => String(c.BEST_CELLID) === String(cid));
          }
          // Fallback 2: At least grab the first cell from this ENBID so we have a name instead of TBD
          if (!matchedEnrichment && cellsUnderEnb.length > 0) {
            matchedEnrichment = cellsUnderEnb[0];
          }
          
          if (matchedEnrichment) break;
        }
      }
    }

    // 2. Safety Net: Direct BEST_CELLID lookup just in case the system actually passed a Cell ID
    if (!matchedEnrichment && typeof csvCellIndex !== 'undefined' && csvCellIndex) {
      for (const id of candIds) {
        if (csvCellIndex[id]) {
          matchedEnrichment = csvCellIndex[id];
          break;
        }
      }
    }

    // 3. Extract the Cell Name (Case-Insensitive)
    if (matchedEnrichment) {
      const nameKey = Object.keys(matchedEnrichment).find(k => k.toUpperCase() === 'CELL_NAME');
      if (nameKey && matchedEnrichment[nameKey]) {
        cellName = matchedEnrichment[nameKey];
      }
    }
    let secHtml = `
      <hr class="my-1" />
      <div class="mb-2">
        <h6 class="text-muted mb-1" style="font-size: 0.95rem;">${title}</h6>
        <div class="mb-1">
    `;

    // Row 1: Identifiers
    const ids = [];
    if (ecid !== undefined && ecid !== null) ids.push(`<strong>eCID:</strong> ${ecid}`);
    if (cid !== undefined && cid !== null) ids.push(`<strong>CID:</strong> ${cid}`);
    ids.push(`<strong>Name:</strong> ${cellName}`);
    secHtml += ids.join(' | ') + `<br/>`;

    // Row 2: Radio Config
    const radio = [];
    if (earfcn !== undefined && earfcn !== null) radio.push(`<strong>EARFCN:</strong> ${earfcn}`);
    if (band !== undefined && band !== null) radio.push(`<strong>BAND:</strong> ${band}`);
    if (pci !== undefined && pci !== null) radio.push(`<strong>PCI:</strong> ${pci}`);
    if (radio.length > 0) secHtml += radio.join(' | ') + `<br/>`;

    // Row 3: KPIs
    const kpis = [];
    if (rsrp !== undefined && rsrp !== null) {
      kpis.push(`<strong class="${isInAlarm('rsrp', rsrp) ? 'text-danger' : 'text-success'}">RSRP:</strong> ${rsrp} dBm`);
    }
    if (rsrq !== undefined && rsrq !== null) {
      kpis.push(`<strong class="${isInAlarm('rsrq', rsrq) ? 'text-danger' : 'text-success'}">RSRQ:</strong> ${rsrq} dB`);
    }
    if (sinr !== undefined && sinr !== null) {
      kpis.push(`<strong class="${isInAlarm('sinr', sinr) ? 'text-danger' : 'text-success'}">SINR:</strong> ${sinr} dB`);
    }
    if (kpis.length > 0) secHtml += kpis.join(' | ');

    secHtml += `</div></div>`;
    return secHtml;
  };

  // 5. Build sectors dynamically
  html += renderSector('Sector 0', data.S0_eCID, data.S0_CID, data.S0_EARFCN, data.S0_BAND, data.S0_PCI, data.S0_RSRP, data.S0_RSRQ, data.S0_SINR);
  html += renderSector('Sector 1', data.S1_eCID, data.S1_CID, data.S1_EARFCN, data.S1_BAND, data.S1_PCI, data.S1_RSRP, data.S1_RSRQ, data.S1_SINR);
  html += renderSector('Sector 2', data.S2_eCID, data.S2_CID, data.S2_EARFCN, data.S2_BAND, data.S2_PCI, data.S2_RSRP, data.S2_RSRQ, data.S2_SINR);
  html += renderSector('Sector 3', data.S3_eCID, data.S3_CID, data.S3_EARFCN, data.S3_BAND, data.S3_PCI, data.S3_RSRP, data.S3_RSRQ, data.S3_SINR);

  html += `</div>`; // Close master wrapper
  
  content.innerHTML = html;
  
  // Open sidebar
  sidebar.classList.add('open');
}

// Handle dropdown change
function handleFilterChange(e) {
  const serial = e.target.value;
  if (serial) {
    selectSystem(serial);
  } else {
    // Show all markers
    closeSidebar();
    clearConnectionLines();
    markersMap.forEach((marker, key) => {
      const sysInfo = systemsData.get(key);
      const heading = sysInfo ? (sysInfo.heading || 0) : 0;
      marker.setIcon(getDirectionalIcon(heading, SYSTEM_DEFAULT_COLOR));
      marker.setZIndexOffset(100);
    });
  }
}

// Close sidebar
function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.remove('open');
  selectedSerial = null;
  clearConnectionLines();
  if (compassControl) compassControl.hide();
}

// Setup dropdown event listeners
function setupDropdownListeners() {
  const input = document.getElementById('serialInput');
  const dropdownMenu = document.getElementById('serialOptions');
  
  if (!input || !dropdownMenu) return;
  
  // Show dropdown on input focus
  input.addEventListener('focus', () => {
    dropdownMenu.style.display = 'block';
  });
  
  // Filter dropdown items as user types
  input.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const items = dropdownMenu.querySelectorAll('a.dropdown-item');
    
    items.forEach(item => {
      const itemText = item.textContent.toLowerCase();
      if (itemText.includes(searchTerm)) {
        item.style.display = 'block';
      } else {
        item.style.display = 'none';
      }
    });
  });
  
  // Prevent form submission/navigation on input
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // If there's a matching item, select it
      const items = dropdownMenu.querySelectorAll('a.dropdown-item');
      const firstVisible = Array.from(items).find(item => item.style.display !== 'none');
      if (firstVisible) {
        firstVisible.click();
      }
    }
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdownMenu.contains(e.target)) {
      dropdownMenu.style.display = 'none';
    }
  });
}

// Refresh map data without reloading the page
async function refreshData() {
  const btn = document.getElementById('refreshMapBtn');
  const originalText = btn ? btn.innerHTML : '';
  
  // Set loading state
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = 'Refreshing...';
  }

  console.log('[Detailed Liveview] Refreshing map data...');

  try {
    // 1. Re-fetch systems and update the dropdown
    await loadSystems();
    
    // 2. Fetch the latest telemetry/location for all systems
    const allSystems = Array.from(systemsData.keys());
    for (const serial of allSystems) {
      await loadSystemData(serial);
    }

    // 3. Re-build the cell markers based on the fresh system data
    buildCellMarkers();

    // 4. Update the sidebar and marker colors if a system is currently selected
    if (selectedSerial) {
      selectSystem(selectedSerial);
    }

    console.log('[Detailed Liveview] Map data refreshed successfully');
  } catch (error) {
    console.error('[Detailed Liveview] Error refreshing map data:', error);
  } finally {
    // Restore button state
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}

// Initialize page
async function init() {
  console.log('[Detailed Liveview] Starting initialization');
  
  initMap();
  await loadSystems();
  setupDropdownListeners();
  
  // Load data for all systems
  const allSystems = Array.from(systemsData.keys());
  for (const serial of allSystems) {
    await loadSystemData(serial);
  }

  await loadStoredCellReferenceCsv();
  buildCellMarkers();
  
  // Setup event listeners for sidebar
  const closeBtn = document.getElementById('closeSidebar');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeSidebar);
  }

  // Setup event listener for the refresh button
  const refreshBtn = document.getElementById('refreshMapBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshData);
  }
  
  // Mark page as loaded
  window.markPageAsLoaded?.();
  console.log('[Detailed Liveview] Initialization complete');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
