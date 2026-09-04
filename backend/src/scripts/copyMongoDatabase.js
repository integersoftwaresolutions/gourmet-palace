require('dotenv').config();
const { MongoClient } = require('mongodb');

const sourceUri = process.env.SOURCE_MONGODB_URI || 'mongodb://127.0.0.1:27017/gourmet-palace';
const destUri = process.env.DEST_MONGODB_URI || process.env.MONGODB_URI;
if (!destUri) throw new Error('Set DEST_MONGODB_URI (or MONGODB_URI) to the target database');
if (sourceUri === destUri) throw new Error('Source and destination MongoDB URIs must be different');

function dbNameFromUri(uri) {
  const withoutQuery = String(uri).split('?')[0];
  const name = withoutQuery.split('/').filter(Boolean).pop();
  return name && !name.includes(':') ? name : 'gourmet-palace';
}

async function copyCollection(sourceDb, destDb, name) {
  const source = sourceDb.collection(name);
  const dest = destDb.collection(name);
  await dest.deleteMany({});
  const indexes = await source.indexes();
  for (const index of indexes) {
    if (index.name === '_id_') continue;
    const options = { name: index.name };
    if (index.unique) options.unique = true;
    if (index.expireAfterSeconds != null) options.expireAfterSeconds = index.expireAfterSeconds;
    if (index.partialFilterExpression) options.partialFilterExpression = index.partialFilterExpression;
    try { await dest.createIndex(index.key, options); } catch (err) {
      if (!String(err.message || err).includes('already exists')) throw err;
    }
  }
  const cursor = source.find({});
  let batch = [];
  let copied = 0;
  async function flush() {
    if (!batch.length) return;
    await dest.insertMany(batch, { ordered: false });
    copied += batch.length;
    batch = [];
  }
  for await (const doc of cursor) {
    batch.push(doc);
    if (batch.length >= 500) await flush();
  }
  await flush();
  return copied;
}

async function main() {
  const sourceName = dbNameFromUri(sourceUri);
  const destName = dbNameFromUri(destUri);
  const sourceClient = new MongoClient(sourceUri);
  const destClient = new MongoClient(destUri);
  await sourceClient.connect();
  await destClient.connect();
  const sourceDb = sourceClient.db(sourceName);
  const destDb = destClient.db(destName);
  const collections = (await sourceDb.listCollections().toArray()).map((row) => row.name).filter((name) => !name.startsWith('system.'));
  const summary = {};
  for (const name of collections) {
    summary[name] = await copyCollection(sourceDb, destDb, name);
    console.log(`${name}: ${summary[name]} documents`);
  }
  await sourceClient.close();
  await destClient.close();
  console.log(JSON.stringify({ source: sourceName, dest: destName, collections: Object.keys(summary).length, summary }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
