const test=require('node:test');const assert=require('node:assert/strict');const {parseRange,previousRange,priorYearRange}=require('../src/utils/dateRange');
test('custom range validates and retains exact dates',()=>{assert.deepEqual(parseRange({from:'2026-07-01',to:'2026-07-31'}),{from:'2026-07-01',to:'2026-07-31',label:'Custom'})});
test('previous period is same duration immediately before range',()=>{assert.deepEqual(previousRange({from:'2026-07-01',to:'2026-07-31'}),{from:'2026-05-31',to:'2026-06-30'})});
test('prior-year comparison keeps month/day',()=>{assert.deepEqual(priorYearRange({from:'2026-07-01',to:'2026-07-31'}),{from:'2025-07-01',to:'2025-07-31'})});
