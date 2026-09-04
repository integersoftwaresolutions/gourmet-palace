const { Router } = require('express');
const Vendor = require('../../models/Vendor');
const PriceObservation = require('../../models/PriceObservation');
const Invoice = require('../../models/Invoice');
const Location = require('../../models/Location');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate } = require('../../middlewares/auth.middleware');
const { applyScope } = require('../../utils/scope');
const { parseRange } = require('../../utils/dateRange');

const r = Router();
r.use(authenticate);

function approvedInvoiceFilter(auth, query, extra = {}) {
  const range = parseRange(query);
  return {
    range,
    filter: applyScope(auth, {
      status: 'APPROVED',
      invoiceDate: { $gte: range.from, $lte: range.to },
      ...extra,
    }, query.locationId),
  };
}

function purchasedItems(invoices) {
  const map = new Map();
  for (const invoice of invoices) {
    for (const item of invoice.lineItems || []) {
      const description = String(item.description || 'Unknown item');
      const unit = String(item.unit || '');
      const key = `${description.toLowerCase()}|${unit.toLowerCase()}`;
      const current = map.get(key) || { description, unit, category: item.category || 'other', quantity: 0, spendMoney: 0, invoiceCount: 0 };
      current.quantity += Number(item.quantity || 0);
      current.spendMoney += Number(item.totalMoney || 0);
      current.invoiceCount += 1;
      map.set(key, current);
    }
  }
  return [...map.values()].sort((a, b) => b.spendMoney - a.spendMoney);
}

function priceChanges(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${String(row.normalizedDescription || row.description || '').toLowerCase()}|${String(row.unit || '').toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const changes = [];
  for (const history of groups.values()) {
    history.sort((a, b) => String(a.effectiveDate).localeCompare(String(b.effectiveDate)) || new Date(a.createdAt) - new Date(b.createdAt));
    for (let index = 1; index < history.length; index += 1) {
      const previous = Number(history[index - 1].unitPrice);
      const current = Number(history[index].unitPrice);
      if (!Number.isFinite(previous) || previous <= 0 || !Number.isFinite(current)) continue;
      const changePct = (current - previous) / previous;
      changes.push({
        observationId: history[index]._id,
        invoiceId: history[index].invoiceId,
        locationId: history[index].locationId,
        description: history[index].description,
        normalizedDescription: history[index].normalizedDescription,
        unit: history[index].unit,
        previousUnitPrice: previous,
        unitPrice: current,
        effectiveDate: history[index].effectiveDate,
        changePct,
        significant: Math.abs(changePct) >= 0.1,
      });
    }
  }
  return changes.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
}

r.get('/', asyncHandler(async (req, res) => {
  const allHistory = req.query.allHistory === 'true';
  const range = allHistory ? null : parseRange(req.query);
  const filter = allHistory
    ? applyScope(req.auth, { status: 'APPROVED' }, req.query.locationId)
    : applyScope(req.auth, { status: 'APPROVED', invoiceDate: { $gte: range.from, $lte: range.to } }, req.query.locationId);
  const invoices = await Invoice.find(filter).lean();
  const spend = new Map();
  for (const invoice of invoices) {
    if (!invoice.vendorId) continue;
    const key = String(invoice.vendorId);
    const current = spend.get(key) || { totalApprovedSpend: 0, invoiceCount: 0 };
    current.totalApprovedSpend += Number(invoice.totalMoney || 0);
    current.invoiceCount += 1;
    spend.set(key, current);
  }
  const ids = [...spend.keys()];
  if (!ids.length) return ApiResponse.send(res, { data: { range, vendors: [] } });
  const vendors = await Vendor.find({ organizationId: req.auth.organizationId, _id: { $in: ids } }).lean();
  return ApiResponse.send(res, {
    data: {
      range,
      vendors: vendors.map((vendor) => ({ ...vendor, ...spend.get(String(vendor._id)) })),
    },
  });
}));

r.get('/:id', asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({ _id: req.params.id, organizationId: req.auth.organizationId }).lean();
  if (!vendor) throw new ApiError(404, 'Vendor not found');

  const { range, filter } = approvedInvoiceFilter(req.auth, req.query, { vendorId: req.params.id });
  const invoices = await Invoice.find(filter).sort({ invoiceDate: -1 }).lean();
  const observationScope = applyScope(req.auth, { vendorId: req.params.id }, req.query.locationId);
  const allPrices = await PriceObservation.find(observationScope)
    .populate('locationId', 'name')
    .sort({ effectiveDate: 1, createdAt: 1 })
    .limit(1500)
    .lean();
  const prices = allPrices.filter((row) => row.effectiveDate >= range.from && row.effectiveDate <= range.to);

  if (!req.auth.allLocations && !invoices.length && !prices.length) throw new ApiError(404, 'Vendor not found');

  const items = purchasedItems(invoices);
  const changes = priceChanges(allPrices).filter((row) => row.effectiveDate >= range.from && row.effectiveDate <= range.to);

  // Compare only identical normalized item + unit pairs. Admin can compare all organization
  // locations/vendors; Managers remain constrained by applyScope to assigned locations.
  const comparableKeys = [...new Set(prices.map((row) => `${String(row.normalizedDescription || '').toLowerCase()}|${String(row.unit || '').toLowerCase()}`))].slice(0, 100);
  let comparisons = [];
  if (comparableKeys.length) {
    const descriptions = [...new Set(prices.map((row) => row.normalizedDescription).filter(Boolean))];
    const comparisonRows = await PriceObservation.find(applyScope(req.auth, {
      normalizedDescription: { $in: descriptions },
      effectiveDate: { $lte: range.to },
    }, req.query.locationId))
      .populate('vendorId', 'name')
      .populate('locationId', 'name')
      .sort({ effectiveDate: -1, createdAt: -1 })
      .limit(2000)
      .lean();
    const latest = new Map();
    for (const row of comparisonRows) {
      const key = `${String(row.normalizedDescription || '').toLowerCase()}|${String(row.unit || '').toLowerCase()}|${String(row.vendorId?._id || row.vendorId)}|${String(row.locationId?._id || row.locationId)}`;
      if (!latest.has(key) && comparableKeys.includes(`${String(row.normalizedDescription || '').toLowerCase()}|${String(row.unit || '').toLowerCase()}`)) latest.set(key, row);
    }
    comparisons = [...latest.values()];
  }

  const locationIds = [...new Set(invoices.map((row) => String(row.locationId)).concat(prices.map((row) => String(row.locationId?._id || row.locationId))))];
  const locations = await Location.find({ organizationId: req.auth.organizationId, _id: { $in: locationIds } }).select('name').lean();
  const locationNames = new Map(locations.map((row) => [String(row._id), row.name]));

  return ApiResponse.send(res, {
    data: {
      range,
      vendor,
      summary: {
        approvedSpend: invoices.reduce((sum, row) => sum + Number(row.totalMoney || 0), 0),
        invoiceCount: invoices.length,
        purchasedItemCount: items.length,
      },
      invoices,
      purchasedItems: items,
      prices,
      priceChanges: changes,
      comparisons,
      locationNames: Object.fromEntries(locationNames),
    },
  });
}));

module.exports = r;
