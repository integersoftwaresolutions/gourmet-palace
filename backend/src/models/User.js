const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
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
     * Existing records are treated as legacy so the current Gourmet Palace
     * organization/admin and invited accounts continue working without a DB migration.
     */
    accountOrigin: {
      type: String,
      enum: ['legacy', 'self', 'invite'],
      default: 'legacy',
      index: true,
    },
    /** Self-registered users must verify their email before they can sign in. */
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    /** Set after a self-registered owner creates the organization + first location. */
    onboardingCompletedAt: {
      type: Date,
      default: null,
    },
    /** Server-only resend throttle. */
    verificationEmailLastSentAt: {
      type: Date,
      default: null,
      select: false,
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
    /** Set when invited; cleared after first successful activation/sign-in. */
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
        } else {
          ret.organizationId = null;
        }
        if (Array.isArray(ret.locationIds)) {
          ret.locationIds = ret.locationIds.map((id) => id.toString());
        }

        const isSelfRegistered = ret.accountOrigin === 'self';
        ret.emailVerified = isSelfRegistered ? Boolean(ret.emailVerifiedAt) : true;
        ret.onboardingComplete = isSelfRegistered
          ? Boolean(ret.organizationId && ret.onboardingCompletedAt)
          : Boolean(ret.organizationId);

        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.sessionVersion;
        delete ret.verificationEmailLastSentAt;
        delete ret.accountOrigin;
        return ret;
      },
    },
  },
);

module.exports = mongoose.model('User', userSchema);
