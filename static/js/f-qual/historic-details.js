import { fetchJSON, fetchHistoricSerialsList , fetchSerialNameMap, fetchHistoricSerialData, fetchPagedHistoricAllData, getHistoricExportUrl } from '../shared/api.js';
import { CONFIG } from '../shared/config.js';

const MAX_DAYS_BACK = 15;
const PAGE_SIZE = 500;
let allSerials = [];
let serialNameMap = {};
let selectedSerial = 'all';
let currentHistoricData = [];
let headersAttached = false;
let currentAbortController = null; // Track ongoing requests
let currentPage = 1;
let currentActiveSerial = '';
let currentTotal = null; // total records for paginated 'all' view

// CSV Enrichment state
let uploadedCsvData = null;        // Persists across queries
let csvIndex = {};                 // Lookup map: "cellid|enbid|pci" → {extra_cols}
let enrichmentColumns = [];        // Detected column names from CSV
let hasActiveEnrichment = false;   // Visual indicator
let enrichmentMatchStats = { matched: 0, total: 0 }; // Track match success

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

function formatNumber(value, decimals = 1) {
  if (value === null || value === undefined || value === '') return 'N/A';
  const normalized = typeof value === 'string' ? value.replace(',', '.').trim() : value;
  const num = typeof normalized === 'number' ? normalized : parseFloat(normalized);
  return Number.isFinite(num) ? num.toFixed(decimals) : 'N/A';
}

function exportCombinedCSV(data) {
  if (!data || data.length === 0) return;
  
  // Create CSV content
  // Columns arranged: General, Best, S0, S1, S2, S3, then enriched columns
  const baseColumns = ["SERIAL",
                "NAME",
                "LATITUDE",
                "LONGITUDE",
                "DATETIME",
                "HEADING",
                "RSRP",
                "SINR",
                "TEMP",
                "RSRQ",
                "BEST_CELLID",
                "BEST_ENBID",
                "BEST_SECID",
                "BEST_PCI",
                "SELECTED_ANTENNA",
                "EARFCN",
                "S0RSRP",
                "S0SINR",
                "S0RSRQ",
                "S0EARFCN",
                "S0CELLID",
                "S0ENBID",
                "S0PCI",
                "S1RSRP",
                "S1SINR",
                "S1RSRQ",
                "S1EARFCN",
                "S1CELLID",
                "S1ENBID",
                "S1PCI",
                "S2RSRP",
                "S2SINR",
                "S2RSRQ",
                "S2EARFCN",
                "S2CELLID",
                "S2ENBID",
                "S2PCI",
                "S3RSRP",
                "S3SINR",
                "S3RSRQ",
                "S3EARFCN",
                "S3CELLID",
                "S3ENBID",
                "S3PCI"];
  
  // Add enrichment columns if available
  const cols = hasActiveEnrichment ? [...baseColumns, ...enrichmentColumns] : baseColumns;
  
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
  const csvFilename = `DetailedView_${timestamp}.csv`;
  
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

/**
 * Fetch all pages of historic data and export as CSV
 * @param {string} serial - Serial number to export ('all' for all systems)
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 */
async function exportAllHistoricDataAsCSV(serial, startDate, endDate) {
  try {
    setPlaybackMessage('Exporting all data... please wait', 'muted');
    
    let allData = [];
    let page = 1;
    let hasMoreData = true;
    const convertedStartDate = `${startDate}T00:00:00`;
    const convertedEndDate = `${endDate}T23:59:59`;
    
    // Fetch all pages
    while (hasMoreData) {
      let response;
      if (serial === 'all') {
        response = await fetchPagedHistoricAllData(convertedStartDate, convertedEndDate, page, PAGE_SIZE);
      } else {
        response = await fetchHistoricSerialData(serial, convertedStartDate, convertedEndDate, page, PAGE_SIZE);
      }
      
      const pageData = response.data || [];
      if (pageData.length === 0) {
        hasMoreData = false;
        break;
      }
      
      allData = allData.concat(pageData);
      const totalRecords = response.total || 0;
      setPlaybackMessage(`Exporting... ${allData.length} of ${totalRecords} records loaded`, 'muted');
      
      // Check if we've fetched all data
      if (allData.length >= totalRecords) {
        hasMoreData = false;
      } else {
        page++;
      }
    }
    
    if (allData.length > 0) {
      // Enrich data with CSV if available before exporting
      if (hasActiveEnrichment) {
        enrichRecordsWithCsv(allData);
      }
      exportCombinedCSV(allData);
      setPlaybackMessage(`Export complete: ${allData.length} records`, 'success');
    } else {
      setPlaybackMessage('No data to export', 'warning');
    }
  } catch (error) {
    console.error('Error exporting data:', error);
    setPlaybackMessage(`Export failed: ${error.message}`, 'danger');
  }
}

function setPlaybackMessage(message, tone = 'muted') {
  const el = document.getElementById('playbackMessage');
  if (!el) return;
  el.className = `text-${tone} small`;
  el.textContent = message;
}

/**
 * Auto-detect CSV delimiter (comma or semicolon)
 * @param {string} line - First line of CSV
 * @returns {string} Detected delimiter
 */
function detectDelimiter(line) {
  const commaCount = (line.match(/,/g) || []).length;
  const semicolonCount = (line.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

/**
 * Parse CSV text content into array of objects
 * @param {string} csvText - Raw CSV text
 * @returns {Array} Array of objects with headers as keys
 */
function parseCSVContent(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV must have headers and at least one data row');
  
  // Auto-detect delimiter
  const delimiter = detectDelimiter(lines[0]);
  console.log(`[CSV] Detected delimiter: '${delimiter}'`);
  
  // Parse headers
  const headers = parseCSVLine(lines[0], delimiter);
  if (headers.length === 0) throw new Error('No headers found in CSV');
  
  // Parse data rows
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue; // Skip empty lines
    const values = parseCSVLine(lines[i], delimiter);
    const row = {};
    headers.forEach((header, idx) => {
      row[header.trim()] = values[idx] ? values[idx].trim() : '';
    });
    data.push(row);
  }
  
  return data;
}

/**
 * Parse a single CSV line handling quoted values and custom delimiter
 * @param {string} line - CSV line
 * @param {string} delimiter - Field delimiter (default ',')
 * @returns {Array} Array of values
 */
function parseCSVLine(line, delimiter = ',') {
  const result = [];
  let current = '';
  let insideQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

/**
 * Validate CSV has required join key columns
 * @param {Array} headers - CSV headers
 * @returns {boolean} True if valid, throws error otherwise
 */
function validateCsvHeaders(headers) {
  const required = ['BEST_CELLID'];
  const headerSet = new Set(headers.map(h => h.trim().toUpperCase()));
  
  for (const col of required) {
    if (!headerSet.has(col)) {
      throw new Error(`CSV missing required column: ${col}`);
    }
  }
  
  return true;
}

/**
 * Build index from CSV data using composite key
 * @param {Array} csvData - Parsed CSV data
 * @returns {Object} { index: {}, extraColumns: [] }
 */
function buildCsvIndex(csvData) {
  const index = {};
  const extraColumns = new Set();
  
  const requiredCols = ['BEST_CELLID'];
  
  csvData.forEach(row => {
    const cellid = String(row.BEST_CELLID || '').trim();
    
    if (!cellid) {
      console.warn('[CSV] Skipping row with missing join keys:', row);
      return;
    }
    
    const key = cellid;
    
    // Skip duplicate keys (use first occurrence)
    if (index[key]) {
      console.warn(`[CSV] Duplicate key found, using first occurrence: ${key}`);
      return;
    }
    
    // Extract extra columns (all except the required ones)
    const enrichment = {};
    Object.entries(row).forEach(([colName, value]) => {
      if (!requiredCols.includes(colName)) {
        enrichment[colName] = value;
        extraColumns.add(colName);
      }
    });
    
    index[key] = enrichment;
  });
  
  return {
    index,
    extraColumns: Array.from(extraColumns)
  };
}

/**
 * Handle CSV file upload and parsing
 * @param {File} file - CSV file object
 */
async function loadAndIndexCSV(file) {
  try {
    setPlaybackMessage('Reading CSV file...', 'muted');
    
    // Check file size (max 12MB)
    if (file.size > 12 * 1024 * 1024) {
      throw new Error('File exceeds 12MB limit');
    }
    
    // Read file as text
    const text = await file.text();
    
    // Parse CSV
    setPlaybackMessage('Parsing CSV...', 'muted');
    const csvData = parseCSVContent(text);
    
    // Validate headers
    const headers = Object.keys(csvData[0]);
    validateCsvHeaders(headers);
    
    // Build index
    const { index, extraColumns } = buildCsvIndex(csvData);
    
    if (Object.keys(index).length === 0) {
      throw new Error('No valid records with join keys found in CSV');
    }
    
    // Update global state
    uploadedCsvData = csvData;
    csvIndex = index;
    enrichmentColumns = extraColumns;
    hasActiveEnrichment = true;
    enrichmentMatchStats = { matched: 0, total: 0 };
    
    // Reset file input
    document.getElementById('csvFileInput').value = '';
    
    // Update UI
    updateEnrichmentUI();
    
    const message = `✓ CSV loaded: ${csvData.length} rows, ${extraColumns.length} extra columns (${extraColumns.join(', ')})`;
    setPlaybackMessage(message, 'success');
    
    console.log('[CSV] Successfully loaded and indexed:', { 
      rowCount: csvData.length, 
      uniqueKeys: Object.keys(index).length,
      extraColumns 
    });
  } catch (error) {
    console.error('[CSV] Error loading CSV:', error);
    setPlaybackMessage(`CSV error: ${error.message}`, 'danger');
  }
}

/**
 * Enrich a single record with CSV data
 * @param {Object} record - Historic data record
 */
function enrichRecordWithCsv(record) {
  if (!hasActiveEnrichment || !record) return record;
  
  const cellid = String(record.BEST_CELLID || '').trim();
  const key = cellid;
  const enrichment = csvIndex[key];
  
  if (enrichment) {
    Object.assign(record, enrichment);
    enrichmentMatchStats.matched++;
  }
  
  return record;
}

/**
 * Enrich all records with CSV data
 * @param {Array} records - Array of historic records
 * @returns {Array} Enriched records
 */
function enrichRecordsWithCsv(records) {
  if (!hasActiveEnrichment || !records) return records;
  
  enrichmentMatchStats = { matched: 0, total: records.length };
  
  records.forEach(record => enrichRecordWithCsv(record));
  
  return records;
}

/**
 * Update enrichment badge visibility and state
 */
function updateEnrichmentUI() {
  const badge = document.getElementById('enrichmentBadge');
  if (!badge) return;
  
  if (hasActiveEnrichment) {
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

/**
 * Clear all CSV enrichment data
 */
function clearCsvEnrichment() {
  uploadedCsvData = null;
  csvIndex = {};
  enrichmentColumns = [];
  hasActiveEnrichment = false;
  enrichmentMatchStats = { matched: 0, total: 0 };
  
  updateEnrichmentUI();
  
  // Remove enriched columns from table if visible
  const thead = document.getElementById('historicTableHead');
  if (thead) {
    const enrichedHeader = thead.querySelector('th:last-child');
    if (enrichedHeader && enrichedHeader.id === 'enrichedColumnsHeader') {
      enrichedHeader.style.display = 'none';
      enrichedHeader.innerHTML = '';
    }
  }
  
  setPlaybackMessage('CSV enrichment cleared', 'info');
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
 * Render Bootstrap pagination controls below the table
 */
function renderPaginator(total, page, pageSize) {
  let container = document.getElementById('paginationControls');
  if (!container) {
    container = document.createElement('div');
    container.id = 'paginationControls';
    const detailsArea = document.getElementById('detailsArea');
    if (detailsArea) detailsArea.appendChild(container);
  }

  const totalPages = Math.ceil(total / pageSize);
  if (total <= pageSize || totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Historic data pagination');
  const ul = document.createElement('ul');
  ul.className = 'pagination pagination-sm justify-content-center mt-2 flex-wrap';

  // Prev button
  const prevLi = document.createElement('li');
  prevLi.className = `page-item${page === 1 ? ' disabled' : ''}`;
  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'page-link';
  prevBtn.textContent = '← Prev';
  if (page > 1) prevBtn.addEventListener('click', () => renderTableForSerial(currentActiveSerial, page - 1));
  prevLi.appendChild(prevBtn);
  ul.appendChild(prevLi);

  // Page info
  const infoLi = document.createElement('li');
  infoLi.className = 'page-item disabled';
  const infoSpan = document.createElement('span');
  infoSpan.className = 'page-link';
  infoSpan.textContent = `Page ${page} of ${totalPages} — ${total} records`;
  infoLi.appendChild(infoSpan);
  ul.appendChild(infoLi);

  // Next button
  const nextLi = document.createElement('li');
  nextLi.className = `page-item${page === totalPages ? ' disabled' : ''}`;
  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'page-link';
  nextBtn.textContent = 'Next →';
  if (page < totalPages) nextBtn.addEventListener('click', () => renderTableForSerial(currentActiveSerial, page + 1));
  nextLi.appendChild(nextBtn);
  ul.appendChild(nextLi);

  nav.appendChild(ul);
  container.innerHTML = '';
  container.appendChild(nav);
}

/**
 * Show details loading overlay
 */
function showDetailsLoading() {
  const overlay = document.getElementById('detailsLoadingOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
  }
}

/**
 * Hide details loading overlay
 */
function hideDetailsLoading() {
  const overlay = document.getElementById('detailsLoadingOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

/**
 * Update table header with enriched columns
 */
function updateTableHeaderWithEnrichedColumns() {
  const thead = document.getElementById('historicTableHead');
  if (!thead || !enrichmentColumns.length) return;
  
  const headerRow = thead.querySelector('tr');
  if (!headerRow) return;
  
  // Remove old enriched headers if any
  const oldEnrichedHeaders = headerRow.querySelectorAll('th[data-enriched="true"]');
  oldEnrichedHeaders.forEach(th => th.remove());
  
  // Add new enriched column headers
  enrichmentColumns.forEach(colName => {
    const th = document.createElement('th');
    th.setAttribute('data-enriched', 'true');
    th.style.backgroundColor = 'rgba(102, 126, 234, 0.15)';
    th.title = 'Enriched from CSV';
    th.textContent = colName;
    headerRow.appendChild(th);
  });
}








function renderHistoricTable(data, serial, total = null) {
  const table = document.getElementById('historicTable');
  const tbody = document.getElementById('historicTableBody');
  const noDataMessage = document.getElementById('noDataMessage');
  const exportBtn = document.getElementById('exportBtn');

  // Enrich data with CSV if available
  if (hasActiveEnrichment) {
    enrichRecordsWithCsv(data);
  }

  // Store data and total for sorting
  currentHistoricData = data || [];
  currentTotal = total;

  if (!data || data.length === 0) {
    table.style.display = 'none';
    noDataMessage.textContent = 'No historic data found for the selected period.';
    noDataMessage.style.display = 'block';
    exportBtn.style.display = 'none';
    setPlaybackMessage('No data found', 'muted');
    return;
  }

  // Update table header with enriched columns
  if (hasActiveEnrichment && enrichmentColumns.length > 0) {
    updateTableHeaderWithEnrichedColumns();
  }

  // Clear existing rows
  tbody.innerHTML = '';

  // Show export button for multiple serials (will export combined data as CSV)
  exportBtn.style.display = 'inline-block';
  exportBtn.textContent = 'Export CSV';
  exportBtn.onclick = (e) => {
    e.preventDefault();
    const startDate = getStartDateInputValue();
    const endDate = getEndDateInputValue();
    if (startDate && endDate) {
      exportAllHistoricDataAsCSV(serial, startDate, endDate);
    } else {
      setPlaybackMessage('Please select both start and end dates', 'warning');
    }
  };

  // Add rows
  data.forEach(record => {
    const row = document.createElement('tr');

    // ===== GENERAL VALUES =====
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
    latCell.textContent = formatNumber(record.LATITUDE, 6);
    row.appendChild(latCell);

    // LONGITUDE
    const lngCell = document.createElement('td');
    lngCell.textContent = formatNumber(record.LONGITUDE, 6);
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
    headingCell.textContent = formatNumber(record.HEADING, 1);
    row.appendChild(headingCell);

    // RSRP
    const rsrpCell = document.createElement('td');
    rsrpCell.textContent = formatNumber(record.RSRP, 1);
    row.appendChild(rsrpCell);

    // SINR
    const sinrCell = document.createElement('td');
    sinrCell.textContent = formatNumber(record.SINR, 1);
    row.appendChild(sinrCell);

    // TEMP
    const tempCell = document.createElement('td');
    tempCell.textContent = formatNumber(record.TEMP, 1);
    row.appendChild(tempCell);

    // RSRQ
    const rsrqCell = document.createElement('td');
    rsrqCell.textContent = formatNumber(record.RSRQ, 1);
    row.appendChild(rsrqCell);

    // ===== BEST CELL INFO =====
    // BEST_CELLID
    const bestCellidCell = document.createElement('td');
    bestCellidCell.textContent = record.BEST_CELLID || 'N/A';
    row.appendChild(bestCellidCell);

    // BEST_ENBID
    const bestEnbidCell = document.createElement('td');
    bestEnbidCell.textContent = record.BEST_ENBID || 'N/A';
    row.appendChild(bestEnbidCell);

    // BEST_SECID
    const bestSecidCell = document.createElement('td');
    bestSecidCell.textContent = record.BEST_SECID || 'N/A';
    row.appendChild(bestSecidCell);

    // BEST_PCI
    const bestPciCell = document.createElement('td');
    bestPciCell.textContent = record.BEST_PCI || 'N/A';
    row.appendChild(bestPciCell);

    // SELECTED_ANTENNA
    const selectedAntennaCell = document.createElement('td');
    selectedAntennaCell.textContent = formatNumber(record.SELECTED_ANTENNA, 1);
    row.appendChild(selectedAntennaCell);

    // EARFCN
    const earfcnCell = document.createElement('td');
    earfcnCell.textContent = formatNumber(record.EARFCN, 1);
    row.appendChild(earfcnCell);

    // ===== S0 SECTOR =====
    // S0RSRP
    const s0rsrpCell = document.createElement('td');
    s0rsrpCell.textContent = formatNumber(record.S0RSRP, 1);
    row.appendChild(s0rsrpCell);

    // S0SINR
    const s0sinrCell = document.createElement('td');
    s0sinrCell.textContent = formatNumber(record.S0SINR, 1);
    row.appendChild(s0sinrCell);

    // S0RSRQ
    const s0rsrqCell = document.createElement('td');
    s0rsrqCell.textContent = formatNumber(record.S0RSRQ, 1);
    row.appendChild(s0rsrqCell);

    // S0EARFCN
    const s0earfcnCell = document.createElement('td');
    s0earfcnCell.textContent = formatNumber(record.S0EARFCN, 1);
    row.appendChild(s0earfcnCell);

    // S0CELLID
    const s0cellidCell = document.createElement('td');
    s0cellidCell.textContent = record.S0CELLID || 'N/A';
    row.appendChild(s0cellidCell);

    // S0ENBID
    const s0enbidCell = document.createElement('td');
    s0enbidCell.textContent = record.S0ENBID || 'N/A';
    row.appendChild(s0enbidCell);

    // S0PCI
    const s0pciCell = document.createElement('td');
    s0pciCell.textContent = record.S0PCI || 'N/A';
    row.appendChild(s0pciCell);

    // ===== S1 SECTOR =====
    // S1RSRP
    const s1rsrpCell = document.createElement('td');
    s1rsrpCell.textContent = formatNumber(record.S1RSRP, 1);
    row.appendChild(s1rsrpCell);

    // S1SINR
    const s1sinrCell = document.createElement('td');
    s1sinrCell.textContent = formatNumber(record.S1SINR, 1);
    row.appendChild(s1sinrCell);

    // S1RSRQ
    const s1rsrqCell = document.createElement('td');
    s1rsrqCell.textContent = formatNumber(record.S1RSRQ, 1);
    row.appendChild(s1rsrqCell);

    // S1EARFCN
    const s1earfcnCell = document.createElement('td');
    s1earfcnCell.textContent = formatNumber(record.S1EARFCN, 1);
    row.appendChild(s1earfcnCell);

    // S1CELLID
    const s1cellidCell = document.createElement('td');
    s1cellidCell.textContent = record.S1CELLID || 'N/A';
    row.appendChild(s1cellidCell);

    // S1ENBID
    const s1enbidCell = document.createElement('td');
    s1enbidCell.textContent = record.S1ENBID || 'N/A';
    row.appendChild(s1enbidCell);

    // S1PCI
    const s1pciCell = document.createElement('td');
    s1pciCell.textContent = record.S1PCI || 'N/A';
    row.appendChild(s1pciCell);

    // ===== S2 SECTOR =====
    // S2RSRP
    const s2rsrpCell = document.createElement('td');
    s2rsrpCell.textContent = formatNumber(record.S2RSRP, 1);
    row.appendChild(s2rsrpCell);

    // S2SINR
    const s2sinrCell = document.createElement('td');
    s2sinrCell.textContent = formatNumber(record.S2SINR, 1);
    row.appendChild(s2sinrCell);

    // S2RSRQ
    const s2rsrqCell = document.createElement('td');
    s2rsrqCell.textContent = formatNumber(record.S2RSRQ, 1);
    row.appendChild(s2rsrqCell);

    // S2EARFCN
    const s2earfcnCell = document.createElement('td');
    s2earfcnCell.textContent = formatNumber(record.S2EARFCN, 1);
    row.appendChild(s2earfcnCell);

    // S2CELLID
    const s2cellidCell = document.createElement('td');
    s2cellidCell.textContent = record.S2CELLID || 'N/A';
    row.appendChild(s2cellidCell);

    // S2ENBID
    const s2enbidCell = document.createElement('td');
    s2enbidCell.textContent = record.S2ENBID || 'N/A';
    row.appendChild(s2enbidCell);

    // S2PCI
    const s2pciCell = document.createElement('td');
    s2pciCell.textContent = record.S2PCI || 'N/A';
    row.appendChild(s2pciCell);

    // ===== S3 SECTOR =====
    // S3RSRP
    const s3rsrpCell = document.createElement('td');
    s3rsrpCell.textContent = formatNumber(record.S3RSRP, 1);
    row.appendChild(s3rsrpCell);

    // S3SINR
    const s3sinrCell = document.createElement('td');
    s3sinrCell.textContent = formatNumber(record.S3SINR, 1);
    row.appendChild(s3sinrCell);

    // S3RSRQ
    const s3rsrqCell = document.createElement('td');
    s3rsrqCell.textContent = formatNumber(record.S3RSRQ, 1);
    row.appendChild(s3rsrqCell);

    // S3EARFCN
    const s3earfcnCell = document.createElement('td');
    s3earfcnCell.textContent = formatNumber(record.S3EARFCN, 1);
    row.appendChild(s3earfcnCell);

    // S3CELLID
    const s3cellidCell = document.createElement('td');
    s3cellidCell.textContent = record.S3CELLID || 'N/A';
    row.appendChild(s3cellidCell);

    // S3ENBID
    const s3enbidCell = document.createElement('td');
    s3enbidCell.textContent = record.S3ENBID || 'N/A';
    row.appendChild(s3enbidCell);

    // S3PCI
    const s3pciCell = document.createElement('td');
    s3pciCell.textContent = record.S3PCI || 'N/A';
    row.appendChild(s3pciCell);

    // ===== ENRICHED COLUMNS (from CSV) =====
    if (hasActiveEnrichment && enrichmentColumns.length > 0) {
      enrichmentColumns.forEach(colName => {
        const enrichedCell = document.createElement('td');
        const value = record[colName];
        
        // Try to format numeric values
        if (value !== null && value !== undefined && value !== '') {
          const numValue = parseFloat(value);
          if (!isNaN(numValue) && isFinite(numValue)) {
            enrichedCell.textContent = numValue.toFixed(2);
          } else {
            enrichedCell.textContent = String(value);
          }
        } else {
          enrichedCell.textContent = 'N/A';
        }
        row.appendChild(enrichedCell);
      });
    }

    tbody.appendChild(row);
  });

  // Show table, hide message
  table.style.display = 'table';
  noDataMessage.style.display = 'none';

  const totalPages = Math.ceil(total / PAGE_SIZE);
  renderPaginator(total, currentPage, PAGE_SIZE);
  
  // Build status message
  let statusMsg = `Page ${currentPage} of ${totalPages} — ${total} total records`;
  if (hasActiveEnrichment) {
    statusMsg += ` | Enriched ${enrichmentMatchStats.matched} of ${enrichmentMatchStats.total} records`;
  }
  
  setPlaybackMessage(statusMsg, 'success');
}

/**
 * Load and render historic data for a serial
 * @param {string} serial - Serial number (or 'all')
 * @param {number} [page] - Page number for paginated 'all' view (default 1)
 */
async function renderTableForSerial(serial, page = 1) {
  showDetailsLoading();
  if (!serial) {
    setPlaybackMessage('Please select a system.', 'warning');
    hideDetailsLoading();
    return;
  }

  currentActiveSerial = serial;

  const startDate = getStartDateInputValue();
  const endDate = getEndDateInputValue();

  if (!startDate || !endDate) {
    setPlaybackMessage('Please select both start and end dates.', 'warning');
    hideDetailsLoading();
    return;
  }

  // Cancel any ongoing request
  if (currentAbortController) {
    currentAbortController.abort();
  }

  // Create new AbortController for this request
  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;

  setPlaybackMessage('Loading data...', 'muted');

  try {
    if (serial === 'all') {
      currentPage = page;
      const result = await fetchPagedHistoricAllData(startDate, endDate, page, PAGE_SIZE, signal);
      renderHistoricTable(result.data, serial, result.total);
    } else {
      currentPage = page;
      const result = await fetchHistoricSerialData(serial, startDate, endDate, page, PAGE_SIZE, signal);
      renderHistoricTable(result.data, serial, result.total);
    }
    hideDetailsLoading();
  } catch (error) {
    // Don't show error message if request was cancelled
    if (error.name === 'AbortError') {
      console.log('[Historic Details] Request cancelled');
      return;
    }
    console.error('Error loading historic data:', error);
    setPlaybackMessage('Error loading data.', 'danger');
    hideDetailsLoading();
  }
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
    serialInput.dataset.selectedSerial = 'all';
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
        serialInput.dataset.selectedSerial = 'all';
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
            serialInput.dataset.selectedSerial = serial;
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
    // Mark page as successfully loaded
    window.markPageAsLoaded();
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

  // CSV Upload button listener
  const uploadCsvBtn = document.getElementById('uploadCsvBtn');
  if (uploadCsvBtn) {
    uploadCsvBtn.addEventListener('click', () => {
      document.getElementById('csvFileInput').click();
    });
  }

  // CSV File input listener
  const csvFileInput = document.getElementById('csvFileInput');
  if (csvFileInput) {
    csvFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        loadAndIndexCSV(file);
      }
    });
  }

  // CSV Clear button listener
  const clearCsvBtn = document.getElementById('clearCsvBtn');
  if (clearCsvBtn) {
    clearCsvBtn.addEventListener('click', (e) => {
      e.preventDefault();
      clearCsvEnrichment();
    });
  }

  // // Initialize the map mode toggle
  // initToggle();

  // // Initialize antenna toggles
  // initAntennaToggles();

  console.log('[Details Page] Initialized');
  // Mark page as successfully loaded
  window.markPageAsLoaded();
}

// Start the app on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
