require('dotenv').config();

function stripTrailingSlash(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

function withHttps(hostOrUrl) {
  const value = stripTrailingSlash(hostOrUrl);
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function mergeOrigins(...parts) {
  return [...new Set(
    parts
      .filter(Boolean)
      .flatMap((value) => String(value).split(','))
      .map((value) => stripTrailingSlash(value))
      .filter(Boolean),
  )].join(',');
}

const vercelOrigins = [
  process.env.VERCEL_URL && withHttps(process.env.VERCEL_URL),
  process.env.VERCEL_BRANCH_URL && withHttps(process.env.VERCEL_BRANCH_URL),
  process.env.VERCEL_PROJECT_PRODUCTION_URL && withHttps(process.env.VERCEL_PROJECT_PRODUCTION_URL),
].filter(Boolean);

const defaultAppUrl = stripTrailingSlash(
  process.env.APP_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL && withHttps(process.env.VERCEL_PROJECT_PRODUCTION_URL))
  || (process.env.VERCEL_URL && withHttps(process.env.VERCEL_URL))
  || 'http://localhost:5173',
);

/** Public origin that serves /api/v1 (same host on Vercel; localhost:4000 in local API). */
const apiPublicOrigin = stripTrailingSlash(
  process.env.API_PUBLIC_URL
  || (process.env.VERCEL_URL && withHttps(process.env.VERCEL_URL))
  || `http://localhost:${Number(process.env.PORT) || 4000}`,
);

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  providerHttpTimeoutMs: Number(process.env.PROVIDER_HTTP_TIMEOUT_MS) || 12000,
  cronSecret: process.env.CRON_SECRET || '',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gourmet-palace',
  corsOrigin: mergeOrigins(process.env.CORS_ORIGIN || 'http://localhost:5173', ...vercelOrigins, defaultAppUrl),
  appUrl: defaultAppUrl,
  apiPublicOrigin,

  sessionSecret: process.env.SESSION_SECRET || 'dev-session-secret-change-me',
  sessionName: process.env.SESSION_NAME || 'gp.sid',
  sessionMaxAgeMs: Number(process.env.SESSION_MAX_AGE_MS) || 7 * 24 * 60 * 60 * 1000,
  sessionSecure: process.env.SESSION_SECURE === 'true',

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'Gourmet Palace <noreply@gourmetpalace.com>',
  },

  passwordResetTtlMs: Number(process.env.PASSWORD_RESET_TTL_MS) || 60 * 60 * 1000,
  emailVerificationTtlMs: Number(process.env.EMAIL_VERIFICATION_TTL_MS) || 24 * 60 * 60 * 1000,
  verificationResendCooldownMs: Number(process.env.VERIFICATION_RESEND_COOLDOWN_MS) || 60 * 1000,
  googleManualSyncCooldownMinutes: Number(process.env.GOOGLE_MANUAL_SYNC_COOLDOWN_MINUTES) || 15,
  squareManualSyncCooldownMinutes: Number(process.env.SQUARE_MANUAL_SYNC_COOLDOWN_MINUTES) || 5,
  secretEncryptionKey: process.env.SECRET_ENCRYPTION_KEY || '',
  secretStoreProvider: process.env.SECRET_STORE_PROVIDER || (process.env.VERCEL ? 'mongo' : (process.env.NODE_ENV === 'production' ? 'aws' : 'local')),
  secretStorePrefix: process.env.SECRET_STORE_PREFIX || 'gourmet-palace',
  localSecretsDir: process.env.LOCAL_SECRETS_DIR || (process.env.VERCEL ? '/tmp/gp-secrets' : 'storage/secrets'),
  aws: {
    region: process.env.AWS_REGION || process.env.S3_REGION || 'us-west-2',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    sessionToken: process.env.AWS_SESSION_TOKEN || '',
    containerCredentialsRelativeUri: process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI || '',
  },
  fileSigningSecret: process.env.FILE_SIGNING_SECRET || '',
  localStorageDir: process.env.LOCAL_STORAGE_DIR || (process.env.VERCEL ? '/tmp/gp-storage' : 'storage/private'),
  storage: {
    provider: process.env.STORAGE_PROVIDER || (process.env.VERCEL ? 'mongo' : (process.env.NODE_ENV === 'production' ? 's3' : 'local')),
    endpoint: process.env.S3_ENDPOINT || '',
    region: process.env.S3_REGION || 'us-west-2',
    bucket: process.env.S3_BUCKET || '',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    sessionToken: process.env.S3_SESSION_TOKEN || '',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  },
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-5-mini',
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFrom: process.env.RESEND_FROM || process.env.SMTP_FROM || 'Gourmet Palace <noreply@gourmetpalace.com>',
  square: {
    environment: process.env.SQUARE_ENVIRONMENT || 'sandbox',
    applicationId: process.env.SQUARE_APPLICATION_ID || '',
    applicationSecret: process.env.SQUARE_APPLICATION_SECRET || '',
    redirectUri: process.env.SQUARE_REDIRECT_URI || `${apiPublicOrigin}/api/v1/integrations/square/callback`,
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `${apiPublicOrigin}/api/v1/integrations/google/callback`,
  },
  inboundInvoiceSecret: process.env.INBOUND_INVOICE_SECRET || '',
};

/** On Vercel, local secret/file stores use /tmp so a first deploy can boot without AWS. Prefer aws/s3 in real production. */
const onVercel = process.env.VERCEL === '1';

/** Validate runtime variables without ever logging their values. */
function validateEnvironment() {
  const production = env.nodeEnv === 'production';
  const checks = [
    { name: 'MONGODB_URI', present: Boolean(process.env.MONGODB_URI || process.env.MONGO_URL), required: production },
    { name: 'SESSION_SECRET', present: Boolean(process.env.SESSION_SECRET), required: production, valid: Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) },
    { name: 'FILE_SIGNING_SECRET', present: Boolean(process.env.FILE_SIGNING_SECRET), required: production, valid: Boolean(!process.env.FILE_SIGNING_SECRET || process.env.FILE_SIGNING_SECRET.length >= 32) },
    { name: 'CRON_SECRET', present: Boolean(process.env.CRON_SECRET), required: production, valid: Boolean(!process.env.CRON_SECRET || process.env.CRON_SECRET.length >= 32) },
    { name: 'RESEND_API_KEY or SMTP_HOST', present: Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST), required: production },
    { name: 'OPENAI_API_KEY', present: Boolean(process.env.OPENAI_API_KEY), required: false },
    { name: 'SECRET_ENCRYPTION_KEY', present: Boolean(process.env.SECRET_ENCRYPTION_KEY), required: false },
    { name: 'STORAGE_PROVIDER', present: Boolean(process.env.STORAGE_PROVIDER || env.storage.provider), required: true },
    { name: 'GOOGLE_MANUAL_SYNC_COOLDOWN_MINUTES', present: Boolean(process.env.GOOGLE_MANUAL_SYNC_COOLDOWN_MINUTES), required: false, valid: env.googleManualSyncCooldownMinutes > 0 },
    { name: 'SQUARE_MANUAL_SYNC_COOLDOWN_MINUTES', present: Boolean(process.env.SQUARE_MANUAL_SYNC_COOLDOWN_MINUTES), required: false, valid: env.squareManualSyncCooldownMinutes > 0 },
  ];
  const known = [
    'NODE_ENV', 'PORT', 'CORS_ORIGIN', 'APP_URL', 'API_PUBLIC_URL', 'SESSION_NAME', 'SESSION_MAX_AGE_MS', 'SESSION_SECURE',
    'SECRET_ENCRYPTION_KEY', 'CRON_SECRET', 'RESEND_API_KEY', 'RESEND_FROM', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM',
    'OPENAI_API_KEY', 'OPENAI_MODEL', 'SQUARE_ENVIRONMENT', 'SQUARE_APPLICATION_ID', 'SQUARE_APPLICATION_SECRET', 'SQUARE_REDIRECT_URI',
    'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'INBOUND_INVOICE_SECRET', 'PASSWORD_RESET_TTL_MS', 'EMAIL_VERIFICATION_TTL_MS', 'VERIFICATION_RESEND_COOLDOWN_MS',
    'SECRET_STORE_PROVIDER', 'SECRET_STORE_PREFIX', 'LOCAL_SECRETS_DIR', 'AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_CONTAINER_CREDENTIALS_RELATIVE_URI',
    'STORAGE_PROVIDER', 'LOCAL_STORAGE_DIR', 'S3_BUCKET', 'S3_REGION', 'S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_SESSION_TOKEN', 'S3_FORCE_PATH_STYLE',
    'FILE_SIGNING_SECRET', 'GOOGLE_MANUAL_SYNC_COOLDOWN_MINUTES', 'PROVIDER_HTTP_TIMEOUT_MS', 'SQUARE_MANUAL_SYNC_COOLDOWN_MINUTES',
  ];
  const alreadyChecked = new Set(checks.map((check) => check.name));
  for (const name of known) {
    if (alreadyChecked.has(name)) continue;
    const raw = process.env[name];
    const numeric = /(?:PORT|TTL_MS|TIMEOUT_MS|COOLDOWN_MINUTES)$/.test(name);
    const boolean = /(?:SECURE|FORCE_PATH_STYLE)$/.test(name);
    const url = /(?:URL|URI|ORIGIN)$/.test(name);
    let valid = !raw;
    if (raw) {
      valid = boolean ? /^(true|false)$/i.test(String(raw).trim())
        : numeric ? Number.isFinite(Number(raw)) && Number(raw) >= 0
          : url ? (() => { try { new URL(String(raw)); return true; } catch { return false; } })()
            : true;
    }
    checks.push({
      name,
      present: Boolean(raw && String(raw).trim()),
      required: false,
      valid,
    });
  }
  for (const check of checks) check.valid = check.valid !== false && (!check.required || check.present);
  if (production && !onVercel && env.secretStoreProvider !== 'aws') checks.push({ name: 'SECRET_STORE_PROVIDER=aws', present: true, required: true, valid: false });
  if (production && !onVercel && env.storage.provider !== 's3') checks.push({ name: 'STORAGE_PROVIDER=s3', present: true, required: true, valid: false });
  if (production && env.storage.provider === 's3' && !env.storage.bucket) checks.push({ name: 'S3_BUCKET', present: false, required: true, valid: false });
  if (production && env.storage.endpoint && (!env.storage.accessKeyId || !env.storage.secretAccessKey) && (!env.aws.accessKeyId || !env.aws.secretAccessKey) && !env.aws.containerCredentialsRelativeUri) {
    checks.push({ name: 'S3 credentials or AWS_CONTAINER_CREDENTIALS_RELATIVE_URI', present: false, required: true, valid: false });
  }
  const invalid = checks.filter((check) => !check.valid);
  console.info('[config] environment validation', {
    nodeEnv: env.nodeEnv,
    vercel: onVercel,
    variables: Object.fromEntries(checks.map(({ name, present, required, valid }) => [name, { present, required, valid }])),
  });
  if (production && invalid.length) {
    throw new Error(`[config] Invalid environment configuration: ${invalid.map((check) => check.name).join(', ')}`);
  }
  return { checks, valid: invalid.length === 0 };
}

env.validation = validateEnvironment();

/** Always resolve DB URI from the live process env (Vercel may not freeze object literals correctly). */
Object.defineProperty(env, 'mongodbUri', {
  enumerable: true,
  configurable: true,
  get() {
    return process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/gourmet-palace';
  },
});

/** Support both CJS require and bundlers that expect `default`. */
module.exports = env;
module.exports.default = env;
