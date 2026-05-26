// static/js/4skelion/detailed-liveview.js
// Detailed Liveview Map Dashboard

import { CONFIG } from '../shared/config.js';
import { fetchSerialsList, fetchSerialData } from '../shared/api.js';
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
  
  mapInstance = L.map(mapEl).setView(CONFIG.MAP.DEFAULT_CENTER, CONFIG.MAP.DEFAULT_ZOOM);
  
  L.tileLayer(CONFIG.MAP.TILE_LAYER, {
    attribution: CONFIG.MAP.ATTRIBUTION,
    maxZoom: CONFIG.MAP.MAX_ZOOM
  }).addTo(mapInstance);
  
  console.log('[Detailed Liveview] Map initialized');
}

// Load all systems and populate dropdown
async function loadSystems() {
  try {
    const serials = await fetchSerialsList();
    const filter = document.getElementById('systemFilter');
    
    if (!filter) return;
    
    // Clear existing options (keep "All Systems")
    while (filter.options.length > 1) {
      filter.remove(1);
    }
    
    // Add systems to dropdown
    serials.forEach(serial => {
      const option = document.createElement('option');
      option.value = serial;
      option.textContent = serial;
      filter.appendChild(option);
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
    
    if (!isNaN(lat) && !isNaN(lon)) {
      // Store system data
      systemsData.set(serial, {
        serial,
        name,
        lat,
        lon,
        data: latest
      });
      
      // Create marker
      createMarker(serial, lat, lon, name);
    }
  } catch (err) {
    console.error(`[Detailed Liveview] Error loading data for ${serial}:`, err);
  }
}

// Create marker on map
function createMarker(serial, lat, lon, name) {
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
  
  marker.bindPopup(`<strong>${name}</strong><br/>Serial: ${serial}`);
  marker.on('click', () => selectSystem(serial));
  
  markersMap.set(serial, marker);
}

// Select system from dropdown
function selectSystem(serial) {
  selectedSerial = serial;
  const filter = document.getElementById('systemFilter');
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
      <h6 class="text-muted">KPIs</h6>
  `;
  
  if (data.RSRP !== undefined && data.RSRP !== null) {
    const rsrpAlarm = isInAlarm('rsrp', data.RSRP);
    const rsrpClass = rsrpAlarm ? 'text-danger' : 'text-success';
    html += `<p class="mb-1"><small><strong class="${rsrpClass}">RSRP:</strong> ${data.RSRP} dBm</small></p>`;
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

// Initialize page
async function init() {
  console.log('[Detailed Liveview] Starting initialization');
  
  initMap();
  await loadSystems();
  
  // Load data for all systems
  const allSystems = Array.from(systemsData.keys());
  for (const serial of allSystems) {
    await loadSystemData(serial);
  }
  
  // Setup event listeners
  const filter = document.getElementById('systemFilter');
  if (filter) {
    filter.addEventListener('change', handleFilterChange);
  }
  
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
