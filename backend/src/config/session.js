const session = require('express-session');
const { MongoStore } = require('connect-mongo');

/**
 * Build session middleware from process.env at call time.
 * Avoids Vercel bytecode bundling freezing undefined config object fields.
 */
function createSessionMiddleware() {
  const mongoUrl = process.env.MONGODB_URI
    || process.env.MONGO_URL
    || '';
  if (!mongoUrl) {
    throw new Error('MONGODB_URI is required (session store)');
  }

  const maxAgeMs = Number(process.env.SESSION_MAX_AGE_MS) || 7 * 24 * 60 * 60 * 1000;
  const isProd = (process.env.NODE_ENV || 'development') === 'production';

  return session({
    name: process.env.SESSION_NAME || 'gp.sid',
    secret: process.env.SESSION_SECRET || 'dev-session-secret-change-me',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: MongoStore.create({
      mongoUrl,
      collectionName: 'sessions',
      ttl: Math.floor(maxAgeMs / 1000),
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.SESSION_SECURE === 'true' || isProd,
      sameSite: 'lax',
      maxAge: maxAgeMs,
      path: '/',
    },
  });
}

module.exports = { createSessionMiddleware };
