const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const env = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const { signedFetch } = require('../../services/awsSigV4');

const base = path.resolve(process.cwd(), env.localStorageDir || 'storage/private');

function encodePath(key) {
  return String(key).split('/').map(encodeURIComponent).join('/');
}

function s3Config() {
  return env.storage || {};
}

function s3Url(key) {
  const cfg = s3Config();
  if (!cfg.bucket) throw new ApiError(503, 'S3_BUCKET is not configured');
  const endpoint = (cfg.endpoint || `https://s3.${cfg.region || env.aws.region}.amazonaws.com`).replace(/\/+$/, '');
  const url = new URL(endpoint);
  const encoded = encodePath(key);
  if (cfg.forcePathStyle || cfg.endpoint) {
    url.pathname = `/${encodeURIComponent(cfg.bucket)}/${encoded}`;
  } else {
    url.hostname = `${cfg.bucket}.${url.hostname}`;
    url.pathname = `/${encoded}`;
  }
  return url;
}

function explicitS3Credentials() {
  const cfg = s3Config();
  if (!cfg.accessKeyId || !cfg.secretAccessKey) return undefined;
  return {
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    sessionToken: cfg.sessionToken || '',
  };
}

async function s3Request(method, key, buffer = Buffer.alloc(0)) {
  const cfg = s3Config();
  const response = await signedFetch({
    service: 's3',
    region: cfg.region || env.aws.region || 'us-west-2',
    url: s3Url(key),
    method,
    body: buffer,
    headers: method === 'PUT' ? { 'content-type': 'application/octet-stream' } : {},
    credentials: explicitS3Credentials(),
  });
  return response;
}

async function s3Put(key, buffer) {
  const response = await s3Request('PUT', key, buffer);
  if (!response.ok) throw new ApiError(502, `Private object upload failed (${response.status})`);
  return `s3:${key}`;
}

async function s3Get(key) {
  const response = await s3Request('GET', key);
  if (response.status === 404) throw new ApiError(404, 'Stored file not found');
  if (!response.ok) throw new ApiError(502, `Private object read failed (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

function safeRelativeKey(organizationId, key) {
  const org = String(organizationId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleaned = String(key || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, '_'))
    .join('/');
  if (!org || !cleaned) throw new ApiError(400, 'Invalid private object key');
  return `${org}/${cleaned}`;
}

async function put({ organizationId, key, buffer }) {
  if (!Buffer.isBuffer(buffer)) throw new ApiError(400, 'Private object content must be a Buffer');
  const relative = safeRelativeKey(organizationId, key);
  if (s3Config().provider === 's3') return s3Put(relative, buffer);
  const absolute = path.join(base, relative);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, buffer, { mode: 0o600 });
  return `local:${relative}`;
}

async function get(ref) {
  const raw = String(ref || '');
  if (raw.startsWith('s3:')) return s3Get(raw.slice(3));
  const relative = raw.startsWith('local:') ? raw.slice(6) : raw;
  const normalized = path.normalize(relative).replace(/^([/\\])+/, '');
  const absolute = path.resolve(base, normalized);
  if (absolute !== base && !absolute.startsWith(`${base}${path.sep}`)) throw new ApiError(403, 'Invalid private object reference');
  try {
    return await fs.readFile(absolute);
  } catch {
    throw new ApiError(404, 'Stored file not found');
  }
}

function sign(ref, expiresSeconds = 300) {
  const exp = Math.floor(Date.now() / 1000) + Math.min(Math.max(Number(expiresSeconds) || 300, 30), 900);
  const body = `${ref}.${exp}`;
  const sig = crypto.createHmac('sha256', env.fileSigningSecret || env.sessionSecret).update(body).digest('base64url');
  return { token: Buffer.from(ref).toString('base64url'), exp, sig };
}

function verify(token, exp, sig) {
  if (Number(exp) < Math.floor(Date.now() / 1000)) throw new ApiError(410, 'File link expired');
  let ref;
  try {
    ref = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    throw new ApiError(403, 'Invalid file token');
  }
  const expected = crypto.createHmac('sha256', env.fileSigningSecret || env.sessionSecret).update(`${ref}.${exp}`).digest();
  let got;
  try {
    got = Buffer.from(String(sig || ''), 'base64url');
  } catch {
    throw new ApiError(403, 'Invalid file signature');
  }
  if (got.length !== expected.length || !crypto.timingSafeEqual(expected, got)) throw new ApiError(403, 'Invalid file signature');
  return ref;
}

module.exports = { put, get, sign, verify };
