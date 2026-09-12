const { randomUUID } = require('crypto');
const State = require('../models/GoogleSyncState');
const ApiError = require('../utils/ApiError');
const env = require('../config/getEnv')();

async function withGoogleLock({ organizationId, locationId, manual = false }, task) {
  await State.init();
  const owner = randomUUID();
  const now = new Date();
  const filter = { organizationId, locationId, $or: [{ leaseUntil: { $lte: now } }, { leaseUntil: null }] };
  if (manual) filter.$and = [{ $or: [{ manualNextAt: { $lte: now } }, { manualNextAt: null }] }];
  const patch = { owner, leaseUntil: new Date(Date.now() + 600000) };
  if (manual) patch.manualNextAt = new Date(Date.now() + env.googleManualSyncCooldownMinutes * 60000);
  let claimed;
  try {
    claimed = await State.findOneAndUpdate(filter, { $set: patch }, { upsert: true, new: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  if (!claimed) throw new ApiError(429, 'Google sync is already running or the manual refresh cooldown is active. Try again later.');
  const heartbeat = setInterval(() => {
    State.updateOne({ organizationId, locationId, owner }, { $set: { leaseUntil: new Date(Date.now() + 600000) } }).catch(console.error);
  }, 30000);
  heartbeat.unref();
  try { return await task(); }
  finally {
    clearInterval(heartbeat);
    await State.updateOne({ organizationId, locationId, owner }, { $set: { leaseUntil: new Date(0) }, $unset: { owner: 1 } });
  }
}
module.exports = { withGoogleLock };
