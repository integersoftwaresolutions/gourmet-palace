const { Router } = require('express');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const { runVercelDaily } = require('../../workers/daily.worker');
const env = require('../../config/getEnv')();

const router = Router();

function assertCronAuthorized(req) {
  const secret = env.cronSecret;
  if (!secret) throw new ApiError(503, 'CRON_SECRET is not configured');
  const auth = req.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const headerSecret = req.get('x-cron-secret') || '';
  if (bearer !== secret && headerSecret !== secret) throw new ApiError(401, 'Unauthorized');
}

async function daily(req, res) {
  assertCronAuthorized(req);
  const result = await runVercelDaily({
    enforcePacificHour: req.method === 'GET',
  });
  return ApiResponse.send(res, {
    message: result.skipped ? 'Cron trigger skipped outside 5 AM Pacific' : 'Daily Vercel refresh completed',
    data: { ok: true, ...result, at: new Date().toISOString() },
  });
}

// Vercel Cron invokes GET. POST is an authenticated operational retry and can
// be called manually with CRON_SECRET; idempotency prevents duplicate complete runs.
router.get('/daily', asyncHandler(daily));
router.post('/daily', asyncHandler(daily));

module.exports = router;
