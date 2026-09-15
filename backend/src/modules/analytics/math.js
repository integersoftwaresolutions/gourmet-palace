function median(values){
  const nums=(values||[]).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  if(!nums.length)return null;
  const m=Math.floor(nums.length/2);
  return nums.length%2?nums[m]:(nums[m-1]+nums[m])/2;
}
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
/**
 * Comparable values must be newest-first. V1 uses the robust median of up to
 * eight comparable weekdays, then applies a bounded recent-trend factor based
 * on the newest four observations. The +/-10% bound prevents a short run from
 * overpowering the robust center while still making the baseline responsive.
 */
function boundedTrendExpectation(values,{minFactor=.9,maxFactor=1.1,recentCount=4}={}){
  const nums=(values||[]).map(Number).filter(Number.isFinite);
  if(!nums.length)return {expected:null,center:null,recentMedian:null,trendFactor:null,bounds:{minFactor,maxFactor}};
  const center=median(nums);
  const recentMedian=median(nums.slice(0,Math.min(recentCount,nums.length)));
  const rawFactor=center===0?1:recentMedian/center;
  const trendFactor=clamp(Number.isFinite(rawFactor)?rawFactor:1,minFactor,maxFactor);
  return {expected:center*trendFactor,center,recentMedian,trendFactor,bounds:{minFactor,maxFactor}};
}
function salesWeightedHealth(scores){
  const eligible=(scores||[]).filter(row=>row.score!=null&&Number.isFinite(Number(row.score))&&Number(row.netSales)>0);
  const denominator=eligible.reduce((sum,row)=>sum+Number(row.netSales),0);
  if(!denominator)return {score:null,coverage:0,eligibleCount:0};
  const score=eligible.reduce((sum,row)=>sum+Number(row.score)*Number(row.netSales),0)/denominator;
  const coverage=eligible.reduce((sum,row)=>sum+Number(row.netSales)*Math.max(0,Math.min(100,Number(row.coverage)||0)),0)/denominator;
  return {score,coverage,eligibleCount:eligible.length};
}
/** Group canonical exception money. Callers pass daypart only when clock time is reliable. */
function clusterExceptionOrders(orders){
  const map=new Map();
  const add=(kind,order,money)=>{
    if(!(Number(money)>0))return;
    const locationId=String(order.locationId||'');
    const channel=order.channel||'unknown';
    const daypart=order.daypart||null;
    const key=`${kind}|${locationId}|${channel}|${daypart||'unspecified'}`;
    const current=map.get(key)||{kind,locationId,locationName:order.locationName||'Location',channel,daypart,orderCount:0,money:0};
    current.orderCount+=1;
    current.money+=Number(money)||0;
    map.set(key,current);
  };
  for(const order of orders||[]){
    add('refunds',order,order.refundMoney);
    add('voids',order,order.voidMoney);
    add('discounts',order,order.discountMoney);
  }
  return [...map.values()].sort((a,b)=>b.money-a.money);
}
function isoAddDays(s,n){
  const d=new Date(`${s}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+n);
  const pad=(x)=>String(x).padStart(2,'0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
}
function weekdayUtc(iso){return new Date(`${iso}T00:00:00Z`).getUTCDay()}
/**
 * One location, one Monday-start week. History must be newest-first complete days.
 * A weekday with fewer than 4 comparables is withheld (UNAVAILABLE).
 */
function buildWeekForecast(weekStart,historyNewestFirst){
  const history=historyNewestFirst||[];
  const days=[];let expected=0,variance=0,count=0;const comparisons=[];
  for(let i=0;i<7;i++){
    const target=isoAddDays(weekStart,i);const wd=weekdayUtc(target);
    const vals=history.filter((row)=>row.businessDate<target&&weekdayUtc(row.businessDate)===wd).slice(0,8);
    if(vals.length>=4){
      const trend=boundedTrendExpectation(vals.map((row)=>Number(row.netMoney||0)));
      const m=trend.expected;const spread=median(vals.map((row)=>Math.abs(Number(row.netMoney||0)-m)))||m*.1;
      expected+=m;variance+=spread;count+=1;comparisons.push(...vals.map((row)=>row.businessDate));
      days.push({businessDate:target,weekday:wd,expectedMoney:Math.round(m),lowMoney:Math.max(0,Math.round(m-spread)),highMoney:Math.round(m+spread),comparableCount:vals.length,status:vals.length>=8?'COMPLETE':'PROVISIONAL'});
    }else{
      days.push({businessDate:target,weekday:wd,expectedMoney:null,lowMoney:null,highMoney:null,comparableCount:vals.length,status:'UNAVAILABLE'});
    }
  }
  const status=count===7?'COMPLETE':count>=4?'PROVISIONAL':'UNAVAILABLE';
  return {weekStart,expectedMoney:count?Math.round(expected):null,lowMoney:count?Math.max(0,Math.round(expected-variance)):null,highMoney:count?Math.round(expected+variance):null,coverage:Math.round(count/7*100),status,formulaVersion:2,comparisonDates:[...new Set(comparisons)],days};
}
function sourceRows(rows,source){return (rows||[]).filter((row)=>row.source===source&&row.status==='COMPLETE')}
function sumMetric(rows,key){return rows.reduce((sum,row)=>sum+Number(row.metrics?.[key]||0),0)}
function changePct(current,previous){if(previous==null||!(Number(previous)>0)||current==null)return null;return ((Number(current)-Number(previous))/Math.abs(Number(previous)))*100}
function latestFreshness(rows){return (rows||[]).reduce((latest,row)=>{const at=row.freshnessAt||row.ingestTimestamp;if(!at)return latest;return !latest||new Date(at)>new Date(latest)?at:latest},null)}
function summarizeSeoMetrics(seo,priorSeo){
  const ga4=sourceRows(seo,'ga4');const ga4Prior=sourceRows(priorSeo,'ga4');
  const gsc=sourceRows(seo,'gsc');const gscPrior=sourceRows(priorSeo,'gsc');
  const gbp=sourceRows(seo,'gbp');const gbpPrior=sourceRows(priorSeo,'gbp');
  const direct=sourceRows(seo,'square_direct');const directPrior=sourceRows(priorSeo,'square_direct');
  const gscClicks=gsc.length?sumMetric(gsc,'clicks'):null;
  const gscImpr=gsc.length?sumMetric(gsc,'impressions'):null;
  const gscPriorClicks=gscPrior.length?sumMetric(gscPrior,'clicks'):null;
  const gscPriorImpr=gscPrior.length?sumMetric(gscPrior,'impressions'):null;
  const gscPositionWeight=gsc.reduce((sum,row)=>sum+Number(row.metrics?.position||0)*Number(row.metrics?.impressions||0),0);
  const gbpWebsite=gbp.length?sumMetric(gbp,'website_clicks'):null;
  const gbpCalls=gbp.length?sumMetric(gbp,'call_clicks'):null;
  const gbpDirections=gbp.length?sumMetric(gbp,'business_direction_requests'):null;
  const gbpImpr=(gbp.length?sumMetric(gbp,'business_impressions_desktop_maps'):0)+(gbp.length?sumMetric(gbp,'business_impressions_mobile_search'):0);
  return {
    ga4:{
      sessions:ga4.length?sumMetric(ga4,'sessions'):null,
      keyEvents:ga4.length?sumMetric(ga4,'keyEvents'):null,
      totalUsersSum:ga4.length?sumMetric(ga4,'totalUsers'):null,
      status:ga4.length?'COMPLETE':'UNAVAILABLE',
      sessionsPct:changePct(ga4.length?sumMetric(ga4,'sessions'):null,ga4Prior.length?sumMetric(ga4Prior,'sessions'):null),
    },
    gsc:{
      clicks:gscClicks,
      impressions:gscImpr,
      ctr:gscImpr?gscClicks/gscImpr:null,
      position:gscImpr?gscPositionWeight/gscImpr:null,
      status:gsc.length?'COMPLETE':'UNAVAILABLE',
      clicksPct:changePct(gscClicks,gscPriorClicks),
      queriesPagesStatus:'UNAVAILABLE',
    },
    gbp:{
      websiteClicks:gbp.length?gbpWebsite:null,
      callClicks:gbp.length?gbpCalls:null,
      directionRequests:gbp.length?gbpDirections:null,
      impressions:gbp.length?gbpImpr:null,
      status:gbp.length?'COMPLETE':'UNAVAILABLE',
      websiteClicksPct:changePct(gbp.length?gbpWebsite:null,gbpPrior.length?sumMetric(gbpPrior,'website_clicks'):null),
    },
    squareDirect:{
      orders:direct.length?sumMetric(direct,'orders'):null,
      revenue:direct.length?sumMetric(direct,'revenue'):null,
      mappingApproved:direct.some((row)=>row.metrics?.mappingApproved),
      status:direct.length?'COMPLETE':'UNAVAILABLE',
      revenuePct:changePct(direct.length?sumMetric(direct,'revenue'):null,directPrior.length?sumMetric(directPrior,'revenue'):null),
    },
    freshnessAt:latestFreshness((seo||[]).filter(row=>row.status==='COMPLETE')),
    locations:[...new Set((seo||[]).map((row)=>String(row.locationId)))].length,
  };
}
/** Toast day-summary and date-only ingest stamps are noon or midnight UTC, not ticket clock time. */
function isClockPlaceholder(sourceTimestamp,businessDate){
  if(sourceTimestamp==null||sourceTimestamp==='')return true;
  const ms=new Date(sourceTimestamp).getTime();
  if(!Number.isFinite(ms))return true;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(businessDate||'')))return false;
  return ms===Date.parse(`${businessDate}T12:00:00.000Z`)||ms===Date.parse(`${businessDate}T00:00:00.000Z`);
}
function isUsableDaypartOrder(order){
  if(!order)return false;
  if((order.sourceKind||'ticket')==='day_summary')return false;
  return !isClockPlaceholder(order.sourceTimestamp,order.businessDate);
}
module.exports={median,boundedTrendExpectation,salesWeightedHealth,clusterExceptionOrders,buildWeekForecast,summarizeSeoMetrics,isClockPlaceholder,isUsableDaypartOrder};
