// static/js/settings-app.js
// Entry point for the settings page

import { initSettingsForm, handleSettingsSave, handleSettingsReset } from './settings.js';

/**
 * Initialize the settings page
 */
function init() {
  console.log('[Settings Page] Initializing');
  
  // Initialize the form with current values
  initSettingsForm();
  
  // Attach form handlers
  const form = document.getElementById('settings-form');
  const resetBtn = document.getElementById('reset-settings');
  
  if (form) {
    form.addEventListener('submit', handleSettingsSave);
  }
  
  if (resetBtn) {
    resetBtn.addEventListener('click', handleSettingsReset);
  }
  
  console.log('[Settings Page] Initialized');
}

// Start the app on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
