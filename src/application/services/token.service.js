const jwt = require('jsonwebtoken');
const config = require('../../infrastructure/config/env');

// NFR-02: JWT must expire in at most 24h, regardless of what JWT_EXPIRES_IN is set to.
const MAX_EXPIRES_SECONDS = 24 * 60 * 60;
const UNIT_SECONDS = { s: 1, m: 60, h: 3600, d: 86400 };

function parseDurationToSeconds(value) {
  if (typeof value === 'number') return value;
  const match = /^(\d+)([smhd])$/.exec(String(value).trim());
  if (!match) return null;
  const [, amount, unit] = match;
  return Number(amount) * UNIT_SECONDS[unit];
}

function resolveExpiresInSeconds() {
  const seconds = parseDurationToSeconds(config.jwtExpiresIn);
  if (!seconds || seconds <= 0 || seconds > MAX_EXPIRES_SECONDS) {
    return MAX_EXPIRES_SECONDS;
  }
  return seconds;
}

function signAccessToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: resolveExpiresInSeconds() });
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

module.exports = { signAccessToken, verifyAccessToken };
