const Brief = require('../../models/Brief');
const Connection = require('../../models/Connection');
const JobRun = require('../../models/JobRun');
const Location = require('../../models/Location');
const User = require('../../models/User');
const analytics = require('../analytics/analytics.service');
const { getMailProvider } = require('../mail/mail.provider');
const ApiError = require('../../utils/ApiError');
const InventoryItem = require('../../models/InventoryItem');
const { applyScope } = require('../../utils/scope');

async function evidenceAuth(organizationId, locationIds, admin = false, userId = null) {
  return {
    organizationId: String(organizationId),
    userId: userId ? String(userId) : null,
    locationIds: locationIds.map(String),
    allLocations: admin,
    canFinance: admin,
    isAdmin: admin,
  };
}

function formatMoney(cents) {
  return cents == null
    ? 'Unavailable'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

async function generate({ organizationId, businessDate, locationIds = [], scopeKey = 'company', adminScope = true, recipients = [], userId = null }) {
  const auth = await evidenceAuth(organizationId, locationIds, adminScope, userId);
  const q = { from: businessDate, to: businessDate };
  if (!adminScope && locationIds.length === 1) q.locationId = String(locationIds[0]);

  const dash = await analytics.dashboard(auth, q);

  let finance = null;
  if (adminScope) {
    try { finance = await analytics.finance(auth, q); } catch { finance = null; }
  }

  const connections = await Connection.find({ organizationId }).lean();
  const scopeLocs = (locationIds || []).map(String);
  const sourceCoverage = [];
  let sourcesComplete = true;
  for (const c of connections) {
    if (!['square', 'google'].includes(c.provider)) continue;
    for (const id of scopeLocs) {
      const mapped = c.provider === 'square'
        ? c.mappings?.locations?.[id]?.squareLocationId
        : c.mappings?.locations?.[id]?.ga4PropertyId || c.mappings?.locations?.[id]?.gscSiteUrl || c.mappings?.locations?.[id]?.gbpLocationName;
      if (!mapped) continue;
      const job = await JobRun.findOne({ organizationId, source: c.provider, locationId: id, businessDate }).sort({ updatedAt: -1 }).lean();
      const state = job?.status || 'UNAVAILABLE';
      sourceCoverage.push({ provider: c.provider, locationId: id, status: state });
      if (state !== 'COMPLETE') sourcesComplete = false;
    }
  }

  let inventory = [];
  try {
    inventory = await InventoryItem.find(applyScope(auth, { status: 'active' }, q.locationId)).select('name currentQuantity unit parLevel lastCountAt').limit(200).lean();
  } catch { inventory = []; }
  let forecasts = [];
  try { forecasts = (await analytics.forecasts(auth, q)).forecasts || []; } catch { forecasts = []; }
  let presence = null;
  if (adminScope) {
    try { presence = await analytics.presence(auth, q); } catch { presence = null; }
  }

  const dataStatus = dash.dataStatus === 'COMPLETE' && sourcesComplete ? 'COMPLETE' : 'PARTIAL';
  const priorities = (dash.priorities || []).slice(0, 5);
  const exceptionSummary = {
    refundMoney: dash.current.refundMoney,
    voidMoney: dash.current.voidMoney,
    discountMoney: dash.current.discountMoney,
  };
  const financeSummary = finance ? {
    estimatedProfitAtSelectedMargin: finance.estimatedProfitAtSelectedMargin,
    selectedMargin: finance.selectedMargin,
    approvedFoodPurchases: finance.approvedFoodPurchases,
    foodCostPercent: finance.foodCostPercent,
    foodCostTarget: finance.foodCostTarget,
  } : null;
  const inventorySummary = {
    count: inventory.length,
    critical: inventory.filter((item) => item.currentQuantity <= 0 || (item.parLevel > 0 && item.currentQuantity < item.parLevel)).length,
  };
  const forecastSummary = {
    weekStart: forecasts[0]?.weekStart || null,
    expectedMoney: forecasts.reduce((sum, row) => sum + Number(row.expectedMoney || 0), 0) || null,
    status: forecasts[0]?.status || 'UNAVAILABLE',
  };
  const growthSummary = presence ? {
    reviewCount: presence.reviews?.length || 0,
    seoCount: presence.seo?.length || 0,
    recommendations: (presence.recommendations || []).length,
  } : null;

  const revisionKey = {
    dataStatus,
    current: dash.current,
    health: { score: dash.businessHealth, coverage: dash.businessHealthCoverage, comparison: dash.businessHealthComparison },
    scores: (dash.scores || []).map((s) => [String(s.locationId?._id || s.locationId), s.score, s.rank, s.coverage]),
    priorities: priorities.map((p) => [p.ref, p.severity, p.title, p.nextAction]),
    finance: financeSummary,
    inventory: inventorySummary,
    forecast: forecastSummary,
    growth: growthSummary,
    sourceCoverage,
  };

  const latest = await Brief.findOne({ organizationId, scopeKey, businessDate }).sort({ revision: -1 }).lean();
  if (latest && latest.status === dataStatus && JSON.stringify(latest.evidence?.revisionKey) === JSON.stringify(revisionKey)) return latest;

  await Brief.updateMany({ organizationId, scopeKey, businessDate, isCurrent: true }, { $set: { isCurrent: false } });
  const revision = (latest?.revision || 0) + 1;
  const content = {
    headline: dash.headline || (dataStatus === 'COMPLETE' ? 'Prior business day is reconciled.' : 'Brief is partial while one or more sources are incomplete.'),
    businessHealth: dash.businessHealth,
    businessHealthCoverage: dash.businessHealthCoverage,
    businessHealthComparison: dash.businessHealthComparison,
    core: dash.current,
    exceptions: exceptionSummary,
    bestLocation: dash.scores?.[0] ? { name: dash.scores[0].locationId?.name, score: dash.scores[0].score } : null,
    weakestLocation: dash.scores?.length ? { name: dash.scores[dash.scores.length - 1].locationId?.name, score: dash.scores[dash.scores.length - 1].score } : null,
    priorities,
    finance: financeSummary,
    inventory: inventorySummary,
    forecast: forecastSummary,
    growth: growthSummary,
  };

  const row = await Brief.create({
    organizationId,
    scopeKey,
    locationIds,
    businessDate,
    revision,
    isCurrent: true,
    status: dataStatus,
    publishedAt: new Date(),
    evidence: { ...dash, finance: financeSummary, inventory: inventorySummary, forecast: forecastSummary, growth: growthSummary, sourceCoverage, revisionKey },
    content,
    priorityRefs: priorities.map((p) => p.ref),
    emailStatus: 'pending',
  });

  let emailStatus = 'not_configured';
  if (recipients.length) {
    const mail = getMailProvider();
    let failures = 0;
    for (const to of [...new Set(recipients)]) {
      try {
        await mail.sendMail({
          to,
          subject: `Gourmet Palace Morning Brief · ${businessDate}${dataStatus === 'PARTIAL' ? ' · Partial' : ''}`,
          text: [
            `Gourmet Palace Morning Brief for ${businessDate}`,
            `Status: ${dataStatus}`,
            `Net sales: ${formatMoney(dash.current.netMoney)}`,
            `Orders: ${dash.current.orderCount ?? 'Unavailable'}`,
            `Business health: ${dash.businessHealth ?? 'Unavailable'}`,
            priorities[0] ? `Top priority: ${priorities[0].title}` : 'Top priority: No material issue in the evidence snapshot',
            '',
            'Open the Command Center for the frozen evidence snapshot and drill-down details.',
          ].join('\n'),
        });
      } catch (err) {
        failures += 1;
        console.error('[brief:email]', to, err.message);
      }
    }
    emailStatus = failures ? 'partial' : 'sent';
  }
  row.emailStatus = emailStatus;
  await row.save();
  return row.toJSON();
}

async function list(auth, q) {
  const filter = { organizationId: auth.organizationId };
  if (!auth.allLocations) filter.scopeKey = `user:${auth.userId}`;
  if (q.businessDate) filter.businessDate = q.businessDate;
  return Brief.find(filter).sort({ businessDate: -1, revision: -1 }).limit(120).lean();
}

async function current(auth, q) {
  const filter = { organizationId: auth.organizationId, isCurrent: true };
  if (q.businessDate) filter.businessDate = q.businessDate;
  if (!auth.allLocations) filter.scopeKey = `user:${auth.userId}`;
  else filter.scopeKey = 'company';
  return Brief.findOne(filter).sort({ businessDate: -1 }).lean();
}

async function generateForDate(auth, user, businessDate) {
  if (!auth.isAdmin) throw new ApiError(403, 'Admin access required');
  const [admins, locations] = await Promise.all([
    User.find({ organizationId: auth.organizationId, role: { $in: ['owner', 'admin'] }, isActive: true, 'notificationPreferences.brief': { $ne: false }, 'notificationPreferences.email': { $ne: false } }).select('email'),
    Location.find({ organizationId: auth.organizationId, status: 'active' }).select('_id'),
  ]);
  return generate({ organizationId: auth.organizationId, businessDate, locationIds: locations.map((x) => x._id), scopeKey: 'company', adminScope: true, recipients: admins.map((x) => x.email), userId: user.id });
}

async function generateDailyForOrganization(organizationId, businessDate) {
  const locations = await Location.find({ organizationId, status: 'active' }).select('_id');
  const allIds = locations.map((x) => x._id);
  const allIdSet = new Set(allIds.map(String));
  const admins = await User.find({ organizationId, role: { $in: ['owner', 'admin'] }, isActive: true, 'notificationPreferences.brief': { $ne: false }, 'notificationPreferences.email': { $ne: false } }).select('email');
  await generate({ organizationId, businessDate, locationIds: allIds, scopeKey: 'company', adminScope: true, recipients: admins.map((x) => x.email) });

  const managers = await User.find({ organizationId, role: 'manager', isActive: true, 'notificationPreferences.brief': { $ne: false } });
  for (const manager of managers) {
    const ids = manager.locationIds.filter((id) => allIdSet.has(String(id)));
    if (!ids.length) continue;
    await generate({ organizationId, businessDate, locationIds: ids, scopeKey: `user:${manager.id}`, adminScope: false, recipients: manager.notificationPreferences?.email === false ? [] : [manager.email], userId: manager.id });
  }
}

module.exports = { generate, list, current, generateForDate, generateDailyForOrganization };
