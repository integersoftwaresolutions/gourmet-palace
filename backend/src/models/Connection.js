const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  provider: { type: String, enum: ['square', 'google', 'toast'], required: true, index: true },
  status: { type: String, enum: ['READY', 'PARTIAL', 'UNAVAILABLE', 'ERROR'], default: 'UNAVAILABLE' },

  // secretRef is the only pointer used by integration code. On Vercel it points
  // to an AES-GCM encrypted payload stored in this same MongoDB document.
  secretRef: { type: String, default: null, select: false },
  secretPayloadEnc: { type: String, default: null, select: false },

  // Legacy fields retained only for backward compatibility with older rows.
  accessTokenEnc: { type: String, select: false, default: null },
  refreshTokenEnc: { type: String, select: false, default: null },

  expiresAt: { type: Date, default: null },
  scopes: { type: [String], default: [] },
  capabilities: { type: mongoose.Schema.Types.Mixed, default: {} },
  mappings: { type: mongoose.Schema.Types.Mixed, default: {} },
  lastSuccessAt: { type: Date, default: null },
  lastError: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

schema.index({ organizationId: 1, provider: 1 }, { unique: true });
module.exports = mongoose.model('Connection', schema);
