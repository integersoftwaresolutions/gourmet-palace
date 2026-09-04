const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name must be at most 80 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'manager'],
      default: 'manager',
      index: true,
    },
    /**
     * Assigned locations. Owner/Admin treat empty as "all locations".
     * Managers must have one or more location IDs.
     */
    locationIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Location',
        },
      ],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
      alerts: { type: Boolean, default: true },
      brief: { type: Boolean, default: true },
    },
    /** Set when invited; cleared after first successful sign-in. */
    invitedAt: {
      type: Date,
      default: null,
    },
    /** Incremented on password changes/resets so existing sessions are revoked. */
    sessionVersion: {
      type: Number,
      default: 0,
      select: true,
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
        if (Array.isArray(ret.locationIds)) {
          ret.locationIds = ret.locationIds.map((id) => id.toString());
        }
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

module.exports = mongoose.model('User', userSchema);
