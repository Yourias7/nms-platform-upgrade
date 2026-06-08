const CSV_ENRICHMENT_STORAGE_KEY = 'nms_historic_csv_enrichment';
const DB_NAME = 'nms_app_db';
const STORE_NAME = 'csv_enrichment';
const MAX_STORAGE_SIZE = 30 * 1024 * 1024; // 30MB limit

// Initialize IndexedDB
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export function detectDelimiter(line) {
  const commaCount = (line.match(/,/g) || []).length;
  const semicolonCount = (line.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

export function parseCSVLine(line, delimiter = ',') {
  const result = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

export function parseCSVContent(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have headers and at least one data row');
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCSVLine(lines[0], delimiter).map(header => header.trim());
  if (headers.length === 0) {
    throw new Error('No headers found in CSV');
  }

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    const values = parseCSVLine(lines[i], delimiter);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ? values[idx].trim() : '';
    });
    data.push(row);
  }

  return data;
}

export function validateCsvHeaders(headers) {
  const required = ['BEST_CELLID', 'ENBID']; // Added ENBID as a required column
  const headerSet = new Set(headers.map(h => String(h).trim().toUpperCase()));

  for (const col of required) {
    if (!headerSet.has(col)) {
      throw new Error(`CSV missing required column: ${col}`);
    }
  }

  return true;
}

export function buildCsvIndex(csvData) {
  const index = {};
  const indexByEnb = {}; // New O(1) lookup table for ENBID -> Array of Cells
  const extraColumns = new Set();
  const requiredCols = ['BEST_CELLID', 'ENBID'];

  csvData.forEach(row => {
    const cellid = String(row.BEST_CELLID || '').trim();
    const enbid = String(row.ENBID || '').trim();
    
    if (!cellid && !enbid) return;

    const enrichment = { BEST_CELLID: cellid, ENBID: enbid };
    
    Object.entries(row).forEach(([colName, value]) => {
      if (!requiredCols.includes(colName.toUpperCase())) {
        enrichment[colName] = value;
        extraColumns.add(colName);
      }
    });

    // 1. Map by BEST_CELLID (1-to-1)
    if (cellid && !index[cellid]) {
      index[cellid] = enrichment;
    }

    // 2. Map by ENBID (1-to-Many grouping)
    if (enbid) {
      if (!indexByEnb[enbid]) indexByEnb[enbid] = [];
      indexByEnb[enbid].push(enrichment);
    }
  });

  return {
    index,
    indexByEnb, // Export the new index
    extraColumns: Array.from(extraColumns)
  };
}

// Update the payload in saveCsvEnrichmentToStorage
export async function saveCsvEnrichmentToStorage({ fileName, rowCount, index, indexByEnb, enrichmentColumns }) {
  const payload = {
    fileName: String(fileName || 'uploaded.csv'),
    uploadedAt: new Date().toISOString(),
    rowCount: Number(rowCount || 0),
    enrichmentColumns: Array.isArray(enrichmentColumns) ? enrichmentColumns : [],
    index: index || {},
    indexByEnb: indexByEnb || {} // Save the new index
  };

  const serialized = JSON.stringify(payload);
  const sizeInMB = new Blob([serialized]).size / (1024 * 1024);

  if (new Blob([serialized]).size > MAX_STORAGE_SIZE) {
    throw new Error(
      `CSV file is too large (${sizeInMB.toFixed(2)}MB). ` +
      `Maximum allowed size is ${(MAX_STORAGE_SIZE / (1024 * 1024)).toFixed(1)}MB. ` +
      `Please upload a smaller CSV file or remove some columns.`
    );
  }

  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(payload, CSV_ENRICHMENT_STORAGE_KEY);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('[CSV Storage] Failed to save to IndexedDB, falling back to localStorage', error);
    try {
      localStorage.setItem(CSV_ENRICHMENT_STORAGE_KEY, serialized);
    } catch (localStorageError) {
      if (localStorageError.name === 'QuotaExceededError') {
        throw new Error(
          `Storage quota exceeded. Clear existing CSV uploads or data to free up space. ` +
          `File size: ${sizeInMB.toFixed(2)}MB`
        );
      }
      throw localStorageError;
    }
  }
}

export async function loadCsvEnrichmentFromStorage() {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(CSV_ENRICHMENT_STORAGE_KEY);
      
      request.onerror = () => {
        const raw = localStorage.getItem(CSV_ENRICHMENT_STORAGE_KEY);
        if (!raw) { resolve(null); return; }
        const data = JSON.parse(raw);
        resolve({
          fileName: data.fileName || 'uploaded.csv',
          rowCount: Number(data.rowCount || 0),
          enrichmentColumns: data.enrichmentColumns || [],
          index: data.index || {},
          indexByEnb: data.indexByEnb || {} // <-- Added
        });
      };
      
      request.onsuccess = () => {
        const data = request.result;
        if (!data) { resolve(null); return; }
        resolve({
          fileName: data.fileName || 'uploaded.csv',
          rowCount: Number(data.rowCount || 0),
          enrichmentColumns: data.enrichmentColumns || [],
          index: data.index || {},
          indexByEnb: data.indexByEnb || {} // <-- Added
        });
      };
    });
  } catch (error) {
    const raw = localStorage.getItem(CSV_ENRICHMENT_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      fileName: data.fileName || 'uploaded.csv',
      rowCount: Number(data.rowCount || 0),
      enrichmentColumns: data.enrichmentColumns || [],
      index: data.index || {},
      indexByEnb: data.indexByEnb || {} // <-- Added
    };
  }
}

export async function clearCsvEnrichmentStorage() {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(CSV_ENRICHMENT_STORAGE_KEY);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        // Also clear localStorage as fallback
        localStorage.removeItem(CSV_ENRICHMENT_STORAGE_KEY);
        resolve();
      };
    });
  } catch (error) {
    console.warn('[CSV Storage] Failed to clear from IndexedDB, clearing localStorage fallback', error);
    localStorage.removeItem(CSV_ENRICHMENT_STORAGE_KEY);
  }
}

export async function getCsvEnrichmentStatus() {
  const stored = await loadCsvEnrichmentFromStorage();
  if (!stored) {
    return { hasStoredCsv: false };
  }
  return {
    hasStoredCsv: true,
    fileName: stored.fileName,
    rowCount: stored.rowCount,
    enrichmentColumns: stored.enrichmentColumns,
    uploadedAt: stored.uploadedAt
  };
}
