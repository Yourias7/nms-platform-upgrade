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
      createMarker(serial, lat, lon, name, earfcn, rsrp, rsrq, sinr, temp, lastUpdated);
    }
  } catch (err) {
    console.error(`[Detailed Liveview] Error loading data for ${serial}:`, err);
  }
}

// Create marker on map
function createMarker(serial, lat, lon, name, earfcn, rsrp, rsrq, sinr, temp, lastUpdated) {
  if (!mapInstance) return;
  
  // Remove existing marker
  if (markersMap.has(serial)) {
    mapInstance.removeLayer(markersMap.get(serial));
  }
  
  const marker = L.circleMarker([lat, lon], {
    radius: 8,
    fillColor: '#0d6efd',
    color: '#0d6efd',
    weight: 2,
    opacity: 0.8,
    fillOpacity: 0.7
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
    mapInstance.setView([systemInfo.lat, systemInfo.lon], 15);
  }
  
  // Show sidebar with details
  showSystemDetails(serial, systemInfo);
  
  // Highlight marker
  markersMap.forEach((marker, key) => {
    if (key === serial) {
      marker.setStyle({ fillColor: SYSTEM_SELECTED_COLOR, color: SYSTEM_SELECTED_COLOR });
    } else {
      marker.setStyle({ fillColor: SYSTEM_DEFAULT_COLOR, color: SYSTEM_DEFAULT_COLOR });
    }
  });

  updateCellMarkerStyles(serial);
}

// Display system details in sidebar
function showSystemDetails(serial, systemInfo) {
  const sidebar = document.getElementById('sidebar');
  const content = document.getElementById('sidebarContent');
  
  if (!content) return;
  
  const data = systemInfo.data || {};

  const cellname = "TBD"; // Placeholder for cell name if available in future
  
  let html = `
    <div class="mb-3">
      <h6 class="text-muted">Serial</h6>
      <p class="mb-2"><strong>${systemInfo.name || serial}</strong></p>
      <small class="text-secondary">${serial}</small>`;
    // Show temperature with alarm status
      if (data.TEMP !== undefined && data.TEMP !== null) {
      const tempAlarm = isInAlarm('temp', data.TEMP);
      const tempClass = tempAlarm ? 'text-danger' : 'text-success';
      html += `<p class="mb-1"><small><strong class="${tempClass}">Temperature:</strong> ${data.TEMP} °C</small></p>`;
    }
    // Show last updated time
    if (data.DATETIME) {
      html += `
      
        <div>
          <small class="text-muted">Last Updated</small><br/>
          <small>${String(data.DATETIME).replace('T', ' ')}</small>
        </div>
        </div>
      `;
    }
    // Show location and donor details
    html +=`
    <hr class="my-2" />
    
    <div class="mb-3">
      <h6 class="text-muted">Location</h6>
      <p class="mb-1"><small><strong>Latitude:</strong> ${systemInfo.lat ? systemInfo.lat.toFixed(6) : 'N/A'}</small></p>
      <p class="mb-2"><small><strong>Longitude:</strong> ${systemInfo.lon ? systemInfo.lon.toFixed(6) : 'N/A'}</small></p>
    </div>
    <hr class="my-2" />
    
    <div class="mb-3">
      <h6 class="text-muted">Donor Details</h6>
      <p class="mb-1"><small><strong>Donor Sector:</strong> ${systemInfo.a_used ?? 'N/A'}</small></p>
    </div>
    <hr class="my-2" />
    <div class="mb-3">
      <h6 class="text-muted">Sector 0</h6>
  `;
  // Show SECTOR 0 Cell Info (EARFCN, BAND, PCI) with cell name if available

  html += `<p`;
  if (data.S0_eCID !== undefined && data.S0_eCID !== null) {
    html += `class="mb-1"><small><strong>eCID:</strong> ${data.S0_eCID} </small>`;
  }

  if (data.S0_CID !== undefined && data.S0_CID !== null) {
    html += `<small><strong>CID:</strong> ${data.S0_CID} </small>`;
  }

  if (cellname !== undefined && cellname !== null) {
    html += `<small><strong>Cell Name:</strong> ${cellname} </small>`;
  }

  html += `</p>`;

  html += `<p`;
  if (data.S0_EARFCN !== undefined && data.S0_EARFCN !== null) {
    html += `class="mb-1"><small><strong>EARFCN:</strong> ${data.S0_EARFCN} </small>`;
  }

  if (data.S0_BAND !== undefined && data.S0_BAND !== null) {
    html += `<small><strong>BAND:</strong> ${data.S0_BAND} </small>`;
  }

  if (data.S0_PCI !== undefined && data.S0_PCI !== null) {
    html += `<small><strong>PCI:</strong> ${data.S0_PCI}</small>`;
  }

  html += `</p>`;

  // SECTOR 0 RSRP, RSRQ, SINR with alarm status
  if (data.RSRP !== undefined && data.RSRP !== null) {
    const rsrpAlarm = isInAlarm('rsrp', data.RSRP);
    const rsrpClass = rsrpAlarm ? 'text-danger' : 'text-success';
    html += `<p class="mb-1"><small><strong class="${rsrpClass}">RSRP:</strong> ${data.S0_RSRP} dBm</small></p>`;
  }

  if (data.RSRQ !== undefined && data.RSRQ !== null) {
    const rsrqAlarm = isInAlarm('rsrq', data.RSRQ);
    const rsrqClass = rsrqAlarm ? 'text-danger' : 'text-success';
    html += `<p class="mb-1"><small><strong class="${rsrqClass}">RSRQ:</strong> ${data.S0_RSRQ} dB</small></p>`;
  }
  
  if (data.SINR !== undefined && data.SINR !== null) {
    const sinrAlarm = isInAlarm('sinr', data.SINR);
    const sinrClass = sinrAlarm ? 'text-danger' : 'text-success';
    html += `<p class="mb-1"><small><strong class="${sinrClass}">SINR:</strong> ${data.S0_SINR} dB</small></p>`;
  }
  
  
  html += `</div>`;

  html += `
  </div>
    <hr class="my-2" />
    <div class="mb-3">
      <h6 class="text-muted">Sector 1</h6>
  `;
  // Show SECTOR 1 Cell Info (EARFCN, BAND, PCI) with cell name if available

  html += `<p`;
  if (data.S1_eCID !== undefined && data.S1_eCID !== null) {
    html += `class="mb-1"><small><strong>eCID:</strong> ${data.S1_eCID} </small>`;
  }

  if (data.S1_CID !== undefined && data.S1_CID !== null) {
    html += `<small><strong>CID:</strong> ${data.S1_CID} </small>`;
  }

  if (cellname !== undefined && cellname !== null) {
    html += `<small><strong>Cell Name:</strong> ${cellname} </small>`;
  }

  html += `</p>`;

  html += `<p`;
  if (data.S1_EARFCN !== undefined && data.S1_EARFCN !== null) {
    html += `class="mb-1"><small><strong>EARFCN:</strong> ${data.S1_EARFCN} </small>`;
  }

  if (data.S1_BAND !== undefined && data.S1_BAND !== null) {
    html += `<small><strong>BAND:</strong> ${data.S1_BAND} </small>`;
  }

  if (data.S1_PCI !== undefined && data.S1_PCI !== null) {
    html += `<small><strong>PCI:</strong> ${data.S1_PCI}</small>`;
  }

  html += `</p>`;

  // SECTOR 1 RSRP, RSRQ, SINR with alarm status
  if (data.RSRP !== undefined && data.RSRP !== null) {
    const rsrpAlarm = isInAlarm('rsrp', data.RSRP);
    const rsrpClass = rsrpAlarm ? 'text-danger' : 'text-success';
    html += `<p class="mb-1"><small><strong class="${rsrpClass}">RSRP:</strong> ${data.S1_RSRP} dBm</small></p>`;
  }

  if (data.RSRQ !== undefined && data.RSRQ !== null) {
    const rsrqAlarm = isInAlarm('rsrq', data.RSRQ);
    const rsrqClass = rsrqAlarm ? 'text-danger' : 'text-success';
    html += `<p class="mb-1"><small><strong class="${rsrqClass}">RSRQ:</strong> ${data.S1_RSRQ} dB</small></p>`;
  }
  
  if (data.SINR !== undefined && data.SINR !== null) {
    const sinrAlarm = isInAlarm('sinr', data.SINR);
    const sinrClass = sinrAlarm ? 'text-danger' : 'text-success';
    html += `<p class="mb-1"><small><strong class="${sinrClass}">SINR:</strong> ${data.S1_SINR} dB</small></p>`;
  }
  
  
  html += `</div>`;

  html += `
  </div>
    <hr class="my-2" />
    <div class="mb-3">
      <h6 class="text-muted">Sector 2</h6>
  `;
  // Show SECTOR 2 Cell Info (EARFCN, BAND, PCI) with cell name if available

  html += `<p`;
  if (data.S2_eCID !== undefined && data.S2_eCID !== null) {
    html += `class="mb-1"><small><strong>eCID:</strong> ${data.S2_eCID} </small>`;
  }

  if (data.S2_CID !== undefined && data.S2_CID !== null) {
    html += `<small><strong>CID:</strong> ${data.S2_CID} </small>`;
  }

  if (cellname !== undefined && cellname !== null) {
    html += `<small><strong>Cell Name:</strong> ${cellname} </small>`;
  }

  html += `</p>`;

  html += `<p`;
  if (data.S2_EARFCN !== undefined && data.S2_EARFCN !== null) {
    html += `class="mb-1"><small><strong>EARFCN:</strong> ${data.S2_EARFCN} </small>`;
  }

  if (data.S2_BAND !== undefined && data.S2_BAND !== null) {
    html += `<small><strong>BAND:</strong> ${data.S2_BAND} </small>`;
  }

  if (data.S2_PCI !== undefined && data.S2_PCI !== null) {
    html += `<small><strong>PCI:</strong> ${data.S2_PCI}</small>`;
  }

  html += `</p>`;

  // SECTOR 2 RSRP, RSRQ, SINR with alarm status
  if (data.RSRP !== undefined && data.RSRP !== null) {
    const rsrpAlarm = isInAlarm('rsrp', data.RSRP);
    const rsrpClass = rsrpAlarm ? 'text-danger' : 'text-success';
    html += `<p class="mb-1"><small><strong class="${rsrpClass}">RSRP:</strong> ${data.S2_RSRP} dBm</small></p>`;
  }

  if (data.RSRQ !== undefined && data.RSRQ !== null) {
    const rsrqAlarm = isInAlarm('rsrq', data.RSRQ);
    const rsrqClass = rsrqAlarm ? 'text-danger' : 'text-success';
    html += `<p class="mb-1"><small><strong class="${rsrqClass}">RSRQ:</strong> ${data.S2_RSRQ} dB</small></p>`;
  }
  
  if (data.SINR !== undefined && data.SINR !== null) {
    const sinrAlarm = isInAlarm('sinr', data.SINR);
    const sinrClass = sinrAlarm ? 'text-danger' : 'text-success';
    html += `<p class="mb-1"><small><strong class="${sinrClass}">SINR:</strong> ${data.S2_SINR} dB</small></p>`;
  }
  
  
  html += `</div>`;
  
 html += `
  </div>
    <hr class="my-2" />
    <div class="mb-3">
      <h6 class="text-muted">Sector 3</h6>
  `;
  // Show SECTOR 3 Cell Info (EARFCN, BAND, PCI) with cell name if available

  html += `<p`;
  if (data.S3_eCID !== undefined && data.S3_eCID !== null) {
    html += `class="mb-1"><small><strong>eCID:</strong> ${data.S3_eCID} </small>`;
  }

  if (data.S3_CID !== undefined && data.S3_CID !== null) {
    html += `<small><strong>CID:</strong> ${data.S3_CID} </small>`;
  }

  if (cellname !== undefined && cellname !== null) {
    html += `<small><strong>Cell Name:</strong> ${cellname} </small>`;
  }

  html += `</p>`;

  html += `<p`;
  if (data.S3_EARFCN !== undefined && data.S3_EARFCN !== null) {
    html += `class="mb-1"><small><strong>EARFCN:</strong> ${data.S3_EARFCN} </small>`;
  }

  if (data.S3_BAND !== undefined && data.S3_BAND !== null) {
    html += `<small><strong>BAND:</strong> ${data.S3_BAND} </small>`;
  }

  if (data.S3_PCI !== undefined && data.S3_PCI !== null) {
    html += `<small><strong>PCI:</strong> ${data.S3_PCI}</small>`;
  }

  html += `</p>`;

  // SECTOR 3 RSRP, RSRQ, SINR with alarm status
  if (data.RSRP !== undefined && data.RSRP !== null) {
    const rsrpAlarm = isInAlarm('rsrp', data.RSRP);
    const rsrpClass = rsrpAlarm ? 'text-danger' : 'text-success';
    html += `<p class="mb-1"><small><strong class="${rsrpClass}">RSRP:</strong> ${data.S3_RSRP} dBm</small></p>`;
  }

  if (data.RSRQ !== undefined && data.RSRQ !== null) {
    const rsrqAlarm = isInAlarm('rsrq', data.RSRQ);
    const rsrqClass = rsrqAlarm ? 'text-danger' : 'text-success';
    html += `<p class="mb-1"><small><strong class="${rsrqClass}">RSRQ:</strong> ${data.S3_RSRQ} dB</small></p>`;
  }
  
  if (data.SINR !== undefined && data.SINR !== null) {
    const sinrAlarm = isInAlarm('sinr', data.SINR);
    const sinrClass = sinrAlarm ? 'text-danger' : 'text-success';
    html += `<p class="mb-1"><small><strong class="${sinrClass}">SINR:</strong> ${data.S3_SINR} dB</small></p>`;
  }
  
  
  html += `</div>`;
  

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
    markersMap.forEach(marker => {
      marker.setStyle({ fillColor: '#0d6efd', color: '#0d6efd' });
    });
  }
}

// Close sidebar
function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.remove('open');
  selectedSerial = null;
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
