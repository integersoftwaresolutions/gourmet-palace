const test = require('node:test');
const assert = require('node:assert/strict');
const { pacificScheduleState, zonedParts } = require('../src/workers/schedule');

test('PDT maps 12:00 UTC to 5 AM Pacific', () => {
  const s = pacificScheduleState(new Date('2026-07-01T12:00:00Z'));
  assert.equal(s.hour, 5);
  assert.equal(s.date, '2026-07-01');
});

test('PST maps 13:00 UTC to 5 AM Pacific', () => {
  const s = pacificScheduleState(new Date('2026-12-01T13:00:00Z'));
  assert.equal(s.hour, 5);
  assert.equal(s.date, '2026-12-01');
});

test('the alternate DST trigger is outside the 5 AM hour', () => {
  assert.equal(pacificScheduleState(new Date('2026-07-01T13:00:00Z')).hour, 6);
  assert.equal(pacificScheduleState(new Date('2026-12-01T12:00:00Z')).hour, 4);
});

test('zonedParts still supports location-specific business-date calculations', () => {
  const p = zonedParts('America/Los_Angeles', new Date('2026-07-01T00:00:00Z'));
  assert.equal(`${p.year}-${p.month}-${p.day}`, '2026-06-30');
  assert.equal(Number(p.hour), 17);
});
