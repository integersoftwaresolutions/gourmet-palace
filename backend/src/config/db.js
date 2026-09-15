const mongoose = require('mongoose');
const env = require('./getEnv')();

/** Reuse the connection across Vercel serverless invocations in the same isolate. */
const globalCache = globalThis;
if (!globalCache.__gpMongoose) {
  globalCache.__gpMongoose = { conn: null, promise: null };
}

function mongoUri() {
  return env.mongodbUri || '';
}

async function connectDB() {
  const cached = globalCache.__gpMongoose;
  if (cached.conn && mongoose.connection.readyState === 1) return cached.conn;

  if (!cached.promise) {
    const uri = mongoUri();
    if (!uri) throw new Error('MONGODB_URI is not configured');
    mongoose.set('strictQuery', true);
    cached.promise = mongoose.connect(uri, {
      maxPoolSize: 10,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 120000,
      connectTimeoutMS: 30000,
      retryWrites: true,
    }).then((conn) => {
      console.log(`MongoDB connected: ${conn.connection.host}`);
      return conn;
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
}

module.exports = { connectDB };
