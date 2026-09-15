const { parseCsv, headerIndex } = require('./csv');

function normalizeHeaders(row) {
  return (row || []).map((h) => String(h || '').trim());
}

function detectCsvKind(headers, fileName = '') {
  const h = headers.map((x) => x.toLowerCase());
  const name = String(fileName || '').toLowerCase();
  const has = (...parts) => parts.every((p) => h.some((x) => x.includes(p)));
  const hasExact = (p) => h.includes(p.toLowerCase());

  if (hasExact('orderid') && (hasExact('businessdate') || has('business date')) && (hasExact('netsales') || has('net sales'))) {
    return 'custom_orders';
  }
  if (
    (has('order id') || hasExact('order id'))
    && (has('menu item') || hasExact('menu item') || has('item id'))
    && (has('net price') || has('gross price') || hasExact('qty'))
  ) {
    return 'item_selection';
  }
  if (
    (has('order id') || hasExact('order id'))
    && (hasExact('opened') || hasExact('closed') || hasExact('paid') || hasExact('amount'))
    && !has('menu item')
  ) {
    return 'order_details';
  }
  if (
    (has('payment id') || hasExact('payment id'))
    && (has('order id') || hasExact('order id'))
    && (hasExact('amount') || hasExact('total') || has('refund'))
  ) {
    return 'payment_details';
  }
  if (
    (hasExact('yyyymmdd') || (hasExact('date') && has('net')))
    && (has('net sales') || hasExact('net sales'))
    && (has('total orders') || hasExact('orders') || has('total guests'))
  ) {
    return 'sales_by_day';
  }
  if (has('dining option') && has('net sales') && (hasExact('orders') || has('gross sales'))) {
    return 'dining_options_summary';
  }
  if (has('sales category') && has('net sales') && has('items')) {
    return 'sales_category_summary';
  }
  if (name.includes('orderdetails') || name.includes('order_details')) return 'order_details';
  if (name.includes('itemselection') || name.includes('item_selection')) return 'item_selection';
  if (name.includes('paymentdetails') || name.includes('payment_details')) return 'payment_details';
  if (name.includes('sales by day') || name.includes('sales_by_day')) return 'sales_by_day';
  return 'unknown';
}

function detectWorkbookKind(sheetNames = [], fileName = '') {
  const names = sheetNames.map((s) => String(s || '').trim().toLowerCase());
  const file = String(fileName || '').toLowerCase();
  if (names.some((n) => n === 'sales by day') || file.includes('salessummary') || file.includes('sales_summary')) {
    return 'sales_summary_workbook';
  }
  return 'unknown_workbook';
}

function rowsFromCsvBuffer(buffer) {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const rows = parseCsv(text);
  if (!rows.length) return { headers: [], rows: [], kind: 'empty' };
  const headers = normalizeHeaders(rows[0]);
  return { headers, rows: rows.slice(1), kind: detectCsvKind(headers) };
}

module.exports = {
  normalizeHeaders,
  detectCsvKind,
  detectWorkbookKind,
  rowsFromCsvBuffer,
  headerIndex,
};
