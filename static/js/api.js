// static/js/api.js
// Centralized API calls for the NMS Platform

import { CONFIG } from './config.js';

/**
 * Generic JSON fetch utility
 * @param {string} url - URL to fetch
 * @returns {Promise<any>} Parsed JSON response
 */
export async function fetchJSON(url) {
  const res = await fetch(url);
  return await res.json();
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
export async function fetchHistoricSerialsList() {
  console.log('[Playback Page] Fetching historic serials list from API:', CONFIG.API.HISTORIC_SERIALS);
  const res = await fetch(CONFIG.API.HISTORIC_SERIALS);
  console.log('[Playback Page] Received response for historic serials list:', res);
  return await res.json();
}

/**
 * Fetch all records for a specific serial
 * @param {string} serial - Serial number to fetch
 * @returns {Promise<Object[]>} Array of record objects
 */
export async function fetchSerialData(serial) {
  const res = await fetch(`${CONFIG.API.SYSTEMS}/${encodeURIComponent(serial)}`);
  return await res.json();
}

export async function fetchSerialDataWithLimit(serial, limit) {
  const res = await fetch(`${CONFIG.API.SYSTEMS}/${encodeURIComponent(serial)}?limit=${encodeURIComponent(limit)}`);
  return await res.json();
}

export async function fetchEarliestSerialData(serial) {
  const res = await fetch(`${CONFIG.API.SYSTEMS}/${encodeURIComponent(serial)}?limit=1&order=asc`);
  const data = await res.json();
  return (data && data.length > 0) ? data[0] : null;
  
}

export async function fetchLatestSerialData(serial) {
  const res = await fetch(`${CONFIG.API.SYSTEMS}/${encodeURIComponent(serial)}?limit=1`);
  const data = await res.json();
  return (data && data.length > 0) ? data[0] : null;
}

/**
 * Fetch all historic records for a specific serial
 * @param {string} serial - Serial number to fetch
 * @param {string} early - Start datetime (ISO format)
 * @param {string} latest - End datetime (ISO format)
 * @returns {Promise<Object[]>} Array of record objects
 */
export async function fetchHistoricSerialData(serial,early,latest) {
  const res = await fetch(`${CONFIG.API.HISTORIC_SYSTEMS}/${encodeURIComponent(serial)}/${encodeURIComponent(early)}/${encodeURIComponent(latest)}`);
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