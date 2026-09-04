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
  if (/forecast|expected|compare|quarter|month|week|january|february|march|april|may|june|july|august|september|october|november|december/.test(s)) return 'forecast_comparison';
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
  const match=String(text||'').toLowerCase().match(/(?:last|past|over\s+the\s+last)\s+(\d{1,3})\s+days?/);if(!match)return null;
  const days=Math.min(370,Math.max(1,Number(match[1])));const to=addDays(todayUtc(),-1);return {from:addDays(to,-(days-1)),to};
}
async function resolveQuestionLocation(auth, question, query) {
  if (query.locationId) return { query };
  const locations=await Location.find({organizationId:auth.organizationId,status:'active'}).select('_id name').lean();
  const q=String(question||'').toLowerCase();const match=locations.find(l=>q.includes(String(l.name||'').toLowerCase()));if(!match)return {query};
  const id=String(match._id);if(!auth.allLocations&&!auth.locationIds.includes(id))return {query,denied:`${match.name} is outside your authorized location scope.`};
  return {query:{...query,locationId:id},matchedLocation:{id,name:match.name}};
}
function scopedTimeQuery(question, scope) {
  const query={...(scope||{})};const month=monthRange(question),rolling=explicitRollingRange(question);
  if(month){query.from=month.from;query.to=month.to;delete query.preset}else if(rolling){query.from=rolling.from;query.to=rolling.to;delete query.preset}else if(!query.from&&!query.preset)query.preset='30d';
  return query;
}
function restricted(reason) {
  return { dataStatus: 'UNAVAILABLE', reason };
}

async function toolResult(auth, question, scope = {}) {
  const family = classify(question);
  let query = scopedTimeQuery(question, scope);
  const resolved = await resolveQuestionLocation(auth, question, query);
  if (resolved.denied) return { family, data: restricted(resolved.denied) };
  query = resolved.query;

  if (family === 'business_performance') {
    return { family, data: { performance: await analytics.performance(auth, query), dashboard: await analytics.dashboard(auth, query), matchedLocation: resolved.matchedLocation || null } };
  }

  if (family === 'menu_performance') {
    if (/margin|item\s+cost|profit\s+(?:per|by)\s+item/i.test(question)) return {family,data:restricted('Menu-item margin evidence is unavailable until an approved item-cost mapping exists; V1 does not invent recipe cost.')};
    return { family, data: await analytics.performance(auth, query) };
  }

  if (family === 'exceptions') {
    const [performance, exceptionOrders] = await Promise.all([
      analytics.performance(auth, query),
      analytics.orders(auth, { ...query, exception: 'true', limit: '25' }),
    ]);
    return { family, data: { performance, exceptionOrders } };
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
        data: {
          periodA,
          periodB,
          delta: {
            definition: 'Period A minus Period B',
            netSales: periodA.current.netMoney == null || periodB.current.netMoney == null ? null : periodA.current.netMoney - periodB.current.netMoney,
            orders: periodA.current.orderCount == null || periodB.current.orderCount == null ? null : periodA.current.orderCount - periodB.current.orderCount,
          },
        },
      };
    }

    return {
      family,
      data: {
        performance: await analytics.aggregateMetrics(auth, query),
        forecasts: (await analytics.forecasts(auth, query)).forecasts,
      },
    };
  }

  if (family === 'cost_vendor_invoice_inventory') {
    if (!auth.canFinance && /food.?cost|profit|margin|company.?wide/i.test(question)) {
      return { family, data: restricted('Finance questions are restricted to Owner/Admin.') };
    }
    const range = parseRange(query);
    const invoiceFilter=applyScope(auth,{invoiceDate:{$gte:range.from,$lte:range.to}},query.locationId);
    const [invoices, inventory, prices] = await Promise.all([
      Invoice.find(invoiceFilter).select('vendorId vendorName invoiceNumber invoiceDate status totalMoney lineItems').lean(),
      InventoryItem.find(applyScope(auth,{status:'active'},query.locationId)).select('name locationId currentQuantity unit parLevel averageDailyUsage lastCountAt').lean(),
      PriceObservation.find(applyScope(auth,{effectiveDate:{$gte:range.from,$lte:range.to}},query.locationId)).select('vendorId description normalizedDescription unit unitPrice effectiveDate invoiceId').sort({effectiveDate:-1}).limit(200).lean(),
    ]);
    const approved=invoices.filter(i=>i.status==='APPROVED');const spend=new Map();for(const i of approved){const key=String(i.vendorId||i.vendorName||'Unknown vendor'),cur=spend.get(key)||{vendorId:i.vendorId||null,vendorName:i.vendorName||'Unknown vendor',totalMoney:0,invoiceCount:0};cur.totalMoney+=Number(i.totalMoney||0);cur.invoiceCount++;spend.set(key,cur)}
    const vendorSpend=[...spend.values()].sort((a,b)=>b.totalMoney-a.totalMoney);const pendingInvoices=invoices.filter(i=>['RECEIVED','PROCESSING','PENDING_REVIEW','FAILED'].includes(i.status)).map(i=>({invoiceNumber:i.invoiceNumber,vendorName:i.vendorName,invoiceDate:i.invoiceDate,status:i.status,totalMoney:i.totalMoney}));
    const lowStock=inventory.filter(i=>i.currentQuantity<=0||(i.parLevel>0&&i.currentQuantity<i.parLevel)).map(i=>({name:i.name,locationId:i.locationId,currentQuantity:i.currentQuantity,unit:i.unit,parLevel:i.parLevel,lastCountAt:i.lastCountAt}));
    let finance=null;if(auth.canFinance)finance=await analytics.finance(auth,query);
    return { family, data: { range, dataStatus: approved.length||inventory.length?'COMPLETE':'UNAVAILABLE', matchedLocation:resolved.matchedLocation||null, vendorSpend, pendingInvoices, lowStock, priceObservations:prices, finance } };
  }

  if (family === 'reviews_seo_direct') {
    if (!auth.isAdmin) {
      return {
        family,
        data: restricted('Reviews, SEO and direct-order growth data are restricted to Owner/Admin.'),
      };
    }
    return { family, data: await analytics.presence(auth, query) };
  }

  return { family, data: restricted('The requested question is outside the supported V1 tool families.') };
}

const money = (minorUnits) => (
  minorUnits == null
    ? 'unavailable'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(minorUnits) / 100)
);

function deterministicNarrative(result) {
  const data = result.data;
  if (data?.reason) return `${data.reason} Data status: ${data.dataStatus || 'UNAVAILABLE'}.`;
  if (data?.dashboard?.current) {
    const p=data.dashboard;return `For ${p.range.from} through ${p.range.to}, net sales were ${money(p.current.netMoney)} across ${p.current.orderCount ?? 'unavailable'} orders. ${p.priorities?.[0]?.title ? `Top priority: ${p.priorities[0].title}.` : 'No material open priority is available.'}`;
  }
  if (data?.current) {
    return `For ${data.range?.from || 'the selected period'} through ${data.range?.to || ''}, net sales were ${money(data.current.netMoney)}, across ${data.current.orderCount ?? 'unavailable'} orders, with an average ticket of ${money(data.current.averageTicket)}. Data status: ${data.dataStatus || 'available'}.`;
  }
  if (data?.periodA && data?.periodB) {
    return `Period A net sales were ${money(data.periodA.current.netMoney)} versus ${money(data.periodB.current.netMoney)} in Period B. Period A minus Period B is ${money(data.delta.netSales)} and ${data.delta.orders} orders.`;
  }
  if (data?.performance?.current) {
    return `For the selected period, net sales were ${money(data.performance.current.netMoney)} across ${data.performance.current.orderCount ?? 'unavailable'} orders. ${data.forecasts?.length ? `${data.forecasts.length} forecast record(s) are available.` : 'No reliable forecast is available for this scope.'}`;
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
            text: 'You are Gourmet Palace Command Center. Answer only from the provided controlled tool result. Preserve estimate/partial/unavailable labels. Never invent numbers or recommend a write action as if it occurred.',
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
  if (data?.dashboard?.range) return [{type:'period',...data.dashboard.range},{type:'metrics',netMoney:data.dashboard.current.netMoney,orderCount:data.dashboard.current.orderCount,dataStatus:data.dashboard.dataStatus},{type:'priorities',refs:(data.dashboard.priorities||[]).map(p=>p.ref)}];
  if (data?.range && data?.current) return [{type:'period',from:data.range.from,to:data.range.to},{type:'metrics',netMoney:data.current.netMoney,orderCount:data.current.orderCount,dataStatus:data.dataStatus}];
  if (data?.periodA) return [{ type: 'comparison', a: data.periodA.range, b: data.periodB.range, delta: data.delta }];
  if (data?.vendorSpend) return [{type:'period',...data.range},{type:'vendor_spend',vendors:data.vendorSpend.slice(0,20)},{type:'pending_invoice_count',count:data.pendingInvoices?.length||0},{type:'low_stock_count',count:data.lowStock?.length||0}];
  if (data?.performance?.range) return [{type:'period',...data.performance.range},{type:'metrics',netMoney:data.performance.current.netMoney,orderCount:data.performance.current.orderCount,dataStatus:data.performance.dataStatus}];
  return [{ type: 'tool', family: result.family, dataStatus: data?.dataStatus || null }];
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
  return ChatMessage.find({
    organizationId: auth.organizationId,
    userId: user.id,
    ...(sessionId ? { sessionId } : {}),
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

module.exports = { ask, history, feedback, toolResult, classify, quarterRange };
