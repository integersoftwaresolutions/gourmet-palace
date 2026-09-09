const test=require('node:test');const assert=require('node:assert/strict');const {median,boundedTrendExpectation,salesWeightedHealth,clusterExceptionOrders,buildWeekForecast}=require('../src/modules/analytics/math');
test('bounded comparable baseline uses robust center with +/-10% recent-trend cap',()=>{const rising=boundedTrendExpectation([140,135,130,125,100,100,100,100]);assert.equal(median([1,3,2,4]),2.5);assert.equal(rising.center,112.5);assert.equal(rising.trendFactor,1.1);assert.equal(rising.expected,123.75000000000001);const falling=boundedTrendExpectation([50,55,60,65,100,100,100,100]);assert.equal(falling.trendFactor,.9);assert.equal(falling.expected,74.25)});
test('business health is sales-weighted and coverage follows eligible sales weight',()=>{const result=salesWeightedHealth([{score:100,netSales:10000,coverage:100},{score:50,netSales:30000,coverage:50},{score:null,netSales:90000,coverage:100}]);assert.equal(result.score,62.5);assert.equal(result.coverage,62.5);assert.equal(result.eligibleCount,2)});
test('week forecast withholds weekdays with fewer than four comparables',()=>{
  const mondays=['2026-08-17','2026-08-10','2026-08-03','2026-07-27','2026-07-20','2026-07-13','2026-07-06','2026-06-29'];
  const history=mondays.map((businessDate)=>({businessDate,netMoney:10000}));
  const week=buildWeekForecast('2026-08-24',history);
  assert.equal(week.days.length,7);
  assert.equal(week.days[0].businessDate,'2026-08-24');
  assert.equal(week.days[0].status,'COMPLETE');
  assert.equal(week.days[0].comparableCount,8);
  assert.equal(week.days[0].expectedMoney,10000);
  assert.equal(week.days[1].status,'UNAVAILABLE');
  assert.equal(week.days[1].expectedMoney,null);
  assert.equal(week.status,'UNAVAILABLE');
  assert.equal(week.expectedMoney,10000);
  const four=buildWeekForecast('2026-08-24',mondays.slice(0,4).map((businessDate)=>({businessDate,netMoney:8000})));
  assert.equal(four.days[0].status,'PROVISIONAL');
  assert.equal(four.days[0].comparableCount,4);
  const empty=buildWeekForecast('2026-08-24',[]);
  assert.equal(empty.status,'UNAVAILABLE');
  assert.equal(empty.expectedMoney,null);
  assert.equal(empty.lowMoney,null);
  assert.equal(empty.highMoney,null);
  assert.ok(empty.days.every((day)=>day.status==='UNAVAILABLE'&&day.expectedMoney==null));
});
test('exception clusters use only refund/void/discount money already on the order',()=>{
  const clusters=clusterExceptionOrders([
    {locationId:'wh',locationName:'Woodland Hills',channel:'delivery',daypart:'6p',refundMoney:400,voidMoney:0,discountMoney:0},
    {locationId:'wh',locationName:'Woodland Hills',channel:'delivery',daypart:'6p',refundMoney:200,voidMoney:0,discountMoney:0},
    {locationId:'sv',locationName:'Simi Valley',channel:'dine_in',daypart:null,refundMoney:0,voidMoney:100,discountMoney:50},
  ]);
  assert.equal(clusters[0].kind,'refunds');
  assert.equal(clusters[0].orderCount,2);
  assert.equal(clusters[0].money,600);
  assert.equal(clusters[0].daypart,'6p');
  assert.equal(clusters.find((row)=>row.kind==='voids')?.locationName,'Simi Valley');
  assert.equal(clusterExceptionOrders([{locationId:'x',refundMoney:0,voidMoney:0,discountMoney:0}]).length,0);
});


test('SEO freshness ignores unavailable sync attempts and preserves real zero sessions', () => {
  const { summarizeSeoMetrics } = require('../src/modules/analytics/math');
  const unavailable = { source: 'ga4', status: 'UNAVAILABLE', locationId: 'a', metrics: { sessions: 0 }, freshnessAt: '2026-09-09T14:00:00Z' };
  const empty = summarizeSeoMetrics([unavailable], []);
  assert.equal(empty.ga4.sessions, null);
  assert.equal(empty.freshnessAt, null);
  const complete = { ...unavailable, status: 'COMPLETE', freshnessAt: '2026-09-08T14:00:00Z' };
  const result = summarizeSeoMetrics([complete, unavailable], []);
  assert.equal(result.ga4.sessions, 0);
  assert.equal(result.ga4.status, 'COMPLETE');
  assert.equal(result.freshnessAt, complete.freshnessAt);
});
