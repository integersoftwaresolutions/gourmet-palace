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
  const draft = {
    range,
    performance,
    finance,
    scorecards,
    invoices: {
      count: invoices.length,
      total: invoices.reduce((sum, row) => sum + (row.totalMoney || 0), 0),
      categorySpend,
      vendorSpend,
      vendors,
    },
    priceChanges: significantPriceChanges(prices),
    inventory: inventoryRows,
    inventorySummary: {
      count: inventoryRows.length,
      stale: inventoryRows.filter((row) => row.stale).length,
      low: inventoryRows.filter((row) => row.stockStatus === 'low' || row.stockStatus === 'critical').length,
    },
    reviewSummary,
    seoSummary,
    alertSummary,
    forecasts,
  };
  const recommendations = generateRecommendations(draft);
  const summary = executiveSummary(draft, recommendations);

  return {
    range,
    generatedAt: new Date(),
    summary,
    recommendations,
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
  if (report.summary) rows.push(['Summary', 'Executive summary', report.summary, 'Period recommendations']);
  for (const rec of report.recommendations || []) rows.push(['Recommendation', rec.title, rec.recommendation, `${rec.priority}; ${rec.area}`]);
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

function moneyLabel(cents) {
  if (cents == null || !Number.isFinite(Number(cents))) return 'unavailable';
  return `$${(Number(cents) / 100).toFixed(0)}`;
}

function pctLabel(value) {
  if (value == null || !Number.isFinite(Number(value))) return 'unavailable';
  const n = Number(value);
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function generateRecommendations(report) {
  const recs = [];
  const add = (priority, area, title, recommendation, evidence) => {
    recs.push({ priority, area, title, recommendation, evidence });
  };
  const range = report.range || {};
  const period = range.from && range.to ? `${range.from} through ${range.to}` : 'the selected period';
  const performance = report.performance || {};
  const current = performance.current || {};
  const comparison = performance.comparison || {};
  const finance = report.finance || {};
  const alerts = report.alertSummary || {};
  const inventory = report.inventorySummary || {};
  const reviews = report.reviewSummary || {};
  const seo = report.seoSummary || {};
  const scorecards = report.scorecards || [];
  const invoices = report.invoices || {};
  const priceChanges = report.priceChanges || [];
  const forecasts = report.forecasts || [];
  const net = Number(current.netMoney || 0);

  if (performance.dataStatus && performance.dataStatus !== 'COMPLETE') {
    add('high', 'data', 'Canonical coverage is incomplete', `Treat ${period} as partial. Coverage is ${performance.coverage ?? 0}%. Reconcile Square/Toast mapping and missing business dates before using this report for staffing or purchasing decisions.`, { dataStatus: performance.dataStatus, coverage: performance.coverage });
  }
  if (comparison.netSalesPct != null && comparison.netSalesPct <= -5) {
    add('high', 'sales', 'Net sales are below the comparable period', `Net sales are ${pctLabel(comparison.netSalesPct)} versus the comparable window. Open Store Performance for ${period}, isolate the weakest location and channel, and confirm the decline is not a mapping or holiday-mix issue.`, { netSalesPct: comparison.netSalesPct, netSales: current.netMoney });
  } else if (comparison.netSalesPct != null && comparison.netSalesPct >= 5) {
    add('medium', 'sales', 'Net sales are above the comparable period', `Net sales are ${pctLabel(comparison.netSalesPct)} versus the comparable window. Identify the strongest location, channel and daypart so the gain can be repeated without inflating discount or labor spend.`, { netSalesPct: comparison.netSalesPct, netSales: current.netMoney });
  }
  if (net > 0 && Number(current.refundMoney || 0) / net >= 0.03) {
    add('high', 'exceptions', 'Refunds are elevated versus sales', `Refunds are ${moneyLabel(current.refundMoney)} against ${moneyLabel(net)} net sales in ${period}. Review exception orders by location and channel before changing menu or staffing.`, { refundMoney: current.refundMoney, netMoney: net });
  }
  if (net > 0 && Number(current.voidMoney || 0) / net >= 0.02) {
    add('medium', 'exceptions', 'Voids are material versus sales', `Voids are ${moneyLabel(current.voidMoney)} in ${period}. Confirm POS training and ticket handling at the locations with the largest void clusters.`, { voidMoney: current.voidMoney });
  }
  if (net > 0 && Number(current.discountMoney || 0) / net >= 0.08) {
    add('medium', 'exceptions', 'Discounts are high versus sales', `Discounts are ${moneyLabel(current.discountMoney)} in ${period}. Check whether promotions or comping explain the mix before treating this as demand growth.`, { discountMoney: current.discountMoney });
  }
  const foodPct = finance.foodCostPercent;
  const target = finance.foodCostTarget || {};
  if (foodPct != null && target.max != null && foodPct > Number(target.max)) {
    add('high', 'finance', 'Purchase-based food cost is above target', `Food cost is ${(foodPct * 100).toFixed(1)}% versus a ${(Number(target.max) * 100).toFixed(0)}% ceiling for ${period}. This is approved-invoice spend over net sales, not COGS. Drill into the top vendors and categories in this report.`, { foodCostPercent: foodPct, targetMax: target.max, approvedFoodPurchases: finance.approvedFoodPurchases });
  }
  if ((invoices.count || 0) === 0 && net > 0) {
    add('medium', 'finance', 'No approved invoices in this period', `Sales exist for ${period} but no approved invoices were included. Food-cost % and vendor recommendations will understate spend until invoices are reviewed and approved.`, { invoiceCount: 0, netMoney: net });
  }
  const weakest = [...scorecards].filter((row) => row.score != null).sort((a, b) => Number(a.score) - Number(b.score))[0];
  const strongest = [...scorecards].filter((row) => row.score != null).sort((a, b) => Number(b.score) - Number(a.score))[0];
  if (weakest && strongest && String(weakest.locationId?._id || weakest.locationId) !== String(strongest.locationId?._id || strongest.locationId) && Number(strongest.score) - Number(weakest.score) >= 8) {
    const weakName = weakest.locationId?.name || 'Lowest-ranked store';
    add('high', 'scorecard', `${weakName} is trailing peer stores`, `${weakName} scored ${Number(weakest.score).toFixed(1)} (rank ${weakest.rank ?? '—'}) versus ${strongest.locationId?.name || 'the leader'} at ${Number(strongest.score).toFixed(1)}. Open that store scorecard and compare sales, exceptions and coverage for ${period}.`, { weakestScore: weakest.score, strongestScore: strongest.score });
  }
  if (Number(alerts.critical || 0) > 0 || Number(alerts.open || 0) >= 3) {
    add('high', 'alerts', 'Open operational alerts need action', `${alerts.open || 0} open alerts (${alerts.critical || 0} critical) fall in ${period}. Work the Alerts inbox first; do not wait for the next Morning Brief.`, { open: alerts.open, critical: alerts.critical });
  }
  if (Number(inventory.low || 0) > 0) {
    add('high', 'inventory', 'Ingredient stock is below par', `${inventory.low} items are low or critical. Count and reorder before the next service period; purchase-based food cost will not show a stockout.`, { low: inventory.low, stale: inventory.stale });
  } else if (Number(inventory.stale || 0) > 0) {
    add('medium', 'inventory', 'Ingredient counts are stale', `${inventory.stale} items have stale counts. Refresh counts (including bulk/CSV) so days-remaining and alerts stay reliable.`, { stale: inventory.stale });
  }
  const jumps = priceChanges.filter((row) => Number(row.changePct) >= 0.1).slice(0, 3);
  if (jumps.length) {
    const names = jumps.map((row) => row.description).filter(Boolean).join(', ');
    add('medium', 'vendors', 'Approved vendor prices moved 10% or more', `${jumps.length} item(s) increased at least 10% in ${period}${names ? `: ${names}` : ''}. Confirm units on the source invoice before changing vendors.`, { count: jumps.length });
  }
  if (Number(reviews.urgent || 0) > 0) {
    add('high', 'reviews', 'Urgent low-star reviews in this period', `${reviews.urgent} review(s) rated 1–2 stars appear in ${period} (avg ${reviews.averageRating == null ? 'unavailable' : Number(reviews.averageRating).toFixed(2)}). Draft and approve replies; do not post unapproved text.`, { urgent: reviews.urgent, count: reviews.count });
  }
  if (seo.ga4?.sessionsPct != null && seo.ga4.sessionsPct <= -10) {
    add('medium', 'seo', 'Website sessions declined versus the prior period', `GA4 sessions are ${pctLabel(seo.ga4.sessionsPct)} versus the prior window. Compare landing pages and paid/organic mix; this is not Square attribution.`, { sessionsPct: seo.ga4.sessionsPct, sessions: seo.ga4.sessions });
  }
  if (seo.gsc?.clicksPct != null && seo.gsc.clicksPct <= -10) {
    add('medium', 'seo', 'Search Console clicks declined', `Search clicks are ${pctLabel(seo.gsc.clicksPct)} versus the prior window. Review high-impression queries before changing the website.`, { clicksPct: seo.gsc.clicksPct, clicks: seo.gsc.clicks });
  }
  if (seo.squareDirect?.revenuePct != null && seo.squareDirect.revenuePct <= -10) {
    add('medium', 'direct', 'Direct-order revenue declined', `Mapped direct-order revenue is ${pctLabel(seo.squareDirect.revenuePct)} versus the prior window. Validate channel mapping before concluding website conversion dropped.`, { revenuePct: seo.squareDirect.revenuePct, revenue: seo.squareDirect.revenue });
  }
  if (!forecasts.length) {
    add('low', 'forecast', 'No forecast rows in this window', `There is no week forecast overlapping ${period}. Forecasts need enough comparable weekdays; this is not a sales miss by itself.`, { forecastCount: 0 });
  }

  const rank = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9));
  return recs.slice(0, 12);
}

function executiveSummary(report, recommendations) {
  const range = report.range || {};
  const period = range.from && range.to ? `${range.from} through ${range.to}` : 'the selected period';
  if (!recommendations.length) {
    return `For ${period}, canonical sales, invoices, inventory, reviews and alerts did not produce a material exception. Continue monitoring coverage and approved-invoice completeness.`;
  }
  const tops = recommendations.slice(0, 3).map((row) => row.title.replace(/\.$/, ''));
  return `Period ${period}: ${tops.join('; ')}. Recommendations below use only this report’s canonical figures and are independent of the daily Morning Brief.`;
}

module.exports = { build, csv, generateRecommendations, executiveSummary };
