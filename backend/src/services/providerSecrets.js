const fs = require('fs/promises');
const path = require('path');
const env = require('../config/env');
const vault = require('./secretVault');
const { signedFetch } = require('./awsSigV4');
const ApiError = require('../utils/ApiError');
const Connection = require('../models/Connection');

const localBase = path.resolve(process.cwd(), env.localSecretsDir || 'storage/secrets');
const safe = (s) => String(s).replace(/[^a-zA-Z0-9_.-]/g, '_');

function secretName(organizationId, provider) {
  return `${env.secretStorePrefix || 'gourmet-palace'}/${env.nodeEnv}/${safe(organizationId)}/${safe(provider)}`;
}

function mongoRef(organizationId, provider) {
  return `mongo-secret:${String(organizationId)}:${safe(provider)}`;
}

function parseMongoRef(ref) {
  const match = /^mongo-secret:([^:]+):([^:]+)$/.exec(String(ref || ''));
  if (!match) return null;
  return { organizationId: match[1], provider: match[2] };
}

async function awsCall(target, payload) {
  const region = env.aws.region;
  const body = JSON.stringify(payload);
  const res = await signedFetch({
    service: 'secretsmanager', region,
    url: `https://secretsmanager.${region}.amazonaws.com/`,
    method: 'POST', body,
    headers: { 'content-type': 'application/x-amz-json-1.1', 'x-amz-target': `secretsmanager.${target}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = String(data.__type || data.code || '').split('#').pop();
    const e = new ApiError(res.status === 404 ? 404 : 502, `AWS Secrets Manager ${target} failed: ${data.message || err || res.status}`);
    e.awsType = err;
    throw e;
  }
  return data;
}

async function mongoPut(organizationId, provider, value) {
  const encrypted = vault.encrypt(JSON.stringify(value));
  await Connection.findOneAndUpdate(
    { organizationId, provider },
    { $set: { secretPayloadEnc: encrypted } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return mongoRef(organizationId, provider);
}

async function mongoGet(ref) {
  const parsed = parseMongoRef(ref);
  if (!parsed) throw new ApiError(409, 'Invalid Mongo provider secret reference');
  const connection = await Connection.findOne({ organizationId: parsed.organizationId, provider: parsed.provider }).select('+secretPayloadEnc');
  if (!connection?.secretPayloadEnc) throw new ApiError(409, 'Provider credentials are unavailable; reconnect the integration.');
  try {
    return JSON.parse(vault.decrypt(connection.secretPayloadEnc));
  } catch {
    throw new ApiError(409, 'Provider credentials could not be decrypted. Verify SECRET_ENCRYPTION_KEY and reconnect if it changed.');
  }
}

async function put(organizationId, provider, value) {
  if (env.secretStoreProvider === 'mongo') return mongoPut(organizationId, provider, value);

  if (env.secretStoreProvider === 'aws') {
    const Name = secretName(organizationId, provider);
    const SecretString = JSON.stringify(value);
    try {
      await awsCall('PutSecretValue', { SecretId: Name, SecretString });
    } catch (e) {
      if (e.statusCode === 404 || e.awsType === 'ResourceNotFoundException') {
        await awsCall('CreateSecret', { Name, SecretString, Description: `Gourmet Palace ${provider} OAuth credentials` });
      } else throw e;
    }
    return `aws:${Name}`;
  }

  const rel = `${safe(organizationId)}/${safe(provider)}.secret`;
  const abs = path.join(localBase, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, vault.encrypt(JSON.stringify(value)), { mode: 0o600 });
  return `local-secret:${rel}`;
}

async function get(ref) {
  if (!ref) throw new ApiError(409, 'Provider secret reference is missing');
  if (String(ref).startsWith('mongo-secret:')) return mongoGet(ref);
  if (String(ref).startsWith('aws:')) {
    const d = await awsCall('GetSecretValue', { SecretId: String(ref).slice(4) });
    if (!d.SecretString) throw new ApiError(502, 'Provider secret has no SecretString');
    return JSON.parse(d.SecretString);
  }
  if (String(ref).startsWith('local-secret:')) {
    try {
      return JSON.parse(vault.decrypt(await fs.readFile(path.join(localBase, String(ref).slice(13)), 'utf8')));
    } catch (e) {
      if (e instanceof SyntaxError) throw e;
      throw new ApiError(409, 'Legacy local provider credentials are unavailable on this deployment. Reconnect the integration once to migrate it to MongoDB.');
    }
  }
  throw new ApiError(409, 'Unsupported provider secret reference');
}

async function update(ref, value) {
  const parsed = parseMongoRef(ref);
  if (parsed) return mongoPut(parsed.organizationId, parsed.provider, value);
  if (String(ref || '').startsWith('aws:')) {
    await awsCall('PutSecretValue', { SecretId: String(ref).slice(4), SecretString: JSON.stringify(value) });
    return ref;
  }
  if (String(ref || '').startsWith('local-secret:')) {
    const abs = path.join(localBase, String(ref).slice(13));
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, vault.encrypt(JSON.stringify(value)), { mode: 0o600 });
    return ref;
  }
  throw new ApiError(409, 'Provider secret reference is missing');
}

module.exports = { put, get, update, secretName, mongoRef };
