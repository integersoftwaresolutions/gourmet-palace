const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null, index: true },
  provider: { type: String, enum: ['square', 'toast', 'google'], required: true, index: true },
  businessDate: { type: String, required: true, index: true },
  capability: { type: String, required: true, default: 'default' },
  rawRef: { type: String, default: null, select: false },
  contentHash: { type: String, default: null },
  recordCount: { type: Number, default: 0 },
  sourceTimestamp: { type: Date, default: null },
  ingestTimestamp: { type: Date, default: Date.now },
  processingVersion: { type: Number, default: 1 },
  status: { type: String, enum: ['RECEIVED', 'PROCESSED', 'PARTIAL', 'FAILED'], default: 'RECEIVED', index: true },
  error: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

schema.index({ organizationId: 1, provider: 1, locationId: 1, businessDate: 1, capability: 1, processingVersion: 1 }, { unique: true });
module.exports = mongoose.model('RawIngestEvent', schema);
