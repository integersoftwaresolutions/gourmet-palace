const { Router } = require('express');
const mongoose = require('mongoose');
const ApiResponse = require('../utils/ApiResponse');

const router = Router();

router.get('/health', (req, res) => ApiResponse.send(res, {
  message: 'OK',
  data: { service: 'gourmet-palace-api', uptime: process.uptime(), now: new Date().toISOString() },
}));
router.get('/health/ready', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  if (!ready) return res.status(503).json({ success: false, message: 'Database not ready', data: null, meta: null, errors: null });
  return ApiResponse.send(res, { message: 'READY', data: { database: 'connected', now: new Date().toISOString() } });
});

router.use('/auth', require('../modules/auth/auth.routes'));
router.use('/locations', require('../modules/locations/locations.routes'));
router.use('/users', require('../modules/users/users.routes'));
router.use('/settings', require('../modules/settings/settings.routes'));
router.use('/analytics', require('../modules/analytics/analytics.routes'));
router.use('/briefs', require('../modules/briefs/briefs.routes'));
router.use('/integrations', require('../modules/integrations/integrations.routes'));
router.use('/system/worker', require('../modules/system/worker.routes'));
router.use('/system', require('../modules/system/system.routes'));
router.use('/export', require('../modules/export/export.routes'));

module.exports = router;
