// static/js/alarms-app.js
// Entry point for the alarms page

import { refreshAlarms } from './alarms.js';

/**
 * Initialize the alarms page
 */
async function init() {
  console.log('[Alarms Page] Initializing');
  
  // Load alarms immediately
  await refreshAlarms();
  
  // Auto-refresh every 30 seconds
  setInterval(async () => {
    console.log('[Alarms Page] Auto-refreshing alarms');
    await refreshAlarms();
  }, 30000);
}

// Start the app on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
