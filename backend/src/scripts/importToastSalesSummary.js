require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { connectDB } = require('../config/db');
const Organization = require('../models/Organization');
const Location = require('../models/Location');
const DailyMetric = require('../models/DailyMetric');
const Connection = require('../models/Connection');
const { rebuildDaily, rebuildBaselinesAndScore } = require('../modules/analytics/analytics.service');

const TOAST_ROOT = path.resolve(__dirname, '../../../Toast');
const FILES = [
  { locationName: 'Woodland Hills', kind: 'csv', file: path.join(TOAST_ROOT, 'woodland hills_SalesSummary_2025-01-01_2025-12-31', 'Sales by day.csv') },
  { locationName: 'Sherman Oaks', kind: 'xlsx', file: path.join(TOAST_ROOT, 'sherman oaks_SalesSummary_2025-01-01_2025-12-31.xlsx') },
  { locationName: 'Simi Valley', kind: 'xlsx', file: path.join(TOAST_ROOT, 'Simi Valley_SalesSummary_2025-01-01_2025-12-31 (1).xlsx') },
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (c === '"' && quoted && n === '"') { cell += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && n === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function readXlsxSalesByDay(file) {
  const py = [
    'import json, sys, openpyxl',
    'wb = openpyxl.load_workbook(sys.argv[1], data_only=True, read_only=True)',
    'name = next(s for s in wb.sheetnames if s.strip().lower() == "sales by day")',
    'ws = wb[name]',
    'rows = []',
    'for row in ws.iter_rows(values_only=True):',
    '    out = []',
    '    for cell in row:',
    '        if cell is None: out.append("")',
    '        elif hasattr(cell, "strftime"): out.append(cell.strftime("%Y-%m-%d"))',
    '        else: out.append(cell)',
    '    rows.append(out)',
    'print(json.dumps(rows))',
  ].join('\n');
  const result = spawnSync('python', ['-c', py, file], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`Failed to read ${file}: ${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout.split('\n').filter((line) => line.startsWith('[')).pop() || result.stdout);
}

function toBusinessDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const digits = text.replace(/\.0$/, '');
  if (/^\d{8}$/.test(digits)) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  return '';
}

function dollarsToCents(value) {
  const n = Number(String(value ?? '0').replace(/[$,]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function parseSalesByDay(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map((h) => String(h || '').trim().toLowerCase());
  const dateIdx = headers.findIndex((h) => h.includes('yyyymmdd') || h.includes('date') || h === 'day');
  const netIdx = headers.findIndex((h) => h.includes('net sales') || h === 'net sales');
  const orderIdx = headers.findIndex((h) => h.includes('total orders') || h.includes('orders'));
  const guestIdx = headers.findIndex((h) => h.includes('guest'));
  if (dateIdx < 0 || netIdx < 0) throw new Error(`Sales by day is missing date/net columns: ${headers.join(', ')}`);
  const out = [];
  for (const row of rows.slice(1)) {
    const businessDate = toBusinessDate(row[dateIdx]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) continue;
    const netMoney = dollarsToCents(row[netIdx]);
    const orderCount = Number(row[orderIdx] || 0) || 0;
    const guestCount = guestIdx >= 0 && row[guestIdx] !== '' && row[guestIdx] != null ? Number(row[guestIdx]) : null;
    out.push({
      businessDate,
      netMoney,
      grossMoney: netMoney,
      orderCount,
      guestCount: Number.isFinite(guestCount) ? guestCount : null,
      averageTicket: orderCount ? Math.round(netMoney / orderCount) : null,
    });
  }
  return out;
}

async function main() {
  await connectDB();
  const org = await Organization.findOne({ slug: process.env.SEED_ORG_SLUG || 'gourmet-palace' }) || await Organization.findOne();
  if (!org) throw new Error('No organization found. Copy local data to Atlas first.');
  const summary = [];
  for (const source of FILES) {
    if (!fs.existsSync(source.file)) throw new Error(`Missing Toast file: ${source.file}`);
    const location = await Location.findOne({ organizationId: org._id, name: source.locationName, status: 'active' });
    if (!location) throw new Error(`Active location not found: ${source.locationName}`);
    const rows = source.kind === 'csv'
      ? parseCsv(fs.readFileSync(source.file, 'utf8'))
      : readXlsxSalesByDay(source.file);
    const days = parseSalesByDay(rows);
    const squareDates = new Set((await DailyMetric.find({
      organizationId: org._id,
      locationId: location._id,
      sourceProviders: 'square',
    }).select('businessDate').lean()).map((row) => row.businessDate));
    let skippedSquare = 0;
    let upserted = 0;
    const ops = [];
    for (const day of days) {
      if (squareDates.has(day.businessDate)) {
        skippedSquare += 1;
        continue;
      }
      ops.push({
        updateOne: {
          filter: { organizationId: org._id, locationId: location._id, businessDate: day.businessDate, metricVersion: 1 },
          update: {
            $set: {
              currency: 'USD',
              grossMoney: day.grossMoney,
              netMoney: day.netMoney,
              orderCount: day.orderCount,
              guestCount: day.guestCount,
              averageTicket: day.averageTicket,
              refundMoney: 0,
              voidMoney: 0,
              discountMoney: 0,
              channels: {},
              topItems: [],
              categories: [],
              dataStatus: 'COMPLETE',
              coverage: 100,
              freshnessAt: new Date(),
              sourceProviders: ['toast'],
              itemCategoryStatus: 'UNAVAILABLE',
            },
          },
          upsert: true,
        },
      });
    }
    for (let i = 0; i < ops.length; i += 200) {
      const chunk = ops.slice(i, i + 200);
      const result = await DailyMetric.bulkWrite(chunk, { ordered: false });
      upserted += (result.upsertedCount || 0) + (result.modifiedCount || 0) + (result.matchedCount || 0);
    }
    const dates = days.map((day) => day.businessDate).sort();
    if (dates.length) {
      await rebuildDaily({ organizationId: org._id, locationId: location._id, businessDate: dates[dates.length - 1] });
      await rebuildBaselinesAndScore({ organizationId: org._id, locationId: location._id, businessDate: dates[dates.length - 1] });
    }
    console.log(`${source.locationName}: ${days.length} days, ${ops.length} written, ${skippedSquare} square days skipped`);
    summary.push({ location: source.locationName, rows: days.length, upserted, skippedSquare, from: dates[0], to: dates[dates.length - 1] });
  }
  await Connection.findOneAndUpdate(
    { organizationId: org._id, provider: 'toast' },
    {
      status: 'READY',
      capabilities: { historicalImport: true, live: false },
      metadata: { source: 'sales-summary-by-day', importedAt: new Date().toISOString(), locations: summary },
      lastSuccessAt: new Date(),
      lastError: null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  console.log(JSON.stringify({ organization: org.name, summary }, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
