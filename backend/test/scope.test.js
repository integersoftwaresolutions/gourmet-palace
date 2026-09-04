const test=require('node:test');const assert=require('node:assert/strict');const {authorizedLocationFilter,applyScope}=require('../src/utils/scope');
const manager={organizationId:'org1',allLocations:false,locationIds:['loc1','loc2']};
test('manager unqualified query is constrained to assigned locations',()=>assert.deepEqual(authorizedLocationFilter(manager),{$in:['loc1','loc2']}));
test('manager cannot request another location',()=>assert.throws(()=>authorizedLocationFilter(manager,'loc3'),e=>e.statusCode===403));
test('scope always injects organization and location boundary',()=>assert.deepEqual(applyScope(manager,{status:'OPEN'}),{status:'OPEN',organizationId:'org1',locationId:{$in:['loc1','loc2']}}));
