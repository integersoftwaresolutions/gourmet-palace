const test = require('node:test');
const assert = require('node:assert/strict');
const { generateRecommendations, executiveSummary, csv } = require('../src/modules/reports/reports.service');

function baseReport(overrides = {}) {
  return {
    range: { from: '2026-08-01', to: '2026-08-31' },
    performance: {
      dataStatus: 'COMPLETE',
      coverage: 100,
      current: { netMoney: 1000000, refundMoney: 0, voidMoney: 0, discountMoney: 0, orderCount: 800 },
      comparison: { netSalesPct: 1.2 },
    },
    finance: { foodCostPercent: 0.28, foodCostTarget: { min: 0.24, max: 0.32 }, approvedFoodPurchases: 280000 },
    scorecards: [],
    invoices: { count: 12, total: 280000, vendors: [], categorySpend: {} },
    priceChanges: [],
    inventorySummary: { count: 10, stale: 0, low: 0 },
    reviewSummary: { count: 4, averageRating: 4.6, urgent: 0 },
    seoSummary: { ga4: { sessionsPct: 2, sessions: 1000 }, gsc: {}, squareDirect: {} },
    alertSummary: { open: 0, critical: 0 },
    forecasts: [{ weekStart: '2026-08-24', expectedMoney: 200000 }],
    ...overrides,
  };
}

test('recommendations stay empty when the period has no material exceptions', () => {
  const recs = generateRecommendations(baseReport());
  assert.equal(recs.length, 0);
  assert.match(executiveSummary(baseReport(), recs), /did not produce a material exception/);
});

test('sales, food cost, inventory and reviews produce period-specific recommendations', () => {
  const recs = generateRecommendations(baseReport({
    performance: {
      dataStatus: 'PARTIAL',
      coverage: 61,
      current: { netMoney: 800000, refundMoney: 40000, voidMoney: 0, discountMoney: 0 },
      comparison: { netSalesPct: -12.4 },
    },
    finance: { foodCostPercent: 0.41, foodCostTarget: { max: 0.32 }, approvedFoodPurchases: 328000 },
    inventorySummary: { count: 8, stale: 2, low: 3 },
    reviewSummary: { count: 6, averageRating: 3.1, urgent: 2 },
    alertSummary: { open: 4, critical: 1 },
  }));
  const areas = recs.map((row) => row.area);
  assert.ok(areas.includes('data'));
  assert.ok(areas.includes('sales'));
  assert.ok(areas.includes('exceptions'));
  assert.ok(areas.includes('finance'));
  assert.ok(areas.includes('inventory'));
  assert.ok(areas.includes('reviews'));
  assert.ok(areas.includes('alerts'));
  assert.equal(recs[0].priority, 'high');
  const summary = executiveSummary({ range: { from: '2026-08-01', to: '2026-08-31' } }, recs);
  assert.match(summary, /2026-08-01 through 2026-08-31/);
  assert.match(summary, /independent of the daily Morning Brief/);
});

test('CSV includes the period summary and recommendations', () => {
  const recs = generateRecommendations(baseReport({
    performance: {
      dataStatus: 'COMPLETE',
      coverage: 100,
      current: { netMoney: 500000, refundMoney: 0, voidMoney: 0, discountMoney: 0 },
      comparison: { netSalesPct: -9 },
    },
  }));
  const text = csv({
    range: { from: '2026-08-01', to: '2026-08-31' },
    summary: executiveSummary({ range: { from: '2026-08-01', to: '2026-08-31' } }, recs),
    recommendations: recs,
    performance: { current: { netMoney: 500000, refundMoney: 0, voidMoney: 0, discountMoney: 0, orderCount: 1 }, dataStatus: 'COMPLETE' },
    finance: { approvedFoodPurchases: 0, foodCostPercent: null, estimatedProfitAtSelectedMargin: null, selectedMargin: 0.1 },
    invoices: { vendors: [], categorySpend: {} },
    priceChanges: [],
    scorecards: [],
    inventory: [],
    reviews: [],
    alerts: [],
    forecasts: [],
    seoSummary: { ga4: {}, gsc: {}, squareDirect: {} },
  });
  assert.match(text, /Recommendation/);
  assert.match(text, /Executive summary/);
});
