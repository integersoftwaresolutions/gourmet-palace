const test = require('node:test');
const assert = require('node:assert/strict');
const {
  classify,
  relativeRange,
  questionTimeRange,
  scopedTimeQuery,
  resolveTimeScope,
  hasTimeIntent,
  isFutureObservedRange,
  matchLocationName,
  resolveLocationMention,
  latestCompleteDay,
  monthRange,
  explicitRollingRange,
} = require('../src/modules/chat/chat.service');
const { addDays, todayUtc } = require('../src/utils/dateRange');

test('classify keeps this-week performance out of forecast unless forecast words appear', () => {
  assert.equal(classify('What is this week performance for Sherman Oaks?'), 'business_performance');
  assert.equal(classify('What is the expected forecast this week?'), 'forecast_comparison');
  assert.equal(classify('Compare Q2 to Q1'), 'forecast_comparison');
});

test('relative ranges resolve yesterday and withhold tomorrow as future', () => {
  const latest = latestCompleteDay();
  assert.deepEqual(relativeRange('Only of yesterday?'), { from: latest, to: latest });
  const tomorrow = relativeRange('performance of sherman oaks tomorrow');
  assert.equal(tomorrow.from, addDays(todayUtc(), 1));
  assert.equal(isFutureObservedRange(tomorrow), true);
  assert.equal(isFutureObservedRange({ from: latest, to: latest }), false);
});

test('previous/prior/past week synonyms resolve like last week', () => {
  const latest = latestCompleteDay();
  const thisMon = (() => {
    const d = new Date(`${latest}T00:00:00Z`);
    const dow = (d.getUTCDay() + 6) % 7;
    return addDays(latest, -dow);
  })();
  const expected = { from: addDays(thisMon, -7), to: addDays(thisMon, -1) };
  assert.deepEqual(relativeRange('sales of previous week'), expected);
  assert.deepEqual(relativeRange('sales for the prior week'), expected);
  assert.deepEqual(relativeRange('sales last week'), expected);
  assert.deepEqual(relativeRange('sales over the past week'), expected);
});

test('question time overrides a multi-year header custom range', () => {
  const header = { from: '2024-01-01', to: '2026-09-02', locationId: 'loc1' };
  const q = scopedTimeQuery('What is the performance of sherman oaks yesterday?', header);
  const latest = latestCompleteDay();
  assert.equal(q.from, latest);
  assert.equal(q.to, latest);
  assert.equal(q.locationId, 'loc1');
  assert.equal(q.preset, undefined);

  const rolling = scopedTimeQuery('Show vendor spending over the last 90 days', header);
  assert.equal(rolling.to, latest);
  assert.equal(rolling.from, addDays(latest, -89));

  const july = monthRange('Summarize July 2025');
  assert.deepEqual(july, { from: '2025-07-01', to: '2025-07-31' });
  assert.deepEqual(explicitRollingRange('last 7 days'), {
    from: addDays(latest, -6),
    to: latest,
  });
  assert.ok(questionTimeRange('this week'));
  assert.ok(questionTimeRange('last month'));
  assert.ok(questionTimeRange('previous week'));
});

test('unresolved time intent clarifies and does not use header range', () => {
  const header = { from: '2024-01-01', to: '2026-09-02', locationId: 'loc1' };
  assert.equal(hasTimeIntent('sales for the previous fortnight'), true);
  const unclear = resolveTimeScope('tell me sales for the previous fortnight for sherman oaks', header);
  assert.equal(unclear.status, 'clarify');
  assert.equal(unclear.clarify.field, 'period');
  assert.equal(unclear.query, undefined);

  const previousWeek = resolveTimeScope('tell me the sales of previous week for sherman oaks', header);
  assert.equal(previousWeek.status, 'ok');
  assert.equal(previousWeek.periodSource, 'question');
  assert.notEqual(previousWeek.query.from, header.from);

  const bare = resolveTimeScope('how are sales?', header);
  assert.equal(bare.status, 'ok');
  assert.equal(bare.periodSource, 'header');
  assert.equal(bare.query.from, header.from);
  assert.equal(bare.query.to, header.to);
});

test('location names match from the question text including typos', () => {
  const locations = [
    { _id: 'a', name: 'Woodland Hills' },
    { _id: 'b', name: 'Sherman Oaks' },
  ];
  assert.equal(matchLocationName('performance of sherman oaks yesterday', locations).name, 'Sherman Oaks');
  assert.equal(matchLocationName('how did we do?', locations), null);

  const typo = resolveLocationMention('sales of previous week for sherman oals', locations);
  assert.equal(typo.status, 'matched');
  assert.equal(typo.location.name, 'Sherman Oaks');

  const exact = resolveLocationMention('performance of sherman oaks yesterday', locations);
  assert.equal(exact.status, 'matched');
});
