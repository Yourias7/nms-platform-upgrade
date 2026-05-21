const CSV_ENRICHMENT_STORAGE_KEY = 'nms_historic_csv_enrichment';

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
  const required = ['BEST_CELLID'];
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
  const extraColumns = new Set();
  const requiredCols = ['BEST_CELLID'];

  csvData.forEach(row => {
    const cellid = String(row.BEST_CELLID || '').trim();
    if (!cellid) return;

    if (index[cellid]) {
      return;
    }

    const enrichment = {};
    Object.entries(row).forEach(([colName, value]) => {
      if (!requiredCols.includes(colName)) {
        enrichment[colName] = value;
        extraColumns.add(colName);
      }
    });

    index[cellid] = enrichment;
  });

  return {
    index,
    extraColumns: Array.from(extraColumns)
  };
}

export function saveCsvEnrichmentToStorage({ fileName, rowCount, index, enrichmentColumns }) {
  const payload = {
    fileName: String(fileName || 'uploaded.csv'),
    uploadedAt: new Date().toISOString(),
    rowCount: Number(rowCount || 0),
    enrichmentColumns: Array.isArray(enrichmentColumns) ? enrichmentColumns : [],
    index: index || {}
  };

  localStorage.setItem(CSV_ENRICHMENT_STORAGE_KEY, JSON.stringify(payload));
}

export function loadCsvEnrichmentFromStorage() {
  const raw = localStorage.getItem(CSV_ENRICHMENT_STORAGE_KEY);
  if (!raw) return null;

  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return {
      fileName: data.fileName || 'uploaded.csv',
      uploadedAt: data.uploadedAt || null,
      rowCount: Number(data.rowCount || 0),
      enrichmentColumns: Array.isArray(data.enrichmentColumns) ? data.enrichmentColumns : [],
      index: data.index || {}
    };
  } catch (error) {
    console.error('[CSV Storage] Failed to parse stored CSV enrichment data', error);
    return null;
  }
}

export function clearCsvEnrichmentStorage() {
  localStorage.removeItem(CSV_ENRICHMENT_STORAGE_KEY);
}

export function getCsvEnrichmentStatus() {
  const stored = loadCsvEnrichmentFromStorage();
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
