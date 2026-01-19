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
 * Fetch all records for a specific serial
 * @param {string} serial - Serial number to fetch
 * @returns {Promise<Object[]>} Array of record objects
 */
export async function fetchSerialData(serial) {
  const res = await fetch(`${CONFIG.API.SYSTEMS}/${encodeURIComponent(serial)}`);
  return await res.json();
}

/**
 * Fetch LED status data (RSRP/SINR/TEMP) for a serial
 * @param {string} serial - Serial number to check
 * @returns {Promise<{rsrp: number|null, sinr: number|null, temp: number|null}>}
 */
export async function fetchLEDStatus(serial) {
  try {
    const res = await fetch(`${CONFIG.API.SYSTEMS}/${encodeURIComponent(serial)}`);
    const records = await res.json();
    
    if (records && records.length > 0) {
      const latest = records[0];
      let rsrp = null, sinr = null, temp = null;
      
      // Case-insensitive field matching
      for (const [key, val] of Object.entries(latest)) {
        const lower = key.toLowerCase();
        if (lower === 'rsrp') rsrp = val;
        if (lower === 'sinr') sinr = val;
        if (lower === 'temp') temp = val;
      }
      
      return { rsrp, sinr, temp };
    }
  } catch (err) {
    console.warn(`Failed to fetch LED status for ${serial}:`, err);
  }
  
  return { rsrp: null, sinr: null, temp: null };
}

/**
 * Get export URL for a serial
 * @param {string} serial - Serial number to export
 * @returns {string} Export URL
 */
export function getExportUrl(serial) {
  return `${CONFIG.API.EXPORT}/${encodeURIComponent(serial)}`;
}
