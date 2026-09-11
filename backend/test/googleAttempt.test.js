const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function harness({ createFails = false } = {}) {
  const jobs = [];
  const context = { module: { exports: {} }, console, require: (name) => {
    if (name === 'crypto') return require('crypto');
    if (name === '../models/JobRun') return { create: async (fields) => {
      if (createFails) throw new Error('Database unavailable');
      const job = { ...fields, save: async () => {} };
      jobs.push(job);
      return job;
    } };
    throw new Error(name);
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/workers/googleAttempt.js'), 'utf8'), context);
  return { jobs, record: context.module.exports.recordGoogleAttempt };
}

for (const [stage, message, code] of [
  ['authentication_and_sync', 'Google refresh failed (401): The OAuth client was disabled.', 401],
  ['acquiring_lock', 'Manual refresh cooldown is active', 429],
  ['validating', 'locationId is required', 400],
  ['authentication_and_sync', 'Google is not connected', 409],
]) {
  test(`records early failure: ${message}`, async () => {
    const { record, jobs } = harness();
    await assert.rejects(record({ organizationId: 'org' }, 'google_manual_sync', async (setStage) => {
      assert.equal(jobs.length, 1, 'attempt must be persisted before any work');
      assert.equal(jobs[0].status, 'RUNNING');
      await setStage(stage);
      throw Object.assign(new Error(message), { statusCode: code });
    }), { message });
    assert.equal(jobs[0].status, 'FAILED');
    assert.equal(jobs[0].error, message);
    assert.equal(jobs[0].result.stage, stage);
    assert.equal(jobs[0].result.errorCode, code);
    assert.ok(jobs[0].finishedAt);
    assert.equal(jobs[0].history.length, 1);
  });
}

test('records successes, partial results and skips as separate invocations', async () => {
  const { record, jobs } = harness();
  for (const result of [
    { sources: { ga4: { status: 'IMPORTED' } }, errors: {} },
    { sources: { ga4: { status: 'IMPORTED' }, gsc: { status: 'ERROR' } }, errors: { gsc: 'Access denied' } },
    { skipped: true, skipReason: 'already_completed' },
  ]) await record({ organizationId: 'org' }, 'google_sync', async () => result);
  assert.deepEqual(jobs.map((job) => job.status), ['COMPLETE', 'PARTIAL', 'UNAVAILABLE']);
  assert.equal(new Set(jobs.map((job) => job.idempotencyKey)).size, 3);
  assert.match(jobs[1].error, /gsc: Access denied/);
  assert.equal(jobs[2].result.stage, 'skipped');
});

test('does not start provider work when the initial log cannot be saved', async () => {
  const { record } = harness({ createFails: true });
  let called = false;
  await assert.rejects(record({ organizationId: 'org' }, 'google_sync', async () => { called = true; }), /Database unavailable/);
  assert.equal(called, false);
});
