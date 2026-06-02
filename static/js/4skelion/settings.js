import { parseCSVContent, validateCsvHeaders, buildCsvIndex, saveCsvEnrichmentToStorage, clearCsvEnrichmentStorage, getCsvEnrichmentStatus } from '../shared/csv-enrichment.js';

// static/js/settings.js
// Settings management for alarm thresholds

console.log('[Settings] settings.js loaded');

const STORAGE_KEY = 'nms_alarm_thresholds';

// Default thresholds
const DEFAULT_THRESHOLDS = {
  rsrp: -120,
  sinr: 0,
  temp: 60,
  lat: 0,
  lon: 0,
  // COMMUNICATION_ALARM_THRESHOLD_HOURS: 3
  // best temp
};

function updateSettingsCsvStatusUI() {
  getCsvEnrichmentStatus().then(status => {
    const statusEl = document.getElementById('settingsCsvStatus');
    const loadBtn = document.getElementById('settingsLoadCsvBtn');
    const clearBtn = document.getElementById('settingsClearCsvBtn');

    if (!statusEl) return;

    if (!status.hasStoredCsv) {
      statusEl.textContent = 'No CSV uploaded. Upload in Settings and then load it from Historic Details.';
      if (loadBtn) loadBtn.disabled = true;
      if (clearBtn) clearBtn.disabled = true;
      return;
    }

    statusEl.textContent = `Stored CSV: ${status.fileName} · ${status.rowCount} rows · ${status.enrichmentColumns.length} extra column(s)`;
    if (loadBtn) loadBtn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;
  });
}

async function handleSettingsCsvUpload(file) {
  if (!file) return;

  try {
    const text = await file.text();
    const csvData = parseCSVContent(text);
    validateCsvHeaders(Object.keys(csvData[0] || {}));

    const { index, indexByEnb, extraColumns } = buildCsvIndex(csvData); // <-- Added indexByEnb here
    if (!Object.keys(index).length) {
      throw new Error('No valid records with join keys found in CSV');
    }

    await saveCsvEnrichmentToStorage({
      fileName: file.name,
      rowCount: csvData.length,
      index: index,
      indexByEnb: indexByEnb, // <-- THIS WAS MISSING
      enrichmentColumns: extraColumns
    });

    updateSettingsCsvStatusUI();
    showSettingsMessage(`CSV uploaded and stored for Historic Details (${csvData.length} rows).`, 'success');
  } catch (error) {
    console.error('[Settings CSV] Upload failed', error);
    showSettingsMessage(`CSV upload failed: ${error.message}`, 'danger');
  }
}

async function handleSettingsCsvClear(event) {
  if (event) event.preventDefault();
  await clearCsvEnrichmentStorage();
  updateSettingsCsvStatusUI();
  showSettingsMessage('Stored CSV cleared from Settings.', 'info');
}

function initSettingsCsvSection() {
  const uploadBtn = document.getElementById('settingsUploadCsvBtn');
  const clearBtn = document.getElementById('settingsClearCsvBtn');
  const fileInput = document.getElementById('settingsCsvFileInput');

  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => fileInput.click());
  }

  if (fileInput) {
    fileInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file) {
        handleSettingsCsvUpload(file);
      }
      fileInput.value = '';
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', handleSettingsCsvClear);
  }

  updateSettingsCsvStatusUI();
}

/**
 * Get alarm thresholds from localStorage or defaults
 * @returns {Object} Threshold values
 */
export function getThresholds() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse stored thresholds:', e);
    }
  }
  return { ...DEFAULT_THRESHOLDS };
}

/**
 * Save alarm thresholds to localStorage
 * @param {Object} thresholds - Threshold values to save
 */
export function saveThresholds(thresholds) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(thresholds));
}

/**
 * Reset thresholds to defaults
 */
export function resetThresholds() {
  localStorage.removeItem(STORAGE_KEY);
  return { ...DEFAULT_THRESHOLDS };
}

/**
 * Initialize settings form with current values
 */
export function initSettingsForm() {
  const thresholds = getThresholds();
  console.log('[Settings] Initializing with thresholds:', thresholds);
  
  // Check if elements exist
  const rsrpInput = document.getElementById('rsrp-threshold');
  const sinrInput = document.getElementById('sinr-threshold');
  const tempInput = document.getElementById('temp-threshold');
  if (!rsrpInput || !sinrInput || !tempInput) {
    console.warn('[Settings] Form elements not found, will initialize on tab switch');
    return;
  }
  
  // Set form values
  rsrpInput.value = thresholds.rsrp;
  sinrInput.value = thresholds.sinr;
  tempInput.value = thresholds.temp;
  
  // Display current values
  updateThresholdDisplays(thresholds);
  
  // Setup live updates for range inputs (only if not already set)
  if (!rsrpInput.hasAttribute('data-listener-attached')) {
    rsrpInput.addEventListener('input', (e) => {
      document.getElementById('rsrp-value').textContent = e.target.value;
    });
    rsrpInput.setAttribute('data-listener-attached', 'true');
  }
  
  if (!sinrInput.hasAttribute('data-listener-attached')) {
    sinrInput.addEventListener('input', (e) => {
      document.getElementById('sinr-value').textContent = e.target.value;
    });
    sinrInput.setAttribute('data-listener-attached', 'true');
  }
  
  if (!tempInput.hasAttribute('data-listener-attached')) {
    tempInput.addEventListener('input', (e) => {
      document.getElementById('temp-value').textContent = e.target.value;
    });
    tempInput.setAttribute('data-listener-attached', 'true');
  }
  
  console.log('[Settings] Form initialized with values:', { rsrp: rsrpInput.value, sinr: sinrInput.value, temp: tempInput.value, lat: 0, lon: 0 });
}

/**
 * Update threshold display values
 */
function updateThresholdDisplays(thresholds) {
  const rsrpValue = document.getElementById('rsrp-value');
  const sinrValue = document.getElementById('sinr-value');
  const tempValue = document.getElementById('temp-value');
  
  if (rsrpValue) rsrpValue.textContent = thresholds.rsrp;
  if (sinrValue) sinrValue.textContent = thresholds.sinr;
  if (tempValue) tempValue.textContent = thresholds.temp;
}

/**
 * Handle settings form submission
 */
export function handleSettingsSave(event) {
  if (event) {
    event.preventDefault();
  }
  const rsrp = parseFloat(document.getElementById('rsrp-threshold').value);
  const sinr = parseFloat(document.getElementById('sinr-threshold').value);
  const temp = parseFloat(document.getElementById('temp-threshold').value);
  
  const thresholds = { rsrp, sinr, temp, lat: 0, lon: 0 };
  console.log('[Settings] Saving thresholds:', thresholds);
  saveThresholds(thresholds);
  updateThresholdDisplays(thresholds);
  
  // Show success message
  showSettingsMessage('Settings saved successfully!', 'success');
  
  // Trigger refresh of serials to update LED colors
  console.log('[Settings] Dispatching thresholds-updated event');
  window.dispatchEvent(new CustomEvent('thresholds-updated'));
}

/**
 * Handle reset button
 */
export function handleSettingsReset(event) {
  if (event) {
    event.preventDefault();
  }
  const thresholds = resetThresholds();
  
  // Update form
  document.getElementById('rsrp-threshold').value = thresholds.rsrp;
  document.getElementById('sinr-threshold').value = thresholds.sinr;
  document.getElementById('temp-threshold').value = thresholds.temp;
  
  updateThresholdDisplays(thresholds);
  
  // Show success message
  showSettingsMessage('Settings reset to defaults!', 'info');
  
  // Trigger refresh
  window.dispatchEvent(new CustomEvent('thresholds-updated'));
}

/**
 * Show settings message
 */
function showSettingsMessage(message, type) {
  const messageEl = document.getElementById('settings-message');
  messageEl.textContent = message;
  messageEl.className = `alert alert-${type}`;
  messageEl.style.display = 'block';
  
  setTimeout(() => {
    messageEl.style.display = 'none';
  }, 3000);
}

/**
 * Check if a value is in alarm state
 * @param {string} kpi - KPI name ('rsrp', 'sinr', 'temp')
 * @param {number} value - Value to check
 * @returns {boolean} True if in alarm
 */
export function isInAlarm(kpi, value) {
  if (value === null || value === undefined) return false;
  
  const thresholds = getThresholds();
  const numValue = parseFloat(value);
  let result = false;
  
  switch (kpi.toLowerCase()) {
    case 'rsrp':
      result = numValue <= thresholds.rsrp;
      break;
    case 'sinr':
      result = numValue <= thresholds.sinr;
      break;
    case 'temp':
      result = numValue >= thresholds.temp;
      break;
    case 'lat':
      result = numValue === 0;
      break;
    case 'lon':
      result = numValue === 0;
      break;
    default:
      return false;
  }
  
  console.log(`[Settings] isInAlarm(${kpi}=${numValue}, threshold=${thresholds[kpi.toLowerCase()]}) = ${result}`);
  return result;
}

/**
 * Get all active alarms for a serial's KPIs
 * @param {Object} kpiValues - Object with rsrp, sinr, temp values
 * @returns {Array<string>} Array of KPI names in alarm state
 */
export function getActiveAlarms(kpiValues) {
  const alarms = [];
  if (isInAlarm('rsrp', kpiValues.rsrp)) alarms.push('rsrp');
  if (isInAlarm('sinr', kpiValues.sinr)) alarms.push('sinr');
  if (isInAlarm('temp', kpiValues.temp)) alarms.push('temp');
  if (isInAlarm('lat', kpiValues.lat)) alarms.push('lat');
  if (isInAlarm('lon', kpiValues.lon)) alarms.push('lon');
  return alarms;
}

function bindRangeLabel(inputId, labelId) {
  const input = document.getElementById(inputId);
  const label = document.getElementById(labelId);

  if (!input || !label) return;

  const updateLabel = () => {
    label.textContent = input.value;
  };

  if (!input.hasAttribute('data-label-bound')) {
    input.addEventListener('input', updateLabel);
    input.addEventListener('change', updateLabel);
    input.setAttribute('data-label-bound', 'true');
  }

  updateLabel();
}

function initPage() {
  const settingsForm = document.getElementById('settings-form');
  if (!settingsForm) {
    return;
  }

  console.log('[Settings] Settings page detected, initializing...');

  initSettingsForm();

  settingsForm.addEventListener('submit', handleSettingsSave);

  const resetBtn = document.getElementById('reset-settings');
  if (resetBtn) {
    resetBtn.addEventListener('click', handleSettingsReset);
  }

  initSettingsCsvSection();
  bindRangeLabel('rsrp-threshold', 'rsrp-value');
  bindRangeLabel('sinr-threshold', 'sinr-value');
  bindRangeLabel('temp-threshold', 'temp-value');
  // Mark page as successfully loaded
  window.markPageAsLoaded();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage);
} else {
  initPage();
}

window.addEventListener('pageshow', initPage);
