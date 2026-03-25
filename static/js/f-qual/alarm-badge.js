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
    const serials = await fetchJSON(CONFIG.API.SERIALS);
    let alarmCount = 0;
    
    for (const serial of serials) {
      try {
        const records = await fetchJSON(`${CONFIG.API.SYSTEMS}/${encodeURIComponent(serial)}`);
        
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
        console.warn(`Failed to check alarm for ${serial}:`, err);
      }
    }
    
    return alarmCount;
  } catch (err) {
    console.error('Error counting alarms:', err);
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
  const count = await countCommunicationAlarms();
  updateAlarmBadge(count);
}

/**
 * Initialize alarm badge monitoring
 */
function initAlarmBadge() {
  // Initial check
  refreshAlarmBadge();
  
  // Periodic refresh
  setInterval(refreshAlarmBadge, BADGE_REFRESH_INTERVAL);
}

// Auto-start on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAlarmBadge);
} else {
  initAlarmBadge();
}
