// static/js/performance-alarms.js
// Performance alarms page logic

import { CONFIG } from '../shared/config.js';
import { fetchJSON, fetchAlarmSerialData, fetchPagedAllAlarmData, fetchSerialNameMap} from '../shared/api.js';
import { getThresholds, isInAlarm } from './settings.js';

// Constants
const PAGE_SIZE = 100000;
const MAX_DAYS_BACK = 15;

// State management
let allSerials = [];
let serialNameMap = {};
let currentPerformanceAlarms = [];
let selectedSerial = 'all';
let selectedPerformanceAlarmKeys = new Set();
let allPerformanceAlarms = [];
let lassoFilteredAlarmKeys = null;
let currentAbortController = null; // Track ongoing requests
let currentPage = 1;
let currentTotal = null; // total records across all pages
let sortColumn = 'datetime'; // Default sort column
let sortDirection = 'asc'; // 'asc' or 'desc'

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

/**
 * Compare function for sorting alarm records
 * @param {object} a - First alarm record
 * @param {object} b - Second alarm record
 * @param {string} column - Column key to sort by
 * @param {string} direction - 'asc' or 'desc'
 * @returns {number} Comparison result
 */
function compareAlarms(a, b, column, direction) {
  let valA = a[column];
  let valB = b[column];
  
  // Handle null/undefined values
  if (valA === null || valA === undefined) valA = '';
  if (valB === null || valB === undefined) valB = '';
  
  // Numeric comparison for RSRP, SINR, Temp
  if (['rsrp', 'sinr', 'temp'].includes(column)) {
    valA = parseFloat(valA) || 0;
    valB = parseFloat(valB) || 0;
  }
  // Date comparison for datetime
  else if (column === 'datetime') {
    valA = new Date(valA).getTime() || 0;
    valB = new Date(valB).getTime() || 0;
  }
  // String comparison for others
  else {
    valA = String(valA).toLowerCase();
    valB = String(valB).toLowerCase();
  }
  
  let result = 0;
  if (valA < valB) result = -1;
  else if (valA > valB) result = 1;
  
  return direction === 'asc' ? result : -result;
}

/**
 * Sort alarm records by specified column
 * @param {array} alarms - Array of alarm records to sort
 * @param {string} column - Column key to sort by
 * @param {string} direction - 'asc' or 'desc'
 * @returns {array} Sorted alarms
 */
function sortPerformanceAlarms(alarms, column, direction) {
  if (!alarms || alarms.length === 0) return alarms;
  return [...alarms].sort((a, b) => compareAlarms(a, b, column, direction));
}

/**
 * Handle table header click for sorting
 * @param {string} column - Column key clicked
 */
function onPerformanceHeaderClick(column) {
  if (sortColumn === column) {
    // Toggle direction if same column clicked
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    // New column, default to ascending
    sortColumn = column;
    sortDirection = 'asc';
  }
  
  // Re-render table with new sort
  const alarmData = currentPerformanceAlarms || [];
  const sortedAlarms = sortPerformanceAlarms(alarmData, sortColumn, sortDirection);
  renderPerformanceAlarmsTable(sortedAlarms, currentTotal);
}

/**
 * Update sort indicators on table headers
 */
function updateSortIndicators() {
  const headers = document.querySelectorAll('th[data-column]');
  headers.forEach(header => {
    const col = header.dataset.column;
    const arrow = header.querySelector('.sort-indicator');
    
    if (arrow) arrow.remove();
    
    if (col === sortColumn) {
      const indicator = document.createElement('span');
      indicator.className = 'sort-indicator ms-1';
      indicator.textContent = sortDirection === 'asc' ? ' ↑' : ' ↓';
      header.appendChild(indicator);
      header.style.cursor = 'pointer';
      header.style.fontWeight = 'bold';
    } else {
      header.style.cursor = 'pointer';
      header.style.fontWeight = 'normal';
    }
  });
}

/**
 * Attach click handlers to table headers for sorting
 */
function attachPerformanceHeaderClickHandlers() {
  const headers = document.querySelectorAll('th[data-column]');
  headers.forEach(header => {
    const col = header.dataset.column;
    header.addEventListener('click', () => onPerformanceHeaderClick(col));
  });
  updateSortIndicators();
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

/**
 * Render Bootstrap pagination controls below the alarms table
 */
function renderPaginator(total, page, pageSize) {
  let container = document.getElementById('paginationControls');
  if (!container) {
    container = document.createElement('div');
    container.id = 'paginationControls';
    const alarmsArea = document.getElementById('performanceAlarmsArea');
    if (alarmsArea) alarmsArea.parentElement.appendChild(container);
  }

  const totalPages = Math.ceil(total / pageSize);
  if (total <= pageSize || totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Performance alarms pagination');
  const ul = document.createElement('ul');
  ul.className = 'pagination pagination-sm justify-content-center mt-2 flex-wrap';

  // Prev button
  const prevLi = document.createElement('li');
  prevLi.className = `page-item${page === 1 ? ' disabled' : ''}`;
  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'page-link';
  prevBtn.textContent = '← Prev';
  if (page > 1) prevBtn.addEventListener('click', () => loadPerformanceAlarmsPage(page - 1));
  prevLi.appendChild(prevBtn);
  ul.appendChild(prevLi);

  // Page info
  const infoLi = document.createElement('li');
  infoLi.className = 'page-item disabled';
  const infoSpan = document.createElement('span');
  infoSpan.className = 'page-link';
  infoSpan.textContent = `Page ${page} of ${totalPages} — ${total} alarms`;
  infoLi.appendChild(infoSpan);
  ul.appendChild(infoLi);

  // Next button
  const nextLi = document.createElement('li');
  nextLi.className = `page-item${page === totalPages ? ' disabled' : ''}`;
  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'page-link';
  nextBtn.textContent = 'Next →';
  if (page < totalPages) nextBtn.addEventListener('click', () => loadPerformanceAlarmsPage(page + 1));
  nextLi.appendChild(nextBtn);
  ul.appendChild(nextLi);

  nav.appendChild(ul);
  container.innerHTML = '';
  container.appendChild(nav);
}

/**
 * Fetch performance alarm records with pagination
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {string} serial - Serial number or 'all'
 * @param {number} page - Page number
 * @returns {Promise<{data: Array, total: number}>} Paginated alarm records
 */
async function fetchPerformanceAlarmsPage(startDate, endDate, serial = 'all', page = 1) {
  if (currentAbortController) {
    currentAbortController.abort();
  }
  
  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;
  
  const thresholds = getThresholds();
  const startDateTime = startDate ? `${startDate}T00:00:00` : '';
  const endDateTime = endDate ? `${endDate}T23:59:59` : '';
  
  console.log('[Performance Alarms] Fetching page', page, 'from', startDateTime, 'to', endDateTime);
  console.log('[Performance Alarms] Thresholds:', thresholds);
  console.log('[Performance Alarms] Serial:', serial);
  
  try {
    let result;
    
    // Fetch from appropriate endpoint based on serial selection
    print(serial+"\NHEEEEEEEEEEEEEEEEEREEEEEEEEEEEEEEEEEEEEEEEEEEEEE\N");
    if (serial === 'all') {
      // Fetch all systems' alarm data
      result = await fetchPagedAllAlarmData(
        startDateTime,
        endDateTime,
        page,
        PAGE_SIZE,
        thresholds,
        signal
      );
    } else {
      // Fetch specific serial's alarm data
      result = await fetchAlarmSerialData(
        serial,
        startDateTime,
        endDateTime,
        thresholds,
        signal
      );
    }
    
    // Process results to add status field based on alarm type
    if (result.data) {
      result.data = result.data.map(record => {
        let rsrp = null;
        let sinr = null;
        let temp = null;
        let lat = null;
        let lon = null;
        let datetime = null;
        let name = null;
        let recordSerial = null;
        
        // Extract values from record (case-insensitive)
        for (const [key, val] of Object.entries(record)) {
          const lower = key.toLowerCase();
          if (lower === 'rsrp') rsrp = parseFloat(val);
          if (lower === 'sinr') sinr = parseFloat(val);
          if (lower === 'temp' || lower === 'temperature') temp = parseFloat(val);
          if (lower === 'latitude' || lower === 'lat') lat = parseFloat(val);
          if (lower === 'longitude' || lower === 'lon') lon = parseFloat(val);
          if (lower === 'datetime') datetime = val;
          if (lower === 'name') name = val;
          if (lower === 'serial') recordSerial = val;
        }
        
        // Calculate alarm type/status
        const alarmType = getPerformanceAlarmType(rsrp, sinr, temp, lat, lon);
        
        // Return normalized object with all fields in lowercase
        return {
          serial: recordSerial || 'Unknown',
          site: name || 'N/A',
          datetime: datetime || 'Unknown',
          status: alarmType,
          rsrp: rsrp,
          sinr: sinr,
          temp: temp,
          latitude: lat,
          longitude: lon
        };
      });
    }
    
    return result;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('[Performance Alarms] Request cancelled');
      throw err;
    }
    console.error('Error fetching performance alarms:', err);
    throw err;
  }
}

/**
 * Fetch all performance alarms for filtering/mapping (no pagination, used for lasso selection)
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {string|null} serial - Serial number or 'all'
 * @returns {Promise<Array>} Array of all alarm objects
 */
async function fetchAllPerformanceAlarms(startDate, endDate, serial = 'all') {
  try {
    if (currentAbortController) {
      currentAbortController.abort();
    }
    
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;
    
    const serials = (serial === 'all') || (serial === 'All systems') ? allSerials : [serial];
    const alarms = [];
    const thresholds = getThresholds();
    
    const startDateTime = startDate ? `${startDate}T00:00:00` : '';
    const endDateTime = endDate ? `${endDate}T23:59:59` : '';
    
    console.log('[Performance Alarms] Checking alarms for', serials.length, 'systems');
    console.log('[Performance Alarms] Date range:', startDateTime, 'to', endDateTime);
    console.log('[Performance Alarms] Thresholds:', thresholds);
    let page = 1;
    let totalRecords = 0;
    let hasMorePages = true;
    
    if(serials===allSerials){
      const response = await fetchPagedAllAlarmData(startDateTime, endDateTime, 1, PAGE_SIZE, thresholds);

      // Handle both object response {data: [...], total: N} and array response [...]
      let records = [];
      if (response) {
        if (Array.isArray(response)) {
          records = response;
          totalRecords = response.length;
        } else if (typeof response === 'object' && response.data) {
          records = Array.isArray(response.data) ? response.data : [];
          totalRecords = response.total || 0;
        }
      }
      
      if (!Array.isArray(records) || records.length === 0) records=null;
      
      for (const record of records) {
        // Skip invalid records
        if (!record || typeof record !== 'object') continue;
        
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
            // serial: ser,
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
      
      // Check if there are more pages
      const recordsFetched = page * PAGE_SIZE;
      hasMorePages = recordsFetched < totalRecords;
      page++;
    }
    
    for (const ser of serials) {
      if (signal.aborted) {
        throw new DOMException('Request cancelled', 'AbortError');
      }
      
      try {
        // Fetch all pages of alarm data for this serial
        
        
        while (hasMorePages) {
          if (signal.aborted) {
            throw new DOMException('Request cancelled', 'AbortError');
          }
          
          const response = await fetchAlarmSerialData(ser, startDateTime, endDateTime, thresholds, signal);
          
          // Handle both object response {data: [...], total: N} and array response [...]
          let records = [];
          if (response) {
            if (Array.isArray(response)) {
              records = response;
              totalRecords = response.length;
            } else if (typeof response === 'object' && response.data) {
              records = Array.isArray(response.data) ? response.data : [];
              totalRecords = response.total || 0;
            }
          }
          
          if (!Array.isArray(records) || records.length === 0) break;
          
          for (const record of records) {
            // Skip invalid records
            if (!record || typeof record !== 'object') continue;
            
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
          
          // Check if there are more pages
          const recordsFetched = page * PAGE_SIZE;
          hasMorePages = recordsFetched < totalRecords;
          page++;
        }
      } catch (err) {
        console.warn(`Failed to check alarms for ${ser}:`, err.message || err);
      }
    }
    
    console.log('[Performance Alarms] Found', alarms.length, 'alarms total');
    return alarms;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('[Performance Alarms] Request cancelled');
      throw err;
    }
    console.error('Error fetching performance alarms:', err);
    return [];
  }
}

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
    if (isInAlarm('lat', lat) || isInAlarm('lon',lon)) alarms.push('GPS');

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
 * Render performance alarms table
 * @param {Array} alarms - Array of alarm objects
 * @param {number|null} total - Total alarms across all pages
 */
/**
 * Render performance alarms table
 * @param {Array} alarms - Array of alarm objects
 * @param {number|null} total - Total alarms across all pages
 */
function renderPerformanceAlarmsTable(alarms, total = null) {
  const alarmsArea = document.getElementById('performanceAlarmsArea');
  const alarmMessage = document.getElementById('alarmMessage');
  
  if (!alarmsArea) return;
  
  bindClearAlarmFiltersButton();

  // Store alarms for selection
  if (alarms !== currentPerformanceAlarms) {
    currentPerformanceAlarms = [...(alarms || [])];
  }
  
  // Store total if provided
  if (total !== null) {
    currentTotal = total;
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
  
  // Sort alarms by current sort column and direction
  const sortedAlarms = sortPerformanceAlarms(alarms, sortColumn, sortDirection);
  
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
    th.dataset.column = col.key;
    th.style.cursor = 'pointer';
    headerRow.appendChild(th);
  });
  
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Create body
  const tbody = document.createElement('tbody');
  
  sortedAlarms.forEach(alarm => {
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
    badge.textContent = alarm.status || 'Unknown';
    
    // Color based on alarm type
    if (alarm.status && alarm.status.includes('Multiple')) {
      badge.classList.add('bg-danger');
    } else if (alarm.status && alarm.status.includes('RSRP')) {
      badge.classList.add('bg-warning');
    } else if (alarm.status && alarm.status.includes('SINR')) {
      badge.classList.add('bg-warning');
    } else if (alarm.status && alarm.status.includes('Temperature')) {
      badge.classList.add('bg-danger');
    } else if (alarm.status && alarm.status.includes('GPS')) {
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

      renderPerformanceAlarmsTable(currentPerformanceAlarms, currentTotal);
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
  
  // Attach click handlers to headers for sorting
  attachPerformanceHeaderClickHandlers();
  
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
 * Load and display all performance alarms (no pagination)
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
    // Fetch all alarms at once (no pagination)
    allPerformanceAlarms = await fetchAllPerformanceAlarms(startDate, endDate, selectedSerial);
    lassoFilteredAlarmKeys = null;
    
    // Render all alarms (no pagination, no total count)
    renderPerformanceAlarmsTable(allPerformanceAlarms, null);
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
      const visibleAlarms = getVisiblePerformanceAlarms();
      // When filtering with lasso, don't show pagination (show all filtered results)
      renderPerformanceAlarmsTable(visibleAlarms, null);
      return;
    }

    lassoFilteredAlarmKeys = new Set(selectedKeys);
    const visibleAlarms = getVisiblePerformanceAlarms();
    // When filtering with lasso, don't show pagination (show all filtered results)
    renderPerformanceAlarmsTable(visibleAlarms, null);
  });
}

// Start the app on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
