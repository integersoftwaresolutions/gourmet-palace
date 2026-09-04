const User = require('../../models/User');
const PasswordResetToken = require('../../models/PasswordResetToken');
const ApiError = require('../../utils/ApiError');
const env = require('../../config/env');
const { hashPassword, comparePassword } = require('../../utils/password');
const { generateRawToken, hashToken } = require('../../utils/tokens');
const { getMailProvider } = require('../mail/mail.provider');
const auditService = require('../audit/audit.service');

const GENERIC_CREDENTIALS = 'Invalid email or password';
const DEACTIVATED_MESSAGE =
  'Your account has been deactivated. Contact your administrator.';
const FORGOT_SUCCESS =
  'If that email is registered, reset instructions will be sent.';

function auditContext(meta = {}) {
  return {
    correlationId: meta.correlationId,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
  };
}

/**
 * Authenticate credentials. Does not touch the session — controller regenerates it.
 */
async function authenticateCredentials({ email, password }, reqMeta = {}) {
  const normalized = email.toLowerCase();
  const user = await User.findOne({ email: normalized }).select('+passwordHash');

  if (!user) {
    await auditService.record({
      type: 'auth.signin.failure',
      result: 'failure',
      ...auditContext(reqMeta),
      meta: { reason: 'unknown_email' },
    });
    throw new ApiError(401, GENERIC_CREDENTIALS);
  }

  if (!user.isActive) {
    await auditService.record({
      type: 'auth.signin.failure',
      result: 'failure',
      targetUserId: user.id,
      organizationId: user.organizationId,
      ...auditContext(reqMeta),
      meta: { reason: 'deactivated' },
    });
    throw new ApiError(403, DEACTIVATED_MESSAGE);
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    await auditService.record({
      type: 'auth.signin.failure',
      result: 'failure',
      targetUserId: user.id,
      organizationId: user.organizationId,
      ...auditContext(reqMeta),
      meta: { reason: 'bad_password' },
    });
    throw new ApiError(401, GENERIC_CREDENTIALS);
  }

  if (user.invitedAt) {
    user.invitedAt = null;
    await user.save();
  }

  await auditService.record({
    type: 'auth.signin.success',
    result: 'success',
    actorUserId: user.id,
    targetUserId: user.id,
    organizationId: user.organizationId,
    ...auditContext(reqMeta),
  });

  return user;
}

async function getMe(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(401, 'Authentication required');
  }
  if (!user.isActive) {
    throw new ApiError(403, DEACTIVATED_MESSAGE);
  }
  return user.toJSON();
}

async function changePassword(userId, { currentPassword, newPassword }, reqMeta = {}) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw new ApiError(400, 'Current password is incorrect', [
      { field: 'currentPassword', message: 'Current password is incorrect' },
    ]);
  }

  user.passwordHash = await hashPassword(newPassword);
  user.sessionVersion = Number(user.sessionVersion || 0) + 1;
  if (user.invitedAt) user.invitedAt = null;
  await user.save();

  await auditService.record({
    type: 'auth.password_change.success',
    result: 'success',
    actorUserId: user.id,
    targetUserId: user.id,
    organizationId: user.organizationId,
    ...auditContext(reqMeta),
  });

  return { changed: true };
}

async function forgotPassword({ email }, reqMeta = {}) {
  const normalized = email.toLowerCase();
  const user = await User.findOne({ email: normalized });

  // Always return the same shape to callers.
  if (!user || !user.isActive) {
    await auditService.record({
      type: 'auth.password_reset.request',
      result: 'success',
      organizationId: user?.organizationId || null,
      targetUserId: user?.id || null,
      ...auditContext(reqMeta),
      meta: { emailed: false, reason: !user ? 'unknown_email' : 'inactive' },
    });
    return { accepted: true };
  }

  // Invalidate prior unused tokens for this user.
  await PasswordResetToken.updateMany(
    { userId: user._id, usedAt: null, replacedBy: null },
    { $set: { usedAt: new Date() } },
  );

  const rawToken = generateRawToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + env.passwordResetTtlMs);

  await PasswordResetToken.create({
    userId: user._id,
    organizationId: user.organizationId,
    tokenHash,
    expiresAt,
  });

  const resetUrl = `${env.appUrl}/reset-password?token=${rawToken}`;
  const mail = getMailProvider();

  try {
    await mail.sendMail({
      to: user.email,
      subject: 'Reset your Gourmet Palace Command Center password',
      text: [
        `Hi ${user.name},`,
        '',
        'We received a request to reset your Command Center password.',
        `Open this link within one hour to choose a new password:`,
        resetUrl,
        '',
        'If you did not request this, you can ignore this email.',
      ].join('\n'),
      html: `
        <p>Hi ${user.name},</p>
        <p>We received a request to reset your Command Center password.</p>
        <p><a href="${resetUrl}">Reset your password</a></p>
        <p>This link expires in one hour. If you did not request this, you can ignore this email.</p>
      `,
    });
  } catch (err) {
    console.error('[auth] failed to send reset email', err.message);
    await auditService.record({
      type: 'auth.password_reset.request',
      result: 'failure',
      targetUserId: user.id,
      organizationId: user.organizationId,
      ...auditContext(reqMeta),
      meta: { emailed: false, reason: 'mail_error' },
    });
    // Still return generic success to the client.
    return { accepted: true };
  }

  await auditService.record({
    type: 'auth.password_reset.request',
    result: 'success',
    targetUserId: user.id,
    organizationId: user.organizationId,
    ...auditContext(reqMeta),
    meta: { emailed: true },
  });

  return { accepted: true };
}

async function resetPassword({ token, newPassword }, reqMeta = {}) {
  const tokenHash = hashToken(token);
  const record = await PasswordResetToken.findOne({ tokenHash });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    await auditService.record({
      type: 'auth.password_reset.failure',
      result: 'failure',
      ...auditContext(reqMeta),
      meta: { reason: 'invalid_or_expired_token' },
    });
    throw new ApiError(400, 'This reset link is invalid or has expired.');
  }

  const user = await User.findById(record.userId).select('+passwordHash');
  if (!user || !user.isActive) {
    await auditService.record({
      type: 'auth.password_reset.failure',
      result: 'failure',
      targetUserId: record.userId,
      organizationId: record.organizationId,
      ...auditContext(reqMeta),
      meta: { reason: 'user_unavailable' },
    });
    throw new ApiError(400, 'This reset link is invalid or has expired.');
  }

  user.passwordHash = await hashPassword(newPassword);
  user.sessionVersion = Number(user.sessionVersion || 0) + 1;
  if (user.invitedAt) user.invitedAt = null;
  await user.save();

  record.usedAt = new Date();
  await record.save();

  // Invalidate any other outstanding tokens for this user.
  await PasswordResetToken.updateMany(
    {
      userId: user._id,
      _id: { $ne: record._id },
      usedAt: null,
    },
    { $set: { usedAt: new Date(), replacedBy: record._id } },
  );

  await auditService.record({
    type: 'auth.password_reset.success',
    result: 'success',
    actorUserId: user.id,
    targetUserId: user.id,
    organizationId: user.organizationId,
    ...auditContext(reqMeta),
  });

  return { reset: true };
}


async function updatePreferences(userId, preferences, reqMeta = {}) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');
  const allowed = ['email','inApp','alerts','brief'];
  for (const key of allowed) if (preferences[key] !== undefined) user.notificationPreferences[key] = Boolean(preferences[key]);
  await user.save();
  await auditService.record({ type:'user.notification_preferences.update', result:'success', actorUserId:user.id, targetUserId:user.id, organizationId:user.organizationId, ...auditContext(reqMeta), meta:{changes:Object.keys(preferences)} });
  return user.toJSON();
}

async function recordSignout(user, reqMeta = {}) {
  await auditService.record({
    type: 'auth.signout',
    result: 'success',
    actorUserId: user?.id || null,
    targetUserId: user?.id || null,
    organizationId: user?.organizationId || null,
    ...auditContext(reqMeta),
  });
}

module.exports = {
  authenticateCredentials,
  getMe,
  changePassword,
  forgotPassword,
  resetPassword,
  recordSignout,
  updatePreferences,
  FORGOT_SUCCESS,
  DEACTIVATED_MESSAGE,
};
