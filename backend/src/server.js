const app = require('./app');
const env = require('./config/env');
const { connectDB } = require('./config/db');

async function start() {
  try {
    await connectDB();
    const server = app.listen(env.port, () => {
      console.log(`API listening on http://localhost:${env.port}`);
      console.log(`Health: http://localhost:${env.port}/api/v1/health`);
    });
    const shutdown = (signal) => {
      console.log(`${signal} received; closing API server`);
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 15000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
