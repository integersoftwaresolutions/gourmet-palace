const ApiResponse = require('../../utils/ApiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { getClientIp, getUserAgent } = require('../../utils/requestMeta');
const usersService = require('./users.service');

function reqMeta(req) {
  return {
    correlationId: req.correlationId,
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
  };
}

const list = asyncHandler(async (req, res) => {
  const data = await usersService.listUsers(req.auth.organizationId);
  return ApiResponse.send(res, {
    message: 'Users',
    data: { users: data },
  });
});

const invite = asyncHandler(async (req, res) => {
  const data = await usersService.inviteUser(
    req.auth.organizationId,
    req.body,
    req.user,
    reqMeta(req),
  );
  return ApiResponse.send(res, {
    statusCode: 201,
    message: 'Invitation sent',
    data: { user: data },
  });
});

const update = asyncHandler(async (req, res) => {
  const data = await usersService.updateUser(
    req.auth.organizationId,
    req.params.id,
    req.body,
    req.user,
    reqMeta(req),
  );
  return ApiResponse.send(res, {
    message: 'User updated',
    data: { user: data },
  });
});

module.exports = {
  list,
  invite,
  update,
};
