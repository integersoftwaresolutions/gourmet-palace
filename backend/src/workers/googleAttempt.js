const { randomUUID } = require('crypto');
const JobRun = require('../models/JobRun');

// Record the request before validation, lock acquisition or OAuth can fail.
// Provider jobs remain separate: this record describes the entire invocation.
async function recordGoogleAttempt(args, jobType, task) {
  const startedAt = new Date();
  const job = await JobRun.create({
    organizationId: args.organizationId,
    locationId: /^[a-f\d]{24}$/i.test(String(args.locationId || '')) ? args.locationId : null,
    source: 'google', jobType: `${jobType}_attempt`,
    businessDate: /^\d{4}-\d{2}-\d{2}$/.test(String(args.to || '')) ? args.to : startedAt.toISOString().slice(0, 10),
    idempotencyKey: `google:attempt:${randomUUID()}`,
    status: 'RUNNING', attempts: 1, startedAt,
    result: { stage: 'accepted' },
  });
  const stage = async (name) => {
    job.result = { stage: name };
    await job.save();
  };
  try {
    const result = await task(stage);
    const sources = Object.values(result?.sources || {});
    const errors = Object.keys(result?.errors || {});
    const status = result?.skipped || result?.status === 'UNMAPPED' || result?.status === 'UNAVAILABLE'
      ? 'UNAVAILABLE'
      : result?.status === 'FAILED' || (errors.length && !sources.some((source) => source.status === 'IMPORTED'))
        ? 'FAILED'
        : result?.hasMore || result?.status === 'PARTIAL' || errors.length || sources.some((source) => source.status !== 'IMPORTED')
          ? 'PARTIAL' : 'COMPLETE';
    job.status = status;
    job.result = { stage: result?.skipped ? 'skipped' : 'finished', ...(result || {}) };
    if (result?.range?.to) job.businessDate = result.range.to;
    job.error = errors.length ? Object.entries(result.errors).map(([source, message]) => `${source}: ${message}`).join('; ').slice(0, 1000) : null;
    job.finishedAt = new Date();
    job.history = [{ attempt: 1, startedAt, finishedAt: job.finishedAt, status, error: job.error, result: job.result }];
    await job.save();
    return result;
  } catch (error) {
    job.status = 'FAILED';
    job.error = String(error.message || error).slice(0, 1000);
    job.result = { ...job.result, errorCode: error.statusCode || error.status || null };
    job.finishedAt = new Date();
    job.history = [{ attempt: 1, startedAt, finishedAt: job.finishedAt, status: 'FAILED', error: job.error, result: job.result }];
    try { await job.save(); }
    catch (logError) {
      console.error('[google:attempt-log-failed]', String(job._id), String(logError.message));
      throw new Error('Google sync failed and its final job status could not be saved. Check server logs.');
    }
    throw error;
  }
}
module.exports = { recordGoogleAttempt };
