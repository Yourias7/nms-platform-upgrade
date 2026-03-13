import { fetchJSON, fetchHistoricSerialsList , fetchSerialNameMap, fetchHistoricSerialData, getHistoricExportUrl } from './api.js';
import { CONFIG } from './config.js';

const MAX_DAYS_BACK = 15;
let allSerials = [];
let serialNameMap = {};
let sortColumn = null;
let sortDirection = 'asc';
let selectedSerial = 'all';

function updateClearFiltersButtonState() {
  const clearBtn = document.getElementById('clearSelectedBtn');
  if (!clearBtn) return;
  clearBtn.disabled = selectedPerformanceAlarmKeys.size === 0 && (!lassoFilteredAlarmKeys || lassoFilteredAlarmKeys.size === 0);
}

function getSelectedSerial() {
  const params = new URLSearchParams(window.location.search);
  const serial = params.get('serial');
  return serial ? serial.trim() : '';
}

function getSelectedStartDate() {
  const params = new URLSearchParams(window.location.search);
  const date = params.get('startDate');
  return date ? date.trim() : '';
}

function getSelectedEndDate() {
  const params = new URLSearchParams(window.location.search);
  const date = params.get('endDate');
  return date ? date.trim() : '';
}

function formatDateForInput(date) {
  if (!date) return '';
  const dt = new Date(date);
  return dt.toISOString().split('T')[0];
}

function getMinStartDate() {
  const today = new Date();
  const minDate = new Date(today);
  minDate.setDate(today.getDate() - 15);
  return formatDateForInput(minDate);
}

function getMaxDate() {
  const today = new Date();
  return formatDateForInput(today);
}

function setDateConstraints() {
  const startInput = document.getElementById('startDateInput');
  const endInput = document.getElementById('endDateInput');

  if (startInput) {
    startInput.min = getMinStartDate();
    startInput.max = getMaxDate();
  }

  if (endInput) {
    endInput.min = startInput ? startInput.value || getMinStartDate() : getMinStartDate();
    endInput.max = getMaxDate();
  }
}

function updateEndDateMin() {
  const startInput = document.getElementById('startDateInput');
  const endInput = document.getElementById('endDateInput');

  if (startInput && endInput) {
    const startValue = startInput.value;
    endInput.min = startValue || getMinStartDate();

    // If end date is before new min, clear it
    if (endInput.value && endInput.value < endInput.min) {
      endInput.value = '';
    }
  }
}


function getSerialInputValue() {
  const input = document.getElementById('serialInput');
  if (!input) return '';
  // Prefer explicit selected serial stored on the input
  if (input.dataset && input.dataset.selectedSerial) {
    return input.dataset.selectedSerial.trim();
  }
  const raw = input.value ? input.value.trim() : '';
  if (!raw) return '';
  // Try to reverse-lookup name -> serial
  for (const [serial, name] of Object.entries(serialNameMap || {})) {
    if (String(name).trim() === raw) return serial;
  }
  // Fallback to raw value (user may have typed a serial)
  return raw;
}

function getStartDateInputValue() {
  const input = document.getElementById('startDateInput');
  return input ? input.value.trim() : '';
}

function getEndDateInputValue() {
  const input = document.getElementById('endDateInput');
  return input ? input.value.trim() : '';
}

function setSerialInputValue(serial) {
  const input = document.getElementById('serialInput');
  if (input) {
    const display = serialNameMap && serialNameMap[serial] ? serialNameMap[serial] : serial;
    input.value = display;
    if (serial) input.dataset.selectedSerial = serial;
  }
}

function setStartDateInputValue(date) {
  const input = document.getElementById('startDateInput');
  if (input) {
    const minDate = getMinStartDate();
    const maxDate = getMaxDate();
    if (date < minDate) date = minDate;
    if (date > maxDate) date = maxDate;
    input.value = date;
    // Update end date constraints after setting start date
    updateEndDateMin();
  }
}

function setEndDateInputValue(date) {
  const input = document.getElementById('endDateInput');
  if (input) {
    const minDate = input.min || getMinStartDate();
    const maxDate = getMaxDate();
    if (date < minDate) date = minDate;
    if (date > maxDate) date = maxDate;
    input.value = date;
  }
}

function sortByDatetime(records) {
  return records
    .filter((rec) => rec && rec.DATETIME)
    .sort((a, b) => new Date(a.DATETIME) - new Date(b.DATETIME));
}

function setPlaybackMessage(message, tone = 'muted') {
  const el = document.getElementById('playbackMessage');
  if (!el) return;
  el.className = `text-${tone} small`;
  el.textContent = message;
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

function bindClearAlarmFiltersButton() {
  const clearBtn = document.getElementById('clearSelectedBtn');
  if (!clearBtn) return;
  if (clearBtn.dataset.performanceBound === '1') return;
  clearBtn.dataset.performanceBound = '1';

  clearBtn.addEventListener('click', (event) => {
    event.preventDefault();
    clearPerformanceRowFilters();
  });
}


function updateSerialInUrl(serial) {
  const params = new URLSearchParams(window.location.search);
  if (serial) {
    params.set('serial', serial);
  } else {
    params.delete('serial');
  }
  const query = params.toString();
  const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState({}, '', url);
}

function updateDatesInUrl(startDate, endDate) {
  const params = new URLSearchParams(window.location.search);
  if (startDate) {
    params.set('startDate', startDate);
  } else {
    params.delete('startDate');
  }
  if (endDate) {
    params.set('endDate', endDate);
  } else {
    params.delete('endDate');
  }
  const query = params.toString();
  const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState({}, '', url);
}

/**
 * Render historic data table
 * @param {Array} data - Array of historic record objects
 * @param {string} serial - Serial number for export
 */
function renderHistoricTable(data, serial) {
  const table = document.getElementById('historicTable');
  const tbody = document.getElementById('historicTableBody');
  const noDataMessage = document.getElementById('noDataMessage');
  const exportBtn = document.getElementById('exportBtn');

  if (!data || data.length === 0) {
    table.style.display = 'none';
    noDataMessage.textContent = 'No historic data found for the selected period.';
    noDataMessage.style.display = 'block';
    exportBtn.style.display = 'none';
    setPlaybackMessage('No data found', 'muted');
    return;
  }

  // Clear existing rows
  tbody.innerHTML = '';

  // Add rows
  data.forEach(record => {
    const row = document.createElement('tr');

    // SERIAL
    const serialCell = document.createElement('td');
    serialCell.textContent = record.SERIAL || 'N/A';
    row.appendChild(serialCell);

    // NAME
    const nameCell = document.createElement('td');
    nameCell.textContent = record.NAME || 'N/A';
    row.appendChild(nameCell);

    // LATITUDE
    const latCell = document.createElement('td');
    latCell.textContent = record.LATITUDE !== null && record.LATITUDE !== undefined ? record.LATITUDE.toFixed(6) : 'N/A';
    row.appendChild(latCell);

    // LONGITUDE
    const lngCell = document.createElement('td');
    lngCell.textContent = record.LONGITUDE !== null && record.LONGITUDE !== undefined ? record.LONGITUDE.toFixed(6) : 'N/A';
    row.appendChild(lngCell);

    // DATETIME
    const datetimeCell = document.createElement('td');
    if (record.DATETIME) {
      datetimeCell.textContent = new Date(record.DATETIME).toLocaleString();
    } else {
      datetimeCell.textContent = 'N/A';
    }
    row.appendChild(datetimeCell);

    // HEADING
    const headingCell = document.createElement('td');
    headingCell.textContent = record.HEADING !== null && record.HEADING !== undefined ? record.HEADING.toFixed(1) : 'N/A';
    row.appendChild(headingCell);

    // RSRP
    const rsrpCell = document.createElement('td');
    rsrpCell.textContent = record.RSRP !== null && record.RSRP !== undefined ? record.RSRP.toFixed(1) : 'N/A';
    row.appendChild(rsrpCell);

    // SINR
    const sinrCell = document.createElement('td');
    sinrCell.textContent = record.SINR !== null && record.SINR !== undefined ? record.SINR.toFixed(1) : 'N/A';
    row.appendChild(sinrCell);

    // TEMP
    const tempCell = document.createElement('td');
    tempCell.textContent = record.TEMP !== null && record.TEMP !== undefined ? record.TEMP.toFixed(1) : 'N/A';
    row.appendChild(tempCell);

    // S0RSRP
    const s0rsrpCell = document.createElement('td');
    s0rsrpCell.textContent = record.S0RSRP !== null && record.S0RSRP !== undefined ? record.S0RSRP.toFixed(1) : 'N/A';
    row.appendChild(s0rsrpCell);

    // S0SINR
    const s0sinrCell = document.createElement('td');
    s0sinrCell.textContent = record.S0SINR !== null && record.S0SINR !== undefined ? record.S0SINR.toFixed(1) : 'N/A';
    row.appendChild(s0sinrCell);

    // S1RSRP
    const s1rsrpCell = document.createElement('td');
    s1rsrpCell.textContent = record.S1RSRP !== null && record.S1RSRP !== undefined ? record.S1RSRP.toFixed(1) : 'N/A';
    row.appendChild(s1rsrpCell);

    // S1SINR
    const s1sinrCell = document.createElement('td');
    s1sinrCell.textContent = record.S1SINR !== null && record.S1SINR !== undefined ? record.S1SINR.toFixed(1) : 'N/A';
    row.appendChild(s1sinrCell);

    // S2RSRP
    const s2rsrpCell = document.createElement('td');
    s2rsrpCell.textContent = record.S2RSRP !== null && record.S2RSRP !== undefined ? record.S2RSRP.toFixed(1) : 'N/A';
    row.appendChild(s2rsrpCell);

    // S2SINR
    const s2sinrCell = document.createElement('td');
    s2sinrCell.textContent = record.S2SINR !== null && record.S2SINR !== undefined ? record.S2SINR.toFixed(1) : 'N/A';
    row.appendChild(s2sinrCell);

    // S3RSRP
    const s3rsrpCell = document.createElement('td');
    s3rsrpCell.textContent = record.S3RSRP !== null && record.S3RSRP !== undefined ? record.S3RSRP.toFixed(1) : 'N/A';
    row.appendChild(s3rsrpCell);

    // S3SINR
    const s3sinrCell = document.createElement('td');
    s3sinrCell.textContent = record.S3SINR !== null && record.S3SINR !== undefined ? record.S3SINR.toFixed(1) : 'N/A';
    row.appendChild(s3sinrCell);

    tbody.appendChild(row);
  });

  // Show table, hide message
  table.style.display = 'table';
  noDataMessage.style.display = 'none';
  exportBtn.style.display = 'inline-block';
  exportBtn.href = getHistoricExportUrl(serial);

  setPlaybackMessage(`Found ${data.length} records`, 'success');
}

/**
 * Load and render historic data for a serial
 * @param {string} serial - Serial number
 */
async function renderTableForSerial(serial) {
  if (!serial || serial === 'all') {
    setPlaybackMessage('Please select a specific system.', 'warning');
    return;
  }

  const startDate = getStartDateInputValue();
  const endDate = getEndDateInputValue();

  if (!startDate || !endDate) {
    setPlaybackMessage('Please select both start and end dates.', 'warning');
    return;
  }

  setPlaybackMessage('Loading data...', 'muted');

  try {
    const data = await fetchHistoricSerialData(serial, startDate, endDate);
    renderHistoricTable(data, serial);
  } catch (error) {
    console.error('Error loading historic data:', error);
    setPlaybackMessage('Error loading data.', 'danger');
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
    setPlaybackMessage('Error loading systems list', 'danger');
  }
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const input = document.getElementById('serialInput');
  const dropdown = document.getElementById('serialOptions');
  if (input && dropdown && e.target !== input && e.target !== dropdown && !dropdown.contains(e.target)) {
    dropdown.classList.remove('show');
    dropdown.style.display = 'none';
  }
});

/**
 * Initialize the Historic Details page
 */
async function init() {
  console.log('[Details Page] Initializing');
  setDateConstraints();

  setPlaybackMessage('Loading serials...', 'muted');
  try {
    await initializeSerialDropdown();
    setPlaybackMessage(allSerials && allSerials.length > 0 ? '' : 'No serials available.', 'muted');
    
    // Hide loading overlay after serials are loaded
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
    }
  } catch (err) {
    console.error('[Details] Failed to load serials', err);
    setPlaybackMessage('Failed to load serials.', 'danger');
    
    // Hide loading overlay even on error
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
    }
  }

  const serialFromUrl = getSelectedSerial();
  const startDateFromUrl = getSelectedStartDate();
  const endDateFromUrl = getSelectedEndDate();

  if (serialFromUrl) {
    setSerialInputValue(serialFromUrl);
    if (startDateFromUrl) setStartDateInputValue(startDateFromUrl);
    if (endDateFromUrl) setEndDateInputValue(endDateFromUrl);
    await renderTableForSerial(serialFromUrl);
  } else {
    setPlaybackMessage('Select a system to load data.', 'muted');
  }

  const loadBtn = document.getElementById('serialLoadBtn');
  if (loadBtn) {
    loadBtn.addEventListener('click', async () => {
      const serial = getSerialInputValue();
      updateSerialInUrl(serial);

      const startDate = getStartDateInputValue();
      const endDate = getEndDateInputValue();

      // Handle date logic
      if (!startDate && !endDate) {
        // No dates given, default to last 15 days
        setStartDateInputValue(getMinStartDate());
        setEndDateInputValue(getMaxDate());
      } else if (!startDate) {
        // Only end date given, prompt for start date
        alert('Please set the Start Date as well.');
        return;
      } else if (!endDate) {
        // Only start date given, prompt for end date
        alert('Please set the End Date as well.');
        return;
      }

      updateDatesInUrl(getStartDateInputValue(), getEndDateInputValue());
      await renderTableForSerial(serial);
    });
  }

  const serialInput = document.getElementById('serialInput');
  if (serialInput) {
    serialInput.addEventListener('keydown', async (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const serial = getSerialInputValue();
        updateSerialInUrl(serial);

        const startDate = getStartDateInputValue();
        const endDate = getEndDateInputValue();

        // Handle date logic
        if (!startDate && !endDate) {
          // No dates given, default to last 15 days
          setStartDateInputValue(getMinStartDate());
          setEndDateInputValue(getMaxDate());
        } else if (!startDate) {
          // Only end date given, prompt for start date
          alert('Please set the Start Date as well.');
          return;
        } else if (!endDate) {
          // Only start date given, prompt for end date
          alert('Please set the End Date as well.');
          return;
        }

        updateDatesInUrl(getStartDateInputValue(), getEndDateInputValue());
        await renderTableForSerial(serial);
      }
    });
  }

  // Add event listener for start date change to update end date constraints
  const startDateInput = document.getElementById('startDateInput');
  if (startDateInput) {
    startDateInput.addEventListener('change', updateEndDateMin);
  }

  // Add event listener for clear button
  const clearBtn = document.getElementById('clearSelectedBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      // Clear all input fields
      const serialInput = document.getElementById('serialInput');
      const startDateInput = document.getElementById('startDateInput');
      const endDateInput = document.getElementById('endDateInput');
      
      if (serialInput) {
        serialInput.value = '';
        delete serialInput.dataset.selectedSerial;
      }
      if (startDateInput) startDateInput.value = '';
      if (endDateInput) endDateInput.value = '';

      // Clear URL parameters
      window.history.replaceState({}, '', window.location.pathname);

      // Clear table
      const table = document.getElementById('historicTable');
      const tbody = document.getElementById('historicTableBody');
      const noDataMessage = document.getElementById('noDataMessage');
      const exportBtn = document.getElementById('exportBtn');
      
      if (tbody) tbody.innerHTML = '';
      if (table) table.style.display = 'none';
      if (noDataMessage) {
        noDataMessage.textContent = 'Select a system to view records.';
        noDataMessage.style.display = 'block';
      }
      if (exportBtn) exportBtn.style.display = 'none';

      // Reset message
      setPlaybackMessage('Select a system to load data.', 'muted');

      console.log('[Playback] Cleared all filters and data');
    });
  }

  // Initialize the map mode toggle
  initToggle();

  // Initialize antenna toggles
  initAntennaToggles();

  console.log('[Playback Page] Initialized');
}

// Start the app on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
