// static/js/details.js
// Details table rendering and export functionality

import { fetchSerialData, getExportUrl } from './api.js';
import { getMarkers, getMap } from './map.js';

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
  
  if (!data || data.length === 0) {
    detailsEl.innerHTML = '<div class="text-muted">No records found.</div>';
    exportBtn.style.display = 'none';
    return;
  }
  
  // Show export button with custom click handler for map snapshot
  exportBtn.style.display = 'inline-block';
  exportBtn.textContent = 'Export ZIP';
  exportBtn.onclick = async (e) => {
    e.preventDefault();
    await exportSerialAsZip(serial);
  };
  
  // Build table
  const cols = Object.keys(data[0]);
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
  data.forEach(row => {
    const tr = document.createElement('tr');
    cols.forEach(c => {
      const td = document.createElement('td');
      let v = row[c];
      if (v === null || v === undefined) v = '';
      td.textContent = v;
      
      // Highlight RSRP values under -120 in red
      if (c.toUpperCase() === 'RSRP' && v !== '' && parseFloat(v) <= -120) {
        td.style.color = 'red';
        td.style.fontWeight = 'bold';
      }

      // Highlight RSRP values under -120 in red
      if (c.toUpperCase() === 'SINR' && v !== '' && parseFloat(v) <= 0) {
        td.style.color = 'red';
        td.style.fontWeight = 'bold';
      }
      
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  
  // Clear and append
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
