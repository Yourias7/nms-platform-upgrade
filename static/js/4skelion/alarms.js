// static/js/alarms.js
// Alarm detection and display logic

import { CONFIG } from '../shared/config.js';
import { fetchJSON } from '../shared/api.js';
import { getThresholds, isInAlarm } from './settings.js';

const COMMUNICATION_ALARM_THRESHOLD_HOURS = 3;

// Sorting state
let currentAlarms = [];
let sortColumn = null;
let sortDirection = 'asc';
let selectedAlarmKeys = new Set();

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
          }
          
          if (isCommunicationAlarm(timestamp)) {
            const lastUpdate = timestamp ? new Date(timestamp) : null;
            const now = new Date();
            const hoursAgo = lastUpdate 
              ? ((now - lastUpdate) / (1000 * 60 * 60)).toFixed(1)
              : 'N/A';
            
            alarms.push({
              serial,
              site,
              lastUpdate: timestamp || 'Never',
              hoursAgo,
              status: 'Communication Lost',
              latitude: lat,
              longitude: lon
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
      <td>${alarm.lastUpdate ? new Date(alarm.lastUpdate).toISOString().replace('T', ' ').slice(0, 19) : 'Never'}</td>
      <td>
      ${alarm.hoursAgo >= 24 
        ? `${Math.floor(alarm.hoursAgo / 24)}d ${(alarm.hoursAgo % 24).toFixed(1)}h` 
        : `${alarm.hoursAgo}h`}
      </td>
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

 /* Export combined data from multiple serials as CSV
 * @param {Object[]} data - Combined data array
 * @param {string[]} serials - Array of serial numbers
 */
function exportCombinedCSV(data, serials) {
  if (!data || data.length === 0) return;
  
  // Create CSV content - use fields that actually exist in alarm data
  const allowedCols = ['serial', 'site', 'status', 'lastUpdate', 'hoursAgo', 'latitude', 'longitude'];
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
  const csvFilename = `AlarmView_${timestamp}.csv`;
  
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

// Entry point for the alarms page (merged from alarms-app.js)
async function init() {
  console.log('[Alarms Page] Initializing');
  const exportBtn = document.getElementById('exportBtn');
  
  // Load alarms immediately
  const allData = await refreshAlarms();

  exportBtn.onclick = (e) => {
      e.preventDefault();
      exportCombinedCSV(allData);
    };

  
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
