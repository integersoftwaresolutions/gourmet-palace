'use strict';

/**
 * Vercel catch-all — every /api/* request becomes this function.
 * Express continues to mount routes at /api/v1.
 */
const { connectDB } = require('../backend/src/config/db');
const app = require('../backend/src/app');

module.exports = async (req, res) => {
  await connectDB();

  // Normalize rare cases where the /api prefix was stripped by the platform router.
  if (typeof req.url === 'string' && !req.url.startsWith('/api')) {
    const suffix = req.url.startsWith('/') ? req.url : `/${req.url}`;
    req.url = `/api${suffix}`;
  }

  return app(req, res);
};
