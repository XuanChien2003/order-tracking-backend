const mongoose = require('mongoose');
const { WEBHOOK_STATUS } = require('../constants/enums');

const webhookInboxSchema = new mongoose.Schema(
  {
    rawBody: { type: mongoose.Schema.Types.Mixed, required: true },
    contentHash: { type: String, required: true, unique: true, match: /^[0-9a-f]{64}$/ },
    status: { type: String, enum: WEBHOOK_STATUS, required: true, default: 'pending' },
    errorMessage: { type: String, default: null },
    retryCount: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: null },
    lockedAt: { type: Date, default: null },
    lockedBy: { type: String, default: null },
    receivedAt: { type: Date, required: true },
    processedAt: { type: Date, default: null },
  },
  { timestamps: false }
);

webhookInboxSchema.index({ status: 1, nextAttemptAt: 1, receivedAt: 1 });

module.exports = mongoose.model('WebhookInbox', webhookInboxSchema, 'webhookInbox');
