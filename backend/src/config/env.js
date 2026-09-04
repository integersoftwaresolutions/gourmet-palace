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

  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@gourmetpalace.com',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Password1',
    adminName: process.env.SEED_ADMIN_NAME || 'Jimmy George',
    orgName: process.env.SEED_ORG_NAME || 'Gourmet Palace',
    orgSlug: process.env.SEED_ORG_SLUG || 'gourmet-palace',
    locationsJson: process.env.SEED_LOCATIONS_JSON || '[]',
  },

  passwordResetTtlMs: Number(process.env.PASSWORD_RESET_TTL_MS) || 60 * 60 * 1000,
  secretEncryptionKey: process.env.SECRET_ENCRYPTION_KEY || '',
  secretStoreProvider: process.env.SECRET_STORE_PROVIDER || (process.env.NODE_ENV === 'production' ? 'aws' : 'local'),
  secretStorePrefix: process.env.SECRET_STORE_PREFIX || 'gourmet-palace',
  localSecretsDir: process.env.LOCAL_SECRETS_DIR || 'storage/secrets',
  aws: {
    region: process.env.AWS_REGION || process.env.S3_REGION || 'us-west-2',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    sessionToken: process.env.AWS_SESSION_TOKEN || '',
  },
  fileSigningSecret: process.env.FILE_SIGNING_SECRET || '',
  localStorageDir: process.env.LOCAL_STORAGE_DIR || 'storage/private',
  storage: {
    provider: process.env.STORAGE_PROVIDER || (process.env.NODE_ENV === 'production' ? 's3' : 'local'),
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

if (!process.env.SESSION_SECRET && env.nodeEnv === 'production') throw new Error('SESSION_SECRET is required in production');
if (env.nodeEnv === 'production' && !env.fileSigningSecret) throw new Error('FILE_SIGNING_SECRET is required in production');
if (env.nodeEnv === 'production' && env.secretStoreProvider !== 'aws') throw new Error('SECRET_STORE_PROVIDER=aws is required in production');
if (env.nodeEnv === 'production' && env.storage.provider !== 's3') throw new Error('STORAGE_PROVIDER=s3 is required in production');
if (env.nodeEnv === 'production' && !env.storage.bucket) throw new Error('S3_BUCKET is required in production');
if (env.nodeEnv === 'production' && env.storage.endpoint && (!env.storage.accessKeyId || !env.storage.secretAccessKey) && (!env.aws.accessKeyId || !env.aws.secretAccessKey) && !process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI) throw new Error('Custom S3-compatible endpoints require S3 credentials or an available AWS credential provider');

/** Support both CJS require and bundlers that expect `default`. */
module.exports = env;
module.exports.default = env;
