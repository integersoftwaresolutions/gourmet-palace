const rateLimit = require('express-rate-limit');

// Broad abuse protection. Authentication has a separate, much stricter limiter.
module.exports = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    data: null,
    meta: null,
    errors: null,
  },
});
