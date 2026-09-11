const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, required: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, required: true },
  owner: String,
  leaseUntil: Date,
  manualNextAt: Date,
}, { timestamps: true });
schema.index({ organizationId: 1, locationId: 1 }, { unique: true });
module.exports = mongoose.model('SquareSyncState', schema);
