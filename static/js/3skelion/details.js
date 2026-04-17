// static/js/details.js
// Details table rendering and export functionality

import { fetchSerialData, getExportUrl } from '../shared/api.js';
import { getMarkers, getMap } from './map.js';
import { isInAlarm } from './settings.js';

// Sorting state
let currentDetailsData = [];
let currentSerial = null;
let sortColumn = null;
let sortDirection = 'asc';

const COMM_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6 hours

function formatCell(col, val) {
  if (val === null || val === undefined || val === '') return '';

  // TIME: keep SQL datetime look (no timezone conversions)
  if (col === 'TIME') return String(val).replace('T', ' ');
  const n = Number(val);
  const isNum = Number.isFinite(n);

  // coordinates: πιο πολλά δεκαδικά
  if ((col === 'LAT' || col === 'LON') && isNum) return n.toFixed(6);

  // KPIs: ωραίο rounding
  if (col === 'BEST_RSRP' && isNum) return n.toFixed(0);
  if ((col === 'BEST_RSRQ' || col === 'BEST_SNR') && isNum) return n.toFixed(2);
  if (col === 'TEMP' && isNum) return n.toFixed(1);

  return String(val);
}

// ============================
// 3skelion - Details Table (PowerBI columns + order)
// ============================
// Order matters: αυτό ακριβώς θα δει ο χρήστης στο table.
const allowedCols = [
  'SHIP',
  'SERIAL',
  'LAT',
  'LON',
  'TIME',
  'BEST_ANTENNA',
  'BEST_CELLID',
  'BEST_RSRP',
  'BEST_RSRQ',
  'BEST_SNR',
  'TEMP',
];

// Friendly headers (όπως PowerBI)
const colLabels = {
  SHIP: 'Ship',
  SERIAL: 'Serial',
  LAT: 'Lat',
  LON: 'Lon',
  BEST_ANTENNA: 'Antenna',
  BEST_CELLID: 'CellID',
  BEST_RSRP: 'RSRP (dBm)',
  BEST_RSRQ: 'RSRQ',
  BEST_SNR: 'SNR',
  TEMP: 'Temp (°C)',
};

/**
 * Sort details table by column
 * @param {string} column - Column name to sort by
 */
function sortDetailsTable(column) {
  // Toggle direction if same column, otherwise default to ascending
  if (sortColumn === column) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn = column;
    sortDirection = 'asc';
  }
  
  currentDetailsData.sort((a, b) => {
    let valA = a[column];
    let valB = b[column];
    
    // Handle null/undefined
    if (valA === null || valA === undefined) valA = '';
    if (valB === null || valB === undefined) valB = '';
    
    // Parse numbers for numeric columns
    const numericCols = ['BEST_RSRP', 'BEST_RSRQ', 'BEST_SNR', 'TEMP', 'LAT', 'LON'];
    if (numericCols.includes(column)) {
      valA = valA === '' ? -Infinity : parseFloat(valA);
      valB = valB === '' ? -Infinity : parseFloat(valB);
    } else if (column === 'TIME') {
      // Parse dates
      valA = valA === '' ? 0 : new Date(valA).getTime();
      valB = valB === '' ? 0 : new Date(valB).getTime();
    } else {
      // String comparison
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
    }
    
    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
  
  renderDetailsTable(currentSerial, currentDetailsData);
}

/**
 * Capture and export map as PNG snapshot
 * @param {string} serial - Serial number for filename
 * @returns {Promise<Blob>} PNG blob of the map
 */
async function captureMapSnapshot(serial) {
  const mapElement = document.getElementById('map');
  if (!mapElement || !window.html2canvas) return null;
  
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
 * Export serial data as zip containing CSV and map snapshot
 * @param {string} serial - Serial number
 */
async function exportSerialAsZip(serial) {
  try {
    // Fetch CSV data from server
    const response = await fetch(getExportUrl(serial));
    const csvText = await response.text();
    
    // Capture map snapshot
    const mapBlob = await captureMapSnapshot(serial);
    
    // Create zip file
    if (!window.JSZip) {
      console.error('JSZip library not loaded');
      return;
    }
    
    // Generate timestamp for filename
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    
    const zip = new JSZip();
    const zipFilename = `LiveView_${timestamp}.zip`;
    const csvFilename = `${serial}.csv`;
    const mapFilename = `map_${serial}.png`;
    
    // Add CSV to zip
    zip.file(csvFilename, csvText);
    
    // Add map snapshot if available
    if (mapBlob) {
      zip.file(mapFilename, mapBlob);
    }
    
    // Generate and download zip
    zip.generateAsync({ type: 'blob' }).then((content) => {
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  } catch (err) {
    console.error('Error creating export zip:', err);
  }
}

/**
 * Render data table for selected serial
 * @param {string} serial - Serial number
 * @param {Object[]} data - Array of data records
 */
export function renderDetailsTable(serial, data) {
  const detailsEl = document.getElementById('detailsArea');
  const exportBtn = document.getElementById('exportBtn');
  
  // Store data for sorting
  if (data !== currentDetailsData) {
    currentDetailsData = data;
    currentSerial = serial;
  }
  
  if (!data || data.length === 0) {
    detailsEl.innerHTML = '<div class="text-muted">No records found.</div>';
    exportBtn.style.display = 'none';
    return;
  }
  
  // Ορισμός labels για τις κεφαλίδες (αν θες να αλλάξεις το κείμενο που φαίνεται)
  const colLabels = {
    'TIME': 'Date/Time',
    'BEST_ANTENNA': 'Antenna',
    'BEST_RSRP': 'RSRP (dBm)', 
    'TEMP': 'Temp (°C)'
  };

  // Εμφάνιση κουμπιού export
  exportBtn.style.display = 'inline-block';
  exportBtn.textContent = 'Export CSV';
  exportBtn.onclick = (e) => {
    e.preventDefault();
    // Direct download of CSV from server
    const url = getExportUrl(serial);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${serial}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  
  const table = document.createElement('table');
  table.className = 'table table-sm table-striped';
  
  // Δημιουργία Header με sortable columns
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  allowedCols.forEach(colKey => {
    const th = document.createElement('th');
    th.textContent = colLabels[colKey] || colKey;
    th.style.cursor = 'pointer';
    th.style.userSelect = 'none';
    th.dataset.column = colKey;
    
    // Add sort indicator
    if (sortColumn === colKey) {
      const arrow = document.createElement('span');
      arrow.textContent = sortDirection === 'asc' ? ' ▲' : ' ▼';
      arrow.style.fontSize = '0.75em';
      th.appendChild(arrow);
    }
    
    // Add click handler
    th.addEventListener('click', () => sortDetailsTable(colKey));
    
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  table.appendChild(thead);
  
  // Δημιουργία Body
  const tbody = document.createElement('tbody');
  data.forEach(row => {
    const tr = document.createElement('tr');
    const tRaw = row.TIME || row.DATETIME;
    const last = tRaw ? new Date(tRaw) : null;
    const commAlarm = !last || (Date.now() - last.getTime() > COMM_THRESHOLD_MS);
    
    allowedCols.forEach(colKey => {
      const td = document.createElement('td');
      let raw = row[colKey];
      let v = formatCell(colKey, raw);
      if (v === null || v === undefined) v = '';
      
      // ΔΙΟΡΘΩΣΗ: Χρήση του colKey αντί για το ανύπαρκτο c
      const colName = String(colKey).trim().toUpperCase();
      
      // Μορφοποίηση Ημερομηνίας
      if (colName === 'TIME' && v !== '') {
        v = String(v).replace(/T/g, ' ');
      }
      
      td.textContent = v;

      // Helper to mark culprit cell (works even with .table { color: ... !important; })
      const mark = () => td.classList.add('alarm-culprit');

      // Communication culprit
      if (colName === 'TIME' && commAlarm) mark();

      // Performance culprits (use Settings thresholds)
      if (colName === 'BEST_RSRP' && isInAlarm('rsrp', raw)) mark();
      if (colName === 'BEST_SNR' && isInAlarm('sinr', raw)) mark();
      if (colName === 'TEMP' && isInAlarm('temp', raw)) mark();

      // GPS culprits (optional, but consistent with your Settings alarms)
      if (colName === 'LAT' && isInAlarm('lat', raw)) mark();
      if (colName === 'LON' && isInAlarm('lon', raw)) mark();
      
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  
  // Καθαρισμός και προσθήκη του πίνακα στο UI
  detailsEl.innerHTML = '';
  detailsEl.appendChild(table);
}

/**
 * Show loading state in details area
 */
export function showDetailsLoading() {
  const detailsEl = document.getElementById('detailsArea');
  detailsEl.innerHTML = '<div class="text-muted">Loading...</div>';
}

/**
 * Show error in details area
 * @param {string} message - Error message
 */
export function showDetailsError(message = 'Error parsing response') {
  const detailsEl = document.getElementById('detailsArea');
  detailsEl.innerHTML = `<div class="text-danger">${message}</div>`;
}

/**
 * Clear details and hide export button
 */
export function clearDetails() {
  const detailsEl = document.getElementById('detailsArea');
  const exportBtn = document.getElementById('exportBtn');
  
  detailsEl.innerHTML = 'Select a serial to view records.';
  exportBtn.style.display = 'none';
  exportBtn.href = '#';
  
  // Reset sorting state
  currentDetailsData = [];
  currentSerial = null;
  sortColumn = null;
  sortDirection = 'asc';
}

/**
 * Load and render details for a serial
 * @param {string} serial - Serial number to load
 */
export async function loadSerialDetails(serial) {
  showDetailsLoading();
  
  try {
    const data = await fetchSerialData(serial);
    renderDetailsTable(serial, data);
  } catch (err) {
    console.error(`Error loading details for ${serial}:`, err);
    showDetailsError();
  }
}