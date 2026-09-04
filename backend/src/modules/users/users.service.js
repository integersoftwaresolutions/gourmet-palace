const crypto = require('crypto');
const PasswordResetToken = require('../../models/PasswordResetToken');
const { generateRawToken, hashToken } = require('../../utils/tokens');
const User = require('../../models/User');
const Location = require('../../models/Location');
const ApiError = require('../../utils/ApiError');
const env = require('../../config/env');
const { hashPassword } = require('../../utils/password');
const { isAdminRole } = require('../../utils/permissions');
const { getMailProvider } = require('../mail/mail.provider');
const auditService = require('../audit/audit.service');

async function assertLocationsInOrg(organizationId, locationIds) {
  if (!locationIds?.length) return [];
  const found = await Location.find({
    organizationId,
    _id: { $in: locationIds },
    status: 'active',
  }).select('_id name status');
  if (found.length !== locationIds.length) {
    throw new ApiError(400, 'One or more locations are invalid for this organization', [
      { field: 'locationIds', message: 'One or more locations are invalid' },
    ]);
  }
  return found;
}

function serializeUser(user, locationMap) {
  const json = user.toJSON();
  const ids = json.locationIds || [];
  json.locations =
    isAdminRole(json.role) && ids.length === 0
      ? [{ id: '*', name: 'All' }]
      : ids.map((id) => ({
          id,
          name: locationMap.get(id)?.name || 'Unknown',
        }));
  json.status = !json.isActive
    ? 'inactive'
    : json.invitedAt
      ? 'invited'
      : 'active';
  return json;
}

async function buildLocationMap(organizationId) {
  const locs = await Location.find({ organizationId }).select('_id name');
  return new Map(locs.map((l) => [l._id.toString(), l.toJSON()]));
}

async function listUsers(organizationId) {
  const [users, locationMap] = await Promise.all([
    User.find({ organizationId }).sort({ name: 1 }),
    buildLocationMap(organizationId),
  ]);
  return users.map((u) => serializeUser(u, locationMap));
}

async function inviteUser(organizationId, payload, actor, reqMeta = {}) {
  const email = payload.email.toLowerCase().trim();
  const existing = await User.findOne({ email });
  if (existing) {
    throw new ApiError(409, 'Email already registered', [
      { field: 'email', message: 'Email already registered' },
    ]);
  }

  if (payload.role === 'manager') {
    await assertLocationsInOrg(organizationId, payload.locationIds);
  }

  // Store an unshared random credential. The invited user sets their own password
  // through a single-use activation token; no password is ever emailed.
  const unsharedPassword = `Gp${crypto.randomBytes(18).toString('hex')}1`;
  const passwordHash = await hashPassword(unsharedPassword);

  const user = await User.create({
    organizationId,
    name: payload.name.trim(),
    email,
    passwordHash,
    role: payload.role,
    locationIds: payload.role === 'manager' ? payload.locationIds : [],
    isActive: true,
    invitedAt: new Date(),
  });

  const rawToken = generateRawToken(32);
  await PasswordResetToken.create({
    userId: user._id,
    organizationId,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + env.passwordResetTtlMs),
  });
  const activationUrl = `${env.appUrl}/reset-password?token=${rawToken}&mode=activate`;
  const mail = getMailProvider();
  try {
    await mail.sendMail({
      to: email,
      subject: 'Activate your Gourmet Palace Command Center account',
      text: [
        `Hi ${user.name},`,
        '',
        'You have been invited to Gourmet Palace Command Center.',
        'Use this single-use link to set your password:',
        activationUrl,
        '',
        'The link expires in one hour.',
      ].join('\n'),
      html: `<p>Hi ${user.name},</p><p>You have been invited to Gourmet Palace Command Center.</p><p><a href="${activationUrl}">Set your password and activate your account</a></p><p>This link expires in one hour.</p>`,
    });
  } catch (err) {
    console.error('[users] invite email failed', err.message);
  }

  await auditService.record({
    type: 'user.invite',
    result: 'success',
    actorUserId: actor.id,
    targetUserId: user.id,
    organizationId,
    correlationId: reqMeta.correlationId,
    ip: reqMeta.ip,
    userAgent: reqMeta.userAgent,
    meta: { role: user.role, email: user.email },
  });

  const locationMap = await buildLocationMap(organizationId);
  return serializeUser(user, locationMap);
}

async function updateUser(organizationId, userId, payload, actor, reqMeta = {}) {
  const user = await User.findOne({ _id: userId, organizationId });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (user.role === 'owner' && actor.id !== user.id) {
    if (payload.role || payload.isActive === false || payload.locationIds) {
      throw new ApiError(403, 'Owner account cannot be modified this way');
    }
  }

  if (payload.name !== undefined) user.name = payload.name.trim();

  if (payload.role !== undefined) {
    if (user.role === 'owner') {
      throw new ApiError(403, 'Owner role cannot be changed');
    }
    user.role = payload.role;
    if (payload.role === 'admin') {
      user.locationIds = [];
    }
  }

  if (payload.locationIds !== undefined) {
    const role = payload.role || user.role;
    if (role === 'manager') {
      if (!payload.locationIds.length) {
        throw new ApiError(400, 'Managers must be assigned at least one location', [
          { field: 'locationIds', message: 'Select at least one location' },
        ]);
      }
      await assertLocationsInOrg(organizationId, payload.locationIds);
      user.locationIds = payload.locationIds;
    } else if (isAdminRole(role)) {
      user.locationIds = [];
    }
  }

  if (payload.isActive !== undefined) {
    if (user.role === 'owner' && payload.isActive === false) {
      throw new ApiError(403, 'Owner account cannot be deactivated');
    }
    user.isActive = payload.isActive;
  }

  if (payload.notificationPreferences !== undefined) {
    for (const key of ['email', 'inApp', 'alerts', 'brief']) {
      if (payload.notificationPreferences[key] !== undefined) user.notificationPreferences[key] = Boolean(payload.notificationPreferences[key]);
    }
  }

  // If role is manager after updates, ensure locations exist
  if (user.role === 'manager' && (!user.locationIds || user.locationIds.length === 0)) {
    throw new ApiError(400, 'Managers must be assigned at least one location', [
      { field: 'locationIds', message: 'Select at least one location' },
    ]);
  }

  await user.save();

  await auditService.record({
    type: 'user.update',
    result: 'success',
    actorUserId: actor.id,
    targetUserId: user.id,
    organizationId,
    correlationId: reqMeta.correlationId,
    ip: reqMeta.ip,
    userAgent: reqMeta.userAgent,
    meta: { changes: Object.keys(payload) },
  });

  const locationMap = await buildLocationMap(organizationId);
  return serializeUser(user, locationMap);
}

module.exports = {
  listUsers,
  inviteUser,
  updateUser,
};
