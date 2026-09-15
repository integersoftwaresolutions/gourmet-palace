const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { prepareToastImport } = require('../src/modules/integrations/toastImport');
const { mapChannel } = require('../src/modules/integrations/toastImport/channels');
const { parseOrderDetails, parseSalesByDay, parseCustomOrders } = require('../src/modules/integrations/toastImport/parsers');

describe('toast channel mapping', () => {
  it('maps marketplace and dining options', () => {
    assert.equal(mapChannel('DoorDash - Delivery'), 'third_party');
    assert.equal(mapChannel('Uber Eats - Takeout'), 'third_party');
    assert.equal(mapChannel('Online Ordering - Takeout'), 'direct_online');
    assert.equal(mapChannel('Toast Delivery Services'), 'delivery');
    assert.equal(mapChannel('Pick Up'), 'takeout');
    assert.equal(mapChannel('Dine In'), 'dine_in');
  });
});

describe('toast parsers', () => {
  it('parses custom sample CSV shape', () => {
    const orders = parseCustomOrders({
      headers: ['orderId', 'businessDate', 'netSales', 'grossSales', 'discounts', 'refunds', 'channel', 'itemId', 'itemName', 'itemCategory', 'itemQuantity', 'itemNetSales'],
      rows: [
        ['T-1', '2025-06-01', '40.00', '45.00', '5.00', '0', 'Dine In', '1', 'Kabob', 'Entree', '1', '28.00'],
        ['T-1', '2025-06-01', '40.00', '45.00', '5.00', '0', 'Dine In', '2', 'Naan', 'Sides', '2', '12.00'],
      ],
    });
    assert.equal(orders.length, 1);
    assert.equal(orders[0].netMoney, 4000);
    assert.equal(orders[0].channel, 'dine_in');
    assert.equal(orders[0].items.length, 2);
  });

  it('parses OrderDetails and voids', () => {
    const orders = parseOrderDetails({
      headers: ['Order Id', 'Opened', 'Dining Options', 'Discount Amount', 'Amount', 'Voided', '# of Guests'],
      rows: [
        ['100', '01/02/2025 05:15:00', 'DoorDash - Delivery', '0', '25.50', 'false', '2'],
        ['101', '01/02/2025 06:00:00', 'Dine In', '0', '12.00', 'true', '1'],
      ],
    });
    assert.equal(orders.length, 2);
    assert.equal(orders[0].businessDate, '2025-01-02');
    assert.equal(orders[0].channel, 'third_party');
    assert.equal(orders[0].netMoney, 2550);
    assert.equal(orders[1].orderState, 'CANCELED');
    assert.equal(orders[1].voidMoney, 1200);
    assert.equal(orders[1].netMoney, 0);
  });

  it('parses Sales by day', () => {
    const days = parseSalesByDay({
      headers: ['yyyyMMdd', 'Net sales', 'Total orders', 'Total guests'],
      rows: [
        ['20250101', '100.25', '4', '6'],
        [20250102.0, 50, 2, 3],
      ],
    });
    assert.equal(days.length, 2);
    assert.equal(days[0].sourceKind, 'day_summary');
    assert.equal(days[0].summaryOrderCount, 4);
    assert.equal(days[0].netMoney, 10025);
    assert.equal(days[0].providerOrderId, 'toast-summary:2025-01-01');
  });
});

describe('toast prepare against local Sales Summary exports', async () => {
  const root = path.resolve(__dirname, '../../Toast');
  const wh = path.join(root, 'woodland hills_SalesSummary_2025-01-01_2025-12-31', 'Sales by day.csv');
  const sherman = path.join(root, 'sherman oaks_SalesSummary_2025-01-01_2025-12-31.xlsx');

  it('imports Woodland Hills Sales by day CSV', async () => {
    if (!fs.existsSync(wh)) return;
    const prepared = await prepareToastImport({
      files: [{ fileName: 'Sales by day.csv', buffer: fs.readFileSync(wh) }],
    });
    assert.ok(prepared.stats.summaryDays >= 360);
    assert.equal(prepared.stats.ticketOrders, 0);
    const totalNet = prepared.orders.reduce((s, o) => s + o.netMoney, 0);
    assert.equal(totalNet, 71798172);
  });

  it('imports Sherman Oaks Sales Summary workbook', async () => {
    if (!fs.existsSync(sherman)) return;
    const prepared = await prepareToastImport({
      files: [{ fileName: 'sherman.xlsx', buffer: fs.readFileSync(sherman) }],
    });
    assert.ok(prepared.stats.summaryDays >= 350);
    const totalNet = prepared.orders.reduce((s, o) => s + o.netMoney, 0);
    assert.equal(totalNet, 128971233);
    assert.ok((prepared.rollups.diningOptions || []).length > 0);
  });

  it('prefers tickets over overlapping sales-by-day', async () => {
    const prepared = await prepareToastImport({
      files: [
        {
          fileName: 'OrderDetails.csv',
          buffer: Buffer.from('Order Id,Opened,Dining Options,Discount Amount,Amount,Voided,# of Guests\n9,01/01/2025 12:00:00,Dine In,0,10.00,false,1\n'),
        },
        {
          fileName: 'Sales by day.csv',
          buffer: Buffer.from('yyyyMMdd,Net sales,Total orders,Total guests\n20250101,999.00,50,60\n20250102,20.00,1,1\n'),
        },
      ],
    });
    assert.equal(prepared.stats.ticketOrders, 1);
    assert.equal(prepared.stats.summaryDays, 1);
    assert.equal(prepared.orders.find((o) => o.businessDate === '2025-01-01').sourceKind, 'ticket');
    assert.equal(prepared.orders.find((o) => o.businessDate === '2025-01-02').sourceKind, 'day_summary');
  });
});
