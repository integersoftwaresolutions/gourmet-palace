const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const env = require('./getEnv')();

function createSessionMiddleware() {
  return session({
    name: env.sessionName,
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: MongoStore.create({
      mongoUrl: env.mongodbUri,
      collectionName: 'sessions',
      ttl: Math.floor(env.sessionMaxAgeMs / 1000),
    }),
    cookie: {
      httpOnly: true,
      secure: env.sessionSecure || env.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: env.sessionMaxAgeMs,
      path: '/',
    },
  });
}

module.exports = { createSessionMiddleware };
