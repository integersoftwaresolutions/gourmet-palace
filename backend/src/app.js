const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const { connectDB } = require('./config/db');
const { createSessionMiddleware } = require('./config/session');
const routes = require('./routes');
const correlationMiddleware = require('./middlewares/correlation.middleware');
const originGuard = require('./middlewares/originGuard.middleware');
const apiRateLimit = require('./middlewares/apiRateLimit.middleware');
const notFoundMiddleware = require('./middlewares/notFound.middleware');
const errorMiddleware = require('./middlewares/error.middleware');

const app = express();

app.set('trust proxy', 1);

/** Lazy connect for serverless; local `server.js` still connects eagerly before listen. */
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

app.use(helmet());
const allowedOrigins = env.corsOrigin.split(',').map((value) => value.trim()).filter(Boolean);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Origin is not allowed by CORS'));
    },
    credentials: true,
  }),
);
morgan.token('safe-url', (req) => req.originalUrl?.split('?')[0] || req.url?.split('?')[0] || '');
app.use(morgan(env.nodeEnv === 'production' ? ':remote-addr - :remote-user [:date[clf]] \" :method :safe-url HTTP/:http-version\" :status :res[content-length] \"-\" \":user-agent\"' : ':method :safe-url :status :response-time ms'));
app.use(express.json({ limit: '32mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(originGuard);
app.use(correlationMiddleware);
app.use(createSessionMiddleware());

app.use('/api/v1', apiRateLimit, routes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
