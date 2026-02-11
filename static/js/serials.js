// static/js/serials.js
// Serial list rendering and LED indicator logic

import { CONFIG } from './config.js';
import { fetchLEDStatus } from './api.js';
import { clearMapMarkers, updateMapMarkers } from './map.js';
import { getThresholds, isInAlarm } from './settings.js';
// import { fetchCommunicationAlarms } from './alarms.js';
// import { isCommunicationAlarm,result } from './alarms.js';

// Module state
let serials = [];
let currentFilter = '';
let selectedSerials = [];

/**
 * Get all serials
 * @returns {string[]}
 */
export function getSerials() {
  return serials;
}

/**
 * Set serials list
 * @param {string[]} newSerials
 */
export function setSerials(newSerials) {
  serials = newSerials;
}

/**
 * Get current filter
 * @returns {string}
 */
export function getCurrentFilter() {
  return currentFilter;
}

/**
 * Set current filter
 * @param {string} filter
 */
export function setCurrentFilter(filter) {
  currentFilter = filter;
}

/**
 * Get currently selected serial
 * @returns {string|null}
 */
export function getSelectedSerial() {
  return selectedSerials.length > 0 ? selectedSerials[0] : null;
}

/**
 * Get all currently selected serials
 * @returns {string[]}
 */
export function getSelectedSerials() {
  return selectedSerials;
}

/**
 * Set currently selected serial
 * @param {string|null} serial
 */
export function setSelectedSerial(serial) {
  selectedSerials = serial ? [serial] : [];
}

/**
 * Add a serial to the selection
 * @param {string} serial
 */
export function addSelectedSerial(serial) {
  if (!selectedSerials.includes(serial)) {
    selectedSerials.push(serial);
    selectedSerials.sort();
  }
}

/**
 * Remove a serial from the selection
 * @param {string} serial
 */
export function removeSelectedSerial(serial) {
  selectedSerials = selectedSerials.filter(s => s !== serial);
  selectedSerials.sort();
}

/**
 * Clear all selected serials
 */
export function clearSelectedSerials() {
  selectedSerials = [];
}

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

function parseBackendDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  const isoish = (s.includes(' ') && !s.includes('T')) ? s.replace(' ', 'T') : s;
  const d = new Date(isoish);
  return Number.isNaN(d.getTime()) ? null : d;
}


/**
 * Determine LED color based on RSRP/SINR/TEMP thresholds
 * @param {number|null} rsrp
 * @param {number|null} sinr
 * @param {number|null} temp
 * @param {number|null} lat
 * @param {number|null} lon
 * @returns {string} CSS class name ('led-green' or 'led-red')
 */
function getLEDClass(rsrp, sinr, temp, lat, lon) {
  // Check if any KPI is in alarm
  if (isInAlarm('rsrp', rsrp) || isInAlarm('sinr', sinr) || isInAlarm('temp', temp) || isInAlarm('lat', lat) || isInAlarm('lon', lon)) {
    return 'led-red';
  }
  return 'led-green';
}

/**
 * Render serial list with LED indicators
 * @param {string[]} data - Array of serial numbers to render
 * @param {Function} onSelectSerial - Callback when serial is selected
 */
export async function renderSerials(data, onSelectSerial) {
  const serialListEl = document.getElementById('serialList');
  const serialCountEl = document.getElementById('serialCount');
  serialListEl.innerHTML = '';
  
  if (!data || data.length === 0) {
    serialListEl.innerHTML = '<div class="text-muted text-center p-3">No serials found</div>';
    if (serialCountEl) serialCountEl.textContent = `0`;
    clearMapMarkers();
    return;
  }
  
  // Update counter with filtered / total
  if (serialCountEl) serialCountEl.textContent = `${data.length}`;
  
  // Render each serial as a card with LED indicator
  for (const s of data) {
    const card = document.createElement('div');
    card.className = 'serial-card';
    
    // LED indicator: default to green
    const led = document.createElement('div');
    led.className = 'serial-card-led led-green';
    
    // Fetch RSRP/SINR/TEMP to determine LED color
    try {
      const { rsrp, sinr, temp, lat, lon } = await fetchLEDStatus(s);
      led.className = `serial-card-led ${getLEDClass(rsrp, sinr, temp, lat, lon)}`;
    } catch (err) {
      console.warn(`Failed to fetch LED status for ${s}:`, err);
    }
    
    // Serial text
    // const text = document.createElement('div');
    // text.className = 'serial-card-text';
    // text.textContent = s;

    // 3. Logic for Red Text (Communication Alarm)
    // const THRESHOLD_HOURS = 3; //
    // let isAlarm = false;

    // if (!timestamp) {
    //   isAlarm = true; // Αν δεν υπάρχει timestamp = Alarm
    // } else {
    //   try {
    //     const lastUpdate = new Date(timestamp);
    //     const now = new Date();
    //     const diffHours = (now - lastUpdate) / (1000 * 60 * 60); //
        
    //     if (diffHours > THRESHOLD_HOURS) {
    //       isAlarm = true; //
    //     }
    //   } catch (e) {
    //     isAlarm = true; // Σε σφάλμα parsing = Alarm
    //   }
    // }
    // if (isAlarm) {
    //   text.classList.add('serial-card-text_red');
    // }
    // // edw αλλαγη color text if
    // if (isCommunicationAlarm(timestamp)) {
    //   text.classList.add('serial-card-text_red');
    // }

    const text = document.createElement('div');
    text.className = 'serial-card-text';
    text.textContent = s;

    try {
      const { rsrp, sinr, temp, lat, lon, datetime } = await fetchLEDStatus(s);
      led.className = `serial-card-led ${getLEDClass(rsrp, sinr, temp, lat, lon)}`;

      const last = parseBackendDate(datetime);
      if (last && (Date.now() - last.getTime() > THREE_HOURS_MS)) {
        text.className = 'serial-card-text_red';
        card.title = `Last update: ${last.toLocaleString()}`;
      }
    } catch (err) {
      console.warn(`Failed to fetch LED status for ${s}:`, err);
    }

    
    // Click handler for entire card
    card.onclick = () => onSelectSerial(s, card);
    
    card.appendChild(led);
    card.appendChild(text);
    serialListEl.appendChild(card);
    
    // Restore selected state if this serial was previously selected
    if (selectedSerials.includes(s)) {
      card.classList.add('selected');
    }
  }
  
  // Update map markers - use selected serials if any are active, otherwise show all filtered
  if (selectedSerials.length > 0) {
    const visibleSelected = selectedSerials.filter(s => data.includes(s));
    updateMapMarkers(visibleSelected.length > 0 ? visibleSelected : data);
  } else {
    updateMapMarkers(data);
  }
}

/**
 * Filter serials by search query
 * @param {string} query - Search string
 * @param {Function} onSelectSerial - Callback for serial selection
 */
export function filterSerials(query, onSelectSerial) {
  currentFilter = query;
  const ql = query.toLowerCase();
  
  if (!ql) {
    renderSerials(serials, onSelectSerial);
  } else {
    const filtered = serials.filter(s => s.toLowerCase().includes(ql));
    renderSerials(filtered, onSelectSerial);
  }
}
