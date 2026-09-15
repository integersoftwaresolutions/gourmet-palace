/**
 * Offline Toast Sales Summary import using the same parsers as the Admin upload API.
 * Prefer Admin → Integrations → Toast historical export for day-to-day use.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { connectDB } = require('../config/db');
const Organization = require('../models/Organization');
const Location = require('../models/Location');
const { toastImport } = require('../modules/integrations/integrations.service');

const TOAST_ROOT = path.resolve(__dirname, '../../../Toast');
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

async function main() {
  await connectDB();
  const org = await Organization.findOne({ slug: process.env.SEED_ORG_SLUG || 'gourmet-palace' })
    || await Organization.findOne();
  if (!org) throw new Error('No organization found.');

  const summary = [];
  for (const source of FILES) {
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

    const result = await toastImport({
      organizationId: org._id,
      locationId: location._id,
      files,
      mapping: {},
    });
    console.log(
      `${source.locationName}: imported=${result.imported} dates=${result.dates} skippedSquare=${result.skippedSquare} from=${result.dateFrom} to=${result.dateTo}`,
    );
    summary.push({ location: source.locationName, ...result });
  }

  console.log(JSON.stringify({ organization: org.name, summary: summary.map((row) => ({
    location: row.location,
    imported: row.imported,
    dates: row.dates,
    skippedSquare: row.skippedSquare,
    dateFrom: row.dateFrom,
    dateTo: row.dateTo,
    formats: row.formats,
    warnings: row.warnings,
  })) }, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
