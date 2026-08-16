const rateLimit = require('express-rate-limit');

function makeLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
  });
}

// Baseline for every /api request. Route-specific limiters below are stricter and stack on top
// of this for the endpoints that need it (login, webhook, import, etc.).
const generalLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: 'Quá nhiều yêu cầu, vui lòng thử lại sau',
});

// Tight - this is the brute-force surface, keyed by IP (per-username lockout would need a
// custom store; IP-based is the minimum viable protection here).
const loginLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Quá nhiều lần đăng nhập, vui lòng thử lại sau',
});

const registerLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Quá nhiều lần đăng ký, vui lòng thử lại sau',
});

// Looser than the others - VTP may legitimately send many status updates in a burst.
const webhookLimiter = makeLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Webhook rate limit exceeded',
});

const importLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: 'Quá nhiều lần import, vui lòng thử lại sau',
});

const searchLimiter = makeLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Quá nhiều yêu cầu tìm kiếm, vui lòng thử lại sau',
});

const printLimiter = makeLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Quá nhiều yêu cầu in nhãn, vui lòng thử lại sau',
});

const scanLimiter = makeLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Quá nhiều yêu cầu quét, vui lòng thử lại sau',
});

module.exports = {
  generalLimiter,
  loginLimiter,
  registerLimiter,
  webhookLimiter,
  importLimiter,
  searchLimiter,
  printLimiter,
  scanLimiter,
};
