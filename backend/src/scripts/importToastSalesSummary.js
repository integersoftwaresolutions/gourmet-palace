/**
 * Offline Toast Sales Summary import using the same toastImport() path as Admin → Integrations.
 *
 * Usage:
 *   node src/scripts/importToastSalesSummary.js gourmetpalace001@gmail.com
 *   node src/scripts/importToastSalesSummary.js gourmetpalace001@gmail.com "Simi Valley"
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const Organization = require('../models/Organization');
const Location = require('../models/Location');
const User = require('../models/User');
const { toastImport } = require('../modules/integrations/integrations.service');

const TOAST_ROOT = path.resolve(__dirname, '../../../Toast');
const EMAIL = String(process.argv[2] || process.env.TOAST_IMPORT_EMAIL || 'gourmetpalace001@gmail.com')
  .trim()
  .toLowerCase();
const ONLY_LOCATION = process.argv[3] ? String(process.argv[3]).trim() : '';

const FILES = [
  {
    locationName: 'Woodland Hills',
    paths: [
      path.join(TOAST_ROOT, 'woodland hills_SalesSummary_2025-01-01_2025-12-31', 'Sales by day.csv'),
      path.join(TOAST_ROOT, 'woodland hills_SalesSummary_2025-01-01_2025-12-31', 'Dining options summary.csv'),
      path.join(TOAST_ROOT, 'woodland hills_SalesSummary_2025-01-01_2025-12-31', 'Sales category summary.csv'),
    ],
  },
  {
    locationName: 'Sherman Oaks',
    paths: [path.join(TOAST_ROOT, 'sherman oaks_SalesSummary_2025-01-01_2025-12-31.xlsx')],
  },
  {
    locationName: 'Simi Valley',
    paths: [path.join(TOAST_ROOT, 'Simi Valley_SalesSummary_2025-01-01_2025-12-31 (1).xlsx')],
  },
];

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry(attempts = 8) {
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      // Drop any half-open pooled sockets from a prior failed attempt.
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close().catch(() => {});
      }
      const globalCache = globalThis;
      if (globalCache.__gpMongoose) {
        globalCache.__gpMongoose.conn = null;
        globalCache.__gpMongoose.promise = null;
      }
      return await connectDB();
    } catch (err) {
      lastErr = err;
      const waitMs = Math.min(30000, 1500 * 2 ** (attempt - 1));
      console.warn(`[import] Mongo connect failed (attempt ${attempt}/${attempts}): ${String(err.message || err).slice(0, 160)}; retry in ${waitMs}ms`);
      await sleep(waitMs);
    }
  }
  throw lastErr;
}

async function resolveOrganization() {
  const user = await User.findOne({ email: EMAIL }).lean();
  if (!user) throw new Error(`User not found: ${EMAIL}`);
  if (!user.organizationId) throw new Error(`User ${EMAIL} has no organizationId`);
  const org = await Organization.findById(user.organizationId);
  if (!org) throw new Error(`Organization not found for ${EMAIL}`);
  return { user, org };
}

async function importLocation(org, source) {
  const location = await Location.findOne({
    organizationId: org._id,
    name: source.locationName,
    status: 'active',
  });
  if (!location) throw new Error(`Active location not found: ${source.locationName}`);

  const files = source.paths
    .filter((p) => fs.existsSync(p))
    .map((p) => ({
      fileName: path.basename(p),
      buffer: fs.readFileSync(p),
    }));
  if (!files.length) throw new Error(`Missing Toast files for ${source.locationName}`);

  console.log(`\n→ ${source.locationName}: ${files.map((f) => f.fileName).join(', ')}`);
  const started = Date.now();
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (mongoose.connection.readyState !== 1) await connectWithRetry();
      const result = await toastImport({
        organizationId: org._id,
        locationId: location._id,
        files,
        mapping: {},
      });
      console.log(
        `${source.locationName}: imported=${result.imported} dates=${result.dates} skippedSquare=${result.skippedSquare} from=${result.dateFrom} to=${result.dateTo} (${Math.round((Date.now() - started) / 1000)}s)`,
      );
      return { location: source.locationName, ...result };
    } catch (err) {
      lastErr = err;
      console.warn(`[import] ${source.locationName} attempt ${attempt}/3 failed: ${String(err.message || err).slice(0, 200)}`);
      await connectWithRetry().catch(() => {});
      await sleep(2000 * attempt);
    }
  }
  throw lastErr;
}

async function main() {
  await connectWithRetry();
  const { user, org } = await resolveOrganization();
  console.log(`Importing Toast Sales Summary for ${user.email} / org=${org.name} (${org._id})`);

  const sources = ONLY_LOCATION
    ? FILES.filter((f) => f.locationName.toLowerCase() === ONLY_LOCATION.toLowerCase())
    : FILES;
  if (!sources.length) throw new Error(`No Toast source matched location filter: ${ONLY_LOCATION}`);

  const summary = [];
  for (const source of sources) {
    summary.push(await importLocation(org, source));
  }

  console.log(JSON.stringify({
    email: EMAIL,
    organization: org.name,
    organizationId: String(org._id),
    summary: summary.map((row) => ({
      location: row.location,
      imported: row.imported,
      dates: row.dates,
      skippedSquare: row.skippedSquare,
      dateFrom: row.dateFrom,
      dateTo: row.dateTo,
      formats: row.formats,
      warnings: row.warnings,
      stats: row.stats,
    })),
  }, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
