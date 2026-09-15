const { mapChannel } = require('./channels');
const {
  parseCustomOrders,
  parseOrderDetails,
  parseItemSelection,
  parsePaymentDetails,
  parseSalesByDay,
  parseNamedAmountTable,
} = require('./parsers');

function mergeItemMaps(maps) {
  const out = new Map();
  for (const map of maps) {
    for (const [orderId, bucket] of map.entries()) {
      const existing = out.get(orderId);
      if (!existing) {
        out.set(orderId, {
          providerOrderId: orderId,
          items: [...bucket.items],
          diningOption: bucket.diningOption || '',
          sourceTimestamp: bucket.sourceTimestamp || null,
          businessDate: bucket.businessDate || '',
        });
      } else {
        existing.items.push(...bucket.items);
        if (!existing.diningOption && bucket.diningOption) existing.diningOption = bucket.diningOption;
        if (!existing.sourceTimestamp && bucket.sourceTimestamp) existing.sourceTimestamp = bucket.sourceTimestamp;
        if (!existing.businessDate && bucket.businessDate) existing.businessDate = bucket.businessDate;
      }
    }
  }
  return out;
}

function applyAliases(order, itemAliases = {}) {
  if (!order.items?.length) return order;
  order.items = order.items.map((item) => {
    const alias = itemAliases[item.providerItemId] || itemAliases[item.name];
    if (!alias) return item;
    return {
      ...item,
      name: typeof alias === 'string' ? alias : (alias.name || item.name),
      category: (typeof alias === 'object' && alias.category) || item.category || '',
    };
  });
  return order;
}

function buildOrdersFromTables(tables, { mapping = {}, channelMap = {}, itemAliases = {} } = {}) {
  const warnings = [];
  const formats = [];
  const rollups = {
    diningOptions: [],
    salesCategories: [],
  };

  let ticketOrders = [];

  for (const table of tables.custom_orders || []) {
    formats.push({ fileName: table.fileName, kind: 'custom_orders', rows: table.rows?.length || 0 });
    ticketOrders.push(...parseCustomOrders(table, mapping, channelMap));
  }

  for (const table of tables.order_details || []) {
    formats.push({ fileName: table.fileName, kind: 'order_details', rows: table.rows?.length || 0 });
    ticketOrders.push(...parseOrderDetails(table, channelMap));
  }

  const itemMaps = (tables.item_selection || []).map((table) => {
    formats.push({ fileName: table.fileName, kind: 'item_selection', rows: table.rows?.length || 0 });
    return parseItemSelection(table);
  });
  const itemsByOrder = mergeItemMaps(itemMaps);

  const paymentMaps = (tables.payment_details || []).map((table) => {
    formats.push({ fileName: table.fileName, kind: 'payment_details', rows: table.rows?.length || 0 });
    return parsePaymentDetails(table);
  });
  const paymentsByOrder = new Map();
  for (const map of paymentMaps) {
    for (const [orderId, pay] of map.entries()) {
      const cur = paymentsByOrder.get(orderId) || { refundMoney: 0, tipMoney: 0 };
      cur.refundMoney += pay.refundMoney || 0;
      cur.tipMoney += pay.tipMoney || 0;
      paymentsByOrder.set(orderId, cur);
    }
  }

  // Deduplicate ticket orders by providerOrderId (last write wins, prefer richer order_details).
  const ticketById = new Map();
  for (const order of ticketOrders) {
    const prior = ticketById.get(order.providerOrderId);
    if (!prior) {
      ticketById.set(order.providerOrderId, order);
      continue;
    }
    // Prefer non-custom richer headers: keep higher net/gross and non-unknown channel.
    const next = { ...prior, ...order };
    if ((prior.items?.length || 0) && !(order.items?.length)) next.items = prior.items;
    if (prior.channel !== 'unknown' && order.channel === 'unknown') next.channel = prior.channel;
    ticketById.set(order.providerOrderId, next);
  }

  // Attach item selections; synthesize ticket orders when only item rows exist.
  for (const [orderId, bucket] of itemsByOrder.entries()) {
    const existing = ticketById.get(orderId);
    if (existing) {
      existing.items = bucket.items;
      if (existing.channel === 'unknown' && bucket.diningOption) {
        existing.channel = mapChannel(bucket.diningOption, channelMap);
      }
      if (!existing.sourceTimestamp && bucket.sourceTimestamp) existing.sourceTimestamp = bucket.sourceTimestamp;
    } else {
      const netMoney = bucket.items.reduce((s, i) => s + (i.netMoney || 0), 0);
      const grossMoney = bucket.items.reduce((s, i) => s + (i.grossMoney || 0), 0);
      const businessDate = bucket.businessDate;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
        warnings.push(`Skipped ItemSelection order ${orderId}: missing business date`);
        continue;
      }
      ticketById.set(orderId, {
        providerOrderId: orderId,
        businessDate,
        orderState: 'COMPLETED',
        sourceKind: 'ticket',
        grossMoney,
        netMoney,
        discountMoney: Math.max(0, grossMoney - netMoney),
        refundMoney: 0,
        voidMoney: 0,
        guestCount: null,
        channel: mapChannel(bucket.diningOption, channelMap),
        items: bucket.items,
        status: 'PARTIAL',
        sourceTimestamp: bucket.sourceTimestamp || new Date(`${businessDate}T12:00:00Z`),
      });
    }
  }

  for (const [orderId, pay] of paymentsByOrder.entries()) {
    const order = ticketById.get(orderId);
    if (!order) continue;
    order.refundMoney = (order.refundMoney || 0) + (pay.refundMoney || 0);
    if (order.orderState === 'COMPLETED' && order.refundMoney > 0) {
      order.netMoney = Math.max(0, (order.netMoney || 0) - (pay.refundMoney || 0));
    }
  }

  let tickets = [...ticketById.values()].map((o) => applyAliases(o, itemAliases));
  const ticketDates = new Set(tickets.map((o) => o.businessDate));

  // Sales-by-day fills dates that have no ticket-level data (avoids double counting).
  const summaryOrders = [];
  for (const table of tables.sales_by_day || []) {
    formats.push({ fileName: table.fileName, kind: 'sales_by_day', rows: table.rows?.length || 0 });
    for (const day of parseSalesByDay(table)) {
      if (ticketDates.has(day.businessDate)) {
        warnings.push(`Skipped Sales by day ${day.businessDate}: ticket-level Toast orders present`);
        continue;
      }
      summaryOrders.push(day);
    }
  }

  for (const table of tables.dining_options_summary || []) {
    formats.push({ fileName: table.fileName, kind: 'dining_options_summary', rows: table.rows?.length || 0 });
    rollups.diningOptions.push(...parseNamedAmountTable(table, ['Dining option', 'Dining Option'], ['Net sales', 'Net Sales']));
  }
  for (const table of tables.sales_category_summary || []) {
    formats.push({ fileName: table.fileName, kind: 'sales_category_summary', rows: table.rows?.length || 0 });
    rollups.salesCategories.push(...parseNamedAmountTable(table, ['Sales category', 'Sales Category'], ['Net sales', 'Net Sales']));
  }

  // When only day summaries exist, attach year rollup category names onto each summary day as unavailable item detail —
  // categories stay empty on day_summary; rollups are retained in import metadata for audit.
  if (!tickets.length && summaryOrders.length && rollups.diningOptions.length) {
    // Distribute is not done; channel stays unknown at day grain for Sales Summary.
    warnings.push('Dining options summary is period-level only; daily channel split is unavailable without OrderDetails');
  }

  const orders = [...tickets, ...summaryOrders];
  if (!orders.length) {
    throw new Error('No importable Toast rows found. Upload OrderDetails/ItemSelectionDetails, Sales Summary (Sales by day), or the app sample CSV.');
  }

  return {
    orders,
    formats,
    warnings,
    rollups,
    stats: {
      ticketOrders: tickets.length,
      summaryDays: summaryOrders.length,
      itemRows: [...itemsByOrder.values()].reduce((s, b) => s + b.items.length, 0),
      dates: [...new Set(orders.map((o) => o.businessDate))].sort(),
    },
  };
}

module.exports = { buildOrdersFromTables };
