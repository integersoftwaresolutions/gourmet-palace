const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

async function runSync(mapping, response, ok = true) {
  const writes = [];
  const calls = [];
  const conn = { secretRef: 'test', mappings: { locations: { sherman: mapping } }, save: async () => {} };
  const job = { save: async () => {} };
  const dependencies = {
    '../../models/Connection': { findOne: () => ({ select: async () => conn }) },
    '../../models/Location': { findOne: async () => ({ _id: 'sherman' }) },
    '../../models/SeoMetric': { findOneAndUpdate: async (filter, values) => { writes.push({ ...filter, ...values }); } },
    '../../models/Review': {},
    '../../models/JobRun': { findOneAndUpdate: async () => job },
    '../../utils/ApiError': require('../src/utils/ApiError'),
    '../../config/env': {},
    '../../services/providerSecrets': { get: async () => ({ accessToken: 'test' }) },
    '../../utils/dateRange': require('../src/utils/dateRange'),
  };
  const context = { module: { exports: {} }, require: (name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`);
    return dependencies[name];
  }, fetch: async (url) => { calls.push(url); return { ok, status: ok ? 200 : 403, json: async () => response }; } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/modules/integrations/google.service.js'), 'utf8'), context);
  const result = await context.module.exports.googleSync({ organizationId: 'org', locationId: 'sherman', from: '2026-09-08', to: '2026-09-08' });
  return { result, conn, job, writes, calls };
}

test('unmapped location cannot report a successful import', async () => {
  const { result, conn, writes, calls } = await runSync({}, {});
  assert.equal(result.sources.ga4.status, 'UNMAPPED');
  assert.equal(conn.status, 'PARTIAL');
  assert.equal(conn.lastSuccessAt, undefined);
  assert.equal(calls.length, 0);
  assert.ok(writes.every(row => row.status === 'UNAVAILABLE' && row.freshnessAt === null));
});

test('empty GA4 response differs from an imported zero and a provider failure', async () => {
  const empty = await runSync({ ga4PropertyId: '123' }, { rows: [] });
  assert.equal(empty.result.sources.ga4.status, 'NO_DATA');
  assert.equal(empty.conn.lastSuccessAt, undefined);
  const imported = await runSync({ ga4PropertyId: '123' }, { rows: [{ dimensionValues: [{ value: '20260908' }], metricValues: [{ value: '0' }, { value: '0' }, { value: '0' }] }] });
  assert.equal(imported.result.sources.ga4.status, 'IMPORTED');
  assert.equal(imported.result.sources.ga4.daysImported, 1);
  assert.ok(imported.conn.lastSuccessAt);
  assert.equal(imported.writes[0].metrics.sessions, 0);
  assert.match(imported.calls[0], /properties\/123:runReport/);
  const failed = await runSync({ ga4PropertyId: '123' }, { error: { message: 'Access denied' } }, false);
  assert.equal(failed.result.sources.ga4.status, 'ERROR');
  assert.equal(failed.result.errors.ga4, 'Access denied');
  assert.equal(failed.conn.lastSuccessAt, undefined);
});
