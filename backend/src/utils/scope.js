const ApiError = require('./ApiError');
function authorizedLocationFilter(auth, requestedLocationId) {
  if (requestedLocationId) {
    if (!auth.allLocations && !auth.locationIds.includes(String(requestedLocationId))) {
      throw new ApiError(403, 'Location access denied');
    }
    return requestedLocationId;
  }
  return auth.allLocations ? null : { $in: auth.locationIds };
}
function requireLocation(auth, requestedLocationId) {
  if (!requestedLocationId) throw new ApiError(400,'locationId is required');
  authorizedLocationFilter(auth, requestedLocationId);
  return requestedLocationId;
}
function applyScope(auth, query={}, requestedLocationId) {
  const q={...query,organizationId:auth.organizationId};
  const loc=authorizedLocationFilter(auth, requestedLocationId);
  if (loc) q.locationId=loc;
  return q;
}
module.exports={authorizedLocationFilter,requireLocation,applyScope};
