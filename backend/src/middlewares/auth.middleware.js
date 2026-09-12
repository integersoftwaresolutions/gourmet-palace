const User = require('../models/User');
const Organization = require('../models/Organization');
const Location = require('../models/Location');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const {
  isAdminRole,
  canAccessFinance,
  resolveAuthorizedLocationIds,
} = require('../utils/permissions');

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

async function attachAuthenticatedUser(req, { requireOnboarding }) {
  const userId = req.session?.userId;
  if (!userId) throw new ApiError(401, 'Authentication required');

  const user = await User.findById(userId);
  if (!user) {
    req.session.destroy(() => {});
    throw new ApiError(401, 'Authentication required');
  }

  if (!user.isActive) {
    req.session.destroy(() => {});
    throw new ApiError(403, 'Your account has been deactivated. Contact your administrator.');
  }

  if (Number(req.session.sessionVersion ?? 0) !== Number(user.sessionVersion ?? 0)) {
    req.session.destroy(() => {});
    throw new ApiError(401, 'Session expired. Please sign in again.');
  }

  if (!isEmailVerified(user)) {
    req.session.destroy(() => {});
    throw new ApiError(403, 'Email verification is required');
  }

  const onboardingComplete = isOnboardingComplete(user);
  if (requireOnboarding && !onboardingComplete) {
    throw new ApiError(403, 'Complete onboarding before accessing the application.');
  }

  let locationIds = [];
  let admin = false;
  let organizationId = user.organizationId?.toString() || null;

  if (onboardingComplete) {
    const organization = await Organization.findById(user.organizationId).select('status');
    if (!organization) {
      throw new ApiError(403, 'Your organization is unavailable. Contact support.');
    }
    if (organization.status !== 'active') {
      throw new ApiError(403, 'Your organization is suspended. Contact support.');
    }

    const orgLocations = await Location.find({
      organizationId: user.organizationId,
      status: 'active',
    }).select('_id');

    locationIds = resolveAuthorizedLocationIds(user, orgLocations);
    admin = isAdminRole(user.role);
  }

  req.user = user;
  req.auth = {
    userId: user.id,
    organizationId,
    role: user.role,
    emailVerified: true,
    onboardingComplete,
    locationIds,
    allLocations: admin,
    canFinance: onboardingComplete && canAccessFinance(user.role),
    isAdmin: onboardingComplete && admin,
  };
}

/** Allows verified signed-in users who have not completed onboarding yet. */
const authenticateSession = asyncHandler(async (req, res, next) => {
  await attachAuthenticatedUser(req, { requireOnboarding: false });
  next();
});

/** Existing application boundary: a verified, fully onboarded account is required. */
const authenticate = asyncHandler(async (req, res, next) => {
  await attachAuthenticatedUser(req, { requireOnboarding: true });
  next();
});

const requireAdmin = (req, res, next) => {
  if (!req.auth?.isAdmin) {
    return next(new ApiError(403, 'Admin access required'));
  }
  return next();
};

module.exports = {
  authenticate,
  authenticateSession,
  requireAdmin,
};
