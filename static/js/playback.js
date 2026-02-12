// static/js/playback.js
// Playback page - RSRP time-series visualization

import { fetchHistoricSerialsList, fetchHistoricSerialData } from './api.js';

let chartInstance = null;
let chartInstance2 = null;

function getSelectedSerial() {
  const params = new URLSearchParams(window.location.search);
  const serial = params.get('serial');
  return serial ? serial.trim() : '';
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
  const datalist = document.getElementById('serialOptions');
  if (!datalist) return;
  datalist.innerHTML = '';

  serials.forEach((serial) => {
    const option = document.createElement('option');
    option.value = serial;
    datalist.appendChild(option);
  });
}

function getSerialInputValue() {
  const input = document.getElementById('serialInput');
  return input ? input.value.trim() : '';
}

function setSerialInputValue(serial) {
  const input = document.getElementById('serialInput');
  if (input) {
    input.value = serial;
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
 * Initialize the playback page
 */
async function init() {
  console.log('[Playback Page] Initializing');
  await initChart();

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
  console.log('[Playback Page] Initialized');
}

// Start the app on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
