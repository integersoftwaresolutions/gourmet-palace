const test=require('node:test');const assert=require('node:assert/strict');
const {DEFAULTS,historyEffective}=require('../src/modules/settings/settings.service');

test('historyEffective uses latest org then location override without extra queries',()=>{
  const history=[
    {key:'selectedMargin',locationId:null,effectiveFrom:new Date('2024-01-01T00:00:00Z'),value:0.15},
    {key:'selectedMargin',locationId:null,effectiveFrom:new Date('2025-01-01T00:00:00Z'),value:0.12},
    {key:'selectedMargin',locationId:'loc-a',effectiveFrom:new Date('2025-06-01T00:00:00Z'),value:0.18},
    {key:'foodCostTarget',locationId:null,effectiveFrom:new Date('2024-01-01T00:00:00Z'),value:{min:0.2,max:0.22}},
  ];
  assert.equal(historyEffective(history,'selectedMargin',null,new Date('2024-06-01T00:00:00Z'),DEFAULTS.selectedMargin),0.15);
  assert.equal(historyEffective(history,'selectedMargin','loc-b',new Date('2025-03-01T00:00:00Z'),DEFAULTS.selectedMargin),0.12);
  assert.equal(historyEffective(history,'selectedMargin','loc-a',new Date('2025-07-01T00:00:00Z'),DEFAULTS.selectedMargin),0.18);
  assert.equal(historyEffective(history,'selectedMargin','loc-a',new Date('2025-03-01T00:00:00Z'),DEFAULTS.selectedMargin),0.12);
  assert.deepEqual(historyEffective(history,'foodCostTarget',null,new Date('2025-01-01T00:00:00Z'),DEFAULTS.foodCostTarget),{min:0.2,max:0.22});
  assert.equal(historyEffective([],'selectedMargin','loc-a',new Date(),DEFAULTS.selectedMargin),DEFAULTS.selectedMargin);
});
