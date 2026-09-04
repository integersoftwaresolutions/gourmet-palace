const Order = require('../../models/Order');
const DailyMetric = require('../../models/DailyMetric');
const Location = require('../../models/Location');
const LocationScore = require('../../models/LocationScore');
const Baseline = require('../../models/Baseline');
const settings = require('../settings/settings.service');
const { applyScope, authorizedLocationFilter } = require('../../utils/scope');
const { parseRange, previousRange, priorYearRange, addDays } = require('../../utils/dateRange');
const ApiError = require('../../utils/ApiError');
const env = require('../../config/env');
const { boundedTrendExpectation, salesWeightedHealth } = require('./math');

const pct = (v, b) => (b ? ((v - b) / Math.abs(b)) * 100 : null);

async function rebuildDaily({ organizationId, locationId, businessDate }) {
  const orders = await Order.find({ organizationId, locationId, businessDate }).select('+rawRef').lean();
  if (!orders.length) {
    await DailyMetric.findOneAndUpdate(
      { organizationId, locationId, businessDate, metricVersion: 1 },
      {
        $set: { dataStatus: 'UNAVAILABLE', coverage: 0, freshnessAt: new Date(), sourceProviders: [], itemCategoryStatus: 'UNAVAILABLE' },
        $unset: { grossMoney: 1, netMoney: 1, orderCount: 1, guestCount: 1, averageTicket: 1, refundMoney: 1, voidMoney: 1, discountMoney: 1, channels: 1, topItems: 1, categories: 1, reconciliation: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return null;
  }
  // Square is authoritative on overlap. When a Square day has been reprocessed, use only
  // the most recent raw acquisition reference so orders that disappeared from the provider
  // are not silently retained in a published aggregate. Toast remains preserved for history.
  const square = orders.filter((o) => o.provider === 'square');
  let facts;
  if (square.length) {
    const latest = [...square].sort((a, b) => new Date(b.ingestTimestamp || 0) - new Date(a.ingestTimestamp || 0))[0];
    facts = latest?.rawRef ? square.filter((o) => o.rawRef === latest.rawRef) : square;
  } else facts = orders;
  const completed = facts.filter((o) => (o.orderState || 'COMPLETED') === 'COMPLETED');
  let gross = 0, net = 0, refund = 0, voids = 0, discount = 0, guests = 0, guestKnown = 0;
  const channels = { dine_in: 0, takeout: 0, delivery: 0, third_party: 0, direct_online: 0, unknown: 0 };
  const itemMap = new Map();
  const catMap = new Map();
  for (const o of facts) {
    refund += o.refundMoney || 0;
    voids += o.voidMoney || 0;
    if ((o.orderState || 'COMPLETED') !== 'COMPLETED') continue;
    gross += o.grossMoney || 0;
    net += o.netMoney || 0;
    discount += o.discountMoney || 0;
    if (o.guestCount != null) { guests += o.guestCount; guestKnown++; }
    channels[o.channel || 'unknown'] = (channels[o.channel || 'unknown'] || 0) + (o.netMoney || 0);
    for (const i of o.items || []) {
      const key = i.name || i.providerItemId || 'Unknown';
      const cur = itemMap.get(key) || { name: key, units: 0, revenue: 0, category: i.category || 'Category unavailable' };
      cur.units += i.quantity || 0;
      cur.revenue += i.netMoney || 0;
      itemMap.set(key, cur);
      const c = i.category || 'Category unavailable';
      catMap.set(c, (catMap.get(c) || 0) + (i.netMoney || 0));
    }
  }
  const status = facts.some((o) => o.status === 'PARTIAL') ? 'PARTIAL' : 'COMPLETE';
  return DailyMetric.findOneAndUpdate(
    { organizationId, locationId, businessDate, metricVersion: 1 },
    {
      currency: facts.find((o) => o.currency)?.currency || 'USD',
      grossMoney: gross,
      netMoney: net,
      orderCount: completed.length,
      guestCount: guestKnown ? guests : null,
      averageTicket: completed.length ? Math.round(net / completed.length) : null,
      refundMoney: refund,
      voidMoney: voids,
      discountMoney: discount,
      channels,
      topItems: [...itemMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 20),
      categories: [...catMap.entries()].map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue),
      dataStatus: status,
      coverage: status === 'COMPLETE' ? 100 : 75,
      freshnessAt: new Date(),
      sourceProviders: [...new Set(facts.map((o) => o.provider))],
      itemCategoryStatus: completed.some((o) => (o.items || []).some((i) => i.category)) ? 'COMPLETE' : 'UNAVAILABLE',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function rebuildBaselinesAndScore({ organizationId, locationId, businessDate }) {
  const loc = await Location.findOne({ _id: locationId, organizationId });
  if (!loc) return null;
  const current = await DailyMetric.findOne({ organizationId, locationId, businessDate, metricVersion: 1 }).lean();
  if (!current || current.dataStatus !== 'COMPLETE') return null;
  const d = new Date(`${businessDate}T12:00:00Z`);
  const weekday = d.getUTCDay();
  const history = await DailyMetric.find({ organizationId, locationId, businessDate: { $lt: businessDate }, dataStatus: 'COMPLETE' }).sort({ businessDate: -1 }).limit(70).lean();
  const comparable = history.filter((h) => new Date(`${h.businessDate}T12:00:00Z`).getUTCDay() === weekday).slice(0, 8);
  const provisional = comparable.length < 8;
  const enough = comparable.length >= 4;
  const metrics = ['netMoney', 'orderCount', 'averageTicket', 'refundMoney', 'voidMoney', 'discountMoney'];
  const baselines = {};
  for (const metric of metrics) {
    const vals = comparable.map((h) => Number(h[metric] || 0));
    const trend = enough ? boundedTrendExpectation(vals) : { expected: null, center: null, recentMedian: null, trendFactor: null, bounds: { minFactor: 0.9, maxFactor: 1.1 } };
    const expected = trend.expected;
    baselines[metric] = expected;
    await Baseline.findOneAndUpdate(
      { organizationId, locationId, metric, weekday },
      {
        expected,
        center: trend.center,
        recentMedian: trend.recentMedian,
        trendFactor: trend.trendFactor,
        trendBounds: trend.bounds,
        comparisonDates: comparable.map((x) => x.businessDate),
        coverage: Math.min(100, (comparable.length / 8) * 100),
        formulaVersion: 2,
        status: provisional ? 'PROVISIONAL' : 'COMPLETE',
      },
      { upsert: true, new: true },
    );
  }
  const weights = await settings.getEffective(organizationId, 'scoreWeights', locationId, new Date(`${businessDate}T23:59:59Z`)) || settings.DEFAULTS.scoreWeights;
  const eligible = {};
  const ratioScore = (actual, expected, inverse = false) => {
    if (expected == null || expected === 0) return null;
    const r = actual / expected;
    const s = inverse ? 100 - (r - 1) * 100 : 100 + (r - 1) * 100;
    return Math.max(0, Math.min(100, s));
  };
  eligible.sales = ratioScore(current.netMoney, baselines.netMoney);
  const os = ratioScore(current.orderCount, baselines.orderCount);
  const ats = ratioScore(current.averageTicket, baselines.averageTicket);
  eligible.demand = os != null && ats != null ? (os + ats) / 2 : (os ?? ats);
  const curExc = (current.refundMoney + current.voidMoney + current.discountMoney) / Math.max(1, current.netMoney);
  const baseExc = ((baselines.refundMoney || 0) + (baselines.voidMoney || 0) + (baselines.discountMoney || 0)) / Math.max(1, baselines.netMoney || 0);
  eligible.exceptions = baseExc > 0 ? ratioScore(curExc, baseExc, true) : 100;
  const direct = current.channels?.direct_online || 0;
  const histDirect = comparable.map((h) => h.channels?.direct_online || 0);
  const directBaseline = histDirect.some(Boolean) ? boundedTrendExpectation(histDirect).expected : null;
  eligible.operating = directBaseline != null ? ratioScore(direct, directBaseline) : null;
  const available = Object.entries(eligible).filter(([, v]) => v != null);
  const totalAvailWeight = available.reduce((s, [k]) => s + (weights[k] || 0), 0);
  const score = totalAvailWeight ? available.reduce((s, [k, v]) => s + v * (weights[k] || 0) / totalAvailWeight, 0) : null;
  const coverage = Math.round(totalAvailWeight * 100);
  const row = await LocationScore.findOneAndUpdate(
    { organizationId, locationId, businessDate, scoreVersion: 1 },
    {
      score: score == null ? null : Math.round(score * 10) / 10,
      coverage,
      netSales: current.netMoney,
      components: eligible,
      weights,
      comparison: { netSalesPct: pct(current.netMoney, baselines.netMoney), baselineFormulaVersion: 2 },
    },
    { upsert: true, new: true },
  );
  const peers = await LocationScore.find({ organizationId, businessDate, scoreVersion: 1, score: { $ne: null } }).sort({ score: -1 });
  for (let i = 0; i < peers.length; i++) {
    peers[i].rank = i + 1;
    await peers[i].save();
  }
  return row;
}

async function listMetrics(auth, query) {
  const range = parseRange(query);
  const filter = applyScope(auth, { businessDate: { $gte: range.from, $lte: range.to } }, query.locationId);
  const rows = await DailyMetric.find(filter).sort({ businessDate: 1 }).lean();
  return { range, rows };
}

async function aggregateMetrics(auth, query) {
  const { range, rows } = await listMetrics(auth, query);
  const prev = query.comparison === 'prior-year' ? priorYearRange(range) : previousRange(range);
  const previous = await DailyMetric.find(applyScope(auth, { businessDate: { $gte: prev.from, $lte: prev.to } }, query.locationId)).lean();
  const usable = (list) => list.filter((r) => r.dataStatus !== 'UNAVAILABLE');
  const currentRows = usable(rows);
  const previousRows = usable(previous);
  const sum = (arr, k) => arr.reduce((total, row) => total + (Number(row[k]) || 0), 0);
  const hasCurrent = currentRows.length > 0;
  const hasPrevious = previousRows.length > 0;
  const current = {
    grossMoney: hasCurrent ? sum(currentRows, 'grossMoney') : null,
    netMoney: hasCurrent ? sum(currentRows, 'netMoney') : null,
    orderCount: hasCurrent ? sum(currentRows, 'orderCount') : null,
    guestCount: hasCurrent && currentRows.every((r) => r.guestCount != null) ? sum(currentRows, 'guestCount') : null,
    refundMoney: hasCurrent ? sum(currentRows, 'refundMoney') : null,
    voidMoney: hasCurrent ? sum(currentRows, 'voidMoney') : null,
    discountMoney: hasCurrent ? sum(currentRows, 'discountMoney') : null,
  };
  current.averageTicket = current.orderCount > 0 ? Math.round(current.netMoney / current.orderCount) : null;
  const prior = {
    grossMoney: hasPrevious ? sum(previousRows, 'grossMoney') : null,
    netMoney: hasPrevious ? sum(previousRows, 'netMoney') : null,
    orderCount: hasPrevious ? sum(previousRows, 'orderCount') : null,
    guestCount: hasPrevious && previousRows.every((r) => r.guestCount != null) ? sum(previousRows, 'guestCount') : null,
    refundMoney: hasPrevious ? sum(previousRows, 'refundMoney') : null,
  };
  prior.averageTicket = prior.orderCount > 0 ? Math.round(prior.netMoney / prior.orderCount) : null;
  const locFilter = { organizationId: auth.organizationId, status: 'active' };
  const scoped = authorizedLocationFilter(auth, query.locationId);
  if (scoped) locFilter._id = scoped;
  const locationCount = Math.max(1, await Location.countDocuments(locFilter));
  const dayCount = Math.round((new Date(`${range.to}T00:00:00Z`) - new Date(`${range.from}T00:00:00Z`)) / 86400000) + 1;
  const expectedCells = Math.max(1, dayCount * locationCount);
  const coverage = Math.min(100, Math.round(rows.reduce((total, row) => total + Math.max(0, Math.min(100, Number(row.coverage ?? (row.dataStatus === 'COMPLETE' ? 100 : 0)))), 0) / expectedCells));
  const hasMissing = rows.length < expectedCells;
  const statuses = new Set(rows.map((r) => r.dataStatus));
  let dataStatus = 'PARTIAL';
  if (!hasCurrent) dataStatus = 'UNAVAILABLE';
  else if (!hasMissing && statuses.size === 1 && statuses.has('COMPLETE')) dataStatus = 'COMPLETE';
  else if (!hasMissing && statuses.size === 1 && statuses.has('STALE')) dataStatus = 'STALE';
  return {
    range,
    current,
    comparison: {
      mode: query.comparison === 'prior-year' ? 'prior-year' : 'previous',
      previousRange: prev,
      grossPct: current.grossMoney != null && prior.grossMoney != null ? pct(current.grossMoney, prior.grossMoney) : null,
      netSalesPct: current.netMoney != null && prior.netMoney != null ? pct(current.netMoney, prior.netMoney) : null,
      ordersPct: current.orderCount != null && prior.orderCount != null ? pct(current.orderCount, prior.orderCount) : null,
      guestsPct: current.guestCount != null && prior.guestCount != null ? pct(current.guestCount, prior.guestCount) : null,
      averageTicketPct: current.averageTicket != null && prior.averageTicket != null ? pct(current.averageTicket, prior.averageTicket) : null,
      refundsPct: current.refundMoney != null && prior.refundMoney != null ? pct(current.refundMoney, prior.refundMoney) : null,
    },
    dataStatus,
    coverage,
    freshnessAt: rows.reduce((latest, row) => (!latest || row.freshnessAt > latest ? row.freshnessAt : latest), null),
  };
}

function locationSnapshot(scoreRow) {
  if (!scoreRow) return null;
  const loc = scoreRow.locationId;
  return {
    locationId: loc && typeof loc === 'object' ? String(loc._id || loc.id) : String(scoreRow.locationId || ''),
    name: loc && typeof loc === 'object' ? loc.name : 'Location',
    score: scoreRow.score == null ? null : Math.round(scoreRow.score * 10) / 10,
    rank: scoreRow.rank ?? null,
  };
}

function dashboardHeadline(summary, scores) {
  if (summary.dataStatus === 'UNAVAILABLE') return 'Prior-period performance is unavailable while source data is incomplete.';
  const weakest = scores.length ? scores[scores.length - 1] : null;
  const weakestName = weakest?.locationId?.name;
  const direction = summary.comparison.netSalesPct == null
    ? 'Performance is available'
    : Math.abs(summary.comparison.netSalesPct) < 3
      ? 'Performance is broadly stable'
      : summary.comparison.netSalesPct > 0
        ? 'Sales finished above the comparable period'
        : 'Sales finished below the comparable period';
  return `${direction}.${weakestName && weakest?.score != null && weakest.score < 70 ? ` ${weakestName} needs attention.` : ''}`;
}

function dashboardPriorities(summary, scores) {
  const priorities = [];
  const change = summary.comparison.netSalesPct;
  if (change != null && change <= -5) {
    priorities.push({
      ref: 'sales-below-comparable',
      type: 'sales_below_normal',
      severity: 'warning',
      title: 'Sales below comparable period',
      detail: `Net sales are ${Math.abs(change).toFixed(1)}% below the comparable period.`,
      locationId: null,
      locationName: null,
      evidence: [{ metric: 'netSalesPct', value: change }],
      nextAction: 'Review the affected store, channel and comparable-day sales before adjusting staffing or promotions.',
    });
  }
  const weakest = scores.length ? scores[scores.length - 1] : null;
  if (weakest?.score != null && weakest.score < 70) {
    const loc = weakest.locationId;
    const name = loc && typeof loc === 'object' ? loc.name : 'A location';
    priorities.push({
      ref: `score:${String(loc && typeof loc === 'object' ? loc._id : loc || weakest._id)}`,
      type: 'location_underperforming_peers',
      severity: weakest.score < 55 ? 'critical' : 'warning',
      title: `${name} needs attention`,
      detail: `${name} scored ${weakest.score} with ${weakest.coverage ?? 0}% coverage.`,
      locationId: loc && typeof loc === 'object' ? String(loc._id) : (loc ? String(loc) : null),
      locationName: name,
      evidence: [{ score: weakest.score, coverage: weakest.coverage }],
      nextAction: 'Compare the location with its own baseline first, then review the largest KPI gaps versus peers.',
    });
  }
  const refunds = summary.current.refundMoney;
  const net = summary.current.netMoney;
  if (refunds != null && net && refunds / net >= 0.08) {
    priorities.push({
      ref: 'exceptions-refunds',
      type: 'exceptions_above_normal',
      severity: 'warning',
      title: 'Refunds elevated versus sales',
      detail: `Refunds are ${((refunds / net) * 100).toFixed(1)}% of net sales for the selected period.`,
      locationId: null,
      locationName: null,
      evidence: [{ refundMoney: refunds, netMoney: net }],
      nextAction: 'Open exception orders, confirm reason codes and coach or correct the process causing the increase.',
    });
  }
  return priorities.slice(0, 5);
}

async function dashboard(auth, query) {
  const summary = await aggregateMetrics(auth, query);
  const latestDate = summary.range.to;
  const loc = authorizedLocationFilter(auth, query.locationId);
  const scoreFilter = { organizationId: auth.organizationId, businessDate: latestDate };
  if (loc) scoreFilter.locationId = loc;
  const scores = await LocationScore.find(scoreFilter).populate('locationId', 'name').sort({ rank: 1 }).lean();
  const health = salesWeightedHealth(scores);
  const weekday = new Date(`${latestDate}T12:00:00Z`).getUTCDay();
  const priorFilter = { organizationId: auth.organizationId, businessDate: { $gte: addDays(latestDate, -42), $lt: latestDate } };
  if (loc) priorFilter.locationId = loc;
  const recentScores = await LocationScore.find(priorFilter).lean();
  const priorDates = [...new Set(recentScores.filter((r) => new Date(`${r.businessDate}T12:00:00Z`).getUTCDay() === weekday).map((r) => r.businessDate))].sort().reverse();
  let healthComparison = { businessDate: null, score: null, change: null };
  if (priorDates.length) {
    const priorDate = priorDates[0];
    const prior = salesWeightedHealth(recentScores.filter((r) => r.businessDate === priorDate));
    healthComparison = {
      businessDate: priorDate,
      score: prior.score == null ? null : Math.round(prior.score * 10) / 10,
      change: health.score == null || prior.score == null ? null : Math.round((health.score - prior.score) * 10) / 10,
    };
  }
  const [scopeLocations, latestMetrics] = await Promise.all([
    Location.find({ organizationId: auth.organizationId, status: 'active', ...(loc ? { _id: loc } : {}) }).select('name').lean(),
    DailyMetric.find(applyScope(auth, { businessDate: latestDate }, query.locationId)).select('locationId guestCount dataStatus coverage').lean(),
  ]);
  const metricByLocation = new Map(latestMetrics.map((row) => [String(row.locationId), row]));
  const dataQuality = [];
  for (const location of scopeLocations) {
    const metric = metricByLocation.get(String(location._id));
    if (!metric || metric.dataStatus === 'UNAVAILABLE') {
      dataQuality.push({ locationId: String(location._id), locationName: location.name, metric: 'source', status: 'UNAVAILABLE', message: `${location.name} performance data is unavailable; labeled Unavailable, not zero.` });
    } else {
      if (metric.dataStatus !== 'COMPLETE') {
        dataQuality.push({ locationId: String(location._id), locationName: location.name, metric: 'source', status: metric.dataStatus, message: `${location.name} source data is ${String(metric.dataStatus).toLowerCase()}; dependent metrics remain qualified.` });
      }
      if (metric.guestCount == null) {
        dataQuality.push({ locationId: String(location._id), locationName: location.name, metric: 'guestCount', status: 'UNAVAILABLE', message: `${location.name} guest count is unavailable; labeled Unavailable, not zero.` });
      }
    }
  }
  const priorities = dashboardPriorities(summary, scores);
  return {
    ...summary,
    headline: dashboardHeadline(summary, scores),
    businessHealth: health.score == null ? null : Math.round(health.score * 10) / 10,
    businessHealthCoverage: Math.round(health.coverage),
    businessHealthComparison: healthComparison,
    businessHealthScoreVersion: scores.find((s) => s.scoreVersion != null)?.scoreVersion ?? 1,
    bestLocation: locationSnapshot(scores[0]),
    weakestLocation: scores.length ? locationSnapshot(scores[scores.length - 1]) : null,
    scores,
    priorities,
    dataQuality,
    signals: {
      exceptions: {
        refundMoney: summary.current.refundMoney,
        voidMoney: summary.current.voidMoney,
        discountMoney: summary.current.discountMoney,
        status: summary.current.refundMoney == null && summary.current.voidMoney == null ? 'UNAVAILABLE' : 'COMPLETE',
      },
    },
  };
}

async function finance(auth, query) {
  if (!auth.canFinance) throw new ApiError(403, 'Finance access required');
  const summary = await aggregateMetrics(auth, query);
  const metricRows = await DailyMetric.find(applyScope(auth, { businessDate: { $gte: summary.range.from, $lte: summary.range.to }, dataStatus: { $ne: 'UNAVAILABLE' } }, query.locationId)).sort({ businessDate: 1 }).lean();
  const margin = await settings.getEffective(auth.organizationId, 'selectedMargin', query.locationId || null, new Date(`${summary.range.to}T23:59:59Z`));
  const locationIds = [...new Set(metricRows.map((r) => String(r.locationId)))];
  const locations = await Location.find({ _id: { $in: locationIds }, organizationId: auth.organizationId }).select('name').lean();
  const names = new Map(locations.map((l) => [String(l._id), l.name]));
  const endMargins = new Map();
  for (const id of locationIds) {
    endMargins.set(id, await settings.getEffective(auth.organizationId, 'selectedMargin', id, new Date(`${summary.range.to}T23:59:59Z`)) ?? margin ?? settings.DEFAULTS.selectedMargin);
  }
  const rankingMap = new Map();
  for (const row of metricRows) {
    const id = String(row.locationId);
    const cur = rankingMap.get(id) || { locationId: id, locationName: names.get(id) || 'Location', netMoney: 0, estimatedProfit: 0, days: 0 };
    const m = endMargins.get(id) ?? 0;
    cur.netMoney += Number(row.netMoney || 0);
    cur.estimatedProfit += Math.round(Number(row.netMoney || 0) * m);
    cur.days++;
    rankingMap.set(id, cur);
  }
  const storeRankings = [...rankingMap.values()].sort((a, b) => b.netMoney - a.netMoney).map((x, i) => ({ ...x, rank: i + 1, selectedMargin: endMargins.get(x.locationId) ?? 0 }));
  const trendMap = new Map();
  for (const row of metricRows) {
    const key = row.businessDate;
    const cur = trendMap.get(key) || { businessDate: key, netMoney: 0, estimatedProfit: 0 };
    const m = await settings.getEffective(auth.organizationId, 'selectedMargin', String(row.locationId), new Date(`${row.businessDate}T23:59:59Z`)) ?? margin ?? settings.DEFAULTS.selectedMargin;
    cur.netMoney += Number(row.netMoney || 0);
    cur.estimatedProfit += Math.round(Number(row.netMoney || 0) * m);
    trendMap.set(key, cur);
  }
  const dailyTrend = [...trendMap.values()].sort((a, b) => a.businessDate.localeCompare(b.businessDate));
  const endDate = new Date(`${summary.range.to}T00:00:00Z`);
  const mondayOffset = (endDate.getUTCDay() + 6) % 7;
  const periodQueries = {
    daily: { from: summary.range.to, to: summary.range.to },
    weekly: { from: addDays(summary.range.to, -6), to: summary.range.to },
    mtd: { from: `${summary.range.to.slice(0, 7)}-01`, to: summary.range.to },
    wtd: { from: addDays(summary.range.to, -mondayOffset), to: summary.range.to },
  };
  const periodSummaries = {};
  for (const [key, r] of Object.entries(periodQueries)) {
    const a = await aggregateMetrics(auth, { locationId: query.locationId, from: r.from, to: r.to, comparison: 'previous' });
    periodSummaries[key] = { range: a.range, current: a.current, comparison: a.comparison, dataStatus: a.dataStatus, coverage: a.coverage };
  }
  return {
    ...summary,
    estimatedProfitAtSelectedMargin: summary.current.netMoney == null ? null : Math.round(summary.current.netMoney * (margin || 0)),
    selectedMargin: margin,
    storeRankings,
    dailyTrend,
    periodSummaries,
  };
}

function deterministicPerformanceSummary(summary) {
  const change = summary.comparison.netSalesPct;
  if (summary.dataStatus === 'UNAVAILABLE') return 'Insufficient reliable POS data is available for the selected period.';
  if (change != null && change <= -5) return `Net sales are ${Math.abs(change).toFixed(1)}% below the comparable period; review the location and channel mix for the largest decline.`;
  if (change != null && change >= 5) return `Net sales are ${change.toFixed(1)}% above the comparable period; identify the strongest location, channel and items contributing to the gain.`;
  if (change != null) return `Net sales are broadly stable at ${change >= 0 ? '+' : ''}${change.toFixed(1)}% versus the comparable period; monitor exceptions and item mix for material changes.`;
  return 'Current-period performance is available, but comparable history is insufficient for a reliable change statement.';
}

async function performanceSummary(summary, locationComparisons, locationScores) {
  const fallback = deterministicPerformanceSummary(summary);
  if (!env.openaiApiKey) return { text: fallback, mode: 'DETERMINISTIC_FALLBACK' };
  try {
    const evidence = {
      range: summary.range,
      dataStatus: summary.dataStatus,
      coverage: summary.coverage,
      current: summary.current,
      comparison: summary.comparison,
      locations: locationComparisons.slice(0, 6),
      scores: locationScores.slice(0, 6).map((s) => ({ name: s.locationId?.name || 'Location', score: s.score, rank: s.rank, coverage: s.coverage })),
    };
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.openaiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.openaiModel,
        max_output_tokens: 90,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: 'Write exactly one concise sentence identifying one key issue or opportunity from the supplied Gourmet Palace performance evidence. Use only supplied figures, preserve partial/unavailable meaning, and do not claim causation.' }] },
          { role: 'user', content: [{ type: 'input_text', text: JSON.stringify(evidence) }] },
        ],
      }),
    });
    if (!response.ok) return { text: fallback, mode: 'DETERMINISTIC_FALLBACK' };
    const data = await response.json();
    const text = String(data.output_text || '').trim();
    return text ? { text: text.replace(/\s+/g, ' '), mode: 'AI' } : { text: fallback, mode: 'DETERMINISTIC_FALLBACK' };
  } catch {
    return { text: fallback, mode: 'DETERMINISTIC_FALLBACK' };
  }
}

function hourInZone(value, timeZone) {
  if (!value) return null;
  try {
    const hour = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value)).find((part) => part.type === 'hour');
    return hour ? Number(hour.value) : null;
  } catch {
    return null;
  }
}

function daypartLabel(hour) {
  if (hour == null) return null;
  if (hour < 8) return 'Overnight';
  if (hour < 10) return '8a';
  if (hour < 12) return '10a';
  if (hour < 14) return '12p';
  if (hour < 16) return '2p';
  if (hour < 18) return '4p';
  if (hour < 20) return '6p';
  if (hour < 22) return '8p';
  return '10p';
}

function accumulateItems(rows, map) {
  for (const row of rows) {
    if (row.dataStatus === 'UNAVAILABLE') continue;
    for (const item of row.topItems || []) {
      const current = map.get(item.name) || { name: item.name, units: 0, revenue: 0, category: item.category };
      current.units += item.units || 0;
      current.revenue += item.revenue || 0;
      if (item.category) current.category = item.category;
      map.set(item.name, current);
    }
  }
}

async function performance(auth, query) {
  const summary = await aggregateMetrics(auth, query);
  const rows = (await listMetrics(auth, query)).rows;
  const channels = {};
  const items = new Map();
  const cats = new Map();
  for (const r of rows) {
    if (r.dataStatus === 'UNAVAILABLE') continue;
    for (const [k, v] of Object.entries(r.channels || {})) channels[k] = (channels[k] || 0) + Number(v || 0);
    accumulateItems([r], items);
    for (const c of r.categories || []) cats.set(c.name, (cats.get(c.name) || 0) + (c.revenue || 0));
  }
  const prev = summary.comparison.previousRange;
  const prevRows = await DailyMetric.find(applyScope(auth, { businessDate: { $gte: prev.from, $lte: prev.to } }, query.locationId)).lean();
  const priorItems = new Map();
  accumulateItems(prevRows, priorItems);
  const ids = [...new Set(rows.map((r) => String(r.locationId)))];
  const locations = await Location.find({ _id: { $in: ids }, organizationId: auth.organizationId }).select('name timezone').lean();
  const names = new Map(locations.map((l) => [String(l._id), l.name]));
  const timezones = new Map(locations.map((l) => [String(l._id), l.timezone || 'America/Los_Angeles']));
  const sum = (list, key) => list.filter((r) => r.dataStatus !== 'UNAVAILABLE').reduce((total, r) => total + Number(r[key] || 0), 0);
  const locationComparisons = ids.map((id) => {
    const currentRows = rows.filter((r) => String(r.locationId) === id);
    const priorRows = prevRows.filter((r) => String(r.locationId) === id);
    const netMoney = sum(currentRows, 'netMoney');
    const orderCount = sum(currentRows, 'orderCount');
    const grossMoney = sum(currentRows, 'grossMoney');
    const guestCount = currentRows.length && currentRows.every((r) => r.guestCount != null) ? sum(currentRows, 'guestCount') : null;
    const refundMoney = sum(currentRows, 'refundMoney');
    const priorNet = sum(priorRows, 'netMoney');
    const priorOrders = sum(priorRows, 'orderCount');
    return {
      locationId: id,
      locationName: names.get(id) || 'Location',
      grossMoney,
      netMoney,
      orderCount,
      guestCount,
      refundMoney,
      averageTicket: orderCount ? Math.round(netMoney / orderCount) : null,
      netSalesPct: pct(netMoney, priorNet),
      ordersPct: pct(orderCount, priorOrders),
      coverage: Math.min(100, Math.round(currentRows.reduce((total, r) => total + Math.max(0, Math.min(100, Number(r.coverage ?? (r.dataStatus === 'COMPLETE' ? 100 : 0)))), 0) / (Math.round((new Date(`${summary.range.to}T00:00:00Z`) - new Date(`${summary.range.from}T00:00:00Z`)) / 86400000) + 1))),
    };
  }).sort((a, b) => b.netMoney - a.netMoney);
  const scoreFilter = { organizationId: auth.organizationId, businessDate: summary.range.to };
  const scoped = authorizedLocationFilter(auth, query.locationId);
  if (scoped) scoreFilter.locationId = scoped;
  const locationScores = await LocationScore.find(scoreFilter).populate('locationId', 'name').sort({ rank: 1 }).lean();
  const narration = await performanceSummary(summary, locationComparisons, locationScores);
  const ranked = [...items.values()].filter((i) => i.units > 0 || i.revenue > 0).map((item) => {
    const prior = priorItems.get(item.name);
    return { ...item, changePct: prior?.revenue ? pct(item.revenue, prior.revenue) : null };
  });
  const sourceProviders = [...new Set(rows.flatMap((row) => row.sourceProviders || []))];
  const guestSource = summary.current.guestCount == null ? 'unavailable' : sourceProviders.length === 1 ? sourceProviders[0] : sourceProviders.length ? 'mixed' : 'unavailable';
  let peerComparison = null;
  if (query.locationId && locationComparisons.length > 1) {
    const selected = locationComparisons.find((row) => row.locationId === String(query.locationId));
    const peers = locationComparisons.filter((row) => row.locationId !== String(query.locationId));
    if (selected && peers.length) {
      const avg = (key) => peers.reduce((total, row) => total + Number(row[key] || 0), 0) / peers.length;
      const guestPeers = peers.filter((row) => row.guestCount != null);
      peerComparison = {
        grossPct: pct(selected.grossMoney, avg('grossMoney')),
        netSalesPct: pct(selected.netMoney, avg('netMoney')),
        ordersPct: pct(selected.orderCount, avg('orderCount')),
        averageTicketPct: pct(selected.averageTicket, avg('averageTicket')),
        guestsPct: selected.guestCount != null && guestPeers.length ? pct(selected.guestCount, guestPeers.reduce((total, row) => total + row.guestCount, 0) / guestPeers.length) : null,
        refundsPct: pct(selected.refundMoney, avg('refundMoney')),
        peerCount: peers.length,
      };
    }
  }
  const orderFilter = applyScope(auth, { businessDate: { $gte: summary.range.from, $lte: summary.range.to }, orderState: 'COMPLETED' }, query.locationId);
  const orderRows = await Order.find(orderFilter).select('locationId sourceTimestamp netMoney').limit(20000).lean();
  const daypartOrder = ['Overnight', '8a', '10a', '12p', '2p', '4p', '6p', '8p', '10p'];
  const daypartMap = new Map(daypartOrder.map((label) => [label, 0]));
  let stamped = 0;
  for (const order of orderRows) {
    const hour = hourInZone(order.sourceTimestamp, timezones.get(String(order.locationId)) || 'America/Los_Angeles');
    const label = daypartLabel(hour);
    if (!label) continue;
    stamped += 1;
    daypartMap.set(label, (daypartMap.get(label) || 0) + Number(order.netMoney || 0));
  }
  const dayparts = daypartOrder.map((label) => ({ label, netMoney: daypartMap.get(label) || 0 }));
  return {
    ...summary,
    channels,
    topItems: ranked.sort((a, b) => b.revenue - a.revenue).slice(0, 20),
    slowItems: ranked.filter((item) => item.units >= 1).sort((a, b) => a.revenue - b.revenue).slice(0, 20),
    categories: [...cats.entries()].map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue),
    locationComparisons,
    locationScores,
    summaryLine: narration.text,
    summaryMode: narration.mode,
    sourceProviders,
    guestSource,
    peerComparison,
    dayparts,
    daypartStatus: stamped ? (stamped >= orderRows.length * 0.5 ? 'COMPLETE' : 'PARTIAL') : 'UNAVAILABLE',
  };
}

async function orders(auth, query) {
  const range = parseRange(query);
  const page = Math.max(1, Math.min(10000, Number(query.page) || 1));
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 50));
  const filter = applyScope(auth, { businessDate: { $gte: range.from, $lte: range.to } }, query.locationId);
  if (query.exception === 'true') filter.$or = [{ refundMoney: { $gt: 0 } }, { voidMoney: { $gt: 0 } }, { discountMoney: { $gt: 0 } }, { orderState: 'CANCELED' }];
  const [rows, total] = await Promise.all([
    Order.find(filter).populate('locationId', 'name').sort({ sourceTimestamp: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);
  return { range, page, limit, total, orders: rows.map(({ rawRef, ...row }) => row) };
}

module.exports = {
  rebuildDaily,
  rebuildBaselinesAndScore,
  listMetrics,
  aggregateMetrics,
  dashboard,
  finance,
  performance,
  orders,
};
