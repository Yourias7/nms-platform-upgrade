// static/js/playback.js
// Playback page - RSRP time-series visualization
import { CONFIG } from '../shared/config.js';
import { fetchSerialData, fetchSerialNameMap, fetchEarliestSerialData, fetchLatestSerialData } from '../shared/api.js';
import { fetchHistoricSerialsList, fetchHistoricSerialData } from '../shared/api.js';

let chartInstance = null;
let chartInstance2 = null;
let mapInstance = null;
let mapMarkers = [];
let lassoLayerGroup = null;
let activeLassoLayer = null;
let lassoSelectedRecords = null;
let currentRecords = [];
let chartSelectedIndices = new Set(); // Track selected chart point indices
let chartSelectionActive = false; // Track if chart selection is being used
let chartSelectionMode = false; // Track if box selection mode is active
let selectionBox = null; // Current selection box coordinates
let coloringMode = 'rsrp'; // 'rsrp' or 'sinr'
let serialNameMap = {};
let mapLegend = null;
let selectedRSRPAntennas = ['best']; // any of: 'best', '0', '1', '2', '3'
let selectedSINRAntennas = ['best']; // any of: 'best', '0', '1', '2', '3'
let currentAbortController = null; // Track ongoing requests

const ANTENNA_COLORS = {
  best: '#0d6efd', // blue
  '0': '#ffc107',  // yellow (Ant1)
  '1': '#fd7e14',  // orange (Ant2)
  '2': '#6f42c1',  // purple (Ant3)
  '3': '#198754'   // green (Ant4)
};

function getAntennaColor(antenna) {
  return ANTENNA_COLORS[antenna] || '#0d6efd';
}

function getAntennaLabel(antenna, metric) {
  return antenna === 'best'
    ? `Best ${metric}`
    : `Antenna ${parseInt(antenna, 10) + 1} ${metric}`;
}

function getAntennaFieldName(antenna, metric) {
  return antenna === 'best' ? metric : `S${antenna}${metric}`;
}

function buildMetricChartData(records, selectedAntennas, metric, unit) {
  const labels = records.map((rec) => {
    const dt = new Date(rec.DATETIME);
    return dt.toLocaleString('en-US', { month: 'short', day: '2-digit' });
  });

  const datasets = selectedAntennas.map((antenna) => {
    const fieldName = getAntennaFieldName(antenna, metric);
    const color = getAntennaColor(antenna);
    return {
      label: `${getAntennaLabel(antenna, metric)} (${unit})`,
      data: records.map((rec) => rec[fieldName]),
      borderColor: color,
      backgroundColor: `${color}1A`,
      borderWidth: 2,
      fill: false,
      pointRadius: 2,
      pointHoverRadius: 4,
      pointBackgroundColor: color,
      pointBorderColor: color,
      pointBorderWidth: 1,
      tension: 0.35,
      spanGaps: false
    };
  });

  return { labels, datasets };
}

function getAllDatasetValues(datasets) {
  return (datasets || []).flatMap((dataset) => dataset.data || []);
}

function getActiveDisplayRecords() {
  // Priority: chart selection > lasso selection > all records
  if (chartSelectionActive && chartSelectedIndices.size > 0) {
    return Array.from(chartSelectedIndices).map(idx => currentRecords[idx]).filter(r => r);
  }
  return lassoSelectedRecords !== null ? lassoSelectedRecords : currentRecords;
}

function renderChartsAndDataCards(records) {
  const safeRecords = records || [];

  const rsrpChartData = buildRSRPChartData(safeRecords, selectedRSRPAntennas);
  const yBounds = computeRSRPYAxisBounds(getAllDatasetValues(rsrpChartData.datasets));

  if (chartInstance) {
    chartInstance.data.labels = rsrpChartData.labels;
    chartInstance.data.datasets = rsrpChartData.datasets;
    chartInstance.options.scales.y.min = yBounds.min;
    chartInstance.options.scales.y.max = yBounds.max;
    chartInstance.update();
  }

  const sinrChartData = buildSINRChartData(safeRecords, selectedSINRAntennas);
  const yBoundsSINR = computeSINRYAxisBounds(getAllDatasetValues(sinrChartData.datasets));

  if (chartInstance2) {
    chartInstance2.data.labels = sinrChartData.labels;
    chartInstance2.data.datasets = sinrChartData.datasets;
    chartInstance2.options.scales.y.min = yBoundsSINR.min;
    chartInstance2.options.scales.y.max = yBoundsSINR.max;
    chartInstance2.update();
  }

  updateDataCards(safeRecords);
}

function updateDataCards(records) {
  // Helper function to calculate average
  const getAverage = (field) => {
    const values = records.map(r => r[field]).filter(v => v !== null && v !== undefined);
    return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
  };

  const bestRSRP = getAverage('RSRP');
  const bestSINR = getAverage('SINR');
  const ant1RSRP = getAverage('S0RSRP');
  const ant1SINR = getAverage('S0SINR');
  const ant2RSRP = getAverage('S1RSRP');
  const ant2SINR = getAverage('S1SINR');
  const ant3RSRP = getAverage('S2RSRP');
  const ant3SINR = getAverage('S2SINR');
  const ant4RSRP = getAverage('S3RSRP');
  const ant4SINR = getAverage('S3SINR');
  const bestDetailsRSRP = document.getElementById('bestDetailsRSRP');
  const bestDetailsSINR = document.getElementById('bestDetailsSINR');
  const ant1DetailsRSRP = document.getElementById('ant1DetailsRSRP');
  const ant1DetailsSINR = document.getElementById('ant1DetailsSINR');
  const ant2DetailsRSRP = document.getElementById('ant2DetailsRSRP');
  const ant2DetailsSINR = document.getElementById('ant2DetailsSINR');
  const ant3DetailsRSRP = document.getElementById('ant3DetailsRSRP');
  const ant3DetailsSINR = document.getElementById('ant3DetailsSINR');
  const ant4DetailsRSRP = document.getElementById('ant4DetailsRSRP');
  const ant4DetailsSINR = document.getElementById('ant4DetailsSINR');

  if (!records || records.length === 0) {
    bestDetailsRSRP.textContent = 'N/A';
    bestDetailsSINR.textContent = 'N/A';
    ant1DetailsRSRP.textContent = 'N/A';
    ant1DetailsSINR.textContent =  'N/A';
    ant2DetailsRSRP.textContent = 'N/A';
    ant2DetailsSINR.textContent = 'N/A';
    ant3DetailsRSRP.textContent = 'N/A';
    ant3DetailsSINR.textContent = 'N/A';
    ant4DetailsRSRP.textContent = 'N/A';
    ant4DetailsSINR.textContent = 'N/A';
    return;
  }

  if (bestDetailsRSRP) bestDetailsRSRP.textContent = bestRSRP !== null && bestRSRP !== undefined ? `${bestRSRP.toFixed(2)} dBm` : 'N/A';
  if (bestDetailsSINR) bestDetailsSINR.textContent = bestSINR !== null && bestSINR !== undefined ? `${bestSINR.toFixed(2)} dB` : 'N/A';
  if (ant1DetailsRSRP) ant1DetailsRSRP.textContent = ant1RSRP !== null && ant1RSRP !== undefined ? `${ant1RSRP.toFixed(2)} dBm` : 'N/A';
  if (ant1DetailsSINR) ant1DetailsSINR.textContent = ant1SINR !== null && ant1SINR !== undefined ? `${ant1SINR.toFixed(2)} dB` : 'N/A';
  if (ant2DetailsRSRP) ant2DetailsRSRP.textContent = ant2RSRP !== null && ant2RSRP !== undefined ? `${ant2RSRP.toFixed(2)} dBm` : 'N/A';
  if (ant2DetailsSINR) ant2DetailsSINR.textContent = ant2SINR !== null && ant2SINR !== undefined ? `${ant2SINR.toFixed(2)} dB` : 'N/A';
  if (ant3DetailsRSRP) ant3DetailsRSRP.textContent = ant3RSRP !== null && ant3RSRP !== undefined ? `${ant3RSRP.toFixed(2)} dBm` : 'N/A';
  if (ant3DetailsSINR) ant3DetailsSINR.textContent = ant3SINR !== null && ant3SINR !== undefined ? `${ant3SINR.toFixed(2)} dB` : 'N/A';
  if (ant4DetailsRSRP) ant4DetailsRSRP.textContent = ant4RSRP !== null && ant4RSRP !== undefined ? `${ant4RSRP.toFixed(2)} dBm` : 'N/A';
  if (ant4DetailsSINR) ant4DetailsSINR.textContent = ant4SINR !== null && ant4SINR !== undefined ? `${ant4SINR.toFixed(2)} dB` : 'N/A';

  // Show/hide antenna cards based on data availability - TO DO

}

/**
 * Show map loading overlay
 */
function showMapLoading() {
  const overlay = document.getElementById('mapLoadingOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
  }
}

/**
 * Hide map loading overlay
 */
function hideMapLoading() {
  const overlay = document.getElementById('mapLoadingOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

/**
 * Show RSRP loading overlay
 */
function showRSRPLoading() {
  const overlay = document.getElementById('rsrpLoadingOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
  }
}

/**
 * Hide RSRP loading overlay
 */
function hideRSRPLoading() {
  const overlay = document.getElementById('rsrpLoadingOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

/**
 * Show SINR loading overlay
 */
function showSINRLoading() {
  const overlay = document.getElementById('sinrLoadingOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
  }
}

/**
 * Hide SINR loading overlay
 */
function hideSINRLoading() {
  const overlay = document.getElementById('sinrLoadingOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
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

function sortByDatetime(records) {
  return records
    .filter((rec) => rec && rec.DATETIME)
    .sort((a, b) => new Date(a.DATETIME) - new Date(b.DATETIME));
}

function buildRSRPChartData(records, selectedAntennas = ['best']) {
  showRSRPLoading();
  const chartData = buildMetricChartData(records, selectedAntennas, 'RSRP', 'dBm');
  console.log('Built RSRP chart data for %d antennas with %d points', selectedAntennas.length, records.length);
  hideRSRPLoading();
  return chartData;
}

function buildSINRChartData(records, selectedAntennas = ['best']) {
  showSINRLoading();
  const chartData = buildMetricChartData(records, selectedAntennas, 'SINR', 'dB');
  console.log('Built SINR chart data for %d antennas with %d points', selectedAntennas.length, records.length);
  hideSINRLoading();
  return chartData;
}

function computeRSRPYAxisBounds(values) {
  if (!values || values.length === 0) {
    return { min: -140, max: -60 };
  }

  const minValue = Math.min(...values.filter((v) => v !== null && v !== undefined));
  const maxValue = Math.max(...values.filter((v) => v !== null && v !== undefined));
  const padding = 5;

  const min = Math.floor(minValue - padding);
  const max = Math.ceil(maxValue + padding);

  return {
    min: Math.max(-160, min),
    max: Math.min(-40, max)
  };
}

function computeSINRYAxisBounds(values) {
  if (!values || values.length === 0) {
    return { min: -20, max: 40 };
  }

  const minValue = Math.min(...values.filter((v) => v !== null && v !== undefined));
  const maxValue = Math.max(...values.filter((v) => v !== null && v !== undefined));
  const padding = 5;

  const min = Math.floor(minValue - padding);
  const max = Math.ceil(maxValue + padding);

  return {
    min: Math.max(-20, min),
    max: Math.min(40, max)
  };
}

function setPlaybackMessage(message, tone = 'muted') {
  const el = document.getElementById('playbackMessage');
  if (!el) return;
  el.className = `text-${tone} small`;
  el.textContent = message;
}

async function populateSerialOptions(serials) {
  const dropdown = document.getElementById('serialOptions');
  if (!dropdown) return;

  // Fetch mapping of serial -> display name
  try {
    serialNameMap = await fetchSerialNameMap();
  } catch (err) {
    console.warn('[Playback] Failed to fetch serial name map', err);
    serialNameMap = {};
  }

  // Store original serials for filtering
  dropdown.dataset.serials = JSON.stringify(serials);

  // Render initial options (keep hidden until user interacts)
  renderDropdownOptions(serials, serialNameMap);
  dropdown.style.display = 'show';

  // Setup input event listener for filtering
  const input = document.getElementById('serialInput');
  if (input) {
    const updateDropdown = () => {
      // clear any previously selected serial when user types/filters
      if (input.dataset && input.dataset.selectedSerial) delete input.dataset.selectedSerial;
      const filterValue = input.value.toLowerCase().trim();
      const filtered = filterValue === ''
        ? serials
        : serials.filter((serial) => {
            const name = (serialNameMap && serialNameMap[serial]) ? String(serialNameMap[serial]).toLowerCase() : '';
            return serial.toLowerCase().includes(filterValue) || name.includes(filterValue);
          });

      renderDropdownOptions(filtered, serialNameMap);

      // Use Bootstrap's 'show' class for dropdown visibility
      if (filtered.length > 0) {
        dropdown.classList.add('show');
        dropdown.style.display = 'block';
      } else {
        dropdown.classList.remove('show');
        dropdown.style.display = 'none';
      }
    };

    input.addEventListener('input', updateDropdown);
    input.addEventListener('focus', updateDropdown);
    input.addEventListener('click', updateDropdown);
    
    // Show dropdown on initial focus before any typing
    input.addEventListener('focus', () => {
      dropdown.style.display = serials.length > 0 ? 'block' : 'none';
    });
  }
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

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const input = document.getElementById('serialInput');
  const dropdown = document.getElementById('serialOptions');
  if (input && dropdown && e.target !== input && e.target !== dropdown && !dropdown.contains(e.target)) {
    dropdown.classList.remove('show');
    dropdown.style.display = 'none';
  }
});

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

async function setDefaultDatesForSerial(serial) {
  if (!serial) return;

  try {
    const earliestRecord = await fetchEarliestSerialData(serial);
    const latestRecord = await fetchLatestSerialData(serial);

    if (earliestRecord && earliestRecord.DATETIME) {
      const startDate = formatDateForInput(earliestRecord.DATETIME);
      setStartDateInputValue(startDate);
    }

    if (latestRecord && latestRecord.DATETIME) {
      const endDate = formatDateForInput(latestRecord.DATETIME);
      setEndDateInputValue(endDate);
    }

    // Update URL with dates
    updateDatesInUrl(getStartDateInputValue(), getEndDateInputValue());
  } catch (err) {
    console.warn('[Playback] Failed to fetch default dates for serial', serial, err);
  }
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

function updateDateInUrl(date) {
  const params = new URLSearchParams(window.location.search);
  if (date) {
    params.set('date', date);
  } else {
    params.delete('date');
  }
  const query = params.toString();
  const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState({}, '', url);
}

async function loadHistoricData(serial, startDate, endDate) {
  console.log('[Playback Page] Loading historic data for selected serial:', serial, 'from', startDate, 'to', endDate);

  if (!serial) {
    return { serial: '', records: [] };
  }

  // Cancel any ongoing request
  if (currentAbortController) {
    currentAbortController.abort();
  }
  
  // Create new AbortController for this request
  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;

  const response = await fetchHistoricSerialData(serial, startDate, endDate, 1, 500, signal);
  const records = response.data || response || [];
  return { serial, records: sortByDatetime(records || []) };
}

/**
 * Initialize the playback chart
 */
function buildEmptyChart(ctx) {
  switch (ctx.id) {
    case 'rsrpChart':
      return new Chart(ctx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            {
              label: 'RSRP (dBm)',
              data: [],
              borderColor: '#764ba2',
              backgroundColor: 'rgba(13, 110, 253, 0.1)',
              borderWidth: 2,
              fill: true,
              pointRadius: 3,
              pointBackgroundColor: '#764ba2',
              pointBorderColor: '#764ba2',
              pointBorderWidth: 1,
              tension: 0.4,
              spanGaps: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                usePointStyle: true,
                padding: 15,
                font: {
                  size: 14
                }
              }
            },
            title: {
              display: false
            }
          },
          scales: {
            x: {
              grid: {
                display: true,
                color: 'rgba(0, 0, 0, 0.05)'
              },
              ticks: {
                font: {
                  size: 11
                }
              }
            },
            y: {
              beginAtZero: false,
              min: -140,
              max: -60,
              title: {
                display: true,
                text: 'RSRP (dBm)',
                font: {
                  size: 12,
                  weight: 'bold'
                }
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.1)'
              },
              ticks: {
                font: {
                  size: 11
                }
              }
            }
          },
          interaction: {
            intersect: false,
            mode: 'index'
          },
          onClick: (event, activeElements, chart) => {
            handleChartPointClick(event, chart);
          }
        }
      });
    case 'sinrChart':
      return new Chart(ctx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            {
              label: 'SINR (dB)',
              data: [],
              borderColor: '#764ba2',
              backgroundColor: 'rgba(13, 110, 253, 0.1)',
              borderWidth: 2,
              fill: true,
              pointRadius: 3,
              pointBackgroundColor: '#764ba2',
              pointBorderColor: '#764ba2',
              pointBorderWidth: 1,
              tension: 0.4,
              spanGaps: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                usePointStyle: true,
                padding: 15,
                font: {
                  size: 14
                }
              }
            },
            title: {
              display: false
            }
          },
          scales: {
            x: {
              grid: {
                display: true,
                color: 'rgba(0, 0, 0, 0.05)'
              },
              ticks: {
                font: {
                  size: 11
                }
              }
            },
            y: {
              beginAtZero: false,
              min: -20,
              max: 40,
              title: {
                display: true,
                text: 'SINR (dB)',
                font: {
                  size: 12,
                  weight: 'bold'
                }
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.1)'
              },
              ticks: {
                font: {
                  size: 11
                }
              }
            }
          },
          interaction: {
            intersect: false,
            mode: 'index'
          },
          onClick: (event, activeElements, chart) => {
            handleChartPointClick(event, chart);
          }
        }
      });
    }
}

async function renderChartForSerial(serial) {
  // Show loading overlays while fetching and rendering data
  showMapLoading();
  showRSRPLoading();
  showSINRLoading();
  
  if (!serial) {
    setPlaybackMessage('Select a serial to load data.', 'muted');
    // Hide loading overlays
    hideMapLoading();
    hideRSRPLoading();
    hideSINRLoading();
    return;
  }

  const startDate = getStartDateInputValue();
  const endDate = getEndDateInputValue();

  if (!startDate || !endDate) {
    setPlaybackMessage('Please select start and end dates.', 'warning');
    // Hide loading overlays
    hideMapLoading();
    hideRSRPLoading();
    hideSINRLoading();
    return;
  }

  // Convert date strings to datetime strings
  const startDateTime = `${startDate}T00:00:00`;
  const endDateTime = `${endDate}T23:59:59`;

  setPlaybackMessage('Loading data...', 'muted');
  
  try {
    const { records } = await loadHistoricData(serial, startDateTime, endDateTime);

    if (!records || records.length === 0) {
      setPlaybackMessage('No historic records found for the selected date range.', 'muted');
      // Hide loading overlays
      hideMapLoading();
      hideRSRPLoading();
      hideSINRLoading();
      return;
    }

    // Update map with data points
    currentRecords = records;
    updateMapWithData(records);

    if (!activeLassoLayer) {
      lassoSelectedRecords = null;
      renderChartsAndDataCards(records);
      setPlaybackMessage('', 'muted');
    }

    console.log('[Playback] Chart updated', serial ? `for ${serial}` : '');
    // Hide loading overlays after data is loaded
    hideMapLoading();
    hideRSRPLoading();
    hideSINRLoading();
  } catch (error) {
    // Don't show error message if request was cancelled
    if (error.name === 'AbortError') {
      console.log('[Playback] Request cancelled');
      return;
    }
    console.error('[Playback] Error loading data:', error);
    setPlaybackMessage('Error loading data.', 'danger');
    hideMapLoading();
    hideRSRPLoading();
    hideSINRLoading();
  }
}

async function initChart() {
  const ctx = document.getElementById('rsrpChart');
  const ctx2 = document.getElementById('sinrChart');
  console.log('[Playback Page] Initializing chart with canvas:', ctx);
  console.log('[Playback Page] Initializing chart with canvas:', ctx2);
  
  if (!ctx || !ctx2) {
    console.warn('[Playback] Chart canvas not found');
    return;
  }

  chartInstance = buildEmptyChart(ctx);
  chartInstance2 = buildEmptyChart(ctx2);
  
  // Enable box selection on both charts
  enableChartBoxSelection(chartInstance, 'rsrpChart');
  enableChartBoxSelection(chartInstance2, 'sinrChart');
}

/**
 * Get the map instance
 * @returns {L.Map|null}
 */
export function getMap() {
  return mapInstance;
}

/**
 * Initialize the map
 */
function initMap() {
  // Show loading overlay
  showMapLoading();
  const mapDiv = document.getElementById('playbackMap');
  if (!mapDiv) {
    console.warn('[Playback] Map div not found');
    return;
  }

  // Initialize Leaflet map
  mapInstance = L.map('playbackMap').setView(
    [CONFIG.MAP.INITIAL_LAT, CONFIG.MAP.INITIAL_LON],
    CONFIG.MAP.INITIAL_ZOOM
  );
  
  // Add OpenStreetMap tiles
  L.tileLayer(CONFIG.MAP.TILE_URL, {
    // maxZoom: CONFIG.MAP.MAX_ZOOM,
    attribution: CONFIG.MAP.TILE_ATTRIBUTION
  }).addTo(mapInstance);

  // Add legend to the map
  addMapLegend();
  initLassoTool();

  console.log('[Playback] Map initialized');
  hideMapLoading();
  return mapInstance;
}

function getMarkerBaseColor(rec) {
  if (coloringMode === 'sinr') {
    return getColorForSINR(rec?.SINR);
  }
  return getColorForRSRP(rec?.RSRP);
}

function applyDefaultMarkerStyle(marker) {
  const rec = marker?._record || {};
  const markerColor = getMarkerBaseColor(rec);
  marker.setStyle({
    radius: 6,
    fillColor: markerColor,
    color: markerColor,
    weight: 1,
    opacity: 1,
    fillOpacity: 0.8
  });
}

function isLatLngInPolygon(point, polygonLatLngs) {
  const x = point.lng;
  const y = point.lat;
  let inside = false;

  for (let i = 0, j = polygonLatLngs.length - 1; i < polygonLatLngs.length; j = i++) {
    const xi = polygonLatLngs[i].lng;
    const yi = polygonLatLngs[i].lat;
    const xj = polygonLatLngs[j].lng;
    const yj = polygonLatLngs[j].lat;

    const intersects = ((yi > y) !== (yj > y))
      && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi);

    if (intersects) inside = !inside;
  }

  return inside;
}

function clearLassoSelection() {
  lassoSelectedRecords = null;
  mapMarkers.forEach((marker) => applyDefaultMarkerStyle(marker));
  renderChartsAndDataCards(getActiveDisplayRecords());
}

function clearChartSelection() {
  chartSelectedIndices.clear();
  chartSelectionActive = false;
  
  // Hide clear buttons
  const clearBtn = document.getElementById('clearChartSelectionBtn');
  const clearBtn2 = document.getElementById('clearChartSelectionBtn2');
  if (clearBtn) clearBtn.style.display = 'none';
  if (clearBtn2) clearBtn2.style.display = 'none';
  
  // Reset point styles to default
  if (chartInstance) {
    chartInstance.data.datasets.forEach(dataset => {
      dataset.pointRadius = 2;
      dataset.pointHoverRadius = 4;
      dataset.pointBorderWidth = 1;
    });
    chartInstance.update('none');
  }
  if (chartInstance2) {
    chartInstance2.data.datasets.forEach(dataset => {
      dataset.pointRadius = 2;
      dataset.pointHoverRadius = 4;
      dataset.pointBorderWidth = 1;
    });
    chartInstance2.update('none');
  }
  
  // Update map and data cards
  updateMapWithData(currentRecords);
  renderChartsAndDataCards(getActiveDisplayRecords());
  setPlaybackMessage('', 'muted');
}

function handleChartPointClick(event, chart) {
  // Single click just toggles individual point selection
  const points = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
  
  if (points.length > 0) {
    const point = points[0];
    const dataIndex = point.index;
    
    // Toggle selection
    if (chartSelectedIndices.has(dataIndex)) {
      chartSelectedIndices.delete(dataIndex);
    } else {
      chartSelectedIndices.add(dataIndex);
    }
    
    chartSelectionActive = chartSelectedIndices.size > 0;
    
    // Show/hide clear buttons based on selection state
    const clearBtn = document.getElementById('clearChartSelectionBtn');
    const clearBtn2 = document.getElementById('clearChartSelectionBtn2');
    if (clearBtn) clearBtn.style.display = chartSelectionActive ? 'block' : 'none';
    if (clearBtn2) clearBtn2.style.display = chartSelectionActive ? 'block' : 'none';
    
    // Update point styles
    updateChartPointStyles();
    
    // Update map and data display
    const selectedRecords = getActiveDisplayRecords();
    updateMapWithData(selectedRecords);
    renderChartsAndDataCards(selectedRecords);
    
    if (chartSelectionActive) {
      setPlaybackMessage(`${chartSelectedIndices.size} point(s) selected. Click-drag on chart to select multiple.`, 'primary');
    } else {
      setPlaybackMessage('', 'muted');
    }
  }
}

function enableChartBoxSelection(chart, canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  let isDragging = false;
  let startX, startY;
  let overlayCanvas = null;
  let overlayCtx = null;
  
  // Create overlay canvas for drawing selection box
  const createOverlay = () => {
    overlayCanvas = document.createElement('canvas');
    overlayCanvas.style.position = 'absolute';
    overlayCanvas.style.left = '0';
    overlayCanvas.style.top = '0';
    overlayCanvas.style.pointerEvents = 'none';
    overlayCanvas.width = canvas.width;
    overlayCanvas.height = canvas.height;
    overlayCanvas.style.width = canvas.style.width;
    overlayCanvas.style.height = canvas.style.height;
    canvas.parentElement.appendChild(overlayCanvas);
    overlayCtx = overlayCanvas.getContext('2d');
  };
  
  const removeOverlay = () => {
    if (overlayCanvas) {
      overlayCanvas.remove();
      overlayCanvas = null;
      overlayCtx = null;
    }
  };
  
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    isDragging = true;
    createOverlay();
  });
  
  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging || !overlayCtx) return;
    
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    // Clear and redraw selection box
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    overlayCtx.strokeStyle = '#0d6efd';
    overlayCtx.fillStyle = 'rgba(13, 110, 253, 0.1)';
    overlayCtx.lineWidth = 2;
    overlayCtx.strokeRect(startX, startY, currentX - startX, currentY - startY);
    overlayCtx.fillRect(startX, startY, currentX - startX, currentY - startY);
  });
  
  canvas.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    
    const rect = canvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    
    isDragging = false;
    removeOverlay();
    
    // Selection box coordinates (normalize to ensure min/max)
    const boxLeft = Math.min(startX, endX);
    const boxRight = Math.max(startX, endX);
    const boxTop = Math.min(startY, endY);
    const boxBottom = Math.max(startY, endY);
    
    // Only select if box has some size (not just a click)
    if (Math.abs(endX - startX) < 5 || Math.abs(endY - startY) < 5) {
      return; // Too small, treat as click not drag
    }
    
    // Find all points within the selection box
    const chartArea = chart.chartArea;
    const xScale = chart.scales.x;
    const yScale = chart.scales.y;
    
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      dataset.data.forEach((value, index) => {
        if (value === null || value === undefined) return;
        
        const xPixel = xScale.getPixelForValue(index);
        const yPixel = yScale.getPixelForValue(value);
        
        // Check if point is within selection box
        if (xPixel >= boxLeft && xPixel <= boxRight && yPixel >= boxTop && yPixel <= boxBottom) {
          chartSelectedIndices.add(index);
        }
      });
    });
    
    chartSelectionActive = chartSelectedIndices.size > 0;
    
    // Show/hide clear buttons
    const clearBtn = document.getElementById('clearChartSelectionBtn');
    const clearBtn2 = document.getElementById('clearChartSelectionBtn2');
    if (clearBtn) clearBtn.style.display = chartSelectionActive ? 'block' : 'none';
    if (clearBtn2) clearBtn2.style.display = chartSelectionActive ? 'block' : 'none';
    
    // Update visuals
    updateChartPointStyles();
    const selectedRecords = getActiveDisplayRecords();
    updateMapWithData(selectedRecords);
    renderChartsAndDataCards(selectedRecords);
    
    if (chartSelectionActive) {
      setPlaybackMessage(`${chartSelectedIndices.size} point(s) selected. Click-drag to select more.`, 'primary');
    }
  });
  
  canvas.addEventListener('mouseleave', () => {
    if (isDragging) {
      isDragging = false;
      removeOverlay();
    }
  });
}

function updateChartPointStyles() {
  const updateChart = (chart) => {
    if (!chart) return;
    
    chart.data.datasets.forEach(dataset => {
      const pointRadii = [];
      const pointBorderWidths = [];
      const pointHoverRadii = [];
      
      for (let i = 0; i < dataset.data.length; i++) {
        if (chartSelectedIndices.has(i)) {
          pointRadii.push(6);
          pointBorderWidths.push(3);
          pointHoverRadii.push(8);
        } else if (chartSelectionActive) {
          pointRadii.push(1.5);
          pointBorderWidths.push(1);
          pointHoverRadii.push(3);
        } else {
          pointRadii.push(2);
          pointBorderWidths.push(1);
          pointHoverRadii.push(4);
        }
      }
      
      dataset.pointRadius = pointRadii;
      dataset.pointBorderWidth = pointBorderWidths;
      dataset.pointHoverRadius = pointHoverRadii;
    });
    
    chart.update('none');
  };
  
  updateChart(chartInstance);
  updateChart(chartInstance2);
}

function clearActiveLasso() {
  if (lassoLayerGroup) {
    lassoLayerGroup.clearLayers();
  }
  activeLassoLayer = null;
  clearLassoSelection();
  // Also clear chart selection when clearing lasso
  clearChartSelection();
  setPlaybackMessage('', 'muted');
}

function applyLassoSelection(layer) {
  if (!layer || mapMarkers.length === 0) return;

  const latLngs = layer.getLatLngs();
  const polygon = Array.isArray(latLngs[0]) ? latLngs[0] : latLngs;
  let selectedCount = 0;
  const selectedRecords = [];

  mapMarkers.forEach((marker) => {
    const inside = isLatLngInPolygon(marker.getLatLng(), polygon);
    if (inside) {
      selectedCount += 1;
      if (marker._record) {
        selectedRecords.push(marker._record);
      }
      marker.setStyle({
        radius: 8,
        fillColor: '#00d4ff',
        color: '#111827',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.95
      });
    } else {
      applyDefaultMarkerStyle(marker);
    }
  });

  lassoSelectedRecords = selectedRecords;
  renderChartsAndDataCards(selectedRecords);

  setPlaybackMessage(`${selectedCount} point(s) selected by lasso.`, 'primary');
}

function initLassoTool() {
  if (!mapInstance || typeof L.Control.Draw === 'undefined') {
    console.warn('[Playback] Leaflet.Draw not available; lasso disabled');
    return;
  }

  lassoLayerGroup = new L.FeatureGroup();
  mapInstance.addLayer(lassoLayerGroup);

  const drawControl = new L.Control.Draw({
    position: 'topleft',
    draw: {
      polygon: {
        allowIntersection: false,
        showArea: true,
        shapeOptions: {
          color: '#0d6efd',
          weight: 2,
          fillOpacity: 0.08
        }
      },
      polyline: false,
      rectangle: false,
      circle: false,
      marker: false,
      circlemarker: false
    },
    edit: false
  });

  mapInstance.addControl(drawControl);

  const ClearLassoControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
      const link = L.DomUtil.create('a', '', container);
      link.href = '#';
      link.title = 'Clear lasso';
      link.setAttribute('role', 'button');
      link.setAttribute('aria-label', 'Clear lasso');
      link.innerHTML = '&times;';
      link.style.fontSize = '18px';
      link.style.lineHeight = '26px';
      link.style.textAlign = 'center';

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(link, 'click', (e) => {
        L.DomEvent.preventDefault(e);
        clearActiveLasso();
      });

      return container;
    }
  });

  mapInstance.addControl(new ClearLassoControl());

  mapInstance.on(L.Draw.Event.CREATED, (event) => {
    lassoLayerGroup.clearLayers();
    lassoLayerGroup.addLayer(event.layer);
    activeLassoLayer = event.layer;
    applyLassoSelection(activeLassoLayer);
  });
}

/**
 * Update map with data points
 */
function updateMapWithData(records) {
  if (!mapInstance) return;

  // Clear existing markers
  mapMarkers.forEach(marker => mapInstance.removeLayer(marker));
  mapMarkers = [];

  // Debug: Log first record to see available fields
  if (records.length > 0) {
    console.log('[Playback] First record fields:', Object.keys(records[0]));
    console.log('[Playback] First record:', records[0]);
  }

  // Filter records with valid coordinates - try both field name variations
  const validRecords = records.filter(rec => 
    (rec.LAT && rec.LON) || (rec.LATITUDE && rec.LONGITUDE)
  );
  
  if (validRecords.length === 0) {
    console.warn('[Playback] No records with valid coordinates');
    console.warn('[Playback] Total records:', records.length);
    return;
  }

  console.log('[Playback] Valid records with coordinates:', validRecords.length);

  // Add markers for each data point
  validRecords.forEach((rec, index) => {
    const lat = rec.LAT || rec.LATITUDE;
    const lon = rec.LON || rec.LONGITUDE;
    
    // Determine color based on coloring mode
    let markerColor = '#000000'; // Default uniform color
    if (coloringMode === 'rsrp') {
      markerColor = getColorForRSRP(rec.RSRP);
    } else if (coloringMode === 'sinr') {
      markerColor = getColorForSINR(rec.SINR);
    }
    
    const marker = L.circleMarker([lat, lon], {
      radius: 6,
      fillColor: markerColor,
      color: markerColor,
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8
    });
    marker._record = rec;

    const dt = new Date(rec.DATETIME);
    marker.bindPopup(`
      <strong>Point ${index + 1}</strong><br>
      Time: ${dt.toLocaleString()}<br>
      RSRP: ${rec.RSRP} dBm<br>
      SINR: ${rec.SINR} dB<br>
      Lat: ${lat}<br>
      Lon: ${lon}
    `);

    marker.addTo(mapInstance);
    mapMarkers.push(marker);
  });

  // Fit map to show all markers
  if (mapMarkers.length > 0) {
    const group = new L.featureGroup(mapMarkers);
    mapInstance.fitBounds(group.getBounds(), { padding: [20, 20] });
    updateLegendContent();

    if (activeLassoLayer) {
      applyLassoSelection(activeLassoLayer);
    }
  }
}

/**
 * Add legend to the map
 */
function addMapLegend() {
  if (!mapInstance) return;

  mapLegend = L.control({ position: 'topright' });

  mapLegend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'map-legend');
    div.id = 'mapLegendContent';
    updateLegendContent();
    return div;
  };

  mapLegend.addTo(mapInstance);
  updateLegendContent();
}

/**
 * Update legend content based on current coloring mode
 */
function updateLegendContent() {
  const legendDiv = document.getElementById('mapLegendContent');
  if (!legendDiv) return;

  if (coloringMode === 'rsrp') {
    legendDiv.innerHTML = `
      <div class="legend-title">RSRP Signal Quality</div>
      <div class="legend-item">
        <span class="legend-color" style="background: #28a745;"></span>
        <span class="legend-label">Excellent (≥ -80 dBm)</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: #ffc107;"></span>
        <span class="legend-label">Fair (-80 to -95 dBm)</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: #fd7e14;"></span>
        <span class="legend-label">Poor (-95 to -110 dBm)</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: #dc3545;"></span>
        <span class="legend-label">Bad (< -110 dBm)</span>
      </div>
    `;
  } else if (coloringMode === 'sinr') {
    legendDiv.innerHTML = `
      <div class="legend-title">SINR Signal Quality</div>
      <div class="legend-item">
        <span class="legend-color" style="background: #28a745;"></span>
        <span class="legend-label">Excellent (≥ 10 dB)</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: #ffc107;"></span>
        <span class="legend-label">Fair (5 to 10 dB)</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: #fd7e14;"></span>
        <span class="legend-label">Poor (0 to 5 dB)</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: #dc3545;"></span>
        <span class="legend-label">Bad (< 0 dB)</span>
      </div>
    `;
  }
}

/**
 * Get color based on RSRP value
 */
function getColorForRSRP(rsrp) {
  if (rsrp >= -80) return '#28a745'; // Good - green
  if (rsrp >= -95) return '#ffc107'; // Fair - yellow
  if (rsrp >= -110) return '#fd7e14'; // Poor - orange
  return '#dc3545'; // Bad - red
}

/**
 * Get color based on SINR value
 */
function getColorForSINR(sinr) {
  if (sinr >= 10) return '#28a745'; // Good - green
  if (sinr >= 5) return '#ffc107'; // Fair - yellow
  if (sinr >= 0) return '#fd7e14'; // Poor - orange
  return '#dc3545'; // Bad - red
}

/**
 * Apply RSRP coloring mode
 */
function applyRSRP() {
  coloringMode = "rsrp";
  updateLegendContent();
  
  // Redraw markers with new colors
  if (currentRecords.length > 0) {
    updateMapWithData(currentRecords);
  }
  
  // Show legend
  if (mapLegend && mapLegend.getContainer()) {
    mapLegend.getContainer().style.display = 'block';
  }
  
  console.log("[Playback] Map mode set to RSRP");
}

/**
 * Apply SINR coloring mode
 */
function applySINR() {
  coloringMode = "sinr";
  updateLegendContent();
  
  // Redraw markers with new colors
  if (currentRecords.length > 0) {
    updateMapWithData(currentRecords);
  }
  
  // Show legend
  if (mapLegend && mapLegend.getContainer()) {
    mapLegend.getContainer().style.display = 'block';
  }
  
  console.log("[Playback] Map mode set to SINR");
}

/**
 * Set toggle UI state
 */
function setToggleUI(isRight) {
  const toggle = document.getElementById("mapModeToggle");
  if (toggle) {
    toggle.classList.toggle("is-right", isRight);
    toggle.setAttribute("aria-checked", String(isRight));
  }
}

/**
 * Set map coloring mode
 */
function setMode(isRight) {
  setToggleUI(isRight);
  if (isRight) {
    applySINR();
  } else {
    applyRSRP();
  }
}

/**
 * Initialize the toggle control
 */
function initToggle() {
  const toggle = document.getElementById("mapModeToggle");
  if (!toggle) {
    console.warn('[Playback] Toggle element not found');
    return;
  }

  // Initial state (left = RSRP)
  setMode(false);

  // Click handler
  toggle.addEventListener("click", () => {
    const isRightNow = toggle.classList.contains("is-right");
    setMode(!isRightNow);
  });

  // Keyboard support (Space / Enter)
  toggle.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      const isRightNow = toggle.classList.contains("is-right");
      setMode(!isRightNow);
    }
  });
  
  console.log('[Playback] Toggle initialized');
}

/**
 * Initialize antenna toggle buttons
 */
function initAntennaToggles() {
  const toggleAntennaSelection = (selectedAntennas, antenna) => {
    const exists = selectedAntennas.includes(antenna);
    if (exists) {
      if (selectedAntennas.length === 1) {
        return selectedAntennas;
      }
      return selectedAntennas.filter((a) => a !== antenna);
    }
    return [...selectedAntennas, antenna];
  };

  const setButtonStates = (buttons, selectedAntennas) => {
    buttons.forEach((b) => {
      b.classList.toggle('active', selectedAntennas.includes(b.dataset.antenna));
    });
  };

  // RSRP Antenna Toggle
  const rsrpToggle = document.getElementById('rsrpAntennaToggle');
  if (rsrpToggle) {
    const rsrpButtons = rsrpToggle.querySelectorAll('.antenna-toggle-btn');
    rsrpButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const antenna = btn.dataset.antenna;
        selectedRSRPAntennas = toggleAntennaSelection(selectedRSRPAntennas, antenna);
        setButtonStates(rsrpButtons, selectedRSRPAntennas);
        
        // Re-render chart with new antenna data
        if (currentRecords && currentRecords.length > 0) {
          const rsrpChartData = buildRSRPChartData(getActiveDisplayRecords(), selectedRSRPAntennas);
          const yBounds = computeRSRPYAxisBounds(getAllDatasetValues(rsrpChartData.datasets));
          
          if (chartInstance) {
            chartInstance.data.labels = rsrpChartData.labels;
            chartInstance.data.datasets = rsrpChartData.datasets;
            chartInstance.options.scales.y.min = yBounds.min;
            chartInstance.options.scales.y.max = yBounds.max;
            chartInstance.update();
          }
        }
      });
    });
  }

  // SINR Antenna Toggle
  const sinrToggle = document.getElementById('sinrAntennaToggle');
  if (sinrToggle) {
    const sinrButtons = sinrToggle.querySelectorAll('.antenna-toggle-btn');
    sinrButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const antenna = btn.dataset.antenna;
        selectedSINRAntennas = toggleAntennaSelection(selectedSINRAntennas, antenna);
        setButtonStates(sinrButtons, selectedSINRAntennas);
        
        // Re-render chart with new antenna data
        if (currentRecords && currentRecords.length > 0) {
          const sinrChartData = buildSINRChartData(getActiveDisplayRecords(), selectedSINRAntennas);
          const yBoundsSINR = computeSINRYAxisBounds(getAllDatasetValues(sinrChartData.datasets));
          
          if (chartInstance2) {
            chartInstance2.data.labels = sinrChartData.labels;
            chartInstance2.data.datasets = sinrChartData.datasets;
            chartInstance2.options.scales.y.min = yBoundsSINR.min;
            chartInstance2.options.scales.y.max = yBoundsSINR.max;
            chartInstance2.update();
          }
        }
      });
    });
  }
  
  console.log('[Playback] Antenna toggles initialized');
}

/**
 * Initialize the playback page
 */
async function init() {
  console.log('[Playback Page] Initializing');
  await initChart();
  initMap();
  setDateConstraints();

  setPlaybackMessage('Loading serials...', 'muted');
  try {
    const serials = await fetchHistoricSerialsList();
    await populateSerialOptions(serials || []);
    setPlaybackMessage(serials && serials.length > 0 ? '' : 'No serials available.', 'muted');
    
    // Hide loading overlay after serials are loaded
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
    }
  } catch (err) {
    console.error('[Playback] Failed to load serials', err);
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
    await renderChartForSerial(serialFromUrl);
  } else {
    setPlaybackMessage('Select a serial to load data.', 'muted');
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
      await renderChartForSerial(serial);
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
        await renderChartForSerial(serial);
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

      // Clear charts
      if (chartInstance) {
        chartInstance.data.labels = [];
        chartInstance.data.datasets = [chartInstance.data.datasets[0]];
        chartInstance.data.datasets[0].data = [];
        chartInstance.data.datasets[0].label = 'RSRP (dBm)';
        chartInstance.update();
      }
      if (chartInstance2) {
        chartInstance2.data.labels = [];
        chartInstance2.data.datasets = [chartInstance2.data.datasets[0]];
        chartInstance2.data.datasets[0].data = [];
        chartInstance2.data.datasets[0].label = 'SINR (dB)';
        chartInstance2.update();
      }

      // Clear map markers
      mapMarkers.forEach(marker => mapInstance.removeLayer(marker));
      mapMarkers = [];
      if (lassoLayerGroup) {
        lassoLayerGroup.clearLayers();
      }
      activeLassoLayer = null;
      lassoSelectedRecords = null;

      // Clear chart selection
      chartSelectedIndices.clear();
      chartSelectionActive = false;

      // Clear data cards
      currentRecords = [];
      updateDataCards([]);

      // Reset antenna selection to "best"
      selectedRSRPAntennas = ['best'];
      selectedSINRAntennas = ['best'];
      
      // Reset antenna toggle buttons
      const rsrpToggle = document.getElementById('rsrpAntennaToggle');
      if (rsrpToggle) {
        rsrpToggle.querySelectorAll('.antenna-toggle-btn').forEach(btn => {
          btn.classList.toggle('active', selectedRSRPAntennas.includes(btn.dataset.antenna));
        });
      }
      const sinrToggle = document.getElementById('sinrAntennaToggle');
      if (sinrToggle) {
        sinrToggle.querySelectorAll('.antenna-toggle-btn').forEach(btn => {
          btn.classList.toggle('active', selectedSINRAntennas.includes(btn.dataset.antenna));
        });
      }

      // Reset message
      setPlaybackMessage('Select a serial to load data.', 'muted');

      console.log('[Playback] Cleared all filters and data');
    });
  }

  // Initialize the map mode toggle
  initToggle();

  // Initialize antenna toggles
  initAntennaToggles();

  // Add event listeners for chart clear buttons
  const clearChartBtn = document.getElementById('clearChartSelectionBtn');
  const clearChartBtn2 = document.getElementById('clearChartSelectionBtn2');
  if (clearChartBtn) {
    clearChartBtn.addEventListener('click', () => {
      clearChartSelection();
    });
  }
  if (clearChartBtn2) {
    clearChartBtn2.addEventListener('click', () => {
      clearChartSelection();
    });
  }

  console.log('[Playback Page] Initialized');
  // Mark page as successfully loaded
  window.markPageAsLoaded();
}

// Start the app on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
