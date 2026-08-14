const webhookService = require('../../application/services/webhook.service');
const config = require('../../infrastructure/config/env');
const AppError = require('../../application/errors/AppError');

// FR-07: authenticate via token, persist, and return 200 immediately (< 500ms) -
// the actual business processing happens in the background worker.
async function receiveVtpWebhook(req, res) {
  // VTP's documented payload carries TOKEN inside the JSON body; some integrations send it as a
  // header instead - accept either so we don't depend on which convention VTP actually uses.
  const token = req.headers['x-vtp-token'] || req.body?.TOKEN;
  if (!token || token !== config.vtpWebhookToken) {
    throw new AppError('Token webhook không hợp lệ', 401);
  }

  await webhookService.ingestWebhook({ rawBody: req.body });
  res.status(200).json({ received: true });
}

module.exports = { receiveVtpWebhook };
