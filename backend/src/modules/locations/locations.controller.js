const ApiResponse = require('../../utils/ApiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { getClientIp, getUserAgent } = require('../../utils/requestMeta');
const locationsService = require('./locations.service');

function reqMeta(req) {
  return {
    correlationId: req.correlationId,
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
  };
}

const list = asyncHandler(async (req, res) => {
  const data = await locationsService.listLocations(req.auth.organizationId, req.auth);
  return ApiResponse.send(res, {
    message: 'Locations',
    data: { locations: data },
  });
});

const create = asyncHandler(async (req, res) => {
  const data = await locationsService.createLocation(
    req.auth.organizationId,
    req.body,
    req.user,
    reqMeta(req),
  );
  return ApiResponse.send(res, {
    statusCode: 201,
    message: 'Location created',
    data: { location: data },
  });
});

const update = asyncHandler(async (req, res) => {
  const data = await locationsService.updateLocation(
    req.auth.organizationId,
    req.params.id,
    req.body,
    req.user,
    reqMeta(req),
  );
  return ApiResponse.send(res, {
    message: 'Location updated',
    data: { location: data },
  });
});

module.exports = {
  list,
  create,
  update,
};
