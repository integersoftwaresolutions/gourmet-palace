const User = require('../models/User');
const Location = require('../models/Location');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const {
  isAdminRole,
  canAccessFinance,
  resolveAuthorizedLocationIds,
} = require('../utils/permissions');

const authenticate = asyncHandler(async (req, res, next) => {
  const userId = req.session?.userId;
  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }

  const user = await User.findById(userId);
  if (!user) {
    req.session.destroy(() => {});
    throw new ApiError(401, 'Authentication required');
  }

  if (!user.isActive) {
    req.session.destroy(() => {});
    throw new ApiError(
      403,
      'Your account has been deactivated. Contact your administrator.',
    );
  }

  if (Number(req.session.sessionVersion ?? 0) !== Number(user.sessionVersion ?? 0)) {
    req.session.destroy(() => {});
    throw new ApiError(401, 'Session expired. Please sign in again.');
  }

  const orgLocations = await Location.find({
    organizationId: user.organizationId,
    status: 'active',
  }).select('_id');

  const locationIds = resolveAuthorizedLocationIds(user, orgLocations);
  const admin = isAdminRole(user.role);

  req.user = user;
  req.auth = {
    userId: user.id,
    organizationId: user.organizationId.toString(),
    role: user.role,
    locationIds,
    allLocations: admin,
    canFinance: canAccessFinance(user.role),
    isAdmin: admin,
  };
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
  requireAdmin,
};
