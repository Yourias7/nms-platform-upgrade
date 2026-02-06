// static/js/playback.js
// Playback page - RSRP time-series visualization

/**
 * Generate sample RSRP data for demonstration
 * Replace with API call to fetch actual historical data
 * @returns {Object} Chart data with labels and datasets
 */
function generateSampleData() {
  const now = new Date();
  const labels = [];
  const rsrpValues = [];
  
  // Generate 24 data points (hourly for the last 24 hours)
  for (let i = 23; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    labels.push(time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    
    // Simulate RSRP values between -140 and -80 dBm with some variation
    rsrpValues.push(Math.floor(Math.random() * 50) - 110);
  }
  
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

/**
 * Initialize the playback chart
 */
function initChart() {
  const ctx = document.getElementById('rsrpChart');
  
  if (!ctx) {
    console.warn('[Playback] Chart canvas not found');
    return;
  }
  
  const chartData = generateSampleData();
  
  const chart = new Chart(ctx, {
    type: 'line',
    data: chartData,
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
  
  console.log('[Playback] Chart initialized');
  return chart;
}

/**
 * Initialize the playback page
 */
function init() {
  console.log('[Playback Page] Initializing');
  initChart();
  console.log('[Playback Page] Initialized');
}

// Start the app on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
