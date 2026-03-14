// static/js/performance-alarms.js
// Performance alarms page logic

import { CONFIG } from './config.js';
import { fetchJSON, fetchAlarmSerialData , fetchSerialNameMap} from './api.js';
import { getThresholds, isInAlarm } from './settings.js';

// State management
let allSerials = [];
let serialNameMap = {};
let currentPerformanceAlarms = [];
let sortColumn = null;
let sortDirection = 'asc';
let selectedSerial = 'all';
let selectedPerformanceAlarmKeys = new Set();
let allPerformanceAlarms = [];
let lassoFilteredAlarmKeys = null;
let currentAbortController = null; // Track ongoing requests

function getPerformanceAlarmKey(alarm) {
  if (!alarm) return null;
  return `${alarm.serial || ''}|${alarm.site || ''}|${alarm.datetime || ''}|${alarm.status || ''}`;
}

function getSelectedPerformanceAlarms() {
  return currentPerformanceAlarms.filter(alarm => selectedPerformanceAlarmKeys.has(getPerformanceAlarmKey(alarm)));
}

function dispatchPerformanceRowSelection() {
  window.dispatchEvent(new CustomEvent('performance-alarms:row-selected', {
    detail: {
      selectedAlarms: getSelectedPerformanceAlarms(),
      selectedKeys: Array.from(selectedPerformanceAlarmKeys)
    }
  }));
}

function updateClearAlarmFiltersButtonState() {
  const clearBtn = document.getElementById('clearAlarmFiltersBtn');
  if (!clearBtn) return;
  clearBtn.disabled = selectedPerformanceAlarmKeys.size === 0 && (!lassoFilteredAlarmKeys || lassoFilteredAlarmKeys.size === 0);
}

function getVisiblePerformanceAlarms() {
  if (!lassoFilteredAlarmKeys || lassoFilteredAlarmKeys.size === 0) {
    return allPerformanceAlarms;
  }
  return allPerformanceAlarms.filter((alarm) => lassoFilteredAlarmKeys.has(getPerformanceAlarmKey(alarm)));
}

function clearPerformanceRowFilters() {
  if (selectedPerformanceAlarmKeys.size === 0 && (!lassoFilteredAlarmKeys || lassoFilteredAlarmKeys.size === 0)) return;
  selectedPerformanceAlarmKeys = new Set();
  lassoFilteredAlarmKeys = null;
  window.dispatchEvent(new CustomEvent('performance-alarms:clear-lasso'));
  renderPerformanceAlarmsTable(getVisiblePerformanceAlarms());
  updateClearAlarmFiltersButtonState();
  dispatchPerformanceRowSelection();
}

function bindClearAlarmFiltersButton() {
  const clearBtn = document.getElementById('clearAlarmFiltersBtn');
  if (!clearBtn) return;
  if (clearBtn.dataset.performanceBound === '1') return;
  clearBtn.dataset.performanceBound = '1';

  clearBtn.addEventListener('click', (event) => {
    event.preventDefault();
    clearPerformanceRowFilters();
  });
}

// Date range constants
const MAX_DAYS_BACK = 15;

/**
 * Check if values indicate a performance alarm
 * @param {number} rsrp - RSRP value
 * @param {number} sinr - SINR value
 * @param {number} temp - Temperature value
 * @param {number} lat - Latitude value
 * @param {number} lon - Longitude value
 * @returns {string} Type of alarm or 'Functional'
 */
function getPerformanceAlarmType(rsrp, sinr, temp, lat, lon) {
    if (rsrp === null || sinr === null || temp === null || lat === null || lon === null) return null;

    const alarms = [];
    if (isInAlarm('rsrp', rsrp)) alarms.push('RSRP');
    if (isInAlarm('sinr', sinr)) alarms.push('SINR');
    if (isInAlarm('temp', temp)) alarms.push('Temperature');
    if (isInAlarm('lat', lat)) alarms.push('GPS');
    if (isInAlarm('lon', lon)) alarms.push('GPS');

    if (alarms.length === 0) return null;
    let alarmType = '';
    if (alarms.length > 1){
      for (let i = 0; i < alarms.length; i++) {
        alarmType += `${alarms[i]} Alarm${i < alarms.length - 1 ? ' + ' : ''}`;
      }
      return alarmType;
    }
    return `${alarms[0]} Alarm`;
}

/**
 * Show loading state
 */
function showLoading() {
  const alarmsArea = document.getElementById('performanceAlarmsArea');
  if (alarmsArea) {
    alarmsArea.innerHTML = `
      <div class="d-flex flex-column align-items-center justify-content-center p-5">
        <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;">
          <span class="visually-hidden">Loading...</span>
        </div>
        <div class="text-muted">Loading systems...</div>
      </div>
    `;
  }
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
  const alarmsArea = document.getElementById('performanceAlarmsArea');
  if (alarmsArea) {
    alarmsArea.innerHTML = `
      <div class="text-center text-danger p-4">
        <i class="bi bi-exclamation-triangle"></i> ${message}
      </div>
    `;
  }
}

/**
 * Initialize date inputs with last 15 days range
 */
function initializeDateInputs() {
  const startDateInput = document.getElementById('startDateInput');
  const endDateInput = document.getElementById('endDateInput');
  
  if (!startDateInput || !endDateInput) return;
  
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const maxDaysBack = new Date(today);
  maxDaysBack.setDate(maxDaysBack.getDate() - MAX_DAYS_BACK);
  
  // Format dates as YYYY-MM-DD
  const formatDate = (date) => date.toISOString().split('T')[0];
  
  // Set default range to yesterday (start of yesterday to now)
  startDateInput.value = formatDate(yesterday);
  endDateInput.value = formatDate(today);
  
  // Set min/max constraints
  startDateInput.min = formatDate(maxDaysBack);
  startDateInput.max = formatDate(today);
  endDateInput.min = formatDate(maxDaysBack);
  endDateInput.max = formatDate(today);
  
  // Ensure end date >= start date and within 15 days
  startDateInput.addEventListener('change', () => {
    if (endDateInput.value < startDateInput.value) {
      endDateInput.value = startDateInput.value;
    }
    // Validate start date is not older than 15 days
    const startDate = new Date(startDateInput.value);
    if (startDate < maxDaysBack) {
      startDateInput.value = formatDate(maxDaysBack);
      alert('Start date cannot be more than 15 days in the past');
    }
  });
  
  endDateInput.addEventListener('change', () => {
    if (endDateInput.value < startDateInput.value) {
      startDateInput.value = endDateInput.value;
    }
    // Validate end date is not in the future
    const endDate = new Date(endDateInput.value);
    if (endDate > today) {
      endDateInput.value = formatDate(today);
      alert('End date cannot be in the future');
    }
  });
}

function renderDropdownOptions(serials, nameMap = {}) {
  const dropdown = document.getElementById('serialOptions');
  if (!dropdown) return;
  dropdown.innerHTML = '';
  
  // Sort serials before rendering
  const sortedSerials = [...serials].sort();
  
  sortedSerials.forEach((serial) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'dropdown-item';
    const displayName = nameMap && nameMap[serial] ? nameMap[serial] : serial;
    option.textContent = displayName;
    option.dataset.serial = serial;
    option.addEventListener('click', (e) => {
      e.preventDefault();
      const input = document.getElementById('serialInput');
      if (input) {
        input.value = displayName;
        input.dataset.selectedSerial = serial;
        dropdown.classList.remove('show');
        dropdown.style.display = 'none';
      }
    });
    dropdown.appendChild(option);
  });
}

/**
 * Initialize serial dropdown
 */
async function initializeSerialDropdown() {
  try {
    // Fetch serials and name map
    allSerials = await fetchJSON(CONFIG.API.HISTORIC_SERIALS);
    serialNameMap = await fetchSerialNameMap();
    
    const serialInput = document.getElementById('serialInput');
    const serialOptions = document.getElementById('serialOptions');

    renderDropdownOptions(allSerials, serialNameMap);
    
    if (!serialInput || !serialOptions) return;
    
    // Set default to "All systems"
    serialInput.value = 'All systems';
    selectedSerial = 'all';
    
    // Populate dropdown options
    const renderOptions = (filter = '') => {
      serialOptions.innerHTML = '';
      
      // Add "All systems" option
      const allOption = document.createElement('a');
      allOption.className = 'dropdown-item';
      allOption.href = '#';
      allOption.textContent = 'All systems';
      allOption.onclick = (e) => {
        e.preventDefault();
        serialInput.value = 'All systems';
        selectedSerial = 'all';
        serialOptions.style.display = 'none';
      };
      serialOptions.appendChild(allOption);
      
      // Add divider
      const divider = document.createElement('div');
      divider.className = 'dropdown-divider';
      serialOptions.appendChild(divider);
      
      // Filter and add serial options
      const filterLower = filter.toLowerCase();
      const filtered = allSerials.filter(serial => {
        const name = serialNameMap[serial] || serial;
        return name.toLowerCase().includes(filterLower) || serial.toLowerCase().includes(filterLower);
      });
      
      if (filtered.length === 0) {
        const noResults = document.createElement('div');
        noResults.className = 'dropdown-item text-muted';
        noResults.textContent = 'No systems found';
        serialOptions.appendChild(noResults);
      } else {
        filtered.forEach(serial => {
          const option = document.createElement('a');
          option.className = 'dropdown-item';
          option.href = '#';
          option.textContent = serialNameMap[serial] || serial;
          option.onclick = (e) => {
            e.preventDefault();
            serialInput.value = serialNameMap[serial] || serial;
            selectedSerial = serial;
            serialOptions.style.display = 'none';
          };
          serialOptions.appendChild(option);
        });
      }
    };
    
    // Handle input focus and typing
    serialInput.addEventListener('focus', () => {
      renderOptions(serialInput.value === 'All systems' ? '' : serialInput.value);
      serialOptions.style.display = 'block';
    });
    
    serialInput.addEventListener('input', (e) => {
      renderOptions(e.target.value);
      serialOptions.style.display = 'block';
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!serialInput.contains(e.target) && !serialOptions.contains(e.target)) {
        serialOptions.style.display = 'none';
      }
    });
    
    // Initial render
    renderOptions();
  } catch (err) {
    console.error('Error initializing serial dropdown:', err);
    showError('Error loading systems list');
  }
}

/**
 * Fetch performance alarms for a date range
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {string|null} serial - Serial number or 'all'
 * @returns {Promise<Array>} Array of alarm objects
 */
async function fetchPerformanceAlarms(startDate, endDate, serial = 'all') {
  try {
    // Cancel any ongoing request
    if (currentAbortController) {
      currentAbortController.abort();
    }
    
    // Create new AbortController for this request
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;
    
    const serials = serial === 'all' ? allSerials : [serial];
    const alarms = [];
    const thresholds = getThresholds();
    
    // Convert dates to ISO format with time for proper range querying
    // Start date at 00:00:00, end date at 23:59:59
    const startDateTime = startDate ? `${startDate}T00:00:00` : '';
    const endDateTime = endDate ? `${endDate}T23:59:59` : '';
    
    console.log('[Performance Alarms] Checking alarms for', serials.length, 'systems');
    console.log('[Performance Alarms] Date range:', startDateTime, 'to', endDateTime);
    console.log('[Performance Alarms] Thresholds:', thresholds);
    
    for (const ser of serials) {
      // Check if request was cancelled
      if (signal.aborted) {
        throw new DOMException('Request cancelled', 'AbortError');
      }
      
      try {
        // Fetch alarm data for date range with thresholds, pass signal
        const records = await fetchAlarmSerialData(ser, startDateTime, endDateTime, thresholds, signal);
        
        if (!records || records.length === 0) continue;
        
        // Check each record for alarms
        for (const record of records) {
          // Extract fields (case-insensitive)
          let timestamp = null;
          let site = 'N/A';
          let lat = null;
          let lon = null;
          let rsrp = null;
          let sinr = null;
          let temp = null;
          
          for (const [key, val] of Object.entries(record)) {
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
            if (lower === 'rsrp') {
              rsrp = parseFloat(val);
            }
            if (lower === 'sinr') {
              sinr = parseFloat(val);
            }
            if (lower === 'temp' || lower === 'temperature') {
              temp = parseFloat(val);
            }
          }
          
          // Check if this record is in alarm
          const alarmType = getPerformanceAlarmType(rsrp, sinr, temp, lat, lon);
          if (alarmType) {
            alarms.push({
              site,
              serial: ser,
              datetime: timestamp || 'Unknown',
              status: alarmType,
              rsrp,
              sinr,
              temp,
              latitude: lat,
              longitude: lon
            });
          }
        }
      } catch (err) {
        console.warn(`Failed to check alarms for ${ser}:`, err);
      }
    }
    
    console.log('[Performance Alarms] Found', alarms.length, 'alarms');
    return alarms;
  } catch (err) {
    // Ignore abort errors (expected when cancelling)
    if (err.name === 'AbortError') {
      console.log('[Performance Alarms] Request cancelled');
      throw err;
    }
    console.error('Error fetching performance alarms:', err);
    return [];
  }
}

/**
 * Sort performance alarms by column
 * @param {string} column - Column name to sort by
 */
function sortPerformanceAlarms(column) {
  if (sortColumn === column) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn = column;
    sortDirection = 'asc';
  }
  
  currentPerformanceAlarms.sort((a, b) => {
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
      case 'datetime':
        valA = a.datetime === 'Unknown' ? 0 : new Date(a.datetime).getTime();
        valB = b.datetime === 'Unknown' ? 0 : new Date(b.datetime).getTime();
        break;
      case 'rsrp':
        valA = a.rsrp === null ? -Infinity : a.rsrp;
        valB = b.rsrp === null ? -Infinity : b.rsrp;
        break;
      case 'sinr':
        valA = a.sinr === null ? -Infinity : a.sinr;
        valB = b.sinr === null ? -Infinity : b.sinr;
        break;
      case 'temp':
        valA = a.temp === null ? -Infinity : a.temp;
        valB = b.temp === null ? -Infinity : b.temp;
        break;
      default:
        return 0;
    }
    
    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
  
  renderPerformanceAlarmsTable(currentPerformanceAlarms);
}

/**
 * Render performance alarms table
 * @param {Array} alarms - Array of alarm objects
 */
function renderPerformanceAlarmsTable(alarms) {
  const alarmsArea = document.getElementById('performanceAlarmsArea');
  const alarmMessage = document.getElementById('alarmMessage');
  
  if (!alarmsArea) return;
  
  bindClearAlarmFiltersButton();

  // Store alarms for sorting
  if (alarms !== currentPerformanceAlarms) {
    currentPerformanceAlarms = [...(alarms || [])];
  }

  const availableKeys = new Set((alarms || []).map(getPerformanceAlarmKey));
  selectedPerformanceAlarmKeys = new Set(
    Array.from(selectedPerformanceAlarmKeys).filter(key => availableKeys.has(key))
  );
  
  // Update button state after filtering selection
  updateClearAlarmFiltersButtonState();
  
  if (!alarms || alarms.length === 0) {
    selectedPerformanceAlarmKeys = new Set();
    updateClearAlarmFiltersButtonState();
    alarmsArea.innerHTML = '<div class="text-center text-muted p-4">No performance alarms found for the selected period</div>';
    if (alarmMessage) alarmMessage.textContent = 'No alarms found';
    
    // Dispatch event for map (empty)
    window.dispatchEvent(new CustomEvent('performance-alarms:table-rendered', { detail: { alarms: [], selectedKeys: [] } }));
    window.dispatchEvent(new CustomEvent('alarms:table-rendered', { detail: { alarms: [] } }));
    return;
  }
  
  // Update message
  if (alarmMessage) {
    alarmMessage.textContent = `Found ${alarms.length} alarm${alarms.length !== 1 ? 's' : ''}`;
  }
  
  // Create table
  const table = document.createElement('table');
  table.className = 'table table-sm table-striped';
  
  // Create header with sortable columns
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  const columns = [
    { key: 'site', label: 'Site' },
    { key: 'status', label: 'Alarm Type' },
    { key: 'datetime', label: 'Date/Time' },
    { key: 'rsrp', label: 'RSRP' },
    { key: 'sinr', label: 'SINR' },
    { key: 'temp', label: 'Temp' }
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
    th.addEventListener('click', () => sortPerformanceAlarms(col.key));
    
    headerRow.appendChild(th);
  });
  
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Create body
  const tbody = document.createElement('tbody');
  
  alarms.forEach(alarm => {
    const row = document.createElement('tr');
    row.style.cursor = 'pointer';
    const alarmKey = getPerformanceAlarmKey(alarm);

    if (selectedPerformanceAlarmKeys.has(alarmKey)) {
      row.classList.add('alarm-row-selected');
    }
    
    // Site
    const siteCell = document.createElement('td');
    siteCell.textContent = alarm.site;
    row.appendChild(siteCell);
    
    // Status (alarm type)
    const statusCell = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = alarm.status;
    
    // Color based on alarm type
    if (alarm.status.includes('Multiple')) {
      badge.classList.add('bg-danger');
    } else if (alarm.status.includes('RSRP')) {
      badge.classList.add('bg-warning');
    } else if (alarm.status.includes('SINR')) {
      badge.classList.add('bg-warning');
    } else if (alarm.status.includes('Temperature')) {
      badge.classList.add('bg-danger');
    } else if (alarm.status.includes('GPS')) {
      badge.classList.add('bg-warning');
    } else {
      badge.classList.add('bg-secondary');
    }
    statusCell.appendChild(badge);
    row.appendChild(statusCell);
    
    // DateTime
    const datetimeCell = document.createElement('td');
    if (alarm.datetime && alarm.datetime !== 'Unknown') {
      datetimeCell.textContent = new Date(alarm.datetime).toLocaleString();
    } else {
      datetimeCell.textContent = 'Unknown';
    }
    row.appendChild(datetimeCell);
    
    // RSRP
    const rsrpCell = document.createElement('td');
    if (alarm.rsrp !== null && alarm.rsrp !== undefined) {
      rsrpCell.textContent = alarm.rsrp.toFixed(1);
      if (isInAlarm('rsrp', alarm.rsrp)) {
        rsrpCell.style.color = '#dc3545';
        rsrpCell.style.fontWeight = 'bold';
      }
    } else {
      rsrpCell.textContent = 'N/A';
    }
    row.appendChild(rsrpCell);
    
    // SINR
    const sinrCell = document.createElement('td');
    if (alarm.sinr !== null && alarm.sinr !== undefined) {
      sinrCell.textContent = alarm.sinr.toFixed(1);
      if (isInAlarm('sinr', alarm.sinr)) {
        sinrCell.style.color = '#dc3545';
        sinrCell.style.fontWeight = 'bold';
      }
    } else {
      sinrCell.textContent = 'N/A';
    }
    row.appendChild(sinrCell);
    
    // Temperature
    const tempCell = document.createElement('td');
    if (alarm.temp !== null && alarm.temp !== undefined) {
      tempCell.textContent = alarm.temp.toFixed(1);
      if (isInAlarm('temp', alarm.temp)) {
        tempCell.style.color = '#dc3545';
        tempCell.style.fontWeight = 'bold';
      }
    } else {
      tempCell.textContent = 'N/A';
    }
    row.appendChild(tempCell);

    row.addEventListener('click', () => {
      if (selectedPerformanceAlarmKeys.has(alarmKey)) {
        selectedPerformanceAlarmKeys.delete(alarmKey);
      } else {
        selectedPerformanceAlarmKeys.add(alarmKey);
      }

      renderPerformanceAlarmsTable(currentPerformanceAlarms);
      updateClearAlarmFiltersButtonState();
      dispatchPerformanceRowSelection();
    });
    
    tbody.appendChild(row);
  });
  
  table.appendChild(tbody);
  
  // Clear and add table
  alarmsArea.innerHTML = '';
  alarmsArea.appendChild(table);
  updateClearAlarmFiltersButtonState();
  
  // Dispatch event to notify map
  window.dispatchEvent(new CustomEvent('performance-alarms:table-rendered', {
    detail: {
      alarms,
      selectedKeys: Array.from(selectedPerformanceAlarmKeys)
    }
  }));
  window.dispatchEvent(new CustomEvent('alarms:table-rendered', { detail: { alarms } }));
}

/**
 * Load and display performance alarms
 */
async function loadPerformanceAlarms() {
  const startDateInput = document.getElementById('startDateInput');
  const endDateInput = document.getElementById('endDateInput');
  
  if (!startDateInput || !endDateInput) return;
  
  const startDate = startDateInput.value;
  const endDate = endDateInput.value;
  
  if (!startDate || !endDate) {
    showError('Please select both start and end dates');
    return;
  }
  
  showLoading();
  
  try {
    const alarms = await fetchPerformanceAlarms(startDate, endDate, selectedSerial);
    allPerformanceAlarms = alarms || [];
    lassoFilteredAlarmKeys = null;
    renderPerformanceAlarmsTable(getVisiblePerformanceAlarms());
  } catch (err) {
    // Don't show error message if request was cancelled
    if (err.name === 'AbortError') {
      return;
    }
    console.error('Error loading performance alarms:', err);
    showError('Error loading performance alarms');
  }
}

/**
 * Clear filters and reset to defaults
 */
function clearFilters() {
  const serialInput = document.getElementById('serialInput');
  
  if (serialInput) {
    serialInput.value = 'All systems';
    selectedSerial = 'all';
  }
  
  // Reset dates to yesterday
  initializeDateInputs();

  lassoFilteredAlarmKeys = null;
  window.dispatchEvent(new CustomEvent('performance-alarms:clear-lasso'));
  
  // Reload with defaults
  loadPerformanceAlarms();
}

/**
 * Initialize the performance alarms page
 */
async function init() {
  console.log('[Performance Alarms] Initializing page');
  
  // Initialize date inputs
  initializeDateInputs();
  
  // Initialize serial dropdown
  await initializeSerialDropdown();
  
  // Setup Load button
  const loadBtn = document.getElementById('serialLoadBtn');
  if (loadBtn) {
    loadBtn.addEventListener('click', loadPerformanceAlarms);
  }
  
  // Setup Clear button
  const clearBtn = document.getElementById('clearSelectedBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearFilters);
  }
  
  // Load initial data (last 24 hours, all systems)
  await loadPerformanceAlarms();

  window.addEventListener('performance-alarms:lasso-selected', (event) => {
    const hasLasso = !!event.detail?.hasLasso;
    const selectedKeys = event.detail?.selectedKeys || [];

    if (!hasLasso) {
      lassoFilteredAlarmKeys = null;
      renderPerformanceAlarmsTable(getVisiblePerformanceAlarms());
      return;
    }

    lassoFilteredAlarmKeys = new Set(selectedKeys);
    renderPerformanceAlarmsTable(getVisiblePerformanceAlarms());
  });
}

// Start the app on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
