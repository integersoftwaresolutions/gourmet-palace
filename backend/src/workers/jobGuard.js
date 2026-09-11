const JobRun = require('../models/JobRun');

/**
 * Claim one durable execution slot.
 *
 * Default behavior: an existing slot never runs again, except that a stale
 * RUNNING row can be reclaimed. Callers may explicitly permit retries for
 * selected terminal statuses and cap the total number of attempts.
 */
async function runOnce({
  organizationId,
  locationId = null,
  source = 'scheduler',
  businessDate,
  jobType,
  idempotencyKey,
  staleAfterMs = 45 * 60 * 1000,
  retryStatuses = [],
  maxAttempts = 1,
  task,
}) {
  const now = new Date();
  let existing = await JobRun.findOne({ idempotencyKey });
  let job = null;

  if (existing) {
    const started = existing.startedAt ? new Date(existing.startedAt).getTime() : 0;
    const staleRunning = existing.status === 'RUNNING' && (existing.leaseUntil ? new Date(existing.leaseUntil).getTime() < Date.now() : started && Date.now() - started > staleAfterMs);
    const retryableTerminal = retryStatuses.includes(existing.status) && Number(existing.attempts || 0) < maxAttempts;

    if (!staleRunning && !retryableTerminal) {
      return { executed: false, status: existing.status, result: existing.result || {}, jobId: existing.id, attempts: existing.attempts || 0 };
    }

    job = await JobRun.findOneAndUpdate(
      { _id: existing._id, status: existing.status, attempts: existing.attempts },
      {
        $set: { status: 'RUNNING', startedAt: now, leaseUntil: new Date(Date.now() + staleAfterMs), finishedAt: null, error: null, nextRetryAt: null },
        $inc: { attempts: 1 },
      },
      { new: true },
    );
    if (!job) {
      existing = await JobRun.findOne({ idempotencyKey });
      return { executed: false, status: existing?.status || 'RUNNING', result: existing?.result || {}, jobId: existing?.id, attempts: existing?.attempts || 0 };
    }
  } else {
    try {
      job = await JobRun.create({
        organizationId,
        source,
        locationId,
        businessDate,
        jobType,
        idempotencyKey,
        status: 'RUNNING',
        attempts: 1,
        startedAt: now,
        leaseUntil: new Date(Date.now() + staleAfterMs),
      });
    } catch (err) {
      if (err?.code === 11000) {
        existing = await JobRun.findOne({ idempotencyKey });
        return { executed: false, status: existing?.status || 'RUNNING', result: existing?.result || {}, jobId: existing?.id, attempts: existing?.attempts || 0 };
      }
      throw err;
    }
  }

  const heartbeat = setInterval(() => {
    JobRun.updateOne({ _id: job._id, status: 'RUNNING', attempts: job.attempts }, { $set: { leaseUntil: new Date(Date.now() + staleAfterMs) } }).catch(console.error);
  }, 30000);
  heartbeat.unref();
  try {
    const outcome = await task();
    const requested = outcome?.jobStatus;
    const status = ['COMPLETE', 'PARTIAL', 'UNAVAILABLE'].includes(requested) ? requested : 'COMPLETE';
    const result = outcome?.result !== undefined ? outcome.result : outcome;
    job.status = status;
    job.result = result || {};
    job.finishedAt = new Date();
    job.nextRetryAt = null;
    job.history = [...(job.history || []), { attempt: job.attempts, startedAt: now, finishedAt: job.finishedAt, status, result: job.result }];
    await job.save();
    return { executed: true, status, result: result || {}, jobId: job.id, attempts: job.attempts || 1 };
  } catch (err) {
    job.status = 'FAILED';
    job.error = String(err?.message || err).slice(0, 1000);
    job.finishedAt = new Date();
    job.history = [...(job.history || []), { attempt: job.attempts, startedAt: now, finishedAt: job.finishedAt, status: 'FAILED', error: job.error }];
    await job.save().catch(() => {});
    throw err;
  } finally { clearInterval(heartbeat); }
}

module.exports = { runOnce };
