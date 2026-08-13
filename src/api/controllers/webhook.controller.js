const webhookService = require('../../application/services/webhook.service');
const config = require('../../infrastructure/config/env');
const AppError = require('../../application/errors/AppError');

// FR-07: authenticate via token, persist, and return 200 immediately (< 500ms) -
// the actual business processing happens in the background worker.
async function receiveVtpWebhook(req, res) {
  const token = req.headers['x-vtp-token'];
  if (!token || token !== config.vtpWebhookToken) {
    throw new AppError('Token webhook không hợp lệ', 401);
  }

  await webhookService.ingestWebhook({ rawBody: req.body });
  res.status(200).json({ received: true });
}

module.exports = { receiveVtpWebhook };
