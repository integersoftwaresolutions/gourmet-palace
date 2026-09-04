const ADMIN_ROLES = new Set(['owner', 'admin']);

function isAdminRole(role) {
  return ADMIN_ROLES.has(role);
}

function canAccessFinance(role) {
  return isAdminRole(role);
}

/**
 * Resolve the location IDs a user may access within an org.
 * @param {{ role: string, locationIds?: import('mongoose').Types.ObjectId[] }} user
 * @param {Array<{ _id: import('mongoose').Types.ObjectId, id?: string }>} orgLocations
 */
function resolveAuthorizedLocationIds(user, orgLocations) {
  if (isAdminRole(user.role)) {
    return orgLocations.map((loc) => (loc.id || loc._id.toString()));
  }
  const assigned = (user.locationIds || []).map((id) => id.toString());
  const orgSet = new Set(orgLocations.map((loc) => (loc.id || loc._id.toString())));
  return assigned.filter((id) => orgSet.has(id));
}

function assertLocationAccess(auth, locationId) {
  if (!locationId) return false;
  if (isAdminRole(auth.role) && auth.allLocations) return true;
  return (auth.locationIds || []).includes(locationId.toString());
}

module.exports = {
  ADMIN_ROLES,
  isAdminRole,
  canAccessFinance,
  resolveAuthorizedLocationIds,
  assertLocationAccess,
};
