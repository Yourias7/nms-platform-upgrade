// static/js/alarms.js
// Alarm detection and display logic

import { CONFIG } from './config.js';
import { fetchJSON } from './api.js';
import { getThresholds } from './settings.js';

const COMMUNICATION_ALARM_THRESHOLD_HOURS = 3;

// /**
//  * Check if a KPI value indicates a performance alarm (RSRP, SINR, etc.)
//  * @param {string} kpiType - Type of KPI ('rsrp', 'sinr', 'temp')
//  * @param {float} kpiValue - KPI value to check
//  * @param {string} condition - 'lt' (less than) or 'gt' (greater than)
//  * @returns {boolean} True if alarm condition
//  */
// function isPerformanceAlarm(kpiType, kpiValue, condition) {
//   if (kpiValue === undefined || kpiValue === null) return true; // No KPI = alarm
  
//   // Get thresholds from user settings
//   const thresholds = getThresholds();
//   const threshold = thresholds[kpiType];
  
//   if (threshold === undefined) {
//     console.warn('Unknown KPI type for performance alarm:', kpiType);
//     return false; // Unknown KPI type = no alarm
//   }
  
//   try {
//     if (condition === 'lt') {
//       return kpiValue < threshold;
//     } else if (condition === 'gt') {
//       return kpiValue > threshold;
//     } else {
//       console.warn('Unknown condition for performance alarm:', condition);
//       return true; // Unknown condition = alarm
//     }
//   } catch (e) {
//     console.error('Error parsing kpi value:', kpiValue, e);
//     return true; // Parse error = alarm
//   }
// }

/**
 * Check if a timestamp indicates a communication alarm
 * @param {string} timestamp - ISO timestamp string
 * @returns {boolean} True if alarm condition
 */
function isCommunicationAlarm(timestamp) {
  if (!timestamp) return true; // No timestamp = alarm
  
  try {
    const lastUpdate = new Date(timestamp);
    const now = new Date();
    const diffHours = (now - lastUpdate) / (1000 * 60 * 60);
    
    return diffHours > COMMUNICATION_ALARM_THRESHOLD_HOURS;
  } catch (e) {
    console.error('Error parsing timestamp:', timestamp, e);
    return true; // Parse error = alarm
  }
}

// /**
//  * Fetch all serials and check for performance alarms
//  * @returns {Promise<Array>} Array of alarm objects
//  */
// export async function fetchPerformanceAlarms() {
//   try {
//     const serials = await fetchJSON(CONFIG.API.SERIALS);
//     const alarms = [];
    
//     for (const serial of serials) {
//       try {
//         const records = await fetchJSON(`${CONFIG.API.SYSTEMS}/${encodeURIComponent(serial)}`);
        
//         if (records && records.length > 0) {
//           const latest = records[0];
          
//           // Find KPI fields (case-insensitive)
//           let rsrp = null;
//           let sinr = null;
//           let temp = null;
//           let site = 'N/A';
          
//           for (const [key, val] of Object.entries(latest)) {
//             const lower = key.toLowerCase();
//             if (lower === 'rsrp') rsrp = val;
//             if (lower === 'sinr') sinr = val;
//             if (lower === 'temp' || lower === 'temperature') temp = val;
//             if (lower === 'site') site = val;
//           }
          
//           // Check for any performance alarms
//           const hasRsrpAlarm = rsrp !== null && isPerformanceAlarm('rsrp', rsrp, 'lt');
//           const hasSinrAlarm = sinr !== null && isPerformanceAlarm('sinr', sinr, 'lt');
//           const hasTempAlarm = temp !== null && isPerformanceAlarm('temp', temp, 'gt');
          
//           if (hasRsrpAlarm || hasSinrAlarm || hasTempAlarm) {
//             // Determine which KPI triggered the alarm
//             let alarmType = [];
//             if (hasRsrpAlarm) alarmType.push(`RSRP: ${rsrp}`);
//             if (hasSinrAlarm) alarmType.push(`SINR: ${sinr}`);
//             if (hasTempAlarm) alarmType.push(`TEMP: ${temp}`);
            
//             alarms.push({
//               serial,
//               site,
//               kpis: { rsrp, sinr, temp },
//               status: `Performance: ${alarmType.join(', ')}`
//             });
//           }
//         } else {
//           // No records = alarm
//           alarms.push({
//             serial,
//             site: 'N/A',
//             lastUpdate: 'Never',
//             hoursAgo: 'N/A',
//             status: 'No Data'
//           });
//         }
//       } catch (err) {
//         console.warn(`Failed to check alarm for ${serial}:`, err);
//       }
//     }
    
//     return alarms;
//   } catch (err) {
//     console.error('Error fetching communication alarms:', err);
//     return [];
//   }
// }

/**
 * Fetch all serials and check for communication alarms
 * @returns {Promise<Array>} Array of alarm objects
 */
export async function fetchCommunicationAlarms() {
  try {
    const serials = await fetchJSON(CONFIG.API.SERIALS);
    const alarms = [];
    
    for (const serial of serials) {
      try {
        const records = await fetchJSON(`${CONFIG.API.SYSTEMS}/${encodeURIComponent(serial)}`);
        
        if (records && records.length > 0) {
          const latest = records[0];
          
          // Find timestamp field (case-insensitive)
          let timestamp = null;
          let site = 'N/A';
          
          for (const [key, val] of Object.entries(latest)) {
            const lower = key.toLowerCase();
            if (lower === 'datetime' || lower === 'timestamp' || lower === 'time') {
              timestamp = val;
            }
            if (lower === 'site') {
              site = val;
            }
          }
          
          if (isCommunicationAlarm(timestamp)) {
            const lastUpdate = timestamp ? new Date(timestamp) : null;
            const now = new Date();
            const hoursAgo = lastUpdate 
              ? ((now - lastUpdate) / (1000 * 60 * 60)).toFixed(1)
              : 'N/A';
            
            alarms.push({
              serial,
              site,
              lastUpdate: timestamp || 'Never',
              hoursAgo,
              status: 'Communication Lost'
            });
          }
        } else {
          // No records = alarm
          alarms.push({
            serial,
            site: 'N/A',
            lastUpdate: 'Never',
            hoursAgo: 'N/A',
            status: 'No Data'
          });
        }
      } catch (err) {
        console.warn(`Failed to check alarm for ${serial}:`, err);
      }
    }
    
    return alarms;
  } catch (err) {
    console.error('Error fetching communication alarms:', err);
    return [];
  }
}

/**
 * Render alarms table
 * @param {Array} alarms - Array of alarm objects
 */
export function renderAlarmsTable(alarms) {
  const alarmsArea = document.getElementById('alarmsArea');
  
  if (!alarmsArea) {
    console.warn('[Alarms] Alarms area element not found');
    return;
  }
  
  if (!alarms || alarms.length === 0) {
    alarmsArea.innerHTML = '<div class="text-center text-muted p-4">No active alarms</div>';
    return;
  }
  
  // Create table
  const table = document.createElement('table');
  table.className = 'table table-sm table-striped';
  
  // Create header
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Serial</th>
      <th>Site</th>
      <th>Status</th>
      <th>Last Update</th>
      <th>Hours Ago</th>
    </tr>
  `;
  table.appendChild(thead);
  
  // Create body
  const tbody = document.createElement('tbody');
  
  alarms.forEach(alarm => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${alarm.serial}</strong></td>
      <td>${alarm.site}</td>
      <td><span class="badge bg-danger">${alarm.status}</span></td>
      <td>${alarm.lastUpdate}</td>
      <td>${alarm.hoursAgo}h</td>
    `;
    tbody.appendChild(row);
  });
  
  table.appendChild(tbody);
  
  // Clear and add table
  alarmsArea.innerHTML = '';
  alarmsArea.appendChild(table);
}

/**
 * Update alarm count badge in navbar
 * @param {number} count - Number of active alarms
 */
export function updateAlarmBadge(count) {
  const alarmNav = document.getElementById('nav-alarms');
  
  // Element might not exist on some pages
  if (!alarmNav) {
    return;
  }
  
  // Remove existing badge if any
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
 * Initialize and refresh alarms
 */
export async function refreshAlarms() {
  console.log('[Alarms] Checking for communication alarms...');
  const alarms = await fetchCommunicationAlarms();
  console.log(`[Alarms] Found ${alarms.length} active alarms`);
  
  // Update badge (if it exists, for dashboard navigation)
  updateAlarmBadge(alarms.length);
  
  // Render table if alarmsArea element exists
  const alarmsArea = document.getElementById('alarmsArea');
  if (alarmsArea) {
    renderAlarmsTable(alarms);
  }
  
  return alarms;
}

// Auto-initialize if on alarms page
if (document.getElementById('alarmsArea')) {
  console.log('[Alarms] Alarms page detected, initializing...');
  
  // Initial load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => refreshAlarms());
  } else {
    refreshAlarms();
  }
  
  // Auto-refresh every 60 seconds
  setInterval(() => {
    console.log('[Alarms] Auto-refreshing alarms...');
    refreshAlarms();
  }, 60000);
}
