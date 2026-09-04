const ApiError = require('../utils/ApiError');
const env = require('../config/getEnv')();

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
function normalizedOrigins() {
  return new Set(
    [env.corsOrigin, env.appUrl, process.env.CORS_ORIGIN, process.env.APP_URL, process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`]
      .filter(Boolean)
      .flatMap((value) => String(value).split(','))
      .map((value) => value.trim().replace(/\/$/, '')),
  );
}

module.exports = function originGuard(req, res, next) {
  if (SAFE.has(req.method)) return next();
  const origin = req.get('origin');
  // Non-browser workers/webhooks may not send Origin and must authenticate using their
  // own server-side/session/secret boundary. Modern browser unsafe requests do send it.
  if (!origin) return next();
  if (!normalizedOrigins().has(origin.replace(/\/$/, ''))) return next(new ApiError(403, 'Request origin is not allowed'));
  return next();
};
