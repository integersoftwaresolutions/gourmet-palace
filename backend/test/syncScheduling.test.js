const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function load(file, deps, globals = {}) {
  const context = {
    module: { exports: {} }, console, setInterval, clearInterval,
    ...globals,
    require: (name) => {
      if (!(name in deps)) throw new Error(`Unexpected dependency: ${name}`);
      return deps[name];
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), context);
  return context.module.exports;
}

function queryResult(value) {
  return { select: () => ({ lean: async () => value }), lean: async () => value };
}

test('daily refresh isolates provider errors and still evaluates alerts', async () => {
  let alerts = 0;
  const daily = load('workers/daily.worker.js', {
    '../models/Organization': {}, '../models/Location': {}, '../models/Connection': {},
    '../modules/integrations/integrations.service': {
      squareSync: async () => ({ sourceClosed: true }),
      googleSync: async () => ({ errors: { gsc: 'Provider unavailable' }, sources: { ga4: { status: 'IMPORTED' }, gsc: { status: 'ERROR' } } }),
    },
    '../modules/briefs/briefs.service': {},
    '../modules/alerts/evaluate.service': { evaluateLocation: async () => { alerts += 1; } },
    '../utils/dateRange': require('../src/utils/dateRange'),
    './businessDate': require('../src/workers/businessDate'),
    './schedule': require('../src/workers/schedule'),
    './jobGuard': { runOnce: async ({ task }) => task() },
  });
  const result = await daily.runDailyRefresh({
    org: { _id: 'org' }, loc: { _id: 'loc', name: 'Store', timezone: 'America/Los_Angeles' },
    square: {}, google: {}, pacificDate: '2026-09-10', now: new Date('2026-09-10T12:00:00Z'),
  });
  assert.equal(result.jobStatus, 'PARTIAL');
  assert.equal(result.result.errors['google.gsc'], 'Provider unavailable');
  assert.equal(alerts, 1);
});

test('Vercel dual UTC triggers execute only at 5 AM Pacific in PDT and PST', async () => {
  let orgQueries = 0;
  const daily = load('workers/daily.worker.js', {
    '../models/Organization': { find: () => { orgQueries += 1; return queryResult([]); } },
    '../models/Location': {}, '../models/Connection': {},
    '../modules/integrations/integrations.service': {}, '../modules/briefs/briefs.service': {}, '../modules/alerts/evaluate.service': {},
    '../utils/dateRange': require('../src/utils/dateRange'), './businessDate': require('../src/workers/businessDate'),
    './schedule': require('../src/workers/schedule'), './jobGuard': { runOnce: async ({ task }) => task() },
  });

  const summer12 = await daily.runVercelDaily({ now: '2026-09-10T12:00:00Z' });
  const summer13 = await daily.runVercelDaily({ now: '2026-09-10T13:00:00Z' });
  assert.equal(summer12.skipped, false);
  assert.equal(summer13.skipped, true);

  const winter12 = await daily.runVercelDaily({ now: '2026-12-10T12:00:00Z' });
  const winter13 = await daily.runVercelDaily({ now: '2026-12-10T13:00:00Z' });
  assert.equal(winter12.skipped, true);
  assert.equal(winter13.skipped, false);
  assert.equal(orgQueries, 2);
});

test('manual refresh runs available providers concurrently and reports partial failures', async () => {
  const daily = load('workers/daily.worker.js', {
    '../models/Organization': {},
    '../models/Location': { findOne: () => ({ select: () => ({ lean: async () => ({ _id: 'loc', name: 'Store', timezone: 'America/Los_Angeles' }) }) }) },
    '../models/Connection': { find: () => ({ lean: async () => [{ provider: 'square', status: 'READY' }, { provider: 'google', status: 'READY' }] }) },
    '../modules/integrations/integrations.service': {
      squareManualSync: async () => ({ sourceClosed: true }),
      googleManualSync: async () => ({ errors: { reviews: 'Review API unavailable' }, sources: { ga4: { status: 'IMPORTED' }, reviews: { status: 'ERROR' } } }),
    },
    '../modules/briefs/briefs.service': {},
    '../modules/alerts/evaluate.service': { evaluateLocation: async () => {} },
    '../utils/dateRange': require('../src/utils/dateRange'), './businessDate': require('../src/workers/businessDate'),
    './schedule': require('../src/workers/schedule'), './jobGuard': { runOnce: async ({ task }) => task() },
  });
  const result = await daily.runManualRefresh({ organizationId: 'org', locationId: 'loc' });
  assert.equal(result.status, 'PARTIAL');
  assert.equal(result.sources.square.status, 'COMPLETE');
  assert.equal(result.sources.google.status, 'PARTIAL');
  assert.equal(result.errors['google.reviews'], 'Review API unavailable');
});

test('manual refresh does not report success when no data provider is connected', async () => {
  const daily = load('workers/daily.worker.js', {
    '../models/Organization': {},
    '../models/Location': { findOne: () => ({ select: () => ({ lean: async () => ({ _id: 'l1', name: 'Location', timezone: 'America/Los_Angeles' }) }) }) },
    '../models/Connection': { find: () => ({ lean: async () => [] }) },
    '../modules/integrations/integrations.service': {},
    '../modules/briefs/briefs.service': {},
    '../modules/alerts/evaluate.service': { evaluateLocation: async () => {} },
    '../utils/dateRange': { addDays: (d) => d },
    './businessDate': { completedBusinessDateFromParts: () => '2026-09-09' },
    './schedule': { zonedParts: () => ({ year: '2026', month: '09', day: '10', hour: '05' }), pacificScheduleState: () => ({ date: '2026-09-10', hour: 5, minute: 0 }) },
    './jobGuard': { runOnce: async () => ({}) },
  });
  const result = await daily.runManualRefresh({ organizationId: 'o1', locationId: 'l1' });
  assert.equal(result.status, 'UNAVAILABLE');
});

test('scheduled Square partial reconciliation makes the daily refresh partial', async () => {
  const daily = load('workers/daily.worker.js', {
    '../models/Organization': {}, '../models/Location': {}, '../models/Connection': {},
    '../modules/integrations/integrations.service': {
      squareSync: async () => ({ sourceClosed: true, paymentsStatus: 'COMPLETE', reconciliation: { netSales: { pass: false } } }),
    },
    '../modules/briefs/briefs.service': {},
    '../modules/alerts/evaluate.service': { evaluateLocation: async () => {} },
    '../utils/dateRange': { addDays: (d) => d },
    './businessDate': { completedBusinessDateFromParts: () => '2026-09-09' },
    './schedule': { zonedParts: () => ({ year: '2026', month: '09', day: '10', hour: '05' }), pacificScheduleState: () => ({ date: '2026-09-10', hour: 5, minute: 0 }) },
    './jobGuard': { runOnce: async ({ task }) => { const out = await task(); return { status: out.jobStatus, result: out.result }; } },
  });
  const result = await daily.runDailyRefresh({ org: { _id: 'o1' }, loc: { _id: 'l1', name: 'Location', timezone: 'America/Los_Angeles' }, square: {}, google: null, pacificDate: '2026-09-10', now: new Date('2026-09-10T12:00:00Z') });
  assert.equal(result.status, 'PARTIAL');
  assert.ok(result.result.errors.square);
});

test('Google lock excludes simultaneous callers and atomically enforces manual cooldown', async () => {
  let state;
  const model = {
    init: async () => {},
    findOneAndUpdate: async (filter, update) => {
      if (state && (state.leaseUntil > new Date() || (filter.$and && state.manualNextAt > new Date()))) throw Object.assign(new Error('duplicate key'), { code: 11000 });
      state = { ...state, ...update.$set };
      return state;
    },
    updateOne: async (filter, update) => { if (state.owner === filter.owner) Object.assign(state, update.$set); },
  };
  const { withGoogleLock } = load('workers/googleLock.js', {
    crypto: require('crypto'), '../models/GoogleSyncState': model, '../utils/ApiError': require('../src/utils/ApiError'),
  }, { process });
  let release;
  const first = withGoogleLock({ organizationId: 'org', locationId: 'loc', manual: true }, () => new Promise((resolve) => { release = resolve; }));
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(withGoogleLock({ organizationId: 'org', locationId: 'loc' }, async () => {}), { statusCode: 429 });
  release();
  await first;
  await assert.rejects(withGoogleLock({ organizationId: 'org', locationId: 'loc', manual: true }, async () => {}), { statusCode: 429 });
});

test('Square lock excludes overlap and enforces manual cooldown', async () => {
  let state;
  const model = {
    init: async () => {},
    findOneAndUpdate: async (filter, update) => {
      if (state && (state.leaseUntil > new Date() || (filter.$and && state.manualNextAt > new Date()))) throw Object.assign(new Error('duplicate key'), { code: 11000 });
      state = { ...state, ...update.$set };
      return state;
    },
    updateOne: async (filter, update) => { if (state.owner === filter.owner) Object.assign(state, update.$set); },
  };
  const { withSquareLock } = load('workers/squareLock.js', {
    crypto: require('crypto'), '../models/SquareSyncState': model, '../utils/ApiError': require('../src/utils/ApiError'),
  }, { process });
  let release;
  const first = withSquareLock({ organizationId: 'org', locationId: 'loc', manual: true }, () => new Promise((resolve) => { release = resolve; }));
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(withSquareLock({ organizationId: 'org', locationId: 'loc' }, async () => {}), { statusCode: 429 });
  release();
  await first;
  await assert.rejects(withSquareLock({ organizationId: 'org', locationId: 'loc', manual: true }, async () => {}), { statusCode: 429 });
});
