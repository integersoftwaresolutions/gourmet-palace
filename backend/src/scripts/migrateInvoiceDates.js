const mongoose = require('mongoose');
// Load backend/.env before connectDB reads MONGODB_URI.
require('../config/env');
const { connectDB } = require('../config/db');
const Invoice = require('../models/Invoice');

function normalize(value) {
  const raw = String(value || '').trim();
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
  if (!match) {
    const slash = /^(\d{1,2})[\\/]([0-9]{1,2})[\\/](\d{4})$/.exec(raw);
    if (slash) match = [raw, slash[3], slash[1], slash[2]];
  }
  if (!match) return null;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function main() {
  await connectDB();
  const rows = await Invoice.find({ invoiceDate: { $type: 'string', $ne: '' } }).select('_id invoiceDate').lean();
  let updated = 0; let invalid = 0;
  for (const row of rows) {
    const normalized = normalize(row.invoiceDate);
    if (!normalized) { invalid += 1; console.warn(`[invoice-date-migration] invalid ${row._id}: ${row.invoiceDate}`); continue; }
    if (normalized !== row.invoiceDate) { await Invoice.updateOne({ _id: row._id }, { $set: { invoiceDate: normalized } }); updated += 1; }
  }
  console.log(JSON.stringify({ scanned: rows.length, updated, invalid }));
  await mongoose.disconnect();
}

main().catch(async (error) => { console.error(error); await mongoose.disconnect().catch(() => {}); process.exitCode = 1; });
