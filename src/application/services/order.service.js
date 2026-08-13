const { Order, OrderEvent, Partner, User } = require('../../domain/models');
const AppError = require('../errors/AppError');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function toOrderPublic(order, partnerMap) {
  const partnerInfo = partnerMap.get(String(order.partnerId));
  return {
    internalCode: order.internalCode,
    vtpCode: order.vtpCode,
    partner: partnerInfo ? { publicId: partnerInfo.publicId, companyName: partnerInfo.companyName } : null,
    receiverName: order.receiverName,
    receiverPhone: order.receiverPhone,
    receiverAddress: order.receiverAddress,
    productInfo: order.productInfo,
    weightKg: order.weightKg,
    currentStatus: order.currentStatus,
    currentStatusDate: order.currentStatusDate,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

async function attachPartnerInfo(orders) {
  const partnerIds = [...new Set(orders.map((o) => String(o.partnerId)))];
  const partners = await Partner.find({ _id: { $in: partnerIds } }).select('publicId companyName').lean();
  const map = new Map(partners.map((p) => [String(p._id), p]));
  return orders.map((o) => toOrderPublic(o, map));
}

// FR-08: partner only sees its own orders; admin is unrestricted.
// v1 only supports exact match on indexed columns: internalCode, vtpCode, receiverPhone.
async function listOrders({ requester, query }) {
  const filter = {};

  if (requester.role === 'partner') {
    const partner = await Partner.findOne({ publicId: requester.partnerId }).select('_id').lean();
    if (!partner) throw new AppError('Không tìm thấy đối tác', 404);
    filter.partnerId = partner._id;
  } else if (query.partnerId) {
    const partner = await Partner.findOne({ publicId: query.partnerId }).select('_id').lean();
    if (!partner) {
      return { total: 0, page: 1, limit: DEFAULT_LIMIT, items: [] };
    }
    filter.partnerId = partner._id;
  }

  if (query.internalCode) filter.internalCode = String(query.internalCode).trim();
  if (query.vtpCode) filter.vtpCode = String(query.vtpCode).trim();
  if (query.receiverPhone) filter.receiverPhone = String(query.receiverPhone).trim();
  if (query.currentStatus) filter.currentStatus = String(query.currentStatus).trim();

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || DEFAULT_LIMIT));
  const sort = query.currentStatus ? { currentStatusDate: -1 } : { createdAt: -1 };

  const [total, orders] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
  ]);

  const items = await attachPartnerInfo(orders);
  return { total, page, limit, items };
}

function toEventPublic(event, actorMap) {
  const actor = event.actorUserId ? actorMap.get(String(event.actorUserId)) : null;
  return {
    source: event.source,
    eventType: event.eventType,
    location: event.location,
    note: event.note,
    actor: actor ? { publicId: actor.publicId, displayName: actor.displayName } : null,
    externalStatus: event.externalStatus,
    eventTime: event.eventTime,
    receivedAt: event.receivedAt,
  };
}

async function getOrderDetail({ requester, internalCode }) {
  const order = await Order.findOne({ internalCode }).lean();
  if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);

  if (requester.role === 'partner') {
    const partner = await Partner.findOne({ publicId: requester.partnerId }).select('_id').lean();
    if (!partner || String(order.partnerId) !== String(partner._id)) {
      // 404 instead of 403 so we don't leak which internalCodes exist for other partners
      throw new AppError('Không tìm thấy đơn hàng', 404);
    }
  }

  const [orderPublic] = await attachPartnerInfo([order]);

  const events = await OrderEvent.find({ orderId: order._id }).sort({ eventTime: -1 }).lean();
  const actorIds = [...new Set(events.filter((e) => e.actorUserId).map((e) => String(e.actorUserId)))];
  const actors = await User.find({ _id: { $in: actorIds } }).select('publicId displayName').lean();
  const actorMap = new Map(actors.map((a) => [String(a._id), a]));

  return {
    ...orderPublic,
    events: events.map((e) => toEventPublic(e, actorMap)),
  };
}

module.exports = { listOrders, getOrderDetail };
