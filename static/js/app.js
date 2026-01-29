// static/js/app.js
// Main orchestrator for NMS Dashboard - coordinates dashboard modules

import { CONFIG } from './config.js';
import { fetchSerialsList, fetchSerialData } from './api.js';
import { debounce } from './utils.js';
import { initMap, preloadCustomIcon, updateMapMarkers, getMarkers, getMap } from './map.js';
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
  filterSerials 
} from './serials.js';
import { loadSerialDetails, clearDetails } from './details.js';

// DOM elements
const filterEl = document.getElementById('filter');

/**
 * Fetch and render all serials
 */
async function fetchAndRenderSerials() {
  try {
    const serialsList = await fetchSerialsList();
    setSerials(serialsList);
    
    // Apply any active filter so user view isn't reset by auto-refresh
    const currentFilter = getCurrentFilter();
    if (currentFilter && currentFilter.trim() !== '') {
      filterSerials(currentFilter, handleSerialSelect);
    } else {
      renderSerials(serialsList, handleSerialSelect);
    }
    
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
      const displaySerials = currentFilter ? allSerials.filter(s => s.toLowerCase().includes(currentFilter.toLowerCase())) : allSerials;
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
  filterSerials(query, handleSerialSelect);
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
async function exportCombinedCSV(data, serials) {
  if (!data || data.length === 0) return;
  
  // Create CSV content
  const cols = Object.keys(data[0]);
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
  
  // Capture map snapshot
  const mapBlob = await captureMapSnapshot(serials);
  
  // Create zip file with both CSV and map image
  if (!window.JSZip) {
    console.error('JSZip library not loaded');
    return;
  }
  
  // Generate timestamp for filename
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  
  const zip = new JSZip();
  const zipFilename = `LiveView_${timestamp}.zip`;
  
  const csvFilename = serials.length > 1 
    ? `combined_${serials.join('_')}.csv`
    : `${serials[0]}.csv`;
  
  const mapFilename = serials.length > 1 
    ? `map_combined_${serials.join('_')}.png`
    : `map_${serials[0]}.png`;
  
  // Add CSV to zip
  zip.file(csvFilename, csvContent);
  
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
    
    // Show export button for multiple serials (will export combined data as ZIP)
    exportBtn.style.display = 'inline-block';
    exportBtn.textContent = 'Export ZIP';
    exportBtn.onclick = (e) => {
      e.preventDefault();
      exportCombinedCSV(allData, serials);
    };
    
    // Render combined table
    const cols = Object.keys(allData[0]);
    const table = document.createElement('table');
    table.className = 'table table-sm table-striped';
    
    // Table header
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    cols.forEach(c => {
      const th = document.createElement('th');
      th.textContent = c;
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);
    
    // Table body
    const tbody = document.createElement('tbody');
    allData.forEach(row => {
      const tr = document.createElement('tr');
      cols.forEach(c => {
        const td = document.createElement('td');
        let v = row[c];
        if (v === null || v === undefined) v = '';
        td.textContent = v;
        
        // Highlight RSRP values under -120 in red
        if (c.toUpperCase() === 'RSRP' && v !== '' && parseFloat(v) < -120) {
          td.style.color = 'red';
          td.style.fontWeight = 'bold';
        }
        
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
 * Initialize application
 */
function init() {
  console.log('[App] Dashboard page initializing...');
  
  // Initialize map and load custom icon
  preloadCustomIcon();
  initMap();
  
  // Listen for threshold updates to refresh LED indicators
  window.addEventListener('thresholds-updated', () => {
    console.log('[App] Thresholds updated, refreshing serials...');
    fetchAndRenderSerials();
  });
  
  // Fetch initial data
  fetchAndRenderSerials();
  
  // Setup filter input listener
  filterEl.addEventListener('input', debounce(handleFilter, CONFIG.UI.FILTER_DEBOUNCE_MS));
  
  // Setup auto-refresh
  setInterval(() => {
    console.log('[App] auto-refreshing data...');
    fetchAndRenderSerials().catch(err => {
      console.error('Auto-refresh error:', err);
    });
  }, CONFIG.UI.AUTO_REFRESH_MS);
  
  console.log('[App] Dashboard page initialized');
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
