const ApiError=require('./ApiError');
const pad=n=>String(n).padStart(2,'0');
const iso=d=>`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
function addDays(s,n){const d=new Date(`${s}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return iso(d)}
function todayUtc(){return iso(new Date())}
function parseRange(q={}){
  if(q.from||q.to){if(!/^\d{4}-\d{2}-\d{2}$/.test(q.from||'')||!/^\d{4}-\d{2}-\d{2}$/.test(q.to||'')) throw new ApiError(400,'from and to must be YYYY-MM-DD'); if(q.from>q.to) throw new ApiError(400,'from must not be after to'); return {from:q.from,to:q.to,label:'Custom'};}
  const end=addDays(todayUtc(),-1); const preset=(q.preset||'7d').toLowerCase();
  if(preset==='yesterday') return {from:end,to:end,label:'Yesterday'};
  if(preset==='7d') return {from:addDays(end,-6),to:end,label:'7 Days'};
  if(preset==='30d') return {from:addDays(end,-29),to:end,label:'30 Days'};
  const d=new Date(`${end}T00:00:00Z`);
  if(preset==='wtd'){const dow=(d.getUTCDay()+6)%7;return {from:addDays(end,-dow),to:end,label:'WTD'}}
  if(preset==='mtd') return {from:`${end.slice(0,8)}01`,to:end,label:'MTD'};
  if(preset==='ytd') return {from:`${end.slice(0,4)}-01-01`,to:end,label:'YTD'};
  throw new ApiError(400,'Unsupported date preset');
}
function priorYearRange(r){const shift=s=>{const d=new Date(`${s}T00:00:00Z`);d.setUTCFullYear(d.getUTCFullYear()-1);return iso(d)};return {from:shift(r.from),to:shift(r.to)}}
function previousRange(r){const days=Math.round((new Date(r.to+'T00:00:00Z')-new Date(r.from+'T00:00:00Z'))/86400000)+1; return {from:addDays(r.from,-days),to:addDays(r.from,-1)}}
module.exports={parseRange,previousRange,priorYearRange,addDays,todayUtc,iso};
