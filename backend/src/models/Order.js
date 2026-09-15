const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  providerItemId: String,
  name: String,
  category: String,
  quantity: Number,
  grossMoney: Number,
  netMoney: Number,
}, { _id: false });

const schema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true, index: true },
  provider: { type: String, enum: ['square', 'toast'], required: true },
  providerOrderId: { type: String, required: true },
  orderState: { type: String, enum: ['COMPLETED', 'CANCELED'], default: 'COMPLETED' },
  businessDate: { type: String, required: true, index: true },
  sourceTimestamp: Date,
  ingestTimestamp: { type: Date, default: Date.now },
  processingVersion: { type: Number, default: 1 },
  currency: { type: String, default: 'USD' },
  grossMoney: { type: Number, default: 0 },
  netMoney: { type: Number, default: 0 },
  refundMoney: { type: Number, default: 0 },
  voidMoney: { type: Number, default: 0 },
  discountMoney: { type: Number, default: 0 },
  guestCount: { type: Number, default: null },
  channel: {
    type: String,
    enum: ['dine_in', 'takeout', 'delivery', 'third_party', 'direct_online', 'unknown'],
    default: 'unknown',
  },
  /** ticket = real Toast/Square order; day_summary = Sales Summary by-day aggregate row */
  sourceKind: { type: String, enum: ['ticket', 'day_summary'], default: 'ticket' },
  /** When sourceKind=day_summary, number of Toast orders represented by this row */
  summaryOrderCount: { type: Number, default: null },
  items: { type: [itemSchema], default: [] },
  rawRef: { type: String, default: null, select: false },
  status: { type: String, enum: ['COMPLETE', 'PARTIAL'], default: 'COMPLETE' },
}, { timestamps: true });

schema.index({ organizationId: 1, provider: 1, providerOrderId: 1 }, { unique: true });
schema.index({ organizationId: 1, locationId: 1, businessDate: 1 });

module.exports = mongoose.model('Order', schema);
