const analytics = require('../analytics/analytics.service');
const Invoice = require('../../models/Invoice');
const InventoryItem = require('../../models/InventoryItem');
const Review = require('../../models/Review');
const SeoMetric = require('../../models/SeoMetric');
const Alert = require('../../models/Alert');
const LocationScore = require('../../models/LocationScore');
const Forecast = require('../../models/Forecast');
const Brief = require('../../models/Brief');
const PriceObservation = require('../../models/PriceObservation');
const { parseRange, addDays, previousRange } = require('../../utils/dateRange');
const { applyScope } = require('../../utils/scope');
const ApiError = require('../../utils/ApiError');
const { summarizeSeoMetrics } = require('../analytics/math');

function latestScorecards(scores) {
  const byLoc = new Map();
  for (const row of scores || []) {
    const id = String(row.locationId?._id || row.locationId);
    const prev = byLoc.get(id);
    if (!prev || String(row.businessDate) > String(prev.businessDate)) byLoc.set(id, row);
  }
  return [...byLoc.values()].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
}

function inventoryView(items) {
  return (items || []).map((item) => {
    const stale = !item.lastCountAt || Date.now() - new Date(item.lastCountAt).getTime() > 24 * 3600000;
    const stockStatus = item.currentQuantity <= 0 ? 'critical' : (item.parLevel > 0 && item.currentQuantity < item.parLevel ? 'low' : 'ok');
    return { ...item, stale, stockStatus };
  });
}

function significantPriceChanges(rows) {
  const groups = new Map();
  for (const row of rows || []) {
    const key = `${String(row.vendorId)}|${String(row.normalizedDescription || row.description || '').toLowerCase()}|${String(row.unit || '').toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const changes = [];
  for (const history of groups.values()) {
    history.sort((a, b) => String(a.effectiveDate).localeCompare(String(b.effectiveDate)));
    for (let i = 1; i < history.length; i += 1) {
      const previous = Number(history[i - 1].unitPrice);
      const current = Number(history[i].unitPrice);
      if (!(previous > 0) || !Number.isFinite(current)) continue;
      const changePct = (current - previous) / previous;
      if (Math.abs(changePct) < 0.1) continue;
      changes.push({
        description: history[i].description,
        vendorId: history[i].vendorId,
        unit: history[i].unit,
        previousUnitPrice: previous,
        unitPrice: current,
        changePct,
        effectiveDate: history[i].effectiveDate,
      });
    }
  }
  return changes.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 25);
}

async function build(auth, query) {
  if (!auth.isAdmin) throw new ApiError(403, 'Reporting Center is Owner/Admin only');
  const range = parseRange(query);
  const [performance, finance] = await Promise.all([
    analytics.performance(auth, query),
    analytics.finance(auth, query),
  ]);
  const invoiceFilter = applyScope(auth, { status: 'APPROVED', invoiceDate: { $gte: range.from, $lte: range.to } }, query.locationId);
  const [invoices, inventory, reviews, seo, alerts, scores, forecasts, briefs, prices, priorSeo] = await Promise.all([
    Invoice.find(invoiceFilter).populate('vendorId', 'name').sort({ invoiceDate: -1 }).lean(),
    InventoryItem.find(applyScope(auth, { status: 'active' }, query.locationId)).populate('vendorId', 'name').lean(),
    Review.find(applyScope(auth, { reviewedAt: { $gte: new Date(`${range.from}T00:00:00Z`), $lte: new Date(`${range.to}T23:59:59Z`) } }, query.locationId)).sort({ reviewedAt: -1 }).lean(),
    SeoMetric.find(applyScope(auth, { businessDate: { $gte: range.from, $lte: range.to } }, query.locationId)).lean(),
    Alert.find(applyScope(auth, { createdAt: { $gte: new Date(`${range.from}T00:00:00Z`), $lte: new Date(`${range.to}T23:59:59Z`) } }, query.locationId)).sort({ createdAt: -1 }).lean(),
    LocationScore.find(applyScope(auth, { businessDate: { $gte: range.from, $lte: range.to } }, query.locationId)).populate('locationId', 'name').sort({ businessDate: 1, rank: 1 }).lean(),
    Forecast.find(applyScope(auth, { weekStart: { $gte: addDays(range.from, -6), $lte: range.to } }, query.locationId)).populate('locationId', 'name').sort({ weekStart: -1 }).limit(120).lean(),
    Brief.find({ organizationId: auth.organizationId, scopeKey: 'company', businessDate: { $gte: range.from, $lte: range.to }, isCurrent: true }).sort({ businessDate: -1 }).lean(),
    PriceObservation.find(applyScope(auth, { effectiveDate: { $gte: range.from, $lte: range.to } }, query.locationId)).sort({ effectiveDate: 1 }).limit(2000).lean(),
    SeoMetric.find(applyScope(auth, { businessDate: { $gte: previousRange(range).from, $lte: previousRange(range).to } }, query.locationId)).lean(),
  ]);

  const vendorMap = new Map();
  const categorySpend = {};
  for (const invoice of invoices) {
    const vendorId = invoice.vendorId?._id ? String(invoice.vendorId._id) : String(invoice.vendorId || '');
    const vendorName = invoice.vendorId?.name || invoice.vendorName || 'Unknown';
    const cur = vendorMap.get(vendorId || vendorName) || { vendorId: vendorId || null, vendorName, totalMoney: 0, invoiceCount: 0 };
    cur.totalMoney += Number(invoice.totalMoney || 0);
    cur.invoiceCount += 1;
    vendorMap.set(vendorId || vendorName, cur);
    for (const item of invoice.lineItems || []) {
      const category = item.category || 'other';
      categorySpend[category] = (categorySpend[category] || 0) + (item.totalMoney || 0);
    }
  }
  const vendors = [...vendorMap.values()].sort((a, b) => b.totalMoney - a.totalMoney);
  const vendorSpend = Object.fromEntries(vendors.map((row) => [row.vendorName, row.totalMoney]));

  const reviewSummary = {
    count: reviews.length,
    averageRating: reviews.length ? reviews.reduce((sum, row) => sum + Number(row.rating || 0), 0) / reviews.length : null,
    urgent: reviews.filter((row) => Number(row.rating) <= 2).length,
  };
  const alertSummary = {
    total: alerts.length,
    open: alerts.filter((row) => row.status === 'OPEN').length,
    acknowledged: alerts.filter((row) => row.status === 'ACKNOWLEDGED').length,
    critical: alerts.filter((row) => row.severity === 'critical').length,
  };
  const inventoryRows = inventoryView(inventory);
  const scorecards = latestScorecards(scores);
  const seoSummary = summarizeSeoMetrics(seo, priorSeo);

  return {
    range,
    generatedAt: new Date(),
    brief: briefs[0] || null,
    briefs,
    performance,
    finance,
    scorecards,
    invoices: {
      count: invoices.length,
      total: invoices.reduce((sum, row) => sum + (row.totalMoney || 0), 0),
      categorySpend,
      vendorSpend,
      vendors,
      rows: invoices.slice(0, 250),
    },
    priceChanges: significantPriceChanges(prices),
    inventory: inventoryRows,
    inventorySummary: {
      count: inventoryRows.length,
      stale: inventoryRows.filter((row) => row.stale).length,
      low: inventoryRows.filter((row) => row.stockStatus === 'low' || row.stockStatus === 'critical').length,
    },
    reviews,
    reviewSummary,
    seo,
    seoSummary,
    alerts,
    alertSummary,
    forecasts,
  };
}

function quote(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
function csv(report) {
  const rows = [['Section', 'Metric / record', 'Value', 'Context']];
  rows.push(['Period', 'From', report.range.from, ''], ['Period', 'To', report.range.to, '']);
  if (report.brief) rows.push(['Brief', report.brief.content?.headline || report.brief.businessDate, report.brief.status, `revision ${report.brief.revision}`]);
  rows.push(['Performance', 'Net sales cents', report.performance.current.netMoney, report.performance.dataStatus]);
  rows.push(['Performance', 'Orders', report.performance.current.orderCount, report.performance.dataStatus]);
  rows.push(['Performance', 'Refunds cents', report.performance.current.refundMoney, report.performance.dataStatus]);
  rows.push(['Performance', 'Voids cents', report.performance.current.voidMoney, report.performance.dataStatus]);
  rows.push(['Performance', 'Discounts cents', report.performance.current.discountMoney, report.performance.dataStatus]);
  rows.push(['Finance', 'Approved food purchases cents', report.finance.approvedFoodPurchases, 'Estimated / purchase-based']);
  rows.push(['Finance', 'Food cost percent', report.finance.foodCostPercent ?? '', 'Estimated / purchase-based, not actual COGS']);
  rows.push(['Finance', 'Estimated profit at selected margin cents', report.finance.estimatedProfitAtSelectedMargin, `Selected margin ${report.finance.selectedMargin}`]);
  for (const vendor of report.invoices.vendors || []) rows.push(['Vendor spend', vendor.vendorName, vendor.totalMoney, `${vendor.invoiceCount} approved invoices`]);
  for (const [name, value] of Object.entries(report.invoices.categorySpend || {})) rows.push(['Category spend', name, value, 'Approved invoice items only']);
  for (const change of report.priceChanges || []) rows.push(['Price change', change.description, Math.round(change.changePct * 10000) / 100, change.effectiveDate]);
  for (const score of report.scorecards) rows.push(['Store scorecard', score.locationId?.name || score.locationId, score.score ?? '', `${score.businessDate}; rank ${score.rank ?? ''}; coverage ${score.coverage ?? ''}%`]);
  for (const item of report.inventory) rows.push(['Inventory', item.name, item.currentQuantity ?? '', `${item.unit || ''}; ${item.stockStatus}; last count ${item.lastCountAt || 'never'}`]);
  for (const review of report.reviews) rows.push(['Review', review.providerReviewId || review._id, review.rating ?? '', `${review.reviewedAt || ''}; ${String(review.text || '').slice(0, 180)}`]);
  for (const alert of report.alerts) rows.push(['Alert', alert.type, alert.status, `${alert.severity}; ${alert.title}`]);
  for (const forecast of report.forecasts) rows.push(['Forecast', forecast.locationId?.name || forecast.locationId, forecast.expectedMoney ?? '', `${forecast.weekStart}; ${forecast.status}; coverage ${forecast.coverage ?? ''}%`]);
  rows.push(['SEO', 'GA4 sessions', report.seoSummary?.ga4?.sessions ?? '', report.seoSummary?.ga4?.status || '']);
  rows.push(['SEO', 'GSC clicks', report.seoSummary?.gsc?.clicks ?? '', report.seoSummary?.gsc?.status || '']);
  rows.push(['SEO', 'Direct-order revenue cents', report.seoSummary?.squareDirect?.revenue ?? '', report.seoSummary?.squareDirect?.status || '']);
  return rows.map((row) => row.map(quote).join(',')).join('\n');
}

module.exports = { build, csv };
