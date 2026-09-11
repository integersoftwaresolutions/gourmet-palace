const { recordGoogleAttempt } = require('../../workers/googleAttempt');
const SyncState = require('../../models/GoogleSyncState');
const { withGoogleLock } = require('../../workers/googleLock');
const Connection = require('../../models/Connection');
const Location = require('../../models/Location');
const SeoMetric = require('../../models/SeoMetric');
const Review = require('../../models/Review');
const JobRun = require('../../models/JobRun');
const ApiError = require('../../utils/ApiError');
const env = require('../../config/env');
const secrets = require('../../services/providerSecrets');
const { parseRange, addDays, todayUtc } = require('../../utils/dateRange');

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/business.manage',
];

function publicConnection(c) {
  if (!c) return null;
  const o = c.toJSON ? c.toJSON() : c;
  delete o.accessTokenEnc;
  delete o.refreshTokenEnc;
  delete o.secretRef;
  return o;
}

async function googleConnect(req) {
  if (!env.google.clientId || !env.google.clientSecret) throw new ApiError(503, 'Google OAuth is not configured on the server');
  const state = require('crypto').randomBytes(24).toString('base64url');
  req.session.oauthState = { provider: 'google', state, createdAt: Date.now() };
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', env.google.clientId);
  url.searchParams.set('redirect_uri', env.google.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', state);
  return url.toString();
}

function verifyState(req, provider, state) {
  const s = req.session.oauthState;
  if (!s || s.provider !== provider || s.state !== state || Date.now() - s.createdAt > 10 * 60 * 1000) {
    throw new ApiError(400, 'Invalid or expired OAuth state');
  }
  delete req.session.oauthState;
}

async function googleCallback(req, organizationId, code, state) {
  verifyState(req, 'google', state);
  const body = new URLSearchParams({
    client_id: env.google.clientId,
    client_secret: env.google.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: env.google.redirectUri,
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    signal: AbortSignal.timeout(Number(env.providerHttpTimeoutMs) || 12000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new ApiError(502, `Google OAuth failed: ${data.error_description || data.error || res.status}`);
  const prior = await Connection.findOne({ organizationId, provider: 'google' }).select('+secretRef');
  let priorSecret = null;
  if (prior?.secretRef && !data.refresh_token) {
    try { priorSecret = await secrets.get(prior.secretRef); } catch { priorSecret = null; }
  }
  const secretRef = await secrets.put(organizationId, 'google', {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || priorSecret?.refreshToken || '',
    expiresAt: data.expires_in ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString() : null,
    tokenType: data.token_type || 'Bearer',
    scope: data.scope || GOOGLE_SCOPES.join(' '),
  });
  const scopes = String(data.scope || '').split(/\s+/).filter(Boolean);
  await Connection.findOneAndUpdate(
    { organizationId, provider: 'google' },
    {
      $set: {
        status: 'PARTIAL',
        secretRef,
        expiresAt: data.expires_in ? new Date(Date.now() + Number(data.expires_in) * 1000) : null,
        scopes,
        capabilities: {
          ga4: scopes.some((s) => s.includes('analytics')),
          gsc: scopes.some((s) => s.includes('webmasters')),
          gbp: scopes.some((s) => s.includes('business')),
        },
        lastError: null,
      },
      $unset: { accessTokenEnc: 1, refreshTokenEnc: 1 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return discoverGoogle(organizationId);
}

async function refreshGoogle(conn, secret) {
  if (!secret.refreshToken) return { conn, secret };
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    signal: AbortSignal.timeout(Number(env.providerHttpTimeoutMs) || 12000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.google.clientId,
      client_secret: env.google.clientSecret,
      refresh_token: secret.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(`Google refresh failed (${res.status}): ${data.error_description || data.error || 'provider error'}`);
  const next = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || secret.refreshToken,
    expiresAt: data.expires_in ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString() : secret.expiresAt,
    tokenType: data.token_type || secret.tokenType || 'Bearer',
    scope: data.scope || secret.scope,
  };
  await secrets.update(conn.secretRef, next);
  conn.expiresAt = next.expiresAt ? new Date(next.expiresAt) : conn.expiresAt;
  await conn.save();
  return { conn, secret: next };
}

async function getGoogleAccessToken(organizationId) {
  let conn = await Connection.findOne({ organizationId, provider: 'google' }).select('+secretRef');
  if (!conn?.secretRef) throw new ApiError(409, 'Google is not connected');
  let secret = await secrets.get(conn.secretRef);
  if (!secret.accessToken) throw new ApiError(409, 'Google credentials are unavailable');
  if (conn.expiresAt && new Date(conn.expiresAt).getTime() - Date.now() < 5 * 60 * 1000) {
    ({ conn, secret } = await refreshGoogle(conn, secret));
  }
  return { conn, token: secret.accessToken };
}

async function googleFetch(token, url, options = {}) {
  const res = await fetch(url, {
    ...options,
    signal: options.signal || AbortSignal.timeout(Number(env.providerHttpTimeoutMs) || 12000),
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.error?.message || data.error_description || data.error || `Google ${url} failed (${res.status})`;
    const err = new Error(String(message).slice(0, 500));
    err.status = res.status;
    throw err;
  }
  return data;
}

async function discoverGoogle(organizationId) {
  const { conn, token } = await getGoogleAccessToken(organizationId);
  const errors = {};
  const metadata = { ...(conn.metadata || {}) };
  const capabilities = { ...(conn.capabilities || {}) };

  try {
    const summaries = await googleFetch(token, 'https://analyticsadmin.googleapis.com/v1beta/accountSummaries');
    metadata.ga4Properties = (summaries.accountSummaries || []).flatMap((account) =>
      (account.propertySummaries || []).map((p) => ({
        id: String(p.property || '').replace('properties/', ''),
        name: p.property,
        displayName: p.displayName || p.property,
        account: account.displayName || account.account,
      })),
    );
    capabilities.ga4 = true;
  } catch (err) {
    capabilities.ga4 = false;
    errors.ga4 = err.message;
  }

  try {
    const sites = await googleFetch(token, 'https://searchconsole.googleapis.com/webmasters/v3/sites');
    metadata.gscSites = (sites.siteEntry || []).map((s) => ({ siteUrl: s.siteUrl, permissionLevel: s.permissionLevel }));
    capabilities.gsc = true;
  } catch (err) {
    capabilities.gsc = false;
    errors.gsc = err.message;
  }

  try {
    const accounts = await googleFetch(token, 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts');
    metadata.gbpAccounts = (accounts.accounts || []).map((a) => ({ name: a.name, accountName: a.accountName || a.name }));
    const gbpLocations = [];
    for (const account of metadata.gbpAccounts) {
      try {
        const locs = await googleFetch(
          token,
          `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress&pageSize=100`,
        );
        for (const loc of locs.locations || []) {
          gbpLocations.push({
            name: loc.name,
            title: loc.title || loc.name,
            accountName: account.name,
          });
        }
      } catch (err) {
        errors[`gbp:${account.name}`] = err.message;
      }
    }
    metadata.gbpLocations = gbpLocations;
    capabilities.gbp = gbpLocations.length > 0 || !errors.gbp;
  } catch (err) {
    capabilities.gbp = false;
    errors.gbp = err.message;
  }

  conn.metadata = metadata;
  conn.capabilities = capabilities;
  conn.lastSuccessAt = new Date();
  const failed = Object.keys(errors);
  conn.status = failed.length ? 'PARTIAL' : 'READY';
  conn.lastError = failed.length ? JSON.stringify(errors).slice(0, 1000) : null;
  await conn.save();
  return publicConnection(conn);
}

function daysInRange(from, to) {
  const days = [];
  let cursor = from;
  while (cursor <= to) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
    if (days.length > 370) break;
  }
  return days;
}

async function upsertSeo({ organizationId, locationId, businessDate, source, metrics, status, error }) {
  return SeoMetric.findOneAndUpdate(
    { organizationId, locationId, businessDate, source },
    {
      metrics: metrics || {},
      status,
      ingestTimestamp: new Date(),
      freshnessAt: status === 'COMPLETE' ? new Date() : null,
      ...(error ? { dimensions: { error: String(error).slice(0, 400) } } : {}),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function syncGa4({ token, organizationId, locationId, propertyId, from, to }) {
  const data = await googleFetch(token, `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{ startDate: from, endDate: to }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'keyEvents' }],
    }),
  });
  const byDate = new Map();
  for (const row of data.rows || []) {
    const raw = String(row.dimensionValues?.[0]?.value || '');
    const businessDate = raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw;
    const values = row.metricValues || [];
    byDate.set(businessDate, {
      sessions: Number(values[0]?.value || 0),
      totalUsers: Number(values[1]?.value || 0),
      keyEvents: Number(values[2]?.value || 0),
    });
  }
  for (const businessDate of daysInRange(from, to)) {
    const metrics = byDate.get(businessDate);
    await upsertSeo({
      organizationId,
      locationId,
      businessDate,
      source: 'ga4',
      metrics: metrics || { sessions: 0, totalUsers: 0, keyEvents: 0 },
      status: metrics ? 'COMPLETE' : 'UNAVAILABLE',
    });
  }
  return byDate.size;
}

async function syncGsc({ token, organizationId, locationId, siteUrl, from, to }) {
  const data = await googleFetch(
    token,
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: from, endDate: to, dimensions: ['date'] }),
    },
  );
  const byDate = new Map();
  for (const row of data.rows || []) {
    byDate.set(row.keys?.[0], {
      clicks: Number(row.clicks || 0),
      impressions: Number(row.impressions || 0),
      ctr: Number(row.ctr || 0),
      position: Number(row.position || 0),
    });
  }
  for (const businessDate of daysInRange(from, to)) {
    const metrics = byDate.get(businessDate);
    await upsertSeo({
      organizationId,
      locationId,
      businessDate,
      source: 'gsc',
      metrics: metrics || { clicks: 0, impressions: 0, ctr: 0, position: 0 },
      status: metrics ? 'COMPLETE' : 'UNAVAILABLE',
    });
  }
  return byDate.size;
}

async function syncGbpPerformance({ token, organizationId, locationId, gbpLocationName, from, to }) {
  const daily = await googleFetch(
    token,
    `https://businessprofileperformance.googleapis.com/v1/${gbpLocationName}:fetchMultiDailyMetricsTimeSeries?dailyMetrics=WEBSITE_CLICKS&dailyMetrics=CALL_CLICKS&dailyMetrics=BUSINESS_DIRECTION_REQUESTS&dailyMetrics=BUSINESS_IMPRESSIONS_DESKTOP_MAPS&dailyMetrics=BUSINESS_IMPRESSIONS_MOBILE_SEARCH&dailyRange.start_date.year=${from.slice(0, 4)}&dailyRange.start_date.month=${Number(from.slice(5, 7))}&dailyRange.start_date.day=${Number(from.slice(8, 10))}&dailyRange.end_date.year=${to.slice(0, 4)}&dailyRange.end_date.month=${Number(to.slice(5, 7))}&dailyRange.end_date.day=${Number(to.slice(8, 10))}`,
  );

  const byDate = new Map();
  for (const series of daily?.multiDailyMetricTimeSeries || []) {
    for (const metricSeries of series.dailyMetricTimeSeries || []) {
      const key = String(metricSeries.dailyMetric || '').toLowerCase();
      for (const point of metricSeries.timeSeries?.datedValues || []) {
        const d = point.date;
        if (!d?.year) continue;
        const businessDate = `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
        const cur = byDate.get(businessDate) || {};
        cur[key] = Number(point.value || 0);
        byDate.set(businessDate, cur);
      }
    }
  }
  for (const businessDate of daysInRange(from, to)) {
    const metrics = byDate.get(businessDate);
    await upsertSeo({
      organizationId,
      locationId,
      businessDate,
      source: 'gbp',
      metrics: metrics || {},
      status: metrics ? 'COMPLETE' : 'UNAVAILABLE',
    });
  }
  return byDate.size;
}

async function syncGbpReviews({ token, organizationId, locationId, gbpLocationName }) {
  const state = await SyncState.findOne({ organizationId, locationId }).lean();
  const saved = state?.reviews?.provider === gbpLocationName ? state.reviews : {};
  const fullScan = !saved.lastFullAt || Date.now() - new Date(saved.lastFullAt).getTime() > 30 * 86400000;
  const checkpoint = saved.checkpoint || { cutoff: fullScan ? null : saved.watermark, newest: saved.watermark || null, fullScan };
  let pageToken = checkpoint.pageToken;
  let reachedCutoff = false;
  let pages = 0;
  let reviewsImported = 0;
  do {
    const q = new URLSearchParams({ pageSize: '50', orderBy: 'updateTime desc' });
    if (pageToken) q.set('pageToken', pageToken);
    let data;
    try { data = await googleFetch(token, `https://mybusiness.googleapis.com/v4/${gbpLocationName}/reviews?${q}`); }
    catch (error) {
      if (pageToken && error.status === 400) await SyncState.updateOne({ organizationId, locationId }, { $unset: { 'reviews.checkpoint': 1 } });
      throw error;
    }
    pages += 1;
    for (const review of data.reviews || []) {
      const updated = review.updateTime || review.createTime;
      if (updated && checkpoint.cutoff && new Date(updated).getTime() < new Date(checkpoint.cutoff).getTime() - 86400000) {
        reachedCutoff = true;
        break;
      }
      if (updated && (!checkpoint.newest || new Date(updated) > new Date(checkpoint.newest))) checkpoint.newest = updated;
      const providerReviewId = String(review.reviewId || review.name || '').split('/').pop();
      if (!providerReviewId) continue;
      const star = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }[review.starRating] || Number(review.starRating) || null;
      await Review.findOneAndUpdate(
        { organizationId, provider: 'google', providerReviewId },
        {
          locationId,
          providerLocationName: gbpLocationName,
          rating: star,
          text: review.comment || '',
          reviewerName: review.reviewer?.displayName || '',
          reviewedAt: review.createTime ? new Date(review.createTime) : null,
          providerUpdatedAt: review.updateTime ? new Date(review.updateTime) : null,
          ingestTimestamp: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      reviewsImported += 1;
    }
    pageToken = reachedCutoff ? null : data.nextPageToken;
    await SyncState.updateOne({ organizationId, locationId }, { $set: { reviews: {
      provider: gbpLocationName,
      watermark: pageToken ? saved.watermark : checkpoint.newest,
      lastFullAt: !pageToken && checkpoint.fullScan ? new Date().toISOString() : saved.lastFullAt,
      checkpoint: pageToken ? { ...checkpoint, pageToken } : null,
    } } });
  } while (pageToken && pages < 3);
  return { reviewsImported, pages, hasMore: Boolean(pageToken) };
}

function uniqueGoogleRunKey({ organizationId, locationId, jobType, from = '', to = '' }) {
  return `google:${jobType}:${organizationId}:${locationId}:${from}:${to}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

async function priorIdempotentResult(idempotencyKey, { retryIncomplete = false } = {}) {
  if (!idempotencyKey) return null;
  const existing = await JobRun.findOne({ idempotencyKey }).lean();
  if (!existing) return null;
  if (existing.status === 'COMPLETE') {
    return { ...(existing.result || {}), skipped: true, skipReason: 'already_completed' };
  }
  if (!retryIncomplete && ['PARTIAL', 'UNAVAILABLE', 'FAILED'].includes(existing.status)) {
    return { ...(existing.result || {}), skipped: true, skipReason: 'already_attempted' };
  }
  if (existing.status === 'RUNNING' && Date.now() - new Date(existing.startedAt || 0).getTime() < 45 * 60 * 1000) {
    return { ...(existing.result || {}), skipped: true, skipReason: 'already_running' };
  }
  return null;
}

async function googleSyncUnlocked({
  organizationId,
  locationId,
  preset = '7d',
  from,
  to,
  includeReviews = true,
  jobType = 'google_sync',
  idempotencyKey = null,
  force = false,
  retryIncomplete = false,
}) {
  const loc = await Location.findOne({ _id: locationId, organizationId, status: 'active' });
  if (!loc) throw new ApiError(404, 'Active location not found');
  const range = parseRange({ preset, from, to });
  if (idempotencyKey && !force) {
    const prior = await priorIdempotentResult(idempotencyKey, { retryIncomplete });
    if (prior) return prior;
  }

  const { conn, token } = await getGoogleAccessToken(organizationId);
  const mapping = conn.mappings?.locations?.[String(locationId)] || {};
  const idem = idempotencyKey || uniqueGoogleRunKey({ organizationId, locationId, jobType, from: range.from, to: range.to });
  const job = await JobRun.findOneAndUpdate(
    { idempotencyKey: idem },
    {
      $set: {
        organizationId,
        source: 'google',
        locationId,
        businessDate: range.to,
        jobType,
        status: 'RUNNING',
        startedAt: new Date(),
        finishedAt: null,
        error: null,
      },
      $inc: { attempts: 1 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const errors = {};
  const sources = {};
  try {
    const sourceTasks = [
      { source: 'ga4', mapped: mapping.ga4PropertyId, run: () => syncGa4({ token, organizationId, locationId, propertyId: mapping.ga4PropertyId, from: range.from, to: range.to }) },
      { source: 'gsc', mapped: mapping.gscSiteUrl, run: () => syncGsc({ token, organizationId, locationId, siteUrl: mapping.gscSiteUrl, from: range.from, to: range.to }) },
      { source: 'gbp', mapped: mapping.gbpLocationName, run: () => syncGbpPerformance({ token, organizationId, locationId, gbpLocationName: mapping.gbpLocationName, from: range.from, to: range.to }) },
    ];
    if (includeReviews) sourceTasks.push({ source: 'reviews', mapped: mapping.gbpLocationName, run: () => syncGbpReviews({ token, organizationId, locationId, gbpLocationName: mapping.gbpLocationName }) });

    await Promise.all(sourceTasks.map(async ({ source, mapped, run }) => {
      const priorStatus = job.result?.sources?.[source]?.status;
      if (retryIncomplete && priorStatus === 'IMPORTED') {
        sources[source] = job.result.sources[source];
        return;
      }
      if (!mapped) {
        if (source === 'reviews') {
          sources.reviews = { status: 'UNMAPPED', reviewsImported: 0, pages: 0 };
        } else {
          sources[source] = { status: 'UNMAPPED', daysImported: 0 };
          await Promise.all(daysInRange(range.from, range.to).map((businessDate) => upsertSeo({ organizationId, locationId, businessDate, source, status: 'UNAVAILABLE' })));
        }
        return;
      }
      try {
        const result = await run();
        if (source === 'reviews') sources.reviews = { status: result.hasMore ? 'PARTIAL' : 'IMPORTED', ...result };
        else sources[source] = { status: result ? 'IMPORTED' : 'NO_DATA', daysImported: result };
      } catch (err) {
        errors[source] = err.message;
        sources[source] = source === 'reviews'
          ? { status: 'ERROR', reviewsImported: 0, pages: 0 }
          : { status: 'ERROR', daysImported: 0 };
      }
    }));

    const imported = Object.values(sources).some((source) => source.status === 'IMPORTED');
    const complete = Object.values(sources).every((source) => source.status === 'IMPORTED');
    if (imported) conn.lastSuccessAt = new Date();
    const syncMeta = { ...((conn.metadata || {}).sync || {}) };
    syncMeta.analyticsLastAttemptAt = new Date().toISOString();
    if (includeReviews) syncMeta.reviewsLastAttemptAt = new Date().toISOString();
    if (sources.reviews?.status === 'IMPORTED') syncMeta.reviewsLastSuccessAt = new Date().toISOString();
    if (['IMPORTED', 'NO_DATA'].includes(sources.ga4?.status) || ['IMPORTED', 'NO_DATA'].includes(sources.gsc?.status) || ['IMPORTED', 'NO_DATA'].includes(sources.gbp?.status)) {
      syncMeta.analyticsLastSuccessAt = new Date().toISOString();
    }
    conn.metadata = { ...(conn.metadata || {}), sync: syncMeta };
    conn.status = complete ? 'READY' : 'PARTIAL';
    conn.lastError = Object.keys(errors).length ? JSON.stringify(errors).slice(0, 1000) : null;
    await conn.save();

    const result = { range, errors, mapped: mapping, sources };
    job.status = complete ? 'COMPLETE' : 'PARTIAL';
    job.result = result;
    job.finishedAt = new Date();
    job.history = [...(job.history || []), { attempt: job.attempts, startedAt: job.startedAt, finishedAt: job.finishedAt, status: job.status, error: job.error, result: job.result }];
    await job.save();
    return result;
  } catch (err) {
    job.status = 'FAILED';
    job.error = err.message;
    job.finishedAt = new Date();
    job.history = [...(job.history || []), { attempt: job.attempts, startedAt: job.startedAt, finishedAt: job.finishedAt, status: job.status, error: job.error, result: job.result }];
    await job.save();
    conn.status = 'ERROR';
    conn.lastError = err.message;
    await conn.save();
    throw err;
  }
}

async function googleReviewsSyncUnlocked({ organizationId, locationId, idempotencyKey = null }) {
  const loc = await Location.findOne({ _id: locationId, organizationId, status: 'active' });
  if (!loc) throw new ApiError(404, 'Active location not found');
  if (idempotencyKey) {
    const prior = await priorIdempotentResult(idempotencyKey);
    if (prior) return prior;
  }
  const { conn, token } = await getGoogleAccessToken(organizationId);
  const mapping = conn.mappings?.locations?.[String(locationId)] || {};
  if (!mapping.gbpLocationName) return { status: 'UNMAPPED', reviewsImported: 0, pages: 0 };

  const idem = idempotencyKey || uniqueGoogleRunKey({ organizationId, locationId, jobType: 'google_reviews_sync' });
  const job = await JobRun.findOneAndUpdate(
    { idempotencyKey: idem },
    { $set: { organizationId, source: 'google', locationId, businessDate: todayUtc(), jobType: 'google_reviews_sync', status: 'RUNNING', startedAt: new Date(), finishedAt: null, error: null }, $inc: { attempts: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  try {
    const result = await syncGbpReviews({ token, organizationId, locationId, gbpLocationName: mapping.gbpLocationName });
    const now = new Date();
    const syncMeta = { ...((conn.metadata || {}).sync || {}), reviewsLastAttemptAt: now.toISOString(), reviewsLastSuccessAt: now.toISOString() };
    conn.metadata = { ...(conn.metadata || {}), sync: syncMeta };
    conn.lastSuccessAt = now;
    await conn.save();
    job.status = result.hasMore ? 'PARTIAL' : 'COMPLETE';
    job.result = { status: result.hasMore ? 'PARTIAL' : 'IMPORTED', ...result };
    job.finishedAt = now;
    job.history = [...(job.history || []), { attempt: job.attempts, startedAt: job.startedAt, finishedAt: now, status: job.status, result: job.result }];
    await job.save();
    return job.result;
  } catch (err) {
    const now = new Date();
    const syncMeta = { ...((conn.metadata || {}).sync || {}), reviewsLastAttemptAt: now.toISOString(), reviewsLastError: String(err.message || err).slice(0, 400) };
    conn.metadata = { ...(conn.metadata || {}), sync: syncMeta };
    await conn.save().catch(() => {});
    job.status = 'FAILED';
    job.error = String(err.message || err).slice(0, 1000);
    job.finishedAt = now;
    job.history = [...(job.history || []), { attempt: job.attempts, startedAt: job.startedAt, finishedAt: now, status: job.status, error: job.error }];
    await job.save().catch(() => {});
    throw err;
  }
}

function completedDateForTimeZone(timeZone, cutoffHour = 4, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const localDate = `${p.year}-${p.month}-${p.day}`;
  return addDays(localDate, Number(p.hour) < cutoffHour ? -2 : -1);
}

async function googleManualSyncUnlocked({ organizationId, locationId }) {
  const loc = await Location.findOne({ _id: locationId, organizationId, status: 'active' }).select('timezone');
  if (!loc) throw new ApiError(404, 'Active location not found');
  const to = completedDateForTimeZone(loc.timezone || 'America/Los_Angeles');
  const from = addDays(to, -2);
  const slot = Date.now();
  return googleSyncUnlocked({
    organizationId,
    locationId,
    from,
    to,
    includeReviews: true,
    jobType: 'google_manual_sync',
    idempotencyKey: `google:manual:${organizationId}:${locationId}:${slot}`,
  });
}

async function googleHistoricalSyncUnlocked({ organizationId, locationId, from, to }) {
  const range = parseRange({ from, to });
  const days = daysInRange(range.from, range.to);
  if (days.length > 90) throw new ApiError(400, 'Google historical refresh is limited to 90 days per request');
  return googleSyncUnlocked({
    organizationId,
    locationId,
    from: range.from,
    to: range.to,
    includeReviews: false,
    jobType: 'google_historical_refresh',
  });
}

function trackedSync(args, jobType, task, manual = false) {
  return recordGoogleAttempt(args, jobType, async (stage) => {
    await stage('validating');
    if (!args.locationId) throw new ApiError(400, 'locationId is required');
    await stage('acquiring_lock');
    return withGoogleLock({ ...args, manual }, async () => {
      await stage('authentication_and_sync');
      return task(args);
    });
  });
}
function googleSync(args) { return trackedSync(args, args.jobType || 'google_sync', googleSyncUnlocked); }
function googleReviewsSync(args) { return trackedSync(args, 'google_reviews_sync', googleReviewsSyncUnlocked); }
function googleManualSync(args) { return trackedSync(args, 'google_manual_sync', googleManualSyncUnlocked, true); }
function googleHistoricalSync(args) {
  return trackedSync(args, 'google_historical_refresh', async (input) => {
    if (!input.from || !input.to) throw new ApiError(400, 'from and to are required');
    return googleHistoricalSyncUnlocked(input);
  });
}

module.exports = {
  googleConnect,
  googleCallback,
  discoverGoogle,
  googleSync,
  googleReviewsSync,
  googleManualSync,
  googleHistoricalSync,
  getGoogleAccessToken,
};
