// static/js/app.js
// Main orchestrator for NMS Dashboard Page

import { CONFIG } from '../shared/config.js';
import { fetchSerialsList, fetchSerialData } from '../shared/api.js';
import { debounce } from '../shared/utils.js';
import { isInAlarm } from './settings.js';
import { initMap, preloadCustomIcon, updateMapMarkers, getMarkers, getMap, hideMapLoading } from './map.js';
import {
  getSerials,
  setSerials,
  getCurrentFilter,
  setCurrentFilter,
  getSelectedSerial,
  getSelectedSerials,
  addSelectedSerial,
  removeSelectedSerial,
  clearSelectedSerials,
  renderSerials,
  filterSerials,
  isCommAlarm,
  isPerfAlarm,
  getAlarmCategoryCounts
} from './serials.js';
import { loadSerialDetails, clearDetails } from './details.js';

// DOM elements
const filterEl = document.getElementById('filter');
const alarmCommFilterBtn = document.getElementById('alarmCommFilterBtn');
const alarmPerFilterBtn = document.getElementById('alarmPerFilterBtn');
const alarmCommCountBadge = document.getElementById('alarmCommCountBadge');
const alarmPerCountBadge = document.getElementById('alarmPerCountBadge');
const COMM_THRESHOLD_MS = 3 * 60 * 60 * 1000; // 4skelion comm alarm = 3 hours

function parseBackendDate(value) {
  if (!value) return null;
  const s = String(value).trim().replace(' ', 'T');
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

let autoRefreshTimer = null;
let alarmCommActive = false;
let alarmPerActive = false;

function updateAlarmFilterButtons() {
  if (alarmCommFilterBtn) {
    alarmCommFilterBtn.classList.toggle('btn-danger', alarmCommActive);
    alarmCommFilterBtn.classList.toggle('btn-outline-danger', !alarmCommActive);
    alarmCommFilterBtn.setAttribute('aria-pressed', alarmCommActive ? 'true' : 'false');
    alarmCommFilterBtn.textContent = alarmCommActive ? 'Communication' : 'Communication';
  }

  if (alarmPerFilterBtn) {
    alarmPerFilterBtn.classList.toggle('btn-danger', alarmPerActive);
    alarmPerFilterBtn.classList.toggle('btn-outline-danger', !alarmPerActive);
    alarmPerFilterBtn.setAttribute('aria-pressed', alarmPerActive ? 'true' : 'false');
    alarmPerFilterBtn.textContent = alarmPerActive ? 'Performance' : 'Performance';
  }
}

function updateAlarmBadges() {
  const { commCount, perfCount } = getAlarmCategoryCounts();
  if (alarmCommCountBadge) alarmCommCountBadge.textContent = `${commCount}`;
  if (alarmPerCountBadge) alarmPerCountBadge.textContent = `${perfCount}`;
}

function applyActiveFilters() {
  const currentFilter = getCurrentFilter() || '';
  filterSerials(currentFilter, handleSerialSelect, { alarmComm: alarmCommActive, alarmPer: alarmPerActive }, loadMultipleSerialDetails);
  // updateAlarmBadges();
}

/**
 * Fetch and render all serials
 */
async function fetchAndRenderSerials() {
  try {
    const serialsList = await fetchSerialsList();
    setSerials(serialsList);

    // Apply active filters so user view isn't reset by auto-refresh
    applyActiveFilters();

    // Reload details for all selected serials
    const selected = getSelectedSerials();
    if (selected.length > 0) {
      await loadMultipleSerialDetails(selected);
    }
  } catch (err) {
    const serialListEl = document.getElementById('serialList');
    serialListEl.innerHTML = '<li class="list-group-item text-danger">Error loading serials</li>';
    console.error('Error fetching serials:', err);
  }
}

/**
 * Handle serial selection/deselection
 * @param {string} serial - Serial number
 * @param {HTMLElement} card - Card element
 */
async function handleSerialSelect(serial, card) {
  if (!card) return;
  const alreadySelected = card.classList.contains('selected');

  if (alreadySelected) {
    // Deselect this serial
    card.classList.remove('selected');
    removeSelectedSerial(serial);

    // Update map and details
    const selected = getSelectedSerials();
    if (selected.length === 0) {
      // No selections - show all serials
      const currentFilter = getCurrentFilter();
      const allSerials = getSerials();
      let displaySerials = currentFilter
        ? allSerials.filter(s => s.toLowerCase().includes(currentFilter.toLowerCase()))
        : allSerials;
      //νεος τρροπος που τα σπαει τα alarms
      if (alarmCommActive || alarmPerActive) {
        displaySerials = displaySerials.filter(s => {
          const hasCommAlarm = alarmCommActive && isCommAlarm(s);
          const hasPerAlarm = alarmPerActive && isPerfAlarm(s);
          return hasCommAlarm || hasPerAlarm;
        });
      }

      updateMapMarkers(displaySerials);
      clearDetails();
    } else {
      // Show remaining selected serials
      updateMapMarkers(selected);
      await loadMultipleSerialDetails(selected);
    }
    return;
  }

  // Select: add this serial to selection
  card.classList.add('selected');
  addSelectedSerial(serial);

  // Update map to show all selected serials
  const selected = getSelectedSerials();
  updateMapMarkers(selected);

  // Load and display details for all selected serials
  await loadMultipleSerialDetails(selected);
}

/**
 * Handle filter input
 */
function handleFilter() {
  const query = filterEl.value.trim();
  filterSerials(query, handleSerialSelect, { alarmComm: alarmCommActive, alarmPer: alarmPerActive }, loadMultipleSerialDetails);
  // updateAlarmBadges();
}

function handleAlarmCommToggle() {
  alarmCommActive = !alarmCommActive;
  updateAlarmFilterButtons();
  applyActiveFilters();
}

function handleAlarmPerToggle() {
  alarmPerActive = !alarmPerActive;
  updateAlarmFilterButtons();
  applyActiveFilters();
}

/**
 * Capture and export map as PNG snapshot
 * @param {string[]} serials - Array of serial numbers for filename
 * @returns {Promise<Blob>} PNG blob of the map
 */
async function captureMapSnapshot(serials) {
  const mapElement = document.getElementById('map');
  if (!mapElement) return null;

  const mapInstance = getMap();
  if (!mapInstance) return null;

  try {
    // Save current zoom level and zoom out
    const originalZoom = mapInstance.getZoom();
    const newZoom = Math.max(originalZoom - 1, 1); // Zoom out by 1 level, minimum 1
    mapInstance.setZoom(newZoom, { animate: false });

    // Wait for zoom to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    // Get all markers and add permanent tooltips
    const markers = getMarkers();
    markers.forEach(marker => {
      const popup = marker.getPopup();
      if (popup) {
        // Create a permanent tooltip with the popup content
        const content = popup.getContent();
        marker.bindTooltip(content, {
          permanent: true,
          direction: 'top',
          className: 'map-label-tooltip',
          offset: [0, -45] // Position above the icon
        }).openTooltip();
      }
    });

    // Wait a bit for tooltips to render
    await new Promise(resolve => setTimeout(resolve, 500));

    const canvas = await html2canvas(mapElement, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      logging: false
    });

    // Remove all tooltips after capture
    markers.forEach(marker => {
      marker.unbindTooltip();
    });

    // Restore original zoom level
    mapInstance.setZoom(originalZoom, { animate: false });

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      });
    });
  } catch (err) {
    console.error('Error capturing map snapshot:', err);
    return null;
  }
}

/**
 * Export combined data from multiple serials as CSV
 * @param {Object[]} data - Combined data array
 * @param {string[]} serials - Array of serial numbers
 */
function exportCombinedCSV(data, serials) {
  if (!data || data.length === 0) return;
  
  // Create CSV content
  const allowedCols = ['SERIAL', 'NAME', 'LATITUDE', 'LONGITUDE', 'DATETIME', 'EARFCN', 'PCI', 'RSRP','RSRQ', 'SINR', 'TEMP'];
  const cols = allowedCols;
  
  const rows = [cols.join(',')];
  
  data.forEach(row => {
    const values = cols.map(col => {
      let val = row[col];
      if (val === null || val === undefined) val = '';
      // Escape values containing commas or quotes
      val = String(val);
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    });
    rows.push(values.join(','));
  });
  
  const csvContent = rows.join('\n');
  
  // Generate timestamp for filename
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const csvFilename = `LiveView_${timestamp}.csv`;
  
  // Create and download CSV file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = csvFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Load details for multiple selected serials
 * @param {string[]} serials - Array of serial numbers
 */
async function loadMultipleSerialDetails(serials) {
  if (serials.length === 0) {
    clearDetails();
    return;
  }
  
  if (serials.length === 1) {
    await loadSerialDetails(serials[0]);
    return;
  }
  
  // Multiple serials selected - show combined view
  const detailsEl = document.getElementById('detailsArea');
  const exportBtn = document.getElementById('exportBtn');
  
  detailsEl.innerHTML = '<div class="text-muted">Loading...</div>';
  exportBtn.style.display = 'none'; // Will show after data loads
  
  try {
    const allData = [];
    for (const serial of serials) {
      const data = await fetchSerialData(serial);
      if (data && data.length > 0) {
        // Add serial identifier to each row
        data.forEach(row => {
          allData.push({ SERIAL: serial, ...row });
        });
      }
    }
    
    if (allData.length === 0) {
      detailsEl.innerHTML = '<div class="text-muted">No records found for selected serials.</div>';
      exportBtn.style.display = 'none';
      return;
    }

    // Build latest DATETIME per SERIAL (to be client-friendly: highlight only the latest row)
    const latestMsBySerial = new Map();

    for (const r of allData) {
      const ser = r.SERIAL;
      const d = parseBackendDate(r.DATETIME);
      if (!ser) continue;
      if (d) {
        const ms = d.getTime();
        const prev = latestMsBySerial.get(ser);
        if (prev === undefined || ms > prev) latestMsBySerial.set(ser, ms);
      }
    }

    const commAlarmBySerial = new Map();
    for (const ser of serials) {
      const ms = latestMsBySerial.get(ser);
      const inComm = (ms === undefined) || (Date.now() - ms > COMM_THRESHOLD_MS);
      commAlarmBySerial.set(ser, inComm);
    }
    
    // Show export button for multiple serials (will export combined data as CSV)
    exportBtn.style.display = 'inline-block';
    exportBtn.textContent = 'Export CSV';
    exportBtn.onclick = (e) => {
      e.preventDefault();
      exportCombinedCSV(allData, serials);
    };
    
    // Render combined table

    const allowedCols = ['SERIAL', 'NAME', 'LATITUDE', 'LONGITUDE', 'DATETIME', 'EARFCN', 'PCI', 'ANTENNA USED', 'RSRP','RSRQ', 'SINR', 'TEMP','NODE_ID', 'SECTOR_ID'];
    const cols = allowedCols;
    const table = document.createElement('table');
    table.className = 'table table-sm table-striped';

    // Ορισμός labels για τις κεφαλίδες (αν θες να αλλάξεις το κείμενο που φαίνεται)
    const colLabels = {
      'DATETIME': 'Date/Time',
      'ANTENNA USED': 'Antenna',
      'RSRP': 'RSRP (dBm)',
      'TEMP': 'Temp (°C)'
    };

    // Δημιουργία Header
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    allowedCols.forEach(colKey => {
      const th = document.createElement('th');
      // Χρήση label αν υπάρχει, αλλιώς το όνομα της στήλης
      th.textContent = colLabels[colKey] || colKey; 
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');

    allData.forEach(row => {
      const tr = document.createElement('tr');

      // normalize keys once per row (case-insensitive)
      const rowU = {};
      for (const [k, v] of Object.entries(row || {})) {
        rowU[String(k).trim().toUpperCase()] = v;
      }

      allowedCols.forEach(colKey => {
        const td = document.createElement('td');
        const colName = String(colKey).trim().toUpperCase();

        let v = rowU[colName];
        if (v === null || v === undefined) v = '';

        // DATETIME formatting
        if (colName === 'DATETIME' && v !== '') {
          v = String(v).replace(/T/g, ' ');
        }

        td.textContent = v;

        // --- Culprit highlighting (client-friendly) ---
        const mark = () => td.classList.add('alarm-culprit');

        const rowSerial = rowU['SERIAL'];
        const latestMs = latestMsBySerial.get(rowSerial);
        const rowDt = parseBackendDate(rowU['DATETIME']);
        const isLatestRow = rowDt && latestMs !== undefined && Math.abs(rowDt.getTime() - latestMs) < 1000;

        const commAlarm = commAlarmBySerial.get(rowSerial) === true;

        // Communication culprit (latest row only)
        if (isLatestRow && commAlarm && colName === 'DATETIME') mark();

        // Performance culprits (latest row only, only KPI that fails)
        if (isLatestRow && colName === 'RSRP' && isInAlarm('rsrp', rowU['RSRP'])) mark();
        if (isLatestRow && colName === 'SINR' && isInAlarm('sinr', rowU['SINR'])) mark();
        if (isLatestRow && colName === 'TEMP' && isInAlarm('temp', rowU['TEMP'])) mark();

        // GPS culprits (optional)
        if (isLatestRow && colName === 'LATITUDE' && isInAlarm('lat', rowU['LATITUDE'])) mark();
        if (isLatestRow && colName === 'LONGITUDE' && isInAlarm('lon', rowU['LONGITUDE'])) mark();

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    
    detailsEl.innerHTML = '';
    detailsEl.appendChild(table);
      
  } catch (err) {
    detailsEl.innerHTML = '<div class="text-danger">Error loading details</div>';
    console.error('Error loading multiple serial details:', err);
  }
}

/**
 * Initialize dashboard application
 */
function init() {
  console.log('[Dashboard] Initializing');
  
  // Only initialize dashboard features if we have the serial list element (liveview page)
  const serialListEl = document.getElementById('serialList');
  if (!serialListEl) {
    console.log('[Dashboard] Not on dashboard page, skipping initialization');
    return;
  }
  
  // Initialize map and load custom icon
  preloadCustomIcon();
  initMap();
  
  // Fetch initial data
  fetchAndRenderSerials().then(() => {
    // Hide map loading overlay after initial fetch completes
    // (updateMapMarkers will also hide it, but this ensures it's hidden even if no markers)
    setTimeout(() => hideMapLoading(), 500);
  }).catch(() => {
    // Hide on error too
    hideMapLoading();
  });
  
  // Setup filter input listener
  if (filterEl) {
    filterEl.addEventListener('input', debounce(handleFilter, CONFIG.UI.FILTER_DEBOUNCE_MS));
  }

  updateAlarmFilterButtons();
  // updateAlarmBadges();
  if (alarmCommFilterBtn) {
    alarmCommFilterBtn.addEventListener('click', handleAlarmCommToggle);
  }
  if (alarmPerFilterBtn) {
    alarmPerFilterBtn.addEventListener('click', handleAlarmPerToggle);
  }
  
  const runAutoRefresh = () => {
    console.log('[Dashboard] Auto-refreshing data...');
    fetchAndRenderSerials().catch(err => {
      console.error('Auto-refresh error:', err);
    });
  };

  const startAutoRefresh = () => {
    if (autoRefreshTimer !== null) return;
    if (document.visibilityState !== 'visible') return;
    autoRefreshTimer = setInterval(runAutoRefresh, CONFIG.UI.AUTO_REFRESH_MS);
  };

  const stopAutoRefresh = () => {
    if (autoRefreshTimer === null) return;
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  };

  try {

    // Setup auto-refresh only when page is visible
    startAutoRefresh();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        startAutoRefresh();
      } else {
        stopAutoRefresh();
      }
    });
    window.addEventListener('pagehide', stopAutoRefresh);
    
    // Hide loading overlay after serials are loaded
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
    }
    // Mark page as successfully loaded
    window.markPageAsLoaded();
    console.log('[Dashboard] Initialization complete');   
  } catch (err) {
    console.error('[Dashboard] Failed to load serials', err);
    setPlaybackMessage('Failed to load serials.', 'danger');
    
    // Hide loading overlay even on error
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
    }
  }
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}