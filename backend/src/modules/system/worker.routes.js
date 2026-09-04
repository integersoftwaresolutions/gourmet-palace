const { Router } = require('express');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const { runCycle } = require('../../workers/daily.worker');

const router = Router();

function assertWorkerAuthorized(req) {
  const secret = process.env.CRON_SECRET || process.env.WORKER_SECRET;
  if (!secret) throw new ApiError(503, 'CRON_SECRET (or WORKER_SECRET) is not configured');

  const auth = req.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const headerSecret = req.get('x-worker-secret') || '';
  if (bearer !== secret && headerSecret !== secret) {
    throw new ApiError(401, 'Unauthorized');
  }
}

async function tick(req, res) {
  assertWorkerAuthorized(req);
  await runCycle();
  ApiResponse.send(res, { message: 'Worker cycle completed', data: { ok: true, at: new Date().toISOString() } });
}

/** Vercel Cron invokes GET; allow POST for manual/ops triggers. */
router.get('/tick', asyncHandler(tick));
router.post('/tick', asyncHandler(tick));

module.exports = router;
