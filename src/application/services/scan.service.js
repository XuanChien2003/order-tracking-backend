const { Order, OrderEvent, Partner } = require('../../domain/models');
const { sha256Hex } = require('../utils/hash.util');
const { SCAN_EVENT_TYPES, UNASSIGNED_PARTNER_PUBLIC_ID } = require('../../domain/constants/enums');
const { refreshOrderCurrentStatus } = require('./orderStatus.service');
const AppError = require('../errors/AppError');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const RESCAN_WINDOW_MS = 24 * 60 * 60 * 1000;

// FR-05: scanner scans a code (value read = vtpCode). One warehouse account (see
// PROJECT_CONTEXT.md - one account per warehouse) gets one saved record per (order, eventType) by
// default: a network failure + retry, or an accidental duplicate scan/entry, resolves to that same
// record rather than creating a second one. If the scanner genuinely scanned wrong and wants to
// correct it, the app can resubmit with force=true ("Quét lại") to record a second, corrective
// event instead - but only within RESCAN_WINDOW_MS of that account's FIRST record for this
// (order, eventType); past that window even a forced resubmit is rejected. A different account (a
// different warehouse the order also passes through) always gets its own independent record.
async function recordScan({ vtpCode, eventType, location, note, eventTime, requestId, actorUserObjectId, force }) {
  if (!vtpCode) {
    throw new AppError('vtpCode là bắt buộc', 400);
  }
  if (!SCAN_EVENT_TYPES.includes(eventType)) {
    throw new AppError(`eventType phải thuộc: ${SCAN_EVENT_TYPES.join(', ')}`, 400);
  }

  let order = await Order.findOne({ vtpCode }).select('_id').lean();
  let autoCreatedOrder = false;
  if (!order) {
    // A border warehouse can physically receive a package before the partner's Excel import
    // catches up. Only nhap_kho (first touch) may create the order on the fly; xuat_kho/ban_giao
    // on a code that was never nhap_kho'd is a real data problem, not this case - still 404.
    if (eventType !== 'nhap_kho') {
      throw new AppError('Không tìm thấy đơn hàng với vtpCode này', 404);
    }
    order = await createMinimalOrderFromScan(vtpCode);
    autoCreatedOrder = true;
  }

  const parsedEventTime = eventTime ? new Date(eventTime) : new Date();
  if (Number.isNaN(parsedEventTime.getTime())) {
    throw new AppError('eventTime không hợp lệ', 400);
  }
  if (parsedEventTime.getTime() > Date.now()) {
    throw new AppError('eventTime không được ở tương lai', 400);
  }

  const dedupeFilter = { orderId: order._id, source: 'scan_pda', eventType, actorUserId: actorUserObjectId };

  const firstExisting = await OrderEvent.findOne(dedupeFilter).sort({ eventTime: 1 }).lean();
  if (firstExisting) {
    if (!force) {
      return { idempotent: true, event: firstExisting, vtpCode };
    }
    if (Date.now() - new Date(firstExisting.eventTime).getTime() > RESCAN_WINDOW_MS) {
      throw new AppError('Đã quá 24 giờ kể từ lần quét đầu tiên, không thể quét lại đơn này nữa', 403);
    }
    // Within the correction window - fall through and record a second, corrective event.
  }

  const contentHash = sha256Hex(
    `scan:${vtpCode}:${eventType}:${String(actorUserObjectId)}:${requestId || ''}:${parsedEventTime.toISOString()}`
  );

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
      autoCreatedOrder,
    });
  } catch (err) {
    if (err.code === 11000) {
      // race: another request with the exact same contentHash (same vtpCode+eventType+actor+
      // requestId+eventTime) won the insert first, between our pre-check above and this insert.
      const race = await OrderEvent.findOne({ contentHash }).lean();
      if (race) {
        return { idempotent: true, event: race, vtpCode };
      }
    }
    throw err;
  }

  await refreshOrderCurrentStatus(order._id);

  return { idempotent: false, event, vtpCode };
}

async function ensureUnassignedPartner() {
  const existing = await Partner.findOne({ publicId: UNASSIGNED_PARTNER_PUBLIC_ID }).select('_id').lean();
  if (existing) return existing._id;
  try {
    const created = await Partner.create({
      publicId: UNASSIGNED_PARTNER_PUBLIC_ID,
      companyName: 'Chưa xác định (tự tạo khi quét mã lạ)',
      contactEmail: 'unassigned-orders@internal.local',
      contactPhone: '0000000000',
      status: 'active',
    });
    return created._id;
  } catch (err) {
    if (err.code === 11000) {
      // race: another concurrent request created the bucket partner first
      const race = await Partner.findOne({ publicId: UNASSIGNED_PARTNER_PUBLIC_ID }).select('_id').lean();
      if (race) return race._id;
    }
    throw err;
  }
}

// Minimal Order for a vtpCode nobody has imported yet - just enough to hang OrderEvents off of.
// Attached to the UNASSIGNED bucket partner rather than left partner-less, since partnerId is a
// required reference everywhere else in the schema/queries.
async function createMinimalOrderFromScan(vtpCode) {
  const partnerObjectId = await ensureUnassignedPartner();
  const now = new Date();
  try {
    return await Order.create({
      vtpCode,
      partnerId: partnerObjectId,
      receiverName: 'Chưa có thông tin',
      currentStatus: 'nhap_kho',
      normalizedStatus: 'WAREHOUSE_RECEIVED',
      currentStatusDate: now,
    });
  } catch (err) {
    if (err.code === 11000) {
      // race: another concurrent scan of the same unrecognized vtpCode already created it
      const existing = await Order.findOne({ vtpCode }).select('_id').lean();
      if (existing) return existing;
    }
    throw err;
  }
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
  const orders = await Order.find({ _id: { $in: orderIds } }).select('vtpCode receiverName').lean();
  const orderMap = new Map(orders.map((o) => [String(o._id), o]));

  const items = events.map((e) => {
    const order = orderMap.get(String(e.orderId));
    return {
      eventType: e.eventType,
      location: e.location,
      note: e.note,
      eventTime: e.eventTime,
      receivedAt: e.receivedAt,
      order: order ? { vtpCode: order.vtpCode, receiverName: order.receiverName } : null,
    };
  });

  return { total, page: p, limit: l, items };
}

module.exports = { recordScan, getScanHistory };
