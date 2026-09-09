const crypto = require('crypto');
const ChatMessage = require('../../models/ChatMessage');
const analytics = require('../analytics/analytics.service');
const Invoice = require('../../models/Invoice');
const InventoryItem = require('../../models/InventoryItem');
const Location = require('../../models/Location');
const PriceObservation = require('../../models/PriceObservation');
const env = require('../../config/env');
const { applyScope } = require('../../utils/scope');
const { parseRange, addDays, todayUtc } = require('../../utils/dateRange');
const ApiError = require('../../utils/ApiError');

function classify(question) {
  const s = String(question || '').toLowerCase();
  if (/vendor|invoice|inventory|stock|food.?cost|ingredient/.test(s)) return 'cost_vendor_invoice_inventory';
  if (/review|seo|search|direct order|google/.test(s)) return 'reviews_seo_direct';
  if (/forecast|expected|compar(?:e|ison)|quarter|\bq[1-4]\b/.test(s)) return 'forecast_comparison';
  if (/refund|void|discount|alert|exception/.test(s)) return 'exceptions';
  if (/menu|item|category|selling/.test(s)) return 'menu_performance';
  return 'business_performance';
}

function quarterRange(text) {
  const m = String(text || '').match(/q([1-4])\s*(?:20)?(\d{2,4})?/i);
  if (!m) return null;
  const quarter = Number(m[1]);
  let year = m[2] ? Number(m[2]) : new Date().getUTCFullYear();
  if (year < 100) year += 2000;
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const endDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  return {
    from: `${year}-${String(startMonth).padStart(2, '0')}-01`,
    to: `${year}-${String(endMonth).padStart(2, '0')}-${endDay}`,
  };
}

function monthRange(text) {
  const months = { january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11 };
  const match = String(text || '').toLowerCase().match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b(?:\s+(20\d{2}))?/);
  if (!match) return null;
  const month = months[match[1]]; const now = new Date(); let year = match[2] ? Number(match[2]) : now.getUTCFullYear();
  if (!match[2] && month > now.getUTCMonth()) year -= 1;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const from = `${year}-${String(month+1).padStart(2,'0')}-01`;
  let to = `${year}-${String(month+1).padStart(2,'0')}-${String(last).padStart(2,'0')}`;
  // A current-month summary must not imply future days contain observed data.
  if (year === now.getUTCFullYear() && month === now.getUTCMonth()) to = addDays(todayUtc(), -1);
  return { from, to };
}
function explicitRollingRange(text) {
  const match = String(text || '').toLowerCase().match(/(?:last|past|previous|prior|over\s+the\s+(?:last|past))\s+(\d{1,3})\s+days?/);
  if (!match) return null;
  const days = Math.min(370, Math.max(1, Number(match[1])));
  const to = addDays(todayUtc(), -1);
  return { from: addDays(to, -(days - 1)), to };
}
function isoDateRange(text) {
  const match = String(text || '').match(/\b(20\d{2}-\d{2}-\d{2})\b(?:\s*(?:to|through|until|–|-|—)\s*\b(20\d{2}-\d{2}-\d{2})\b)?/i);
  if (!match) return null;
  const from = match[1];
  const to = match[2] || match[1];
  return from <= to ? { from, to } : { from: to, to: from };
}
function latestCompleteDay() { return addDays(todayUtc(), -1); }
function mondayOf(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(isoDate, -dow);
}
function priorCalendarMonth(latest) {
  const d = new Date(`${latest}T00:00:00Z`);
  const year = d.getUTCMonth() === 0 ? d.getUTCFullYear() - 1 : d.getUTCFullYear();
  const month = d.getUTCMonth() === 0 ? 11 : d.getUTCMonth() - 1;
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return { from, to: `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}` };
}
function relativeRange(text) {
  const s = String(text || '').toLowerCase();
  const latest = latestCompleteDay();
  const today = todayUtc();
  if (/\btomorrow\b/.test(s)) return { from: addDays(today, 1), to: addDays(today, 1) };
  if (/\btoday\b/.test(s)) return { from: today, to: today };
  if (/\byesterday\b/.test(s)) return { from: latest, to: latest };
  if (/\b(?:last|previous|prior|past)\s+week\b/.test(s)) {
    const thisMon = mondayOf(latest);
    return { from: addDays(thisMon, -7), to: addDays(thisMon, -1) };
  }
  if (/\b(?:this|current)\s+week\b/.test(s)) return { from: mondayOf(latest), to: latest };
  if (/\b(?:next|coming)\s+week\b/.test(s)) {
    const nextMon = addDays(mondayOf(latest), 7);
    return { from: nextMon, to: addDays(nextMon, 6) };
  }
  if (/\b(?:last|previous|prior|past)\s+month\b/.test(s)) return priorCalendarMonth(latest);
  if (/\b(?:this|current)\s+month\b/.test(s)) return { from: `${latest.slice(0, 8)}01`, to: latest };
  return null;
}
function questionTimeRange(text) {
  return relativeRange(text) || monthRange(text) || explicitRollingRange(text) || isoDateRange(text);
}
/** True when the user implied a period even if we cannot resolve dates. */
function hasTimeIntent(text) {
  const s = String(text || '').toLowerCase();
  if (questionTimeRange(s)) return true;
  // Ignore idioms that look temporal but are not period asks.
  if (/\b(?:past|previous)\s+(?:performance|results?|sales|orders?|data)\b/.test(s)
    && !/\b(?:week|month|year|day|days|quarter|weekend|fortnight)\b/.test(s)
    && !/\b(?:yesterday|today|tomorrow|january|february|march|april|may|june|july|august|september|october|november|december|q[1-4]|20\d{2}-\d{2}-\d{2})\b/.test(s)) {
    return false;
  }
  return (
    /\b(today|tomorrow|yesterday|tonight)\b/.test(s)
    || /\b(?:this|last|previous|prior|past|current|coming|next)\s+(?:week|weeks|month|months|year|years|quarter|quarters|weekend|day|days|fortnight|period)\b/.test(s)
    || /\b(?:for|during|over|in)\s+(?:the\s+)?(?:previous|prior|past|last)\s+[a-z]{3,}\b/.test(s)
    || /\b(?:last|past|previous|prior|over\s+the\s+(?:last|past))\s+\d{1,3}\s+days?\b/.test(s)
    || /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(s)
    || /\bq[1-4]\b/.test(s)
    || /\b20\d{2}-\d{2}-\d{2}\b/.test(s)
    || /\b(?:ytd|mtd|wtd|year[\s-]?to[\s-]?date|month[\s-]?to[\s-]?date|week[\s-]?to[\s-]?date)\b/.test(s)
    || /\b(?:in|for|during|over)\s+the\s+(?:week|month|year|quarter|weekend)\b/.test(s)
    || /\b(?:week|month|year|weekend)\s+(?:of|ending|starting)\b/.test(s)
  );
}
function isFutureObservedRange(query) {
  if (!query?.from) return false;
  return query.from > latestCompleteDay();
}
function normalizePhrase(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function levenshtein(a, b) {
  const s = String(a || '');
  const t = String(b || '');
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const row = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s.length; i += 1) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= t.length; j += 1) {
      const cur = row[j];
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = cur;
    }
  }
  return row[t.length];
}
function tokenSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length >= 4 && b.includes(a)) return 0.92;
  if (b.length >= 4 && a.includes(b)) return 0.92;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return Math.max(0, 1 - dist / maxLen);
}
function scoreLocationAgainstQuestion(question, locationName) {
  const q = normalizePhrase(question);
  const name = normalizePhrase(locationName);
  if (!q || !name) return 0;
  if (q.includes(name)) return 1;
  const nameTokens = name.split(' ').filter((t) => t.length >= 3);
  const qTokens = q.split(' ').filter(Boolean);
  if (!nameTokens.length) return 0;
  let total = 0;
  for (const nt of nameTokens) {
    let best = 0;
    for (const qt of qTokens) best = Math.max(best, tokenSimilarity(nt, qt));
    total += best;
  }
  return total / nameTokens.length;
}
/**
 * Resolve a location mentioned in the question.
 * Exact / high-confidence fuzzy → match. Ambiguous near-miss → clarify. Else none.
 */
function resolveLocationMention(question, locations) {
  const scored = (locations || [])
    .map((loc) => ({ loc, score: scoreLocationAgainstQuestion(question, loc.name) }))
    .filter((row) => row.score >= 0.72)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return { status: 'none' };
  const best = scored[0];
  const second = scored[1];
  const clearWinner = !second || (best.score - second.score) >= 0.1;
  if (best.score >= 0.82 && clearWinner) {
    return { status: 'matched', location: best.loc, score: best.score };
  }
  return {
    status: 'clarify',
    candidates: scored.slice(0, 3).map((row) => ({ id: String(row.loc._id), name: row.loc.name, score: row.score })),
  };
}
/** @deprecated Prefer resolveLocationMention; kept for exact-substring callers/tests. */
function matchLocationName(question, locations) {
  const resolved = resolveLocationMention(question, locations);
  if (resolved.status === 'matched') return resolved.location;
  const q = String(question || '').toLowerCase();
  return (locations || []).find((l) => q.includes(String(l.name || '').toLowerCase())) || null;
}
const PERIOD_CLARIFY_SUGGESTIONS = ['yesterday', 'last week', 'previous week', 'this week', 'last 7 days', 'last month', 'July 2025'];
/**
 * Question-first time scope. Header is only used when the question has no time intent.
 * Unresolved time intent never falls back to the header (avoids multi-year silent answers).
 */
function resolveTimeScope(question, scope = {}) {
  const stated = questionTimeRange(question);
  if (stated) {
    const query = { ...(scope || {}), from: stated.from, to: stated.to };
    delete query.preset;
    return { status: 'ok', query, periodSource: 'question' };
  }
  if (hasTimeIntent(question)) {
    return {
      status: 'clarify',
      periodSource: null,
      reason: 'You asked about a time period I could not resolve confidently, so I did not run tools against the header date range. Please rephrase with a clear period such as yesterday, last week / previous week, this week, last 7 days, last month, or a named month (e.g. July 2025).',
      clarify: { field: 'period', suggestions: PERIOD_CLARIFY_SUGGESTIONS },
    };
  }
  const query = { ...(scope || {}) };
  if (!query.from && !query.preset) {
    query.preset = '30d';
    return { status: 'ok', query, periodSource: 'default' };
  }
  return { status: 'ok', query, periodSource: 'header' };
}
/** Backward-compatible helper: returns query only when time resolves; throws away clarify. Prefer resolveTimeScope. */
function scopedTimeQuery(question, scope) {
  const resolved = resolveTimeScope(question, scope);
  if (resolved.status === 'ok') return resolved.query;
  return { ...(scope || {}) };
}
async function resolveQuestionLocation(auth, question, query) {
  const locations = await Location.find({ organizationId: auth.organizationId, status: 'active' }).select('_id name').lean();
  const mention = resolveLocationMention(question, locations);
  if (mention.status === 'clarify') {
    const names = mention.candidates.map((c) => c.name).join(', ');
    return {
      query,
      clarify: {
        field: 'location',
        reason: `I found a possible location match but need confirmation before filtering. Did you mean ${names}? Reply with the exact location name.`,
        suggestions: mention.candidates.map((c) => c.name),
      },
    };
  }
  if (mention.status !== 'matched') return { query };
  const match = mention.location;
  const id = String(match._id);
  if (!auth.allLocations && !auth.locationIds.includes(id)) {
    return { query, denied: `${match.name} is outside your authorized location scope.` };
  }
  return { query: { ...query, locationId: id }, matchedLocation: { id, name: match.name } };
}
function restricted(reason) {
  return { dataStatus: 'UNAVAILABLE', reason };
}
function clarify(reason, detail = {}) {
  return { dataStatus: 'CLARIFY', reason, clarify: detail };
}

async function toolResult(auth, question, scope = {}) {
  const family = classify(question);
  const time = resolveTimeScope(question, scope);
  if (time.status === 'clarify') {
    return { family, data: clarify(time.reason, time.clarify) };
  }
  let query = time.query;
  const resolved = await resolveQuestionLocation(auth, question, query);
  if (resolved.denied) return { family, data: restricted(resolved.denied) };
  if (resolved.clarify) {
    return { family, data: clarify(resolved.clarify.reason, resolved.clarify) };
  }
  query = resolved.query;
  if (isFutureObservedRange(query)) {
    const latest = latestCompleteDay();
    return { family, data: restricted(`Observed sales are not available for future dates. The latest complete business day is ${latest}.`) };
  }
  const withMeta = (data) => ({
    ...data,
    periodSource: time.periodSource,
    matchedLocation: resolved.matchedLocation || data.matchedLocation || null,
  });

  if (family === 'business_performance') {
    return {
      family,
      data: withMeta({
        performance: await analytics.performance(auth, query),
        dashboard: await analytics.dashboard(auth, query),
      }),
    };
  }

  if (family === 'menu_performance') {
    if (/margin|item\s+cost|profit\s+(?:per|by)\s+item/i.test(question)) {
      return { family, data: restricted('Menu-item margin evidence is unavailable until an approved item-cost mapping exists; V1 does not invent recipe cost.') };
    }
    return { family, data: withMeta(await analytics.performance(auth, query)) };
  }

  if (family === 'exceptions') {
    const [performance, exceptionOrders] = await Promise.all([
      analytics.performance(auth, query),
      analytics.orders(auth, { ...query, exception: 'true', limit: '25' }),
    ]);
    return { family, data: withMeta({ performance, exceptionOrders }) };
  }

  if (family === 'forecast_comparison') {
    const quarterRanges = [...String(question).matchAll(/q[1-4](?:\s*(?:20)?\d{2,4})?/ig)]
      .map((m) => quarterRange(m[0]))
      .filter(Boolean);

    if (quarterRanges.length >= 2) {
      const periodA = await analytics.aggregateMetrics(auth, { ...query, ...quarterRanges[0], preset: undefined });
      const periodB = await analytics.aggregateMetrics(auth, { ...query, ...quarterRanges[1], preset: undefined });
      return {
        family,
        data: withMeta({
          periodA,
          periodB,
          delta: {
            definition: 'Period A minus Period B',
            netSales: periodA.current.netMoney == null || periodB.current.netMoney == null ? null : periodA.current.netMoney - periodB.current.netMoney,
            orders: periodA.current.orderCount == null || periodB.current.orderCount == null ? null : periodA.current.orderCount - periodB.current.orderCount,
          },
        }),
      };
    }

    return {
      family,
      data: withMeta({
        performance: await analytics.aggregateMetrics(auth, query),
        forecasts: (await analytics.forecasts(auth, query)).forecasts,
      }),
    };
  }

  if (family === 'cost_vendor_invoice_inventory') {
    if (!auth.canFinance && /food.?cost|profit|margin|company.?wide/i.test(question)) {
      return { family, data: restricted('Finance questions are restricted to Owner/Admin.') };
    }
    const range = parseRange(query);
    const invoiceFilter = applyScope(auth, { invoiceDate: { $gte: range.from, $lte: range.to } }, query.locationId);
    const [invoices, inventory, prices] = await Promise.all([
      Invoice.find(invoiceFilter).select('vendorId vendorName invoiceNumber invoiceDate status totalMoney lineItems').lean(),
      InventoryItem.find(applyScope(auth, { status: 'active' }, query.locationId)).select('name locationId currentQuantity unit parLevel averageDailyUsage lastCountAt').lean(),
      PriceObservation.find(applyScope(auth, { effectiveDate: { $gte: range.from, $lte: range.to } }, query.locationId)).select('vendorId description normalizedDescription unit unitPrice effectiveDate invoiceId').sort({ effectiveDate: -1 }).limit(200).lean(),
    ]);
    const approved = invoices.filter((i) => i.status === 'APPROVED');
    const spend = new Map();
    for (const i of approved) {
      const key = String(i.vendorId || i.vendorName || 'Unknown vendor');
      const cur = spend.get(key) || { vendorId: i.vendorId || null, vendorName: i.vendorName || 'Unknown vendor', totalMoney: 0, invoiceCount: 0 };
      cur.totalMoney += Number(i.totalMoney || 0);
      cur.invoiceCount += 1;
      spend.set(key, cur);
    }
    const vendorSpend = [...spend.values()].sort((a, b) => b.totalMoney - a.totalMoney);
    const pendingInvoices = invoices.filter((i) => ['RECEIVED', 'PROCESSING', 'PENDING_REVIEW', 'FAILED'].includes(i.status)).map((i) => ({ invoiceNumber: i.invoiceNumber, vendorName: i.vendorName, invoiceDate: i.invoiceDate, status: i.status, totalMoney: i.totalMoney }));
    const lowStock = inventory.filter((i) => i.currentQuantity <= 0 || (i.parLevel > 0 && i.currentQuantity < i.parLevel)).map((i) => ({ name: i.name, locationId: i.locationId, currentQuantity: i.currentQuantity, unit: i.unit, parLevel: i.parLevel, lastCountAt: i.lastCountAt }));
    let finance = null;
    if (auth.canFinance) finance = await analytics.finance(auth, query);
    return {
      family,
      data: withMeta({
        range,
        dataStatus: approved.length || inventory.length ? 'COMPLETE' : 'UNAVAILABLE',
        vendorSpend,
        pendingInvoices,
        lowStock,
        priceObservations: prices,
        finance,
      }),
    };
  }

  if (family === 'reviews_seo_direct') {
    if (!auth.isAdmin) {
      return {
        family,
        data: restricted('Reviews, SEO and direct-order growth data are restricted to Owner/Admin.'),
      };
    }
    return { family, data: withMeta(await analytics.presence(auth, query)) };
  }

  return { family, data: restricted('The requested question is outside the supported V1 tool families.') };
}

const money = (minorUnits) => (
  minorUnits == null
    ? 'unavailable'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(minorUnits) / 100)
);

function scopeLine(data) {
  const range = data?.dashboard?.range || data?.performance?.range || data?.range;
  const loc = data?.matchedLocation?.name;
  const period = range?.from ? (range.from === range.to ? range.from : `${range.from} through ${range.to}`) : null;
  const headerNote = data?.periodSource === 'header' ? ' (from your selected header filters)' : data?.periodSource === 'default' ? ' (default last 30 complete days)' : '';
  if (period && loc) return `For ${loc}, ${period}${headerNote}`;
  if (period) return `For ${period}${headerNote}`;
  if (loc) return `For ${loc}`;
  return 'For the selected period';
}
function deterministicNarrative(result) {
  const data = result.data;
  if (data?.dataStatus === 'CLARIFY' && data?.reason) {
    const tips = data.clarify?.suggestions?.length
      ? ` Examples: ${data.clarify.suggestions.slice(0, 5).join(', ')}.`
      : '';
    return `${data.reason}${tips}`;
  }
  if (data?.reason) return `${data.reason} Data status: ${data.dataStatus || 'UNAVAILABLE'}.`;
  if (data?.dashboard?.current) {
    const p=data.dashboard;return `${scopeLine(data)}, net sales were ${money(p.current.netMoney)} across ${p.current.orderCount ?? 'unavailable'} orders. ${p.priorities?.[0]?.title ? `Top priority: ${p.priorities[0].title}.` : 'No material open priority is available.'}`;
  }
  if (data?.current) {
    return `${scopeLine(data)}, net sales were ${money(data.current.netMoney)}, across ${data.current.orderCount ?? 'unavailable'} orders, with an average ticket of ${money(data.current.averageTicket)}. Data status: ${data.dataStatus || 'available'}.`;
  }
  if (data?.periodA && data?.periodB) {
    return `Period A (${data.periodA.range?.from} through ${data.periodA.range?.to}) net sales were ${money(data.periodA.current.netMoney)} versus ${money(data.periodB.current.netMoney)} in Period B (${data.periodB.range?.from} through ${data.periodB.range?.to}). Period A minus Period B is ${money(data.delta.netSales)} and ${data.delta.orders} orders.`;
  }
  if (data?.performance?.current) {
    return `${scopeLine(data)}, net sales were ${money(data.performance.current.netMoney)} across ${data.performance.current.orderCount ?? 'unavailable'} orders. ${data.forecasts?.length ? `${data.forecasts.length} forecast record(s) are available.` : 'No reliable forecast is available for this scope.'}`;
  }
  if (data?.vendorSpend) {
    if (!data.vendorSpend.length) return `No approved vendor spend is available for ${data.range.from} through ${data.range.to} in the authorized scope. Pending invoices are excluded from vendor-spend totals.`;
    const top=data.vendorSpend.slice(0,5).map(v=>`${v.vendorName}: ${money(v.totalMoney)} (${v.invoiceCount} approved invoice${v.invoiceCount===1?'':'s'})`).join('; ');return `Approved vendor spend for ${data.range.from} through ${data.range.to}: ${top}. Pending/unapproved invoices are excluded.`;
  }
  if (data?.reviews) {
    return `I found ${data.reviews.length} reviews and ${data.seo?.length || 0} SEO/performance records in the authorized period. Missing provider data should be treated as unavailable, not zero.`;
  }
  return 'The authorized data was retrieved, but there is not enough structured evidence to make a reliable numeric claim.';
}

async function narrate(question, result) {
  if (result.data?.dataStatus === 'CLARIFY') return deterministicNarrative(result);
  if (!env.openaiApiKey) return deterministicNarrative(result);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.openaiModel,
      input: [
        {
          role: 'system',
          content: [{
            type: 'input_text',
            text: 'You are Gourmet Palace Command Center. Answer only from the provided controlled tool result. If dataStatus is CLARIFY, ask the clarifying question from the result and do not invent figures. Always state the exact from/to dates and location used when answering. If periodSource is header or default, say that the period came from header filters or the default window. Preserve estimate/partial/unavailable labels. Never invent numbers or recommend a write action as if it occurred.',
          }],
        },
        {
          role: 'user',
          content: [{
            type: 'input_text',
            text: `Question: ${question}\nControlled tool result:\n${JSON.stringify(result).slice(0, 80000)}`,
          }],
        },
      ],
    }),
  });
  if (!response.ok) return deterministicNarrative(result);
  const data = await response.json();
  return data.output_text || deterministicNarrative(result);
}

function extractEvidence(result) {
  const data = result.data;
  const loc = data?.matchedLocation ? [{type:'location',locationId:data.matchedLocation.id,locationName:data.matchedLocation.name}] : [];
  if (data?.dataStatus === 'CLARIFY') {
    return [{ type: 'tool', family: result.family, dataStatus: 'CLARIFY', clarify: data.clarify || null }];
  }
  if (data?.reason) return [{ type: 'tool', family: result.family, dataStatus: data.dataStatus || 'UNAVAILABLE' }, ...loc];
  if (data?.dashboard?.range) return [{type:'period',...data.dashboard.range},{type:'metrics',netMoney:data.dashboard.current.netMoney,orderCount:data.dashboard.current.orderCount,dataStatus:data.dashboard.dataStatus},{type:'priorities',refs:(data.dashboard.priorities||[]).map(p=>p.ref)},...loc];
  if (data?.range && data?.current) return [{type:'period',from:data.range.from,to:data.range.to},{type:'metrics',netMoney:data.current.netMoney,orderCount:data.current.orderCount,dataStatus:data.dataStatus},...loc];
  if (data?.periodA) return [{ type: 'comparison', a: data.periodA.range, b: data.periodB.range, delta: data.delta }, ...loc];
  if (data?.vendorSpend) return [{type:'period',...data.range},{type:'vendor_spend',vendors:data.vendorSpend.slice(0,20)},{type:'pending_invoice_count',count:data.pendingInvoices?.length||0},{type:'low_stock_count',count:data.lowStock?.length||0},...loc];
  if (data?.performance?.range) return [{type:'period',...data.performance.range},{type:'metrics',netMoney:data.performance.current.netMoney,orderCount:data.performance.current.orderCount,dataStatus:data.performance.dataStatus},...loc];
  if (data?.reviews || data?.seo) return [{type:'period',...(data.range||{})},{type:'reviews_seo',reviewCount:(data.reviews||[]).length,seoCount:(data.seo||[]).length},...loc];
  return [{ type: 'tool', family: result.family, dataStatus: data?.dataStatus || null }, ...loc];
}

async function ask(auth, user, payload) {
  if (!payload.question?.trim()) throw new ApiError(400, 'question is required');
  const sessionId = payload.sessionId || crypto.randomUUID();
  await ChatMessage.create({
    organizationId: auth.organizationId,
    userId: user.id,
    sessionId,
    role: 'user',
    content: payload.question,
    scope: payload.scope || {},
  });
  const result = await toolResult(auth, payload.question, payload.scope || {});
  const answer = await narrate(payload.question, result);
  const evidence = extractEvidence(result);
  const message = await ChatMessage.create({
    organizationId: auth.organizationId,
    userId: user.id,
    sessionId,
    role: 'assistant',
    content: answer,
    scope: payload.scope || {},
    evidence,
    toolFamily: result.family,
  });
  const dataStatus = result.data?.dataStatus
    || result.data?.dashboard?.dataStatus
    || result.data?.performance?.dataStatus
    || result.data?.periodA?.dataStatus
    || null;
  return {
    sessionId,
    message: message.toJSON(),
    toolFamily: result.family,
    evidence,
    dataStatus,
  };
}

async function history(auth, user, sessionId) {
  if (!sessionId) return [];
  return ChatMessage.find({
    organizationId: auth.organizationId,
    userId: user.id,
    sessionId,
  }).sort({ createdAt: 1 }).limit(300).lean();
}

async function feedback(auth, user, id, value) {
  if (!['up', 'down', ''].includes(value)) throw new ApiError(400, 'Invalid feedback');
  const message = await ChatMessage.findOne({
    _id: id,
    organizationId: auth.organizationId,
    userId: user.id,
    role: 'assistant',
  });
  if (!message) throw new ApiError(404, 'Message not found');
  message.feedback = value;
  await message.save();
  return message.toJSON();
}

module.exports = {
  ask,
  history,
  feedback,
  toolResult,
  classify,
  quarterRange,
  monthRange,
  explicitRollingRange,
  isoDateRange,
  relativeRange,
  questionTimeRange,
  hasTimeIntent,
  resolveTimeScope,
  scopedTimeQuery,
  isFutureObservedRange,
  matchLocationName,
  resolveLocationMention,
  scoreLocationAgainstQuestion,
  latestCompleteDay,
};
