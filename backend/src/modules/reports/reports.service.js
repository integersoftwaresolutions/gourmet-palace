const analytics = require('../analytics/analytics.service');
const Invoice = require('../../models/Invoice');
const InventoryItem = require('../../models/InventoryItem');
const Review = require('../../models/Review');
const SeoMetric = require('../../models/SeoMetric');
const Alert = require('../../models/Alert');
const LocationScore = require('../../models/LocationScore');
const Forecast = require('../../models/Forecast');
const Brief = require('../../models/Brief');
const { parseRange, addDays } = require('../../utils/dateRange');
const { applyScope } = require('../../utils/scope');
const ApiError = require('../../utils/ApiError');

async function build(auth, query) {
  if (!auth.isAdmin) throw new ApiError(403, 'Reporting Center is Owner/Admin only');
  const range = parseRange(query);
  const [performance, finance] = await Promise.all([
    analytics.performance(auth, query),
    analytics.finance(auth, query),
  ]);
  const invoiceFilter = applyScope(auth, { status: 'APPROVED', invoiceDate: { $gte: range.from, $lte: range.to } }, query.locationId);
  const [invoices, inventory, reviews, seo, alerts, scores, forecasts, briefs] = await Promise.all([
    Invoice.find(invoiceFilter).populate('vendorId', 'name').sort({ invoiceDate: -1 }).lean(),
    InventoryItem.find(applyScope(auth, { status: 'active' }, query.locationId)).populate('vendorId', 'name').lean(),
    Review.find(applyScope(auth, { reviewedAt: { $gte: new Date(`${range.from}T00:00:00Z`), $lte: new Date(`${range.to}T23:59:59Z`) } }, query.locationId)).sort({ reviewedAt: -1 }).lean(),
    SeoMetric.find(applyScope(auth, { businessDate: { $gte: range.from, $lte: range.to } }, query.locationId)).lean(),
    Alert.find(applyScope(auth, { createdAt: { $gte: new Date(`${range.from}T00:00:00Z`), $lte: new Date(`${range.to}T23:59:59Z`) } }, query.locationId)).sort({ createdAt: -1 }).lean(),
    LocationScore.find(applyScope(auth, { businessDate: { $gte: range.from, $lte: range.to } }, query.locationId)).populate('locationId', 'name').sort({ businessDate: 1, rank: 1 }).lean(),
    Forecast.find(applyScope(auth, { weekStart: { $gte: addDays(range.from, -6), $lte: range.to } }, query.locationId)).populate('locationId', 'name').sort({ weekStart: -1 }).limit(120).lean(),
    Brief.find({ organizationId: auth.organizationId, scopeKey: 'company', businessDate: { $gte: range.from, $lte: range.to }, isCurrent: true }).sort({ businessDate: -1 }).lean(),
  ]);

  const categorySpend = {};
  const vendorSpend = {};
  for (const invoice of invoices) {
    const vendor = invoice.vendorId?.name || invoice.vendorName || 'Unknown';
    vendorSpend[vendor] = (vendorSpend[vendor] || 0) + (invoice.totalMoney || 0);
    for (const item of invoice.lineItems || []) {
      const category = item.category || 'other';
      categorySpend[category] = (categorySpend[category] || 0) + (item.totalMoney || 0);
    }
  }

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

  return {
    range,
    generatedAt: new Date(),
    performance,
    finance,
    briefs,
    scorecards: scores,
    invoices: {
      count: invoices.length,
      total: invoices.reduce((sum, row) => sum + (row.totalMoney || 0), 0),
      categorySpend,
      vendorSpend,
      rows: invoices.slice(0, 250),
    },
    inventory,
    reviews,
    reviewSummary,
    seo,
    alerts,
    alertSummary,
    forecasts,
  };
}

function quote(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
function csv(report) {
  const rows = [['Section', 'Metric / record', 'Value', 'Context']];
  rows.push(['Period', 'From', report.range.from, ''], ['Period', 'To', report.range.to, '']);
  rows.push(['Performance', 'Net sales cents', report.performance.current.netMoney, report.performance.dataStatus]);
  rows.push(['Performance', 'Orders', report.performance.current.orderCount, report.performance.dataStatus]);
  rows.push(['Performance', 'Average ticket cents', report.performance.current.averageTicket, report.performance.dataStatus]);
  rows.push(['Finance', 'Approved food purchases cents', report.finance.approvedFoodPurchases, 'Estimated / purchase-based']);
  rows.push(['Finance', 'Food cost percent', report.finance.foodCostPercent ?? '', 'Estimated / purchase-based, not actual COGS']);
  rows.push(['Finance', 'Estimated profit at selected margin cents', report.finance.estimatedProfitAtSelectedMargin, `Selected margin ${report.finance.selectedMargin}`]);
  for (const [name, value] of Object.entries(report.invoices.vendorSpend)) rows.push(['Vendor spend', name, value, 'Approved invoices only']);
  for (const [name, value] of Object.entries(report.invoices.categorySpend)) rows.push(['Category spend', name, value, 'Approved invoice items only']);
  for (const score of report.scorecards) rows.push(['Store scorecard', score.locationId?.name || score.locationId, score.score ?? '', `${score.businessDate}; coverage ${score.coverage ?? ''}%`]);
  for (const item of report.inventory) rows.push(['Inventory', item.name, item.currentQuantity ?? '', `${item.unit || ''}; last count ${item.lastCountAt || 'never'}`]);
  for (const review of report.reviews) rows.push(['Review', review.providerReviewId || review._id, review.rating ?? '', `${review.reviewedAt || ''}; ${String(review.text || '').slice(0, 180)}`]);
  for (const alert of report.alerts) rows.push(['Alert', alert.type, alert.status, `${alert.severity}; ${alert.title}`]);
  for (const forecast of report.forecasts) rows.push(['Forecast', forecast.locationId?.name || forecast.locationId, forecast.expectedMoney ?? '', `${forecast.weekStart}; ${forecast.status}; coverage ${forecast.coverage ?? ''}%`]);
  for (const metric of report.seo) rows.push(['SEO / Growth', metric.source, JSON.stringify(metric.metrics || {}), `${metric.businessDate}; ${metric.status}`]);
  return rows.map((row) => row.map(quote).join(',')).join('\n');
}

module.exports = { build, csv };
