const test = require('node:test');
const assert = require('node:assert/strict');
const { moneyControl, squareReconciliation, reconciliationPass } = require('../src/utils/reconciliation');

test('net-sales tolerance uses the greater of 0.5% or $5', () => {
  assert.equal(moneyControl(100500, 100000, 0.005, 500).pass, true);
  assert.equal(moneyControl(100501, 100000, 0.005, 500).pass, false);
  assert.equal(moneyControl(1000, 500, 0.005, 500).pass, true);
  assert.equal(moneyControl(1001, 500, 0.005, 500).pass, false);
});

test('Square reconciliation requires exact order count and channel integrity', () => {
  const pass = squareReconciliation({
    canonical: { orderCount: 10, netMoney: 10000, refundMoney: 100, voidMoney: 0, discountMoney: 50, channels: { dine_in: 8000, unknown: 2000 } },
    provider: { orderCount: 10, netMoney: 10000, refundMoney: 100, voidMoney: 0, discountMoney: 50 },
    channelsApproved: true,
  });
  assert.equal(reconciliationPass(pass), true);
  const fail = squareReconciliation({
    canonical: { orderCount: 9, netMoney: 10000, refundMoney: 100, voidMoney: 0, discountMoney: 50, channels: { dine_in: 8000, unknown: 2000 } },
    provider: { orderCount: 10, netMoney: 10000, refundMoney: 100, voidMoney: 0, discountMoney: 50 },
  });
  assert.equal(fail.orderCount.pass, false);
  assert.equal(reconciliationPass(fail), false);
});
