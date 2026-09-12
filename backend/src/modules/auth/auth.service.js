const crypto = require('crypto');
const User = require('../../models/User');
const Organization = require('../../models/Organization');
const Location = require('../../models/Location');
const PasswordResetToken = require('../../models/PasswordResetToken');
const EmailVerificationToken = require('../../models/EmailVerificationToken');
const ApiError = require('../../utils/ApiError');
const env = require('../../config/getEnv')();
const { hashPassword, comparePassword } = require('../../utils/password');
const { generateRawToken, hashToken } = require('../../utils/tokens');
const { getMailProvider } = require('../mail/mail.provider');
const auditService = require('../audit/audit.service');

const GENERIC_CREDENTIALS = 'Invalid email or password';
const DEACTIVATED_MESSAGE =
  'Your account has been deactivated. Contact your administrator.';
const FORGOT_SUCCESS =
  'If that email is registered, reset instructions will be sent.';
const RESEND_VERIFICATION_SUCCESS =
  'If that email is registered and still needs verification, a verification email will be sent.';

function auditContext(meta = {}) {
  return {
    correlationId: meta.correlationId,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
  };
}

function isSelfRegistered(user) {
  return user?.accountOrigin === 'self';
}

function isEmailVerified(user) {
  return !isSelfRegistered(user) || Boolean(user?.emailVerifiedAt);
}

function isOnboardingComplete(user) {
  if (!user?.organizationId) return false;
  return !isSelfRegistered(user) || Boolean(user?.onboardingCompletedAt);
}

function slugifyOrganizationName(value) {
  const slug = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 54)
    .replace(/-+$/g, '');
  return slug || 'organization';
}

function assertTimezone(value) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
  } catch {
    throw new ApiError(422, 'Validation failed', [
      { field: 'timezone', message: 'Use a valid IANA timezone such as America/Los_Angeles' },
    ]);
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function issueVerificationEmail(user, reqMeta = {}, source = 'resend') {
  if (!user || !user.isActive || isEmailVerified(user)) {
    return { accepted: true, emailed: false };
  }

  const lastSent = user.verificationEmailLastSentAt?.getTime?.() || 0;
  if (lastSent && Date.now() - lastSent < env.verificationResendCooldownMs) {
    await auditService.record({
      type: 'auth.email_verification.request',
      result: 'success',
      targetUserId: user.id,
      ...auditContext(reqMeta),
      meta: { emailed: false, reason: 'cooldown', source },
    });
    return { accepted: true, emailed: false };
  }

  await EmailVerificationToken.updateMany(
    { userId: user._id, usedAt: null },
    { $set: { usedAt: new Date() } },
  );

  const rawToken = generateRawToken(32);
  const expiresAt = new Date(Date.now() + env.emailVerificationTtlMs);
  await EmailVerificationToken.create({
    userId: user._id,
    tokenHash: hashToken(rawToken),
    expiresAt,
  });

  user.verificationEmailLastSentAt = new Date();
  await user.save();

  const verificationUrl = `${env.appUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;
  const safeName = escapeHtml(user.name);
  const mail = getMailProvider();

  try {
    await mail.sendMail({
      to: user.email,
      subject: 'Verify your Gourmet Palace Command Center email',
      text: [
        `Hi ${user.name},`,
        '',
        'Verify your email address to finish creating your Command Center account.',
        `Open this link within 24 hours:`,
        verificationUrl,
        '',
        'If you did not create this account, you can ignore this email.',
      ].join('\n'),
      html: `
        <p>Hi ${safeName},</p>
        <p>Verify your email address to finish creating your Command Center account.</p>
        <p><a href="${verificationUrl}">Verify email address</a></p>
        <p>This link expires in 24 hours. If you did not create this account, you can ignore this email.</p>
      `,
    });

    await auditService.record({
      type: 'auth.email_verification.request',
      result: 'success',
      targetUserId: user.id,
      ...auditContext(reqMeta),
      meta: { emailed: true, source },
    });
    return { accepted: true, emailed: true };
  } catch (err) {
    console.error('[auth] failed to send verification email', err.message);
    await auditService.record({
      type: 'auth.email_verification.request',
      result: 'failure',
      targetUserId: user.id,
      ...auditContext(reqMeta),
      meta: { emailed: false, reason: 'mail_error', source },
    });
    // The account remains valid and the user can request another email later.
    return { accepted: true, emailed: false };
  }
}

async function register({ name, email, password }, reqMeta = {}) {
  const normalized = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalized }).select('_id');
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists', [
      { field: 'email', message: 'An account with this email already exists' },
    ]);
  }

  const passwordHash = await hashPassword(password);
  let user;
  try {
    user = await User.create({
      organizationId: null,
      name: name.trim(),
      email: normalized,
      passwordHash,
      role: 'owner',
      accountOrigin: 'self',
      emailVerifiedAt: null,
      onboardingCompletedAt: null,
      locationIds: [],
      isActive: true,
    });
  } catch (err) {
    if (err?.code === 11000) {
      throw new ApiError(409, 'An account with this email already exists', [
        { field: 'email', message: 'An account with this email already exists' },
      ]);
    }
    throw err;
  }

  await auditService.record({
    type: 'auth.register.success',
    result: 'success',
    actorUserId: user.id,
    targetUserId: user.id,
    ...auditContext(reqMeta),
    meta: { email: user.email },
  });

  // Registration succeeds even if the provider is temporarily unavailable;
  // resend-verification gives the user a recovery path after provider recovery.
  await issueVerificationEmail(user, reqMeta, 'registration');

  return {
    registered: true,
    email: user.email,
  };
}

async function verifyEmail({ token }, reqMeta = {}) {
  const tokenHash = hashToken(token);
  const now = new Date();

  let record = await EmailVerificationToken.findOneAndUpdate(
    {
      tokenHash,
      usedAt: null,
      expiresAt: { $gt: now },
    },
    { $set: { usedAt: now } },
    { new: true },
  );

  // Idempotent behavior matters for browser retries / React Strict Mode.
  if (!record) {
    record = await EmailVerificationToken.findOne({ tokenHash });
    if (record?.usedAt) {
      const alreadyVerifiedUser = await User.findById(record.userId);
      if (alreadyVerifiedUser && isEmailVerified(alreadyVerifiedUser)) {
        return { verified: true };
      }
    }

    await auditService.record({
      type: 'auth.email_verification.failure',
      result: 'failure',
      ...auditContext(reqMeta),
      meta: { reason: 'invalid_or_expired_token' },
    });
    throw new ApiError(400, 'This verification link is invalid or has expired.');
  }

  const user = await User.findById(record.userId);
  if (!user || !user.isActive || !isSelfRegistered(user)) {
    await auditService.record({
      type: 'auth.email_verification.failure',
      result: 'failure',
      targetUserId: record.userId,
      ...auditContext(reqMeta),
      meta: { reason: 'user_unavailable' },
    });
    throw new ApiError(400, 'This verification link is invalid or has expired.');
  }

  if (!user.emailVerifiedAt) {
    user.emailVerifiedAt = now;
    await user.save();
  }

  await EmailVerificationToken.updateMany(
    { userId: user._id, _id: { $ne: record._id }, usedAt: null },
    { $set: { usedAt: now } },
  );

  await auditService.record({
    type: 'auth.email_verification.success',
    result: 'success',
    actorUserId: user.id,
    targetUserId: user.id,
    ...auditContext(reqMeta),
  });

  return { verified: true };
}

async function resendVerification({ email }, reqMeta = {}) {
  const normalized = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalized }).select('+verificationEmailLastSentAt');

  // Always return the same public response shape to avoid account enumeration.
  if (!user || !user.isActive || isEmailVerified(user)) {
    await auditService.record({
      type: 'auth.email_verification.request',
      result: 'success',
      targetUserId: user?.id || null,
      organizationId: user?.organizationId || null,
      ...auditContext(reqMeta),
      meta: {
        emailed: false,
        reason: !user ? 'unknown_email' : !user.isActive ? 'inactive' : 'already_verified',
        source: 'resend',
      },
    });
    return { accepted: true };
  }

  await issueVerificationEmail(user, reqMeta, 'resend');
  return { accepted: true };
}

/** Authenticate credentials. The controller regenerates the session. */
async function authenticateCredentials({ email, password }, reqMeta = {}) {
  const normalized = email.toLowerCase().trim();
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

  if (!isEmailVerified(user)) {
    await auditService.record({
      type: 'auth.signin.failure',
      result: 'failure',
      targetUserId: user.id,
      ...auditContext(reqMeta),
      meta: { reason: 'email_unverified' },
    });
    throw new ApiError(403, 'Please verify your email before signing in.', [
      { field: 'email', message: 'Email verification is required' },
    ]);
  }

  if (user.invitedAt) {
    user.invitedAt = null;
    if (!user.emailVerifiedAt) user.emailVerifiedAt = new Date();
    await user.save();
  }

  await auditService.record({
    type: 'auth.signin.success',
    result: 'success',
    actorUserId: user.id,
    targetUserId: user.id,
    organizationId: user.organizationId,
    ...auditContext(reqMeta),
    meta: { onboardingComplete: isOnboardingComplete(user) },
  });

  return user;
}

async function getMe(userId) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(401, 'Authentication required');
  if (!user.isActive) throw new ApiError(403, DEACTIVATED_MESSAGE);
  return user.toJSON();
}

async function createOrganizationWithUniqueSlug(name) {
  const base = slugifyOrganizationName(name);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${crypto.randomBytes(3).toString('hex')}`;
    const candidate = `${base.slice(0, Math.max(1, 63 - suffix.length))}${suffix}`;
    try {
      return await Organization.create({
        name: name.trim(),
        slug: candidate,
        status: 'active',
      });
    } catch (err) {
      if (err?.code === 11000) continue;
      throw err;
    }
  }
  throw new ApiError(409, 'Unable to generate a unique organization slug. Please try again.');
}

async function completeOnboarding(userId, payload, reqMeta = {}) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(401, 'Authentication required');
  if (!user.isActive) throw new ApiError(403, DEACTIVATED_MESSAGE);
  if (!isEmailVerified(user)) throw new ApiError(403, 'Email verification is required');

  if (isOnboardingComplete(user)) {
    const [organization, location] = await Promise.all([
      Organization.findById(user.organizationId),
      Location.findOne({ organizationId: user.organizationId, status: 'active' }).sort({ createdAt: 1 }),
    ]);
    return {
      completed: true,
      user: user.toJSON(),
      organization: organization?.toJSON() || null,
      location: location?.toJSON() || null,
    };
  }

  if (!isSelfRegistered(user)) {
    throw new ApiError(400, 'Onboarding is not required for this account.');
  }
  if (user.organizationId) {
    throw new ApiError(409, 'This account already has an organization. Please contact support.');
  }

  assertTimezone(payload.timezone);

  let organization = null;
  let location = null;
  try {
    organization = await createOrganizationWithUniqueSlug(payload.organizationName);
    location = await Location.create({
      organizationId: organization._id,
      name: payload.locationName.trim(),
      address: payload.locationAddress.trim(),
      timezone: payload.timezone.trim(),
      status: 'active',
    });

    const updatedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        organizationId: null,
        accountOrigin: 'self',
      },
      {
        $set: {
          organizationId: organization._id,
          onboardingCompletedAt: new Date(),
          role: 'owner',
          locationIds: [],
        },
      },
      { new: true, runValidators: true },
    );

    if (!updatedUser) {
      // A duplicate/concurrent request may have completed onboarding first.
      await Location.deleteMany({ organizationId: organization._id });
      await Organization.deleteOne({ _id: organization._id });
      organization = null;
      location = null;

      const current = await User.findById(user._id);
      if (current && isOnboardingComplete(current)) {
        const [currentOrganization, currentLocation] = await Promise.all([
          Organization.findById(current.organizationId),
          Location.findOne({ organizationId: current.organizationId, status: 'active' }).sort({ createdAt: 1 }),
        ]);
        return {
          completed: true,
          user: current.toJSON(),
          organization: currentOrganization?.toJSON() || null,
          location: currentLocation?.toJSON() || null,
        };
      }
      throw new ApiError(409, 'Onboarding was already completed in another request.');
    }

    await auditService.record({
      type: 'auth.onboarding.success',
      result: 'success',
      actorUserId: updatedUser.id,
      targetUserId: updatedUser.id,
      organizationId: organization.id,
      ...auditContext(reqMeta),
      meta: { locationId: location.id, slug: organization.slug },
    });

    return {
      completed: true,
      user: updatedUser.toJSON(),
      organization: organization.toJSON(),
      location: location.toJSON(),
    };
  } catch (err) {
    // Compensating cleanup keeps standalone MongoDB development compatible while
    // preventing orphaned onboarding records if any later step fails.
    if (organization?._id) {
      try {
        await Location.deleteMany({ organizationId: organization._id });
        await Organization.deleteOne({ _id: organization._id });
      } catch (cleanupErr) {
        console.error('[auth] onboarding cleanup failed', cleanupErr.message);
      }
    }

    await auditService.record({
      type: 'auth.onboarding.failure',
      result: 'failure',
      actorUserId: user.id,
      targetUserId: user.id,
      ...auditContext(reqMeta),
      meta: { reason: err.message },
    });
    throw err;
  }
}

async function changePassword(userId, { currentPassword, newPassword }, reqMeta = {}) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw new ApiError(404, 'User not found');

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw new ApiError(400, 'Current password is incorrect', [
      { field: 'currentPassword', message: 'Current password is incorrect' },
    ]);
  }

  user.passwordHash = await hashPassword(newPassword);
  user.sessionVersion = Number(user.sessionVersion || 0) + 1;
  if (user.invitedAt) {
    user.invitedAt = null;
    if (!user.emailVerifiedAt) user.emailVerifiedAt = new Date();
  }
  await user.save();

  await auditService.record({
    type: 'auth.password_change.success',
    result: 'success',
    actorUserId: user.id,
    targetUserId: user.id,
    organizationId: user.organizationId,
    ...auditContext(reqMeta),
  });

  return { changed: true, sessionVersion: Number(user.sessionVersion || 0) };
}

async function forgotPassword({ email }, reqMeta = {}) {
  const normalized = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalized });

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

  await PasswordResetToken.updateMany(
    { userId: user._id, usedAt: null, replacedBy: null },
    { $set: { usedAt: new Date() } },
  );

  const rawToken = generateRawToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + env.passwordResetTtlMs);

  await PasswordResetToken.create({
    userId: user._id,
    organizationId: user.organizationId || null,
    tokenHash,
    expiresAt,
  });

  const resetUrl = `${env.appUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const safeName = escapeHtml(user.name);
  const mail = getMailProvider();

  try {
    await mail.sendMail({
      to: user.email,
      subject: 'Reset your Gourmet Palace Command Center password',
      text: [
        `Hi ${user.name},`,
        '',
        'We received a request to reset your Command Center password.',
        'Open this link within one hour to choose a new password:',
        resetUrl,
        '',
        'If you did not request this, you can ignore this email.',
      ].join('\n'),
      html: `
        <p>Hi ${safeName},</p>
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
  const now = new Date();
  const record = await PasswordResetToken.findOneAndUpdate(
    {
      tokenHash,
      usedAt: null,
      expiresAt: { $gt: now },
    },
    { $set: { usedAt: now } },
    { new: true },
  );

  if (!record) {
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
  if (user.invitedAt) {
    user.invitedAt = null;
    if (!user.emailVerifiedAt) user.emailVerifiedAt = now;
  }
  await user.save();

  await PasswordResetToken.updateMany(
    {
      userId: user._id,
      _id: { $ne: record._id },
      usedAt: null,
    },
    { $set: { usedAt: now, replacedBy: record._id } },
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
  const allowed = ['email', 'inApp', 'alerts', 'brief'];
  for (const key of allowed) {
    if (preferences[key] !== undefined) user.notificationPreferences[key] = Boolean(preferences[key]);
  }
  await user.save();
  await auditService.record({
    type: 'user.notification_preferences.update',
    result: 'success',
    actorUserId: user.id,
    targetUserId: user.id,
    organizationId: user.organizationId,
    ...auditContext(reqMeta),
    meta: { changes: Object.keys(preferences) },
  });
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
  register,
  verifyEmail,
  resendVerification,
  authenticateCredentials,
  getMe,
  completeOnboarding,
  changePassword,
  forgotPassword,
  resetPassword,
  recordSignout,
  updatePreferences,
  isEmailVerified,
  isOnboardingComplete,
  slugifyOrganizationName,
  FORGOT_SUCCESS,
  RESEND_VERIFICATION_SUCCESS,
  DEACTIVATED_MESSAGE,
};
