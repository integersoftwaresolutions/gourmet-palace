const { expandUpload, collectTables } = require('./expand');
const { buildOrdersFromTables } = require('./buildOrders');

async function prepareToastImport({ files, mapping = {}, channelMap = {}, itemAliases = {} }) {
  const expanded = [];
  for (const file of files) {
    const buffer = Buffer.isBuffer(file.buffer)
      ? file.buffer
      : Buffer.from(String(file.base64 || '').replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (!buffer.length) continue;
    expanded.push(...await expandUpload({ fileName: file.fileName || file.name || 'toast-export', buffer }));
  }
  if (!expanded.length) throw new Error('Toast export is empty');

  const tables = collectTables(expanded);
  const built = buildOrdersFromTables(tables, { mapping, channelMap, itemAliases });
  return {
    ...built,
    expandedKinds: expanded.map((f) => ({ fileName: f.fileName, kind: f.kind })),
  };
}

module.exports = {
  prepareToastImport,
  expandUpload,
  collectTables,
  buildOrdersFromTables,
};
