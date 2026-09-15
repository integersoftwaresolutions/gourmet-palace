const XLSX = require('xlsx');
const JSZip = require('jszip');
const { rowsFromCsvBuffer, detectCsvKind, detectWorkbookKind, normalizeHeaders } = require('./detect');
const { parseCsv } = require('./csv');

function sheetToRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
}

function parseSalesSummaryWorkbook(buffer, fileName = '') {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const kind = detectWorkbookKind(workbook.SheetNames, fileName);
  const tables = {};
  for (const sheetName of workbook.SheetNames) {
    const matrix = sheetToRows(workbook, sheetName);
    if (!matrix.length) continue;
    const headers = normalizeHeaders(matrix[0]);
    const detected = detectCsvKind(headers, sheetName);
    const rows = matrix.slice(1).filter((row) => (row || []).some((c) => String(c ?? '').trim() !== ''));
    const key = detected !== 'unknown' ? detected : `sheet:${sheetName}`;
    tables[key] = { sheetName, headers, rows, kind: detected };
  }
  return { kind, sheetNames: workbook.SheetNames, tables };
}

async function expandUpload({ fileName, buffer }) {
  const name = String(fileName || 'upload.bin');
  const lower = name.toLowerCase();
  const out = [];

  if (lower.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(buffer);
    const entries = Object.keys(zip.files).filter((path) => !zip.files[path].dir);
    for (const path of entries) {
      const base = path.split('/').pop() || path;
      if (base.startsWith('.')) continue;
      const child = await zip.files[path].async('nodebuffer');
      out.push(...await expandUpload({ fileName: base, buffer: child }));
    }
    return out;
  }

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const parsed = parseSalesSummaryWorkbook(buffer, name);
    out.push({
      fileName: name,
      kind: parsed.kind,
      workbook: parsed,
      buffer,
    });
    return out;
  }

  if (lower.endsWith('.csv') || lower.endsWith('.txt') || !lower.includes('.')) {
    const parsed = rowsFromCsvBuffer(buffer);
    const kind = (!parsed.headers.length && !parsed.rows.length)
      ? 'empty'
      : detectCsvKind(parsed.headers, name);
    out.push({
      fileName: name,
      kind,
      headers: parsed.headers,
      rows: parsed.rows,
      buffer,
    });
    return out;
  }

  out.push({ fileName: name, kind: 'unsupported', buffer });
  return out;
}

function collectTables(expandedFiles) {
  const tables = {
    custom_orders: [],
    order_details: [],
    item_selection: [],
    payment_details: [],
    sales_by_day: [],
    dining_options_summary: [],
    sales_category_summary: [],
    extras: [],
  };

  for (const file of expandedFiles) {
    if (file.kind === 'sales_summary_workbook' && file.workbook?.tables) {
      for (const [key, table] of Object.entries(file.workbook.tables)) {
        if (tables[table.kind]) {
          tables[table.kind].push({ fileName: file.fileName, ...table });
        } else if (table.kind === 'unknown') {
          tables.extras.push({ fileName: file.fileName, ...table });
        } else {
          tables.extras.push({ fileName: file.fileName, key, ...table });
        }
      }
      continue;
    }
    if (tables[file.kind]) {
      tables[file.kind].push({
        fileName: file.fileName,
        headers: file.headers || [],
        rows: file.rows || [],
        kind: file.kind,
      });
    } else if (file.kind && file.kind !== 'empty' && file.kind !== 'unsupported') {
      tables.extras.push(file);
    }
  }
  return tables;
}

module.exports = {
  expandUpload,
  collectTables,
  parseSalesSummaryWorkbook,
  sheetToRows,
  parseCsv,
};
