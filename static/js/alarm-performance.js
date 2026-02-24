// static/js/alarm-performance.js
// Performance alarm detection and display logic

import { CONFIG } from './config.js';
import { fetchJSON } from './api.js';
import { isInAlarm } from './settings.js';

// --- helpers ---
function getFieldCI(obj, candidates = []) {
  if (!obj) return null;
  const want = new Set(candidates.map(c => String(c).toLowerCase()));
  for (const [k, v] of Object.entries(obj)) {
    if (want.has(String(k).toLowerCase())) return v;
  }
  return null;
}

function toNumberOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string') v = v.replace(',', '.'); // "12,3" -> "12.3"
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatLastUpdate(ts) {
  if (!ts) return 'Never';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

// --- core ---
export async function fetchPerformanceAlarms() {
  try {
    const serials = await fetchJSON(CONFIG.API.SERIALS);
    const per_alarms = [];

    for (const serial of serials) {
      try {
        const records = await fetchJSON(`${CONFIG.API.SYSTEMS}/${encodeURIComponent(serial)}`);

        if (!records || records.length === 0) {
          // Αν ΔΕΝ θες "No Data" σαν performance alarm, σβήσε αυτό το push.
          per_alarms.push({
            site: String(serial),
            serial: String(serial),
            lastUpdate: null,
            status: 'No Data',
          });
          continue;
        }

        const latest = records[0];

        const site = getFieldCI(latest, ['site', 'name']) ?? String(serial);
        const timestamp = getFieldCI(latest, ['datetime', 'timestamp', 'time']);

        const rsrp = toNumberOrNull(getFieldCI(latest, ['rsrp']));
        const sinr = toNumberOrNull(getFieldCI(latest, ['sinr']));
        const temp = toNumberOrNull(getFieldCI(latest, ['temp', 'temperature']));
        const lat  = toNumberOrNull(getFieldCI(latest, ['lat', 'latitude']));
        const lon  = toNumberOrNull(getFieldCI(latest, ['lon', 'lng', 'longitude']));

        const inPerfAlarm =
          isInAlarm('rsrp', rsrp) ||
          isInAlarm('sinr', sinr) ||
          isInAlarm('temp', temp) ||
          isInAlarm('lat', lat) ||
          isInAlarm('lon', lon);

        if (inPerfAlarm) {
          per_alarms.push({
            site,
            serial: String(serial),
            lastUpdate: timestamp || null,
            status: 'Performance Alarm',
          });
        }
      } catch (err) {
        console.warn(`[Performance Alarms] Failed for ${serial}:`, err);
      }
    }

    return per_alarms;
  } catch (err) {
    console.error('[Performance Alarms] Error fetching alarms:', err);
    return [];
  }
}

export function renderPerformanceAlarmsTable(per_alarms) {
  const alarmsArea = document.getElementById('alarmsArea_performance');

  if (!alarmsArea) {
    console.warn('[Performance Alarms] #alarmsArea_performance not found');
    return;
  }

  if (!per_alarms || per_alarms.length === 0) {
    alarmsArea.innerHTML = '<div class="text-center text-muted p-4">No active alarms</div>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'table table-sm table-striped';

  table.innerHTML = `
    <thead>
      <tr>
        <th>Site</th>
        <th>Status</th>
        <th>Last Update</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');

  per_alarms.forEach(alarm => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${alarm.site ?? 'N/A'}</td>
      <td><span class="badge bg-danger">${alarm.status ?? 'Alarm'}</span></td>
      <td>${formatLastUpdate(alarm.lastUpdate)}</td>
    `;
    tbody.appendChild(tr);
  });

  alarmsArea.innerHTML = '';
  alarmsArea.appendChild(table);
}

export async function refreshPerformanceAlarms() {
  const per_alarms = await fetchPerformanceAlarms();

  // render μόνο αν υπάρχει area στη σελίδα
  const area = document.getElementById('alarmsArea_performance');
  if (area) renderPerformanceAlarmsTable(per_alarms);

  return per_alarms;
}

// --- init guarded & single-run ---
function shouldInit() {
  // τρέξε μόνο αν είμαστε στη σελίδα performance alarms
  return !!document.getElementById('alarmsArea_performance');
}

async function init() {
  if (!shouldInit()) return;

  // μην κάνεις init 2 φορές (σε SPA/tab switches / pageshow)
  if (window.__perfAlarmsInitialized) return;
  window.__perfAlarmsInitialized = true;

  await refreshPerformanceAlarms();

  // καθάρισε τυχόν παλιό interval
  if (window.__perfAlarmsIntervalId) {
    clearInterval(window.__perfAlarmsIntervalId);
  }

  window.__perfAlarmsIntervalId = setInterval(() => {
    refreshPerformanceAlarms();
  }, 30000);

  // refresh όταν αλλάζουν thresholds
  if (!window.__perfAlarmsThresholdListenerAdded) {
    window.addEventListener('thresholds-updated', () => refreshPerformanceAlarms());
    window.__perfAlarmsThresholdListenerAdded = true;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Αν έχεις pageshow, προσοχή να μην ξανατρέχει init (το guard το πιάνει)
window.addEventListener('pageshow', init);