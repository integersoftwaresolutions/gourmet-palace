const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const env = require('./getEnv')();

/**
 * Build session middleware from process.env at call time.
 * Avoids Vercel bytecode bundling freezing undefined config object fields.
 */
function createSessionMiddleware() {
  const mongoUrl = env.mongodbUri || '';
  if (!mongoUrl) {
    throw new Error('MONGODB_URI is required (session store)');
  }

  const maxAgeMs = env.sessionMaxAgeMs;
  const isProd = env.nodeEnv === 'production';

  return session({
    name: env.sessionName,
    secret: env.sessionSecret,
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
      secure: env.sessionSecure || isProd,
      sameSite: 'lax',
      maxAge: maxAgeMs,
      path: '/',
    },
  });
}

module.exports = { createSessionMiddleware };
