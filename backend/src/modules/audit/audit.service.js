const AuditEvent = require('../../models/AuditEvent');

/**
 * Persist a high-risk / auth audit event. Never throws to callers —
 * audit failure must not break the primary request.
 */
async function record({
  type,
  result,
  correlationId,
  actorUserId = null,
  targetUserId = null,
  organizationId = null,
  ip = null,
  userAgent = null,
  meta = null,
}) {
  try {
    await AuditEvent.create({
      type,
      result,
      correlationId: correlationId || 'unknown',
      actorUserId,
      targetUserId,
      organizationId,
      ip,
      userAgent,
      meta,
    });
  } catch (err) {
    console.error('[audit] failed to record event', type, err.message);
  }
}

module.exports = {
  record,
};
