function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (c === '"' && quoted && n === '"') {
      cell += '"';
      i += 1;
    } else if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && n === '\n') i += 1;
      row.push(cell);
      cell = '';
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function headerIndex(headers, ...names) {
  const normalized = headers.map((h) => String(h || '').trim().toLowerCase());
  for (const name of names) {
    const target = String(name).trim().toLowerCase();
    const exact = normalized.findIndex((h) => h === target);
    if (exact >= 0) return exact;
  }
  for (const name of names) {
    const target = String(name).trim().toLowerCase();
    const partial = normalized.findIndex((h) => h.includes(target));
    if (partial >= 0) return partial;
  }
  return -1;
}

function dollarsToCents(value) {
  const n = Number(String(value ?? '0').replace(/[$,]/g, '').trim());
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function toNumber(value) {
  const n = Number(String(value ?? '').replace(/[$,]/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function truthy(value) {
  const text = String(value ?? '').trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'yes' || text === 'y';
}

function toBusinessDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const digits = text.replace(/\.0$/, '');
  if (/^\d{8}$/.test(digits)) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  const mdy = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (mdy) {
    const year = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3];
    return `${year.padStart(4, '0')}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  }
  return '';
}

function parseToastDateTime(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const d = new Date(text);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = text.match(
    /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i,
  );
  if (!m) return null;
  let year = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
  const month = Number(m[1]);
  const day = Number(m[2]);
  let hour = Number(m[4] || 12);
  const minute = Number(m[5] || 0);
  const second = Number(m[6] || 0);
  const ampm = (m[7] || '').toUpperCase();
  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  // Toast timestamps are restaurant-local wall clock; treat as UTC components for business-date math.
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

function businessDateFromLocalParts(date, cutoffHour = 4) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  let y = date.getUTCFullYear();
  let m = date.getUTCMonth();
  let d = date.getUTCDate();
  if (date.getUTCHours() < cutoffHour) {
    const prior = new Date(Date.UTC(y, m, d - 1));
    y = prior.getUTCFullYear();
    m = prior.getUTCMonth();
    d = prior.getUTCDate();
  }
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

module.exports = {
  parseCsv,
  headerIndex,
  dollarsToCents,
  toNumber,
  truthy,
  toBusinessDate,
  parseToastDateTime,
  businessDateFromLocalParts,
};
