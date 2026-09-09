const Organization = require('../models/Organization');
const Location = require('../models/Location');
const Connection = require('../models/Connection');
const integrations = require('../modules/integrations/integrations.service');
const briefs = require('../modules/briefs/briefs.service');
const alerts = require('../modules/alerts/evaluate.service');
const { addDays } = require('../utils/dateRange');
const { completedBusinessDateFromParts } = require('./businessDate');

function zonedParts(timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

function priorBusinessDate(timeZone, cutoffHour = 4) {
  const p = zonedParts(timeZone);
  return completedBusinessDateFromParts(p, cutoffHour);
}

function pacificParts() { return zonedParts('America/Los_Angeles'); }

async function runCycle(options = {}) {
  const ignoreTimeWindow = Boolean(options.ignoreTimeWindow);
  const pt = pacificParts();
  const pacificDate = `${pt.year}-${pt.month}-${pt.day}`;
  const briefBusinessDate = addDays(pacificDate, -1);
  const hour = Number(pt.hour), minute = Number(pt.minute);
  // Local 5-minute worker uses this Pacific window. Vercel Cron calls with ignoreTimeWindow
  // so the schedule (e.g. 5 AM Pakistan) controls when work actually runs.
  if (!ignoreTimeWindow && (hour < 3 || hour > 7 || (hour === 3 && minute < 30))) return;

  const orgs = await Organization.find({}).select('_id');
  for (const org of orgs) {
    const connections = await Connection.find({ organizationId: org._id });
    const square = connections.find((c) => c.provider === 'square' && ['READY', 'PARTIAL', 'ERROR'].includes(c.status));
    const google = connections.find((c) => c.provider === 'google' && ['READY', 'PARTIAL', 'ERROR'].includes(c.status));
    const locations = await Location.find({ organizationId: org._id, status: 'active' });

    for (const loc of locations) {
      const businessDate = priorBusinessDate(loc.timezone || 'America/Los_Angeles');
      if (square) {
        try { await integrations.squareSync({ organizationId: org._id, locationId: loc._id, businessDate, force: false }); }
        catch (e) { console.error('[worker:square]', loc.name, e.message); }
      }
      try { await alerts.evaluateLocation({ organizationId: org._id, locationId: loc._id, businessDate }); }
      catch (e) { console.error('[worker:alerts]', loc.name, e.message); }
      if (google) {
        try { await integrations.googleSync({ organizationId: org._id, locationId: loc._id, preset: '7d' }); }
        catch (e) { console.error('[worker:google]', loc.name, e.message); }
      }
    }

    if (ignoreTimeWindow || hour > 5 || (hour === 5 && minute >= 0)) {
      try { await briefs.generateDailyForOrganization(org._id, briefBusinessDate); }
      catch (e) { console.error('[worker:brief]', e.message); }
    }
  }
}

module.exports = { runCycle, priorBusinessDate, zonedParts };
