// static/js/4skelion/detailed-liveview.js
// Detailed Liveview Map Dashboard

import { CONFIG } from '../shared/config.js';
import { fetchSerialsList, fetchSerialData, fetchSerialNameMap } from '../shared/api.js';
import { isInAlarm } from './settings.js';

console.log('[Detailed Liveview] Initializing');

let mapInstance = null;
let markersMap = new Map();
let systemsData = new Map();
let selectedSerial = null;

// Initialize map
function initMap() {
  if (mapInstance) return;
  
  const mapEl = document.getElementById('map');
  if (!mapEl) return;
  
  mapInstance = L.map(mapEl).setView([CONFIG.MAP.INITIAL_LAT, CONFIG.MAP.INITIAL_LON], CONFIG.MAP.INITIAL_ZOOM);
  
  L.tileLayer(CONFIG.MAP.TILE_URL, {
    attribution: CONFIG.MAP.TILE_ATTRIBUTION,
    maxZoom: CONFIG.MAP.MAX_ZOOM
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
    
    const latest = data[0]; // Assuming first is most recent
    const lat = parseFloat(latest.LATITUDE);
    const lon = parseFloat(latest.LONGITUDE);
    const name = latest.NAME || serial;
    const earfcn = latest.EARFCN || 'N/A';
    const rsrp = latest.RSRP !== undefined ? parseFloat(latest.RSRP) : null;
    const rsrq = latest.RSRQ !== undefined ? parseFloat(latest.RSRQ) : null;
    const sinr = latest.SINR !== undefined ? parseFloat(latest.SINR) : null;
    const temp = latest.TEMP !== undefined ? parseFloat(latest.TEMP) : null;
    const a_used = latest['ANTENNA USED'] !== undefined ? parseInt(latest['ANTENNA USED']) : null;
    const lastUpdated = latest.DATETIME || null;
    
    if (!isNaN(lat) && !isNaN(lon)) {
      // Store system data
      systemsData.set(serial, {
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
      marker.setStyle({ fillColor: '#dc3545', color: '#dc3545' });
    } else {
      marker.setStyle({ fillColor: '#0d6efd', color: '#0d6efd' });
    }
  });
}

// Display system details in sidebar
function showSystemDetails(serial, systemInfo) {
  const sidebar = document.getElementById('sidebar');
  const content = document.getElementById('sidebarContent');
  
  if (!content) return;
  
  const data = systemInfo.data || {};
  
  let html = `
    <div class="mb-3">
      <h6 class="text-muted">Serial</h6>
      <p class="mb-2"><strong>${systemInfo.name || serial}</strong></p>
      <small class="text-secondary">${serial}</small>
    </div>
    
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
      <h6 class="text-muted">Sector 1</h6>
  `;
  
  if (data.RSRP !== undefined && data.RSRP !== null) {
    const rsrpAlarm = isInAlarm('rsrp', data.RSRP);
    const rsrpClass = rsrpAlarm ? 'text-danger' : 'text-success';
    html += `<p class="mb-1"><small><strong class="${rsrpClass}">RSRP:</strong> ${data.RSRP} dBm</small></p>`;
  }

  if (data.RSRQ !== undefined && data.RSRQ !== null) {
    const rsrqAlarm = isInAlarm('rsrq', data.RSRQ);
    const rsrqClass = rsrqAlarm ? 'text-danger' : 'text-success';
    html += `<p class="mb-1"><small><strong class="${rsrqClass}">RSRQ:</strong> ${data.RSRQ} dB</small></p>`;
  }
  
  if (data.SINR !== undefined && data.SINR !== null) {
    const sinrAlarm = isInAlarm('sinr', data.SINR);
    const sinrClass = sinrAlarm ? 'text-danger' : 'text-success';
    html += `<p class="mb-1"><small><strong class="${sinrClass}">SINR:</strong> ${data.SINR} dB</small></p>`;
  }
  
  if (data.TEMP !== undefined && data.TEMP !== null) {
    const tempAlarm = isInAlarm('temp', data.TEMP);
    const tempClass = tempAlarm ? 'text-danger' : 'text-success';
    html += `<p class="mb-1"><small><strong class="${tempClass}">Temperature:</strong> ${data.TEMP} °C</small></p>`;
  }
  
  html += `</div>`;
  
  if (data.DATETIME) {
    html += `
      <hr class="my-2" />
      <div>
        <small class="text-muted">Last Updated</small><br/>
        <small>${String(data.DATETIME).replace('T', ' ')}</small>
      </div>
    `;
  }
  
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
