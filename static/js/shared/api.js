// static/js/api.js
// Centralized API calls for the NMS Platform

import { CONFIG } from './config.js';

/**
 * Generic JSON fetch utility
 * @param {string} url - URL to fetch
 * @param {AbortSignal} [signal] - Optional AbortSignal for cancellation
 * @returns {Promise<any>} Parsed JSON response
 */
export async function fetchJSON(url, signal = null) {
  const options = signal ? { signal } : {};
  const res = await fetch(url, options);
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  
  try {
    return await res.json();
  } catch (err) {
    throw new Error(`Failed to parse JSON from ${url}: ${err.message}`);
  }
}

/**
 * Fetch list of all serial numbers
 * @returns {Promise<string[]>} Array of serial numbers
 */
export async function fetchSerialsList() {
  const res = await fetch(CONFIG.API.SERIALS);
  return await res.json();
}

/**
 * Fetch list of all historic serial numbers
 * @returns {Promise<string[]>} Array of historic serial numbers
 */
export async function fetchHistoricProbesList() {
  console.log('[Playback Page] Fetching historic probes list from API:', CONFIG.API.HISTORIC_PROBES);
  const res = await fetch(CONFIG.API.PROBE_HISTORIC_SERIALS);
  console.log('[Playback Page] Received response for historic probes list:', res);
  return await res.json();
}

/**
 * Fetch list of all historic serial numbers
 * @returns {Promise<string[]>} Array of historic serial numbers
 */
export async function fetchHistoricSerialsList() {
  console.log('[Playback Page] Fetching historic serials list from API:', CONFIG.API.HISTORIC_SERIALS);
  const res = await fetch(CONFIG.API.HISTORIC_SERIALS);
  console.log('[Playback Page] Received response for historic serials list:', res);
  return await res.json();
}

/**
 * Fetch list of all historic serial numbers
 * @returns {Promise<string[]>} Array of probe serial numbers
 */
export async function fetchProbeSerialsList() {
  console.log('[Dashboard] Fetching probe serials list from API:', CONFIG.API.PROBE_SERIALS);
  const res = await fetch(CONFIG.API.PROBE_SERIALS);
  console.log('[Dashboard] Received response for probe serials list:', res);
  return await res.json();
}

/**
 * Fetch all records for a specific serial
 * @param {string} serial - Serial number to fetch
 * @param {AbortSignal} [signal] - Optional AbortSignal for cancellation
 * @returns {Promise<Object[]>} Array of record objects
 */
export async function fetchSerialData(serial, signal = null) {
  const options = signal ? { signal } : {};
  const res = await fetch(`${CONFIG.API.SYSTEMS}/${encodeURIComponent(serial)}`, options);
  return await res.json();
}

/**
 * Fetch all records for a specific serial
 * @param {string} serial - Serial number to fetch
 * @param {AbortSignal} [signal] - Optional AbortSignal for cancellation
 * @returns {Promise<Object[]>} Array of record objects
 */
export async function fetchProbeData(serial, signal = null) {
  const options = signal ? { signal } : {};
  const res = await fetch(`${CONFIG.API.PROBE_SYSTEMS}/${encodeURIComponent(serial)}`, options);
  return await res.json();
}

export async function fetchSerialDataWithLimit(serial, limit, signal = null) {
  const options = signal ? { signal } : {};
  const res = await fetch(`${CONFIG.API.SYSTEMS}/${encodeURIComponent(serial)}?limit=${encodeURIComponent(limit)}`, options);
  return await res.json();
}

export async function fetchEarliestSerialData(serial) {
  const res = await fetch(`${CONFIG.API.SYSTEMS}/${encodeURIComponent(serial)}?limit=1&order=asc`);
  const data = await res.json();
  return (data && data.length > 0) ? data[0] : null;
  
}

export async function fetchEarliestProbeData(serial) {
  const res = await fetch(`${CONFIG.API.PROBE_SYSTEMS}/${encodeURIComponent(serial)}?limit=1&order=asc`);
  const data = await res.json();
  return (data && data.length > 0) ? data[0] : null;
  
}

export async function fetchLatestSerialData(serial) {
  const res = await fetch(`${CONFIG.API.SYSTEMS}/${encodeURIComponent(serial)}?limit=1`);
  const data = await res.json();
  return (data && data.length > 0) ? data[0] : null;
}

export async function fetchLatestProbeData(serial) {
  const res = await fetch(`${CONFIG.API.PROBE_SYSTEMS}/${encodeURIComponent(serial)}?limit=1`);
  const data = await res.json();
  return (data && data.length > 0) ? data[0] : null;
}

/**
 * Fetch paginated historic records for ALL systems
 * @param {string} early - Start date (YYYY-MM-DD)
 * @param {string} latest - End date (YYYY-MM-DD)
 * @param {number} page - 1-based page number
 * @param {number} limit - Records per page
 * @param {AbortSignal} [signal] - Optional AbortSignal for cancellation
 * @returns {Promise<{data: Object[], total: number}>}
 */
export async function fetchPagedHistoricAllData(early, latest, page = 1, limit = 500, signal = null) {
  const options = signal ? { signal } : {};
  const url = `${CONFIG.API.HISTORIC_SYSTEMS}/all/${encodeURIComponent(early)}/${encodeURIComponent(latest)}?page=${page}&limit=${limit}`;
  const res = await fetch(url, options);
  return await res.json();
}

/**
 * Fetch all historic records for a specific serial
 * @param {string} serial - Serial number to fetch
 * @param {string} early - Start datetime (ISO format)
 * @param {string} latest - End datetime (ISO format)
 * @param {AbortSignal} [signal] - Optional AbortSignal for cancellation
 * @returns {Promise<Object[]>} Array of record objects
 */
/**
 * Fetch paginated historic records for a specific serial
 * @param {string} serial - Serial number to fetch
 * @param {string} early - Start datetime (ISO format)
 * @param {string} latest - End datetime (ISO format)
 * @param {number} page - 1-based page number
 * @param {number} limit - Records per page
 * @param {AbortSignal} [signal] - Optional AbortSignal for cancellation
 * @returns {Promise<{data: Object[], total: number}>}
 */
export async function fetchHistoricSerialData(serial, early, latest, page = 1, limit = 500, signal = null) {
  const options = signal ? { signal } : {};
  const url = `${CONFIG.API.HISTORIC_SYSTEMS}/${encodeURIComponent(serial)}/${encodeURIComponent(early)}/${encodeURIComponent(latest)}?page=${page}&limit=${limit}`;
  const res = await fetch(url, options);
  return await res.json();
}

/**
 * Fetch paginated historic records for a specific serial
 * @param {string} serial - Serial number to fetch
 * @param {string} early - Start datetime (ISO format)
 * @param {string} latest - End datetime (ISO format)
 * @param {number} page - 1-based page number
 * @param {number} limit - Records per page
 * @param {AbortSignal} [signal] - Optional AbortSignal for cancellation
 * @returns {Promise<{data: Object[], total: number}>}
 */
export async function fetchHistoricProbeData(serial, early, latest, page = 1, limit = 500, signal = null) {
  const options = signal ? { signal } : {};
  const url = `${CONFIG.API.PROBE_HISTORIC_SYSTEMS}/${encodeURIComponent(serial)}/${encodeURIComponent(early)}/${encodeURIComponent(latest)}?page=${page}&limit=${limit}`;
  const res = await fetch(url, options);
  return await res.json();
}

/**
 * Fetch all alarm records for a specific serial
 * @param {string} serial - Serial number to fetch
 * @param {string} early - Start datetime (ISO format)
 * @param {string} latest - End datetime (ISO format)
 * @param {Object} thresholds - Optional threshold values {rsrp, sinr, temp}
 * @param {AbortSignal} [signal] - Optional AbortSignal for cancellation
 * @returns {Promise<Object[]>} Array of record objects
 */
export async function fetchAlarmSerialData(serial, early, latest, thresholds = null, signal = null) {
  let url = `${CONFIG.API.ALARM_SYSTEMS}/${encodeURIComponent(serial)}/${encodeURIComponent(early)}/${encodeURIComponent(latest)}`;
  
  // Add threshold parameters if provided
  if (thresholds) {
    const params = new URLSearchParams();
    if (thresholds.rsrp !== undefined) params.append('rsrp_threshold', thresholds.rsrp);
    if (thresholds.sinr !== undefined) params.append('sinr_threshold', thresholds.sinr);
    if (thresholds.temp !== undefined) params.append('temp_threshold', thresholds.temp);
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }
  
  const options = signal ? { signal } : {};
  const res = await fetch(url, options);
  return await res.json();
}

/**
 * Fetch paginated alarm records for a specific serial
 * @param {string} serial - Serial number to fetch
 * @param {string} early - Start datetime (ISO format)
 * @param {string} latest - End datetime (ISO format)
 * @param {number} page - 1-based page number
 * @param {number} limit - Records per page
 * @param {Object} thresholds - Optional threshold values {rsrp, sinr, temp}
 * @param {AbortSignal} [signal] - Optional AbortSignal for cancellation
 * @returns {Promise<{data: Object[], total: number}>}
 */
export async function fetchPagedAlarmSerialData(serial, early, latest, page = 1, limit = 100000, thresholds = null, signal = null) {
  let url = `${CONFIG.API.ALARM_SYSTEMS}/${encodeURIComponent(serial)}/${encodeURIComponent(early)}/${encodeURIComponent(latest)}?page=${page}&limit=${limit}`;
  
  // Add threshold parameters if provided
  if (thresholds) {
    if (thresholds.rsrp !== undefined) url += `&rsrp_threshold=${thresholds.rsrp}`;
    if (thresholds.sinr !== undefined) url += `&sinr_threshold=${thresholds.sinr}`;
    if (thresholds.temp !== undefined) url += `&temp_threshold=${thresholds.temp}`;
  }
  
  const options = signal ? { signal } : {};
  const res = await fetch(url, options);
  return await res.json();
}

/**
 * Fetch paginated alarm records for ALL systems ordered by datetime
 * @param {string} early - Start datetime (ISO format)
 * @param {string} latest - End datetime (ISO format)
 * @param {number} page - 1-based page number
 * @param {number} limit - Records per page
 * @param {Object} thresholds - Optional threshold values {rsrp, sinr, temp}
 * @param {AbortSignal} [signal] - Optional AbortSignal for cancellation
 * @returns {Promise<{data: Object[], total: number}>}
 */
export async function fetchPagedAllAlarmData(early, latest, page = 1, limit = 100000, thresholds = null, signal = null) {
  let url = `/alarms/all/${encodeURIComponent(early)}/${encodeURIComponent(latest)}?page=${page}&limit=${limit}`;
  
  // Add threshold parameters if provided
  if (thresholds) {
    if (thresholds.rsrp !== undefined) url += `&rsrp_threshold=${thresholds.rsrp}`;
    if (thresholds.sinr !== undefined) url += `&sinr_threshold=${thresholds.sinr}`;
    if (thresholds.temp !== undefined) url += `&temp_threshold=${thresholds.temp}`;
  }
  
  const options = signal ? { signal } : {};
  const res = await fetch(url, options);
  return await res.json();
}

/**
 * Fetch LED status data (RSRP/SINR/TEMP) for a serial
 * @param {string} serial - Serial number to check
 * @returns {Promise<{rsrp: number|null, sinr: number|null, temp: number|null, lat: number|null, lon: number|null}>}
 */
export async function fetchLEDStatus(serial) {
  try {
    const res = await fetch(`${CONFIG.API.SYSTEMS}/${encodeURIComponent(serial)}`);
    const records = await res.json();
    
    if (records && records.length > 0) {
      const latest = records[0];
      let rsrp = null, sinr = null, temp = null, lat = null, lon = null, datetime = null;
      
      // Case-insensitive field matching
      for (const [key, val] of Object.entries(latest)) {
        const lower = key.toLowerCase();
        if (lower === 'rsrp') rsrp = val;
        if (lower === 'sinr') sinr = val;
        if (lower === 'temp') temp = val;
        if (lower === 'latitude' || lower === 'lat') lat = val;
        if (lower === 'longitude' || lower === 'lon') lon = val;
        if (lower === 'datetime') datetime = val;
      }
      
      return { rsrp, sinr, temp, lat, lon, datetime };
    }
  } catch (err) {
    console.warn(`Failed to fetch LED status for ${serial}:`, err);
  }

  return { rsrp: null, sinr: null, temp: null, lat: null, lon: null, datetime: null };
}
// /**
// * @returns {Promise<Object>} map like { "123": "BOAT_A", ... }
//  */
// export async function fetchProbeNameMap() {
//   const res = await fetch(CONFIG.API.PROBE_NAME_MAP);
//   const payload = await res.json();

//   // If backend already returns an object map
//   if (payload && !Array.isArray(payload) && typeof payload === 'object') {
//     return payload;
//   }

//   // If backend returns array of objects
//   const map = {};
//   (payload || []).forEach((x) => {
//     const serial = x?.SERIAL ?? x?.serial ?? x?.Serial ?? x?.id;
//     const name = x?.NAME ?? x?.name ?? x?.Name ?? x?.label;
//     if (serial) map[String(serial)] = name ?? String(serial);
//   });
//   return map;
// }

/**
* @returns {Promise<Object>} map like { "123": "BOAT_A", ... }
 */
export async function fetchSerialNameMap() {
  const res = await fetch(CONFIG.API.SERIAL_NAME_MAP);
  const payload = await res.json();

  // If backend already returns an object map
  if (payload && !Array.isArray(payload) && typeof payload === 'object') {
    return payload;
  }

  // If backend returns array of objects
  const map = {};
  (payload || []).forEach((x) => {
    const serial = x?.SERIAL ?? x?.serial ?? x?.Serial ?? x?.id;
    const name = x?.NAME ?? x?.name ?? x?.Name ?? x?.label;
    if (serial) map[String(serial)] = name ?? String(serial);
  });
  return map;
}
/**
* @returns {Promise<Object>} map like { "123": "BOAT_A", ... }
 */
export async function fetchProbeNameMap() {
  const res = await fetch(CONFIG.API.PROBE_NAME_MAP);
  const payload = await res.json();

  // If backend already returns an object map
  if (payload && !Array.isArray(payload) && typeof payload === 'object') {
    return payload;
  }

  // If backend returns array of objects
  const map = {};
  (payload || []).forEach((x) => {
    const serial = x?.SERIAL ?? x?.serial ?? x?.Serial ?? x?.id;
    const name = x?.NAME ?? x?.name ?? x?.Name ?? x?.label;
    if (serial) map[String(serial)] = name ?? String(serial);
  });
  return map;
}

/**
* @returns {Promise<Object>} map like { "123": "BOAT_A", ... }
 */
export async function fetchHistoricProbeNameMap() {
  const res = await fetch(CONFIG.API.PROBE_HISTORIC_NAME_MAP);
  const payload = await res.json();

  // If backend already returns an object map
  if (payload && !Array.isArray(payload) && typeof payload === 'object') {
    return payload;
  }

  // If backend returns array of objects
  const map = {};
  (payload || []).forEach((x) => {
    const serial = x?.SERIAL ?? x?.serial ?? x?.Serial ?? x?.id;
    const name = x?.NAME ?? x?.name ?? x?.Name ?? x?.label;
    if (serial) map[String(serial)] = name ?? String(serial);
  });
  return map;
}

/**
 * Get export URL for a serial
 * @param {string} serial - Serial number to export
 * @returns {string} Export URL
 */
export function getExportUrl(serial) {
  return `${CONFIG.API.EXPORT}/${encodeURIComponent(serial)}`;
}

/**
 * Get historic export URL for a serial
 * @param {string} serial - Serial number to export
 * @returns {string} Export URL
 */
export function getHistoricExportUrl(serial) {
  return `${CONFIG.API.HISTORIC_EXPORT}/${encodeURIComponent(serial)}`;
}