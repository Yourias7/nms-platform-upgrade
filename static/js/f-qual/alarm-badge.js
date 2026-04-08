// static/js/alarm-badge.js
// Global alarm badge updater that runs on all pages

import { CONFIG } from '../shared/config.js';
import { fetchJSON } from '../shared/api.js';

const COMMUNICATION_ALARM_THRESHOLD_HOURS = 3;
const BADGE_REFRESH_INTERVAL = 60000; // 60 seconds

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
 * Count communication alarms across all serials
 */
async function countCommunicationAlarms() {
  try {
    let serials;
    try {
      serials = await fetchJSON(CONFIG.API.PROBE_SERIALS);
    } catch (err) {
      console.warn('[Alarm Badge] Failed to fetch probes list - backend may be unavailable:', err.message);
      return 0;
    }

    if (!Array.isArray(serials) || serials.length === 0) {
      console.debug('[Alarm Badge] No probes found');
      return 0;
    }

    let alarmCount = 0;
    
    for (const serial of serials) {
      try {
        const records = await fetchJSON(`${CONFIG.API.PROBES}/${encodeURIComponent(serial)}`);
        
        if (!records || records.length === 0) {
          alarmCount++;
          continue;
        }
        
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
      } catch (err) {
        // Skip this serial on error
        console.debug(`[Alarm Badge] Failed to check alarm for ${serial}:`, err.message);
      }
    }
    
    return alarmCount;
  } catch (err) {
    console.warn('[Alarm Badge] Error counting alarms:', err.message);
    return 0;
  }
}

/**
 * Update the alarm badge in the navbar
 */
function updateAlarmBadge(count) {
  const alarmTab = document.getElementById('tab-alarms');
  
  if (!alarmTab) {
    return;
  }
  
  // Remove existing badge
  const existingBadge = alarmTab.querySelector('.alarm-badge');
  if (existingBadge) {
    existingBadge.remove();
  }
  
  // Add new badge if count > 0
  if (count > 0) {
    const badge = document.createElement('span');
    badge.className = 'alarm-badge';
    badge.innerHTML = `<span class="alarm-led"></span><span class="alarm-count">${count}</span>`;
    alarmTab.appendChild(badge);
  }
}

/**
 * Check and update alarm badge
 */
async function refreshAlarmBadge() {
  try {
    const count = await countCommunicationAlarms();
    updateAlarmBadge(count);
    console.debug('[Alarm Badge] Badge updated with count:', count);
  } catch (err) {
    console.warn('[Alarm Badge] Failed to refresh badge:', err.message);
    // Silently fail - don't show errors for non-critical feature
  }
}

/**
 * Initialize alarm badge monitoring
 */
function initAlarmBadge() {
  try {
    console.debug('[Alarm Badge] Initializing alarm badge monitoring');
    // Initial check
    refreshAlarmBadge();
    
    // Periodic refresh (don't await, let it run in background)
    setInterval(() => {
      refreshAlarmBadge().catch(err => {
        console.debug('[Alarm Badge] Periodic refresh error (ignored):', err.message);
      });
    }, BADGE_REFRESH_INTERVAL);
    
    console.debug('[Alarm Badge] Monitoring initialized with interval:', BADGE_REFRESH_INTERVAL, 'ms');
  } catch (err) {
    console.warn('[Alarm Badge] Failed to initialize alarm badge:', err.message);
  }
}

// Auto-start on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAlarmBadge);
} else {
  initAlarmBadge();
}
