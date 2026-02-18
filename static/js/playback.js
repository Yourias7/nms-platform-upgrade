// static/js/playback.js
// Playback page - RSRP time-series visualization
import { CONFIG } from './config.js';
import { fetchSerialData } from './api.js';
import { fetchHistoricSerialsList, fetchHistoricSerialData } from './api.js';

let chartInstance = null;
let chartInstance2 = null;
let mapInstance = null;
let mapMarkers = [];
let currentRecords = [];
let useRSRPColoring = false;

function getSelectedSerial() {
  const params = new URLSearchParams(window.location.search);
  const serial = params.get('serial');
  return serial ? serial.trim() : '';
}

function getSelectedDate() {
  const params = new URLSearchParams(window.location.search);
  const date = params.get('date');
  return date ? date.trim() : '';
}

function sortByDatetime(records) {
  return records
    .filter((rec) => rec && rec.DATETIME)
    .sort((a, b) => new Date(a.DATETIME) - new Date(b.DATETIME));
}

function buildRSRPChartData(records) {
  const labels = [];
  const rsrpValues = [];

  records.forEach((rec) => {
    const dt = new Date(rec.DATETIME);
    labels.push(dt.toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }));
    rsrpValues.push(rec.RSRP);
  });

  return {
    labels,
    datasets: [
      {
        label: 'RSRP (dBm)',
        data: rsrpValues,
        borderColor: '#0d6efd',
        backgroundColor: 'rgba(13, 110, 253, 0.1)',
        borderWidth: 2,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#0d6efd',
        pointBorderColor: '#fff',
        pointBorderWidth: 1,
        tension: 0.4,
        spanGaps: false
      }
    ]
  };
}

function buildSINRChartData(records) {
  const labels = [];
  const sinrValues = [];

  records.forEach((rec) => {
    const dt = new Date(rec.DATETIME);
    labels.push(dt.toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }));
    sinrValues.push(rec.SINR);
  });
  console.log('Built SINR chart data with %d points', sinrValues.length);
  return {
    labels,
    datasets: [
      {
        label: 'SINR (dB)',
        data: sinrValues,
        borderColor: '#0d6efd',
        backgroundColor: 'rgba(13, 110, 253, 0.1)',
        borderWidth: 2,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#0d6efd',
        pointBorderColor: '#fff',
        pointBorderWidth: 1,
        tension: 0.4,
        spanGaps: false
      }
    ]
  };
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
    min: Math.max(40, min),
    max: Math.min(-20, max)
  };
}

function setPlaybackMessage(message, tone = 'muted') {
  const el = document.getElementById('playbackMessage');
  if (!el) return;
  el.className = `text-${tone} small`;
  el.textContent = message;
}

function populateSerialOptions(serials) {
  const dropdown = document.getElementById('serialOptions');
  if (!dropdown) return;

  // Store original serials for filtering
  dropdown.dataset.serials = JSON.stringify(serials);

  // Render initial options (keep hidden until user interacts)
  renderDropdownOptions(serials);
  dropdown.style.display = 'show';

  // Setup input event listener for filtering
  const input = document.getElementById('serialInput');
  if (input) {
    const updateDropdown = () => {
      const filterValue = input.value.toLowerCase().trim();
      const filtered = filterValue === ''
        ? serials
        : serials.filter((serial) => serial.toLowerCase().includes(filterValue));
      
      renderDropdownOptions(filtered);
      
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

function renderDropdownOptions(serials) {
  const dropdown = document.getElementById('serialOptions');
  if (!dropdown) return;
  dropdown.innerHTML = '';
  
  // Sort serials before rendering
  const sortedSerials = [...serials].sort();
  
  sortedSerials.forEach((serial) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'dropdown-item';
    option.textContent = serial;
    option.addEventListener('click', (e) => {
      e.preventDefault();
      const input = document.getElementById('serialInput');
      if (input) {
        input.value = serial;
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
  return input ? input.value.trim() : '';
}

function getDateInputValue() {
  const input = document.getElementById('dateInput');
  return input ? input.value.trim() : '';
}

function setSerialInputValue(serial) {
  const input = document.getElementById('serialInput');
  if (input) {
    input.value = serial;
  }
}

function setDateInputValue(date) {
  const input = document.getElementById('dateInput');
  if (input) {
    input.value = date;
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

async function loadHistoricData(serial) {
  console.log('[Playback Page] Loading historic data for selected serial:', serial);

  if (!serial) {
    return { serial: '', records: [] };
  }

  const records = await fetchHistoricSerialData(serial);
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
              borderColor: '#85c6f1',
              backgroundColor: 'rgba(13, 110, 253, 0.1)',
              borderWidth: 2,
              fill: true,
              pointRadius: 3,
              pointBackgroundColor: '#85c6f1',
              pointBorderColor: '#85c6f1',
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
              borderColor: '#85c6f1',
              backgroundColor: 'rgba(13, 110, 253, 0.1)',
              borderWidth: 2,
              fill: true,
              pointRadius: 3,
              pointBackgroundColor: '#85c6f1',
              pointBorderColor: '#85c6f1',
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
          }
        }
      });
    }
}

async function renderChartForSerial(serial) {
  if (!serial) {
    setPlaybackMessage('Select a serial to load data.', 'muted');
    return;
  }

  setPlaybackMessage('Loading data...', 'muted');
  const { records } = await loadHistoricData(serial);

  if (!records || records.length === 0) {
    setPlaybackMessage('No historic records found.', 'muted');
    return;
  }

  const rsrpChartData = buildRSRPChartData(records);
  const yBounds = computeRSRPYAxisBounds(rsrpChartData.datasets[0].data);

  if (chartInstance) {
    chartInstance.data.labels = rsrpChartData.labels;
    chartInstance.data.datasets[0].data = rsrpChartData.datasets[0].data;
    chartInstance.options.scales.y.min = yBounds.min;
    chartInstance.options.scales.y.max = yBounds.max;
    chartInstance.update();
  }

  const sinrChartData = buildSINRChartData(records);
  const yBoundsSINR = computeSINRYAxisBounds(sinrChartData.datasets[0].data);

  if (chartInstance2) {
    chartInstance2.data.labels = sinrChartData.labels;
    chartInstance2.data.datasets[0].data = sinrChartData.datasets[0].data;
    chartInstance2.options.scales.y.min = yBoundsSINR.min;
    chartInstance2.options.scales.y.max = yBoundsSINR.max;
    chartInstance2.update();
  }

  // Update map with data points
  currentRecords = records;
  updateMapWithData(records);

  setPlaybackMessage('', 'muted');
  console.log('[Playback] Chart updated', serial ? `for ${serial}` : '');
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

  console.log('[Playback] Map initialized');
  return mapInstance;
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
    
    // Determine color based on useRSRPColoring state
    const markerColor = useRSRPColoring ? getColorForRSRP(rec.RSRP) : '#000000';
    
    const marker = L.circleMarker([lat, lon], {
      radius: 6,
      fillColor: markerColor,
      color: markerColor,
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8
    });

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

  // Create polyline connecting points
  // const latLngs = validRecords.map(rec => [rec.LAT || rec.LATITUDE, rec.LON || rec.LONGITUDE]);
  // const polyline = L.polyline(latLngs, {
  //   color: '#667eea',
  //   weight: 2,
  //   opacity: 0.7
  // }).addTo(mapInstance);
  // mapMarkers.push(polyline);

  // // Fit map to show all points
  // mapInstance.fitBounds(polyline.getBounds(), { padding: [50, 50] });
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
 * Toggle map marker coloring between RSRP and black
 */
function toggleMapColoring() {
  useRSRPColoring = !useRSRPColoring;
  
  // Redraw markers with new colors
  if (currentRecords.length > 0) {
    updateMapWithData(currentRecords);
  }
  
  // Update button text or state
  const mapBtn = document.getElementById('mapBtn');
  if (mapBtn) {
    mapBtn.textContent = useRSRPColoring ? 'Coverage (by Signal)' : 'Coverage (Uniform)';
  }
  
  console.log('[Playback] Map coloring toggled to:', useRSRPColoring ? 'RSRP' : 'Black');
}

/**
 * Initialize the playback page
 */
async function init() {
  console.log('[Playback Page] Initializing');
  await initChart();
  initMap();

  setPlaybackMessage('Loading serials...', 'muted');
  try {
    const serials = await fetchHistoricSerialsList();
    populateSerialOptions(serials || []);
    setPlaybackMessage(serials && serials.length > 0 ? '' : 'No serials available.', 'muted');
  } catch (err) {
    console.error('[Playback] Failed to load serials', err);
    setPlaybackMessage('Failed to load serials.', 'danger');
  }

  const serialFromUrl = getSelectedSerial();
  if (serialFromUrl) {
    setSerialInputValue(serialFromUrl);
    await renderChartForSerial(serialFromUrl);
  } else {
    setPlaybackMessage('Select a serial to load data.', 'muted');
  }

  const loadBtn = document.getElementById('serialLoadBtn');
  if (loadBtn) {
    loadBtn.addEventListener('click', async () => {
      const serial = getSerialInputValue();
      updateSerialInUrl(serial);
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
        await renderChartForSerial(serial);
      }
    });
  }

  // Add event listener for map button
  const mapBtn = document.getElementById('mapBtn');
  if (mapBtn) {
    mapBtn.addEventListener('click', toggleMapColoring);
  }

  console.log('[Playback Page] Initialized');
}

// Start the app on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
