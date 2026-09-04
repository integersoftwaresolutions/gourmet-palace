const mongoose = require('mongoose');
const env = require('./getEnv')();

/** Reuse the connection across Vercel serverless invocations in the same isolate. */
const globalCache = globalThis;
if (!globalCache.__gpMongoose) {
  globalCache.__gpMongoose = { conn: null, promise: null };
}

async function connectDB() {
  const cached = globalCache.__gpMongoose;
  if (cached.conn && mongoose.connection.readyState === 1) return cached.conn;

  if (!cached.promise) {
    mongoose.set('strictQuery', true);
    const uri = env.mongodbUri || process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not configured');
    cached.promise = mongoose.connect(uri).then((conn) => {
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
