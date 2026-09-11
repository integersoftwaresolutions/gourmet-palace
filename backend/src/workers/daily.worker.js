const Organization = require('../models/Organization');
const Location = require('../models/Location');
const Connection = require('../models/Connection');
const integrations = require('../modules/integrations/integrations.service');
const briefs = require('../modules/briefs/briefs.service');
const alerts = require('../modules/alerts/evaluate.service');
const { addDays } = require('../utils/dateRange');
const { completedBusinessDateFromParts } = require('./businessDate');
const { zonedParts, pacificScheduleState } = require('./schedule');
const { runOnce } = require('./jobGuard');

function priorBusinessDate(timeZone, cutoffHour = 4, now = new Date()) {
  const p = zonedParts(timeZone, now);
  return completedBusinessDateFromParts(p, cutoffHour);
}

function eligibleConnection(connections, provider) {
  return connections.find((c) => c.provider === provider && ['READY', 'PARTIAL', 'ERROR'].includes(c.status));
}

function errorMessage(err) {
  return String(err?.message || err || 'Unknown error').slice(0, 1000);
}

function squareResultComplete(value) {
  const controls = Object.values(value?.reconciliation || {});
  return value?.sourceClosed === true
    && value?.paymentsStatus !== 'UNAVAILABLE'
    && controls.length > 0
    && controls.every((control) => control?.pass !== false);
}

async function settleSource(name, task) {
  try { return { name, ok: true, value: await task() }; }
  catch (error) { return { name, ok: false, error: errorMessage(error), statusCode: error?.statusCode || error?.status || null }; }
}

async function runDailyRefresh({ org, loc, square, google, pacificDate, now, allowRetry = true }) {
  const businessDate = priorBusinessDate(loc.timezone || 'America/Los_Angeles', 4, now);
  const key = `schedule:daily-refresh:${org._id}:${loc._id}:${pacificDate}`;
  return runOnce({
    organizationId: org._id,
    locationId: loc._id,
    source: 'scheduler',
    businessDate,
    jobType: 'daily_data_refresh',
    idempotencyKey: key,
    staleAfterMs: 10 * 60 * 1000,
    retryStatuses: allowRetry ? ['PARTIAL', 'FAILED'] : [],
    maxAttempts: 2,
    task: async () => {
      const result = {
        businessDate,
        square: square ? null : { status: 'UNAVAILABLE', reason: 'Square is not connected' },
        google: google ? null : { status: 'UNAVAILABLE', reason: 'Google is not connected' },
        alerts: null,
        errors: {},
      };

      // Square and Google are independent. Run them concurrently to keep the
      // Vercel function inside a serverless execution budget.
      const providerTasks = [];
      if (square) providerTasks.push(settleSource('square', () => integrations.squareSync({
        organizationId: org._id,
        locationId: loc._id,
        businessDate,
        force: false,
        ignoreRetryDelay: true,
      })));
      if (google) providerTasks.push(settleSource('google', () => integrations.googleSync({
        organizationId: org._id,
        locationId: loc._id,
        from: addDays(businessDate, -6),
        to: businessDate,
        includeReviews: true,
        jobType: 'google_daily_refresh',
        idempotencyKey: `google:daily-refresh:${org._id}:${loc._id}:${businessDate}`,
        retryIncomplete: allowRetry,
      })));

      const providerResults = await Promise.all(providerTasks);
      for (const source of providerResults) {
        if (!source.ok) {
          result.errors[source.name] = source.error;
          result[source.name] = { status: 'FAILED', error: source.error };
          console.error(`[daily:${source.name}]`, loc.name, source.error);
          continue;
        }
        result[source.name] = source.value;
        if (source.name === 'square' && !squareResultComplete(source.value)) {
          result.errors.square = 'Square refresh completed with incomplete reconciliation, an open source day, or unavailable payment data.';
        }
        if (source.name === 'google') {
          for (const [subSource, message] of Object.entries(source.value?.errors || {})) {
            result.errors[`google.${subSource}`] = message;
          }
          const incomplete = Object.values(source.value?.sources || {}).some((row) => ['ERROR', 'PARTIAL', 'NO_DATA', 'UNMAPPED'].includes(row.status));
          if (incomplete) result.errors.google = 'Google refresh has incomplete sources; see source results.';
          if (source.value?.skipReason === 'already_running') result.errors.google = 'Google refresh is already running.';
        }
      }

      // Alerts run after provider refresh so they evaluate the freshest canonical data.
      try {
        await alerts.evaluateLocation({ organizationId: org._id, locationId: loc._id, businessDate });
        result.alerts = { status: 'COMPLETE' };
      } catch (err) {
        result.errors.alerts = errorMessage(err);
        result.alerts = { status: 'FAILED', error: result.errors.alerts };
        console.error('[daily:alerts]', loc.name, result.errors.alerts);
      }

      return { jobStatus: Object.keys(result.errors).length ? 'PARTIAL' : 'COMPLETE', result };
    },
  });
}

async function generateMorningBrief({ org, pacificDate, businessDate }) {
  return runOnce({
    organizationId: org._id,
    source: 'scheduler',
    businessDate,
    jobType: 'morning_brief_publish',
    idempotencyKey: `schedule:morning-brief:${org._id}:${pacificDate}`,
    staleAfterMs: 10 * 60 * 1000,
    retryStatuses: ['FAILED'],
    maxAttempts: 2,
    task: async () => {
      await briefs.generateDailyForOrganization(org._id, businessDate);
      return { publishedFor: businessDate };
    },
  });
}

async function runOrganizationDaily({ org, pacificDate, now }) {
  const briefBusinessDate = addDays(pacificDate, -1);
  return runOnce({
    organizationId: org._id,
    source: 'scheduler',
    businessDate: briefBusinessDate,
    jobType: 'vercel_daily_orchestrator',
    idempotencyKey: `schedule:vercel-daily:${org._id}:${pacificDate}`,
    staleAfterMs: 10 * 60 * 1000,
    retryStatuses: ['FAILED', 'PARTIAL'],
    maxAttempts: 2,
    task: async () => {
      const [connections, locations] = await Promise.all([
        Connection.find({ organizationId: org._id }).lean(),
        Location.find({ organizationId: org._id, status: 'active' }).select('_id name timezone').lean(),
      ]);
      const square = eligibleConnection(connections, 'square');
      const google = eligibleConnection(connections, 'google');

      // Locations are independent and normally few (Gourmet Palace has a small
      // fixed store set), so run them in parallel. Provider-level locks protect
      // against overlap with manual refreshes.
      const locationSettled = await Promise.all(locations.map(async (loc) => {
        try {
          const outcome = await runDailyRefresh({ org, loc, square, google, pacificDate, now, allowRetry: true });
          return { locationId: String(loc._id), name: loc.name, status: outcome.status, result: outcome.result || {} };
        } catch (err) {
          const error = errorMessage(err);
          console.error('[daily:location]', loc.name, error);
          return { locationId: String(loc._id), name: loc.name, status: 'FAILED', error };
        }
      }));

      // A partial provider result must not prevent publication. The brief service
      // marks the snapshot PARTIAL and shows source coverage rather than inventing data.
      let briefResult;
      try {
        briefResult = await generateMorningBrief({ org, pacificDate, businessDate: briefBusinessDate });
      } catch (err) {
        briefResult = { status: 'FAILED', error: errorMessage(err) };
        console.error('[daily:brief]', briefResult.error);
      }

      const incomplete = locationSettled.some((row) => row.status !== 'COMPLETE') || briefResult.status === 'FAILED';
      return {
        jobStatus: incomplete ? 'PARTIAL' : 'COMPLETE',
        result: {
          pacificDate,
          businessDate: briefBusinessDate,
          locations: locationSettled,
          brief: briefResult,
        },
      };
    },
  });
}

/**
 * One logical Vercel daily job.
 *
 * Vercel schedules are UTC. Two *daily* lightweight triggers (12:00 and 13:00
 * UTC) hit the same endpoint. This DST-aware guard means only the invocation
 * that is exactly 05:xx in America/Los_Angeles performs provider work; the
 * other exits immediately. This avoids an always-on worker and keeps the
 * business schedule correct across PDT/PST.
 */
async function runVercelDaily(options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const pt = pacificScheduleState(now);
  const enforcePacificHour = options.enforcePacificHour !== false;
  if (enforcePacificHour && pt.hour !== 5) {
    return { skipped: true, reason: 'not_5am_pacific', pacificDate: pt.date, pacificHour: pt.hour, pacificMinute: pt.minute };
  }

  const orgs = await Organization.find({}).select('_id').lean();
  const organizations = await Promise.all(orgs.map(async (org) => {
    try {
      const outcome = await runOrganizationDaily({ org, pacificDate: pt.date, now });
      return { organizationId: String(org._id), status: outcome.status, result: outcome.result || {} };
    } catch (err) {
      return { organizationId: String(org._id), status: 'FAILED', error: errorMessage(err) };
    }
  }));

  return {
    skipped: false,
    pacificDate: pt.date,
    pacificHour: pt.hour,
    businessDate: addDays(pt.date, -1),
    status: organizations.some((row) => row.status !== 'COMPLETE') ? 'PARTIAL' : 'COMPLETE',
    organizations,
  };
}

async function runManualRefresh({ organizationId, locationId }) {
  if (!locationId) throw Object.assign(new Error('locationId is required'), { statusCode: 400 });
  const loc = await Location.findOne({ _id: locationId, organizationId, status: 'active' }).select('_id name timezone').lean();
  if (!loc) throw Object.assign(new Error('Active location not found'), { statusCode: 404 });
  const connections = await Connection.find({ organizationId }).lean();
  const square = eligibleConnection(connections, 'square');
  const google = eligibleConnection(connections, 'google');
  const businessDate = priorBusinessDate(loc.timezone || 'America/Los_Angeles', 4, new Date());

  const sources = {};
  const errors = {};
  const tasks = [];
  if (square) tasks.push(settleSource('square', () => integrations.squareManualSync({ organizationId, locationId })));
  else sources.square = { status: 'UNAVAILABLE', message: 'Square is not connected.' };
  if (google) tasks.push(settleSource('google', () => integrations.googleManualSync({ organizationId, locationId })));
  else sources.google = { status: 'UNAVAILABLE', message: 'Google is not connected.' };

  for (const result of await Promise.all(tasks)) {
    if (!result.ok) {
      errors[result.name] = result.error;
      sources[result.name] = { status: 'FAILED', error: result.error };
    } else {
      sources[result.name] = { status: 'COMPLETE', result: result.value };
      if (result.name === 'google') {
        const googleErrors = result.value?.errors || {};
        if (Object.keys(googleErrors).length || Object.values(result.value?.sources || {}).some((row) => ['ERROR', 'PARTIAL', 'NO_DATA', 'UNMAPPED'].includes(row.status))) {
          sources.google.status = 'PARTIAL';
          for (const [key, message] of Object.entries(googleErrors)) errors[`google.${key}`] = message;
        }
      }
      if (result.name === 'square' && !squareResultComplete(result.value)) {
        sources.square.status = 'PARTIAL';
        errors.square = 'Square refresh completed but reconciliation/payment/source-close checks are incomplete.';
      }
    }
  }

  try {
    await alerts.evaluateLocation({ organizationId, locationId, businessDate });
    sources.alerts = { status: 'COMPLETE' };
  } catch (err) {
    errors.alerts = errorMessage(err);
    sources.alerts = { status: 'FAILED', error: errors.alerts };
  }

  const providerSources = ['square', 'google'].map((name) => sources[name]).filter(Boolean);
  const availableProviders = providerSources.filter((row) => row.status !== 'UNAVAILABLE');
  let status;
  if (availableProviders.length === 0) status = 'UNAVAILABLE';
  else if (availableProviders.every((row) => row.status === 'COMPLETE') && sources.alerts?.status === 'COMPLETE') status = 'COMPLETE';
  else if (availableProviders.some((row) => row.status === 'COMPLETE' || row.status === 'PARTIAL')) status = 'PARTIAL';
  else status = 'FAILED';

  return { locationId: String(locationId), businessDate, status, sources, errors };
}

module.exports = {
  runVercelDaily,
  runDailyRefresh,
  generateMorningBrief,
  runManualRefresh,
  priorBusinessDate,
  zonedParts,
};
