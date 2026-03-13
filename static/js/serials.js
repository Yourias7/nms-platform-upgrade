// static/js/serials.js
// Serial list rendering and LED indicator logic

import { CONFIG } from './config.js';
import { fetchSerialData, fetchSerialNameMap } from './api.js';
import { buildMarkerTooltipContent, clearMapMarkers, updateMapMarkers, tooltipHtmlToPlainText } from './map.js';
import { getThresholds, isInAlarm } from './settings.js';
import { clearDetails } from './details.js';
import { getFieldCaseInsensitive } from './utils.js';

// import { fetchCommunicationAlarms } from './alarms.js';
// import { isCommunicationAlarm,result } from './alarms.js';

// Module state
let serials = [];
let currentFilter = '';
let selectedSerials = [];
let serialNameMap = {};
let serialAlarmCache = new Map();
let currentlyRenderedSerials = [];

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
  const serialSet = new Set(newSerials);
  serialAlarmCache.forEach((_, serial) => {
    if (!serialSet.has(serial)) {
      serialAlarmCache.delete(serial);
    }
  });
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

/**
 * Select all currently rendered serials
 */
export function selectAllRenderedSerials() {
  selectedSerials = [...currentlyRenderedSerials];
  selectedSerials.sort();
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

export function isSerialInAlarm(serial) {
  return serialAlarmCache.get(serial) === true;
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

function bindSelectAllButton(onSelectSerial, loadMultipleDetails) {
  const btn = document.getElementById('selectAllBtn');
  if (!btn) return;

  // μην ξαναδένεις handler πολλές φορές
  if (btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // 1) Select all currently rendered serials
    selectAllRenderedSerials();

    // 2) Add selected class to all cards
    document.querySelectorAll('.serial-card')
      .forEach(el => el.classList.add('selected'));

    // 3) Show the clear button
    showClearBtn(true);

    // 4) Update map to show selected serials
    updateMapMarkers(selectedSerials);

    // 5) Load details for all selected serials
    if (loadMultipleDetails) {
      await loadMultipleDetails(selectedSerials);
    }
  });
}



/**
 * Render serial list with LED indicators
 * @param {string[]} data - Array of serial numbers to render
 * @param {Function} onSelectSerial - Callback when serial is selected
 * @param {Function} loadMultipleDetails - Function to load details for multiple serials
 */
export async function renderSerials(data, onSelectSerial, loadMultipleDetails = null) {
  const serialListEl = document.getElementById('serialList');
  const serialCountEl = document.getElementById('serialCount');
  serialListEl.innerHTML = '';

  currentlyRenderedSerials = data;

  bindClearButton(onSelectSerial);
  bindSelectAllButton(onSelectSerial, loadMultipleDetails);
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

    const text = document.createElement('div');
    text.className = 'serial-card-text';
    text.textContent = maxLen(serialNameMap[s] || s, 20);


    // text.textContent = s;

    try {
      const records = await fetchSerialData(s);
      const latest = records && records.length > 0 ? records[0] : null;

      const rsrp = latest ? getFieldCaseInsensitive(latest, ['rsrp', 'RSRP']) : null;
      const sinr = latest ? getFieldCaseInsensitive(latest, ['sinr', 'SINR']) : null;
      const temp = latest ? getFieldCaseInsensitive(latest, ['temp', 'TEMP', 'temperature']) : null;
      const lat = latest ? getFieldCaseInsensitive(latest, ['latitude', 'lat']) : null;
      const lon = latest ? getFieldCaseInsensitive(latest, ['longitude', 'lon']) : null;
      const datetime = latest ? getFieldCaseInsensitive(latest, ['datetime', 'DATETIME']) : null;

      const ledClass = getLEDClass(rsrp, sinr, temp, lat, lon);
      led.className = `serial-card-led ${ledClass}`;

      if (latest) {
        const tooltipHtml = buildMarkerTooltipContent(latest, s);
        card.title = tooltipHtmlToPlainText(tooltipHtml);
      }
      
      const last = parseBackendDate(datetime);
      const inCommunicationAlarm = !last || (Date.now() - last.getTime() > THREE_HOURS_MS);
      const inKpiAlarm = ledClass === 'led-red';
      serialAlarmCache.set(s, inCommunicationAlarm || inKpiAlarm);

      if (last && (Date.now() - last.getTime() > THREE_HOURS_MS)) {
        // icon.className = 'serial-card-led led-red';
        icon.style.color = '#dc3545';
        // text.className = 'serial-card-text_red';
      }
    } catch (err) {
      serialAlarmCache.set(s, false);
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
 * Searches both serial numbers and system names
 * @param {string} query - Search string
 * @param {Function} onSelectSerial - Callback for serial selection
 * @param {Function} loadMultipleDetails - Function to load details for multiple serials
 */
export function filterSerials(query, onSelectSerial, options = {}, loadMultipleDetails = null) {
  const { alarmOnly = false } = options;
  currentFilter = query;
  const ql = query.toLowerCase();
  let filtered = serials;
  
  if (ql) {
    filtered = filtered.filter(s => {
      const serialMatch = s.toLowerCase().includes(ql);
      const nameMatch = serialNameMap[s]?.toLowerCase().includes(ql) || false;
      return serialMatch || nameMatch;
    });
  }

  if (alarmOnly) {
    filtered = filtered.filter(s => isSerialInAlarm(s));
  }

  renderSerials(filtered, onSelectSerial, loadMultipleDetails);
}