const { Router } = require('express');
const ApiResponse = require('../../utils/ApiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate, requireAdmin } = require('../../middlewares/auth.middleware');
const svc = require('./integrations.service');
const { parseRange } = require('../../utils/dateRange');
const audit = require('../audit/audit.service');
const { requestMeta } = require('../../utils/requestMeta');
const ApiError = require('../../utils/ApiError');
const env = require('../../config/getEnv')();
const { runManualRefresh } = require('../../workers/daily.worker');

const r = Router();
r.use(authenticate, requireAdmin);

async function log(req, type, meta) {
  await audit.record({ type, result: 'success', actorUserId: req.user.id, organizationId: req.auth.organizationId, ...requestMeta(req), meta });
}

function oauthRedirect(req, res, fn, connected) {
  return asyncHandler(async (innerReq, innerRes) => {
    try {
      await fn(innerReq);
      await log(innerReq, `integration.${connected}.connect`, {});
      innerRes.redirect(`${env.appUrl}/admin/integrations?connected=${connected}`);
    } catch (err) {
      innerRes.redirect(`${env.appUrl}/admin/integrations?error=${encodeURIComponent(String(err.message || err).slice(0, 180))}`);
    }
  })(req, res);
}

r.get('/', asyncHandler(async (req, res) => ApiResponse.send(res, { data: { connections: await svc.list(req.auth.organizationId) } })));
r.post('/:provider/connect', asyncHandler(async (req, res) => {
  if (req.params.provider === 'square') return ApiResponse.send(res, { data: { url: await svc.squareConnect(req) } });
  if (req.params.provider === 'google') return ApiResponse.send(res, { data: { url: await svc.googleConnect(req) } });
  throw new ApiError(400, 'Unsupported provider');
}));
r.get('/square/callback', (req, res) => oauthRedirect(req, res, (inner) => svc.squareCallback(inner, inner.auth.organizationId, inner.query.code, inner.query.state), 'square'));
r.get('/google/callback', (req, res) => oauthRedirect(req, res, (inner) => svc.googleCallback(inner, inner.auth.organizationId, inner.query.code, inner.query.state), 'google'));
r.post('/:provider/discover', asyncHandler(async (req, res) => {
  if (req.params.provider === 'square') return ApiResponse.send(res, { data: { connection: await svc.discoverSquare(req.auth.organizationId) } });
  if (req.params.provider === 'google') return ApiResponse.send(res, { data: { connection: await svc.discoverGoogle(req.auth.organizationId) } });
  throw new ApiError(400, 'Unsupported provider');
}));
r.post('/sync-now', asyncHandler(async (req, res) => {
  if (!req.body.locationId) throw new ApiError(400, 'locationId is required');
  const data = await runManualRefresh({ organizationId: req.auth.organizationId, locationId: req.body.locationId });
  await log(req, 'integration.manual_sync_all', { locationId: req.body.locationId, businessDate: data.businessDate, status: data.status, errors: data.errors });
  ApiResponse.send(res, { data });
}));
r.post('/square/sync', asyncHandler(async (req, res) => {
  const data = await svc.squareSync({ organizationId: req.auth.organizationId, locationId: req.body.locationId, businessDate: req.body.businessDate, force: req.body.force === true });
  await log(req, 'integration.square.manual_sync', { locationId: req.body.locationId, businessDate: req.body.businessDate });
  ApiResponse.send(res, { data });
}));
r.post('/square/backfill', asyncHandler(async (req, res) => {
  const range = parseRange(req.body);
  const data = await svc.squareBackfill({ organizationId: req.auth.organizationId, locationId: req.body.locationId, from: range.from, to: range.to });
  await log(req, 'integration.square.backfill', { locationId: req.body.locationId, from: range.from, to: range.to, complete: data.complete, partial: data.partial, failed: data.failed });
  ApiResponse.send(res, { data });
}));
r.post('/google/sync', asyncHandler(async (req, res) => {
  const data = await svc.googleManualSync({ organizationId: req.auth.organizationId, locationId: req.body.locationId });
  await log(req, 'integration.google.manual_sync', { locationId: req.body.locationId, from: data.range?.from, to: data.range?.to });
  ApiResponse.send(res, { data });
}));
r.post('/google/backfill', asyncHandler(async (req, res) => {
  const data = await svc.googleHistoricalSync({ organizationId: req.auth.organizationId, locationId: req.body.locationId, from: req.body.from, to: req.body.to });
  await log(req, 'integration.google.historical_refresh', { locationId: req.body.locationId, from: data.range?.from, to: data.range?.to });
  ApiResponse.send(res, { data });
}));
r.put('/:provider/mappings', asyncHandler(async (req, res) => {
  const connection = await svc.setMappings(req.auth.organizationId, req.params.provider, req.body.mappings);
  await log(req, 'integration.mapping.update', { provider: req.params.provider, channelsApproved: req.params.provider === 'square' ? req.body.mappings?.channelsApproved : undefined });
  ApiResponse.send(res, { data: { connection } });
}));
r.post('/toast/import', asyncHandler(async (req, res) => {
  const data = await svc.toastImport({ organizationId: req.auth.organizationId, ...req.body });
  await log(req, 'integration.toast.historical_import', {
    locationId: req.body.locationId,
    rows: data.imported,
    skippedSquare: data.skippedSquare,
    dates: data.dates,
    formats: data.formats,
    archiveKey: data.archiveKey,
  });
  ApiResponse.send(res, { data });
}));
module.exports = r;
