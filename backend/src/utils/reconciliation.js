function moneyControl(canonical, provider, tolerancePercent, toleranceMinor) {
  const c = Number(canonical || 0);
  const p = Number(provider || 0);
  const variance = c - p;
  const tolerance = Math.max(Number(toleranceMinor || 0), Math.abs(p) * Number(tolerancePercent || 0));
  return { canonical: c, provider: p, variance, tolerance, pass: Math.abs(variance) <= tolerance };
}

function orderCountControl(canonical, provider) {
  const c = Number(canonical || 0);
  const p = Number(provider || 0);
  return { canonical: c, provider: p, variance: c - p, pass: c === p };
}

function channelControl(channels, total, approved = false) {
  const values = Object.values(channels || {}).map((value) => Number(value || 0));
  const knownPlusUnknown = values.reduce((sum, value) => sum + value, 0);
  const t = Number(total || 0);
  return {
    knownPlusUnknown,
    total: t,
    unknown: Number((channels || {}).unknown || 0),
    variance: knownPlusUnknown - t,
    pass: Math.abs(knownPlusUnknown - t) <= 1,
    approved: Boolean(approved),
  };
}

function squareReconciliation({ canonical, provider, channelsApproved = false }) {
  return {
    orderCount: orderCountControl(canonical.orderCount, provider.orderCount),
    netSales: moneyControl(canonical.netMoney, provider.netMoney, 0.005, 500),
    refunds: moneyControl(canonical.refundMoney, provider.refundMoney, 0.01, 300),
    voids: moneyControl(canonical.voidMoney, provider.voidMoney, 0.01, 300),
    discounts: moneyControl(canonical.discountMoney, provider.discountMoney, 0.01, 300),
    channels: channelControl(canonical.channels, canonical.netMoney, channelsApproved),
  };
}

function reconciliationPass(reconciliation) {
  return Object.values(reconciliation || {}).every((control) => control?.pass !== false);
}

module.exports = { moneyControl, orderCountControl, channelControl, squareReconciliation, reconciliationPass };
