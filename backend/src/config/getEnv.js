/** Unwrap CJS/ESM interop so Vercel/bytecode bundles still expose config fields. */
function getEnv() {
  const mod = require('./env');
  if (mod && (mod.corsOrigin != null || mod.mongodbUri != null)) return mod;
  if (mod && mod.default && (mod.default.corsOrigin != null || mod.default.mongodbUri != null)) return mod.default;
  return mod || {};
}

module.exports = getEnv;
module.exports.getEnv = getEnv;
