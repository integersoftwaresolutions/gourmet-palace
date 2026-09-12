/** Unwrap CJS/ESM interop so Vercel/bytecode bundles still expose config fields. */
function getEnv() {
  const mod = require('./env');
  const base = mod && (mod.corsOrigin != null || mod.mongodbUri != null) ? mod : (mod && mod.default ? mod.default : mod);
  // Re-apply runtime values after bundling so Vercel and local Node use the same source.
  return {
    ...(base || {}),
    mongodbUri: process.env.MONGODB_URI || process.env.MONGO_URL || base?.mongodbUri,
    sessionSecret: process.env.SESSION_SECRET || base?.sessionSecret,
    fileSigningSecret: process.env.FILE_SIGNING_SECRET || base?.fileSigningSecret,
    openaiApiKey: process.env.OPENAI_API_KEY || base?.openaiApiKey,
  };
}

module.exports = getEnv;
module.exports.getEnv = getEnv;
