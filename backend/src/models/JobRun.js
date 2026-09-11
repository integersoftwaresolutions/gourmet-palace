const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    source: { type: String, required: true, index: true },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      default: null,
      index: true,
    },
    businessDate: { type: String, required: true, index: true },
    jobType: { type: String, required: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: [
        "QUEUED",
        "RUNNING",
        "COMPLETE",
        "PARTIAL",
        "FAILED",
        "UNAVAILABLE",
      ],
      default: "RUNNING",
    },
    attempts: { type: Number, default: 0 },
    payload: { type: mongoose.Schema.Types.Mixed },
    availableAt: Date,
    leaseUntil: Date,
    leaseToken: String,
    history: { type: [mongoose.Schema.Types.Mixed], default: [] },
    startedAt: { type: Date, default: Date.now },
    finishedAt: Date,
    nextRetryAt: Date,
    error: String,
    result: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);
module.exports = mongoose.model("JobRun", schema);
