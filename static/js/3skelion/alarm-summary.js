// static/js/alarm-summary.js
// Alarm summary page with statistics chart

import { CONFIG } from '../shared/config.js';
import { fetchJSON } from '../shared/api.js';
import { getThresholds } from './settings.js';

// State management
let alarmChart = null;
let currentAbortController = null; // Track ongoing requests

// Date range constants
const MAX_DAYS_BACK = 15;

/**
 * Show loading state in chart area
 */
function showChartLoading() {
  const container = document.getElementById('alarmsChartContainer');
  if (container) {
    container.innerHTML = `
      <div class="d-flex flex-column align-items-center justify-content-center h-100">
        <div class="spinner-border text-primary mb-3" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <div class="text-muted">Loading alarm statistics...</div>
      </div>
    `;
  }
}

/**
 * Show error message in chart area
 */
function showChartError(message) {
  const container = document.getElementById('alarmsChartContainer');
  if (container) {
    container.innerHTML = `
      <div class="d-flex align-items-center justify-content-center h-100">
        <div class="text-danger">${message}</div>
      </div>
    `;
  }
}

/**
 * Initialize date inputs with last day range
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
  
  // Set default range to last day (yesterday to today)
  startDateInput.value = formatDate(yesterday);
  endDateInput.value = formatDate(today);
  
  // Set min/max constraints
  startDateInput.min = formatDate(maxDaysBack);
  startDateInput.max = formatDate(today);
  endDateInput.min = formatDate(maxDaysBack);
  endDateInput.max = formatDate(today);
  
  // Validation
  startDateInput.addEventListener('change', () => {
    if (endDateInput.value < startDateInput.value) {
      endDateInput.value = startDateInput.value;
    }
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
    const endDate = new Date(endDateInput.value);
    if (endDate > today) {
      endDateInput.value = formatDate(today);
      alert('End date cannot be in the future');
    }
  });
}

/**
 * Fetch alarm statistics from API
 */
async function fetchAlarmStatistics(startDate, endDate) {
  try {
    // Cancel any ongoing request
    if (currentAbortController) {
      currentAbortController.abort();
    }
    
    // Create new AbortController for this request
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;
    
    const startDateTime = startDate ? `${startDate}T00:00:00` : '';
    const endDateTime = endDate ? `${endDate}T23:59:59` : '';
    
    // Get thresholds from settings
    const thresholds = getThresholds();
    console.log('[Alarm Summary] Using thresholds:', thresholds);
    
    const params = new URLSearchParams();
    if (startDateTime) params.append('early', startDateTime);
    if (endDateTime) params.append('latest', endDateTime);
    params.append('rsrp_threshold', thresholds.rsrp);
    params.append('sinr_threshold', thresholds.sinr);
    params.append('temp_threshold', thresholds.temp);
    
    const url = `${CONFIG.API.ALARM_STATISTICS}?${params.toString()}`;
    const statistics = await fetchJSON(url, signal);
    return statistics;
  } catch (err) {
    // Ignore abort errors (expected when cancelling)
    if (err.name === 'AbortError') {
      console.log('[Alarm Summary] Request cancelled');
      throw err;
    }
    console.error('Error fetching alarm statistics:', err);
    throw err;
  }
}

/**
 * Render bar chart with alarm statistics
 */
function renderAlarmChart(statistics) {
  const container = document.getElementById('alarmsChartContainer');
  
  if (!container) {
    console.error('Chart container not found');
    return;
  }
  
  // Ensure canvas exists - restore it if it was replaced by loading/error messages
  let canvas = document.getElementById('alarmsChart');
  if (!canvas) {
    container.innerHTML = '<canvas id="alarmsChart"></canvas>';
    canvas = document.getElementById('alarmsChart');
  }
  
  if (!canvas) {
    console.error('Failed to create chart canvas');
    return;
  }
  
  // Update message
  const alarmMessage = document.getElementById('alarmMessage');
  if (alarmMessage) {
    if (statistics.length > 0) {
      const totalAlarms = statistics.reduce((sum, stat) => sum + stat.alarm_samples, 0);
      alarmMessage.textContent = `${statistics.length} system${statistics.length !== 1 ? 's' : ''}, ${totalAlarms} total alarm${totalAlarms !== 1 ? 's' : ''}`;
    } else {
      alarmMessage.textContent = 'No data available';
    }
  }
  
  if (statistics.length === 0) {
    showChartError('No alarm statistics available for the selected period');
    return;
  }
  
  // Prepare data for chart (limit to top 20 systems)
  const topSystems = statistics.slice(0, 20);
  const labels = topSystems.map(stat => stat.name);
  const percentages = topSystems.map(stat => stat.alarm_percentage);
  
  // Destroy existing chart
  if (alarmChart) {
    alarmChart.destroy();
  }
  
  // Create new chart
  const ctx = canvas.getContext('2d');
  alarmChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Alarm Percentage (%)',
        data: percentages,
        backgroundColor: percentages.map(p => {
          if (p > 50) return 'rgba(220, 53, 69, 0.8)'; // Red for high alarm rate
          if (p > 25) return 'rgba(255, 193, 7, 0.8)'; // Yellow for medium alarm rate
          return 'rgba(40, 167, 69, 0.8)'; // Green for low alarm rate
        }),
        borderColor: percentages.map(p => {
          if (p > 50) return 'rgba(220, 53, 69, 1)';
          if (p > 25) return 'rgba(255, 193, 7, 1)';
          return 'rgba(40, 167, 69, 1)';
        }),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y', // Horizontal bar chart
      plugins: {
        title: {
          display: false
        },
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            title: (context) => {
              const index = context[0].dataIndex;
              return topSystems[index].name;
            },
            label: (context) => {
              const index = context.dataIndex;
              const stat = topSystems[index];
              return [
                `RSRP Alarms: ${stat.rsrp_alarms.toLocaleString()}`,
                `SINR Alarms: ${stat.sinr_alarms.toLocaleString()}`,
                `GPS Alarms: ${stat.gps_alarms.toLocaleString()}`,
                `TEMP Alarms: ${stat.temp_alarms.toLocaleString()}`,
                `Alarm Rate: ${stat.alarm_percentage}%`,
                `Alarm Samples: ${stat.alarm_samples.toLocaleString()}`,
                `Total Samples: ${stat.total_samples.toLocaleString()}`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          title: {
            display: true,
            text: 'Alarm Percentage (%)',
            color: '#e5e7eb'
          },
          ticks: {
            color: '#e5e7eb',
            callback: (value) => value + '%'
          },
          grid: {
            color: 'rgba(102, 126, 234, 0.1)'
          }
        },
        y: {
          ticks: {
            color: '#e5e7eb',
            font: {
              size: 10
            }
          },
          grid: {
            display: false
          }
        }
      }
    }
  });
}

/**
 * Load and display alarm statistics
 */
async function loadAlarmStatistics() {
  const startDateInput = document.getElementById('startDateInput');
  const endDateInput = document.getElementById('endDateInput');
  
  if (!startDateInput || !endDateInput) return;
  
  const startDate = startDateInput.value;
  const endDate = endDateInput.value;
  
  if (!startDate || !endDate) {
    showChartError('Please select both start and end dates');
    return;
  }
  
  showChartLoading();
  
  try {
    const statistics = await fetchAlarmStatistics(startDate, endDate);
    renderAlarmChart(statistics);
  } catch (err) {
    // Don't show error message if request was cancelled
    if (err.name === 'AbortError') {
      return;
    }
    console.error('Error loading alarm statistics:', err);
    showChartError('Error loading alarm statistics');
  }
}

/**
 * Clear filters and reset to defaults
 */
function clearFilters() {
  initializeDateInputs();
  loadAlarmStatistics();
}

/**
 * Initialize the alarm summary page
 */
async function init() {
  console.log('[Alarm Summary] Initializing page');
  
  // Initialize date inputs
  initializeDateInputs();
  
  // Setup Load button
  const loadBtn = document.getElementById('serialLoadBtn');
  if (loadBtn) {
    loadBtn.addEventListener('click', loadAlarmStatistics);
  }
  
  // Setup Clear button
  const clearBtn = document.getElementById('clearSelectedBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearFilters);
  }
  
  // Load initial data
  await loadAlarmStatistics();
}

// Start the app on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
