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
module.exports={median,boundedTrendExpectation,salesWeightedHealth};
