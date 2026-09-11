const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, required: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, required: true },
  owner: String,
  leaseUntil: Date,
  manualNextAt: Date,
  reviews: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
schema.index({ organizationId: 1, locationId: 1 }, { unique: true });
module.exports = mongoose.model('GoogleSyncState', schema);
