require('dotenv').config();

const required = ['MONGO_URI', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const nodeEnv = process.env.NODE_ENV || 'development';

// Webhook must have a real shared secret before accepting production traffic - an empty token
// would mean `token !== ''` only fails to match falsy tokens, not a deliberate empty string sent
// by an attacker who noticed the var was never set.
if (nodeEnv === 'production' && !process.env.VTP_WEBHOOK_TOKEN) {
  throw new Error('VTP_WEBHOOK_TOKEN is required in production');
}

module.exports = {
  nodeEnv,
  port: Number(process.env.PORT) || 8080,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  vtpWebhookToken: process.env.VTP_WEBHOOK_TOKEN || '',
  enableAutoSeed: process.env.ENABLE_AUTO_SEED === 'true',
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
