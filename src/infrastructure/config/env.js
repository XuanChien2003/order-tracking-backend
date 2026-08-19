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
  // Raw SMTP is not usable here - Render (and most PaaS free/low tiers) blocks outbound
  // connections on the SMTP ports (25/465/587) to prevent spam abuse, so nodemailer talking
  // directly to smtp.gmail.com just times out no matter how it's configured. SendGrid sends over
  // HTTPS instead, which isn't blocked. EMAIL_FROM must be an address verified via SendGrid's
  // "Single Sender Verification" (no domain ownership required, unlike most other providers).
  sendgridApiKey: process.env.SENDGRID_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || '',
  // Geofence for nhap_kho/xuat_kho scans (see scan.service.js) - defaults to the Viettel Post
  // Hanoi warehouse (16 Phố Lê Đại Hành, Hai Bà Trưng), overridable per-deployment via env vars.
  warehouseLat: Number(process.env.WAREHOUSE_LAT) || 21.0097723,
  warehouseLng: Number(process.env.WAREHOUSE_LNG) || 105.8503157,
  warehouseRadiusM: Number(process.env.WAREHOUSE_RADIUS_M) || 150,
};
