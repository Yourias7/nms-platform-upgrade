// static/js/navbar.js
// Shared navbar functionality - alarm badge updates across all pages

import { fetchJSON } from './api.js';
import { CONFIG } from './config.js';

const COMMUNICATION_ALARM_THRESHOLD_HOURS = 3;

/**
 * Check if a timestamp indicates a communication alarm
 */
function isCommunicationAlarm(timestamp) {
  if (!timestamp) return true;
  
  try {
    const lastUpdate = new Date(timestamp);
    const now = new Date();
    const diffHours = (now - lastUpdate) / (1000 * 60 * 60);
    return diffHours > COMMUNICATION_ALARM_THRESHOLD_HOURS;
  } catch (e) {
    return true;
  }
}

/**
 * Count active alarms
 */
async function countAlarms() {
  try {
    const serials = await fetchJSON(CONFIG.API.SERIALS);
    let alarmCount = 0;
    
    for (const serial of serials) {
      try {
        const records = await fetchJSON(`${CONFIG.API.SYSTEMS}/${encodeURIComponent(serial)}`);
        
        if (records && records.length > 0) {
          const latest = records[0];
          let timestamp = null;
          
          for (const [key, val] of Object.entries(latest)) {
            const lower = key.toLowerCase();
            if (lower === 'datetime' || lower === 'timestamp' || lower === 'time') {
              timestamp = val;
              break;
            }
          }
          
          if (isCommunicationAlarm(timestamp)) {
            alarmCount++;
          }
        } else {
          alarmCount++;
        }
      } catch (err) {
        // Skip this serial
      }
    }
    
    return alarmCount;
  } catch (err) {
    console.error('[Navbar] Error counting alarms:', err);
    return 0;
  }
}

/**
 * Update alarm badge in navbar
 */
function updateNavbarBadge(count) {
  const alarmNav = document.getElementById('nav-alarms');
  
  if (!alarmNav) return;
  
  // Remove existing badge
  const existingBadge = alarmNav.querySelector('.alarm-badge');
  if (existingBadge) {
    existingBadge.remove();
  }
  
  // Add new badge if count > 0
  if (count > 0) {
    const badge = document.createElement('span');
    badge.className = 'alarm-badge';
    badge.innerHTML = `<span class="alarm-led"></span><span class="alarm-count">${count}</span>`;
    alarmNav.appendChild(badge);
  }
}

/**
 * Initialize navbar alarm monitoring
 */
async function initNavbar() {
  console.log('[Navbar] Initializing alarm monitoring...');
  
  // Initial check
  const count = await countAlarms();
  updateNavbarBadge(count);
  
  // Auto-refresh every 60 seconds
  setInterval(async () => {
    const count = await countAlarms();
    updateNavbarBadge(count);
  }, 60000);
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNavbar);
} else {
  initNavbar();
}
