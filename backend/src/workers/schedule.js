const PACIFIC_TIME_ZONE = 'America/Los_Angeles';

function zonedParts(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

function pacificParts(now = new Date()) {
  return zonedParts(PACIFIC_TIME_ZONE, now);
}

function pacificScheduleState(now = new Date()) {
  const p = pacificParts(now);
  const date = `${p.year}-${p.month}-${p.day}`;
  return { date, hour: Number(p.hour), minute: Number(p.minute) };
}

module.exports = { PACIFIC_TIME_ZONE, zonedParts, pacificParts, pacificScheduleState };
