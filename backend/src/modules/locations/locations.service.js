const Location = require('../../models/Location');
const ApiError = require('../../utils/ApiError');
const auditService = require('../audit/audit.service');
function assertTimezone(value){try{new Intl.DateTimeFormat('en-US',{timeZone:value}).format(new Date())}catch{throw new ApiError(400,'Invalid IANA timezone',[{field:'timezone',message:'Use an IANA timezone such as America/Los_Angeles'}])}}

async function listLocations(organizationId, auth = null) {
  const filter = { organizationId };
  if (auth && !auth.allLocations) filter._id = { $in: auth.locationIds };
  const locations = await Location.find(filter).sort({ name: 1 });
  return locations.map((loc) => loc.toJSON());
}

async function createLocation(organizationId, payload, actor, reqMeta = {}) {
  assertTimezone(payload.timezone || 'America/Los_Angeles');
  const existing = await Location.findOne({
    organizationId,
    name: payload.name.trim(),
  });
  if (existing) {
    throw new ApiError(409, 'A location with this name already exists', [
      { field: 'name', message: 'A location with this name already exists' },
    ]);
  }

  const location = await Location.create({
    organizationId,
    name: payload.name.trim(),
    address: payload.address || '',
    timezone: payload.timezone || 'America/Los_Angeles',
    status: payload.status || 'active',
  });

  await auditService.record({
    type: 'location.create',
    result: 'success',
    actorUserId: actor.id,
    organizationId,
    correlationId: reqMeta.correlationId,
    ip: reqMeta.ip,
    userAgent: reqMeta.userAgent,
    meta: { locationId: location.id, name: location.name },
  });

  return location.toJSON();
}

async function updateLocation(organizationId, locationId, payload, actor, reqMeta = {}) {
  const location = await Location.findOne({ _id: locationId, organizationId });
  if (!location) {
    throw new ApiError(404, 'Location not found');
  }

  if (payload.name && payload.name.trim() !== location.name) {
    const clash = await Location.findOne({
      organizationId,
      name: payload.name.trim(),
      _id: { $ne: locationId },
    });
    if (clash) {
      throw new ApiError(409, 'A location with this name already exists', [
        { field: 'name', message: 'A location with this name already exists' },
      ]);
    }
    location.name = payload.name.trim();
  }

  if (payload.address !== undefined) location.address = payload.address;
  if (payload.timezone !== undefined) { assertTimezone(payload.timezone); location.timezone = payload.timezone; }
  if (payload.status !== undefined) location.status = payload.status;

  await location.save();

  await auditService.record({
    type: 'location.update',
    result: 'success',
    actorUserId: actor.id,
    organizationId,
    correlationId: reqMeta.correlationId,
    ip: reqMeta.ip,
    userAgent: reqMeta.userAgent,
    meta: { locationId: location.id, changes: Object.keys(payload) },
  });

  return location.toJSON();
}

module.exports = {
  listLocations,
  createLocation,
  updateLocation,
};
