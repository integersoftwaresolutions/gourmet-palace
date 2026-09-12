const mongoose=require('mongoose');
const Order=require('../../models/Order'); const DailyMetric=require('../../models/DailyMetric'); const Location=require('../../models/Location'); const LocationScore=require('../../models/LocationScore'); const Baseline=require('../../models/Baseline'); const Forecast=require('../../models/Forecast'); const Invoice=require('../../models/Invoice'); const SeoMetric=require('../../models/SeoMetric'); const Review=require('../../models/Review'); const Alert=require('../../models/Alert');
const settings=require('../settings/settings.service'); const {applyScope,authorizedLocationFilter}=require('../../utils/scope'); const {parseRange,previousRange,priorYearRange,addDays}=require('../../utils/dateRange'); const {parsePagination,paginatedResult}=require('../../utils/pagination'); const ApiError=require('../../utils/ApiError'); const env=require('../../config/getEnv')();
const {median,boundedTrendExpectation,salesWeightedHealth,clusterExceptionOrders,buildWeekForecast,summarizeSeoMetrics}=require('./math');
const pct=(v,b)=>b?((v-b)/Math.abs(b))*100:null;
async function rebuildDaily({organizationId,locationId,businessDate}){
  const orders=await Order.find({organizationId,locationId,businessDate}).select('+rawRef').lean();
  if(!orders.length){
    await DailyMetric.findOneAndUpdate(
      {organizationId,locationId,businessDate,metricVersion:1},
      {
        $set:{dataStatus:'UNAVAILABLE',coverage:0,freshnessAt:new Date(),sourceProviders:[],itemCategoryStatus:'UNAVAILABLE'},
        $unset:{grossMoney:1,netMoney:1,orderCount:1,guestCount:1,averageTicket:1,refundMoney:1,voidMoney:1,discountMoney:1,channels:1,topItems:1,categories:1,reconciliation:1},
      },
      {upsert:true,new:true,setDefaultsOnInsert:true},
    );
    return null;
  }
  // Square is authoritative on overlap. When a Square day has been reprocessed, use only
  // the most recent raw acquisition reference so orders that disappeared from the provider
  // are not silently retained in a published aggregate. Toast remains preserved for history.
  const square=orders.filter(o=>o.provider==='square'); let facts;
  if(square.length){const latest=[...square].sort((a,b)=>new Date(b.ingestTimestamp||0)-new Date(a.ingestTimestamp||0))[0];facts=latest?.rawRef?square.filter(o=>o.rawRef===latest.rawRef):square}else facts=orders;
  const completed=facts.filter(o=>(o.orderState||'COMPLETED')==='COMPLETED');
  let gross=0,net=0,refund=0,voids=0,discount=0,guests=0,guestKnown=0; const channels={dine_in:0,takeout:0,delivery:0,third_party:0,direct_online:0,unknown:0}; const itemMap=new Map(); const catMap=new Map();
  for(const o of facts){refund+=o.refundMoney||0;voids+=o.voidMoney||0;if((o.orderState||'COMPLETED')!=='COMPLETED')continue;gross+=o.grossMoney||0;net+=o.netMoney||0;discount+=o.discountMoney||0;if(o.guestCount!=null){guests+=o.guestCount;guestKnown++}channels[o.channel||'unknown']=(channels[o.channel||'unknown']||0)+(o.netMoney||0);for(const i of o.items||[]){const key=i.name||i.providerItemId||'Unknown';const cur=itemMap.get(key)||{name:key,units:0,revenue:0,category:i.category||'Category unavailable'};cur.units+=i.quantity||0;cur.revenue+=i.netMoney||0;itemMap.set(key,cur);const c=i.category||'Category unavailable';catMap.set(c,(catMap.get(c)||0)+(i.netMoney||0));}}
  const status=facts.some(o=>o.status==='PARTIAL')?'PARTIAL':'COMPLETE';
  return DailyMetric.findOneAndUpdate({organizationId,locationId,businessDate,metricVersion:1},{currency:facts.find(o=>o.currency)?.currency||'USD',grossMoney:gross,netMoney:net,orderCount:completed.length,guestCount:guestKnown?guests:null,averageTicket:completed.length?Math.round(net/completed.length):null,refundMoney:refund,voidMoney:voids,discountMoney:discount,channels,topItems:[...itemMap.values()].sort((a,b)=>b.revenue-a.revenue).slice(0,20),categories:[...catMap.entries()].map(([name,revenue])=>({name,revenue})).sort((a,b)=>b.revenue-a.revenue),dataStatus:status,coverage:status==='COMPLETE'?100:75,freshnessAt:new Date(),sourceProviders:[...new Set(facts.map(o=>o.provider))],itemCategoryStatus:completed.some(o=>(o.items||[]).some(i=>i.category))?'COMPLETE':'UNAVAILABLE'},{upsert:true,new:true,setDefaultsOnInsert:true});
}
async function rebuildBaselinesAndScore({organizationId,locationId,businessDate}){
  const loc=await Location.findOne({_id:locationId,organizationId}); if(!loc)return null; const current=await DailyMetric.findOne({organizationId,locationId,businessDate,metricVersion:1}).lean(); if(!current||current.dataStatus!=='COMPLETE')return null;
  const d=new Date(businessDate+'T12:00:00Z'),weekday=d.getUTCDay(); const history=await DailyMetric.find({organizationId,locationId,businessDate:{$lt:businessDate},dataStatus:'COMPLETE'}).sort({businessDate:-1}).limit(70).lean(); const comparable=history.filter(h=>new Date(h.businessDate+'T12:00:00Z').getUTCDay()===weekday).slice(0,8); const provisional=comparable.length<8; const enough=comparable.length>=4;
  const metrics=['netMoney','orderCount','averageTicket','refundMoney','voidMoney','discountMoney']; const baselines={};
  for(const metric of metrics){const vals=comparable.map(h=>Number(h[metric]||0));const trend=enough?boundedTrendExpectation(vals):{expected:null,center:null,recentMedian:null,trendFactor:null,bounds:{minFactor:.9,maxFactor:1.1}};const expected=trend.expected;baselines[metric]=expected;await Baseline.findOneAndUpdate({organizationId,locationId,metric,weekday},{expected,center:trend.center,recentMedian:trend.recentMedian,trendFactor:trend.trendFactor,trendBounds:trend.bounds,comparisonDates:comparable.map(x=>x.businessDate),coverage:Math.min(100,comparable.length/8*100),formulaVersion:2,status:provisional?'PROVISIONAL':'COMPLETE'},{upsert:true,new:true});}
  const weights=await settings.getEffective(organizationId,'scoreWeights',locationId,new Date(businessDate+'T23:59:59Z'))||settings.DEFAULTS.scoreWeights;
  const eligible={}; const ratioScore=(actual,expected,inverse=false)=>{if(expected==null||expected===0)return null;const r=actual/expected;const s=inverse?100-(r-1)*100:100+(r-1)*100;return Math.max(0,Math.min(100,s))};
  eligible.sales=ratioScore(current.netMoney,baselines.netMoney); const os=ratioScore(current.orderCount,baselines.orderCount),ats=ratioScore(current.averageTicket,baselines.averageTicket); eligible.demand=os!=null&&ats!=null?(os+ats)/2:(os??ats);
  const curExc=(current.refundMoney+current.voidMoney+current.discountMoney)/Math.max(1,current.netMoney); const baseExc=((baselines.refundMoney||0)+(baselines.voidMoney||0)+(baselines.discountMoney||0))/Math.max(1,baselines.netMoney||0); eligible.exceptions=baseExc>0?ratioScore(curExc,baseExc,true):100;
  const direct=current.channels?.direct_online||0; const histDirect=comparable.map(h=>h.channels?.direct_online||0); const directBaseline=histDirect.some(Boolean)?boundedTrendExpectation(histDirect).expected:null; eligible.operating=directBaseline!=null?ratioScore(direct,directBaseline):null;
  const available=Object.entries(eligible).filter(([,v])=>v!=null); const totalAvailWeight=available.reduce((s,[k])=>s+(weights[k]||0),0); const score=totalAvailWeight?available.reduce((s,[k,v])=>s+v*(weights[k]||0)/totalAvailWeight,0):null; const coverage=Math.round(totalAvailWeight*100);
  const row=await LocationScore.findOneAndUpdate({organizationId,locationId,businessDate,scoreVersion:1},{score:score==null?null:Math.round(score*10)/10,coverage,netSales:current.netMoney,components:eligible,weights,comparison:{netSalesPct:pct(current.netMoney,baselines.netMoney),baselineFormulaVersion:2}},{upsert:true,new:true});
  const peers=await LocationScore.find({organizationId,businessDate,scoreVersion:1,score:{$ne:null}}).sort({score:-1}); for(let i=0;i<peers.length;i++){peers[i].rank=i+1;await peers[i].save();}
  return row;
}
async function rebuildForecast({organizationId,locationId,businessDate}){
  const d=new Date(businessDate+'T00:00:00Z'); const day=(d.getUTCDay()+6)%7; const weekStart=addDays(businessDate,-day);
  const history=await DailyMetric.find({organizationId,locationId,businessDate:{$lt:addDays(weekStart,7)},dataStatus:'COMPLETE'}).select('businessDate netMoney').sort({businessDate:-1}).limit(200).lean();
  const built=buildWeekForecast(weekStart,history);
  return Forecast.findOneAndUpdate({organizationId,locationId,weekStart},{expectedMoney:built.expectedMoney,lowMoney:built.lowMoney,highMoney:built.highMoney,coverage:built.coverage,status:built.status,formulaVersion:built.formulaVersion,comparisonDates:built.comparisonDates,days:built.days},{upsert:true,new:true});
}
async function listMetrics(auth,query){const range=parseRange(query);const filter=applyScope(auth,{businessDate:{$gte:range.from,$lte:range.to}},query.locationId);const rows=await DailyMetric.find(filter).sort({businessDate:1}).lean();return {range,rows};}
function summarizeMetricRows(range,rows,previousRows,prev,locationCount,comparisonMode='previous'){
  const usable=(list)=>list.filter(r=>r.dataStatus!=='UNAVAILABLE');const currentRows=usable(rows||[]),priorRows=usable(previousRows||[]);const sum=(arr,k)=>arr.reduce((total,row)=>total+(Number(row[k])||0),0);const hasCurrent=currentRows.length>0,hasPrevious=priorRows.length>0;
  const current={grossMoney:hasCurrent?sum(currentRows,'grossMoney'):null,netMoney:hasCurrent?sum(currentRows,'netMoney'):null,orderCount:hasCurrent?sum(currentRows,'orderCount'):null,guestCount:hasCurrent&&currentRows.every(r=>r.guestCount!=null)?sum(currentRows,'guestCount'):null,refundMoney:hasCurrent?sum(currentRows,'refundMoney'):null,voidMoney:hasCurrent?sum(currentRows,'voidMoney'):null,discountMoney:hasCurrent?sum(currentRows,'discountMoney'):null};current.averageTicket=current.orderCount>0?Math.round(current.netMoney/current.orderCount):null;const prior={grossMoney:hasPrevious?sum(priorRows,'grossMoney'):null,netMoney:hasPrevious?sum(priorRows,'netMoney'):null,orderCount:hasPrevious?sum(priorRows,'orderCount'):null,guestCount:hasPrevious&&priorRows.every(r=>r.guestCount!=null)?sum(priorRows,'guestCount'):null,refundMoney:hasPrevious?sum(priorRows,'refundMoney'):null,voidMoney:hasPrevious?sum(priorRows,'voidMoney'):null,discountMoney:hasPrevious?sum(priorRows,'discountMoney'):null};prior.averageTicket=prior.orderCount>0?Math.round(prior.netMoney/prior.orderCount):null;
  const dayCount=Math.round((new Date(range.to+'T00:00:00Z')-new Date(range.from+'T00:00:00Z'))/86400000)+1;const expectedCells=Math.max(1,dayCount*Math.max(1,locationCount||1));const coverage=Math.min(100,Math.round((rows||[]).reduce((total,row)=>total+Math.max(0,Math.min(100,Number(row.coverage??(row.dataStatus==='COMPLETE'?100:0)))),0)/expectedCells));const hasMissing=(rows||[]).length<expectedCells;const statuses=new Set((rows||[]).map(r=>r.dataStatus));let dataStatus='PARTIAL';if(!hasCurrent)dataStatus='UNAVAILABLE';else if(!hasMissing&&statuses.size===1&&statuses.has('COMPLETE'))dataStatus='COMPLETE';else if(!hasMissing&&statuses.size===1&&statuses.has('STALE'))dataStatus='STALE';
  return {range,current,comparison:{mode:comparisonMode==='prior-year'?'prior-year':'previous',previousRange:prev,grossPct:current.grossMoney!=null&&prior.grossMoney!=null?pct(current.grossMoney,prior.grossMoney):null,netSalesPct:current.netMoney!=null&&prior.netMoney!=null?pct(current.netMoney,prior.netMoney):null,ordersPct:current.orderCount!=null&&prior.orderCount!=null?pct(current.orderCount,prior.orderCount):null,guestsPct:current.guestCount!=null&&prior.guestCount!=null?pct(current.guestCount,prior.guestCount):null,averageTicketPct:current.averageTicket!=null&&prior.averageTicket!=null?pct(current.averageTicket,prior.averageTicket):null,refundsPct:current.refundMoney!=null&&prior.refundMoney!=null?pct(current.refundMoney,prior.refundMoney):null,voidsPct:current.voidMoney!=null&&prior.voidMoney!=null?pct(current.voidMoney,prior.voidMoney):null,discountsPct:current.discountMoney!=null&&prior.discountMoney!=null?pct(current.discountMoney,prior.discountMoney):null},dataStatus,coverage,freshnessAt:(rows||[]).reduce((latest,row)=>!latest||row.freshnessAt>latest?row.freshnessAt:latest,null)};
}
async function aggregateMetrics(auth,query){
  const {range,rows}=await listMetrics(auth,query);const prev=query.comparison==='prior-year'?priorYearRange(range):previousRange(range);const previous=await DailyMetric.find(applyScope(auth,{businessDate:{$gte:prev.from,$lte:prev.to}},query.locationId)).lean();
  const locFilter={organizationId:auth.organizationId,status:'active'};const scoped=authorizedLocationFilter(auth,query.locationId);if(scoped)locFilter._id=scoped;const locationCount=Math.max(1,await Location.countDocuments(locFilter));
  return summarizeMetricRows(range,rows,previous,prev,locationCount,query.comparison);
}
const ALERT_NEXT_ACTIONS={
  sales_below_normal:'Review the affected store, channel and comparable-day sales before adjusting staffing or promotions.',
  exceptions_above_normal:'Open the exception orders, confirm the reason codes and coach or correct the process causing the increase.',
  average_ticket_dropping:'Compare item mix and channel mix with the normal period and check for discounting or missing upsell opportunities.',
  location_underperforming_peers:'Compare the location with its own baseline first, then review the largest KPI gaps versus peers.',
  urgent_negative_review:'Open the source review, investigate the service issue and prepare an approved response.',
  vendor_price_increase:'Open the approved source invoice, confirm normalized units and compare recent vendor prices before taking purchasing action.',
  food_cost_above_target:'Review approved food invoices and sales coverage for the same period, then investigate the largest category/vendor variances.',
  direct_orders_declining:'Validate the approved channel mapping, then compare direct-order volume/revenue and website/Google signals with the prior period.',
  inventory_critical:'Confirm the latest physical count and par level, then replenish through the restaurant\'s existing purchasing process if needed.',
  system_data_quality:'Open System Health, resolve the failed source/mapping/reconciliation issue and rerun the affected source/date.'
};
function priorityFromAlert(alert){const loc=alert.locationId;const locationId=loc&&typeof loc==='object'&&loc._id?String(loc._id):(loc?String(loc):null);const locationName=loc&&typeof loc==='object'&&loc.name?loc.name:null;return {ref:String(alert._id),type:alert.type,severity:alert.severity,title:alert.title,detail:alert.detail,locationId,locationName,evidence:alert.evidence||[],nextAction:ALERT_NEXT_ACTIONS[alert.type]||'Review the supporting evidence and investigate the affected location before taking action.'}}
function locationSnapshot(scoreRow){if(!scoreRow)return null;const loc=scoreRow.locationId;return {locationId:loc&&typeof loc==='object'?String(loc._id||loc.id):String(scoreRow.locationId||''),name:loc&&typeof loc==='object'?loc.name:'Location',score:scoreRow.score==null?null:Math.round(scoreRow.score*10)/10,rank:scoreRow.rank??null}}
function dashboardHeadline(summary,scores){
  if(summary.dataStatus==='UNAVAILABLE')return 'Prior-period performance is unavailable while source data is incomplete.';
  const weakest=scores.length?scores[scores.length-1]:null;const weakestName=weakest?.locationId?.name;
  const direction=summary.comparison.netSalesPct==null?'Performance is available':Math.abs(summary.comparison.netSalesPct)<3?'Performance is broadly stable':summary.comparison.netSalesPct>0?'Sales finished above the comparable period':'Sales finished below the comparable period';
  return `${direction}.${weakestName&&weakest?.score!=null&&weakest.score<70?` ${weakestName} needs attention.`:''}`;
}
async function dashboard(auth,query){
  const summary=await aggregateMetrics(auth,query);const latestDate=summary.range.to;const loc=authorizedLocationFilter(auth,query.locationId);
  const scoreFilter={organizationId:auth.organizationId,businessDate:latestDate};if(loc)scoreFilter.locationId=loc;
  const scores=await LocationScore.find(scoreFilter).populate('locationId','name').sort({rank:1}).lean();
  const health=salesWeightedHealth(scores);
  const weekday=new Date(latestDate+'T12:00:00Z').getUTCDay();const priorFilter={organizationId:auth.organizationId,businessDate:{$gte:addDays(latestDate,-42),$lt:latestDate}};if(loc)priorFilter.locationId=loc;
  const recentScores=await LocationScore.find(priorFilter).lean();const priorDates=[...new Set(recentScores.filter(r=>new Date(r.businessDate+'T12:00:00Z').getUTCDay()===weekday).map(r=>r.businessDate))].sort().reverse();
  let healthComparison={businessDate:null,score:null,change:null};if(priorDates.length){const priorDate=priorDates[0],prior=salesWeightedHealth(recentScores.filter(r=>r.businessDate===priorDate));healthComparison={businessDate:priorDate,score:prior.score==null?null:Math.round(prior.score*10)/10,change:health.score==null||prior.score==null?null:Math.round((health.score-prior.score)*10)/10};}
  const [openAlerts,scopeLocations,latestMetrics,reviewDrafts,reviewRepliesApproved,urgentReviews,forecastRows]=await Promise.all([
    Alert.find(applyScope(auth,{status:{$in:['OPEN','ACKNOWLEDGED']}},query.locationId)).populate('locationId','name').sort({createdAt:-1}).limit(100).lean(),
    Location.find({organizationId:auth.organizationId,status:'active',...(loc?{_id:loc}:{})}).select('name').lean(),
    DailyMetric.find(applyScope(auth,{businessDate:latestDate},query.locationId)).select('locationId guestCount dataStatus coverage').lean(),
    Review.countDocuments(applyScope(auth,{replyStatus:'draft'},query.locationId)),
    Review.countDocuments(applyScope(auth,{replyStatus:'approved'},query.locationId)),
    Review.countDocuments(applyScope(auth,{rating:{$lte:2},reviewedAt:{$gte:new Date(`${latestDate}T00:00:00Z`),$lte:new Date(`${latestDate}T23:59:59Z`)}},query.locationId)),
    Forecast.find(applyScope(auth,{},query.locationId)).sort({weekStart:-1}).limit(3).lean(),
  ]);
  const severityRank={critical:0,warning:1,info:2};const alerts=openAlerts.sort((a,b)=>(severityRank[a.severity]??9)-(severityRank[b.severity]??9)||new Date(b.createdAt)-new Date(a.createdAt)).slice(0,10);const priorities=alerts.slice(0,5).map(priorityFromAlert);
  const metricByLocation=new Map(latestMetrics.map(row=>[String(row.locationId),row]));const dataQuality=[];
  for(const location of scopeLocations){const metric=metricByLocation.get(String(location._id));if(!metric||metric.dataStatus==='UNAVAILABLE')dataQuality.push({locationId:String(location._id),locationName:location.name,metric:'source',status:'UNAVAILABLE',message:`${location.name} performance data is unavailable; labeled Unavailable, not zero.`});else{if(metric.dataStatus!=='COMPLETE')dataQuality.push({locationId:String(location._id),locationName:location.name,metric:'source',status:metric.dataStatus,message:`${location.name} source data is ${String(metric.dataStatus).toLowerCase()}; dependent metrics remain qualified.`});if(metric.guestCount==null)dataQuality.push({locationId:String(location._id),locationName:location.name,metric:'guestCount',status:'UNAVAILABLE',message:`${location.name} guest count is unavailable; labeled Unavailable, not zero.`})}}
  const bestLocation=locationSnapshot(scores[0]);const weakestLocation=scores.length?locationSnapshot(scores[scores.length-1]):null;
  const businessHealthScoreVersion=scores.find(s=>s.scoreVersion!=null)?.scoreVersion??1;
  const weekStart=addDays(latestDate,-((new Date(`${latestDate}T00:00:00Z`).getUTCDay()+6)%7));
  const weekForecast=forecastRows.filter(f=>f.weekStart===weekStart);
  const forecastExpected=weekForecast.reduce((sum,f)=>sum+(Number(f.expectedMoney)||0),0);
  const forecastStatus=weekForecast.some(f=>f.status==='UNAVAILABLE')?'UNAVAILABLE':weekForecast.some(f=>f.status==='PARTIAL'||f.status==='PROVISIONAL')?'PARTIAL':weekForecast.length?'COMPLETE':'UNAVAILABLE';
  const signals={
    exceptions:{refundMoney:summary.current.refundMoney,voidMoney:summary.current.voidMoney,discountMoney:summary.current.discountMoney,status:summary.current.refundMoney==null&&summary.current.voidMoney==null?'UNAVAILABLE':'COMPLETE'},
    reviews:{urgentCount:urgentReviews,draftCount:reviewDrafts,approvedCount:reviewRepliesApproved,status:urgentReviews>0?'WARNING':'COMPLETE'},
    forecast:{weekStart,expectedMoney:weekForecast.length?forecastExpected:null,status:forecastStatus,coverage:weekForecast.length?Math.round(weekForecast.reduce((s,f)=>s+(Number(f.coverage)||0),0)/weekForecast.length):0},
  };
  return {...summary,headline:dashboardHeadline(summary,scores),businessHealth:health.score==null?null:Math.round(health.score*10)/10,businessHealthCoverage:Math.round(health.coverage),businessHealthComparison:healthComparison,businessHealthScoreVersion,bestLocation,weakestLocation,scores,alerts,priorities,dataQuality,workflow:{reviewDrafts,reviewRepliesApproved},signals};
}
async function finance(auth,query){
  if(!auth.canFinance)throw new ApiError(403,'Finance access required');
  const range=parseRange(query);const comparisonMode=query.comparison==='prior-year'?'prior-year':'previous';
  const compareOf=(r)=>comparisonMode==='prior-year'?priorYearRange(r):previousRange(r);
  const mondayOffset=(new Date(range.to+'T00:00:00Z').getUTCDay()+6)%7;
  const periodRanges={
    daily:{from:range.to,to:range.to,label:'Daily'},
    weekly:{from:addDays(range.to,-6),to:range.to,label:'Trailing 7 days'},
    mtd:{from:`${range.to.slice(0,7)}-01`,to:range.to,label:'Month to date'},
    wtd:{from:addDays(range.to,-mondayOffset),to:range.to,label:'Week to date'},
  };
  const windows=[range,...Object.values(periodRanges),compareOf(range),...Object.values(periodRanges).map(compareOf)];
  const widestFrom=windows.map((w)=>w.from).sort()[0];const widestTo=windows.map((w)=>w.to).sort().reverse()[0];
  const locFilter={organizationId:auth.organizationId,status:'active'};const scoped=authorizedLocationFilter(auth,query.locationId);if(scoped)locFilter._id=scoped;
  const metricSelect='locationId businessDate dataStatus coverage grossMoney netMoney orderCount guestCount averageTicket refundMoney voidMoney discountMoney sourceProviders freshnessAt';
  const scoreFilter={organizationId:auth.organizationId,businessDate:range.to};if(scoped)scoreFilter.locationId=scoped;
  const [wideRows,invoices,locations,locationCount,settingHistory,scoreRows]=await Promise.all([
    DailyMetric.find(applyScope(auth,{businessDate:{$gte:widestFrom,$lte:widestTo}},query.locationId)).select(metricSelect).sort({businessDate:1}).lean(),
    Invoice.find(applyScope(auth,{status:'APPROVED',invoiceDate:{$gte:range.from,$lte:range.to}},query.locationId)).select('lineItems').lean(),
    Location.find(locFilter).select('name').lean(),
    Location.countDocuments(locFilter),
    settings.listHistory(auth.organizationId,['selectedMargin','foodCostTarget']),
    LocationScore.find(scoreFilter).populate('locationId','name').sort({rank:1}).select('locationId rank score coverage').lean(),
  ]);
  const slice=(from,to)=>wideRows.filter((row)=>row.businessDate>=from&&row.businessDate<=to);
  const summary=summarizeMetricRows(range,slice(range.from,range.to),slice(compareOf(range).from,compareOf(range).to),compareOf(range),locationCount,comparisonMode);
  const periodSummaries={};
  for(const [key,r] of Object.entries(periodRanges)){
    const prev=compareOf(r);
    const s=summarizeMetricRows(r,slice(r.from,r.to),slice(prev.from,prev.to),prev,locationCount,comparisonMode);
    periodSummaries[key]={range:{from:r.from,to:r.to,label:r.label},current:s.current,comparison:s.comparison,dataStatus:s.dataStatus,coverage:s.coverage};
  }
  const foodSpend=invoices.reduce((s,i)=>s+(i.lineItems||[]).filter(x=>['meat','seafood','produce','food','ingredient'].includes(String(x.category||'').toLowerCase())).reduce((a,x)=>a+(x.totalMoney||0),0),0);
  const atEnd=new Date(range.to+'T23:59:59Z');
  const target=settings.historyEffective(settingHistory,'foodCostTarget',query.locationId||null,atEnd,settings.DEFAULTS.foodCostTarget);
  const margin=settings.historyEffective(settingHistory,'selectedMargin',query.locationId||null,atEnd,settings.DEFAULTS.selectedMargin);
  const names=new Map(locations.map((l)=>[String(l._id),l.name]));
  const currentRows=slice(range.from,range.to).filter((r)=>r.dataStatus!=='UNAVAILABLE');
  const rankingMap=new Map();const trendMap=new Map();
  for(const row of currentRows){
    const id=String(row.locationId);const at=new Date(row.businessDate+'T23:59:59Z');
    const m=settings.historyEffective(settingHistory,'selectedMargin',id,at,margin??settings.DEFAULTS.selectedMargin);
    const cur=rankingMap.get(id)||{locationId:id,locationName:names.get(id)||'Location',netMoney:0,estimatedProfit:0,days:0};
    cur.netMoney+=Number(row.netMoney||0);cur.estimatedProfit+=Math.round(Number(row.netMoney||0)*m);cur.days++;rankingMap.set(id,cur);
    const day=trendMap.get(row.businessDate)||{businessDate:row.businessDate,netMoney:0,estimatedProfit:0};
    day.netMoney+=Number(row.netMoney||0);day.estimatedProfit+=Math.round(Number(row.netMoney||0)*m);trendMap.set(row.businessDate,day);
  }
  const endMargins=new Map();for(const id of rankingMap.keys())endMargins.set(id,settings.historyEffective(settingHistory,'selectedMargin',id,atEnd,margin??settings.DEFAULTS.selectedMargin));
  const storeRankings=[...rankingMap.values()].sort((a,b)=>b.netMoney-a.netMoney).map((x,i)=>({...x,rank:i+1,selectedMargin:endMargins.get(x.locationId)??0}));
  const dailyTrend=[...trendMap.values()].sort((a,b)=>a.businessDate.localeCompare(b.businessDate));
  const sourceProviders=[...new Set(currentRows.flatMap((row)=>row.sourceProviders||[]))];
  const initials=(name)=>String(name||'Location').split(/\s+/).filter(Boolean).map((w)=>w[0]).join('').slice(0,3).toUpperCase();
  const locationScoreOrder=scoreRows.map((row)=>{const name=row.locationId&&typeof row.locationId==='object'?row.locationId.name:'Location';return {locationId:row.locationId&&typeof row.locationId==='object'?String(row.locationId._id):String(row.locationId||''),locationName:name,initials:initials(name),rank:row.rank??null,score:row.score==null?null:row.score}});
  return {...summary,approvedFoodPurchases:foodSpend,foodCostPercent:summary.current.netMoney?foodSpend/summary.current.netMoney:null,foodCostTarget:target,estimatedProfitAtSelectedMargin:summary.current.netMoney==null?null:Math.round(summary.current.netMoney*(margin||0)),selectedMargin:margin,invoiceCoverage:{approved:invoices.length,label:'Approved invoices only'},storeRankings,dailyTrend,periodSummaries,sourceProviders,locationScoreOrder};
}
function deterministicPerformanceSummary(summary){const change=summary.comparison.netSalesPct;if(summary.dataStatus==='UNAVAILABLE')return 'Insufficient reliable POS data is available for the selected period.';if(change!=null&&change<=-5)return `Net sales are ${Math.abs(change).toFixed(1)}% below the comparable period; review the location and channel mix for the largest decline.`;if(change!=null&&change>=5)return `Net sales are ${change.toFixed(1)}% above the comparable period; identify the strongest location, channel and items contributing to the gain.`;if(change!=null)return `Net sales are broadly stable at ${change>=0?'+':''}${change.toFixed(1)}% versus the comparable period; monitor exceptions and item mix for material changes.`;return 'Current-period performance is available, but comparable history is insufficient for a reliable change statement.';}
async function performanceSummary(summary,locationComparisons,locationScores){const fallback=deterministicPerformanceSummary(summary);if(!env.openaiApiKey)return {text:fallback,mode:'DETERMINISTIC_FALLBACK'};try{const evidence={range:summary.range,dataStatus:summary.dataStatus,coverage:summary.coverage,current:summary.current,comparison:summary.comparison,locations:locationComparisons.slice(0,6),scores:locationScores.slice(0,6).map(s=>({name:s.locationId?.name||'Location',score:s.score,rank:s.rank,coverage:s.coverage}))};const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${env.openaiApiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:env.openaiModel,max_output_tokens:90,input:[{role:'system',content:[{type:'input_text',text:'Write exactly one concise sentence identifying one key issue or opportunity from the supplied Gourmet Palace performance evidence. Use only supplied figures, preserve partial/unavailable meaning, and do not claim causation.'}]},{role:'user',content:[{type:'input_text',text:JSON.stringify(evidence)}]}]})});if(!response.ok)return {text:fallback,mode:'DETERMINISTIC_FALLBACK'};const data=await response.json();const text=String(data.output_text||'').trim();return text?{text:text.replace(/\s+/g,' '),mode:'AI'}:{text:fallback,mode:'DETERMINISTIC_FALLBACK'}}catch{return {text:fallback,mode:'DETERMINISTIC_FALLBACK'}}}
function hourInZone(value,timeZone){if(!value)return null;try{const hour=new Intl.DateTimeFormat('en-US',{timeZone,hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).find((part)=>part.type==='hour');return hour?Number(hour.value):null}catch{return null}}
function daypartLabel(hour){if(hour==null)return null;if(hour<8)return 'Overnight';if(hour<10)return '8a';if(hour<12)return '10a';if(hour<14)return '12p';if(hour<16)return '2p';if(hour<18)return '4p';if(hour<20)return '6p';if(hour<22)return '8p';return '10p'}
function accumulateItems(rows,map){for(const row of rows){if(row.dataStatus==='UNAVAILABLE')continue;for(const item of row.topItems||[]){const current=map.get(item.name)||{name:item.name,units:0,revenue:0,category:item.category};current.units+=item.units||0;current.revenue+=item.revenue||0;if(item.category)current.category=item.category;map.set(item.name,current)}}}
async function performance(auth,query){
  const summary=await aggregateMetrics(auth,query);const rows=(await listMetrics(auth,query)).rows;const channels={};const items=new Map(),cats=new Map();
  for(const r of rows){if(r.dataStatus==='UNAVAILABLE')continue;for(const[k,v]of Object.entries(r.channels||{}))channels[k]=(channels[k]||0)+Number(v||0);accumulateItems([r],items);for(const c of r.categories||[])cats.set(c.name,(cats.get(c.name)||0)+(c.revenue||0));}
  const prev=summary.comparison.previousRange;const prevRows=await DailyMetric.find(applyScope(auth,{businessDate:{$gte:prev.from,$lte:prev.to}},query.locationId)).lean();const priorItems=new Map();accumulateItems(prevRows,priorItems);
  const ids=[...new Set(rows.map(r=>String(r.locationId)))];const locations=await Location.find({_id:{$in:ids},organizationId:auth.organizationId}).select('name timezone').lean();const names=new Map(locations.map(l=>[String(l._id),l.name]));const timezones=new Map(locations.map(l=>[String(l._id),l.timezone||'America/Los_Angeles']));
  const sum=(list,key)=>list.filter(r=>r.dataStatus!=='UNAVAILABLE').reduce((total,r)=>total+Number(r[key]||0),0);
  const locationComparisons=ids.map(id=>{const currentRows=rows.filter(r=>String(r.locationId)===id),priorRows=prevRows.filter(r=>String(r.locationId)===id);const netMoney=sum(currentRows,'netMoney'),orderCount=sum(currentRows,'orderCount'),grossMoney=sum(currentRows,'grossMoney'),guestCount=currentRows.length&&currentRows.every(r=>r.guestCount!=null)?sum(currentRows,'guestCount'):null,refundMoney=sum(currentRows,'refundMoney'),voidMoney=sum(currentRows,'voidMoney'),discountMoney=sum(currentRows,'discountMoney'),priorNet=sum(priorRows,'netMoney'),priorOrders=sum(priorRows,'orderCount');return {locationId:id,locationName:names.get(id)||'Location',grossMoney,netMoney,orderCount,guestCount,refundMoney,voidMoney,discountMoney,averageTicket:orderCount?Math.round(netMoney/orderCount):null,netSalesPct:pct(netMoney,priorNet),ordersPct:pct(orderCount,priorOrders),coverage:Math.min(100,Math.round(currentRows.reduce((total,r)=>total+Math.max(0,Math.min(100,Number(r.coverage??(r.dataStatus==='COMPLETE'?100:0)))),0)/(Math.round((new Date(summary.range.to+'T00:00:00Z')-new Date(summary.range.from+'T00:00:00Z'))/86400000)+1)))}}).sort((a,b)=>b.netMoney-a.netMoney);
  const scoreFilter={organizationId:auth.organizationId,businessDate:summary.range.to};const scoped=authorizedLocationFilter(auth,query.locationId);if(scoped)scoreFilter.locationId=scoped;const locationScores=await LocationScore.find(scoreFilter).populate('locationId','name').sort({rank:1}).lean();
  const narration=await performanceSummary(summary,locationComparisons,locationScores);
  const ranked=[...items.values()].filter(i=>i.units>0||i.revenue>0).map(item=>{const prior=priorItems.get(item.name);return {...item,changePct:prior?.revenue?pct(item.revenue,prior.revenue):null}});
  const sourceProviders=[...new Set(rows.flatMap(row=>row.sourceProviders||[]))];
  const guestSource=summary.current.guestCount==null?'unavailable':sourceProviders.length===1?sourceProviders[0]:sourceProviders.length?'mixed':'unavailable';
  let peerComparison=null;
  if(query.locationId&&locationComparisons.length>1){const selected=locationComparisons.find(row=>row.locationId===String(query.locationId));const peers=locationComparisons.filter(row=>row.locationId!==String(query.locationId));if(selected&&peers.length){const avg=(key)=>peers.reduce((total,row)=>total+Number(row[key]||0),0)/peers.length;const guestPeers=peers.filter(row=>row.guestCount!=null);peerComparison={grossPct:pct(selected.grossMoney,avg('grossMoney')),netSalesPct:pct(selected.netMoney,avg('netMoney')),ordersPct:pct(selected.orderCount,avg('orderCount')),averageTicketPct:pct(selected.averageTicket,avg('averageTicket')),guestsPct:selected.guestCount!=null&&guestPeers.length?pct(selected.guestCount,guestPeers.reduce((total,row)=>total+row.guestCount,0)/guestPeers.length):null,refundsPct:pct(selected.refundMoney,avg('refundMoney')),peerCount:peers.length}}}
  const rangeFilter={businessDate:{$gte:summary.range.from,$lte:summary.range.to}};
  const daypartFilter=applyScope(auth,{...rangeFilter,orderState:'COMPLETED'},query.locationId);
  const exceptionFilter=applyScope(auth,{...rangeFilter,$or:[{refundMoney:{$gt:0}},{voidMoney:{$gt:0}},{discountMoney:{$gt:0}},{orderState:'CANCELED'}]},query.locationId);
  const [daypartRows,exceptionRows]=await Promise.all([
    Order.find(daypartFilter).select('locationId sourceTimestamp netMoney').limit(20000).lean(),
    Order.find(exceptionFilter).select('locationId sourceTimestamp refundMoney voidMoney discountMoney channel').limit(20000).lean(),
  ]);
  const daypartOrder=['Overnight','8a','10a','12p','2p','4p','6p','8p','10p'];const daypartMap=new Map(daypartOrder.map((label)=>[label,0]));let stamped=0;const hours=new Set();
  for(const order of daypartRows){const hour=hourInZone(order.sourceTimestamp,timezones.get(String(order.locationId))||'America/Los_Angeles');const label=daypartLabel(hour);if(!label)continue;stamped+=1;daypartMap.set(label,(daypartMap.get(label)||0)+Number(order.netMoney||0))}
  const prepared=[];
  for(const order of exceptionRows){
    const hour=hourInZone(order.sourceTimestamp,timezones.get(String(order.locationId))||'America/Los_Angeles');
    if(hour!=null)hours.add(hour);
    prepared.push({locationId:String(order.locationId),locationName:names.get(String(order.locationId))||'Location',channel:order.channel||'unknown',daypart:daypartLabel(hour),refundMoney:order.refundMoney||0,voidMoney:order.voidMoney||0,discountMoney:order.discountMoney||0});
  }
  const daypartReliable=hours.size>=2;
  const exceptionClusters=clusterExceptionOrders(prepared.map((row)=>({...row,daypart:daypartReliable?row.daypart:null})));
  const dayparts=daypartOrder.map((label)=>({label,netMoney:daypartMap.get(label)||0}));
  return {...summary,channels,topItems:ranked.sort((a,b)=>b.revenue-a.revenue).slice(0,20),slowItems:ranked.filter(item=>item.units>=1).sort((a,b)=>a.revenue-b.revenue).slice(0,20),categories:[...cats.entries()].map(([name,revenue])=>({name,revenue})).sort((a,b)=>b.revenue-a.revenue),locationComparisons,locationScores,summaryLine:narration.text,summaryMode:narration.mode,sourceProviders,guestSource,peerComparison,dayparts,daypartStatus:stamped?(stamped>=Math.max(1,daypartRows.length)*.5?'COMPLETE':'PARTIAL'):'UNAVAILABLE',exceptionClusters};
}
async function orders(auth,query){
  const range=parseRange(query);
  const {page,limit,skip}=parsePagination(query,{defaultLimit:25,maxLimit:100});
  const filter=applyScope(auth,{businessDate:{$gte:range.from,$lte:range.to}},query.locationId);
  if(query.exception==='true')filter.$or=[{refundMoney:{$gt:0}},{voidMoney:{$gt:0}},{discountMoney:{$gt:0}},{orderState:'CANCELED'}];
  const [rows,total]=await Promise.all([
    Order.find(filter).populate('locationId','name').sort({sourceTimestamp:-1,_id:-1}).skip(skip).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);
  return {
    range,
    ...paginatedResult('orders',rows.map(({rawRef,...row})=>row),{page,limit,total}),
  };
}

function emptyForecastDays(weekStart){
  return Array.from({length:7},(_,i)=>{
    const businessDate=addDays(weekStart,i);
    return {businessDate,weekday:new Date(`${businessDate}T00:00:00Z`).getUTCDay(),expectedMoney:null,lowMoney:null,highMoney:null,comparableCount:0,status:'UNAVAILABLE'};
  });
}
function forecastLocationName(locationId){return locationId&&typeof locationId==='object'&&locationId.name?locationId.name:'Location'}
function forecastLocationId(locationId){return locationId&&typeof locationId==='object'?String(locationId._id||''):String(locationId||'')}
function aggregateThisWeek(rows,weekStart){
  const comparableTarget=8,provisionalMin=4;
  const empty={weekStart,expectedMoney:null,lowMoney:null,highMoney:null,coverage:0,status:'UNAVAILABLE',formulaVersion:2,comparableTarget,provisionalMin,comparisonDates:[],days:emptyForecastDays(weekStart),locationCount:0,locations:[]};
  if(!rows.length)return empty;
  const days=emptyForecastDays(weekStart).map((slot)=>{
    const parts=rows.flatMap((row)=>(row.days||[]).filter((day)=>day.businessDate===slot.businessDate));
    const usable=parts.filter((day)=>day.expectedMoney!=null);
    const comparableCount=parts.length?Math.round(parts.reduce((sum,day)=>sum+Number(day.comparableCount||0),0)/parts.length):0;
    if(!usable.length)return {...slot,comparableCount,status:'UNAVAILABLE'};
    const allComplete=usable.length===rows.length&&usable.every((day)=>day.status==='COMPLETE');
    return {...slot,expectedMoney:usable.reduce((sum,day)=>sum+Number(day.expectedMoney||0),0),lowMoney:usable.reduce((sum,day)=>sum+Number(day.lowMoney||0),0),highMoney:usable.reduce((sum,day)=>sum+Number(day.highMoney||0),0),comparableCount:Math.round(usable.reduce((sum,day)=>sum+Number(day.comparableCount||0),0)/usable.length),status:allComplete?'COMPLETE':'PROVISIONAL'};
  });
  const published=days.some((day)=>day.expectedMoney!=null);
  const statuses=[...new Set(rows.map((row)=>row.status))];
  let status='PROVISIONAL';
  if(statuses.length===1)status=statuses[0];
  return {
    weekStart,
    expectedMoney:published?rows.reduce((sum,row)=>sum+(Number(row.expectedMoney)||0),0):null,
    lowMoney:published?rows.reduce((sum,row)=>sum+(Number(row.lowMoney)||0),0):null,
    highMoney:published?rows.reduce((sum,row)=>sum+(Number(row.highMoney)||0),0):null,
    coverage:Math.round(rows.reduce((sum,row)=>sum+Number(row.coverage||0),0)/rows.length),
    status,
    formulaVersion:rows.find((row)=>row.formulaVersion!=null)?.formulaVersion??2,
    comparableTarget,
    provisionalMin,
    comparisonDates:[...new Set(rows.flatMap((row)=>row.comparisonDates||[]))],
    days,
    locationCount:rows.length,
    locations:rows.map((row)=>({locationId:forecastLocationId(row.locationId),locationName:forecastLocationName(row.locationId),expectedMoney:row.expectedMoney??null,lowMoney:row.lowMoney??null,highMoney:row.highMoney??null,coverage:row.coverage??0,status:row.status})),
  };
}
async function hydrateForecastDays(row){
  if(Array.isArray(row.days)&&row.days.length===7)return row;
  const locationId=row.locationId&&typeof row.locationId==='object'?row.locationId._id:row.locationId;
  const history=await DailyMetric.find({organizationId:row.organizationId,locationId,businessDate:{$lt:addDays(row.weekStart,7)},dataStatus:'COMPLETE'}).select('businessDate netMoney').sort({businessDate:-1}).limit(200).lean();
  const built=buildWeekForecast(row.weekStart,history);
  const updated=await Forecast.findByIdAndUpdate(row._id,{days:built.days,formulaVersion:built.formulaVersion,comparisonDates:built.comparisonDates,expectedMoney:built.expectedMoney,lowMoney:built.lowMoney,highMoney:built.highMoney,coverage:built.coverage,status:built.status},{new:true}).populate('locationId','name').lean();
  return updated||{...row,...built};
}
async function forecasts(auth,query){
  const range=parseRange(query);
  const loc=authorizedLocationFilter(auth,query.locationId);
  const filter={organizationId:auth.organizationId};
  if(loc)filter.locationId=loc;
  const weekStart=addDays(range.to,-((new Date(`${range.to}T00:00:00Z`).getUTCDay()+6)%7));
  let weekRows=await Forecast.find({...filter,weekStart}).populate('locationId','name').lean();
  if(!weekRows.length){
    const locFilter={organizationId:auth.organizationId,status:'active'};
    if(loc)locFilter._id=loc;
    const locations=await Location.find(locFilter).select('_id').lean();
    await Promise.all(locations.map((location)=>rebuildForecast({organizationId:auth.organizationId,locationId:location._id,businessDate:range.to})));
    weekRows=await Forecast.find({...filter,weekStart}).populate('locationId','name').lean();
  }
  const [hydrated,recent]=await Promise.all([
    Promise.all(weekRows.map(hydrateForecastDays)),
    Forecast.find(filter).populate('locationId','name').sort({weekStart:-1}).limit(20).lean(),
  ]);
  return {forecasts:recent,thisWeek:aggregateThisWeek(hydrated,weekStart)};
}
async function presence(auth,query){
  if(!auth.isAdmin)throw new ApiError(403,'SEO & Growth access requires Owner/Admin');
  const range=parseRange(query);
  const filter=applyScope(auth,{businessDate:{$gte:range.from,$lte:range.to}},query.locationId);
  const seo=await SeoMetric.find(filter).lean();
  const revFilter=applyScope(auth,{reviewedAt:{$gte:new Date(range.from+'T00:00:00Z'),$lte:new Date(range.to+'T23:59:59Z')}},query.locationId);
  const reviews=await Review.find(revFilter).sort({reviewedAt:-1}).lean();
  const prior=previousRange(range);
  const priorSeo=await SeoMetric.find(applyScope(auth,{businessDate:{$gte:prior.from,$lte:prior.to}},query.locationId)).lean();
  const total=(rows,source,key)=>rows.filter(x=>x.source===source&&x.status==='COMPLETE').reduce((sum,x)=>sum+Number(x.metrics?.[key]||0),0);
  const recommendations=[];
  const checks=[['ga4','sessions','organic/website sessions'],['gsc','clicks','Search Console clicks'],['square_direct','revenue','direct-order revenue']];
  for(const [source,key,label] of checks){
    const current=total(seo,source,key),previous=total(priorSeo,source,key);
    if(seo.some(x=>x.source===source&&x.status==='COMPLETE')&&previous>0&&current<previous*.9)recommendations.push({source,metric:key,period:range,confidence:'HIGH',evidence:{current,previous,changePct:(current-previous)/previous},recommendation:`Investigate the decline in ${label}; compare the affected location, landing pages/channels, and the prior period before taking action.`});
  }
  const gsc=seo.filter(x=>x.source==='gsc'&&x.status==='COMPLETE');
  const impressions=gsc.reduce((sum,x)=>sum+Number(x.metrics?.impressions||0),0),clicks=gsc.reduce((sum,x)=>sum+Number(x.metrics?.clicks||0),0);
  if(impressions>=100&&clicks/impressions<.02)recommendations.push({source:'gsc',metric:'ctr',period:range,confidence:'MEDIUM',evidence:{clicks,impressions,ctr:clicks/impressions},recommendation:'Review high-impression, low-CTR Search Console queries/pages and improve titles/snippets where the page intent matches the query.'});
  const locIds=[...new Set(seo.map((row)=>String(row.locationId)))];
  const locs=await Location.find({_id:{$in:locIds}}).select('name').lean();
  const nameById=new Map(locs.map((row)=>[String(row._id),row.name]));
  const byLoc=new Map();
  for(const row of seo){
    const id=String(row.locationId);
    const cur=byLoc.get(id)||{locationId:id,locationName:nameById.get(id)||'Location',ga4Sessions:null,gscClicks:null,directRevenue:null,gbpClicks:null};
    if(row.status==='COMPLETE'){
      if(row.source==='ga4')cur.ga4Sessions=(cur.ga4Sessions??0)+Number(row.metrics?.sessions||0);
      if(row.source==='gsc')cur.gscClicks=(cur.gscClicks??0)+Number(row.metrics?.clicks||0);
      if(row.source==='square_direct')cur.directRevenue=(cur.directRevenue??0)+Number(row.metrics?.revenue||0);
      if(row.source==='gbp')cur.gbpClicks=(cur.gbpClicks??0)+Number(row.metrics?.website_clicks||0);
    }
    byLoc.set(id,cur);
  }
  return {range,previousRange:prior,seo,reviews,recommendations,summary:summarizeSeoMetrics(seo,priorSeo),locations:[...byLoc.values()]};
}
module.exports={rebuildDaily,rebuildBaselinesAndScore,rebuildForecast,listMetrics,aggregateMetrics,dashboard,finance,performance,orders,forecasts,presence};
