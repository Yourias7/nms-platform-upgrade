// static/js/serials.js
// Serial list rendering and LED indicator logic

import { CONFIG } from './config.js';
import { fetchLEDStatus } from './api.js';
import { clearMapMarkers, updateMapMarkers } from './map.js';
import { getThresholds, isInAlarm } from './settings.js';
import { clearDetails } from './details.js';

// import { fetchCommunicationAlarms } from './alarms.js';
// import { isCommunicationAlarm,result } from './alarms.js';

// Module state
let serials = [];
let currentFilter = '';
let selectedSerials = [];
let serialNameMap = {};

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

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;//3 hours in milliseconds

function parseBackendDate(value) {// Parses date string from backend, handling both ISO and space-separated formats
  if (!value) return null;
  const s = String(value).trim();
  const isoish = (s.includes(' ') && !s.includes('T')) ? s.replace(' ', 'T') : s;
  const d = new Date(isoish);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getDisplayName(serial) {
  return serialNameMap?.[serial] || serial;
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

function maxLen(str, n = 20) {
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}

function showClearBtn(show) {
  const btn = document.getElementById('clearSelectedBtn');
  if (!btn) return;
  btn.style.display = show ? 'inline-block' : 'none';
}

function bindClearButton(onSelectSerial) {
  const btn = document.getElementById('clearSelectedBtn');
  if (!btn) return;

  // μην ξαναδένεις handler πολλές φορές
  if (btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    // 1) clear selected state (από το module)
    clearSelectedSerials();
    clearDetails();
    // 2) βγάλε highlight από cards
    document.querySelectorAll('.serial-card.selected')
      .forEach(el => el.classList.remove('selected'));

    // 3) κρύψε το κουμπί
    showClearBtn(false);

    // 4) δείξε πάλι όλα τα serials στον χάρτη (το τρέχον filtered list)
    // Αν έχεις currentFilter, χρησιμοποίησε το data που είδες τελευταία.
    // Εδώ απλά δείχνουμε όλα τα serials που έχει το module.
    updateMapMarkers(serials, { fit: true });

    // 5) προαιρετικά ενημέρωσε UI/Details (αν το onSelectSerial το χειρίζεται)
    try { onSelectSerial(null, null); } catch (_) {}
  });
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

  bindClearButton(onSelectSerial);
  showClearBtn(selectedSerials.length > 0);
  
  if (!data || data.length === 0) {
    serialListEl.innerHTML = '<div class="text-muted text-center p-3">No serials found</div>';
    if (serialCountEl) serialCountEl.textContent = `0`;
    clearMapMarkers();
    showClearBtn(false);
    return;
  }
  try {
  serialNameMap = await fetchSerialNameMap();
} catch (e) {
  console.warn('Failed to fetch serial->name map:', e);
  serialNameMap = {};
}

  // Update counter with filtered / total
  if (serialCountEl) serialCountEl.textContent = `${data.length}`;
  
  // Render each serial as a card with LED indicator
  for (const s of data) {
    const card = document.createElement('div');
    card.className = 'serial-card';
    
    // LED indicator: default to green
    const led = document.createElement('span');
    led.className = 'serial-card-led led-green';


    // ICON δίπλα στο LED
    const icon = document.createElement('span');
    icon.className = 'serial-plug-icon';
    icon.innerHTML = `
      <svg id="disconnect-svg" viewBox="0 0 100 100">
            <g transform="rotate(-45 50 50)">
                <path d="M50,5 L50,20" /> <path d="M35,20 A15,15 0 0 1 65,20 L65,35 L35,35 Z" /> 
                <line x1="42" y1="35" x2="42" y2="45" /> <line x1="58" y1="35" x2="58" y2="45" /> 
                <line x1="42" y1="55" x2="42" y2="65" /> <line x1="58" y1="55" x2="58" y2="65" /> 
                <path d="M35,80 A15,15 0 0 0 65,80 L65,65 L35,65 Z" /> 
                <path d="M50,80 L50,95" /> </g>
        </svg>
    `;
    // Wrap LED + plug icon on the same row
    const ledRow = document.createElement('div');
    ledRow.className = 'serial-led-plug-row';
    ledRow.appendChild(led);
    ledRow.appendChild(icon);

    // Fetch RSRP/SINR/TEMP to determine LED color
    try {
      const { rsrp, sinr, temp, lat, lon } = await fetchLEDStatus(s);
      led.className = `serial-card-led ${getLEDClass(rsrp, sinr, temp, lat, lon)}`;
    } catch (err) {
      console.warn(`Failed to fetch LED status for ${s}:`, err);
    }
    

    const text = document.createElement('div');
    text.className = 'serial-card-text';
    text.textContent = maxLen(serialNameMap[s] || s, 20);


    // text.textContent = s;

    try {
      const { rsrp, sinr, temp, lat, lon, datetime } = await fetchLEDStatus(s);
      led.className = `serial-card-led ${getLEDClass(rsrp, sinr, temp, lat, lon)}`;
      
      const last = parseBackendDate(datetime);
      if (last && (Date.now() - last.getTime() > THREE_HOURS_MS)) {
        // icon.className = 'serial-card-led led-red';
        icon.style.color = '#dc3545';
        // text.className = 'serial-card-text_red';
        card.title = `Last update: ${last.toLocaleString()}`;
      }
    } catch (err) {
      console.warn(`Failed to fetch LED status for ${s}:`, err);
    }

    
    // Click handler for entire card
    card.onclick = () => {onSelectSerial(s, card);  showClearBtn(true);};
    
    // card.appendChild(led);
    // card.appendChild(icon);
    // card.appendChild(text);
    // serialListEl.appendChild(card);
    card.appendChild(ledRow);
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