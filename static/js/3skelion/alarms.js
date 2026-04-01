// static/js/alarms.js
// Alarm detection and display logic

import { CONFIG } from '../shared/config.js';
import { fetchJSON } from '../shared/api.js';
import { getThresholds, isInAlarm } from './settings.js';

const COMMUNICATION_ALARM_THRESHOLD_HOURS = 6; // 6 hours without update = communication alarm

// Sorting state
let currentAlarms = [];
let sortColumn = null;
let sortDirection = 'asc';
let selectedAlarmKeys = new Set();

function pad2(n) {
  return String(n).padStart(2, '0');
}

function parseTs(ts) {
  if (!ts || ts === 'Never') return null;

  let s = String(ts).trim();

  // accept "YYYY-MM-DD HH:MM:SS" too
  if (/^\d{4}-\d{2}-\d{2} \d/.test(s)) {
    s = s.replace(' ', 'T');
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDMYHMS(ts) {
  const d = parseTs(ts);
  if (!d) return 'Never';

  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yyyy = d.getFullYear();

  const HH = pad2(d.getHours());
  const MM = pad2(d.getMinutes());
  const SS = pad2(d.getSeconds());

  return `${dd}/${mm}/${yyyy} ${HH}:${MM}:${SS}`;
}

function formatHoursAgo(hoursAgo) {
  const h = Number(hoursAgo);
  if (!Number.isFinite(h)) return 'N/A';

  if (h >= 24) {
    const days = Math.floor(h / 24);
    const rem = (h % 24).toFixed(1);
    return `${days}d ${rem}h`;
  }
  return `${h.toFixed(1)}h`;
}

function getAlarmKey(alarm) {
  if (!alarm) return null;
  return `${alarm.site || ''}|${alarm.lastUpdate || ''}|${alarm.status || ''}`;
}

function getSelectedAlarmsFromCurrent() {
  return currentAlarms.filter(alarm => selectedAlarmKeys.has(getAlarmKey(alarm)));
}

function dispatchRowSelectionEvent() {
  window.dispatchEvent(new CustomEvent('alarms:row-selected', {
    detail: {
      selectedAlarms: getSelectedAlarmsFromCurrent(),
      selectedKeys: Array.from(selectedAlarmKeys)
    }
  }));
}

function updateClearFiltersButtonState() {
  const clearBtn = document.getElementById('clearAlarmFiltersBtn');
  if (!clearBtn) {
    return;
  }
  const newState = selectedAlarmKeys.size === 0;
  clearBtn.disabled = newState;
}

function clearAlarmFilters() {
  if (selectedAlarmKeys.size === 0) return;
  selectedAlarmKeys = new Set();
  renderAlarmsTable(currentAlarms);
  updateClearFiltersButtonState();
  dispatchRowSelectionEvent();
}

function bindClearFiltersButton() {
  const clearBtn = document.getElementById('clearAlarmFiltersBtn');
  if (!clearBtn) return;
  if (clearBtn.dataset.bound === '1') return;
  clearBtn.dataset.bound = '1';

  clearBtn.addEventListener('click', (event) => {
    event.preventDefault();
    clearAlarmFilters();
  });
}

/**
 * Check if a timestamp indicates a communication alarm
 * @param {string} timestamp - ISO timestamp string
 * @returns {boolean} True if alarm condition
 */
function isCommunicationAlarm(timestamp) {
  if (!timestamp) return true; // No timestamp = alarm
  
  try {
    const lastUpdate = new Date(timestamp);
    const now = new Date();
    const diffHours = (now - lastUpdate) / (1000 * 60 * 60);
    
    return diffHours > COMMUNICATION_ALARM_THRESHOLD_HOURS;
  } catch (e) {
    console.error('Error parsing timestamp:', timestamp, e);
    return true; // Parse error = alarm
  }
}

/**
 * Fetch all serials and check for communication alarms
 * @returns {Promise<Array>} Array of alarm objects
 */
export async function fetchCommunicationAlarms() {
  try {
    const serials = await fetchJSON(CONFIG.API.SERIALS);
    const alarms = [];
    
    for (const serial of serials) {
      try {
        const records = await fetchJSON(`${CONFIG.API.SYSTEMS}/${encodeURIComponent(serial)}`);
        
        if (records && records.length > 0) {
          const latest = records[0];
          
          // Find timestamp, site, lat, lon fields (case-insensitive)
          let timestamp = null;
          let site = 'N/A';
          let lat = null;
          let lon = null;
          let rsrp = null;
          let sinr = null;
          let rsrq = null;
          let temp = null;

          for (const [key, val] of Object.entries(latest)) {
            const lower = key.toLowerCase();
            if (lower === 'datetime' || lower === 'timestamp' || lower === 'time') {
              timestamp = val;
            }
            if (lower === 'site' || lower === 'name') {
              site = val;
            }
            if (lower === 'latitude' || lower === 'lat') {
              lat = val;
            }
            if (lower === 'longitude' || lower === 'lon' || lower === 'long') {
              lon = val;
            }
            // KPI mapping (3skelion uses BEST_* fields)
            if (lower === 'rsrp' || lower === 'best_rsrp') rsrp = val;
            if (lower === 'rsrq' || lower === 'best_rsrq') rsrq = val;

            // SINR may come as SINR/SNR/BEST_SNR depending on how backend returns it
            if (lower === 'sinr' || lower === 'snr' || lower === 'best_snr') sinr = val;

            if (lower === 'temp' || lower === 'temperature') temp = val;
          }
          
          if (isCommunicationAlarm(timestamp)) {
            const lastUpdate = parseTs(timestamp);
            const hoursAgo = lastUpdate ? ((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60)) : null;
            
            alarms.push({
              serial,
              site,
              lastUpdate: timestamp || 'Never',
              hoursAgo,
              status: 'Communication Lost',
              latitude: lat,
              longitude: lon,
              rsrp,
              rsrq,
              sinr,
              temp
            });
          }
        } else {
          // No records = alarm
          alarms.push({
            serial,
            site: 'N/A',
            lastUpdate: 'Never',
            hoursAgo: 'N/A',
            status: 'No Data',
            latitude: null,
            longitude: null
          });
        }
      } catch (err) {
        console.warn(`Failed to check alarm for ${serial}:`, err);
      }
    }
    
    return alarms;
  } catch (err) {
    console.error('Error fetching communication alarms:', err);
    return [];
  }
}

// /**
//  * Fetch all performance alarms
//  * @param {number|null} rsrp
//  * @param {number|null} sinr
//  * @param {number|null} temp
//  * @param {number|null} lat
//  * @param {number|null} lon
//  * @returns {Promise<Array>} Array of alarm objects
//  */
// export async function fetchPerformanceAlarms(rsrp = null, sinr = null, temp = null, lat = null, lon = null) {
//   try {
//     const serials = await fetchJSON(CONFIG.API.SERIALS);
//     const per_alarms = [];
    
//     for (const serial of serials) {
//       try {
//         const records = await fetchJSON(`${CONFIG.API.SYSTEMS}/${encodeURIComponent(serial)}`);
        
//         if (records && records.length > 0) {
//           const latest = records[0];
          
//           if (isInAlarm('rsrp', rsrp) || isInAlarm('sinr', sinr) || isInAlarm('temp', temp) || isInAlarm('lat', lat) || isInAlarm('lon', lon)) {
//             per_alarms.push({
//               site,
//               lastUpdate: timestamp || 'Never',
//               status: 'Performance Alarm'
//             });
                   

//       } }}catch (err) {
//         console.warn(`Failed to check alarm for ${serial}:`, err);
//       }
//     }
    
//     return per_alarms;
//   } catch (err) {
//     console.error('Error fetching performance alarms:', err);
//     return [];
//   }
// }

/**
 * Sort alarms by column
 * @param {string} column - Column name to sort by
 */
function sortAlarms(column) {
  // Toggle direction if same column, otherwise default to ascending
  if (sortColumn === column) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn = column;
    sortDirection = 'asc';
  }
  
  currentAlarms.sort((a, b) => {
    let valA, valB;
    
    switch(column) {
      case 'site':
        valA = (a.site || '').toLowerCase();
        valB = (b.site || '').toLowerCase();
        break;
      case 'status':
        valA = (a.status || '').toLowerCase();
        valB = (b.status || '').toLowerCase();
        break;
      case 'lastUpdate':
        valA = a.lastUpdate === 'Never' ? 0 : new Date(a.lastUpdate).getTime();
        valB = b.lastUpdate === 'Never' ? 0 : new Date(b.lastUpdate).getTime();
        break;
      case 'hoursAgo':
        valA = a.hoursAgo === 'N/A' ? Infinity : parseFloat(a.hoursAgo);
        valB = b.hoursAgo === 'N/A' ? Infinity : parseFloat(b.hoursAgo);
        break;
      default:
        return 0;
    }
    
    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
  
  renderAlarmsTable(currentAlarms);
}

/**
 * Render alarms table
 * @param {Array} alarms - Array of alarm objects
 */
export function renderAlarmsTable(alarms) {
  const alarmsArea = document.getElementById('alarmsArea');
  
  if (!alarmsArea) {
    console.warn('[Alarms] Alarms area element not found');
    return;
  }
  
  bindClearFiltersButton();

  // Store alarms for sorting
  if (alarms !== currentAlarms) {
    currentAlarms = alarms;
  }

  const availableAlarmKeys = new Set(alarms.map(getAlarmKey));
  selectedAlarmKeys = new Set(
    Array.from(selectedAlarmKeys).filter(key => availableAlarmKeys.has(key))
  );
  
  // Update button state after filtering selection
  updateClearFiltersButtonState();
  
  if (!alarms || alarms.length === 0) {
    selectedAlarmKeys = new Set();
    updateClearFiltersButtonState();
    alarmsArea.innerHTML = '<div class="text-center text-muted p-4">No active alarms</div>';
    // Dispatch event even when there are no alarms
    window.dispatchEvent(new CustomEvent('alarms:table-rendered', {
      detail: {
        alarms: [],
        selectedKeys: []
      }
    }));
    return;
  }
  
  // Create table
  const table = document.createElement('table');
  table.className = 'table table-sm table-striped';
  
  // Create header with sortable columns
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  const columns = [
    { key: 'site', label: 'Site' },
    { key: 'status', label: 'Status' },
    { key: 'lastUpdate', label: 'Last Update' },
    { key: 'hoursAgo', label: 'Time Ago' }
  ];
  
  columns.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col.label;
    th.style.cursor = 'pointer';
    th.style.userSelect = 'none';
    th.dataset.column = col.key;
    
    // Add sort indicator
    if (sortColumn === col.key) {
      const arrow = document.createElement('span');
      arrow.textContent = sortDirection === 'asc' ? ' ▲' : ' ▼';
      arrow.style.fontSize = '0.75em';
      th.appendChild(arrow);
    }
    
    // Add click handler
    th.addEventListener('click', () => sortAlarms(col.key));
    
    headerRow.appendChild(th);
  });
  
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Create body
  const tbody = document.createElement('tbody');
  
  
  alarms.forEach((alarm, index) => {
    const row = document.createElement('tr');
    row.style.cursor = 'pointer';
    const alarmKey = getAlarmKey(alarm);

    if (selectedAlarmKeys.has(alarmKey)) {
      row.classList.add('alarm-row-selected');
    }

    row.innerHTML = `
      <td>${alarm.site}</td>
      <td><span class="badge bg-danger">${alarm.status}</span></td>
      <td>${formatDMYHMS(alarm.lastUpdate)}</td>
      <td>${formatHoursAgo(alarm.hoursAgo)}</td>
          `;

    row.addEventListener('click', () => {
      if (selectedAlarmKeys.has(alarmKey)) {
        selectedAlarmKeys.delete(alarmKey);
      } else {
        selectedAlarmKeys.add(alarmKey);
      }

      renderAlarmsTable(currentAlarms);
      updateClearFiltersButtonState();
      dispatchRowSelectionEvent();
    });

    tbody.appendChild(row);
  });
  
  table.appendChild(tbody);
  
  // Clear and add table
  alarmsArea.innerHTML = '';
  alarmsArea.appendChild(table);
  updateClearFiltersButtonState();
  
  // Dispatch event to notify that alarms table is rendered
  window.dispatchEvent(new CustomEvent('alarms:table-rendered', {
    detail: {
      alarms,
      selectedKeys: Array.from(selectedAlarmKeys)
    }
  }));
}

/**
 * Update alarm count badge in navbar
 * @param {number} count - Number of active alarms
 */
export function updateAlarmBadge(count) {
  const alarmTab = document.getElementById('tab-alarms');
  
  if (!alarmTab) {
    console.warn('[Alarms] Alarm tab button not found');
    return;
  }
  
  // Remove existing badge if any
  const existingBadge = alarmTab.querySelector('.alarm-badge');
  if (existingBadge) {
    existingBadge.remove();
  }
  
  // Add new badge if count > 0
  if (count > 0) {
    const badge = document.createElement('span');
    badge.className = 'alarm-badge';
    badge.innerHTML = `<span class="alarm-led"></span><span class="alarm-count">${count}</span>`;
    alarmTab.appendChild(badge);
  }
}

/**
 * Initialize and refresh alarms
 */
export async function refreshAlarms() {
  console.log('[Alarms] Checking for communication alarms...');
  const alarms = await fetchCommunicationAlarms();
  console.log(`[Alarms] Found ${alarms.length} active alarms`);
  
  // Update badge
  updateAlarmBadge(alarms.length);
  
  // If on alarms page (check for alarmsArea element), render table
  const alarmsArea = document.getElementById('alarmsArea');
  if (alarmsArea) {
    renderAlarmsTable(alarms);
  }
  
  return alarms;
}

// Entry point for the alarms page (merged from alarms-app.js)
async function init() {
  console.log('[Alarms Page] Initializing');
  
  // Load alarms immediately
  await refreshAlarms();
  
  // Auto-refresh every 30 seconds
  setInterval(async () => {
    console.log('[Alarms Page] Auto-refreshing alarms');
    await refreshAlarms();
  }, 30000);
}

// Start the app on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
