const {
  headerIndex,
  dollarsToCents,
  toNumber,
  truthy,
  toBusinessDate,
  parseToastDateTime,
  businessDateFromLocalParts,
} = require('./csv');
const { mapChannel } = require('./channels');

function cell(row, idx) {
  if (idx < 0 || idx == null) return '';
  return row[idx];
}

function parseCustomOrders(table, mapping = {}, channelMap = {}) {
  const headers = table.headers || [];
  const idx = (logical, ...fallbacks) => {
    const mapped = mapping[logical];
    if (mapped) {
      const i = headerIndex(headers, mapped);
      if (i >= 0) return i;
    }
    return headerIndex(headers, logical, ...fallbacks);
  };
  const cols = {
    id: idx('orderId', 'order id', 'order_id'),
    date: idx('businessDate', 'business date', 'date'),
    net: idx('netSales', 'net sales', 'net'),
    gross: idx('grossSales', 'gross sales', 'gross'),
    discount: idx('discounts', 'discount', 'discount amount'),
    refund: idx('refunds', 'refund', 'refund amount'),
    channel: idx('channel', 'dining option', 'dining options'),
    itemId: idx('itemId', 'item id'),
    itemName: idx('itemName', 'item name', 'menu item'),
    itemCategory: idx('itemCategory', 'item category', 'sales category', 'category'),
    itemQuantity: idx('itemQuantity', 'item quantity', 'qty', 'quantity'),
    itemNet: idx('itemNetSales', 'item net sales', 'net price'),
  };
  if (cols.id < 0 || cols.date < 0 || cols.net < 0) {
    throw new Error('Custom Toast CSV requires orderId, businessDate, and netSales columns');
  }

  const groups = new Map();
  for (const row of table.rows || []) {
    const id = String(cell(row, cols.id) || '').trim();
    const businessDate = toBusinessDate(cell(row, cols.date));
    if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) continue;
    let g = groups.get(id);
    if (!g) {
      const netMoney = dollarsToCents(cell(row, cols.net));
      const discountMoney = cols.discount >= 0 ? dollarsToCents(cell(row, cols.discount)) : 0;
      const grossMoney = cols.gross >= 0 ? dollarsToCents(cell(row, cols.gross)) : netMoney + discountMoney;
      g = {
        providerOrderId: id,
        businessDate,
        orderState: 'COMPLETED',
        sourceKind: 'ticket',
        grossMoney,
        netMoney,
        discountMoney,
        refundMoney: cols.refund >= 0 ? dollarsToCents(cell(row, cols.refund)) : 0,
        voidMoney: 0,
        guestCount: null,
        channel: mapChannel(cols.channel >= 0 ? cell(row, cols.channel) : '', channelMap),
        items: [],
        status: 'COMPLETE',
        sourceTimestamp: new Date(`${businessDate}T12:00:00Z`),
      };
      groups.set(id, g);
    }
    const itemName = cols.itemName >= 0 ? String(cell(row, cols.itemName) || '').trim() : '';
    if (itemName) {
      const itemNet = cols.itemNet >= 0 ? dollarsToCents(cell(row, cols.itemNet)) : 0;
      g.items.push({
        providerItemId: cols.itemId >= 0 ? String(cell(row, cols.itemId) || '') : '',
        name: itemName,
        category: cols.itemCategory >= 0 ? String(cell(row, cols.itemCategory) || '') : '',
        quantity: cols.itemQuantity >= 0 ? toNumber(cell(row, cols.itemQuantity)) : 0,
        grossMoney: itemNet,
        netMoney: itemNet,
      });
    }
  }
  return [...groups.values()];
}

function parseOrderDetails(table, channelMap = {}) {
  const headers = table.headers || [];
  const cols = {
    id: headerIndex(headers, 'Order Id', 'order id', 'Order ID'),
    opened: headerIndex(headers, 'Opened', 'Order Date'),
    paid: headerIndex(headers, 'Paid'),
    closed: headerIndex(headers, 'Closed'),
    guests: headerIndex(headers, '# of Guests', 'Guests', 'Number of Guests'),
    dining: headerIndex(headers, 'Dining Options', 'Dining Option'),
    discount: headerIndex(headers, 'Discount Amount', 'Discount'),
    amount: headerIndex(headers, 'Amount'),
    tax: headerIndex(headers, 'Tax'),
    tip: headerIndex(headers, 'Tip'),
    total: headerIndex(headers, 'Total'),
    voided: headerIndex(headers, 'Voided', 'Void'),
    source: headerIndex(headers, 'Order Source'),
  };
  if (cols.id < 0 || cols.amount < 0) {
    throw new Error('OrderDetails.csv requires Order Id and Amount columns');
  }

  const out = [];
  for (const row of table.rows || []) {
    const id = String(cell(row, cols.id) || '').trim();
    if (!id) continue;
    const stamp = parseToastDateTime(cell(row, cols.closed))
      || parseToastDateTime(cell(row, cols.paid))
      || parseToastDateTime(cell(row, cols.opened));
    const businessDate = stamp
      ? businessDateFromLocalParts(stamp)
      : toBusinessDate(cell(row, cols.opened));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) continue;

    const voided = cols.voided >= 0 && truthy(cell(row, cols.voided));
    const amount = dollarsToCents(cell(row, cols.amount));
    const discountMoney = cols.discount >= 0 ? dollarsToCents(cell(row, cols.discount)) : 0;
    const guestsRaw = cols.guests >= 0 ? cell(row, cols.guests) : null;
    const guestCount = guestsRaw === '' || guestsRaw == null ? null : toNumber(guestsRaw);
    const diningRaw = cols.dining >= 0 ? cell(row, cols.dining) : '';
    const sourceRaw = cols.source >= 0 ? cell(row, cols.source) : '';
    const channel = mapChannel(diningRaw || sourceRaw, channelMap);

    out.push({
      providerOrderId: id,
      businessDate,
      orderState: voided ? 'CANCELED' : 'COMPLETED',
      sourceKind: 'ticket',
      grossMoney: voided ? 0 : amount + discountMoney,
      netMoney: voided ? 0 : amount,
      discountMoney: voided ? 0 : discountMoney,
      refundMoney: 0,
      voidMoney: voided ? amount : 0,
      guestCount: Number.isFinite(guestCount) ? guestCount : null,
      channel,
      items: [],
      status: 'COMPLETE',
      sourceTimestamp: stamp || new Date(`${businessDate}T12:00:00Z`),
      tipMoney: cols.tip >= 0 ? dollarsToCents(cell(row, cols.tip)) : 0,
      taxMoney: cols.tax >= 0 ? dollarsToCents(cell(row, cols.tax)) : 0,
    });
  }
  return out;
}

function parseItemSelection(table) {
  const headers = table.headers || [];
  const cols = {
    orderId: headerIndex(headers, 'Order Id', 'order id', 'Order ID'),
    itemId: headerIndex(headers, 'Item Id', 'Item ID', 'Master Id'),
    name: headerIndex(headers, 'Menu Item', 'Item Name', 'Item'),
    category: headerIndex(headers, 'Sales Category', 'Menu Group', 'Category'),
    qty: headerIndex(headers, 'Qty', 'Quantity'),
    gross: headerIndex(headers, 'Gross Price', 'Gross Amount'),
    net: headerIndex(headers, 'Net Price', 'Net Amount'),
    discount: headerIndex(headers, 'Discnt', 'Discount', 'Discount Amount'),
    voided: headerIndex(headers, 'Void?', 'Voided', 'Void'),
    sent: headerIndex(headers, 'Sent Date', 'Order Date'),
    dining: headerIndex(headers, 'Dining Option', 'Dining Options'),
  };
  if (cols.orderId < 0 || cols.name < 0) {
    throw new Error('ItemSelectionDetails.csv requires Order Id and Menu Item columns');
  }

  const byOrder = new Map();
  for (const row of table.rows || []) {
    const orderId = String(cell(row, cols.orderId) || '').trim();
    const name = String(cell(row, cols.name) || '').trim();
    if (!orderId || !name) continue;
    if (cols.voided >= 0 && truthy(cell(row, cols.voided))) continue;
    const net = cols.net >= 0 ? dollarsToCents(cell(row, cols.net)) : 0;
    const gross = cols.gross >= 0 ? dollarsToCents(cell(row, cols.gross)) : net;
    const item = {
      providerItemId: cols.itemId >= 0 ? String(cell(row, cols.itemId) || '') : '',
      name,
      category: cols.category >= 0 ? String(cell(row, cols.category) || '') : '',
      quantity: cols.qty >= 0 ? toNumber(cell(row, cols.qty)) : 0,
      grossMoney: gross,
      netMoney: net,
    };
    let bucket = byOrder.get(orderId);
    if (!bucket) {
      const stamp = parseToastDateTime(cell(row, cols.sent));
      bucket = {
        providerOrderId: orderId,
        items: [],
        diningOption: cols.dining >= 0 ? String(cell(row, cols.dining) || '') : '',
        sourceTimestamp: stamp,
        businessDate: stamp ? businessDateFromLocalParts(stamp) : '',
      };
      byOrder.set(orderId, bucket);
    }
    bucket.items.push(item);
  }
  return byOrder;
}

function parsePaymentDetails(table) {
  const headers = table.headers || [];
  const cols = {
    orderId: headerIndex(headers, 'Order Id', 'order id', 'Order ID'),
    refundAmount: headerIndex(headers, 'Refund Amount', 'Refund'),
    tipRefund: headerIndex(headers, 'Refund Tip Amount'),
    amount: headerIndex(headers, 'Amount'),
    tip: headerIndex(headers, 'Tip'),
    refunded: headerIndex(headers, 'Refunded'),
  };
  if (cols.orderId < 0) return new Map();
  const byOrder = new Map();
  for (const row of table.rows || []) {
    const orderId = String(cell(row, cols.orderId) || '').trim();
    if (!orderId) continue;
    const current = byOrder.get(orderId) || { refundMoney: 0, tipMoney: 0 };
    current.refundMoney += cols.refundAmount >= 0 ? dollarsToCents(cell(row, cols.refundAmount)) : 0;
    current.tipMoney += cols.tip >= 0 ? dollarsToCents(cell(row, cols.tip)) : 0;
    byOrder.set(orderId, current);
  }
  return byOrder;
}

function parseSalesByDay(table) {
  const headers = table.headers || [];
  const dateIdx = headerIndex(headers, 'yyyyMMdd', 'Date', 'Day', 'Business Date');
  const netIdx = headerIndex(headers, 'Net sales', 'Net Sales', 'Net');
  const orderIdx = headerIndex(headers, 'Total orders', 'Total Orders', 'Orders');
  const guestIdx = headerIndex(headers, 'Total guests', 'Total Guests', 'Guests');
  if (dateIdx < 0 || netIdx < 0) {
    throw new Error('Sales by day requires date and Net sales columns');
  }
  const out = [];
  for (const row of table.rows || []) {
    const businessDate = toBusinessDate(cell(row, dateIdx));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) continue;
    const netMoney = dollarsToCents(cell(row, netIdx));
    const summaryOrderCount = orderIdx >= 0 ? Math.round(toNumber(cell(row, orderIdx))) : 0;
    const guestRaw = guestIdx >= 0 ? cell(row, guestIdx) : null;
    const guestCount = guestRaw === '' || guestRaw == null ? null : Math.round(toNumber(guestRaw));
    out.push({
      providerOrderId: `toast-summary:${businessDate}`,
      businessDate,
      orderState: 'COMPLETED',
      sourceKind: 'day_summary',
      summaryOrderCount,
      grossMoney: netMoney,
      netMoney,
      discountMoney: 0,
      refundMoney: 0,
      voidMoney: 0,
      guestCount: Number.isFinite(guestCount) ? guestCount : null,
      channel: 'unknown',
      items: [],
      status: 'COMPLETE',
      sourceTimestamp: new Date(`${businessDate}T12:00:00Z`),
    });
  }
  return out;
}

function parseNamedAmountTable(table, nameColCandidates, amountColCandidates = ['Net sales', 'Amount']) {
  const headers = table.headers || [];
  const nameIdx = headerIndex(headers, ...nameColCandidates);
  const amountIdx = headerIndex(headers, ...amountColCandidates);
  const ordersIdx = headerIndex(headers, 'Orders', 'Total orders', 'Count');
  if (nameIdx < 0 || amountIdx < 0) return [];
  const out = [];
  for (const row of table.rows || []) {
    const name = String(cell(row, nameIdx) || '').trim();
    if (!name || /^total$/i.test(name)) continue;
    out.push({
      name,
      netMoney: dollarsToCents(cell(row, amountIdx)),
      orders: ordersIdx >= 0 ? Math.round(toNumber(cell(row, ordersIdx))) : null,
    });
  }
  return out;
}

module.exports = {
  parseCustomOrders,
  parseOrderDetails,
  parseItemSelection,
  parsePaymentDetails,
  parseSalesByDay,
  parseNamedAmountTable,
};
