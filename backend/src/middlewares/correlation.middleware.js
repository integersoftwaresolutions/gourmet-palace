const crypto = require('crypto');

function correlationMiddleware(req, res, next) {
  const incoming = req.headers['x-correlation-id'];
  const correlationId =
    typeof incoming === 'string' && incoming.trim()
      ? incoming.trim().slice(0, 128)
      : crypto.randomUUID();

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);
  next();
}

module.exports = correlationMiddleware;
