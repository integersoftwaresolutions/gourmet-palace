const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Location name is required'],
      trim: true,
      maxlength: 120,
    },
    address: {
      type: String,
      trim: true,
      default: '',
      maxlength: 240,
    },
    timezone: {
      type: String,
      required: true,
      default: 'America/Los_Angeles',
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        if (ret.organizationId) {
          ret.organizationId = ret.organizationId.toString();
        }
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

locationSchema.index(
  { organizationId: 1, name: 1 },
  { unique: true },
);

module.exports = mongoose.model('Location', locationSchema);
