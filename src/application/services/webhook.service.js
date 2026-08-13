const { WebhookInbox, Order, OrderEvent } = require('../../domain/models');
const { sha256Hex } = require('../utils/hash.util');
const { canonicalStringify } = require('../utils/canonicalJson.util');
const { refreshOrderCurrentStatus } = require('./orderStatus.service');

const MAX_RETRY = 5;
const LOCK_TIMEOUT_MS = 60 * 1000;

function retryDelayMs(retryCount) {
  return Math.min(60000, 2 ** retryCount * 1000);
}

// FR-07 fast path: authenticate + persist raw payload to webhookInbox, return immediately.
// Duplicate deliveries (same contentHash) are accepted idempotently, not rejected, since VTP may retry.
async function ingestWebhook({ rawBody }) {
  const contentHash = sha256Hex(canonicalStringify(rawBody));
  try {
    await WebhookInbox.create({ rawBody, contentHash, status: 'pending', receivedAt: new Date() });
    return { duplicate: false, contentHash };
  } catch (err) {
    if (err.code === 11000) {
      return { duplicate: true, contentHash };
    }
    throw err;
  }
}

// Atomically claims one pending/retry-due item and locks it, so multiple worker instances don't race.
async function claimNextItem(workerId) {
  const now = new Date();
  const staleLockThreshold = new Date(now.getTime() - LOCK_TIMEOUT_MS);
  return WebhookInbox.findOneAndUpdate(
    {
      $or: [{ lockedAt: null }, { lockedAt: { $lt: staleLockThreshold } }],
      // nextAttemptAt: null means "gave up, do not retry" - must be excluded explicitly, since
      // Mongo's BSON sort order treats null as less than any date and $lte would otherwise match it.
      $and: [{ $or: [{ status: 'pending' }, { status: 'failed', nextAttemptAt: { $type: 'date', $lte: now } }] }],
    },
    { $set: { lockedAt: now, lockedBy: workerId } },
    { sort: { receivedAt: 1 }, new: true }
  );
}

async function markProcessed(item) {
  await WebhookInbox.updateOne(
    { _id: item._id },
    { $set: { status: 'processed', processedAt: new Date(), lockedAt: null, lockedBy: null, errorMessage: null } }
  );
}

async function markFailed(item, message) {
  const retryCount = (item.retryCount || 0) + 1;
  const giveUp = retryCount >= MAX_RETRY;
  await WebhookInbox.updateOne(
    { _id: item._id },
    {
      $set: {
        status: 'failed',
        errorMessage: giveUp ? `${message} (đã hết ${MAX_RETRY} lần thử)` : message,
        retryCount,
        nextAttemptAt: giveUp ? null : new Date(Date.now() + retryDelayMs(retryCount)),
        lockedAt: null,
        lockedBy: null,
      },
    }
  );
}

// Background job step: turn one webhookInbox item into orderEvents(source=webhook_vtp).
// Never throws - failures are recorded on the item itself so one bad delivery can't block the queue.
async function processWebhookItem(item) {
  const payload = item.rawBody || {};
  const vtpCode = payload.vtpCode;
  if (!vtpCode) {
    await markFailed(item, 'Payload thiếu vtpCode');
    return;
  }

  const order = await Order.findOne({ vtpCode }).select('_id').lean();
  if (!order) {
    await markFailed(item, `Không tìm thấy đơn hàng với vtpCode=${vtpCode}`);
    return;
  }

  let eventTime = payload.eventTime ? new Date(payload.eventTime) : item.receivedAt;
  if (Number.isNaN(eventTime.getTime()) || eventTime.getTime() > Date.now()) {
    eventTime = item.receivedAt;
  }

  try {
    // Reuses webhookInbox.contentHash so this event always traces back to its inbox record
    // (PROJECT_CONTEXT.md 3.4 invariant #2), instead of computing a separate hash.
    await OrderEvent.create({
      orderId: order._id,
      source: 'webhook_vtp',
      eventType: payload.status || 'unknown',
      location: payload.location || null,
      note: payload.note || null,
      actorUserId: null,
      rawPayload: payload,
      contentHash: item.contentHash,
      providerEventId: payload.providerEventId || null,
      externalStatus: payload.status || null,
      eventTime,
      receivedAt: item.receivedAt,
    });
    await refreshOrderCurrentStatus(order._id);
    await markProcessed(item);
  } catch (err) {
    if (err.code === 11000) {
      // Already recorded by an earlier attempt at this same contentHash - not an error.
      await markProcessed(item);
      return;
    }
    await markFailed(item, err.message);
  }
}

module.exports = { ingestWebhook, claimNextItem, processWebhookItem, markFailed, markProcessed, MAX_RETRY };
