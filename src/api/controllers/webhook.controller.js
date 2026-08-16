const crypto = require('crypto');
const webhookService = require('../../application/services/webhook.service');
const config = require('../../infrastructure/config/env');
const AppError = require('../../application/errors/AppError');

const MAX_FIELD_LENGTH = {
  vtpCode: 128,
  status: 256,
  location: 512,
  note: 1000,
};

// Plain !== leaks timing info proportional to how many leading chars match, which is enough to
// brute-force a token character-by-character over many requests. Hashing both sides to a fixed
// length first lets timingSafeEqual do a real constant-time comparison.
function safeTokenEquals(a, b) {
  const bufA = crypto.createHash('sha256').update(String(a)).digest();
  const bufB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(bufA, bufB);
}

// FR-07: authenticate via token, validate structure, persist, and return 200 immediately
// (< 500ms) - the actual business processing happens in the background worker.
async function receiveVtpWebhook(req, res) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();

  // VTP's documented payload carries TOKEN inside the JSON body; some integrations send it as a
  // header instead - accept either so we don't depend on which convention VTP actually uses.
  const token = req.headers['x-vtp-token'] || req.body?.TOKEN;
  if (!token || !safeTokenEquals(token, config.vtpWebhookToken)) {
    console.warn(`[webhook ${requestId}] rejected: invalid token`);
    throw new AppError('Token webhook không hợp lệ', 401);
  }

  const normalized = webhookService.normalizeVtpPayload(req.body);
  if (!normalized.vtpCode) {
    // Reject clearly malformed payloads immediately instead of enqueueing something the worker
    // can only ever fail on - "missing vtpCode" is never going to become valid on retry.
    console.warn(`[webhook ${requestId}] rejected: missing vtpCode`);
    throw new AppError('Payload thiếu vtpCode', 400);
  }
  for (const [field, max] of Object.entries(MAX_FIELD_LENGTH)) {
    const value = normalized[field];
    if (value && String(value).length > max) {
      throw new AppError(`Trường ${field} vượt quá ${max} ký tự`, 400);
    }
  }

  const result = await webhookService.ingestWebhook({ rawBody: req.body, requestId });
  console.log(`[webhook ${requestId}] accepted vtpCode=${normalized.vtpCode} duplicate=${result.duplicate}`);
  res.status(200).json({ received: true });
}

module.exports = { receiveVtpWebhook };
