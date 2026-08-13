const { Order, OrderEvent } = require('../../domain/models');
const { sha256Hex } = require('../utils/hash.util');
const { SCAN_EVENT_TYPES } = require('../../domain/constants/enums');
const { refreshOrderCurrentStatus } = require('./orderStatus.service');
const AppError = require('../errors/AppError');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// FR-05: scanner scans a code (value read = vtpCode). Dedup via contentHash -> idempotent 200, no new record.
// No cap on number of scans per order.
async function recordScan({ vtpCode, eventType, location, note, eventTime, requestId, actorUserObjectId }) {
  if (!vtpCode) {
    throw new AppError('vtpCode là bắt buộc', 400);
  }
  if (!SCAN_EVENT_TYPES.includes(eventType)) {
    throw new AppError(`eventType phải thuộc: ${SCAN_EVENT_TYPES.join(', ')}`, 400);
  }

  const order = await Order.findOne({ vtpCode }).select('_id internalCode').lean();
  if (!order) {
    throw new AppError('Không tìm thấy đơn hàng với vtpCode này', 404);
  }

  const parsedEventTime = eventTime ? new Date(eventTime) : new Date();
  if (Number.isNaN(parsedEventTime.getTime())) {
    throw new AppError('eventTime không hợp lệ', 400);
  }
  if (parsedEventTime.getTime() > Date.now()) {
    throw new AppError('eventTime không được ở tương lai', 400);
  }

  const contentHash = sha256Hex(
    `scan:${vtpCode}:${eventType}:${String(actorUserObjectId)}:${requestId || ''}:${parsedEventTime.toISOString()}`
  );

  const existing = await OrderEvent.findOne({ contentHash }).lean();
  if (existing) {
    return { idempotent: true, event: existing, internalCode: order.internalCode };
  }

  let event;
  try {
    event = await OrderEvent.create({
      orderId: order._id,
      source: 'scan_pda',
      eventType,
      location: location || null,
      note: note || null,
      actorUserId: actorUserObjectId,
      contentHash,
      requestId: requestId || null,
      eventTime: parsedEventTime,
      receivedAt: new Date(),
    });
  } catch (err) {
    if (err.code === 11000) {
      // race: another request with the same contentHash/requestId won the insert first
      const race = await OrderEvent.findOne({ contentHash }).lean();
      if (race) {
        return { idempotent: true, event: race, internalCode: order.internalCode };
      }
    }
    throw err;
  }

  await refreshOrderCurrentStatus(order._id);

  return { idempotent: false, event, internalCode: order.internalCode };
}

// FR-06: scanner's own scan history, paginated, newest first.
async function getScanHistory({ actorUserObjectId, page, limit }) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(MAX_LIMIT, Math.max(1, Number(limit) || DEFAULT_LIMIT));
  const filter = { source: 'scan_pda', actorUserId: actorUserObjectId };

  const [total, events] = await Promise.all([
    OrderEvent.countDocuments(filter),
    OrderEvent.find(filter).sort({ eventTime: -1 }).skip((p - 1) * l).limit(l).lean(),
  ]);

  const orderIds = [...new Set(events.map((e) => String(e.orderId)))];
  const orders = await Order.find({ _id: { $in: orderIds } }).select('internalCode vtpCode receiverName').lean();
  const orderMap = new Map(orders.map((o) => [String(o._id), o]));

  const items = events.map((e) => {
    const order = orderMap.get(String(e.orderId));
    return {
      eventType: e.eventType,
      location: e.location,
      note: e.note,
      eventTime: e.eventTime,
      receivedAt: e.receivedAt,
      order: order ? { internalCode: order.internalCode, vtpCode: order.vtpCode, receiverName: order.receiverName } : null,
    };
  });

  return { total, page: p, limit: l, items };
}

module.exports = { recordScan, getScanHistory };
