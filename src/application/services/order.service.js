const { Order, OrderEvent, Partner, User } = require('../../domain/models');
const AppError = require('../errors/AppError');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_SEARCH_LENGTH = 100;

// Search terms go straight into $regex below - unescaped, a term like "(a+)+$" is a ReDoS
// payload, and metacharacters like "." or "|" turn a literal search into an unintended pattern.
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toSafeSearchRegex(value) {
  const trimmed = String(value).trim().slice(0, MAX_SEARCH_LENGTH);
  if (!trimmed) return null;
  return { $regex: escapeRegex(trimmed), $options: 'i' };
}

function toOrderPublic(order, partnerMap) {
  const partnerInfo = partnerMap ? partnerMap.get(String(order.partnerId)) : null;
  return {
    vtpCode: order.vtpCode,
    partner: partnerInfo ? { publicId: partnerInfo.publicId, companyName: partnerInfo.companyName } : null,
    receiverName: order.receiverName,
    receiverPhone: order.receiverPhone,
    receiverAddress: order.receiverAddress,
    productInfo: order.productInfo,
    weightKg: order.weightKg,
    serviceName: order.serviceName || null,
    cod: order.cod ?? null,
    shippingFee: order.shippingFee ?? null,
    vat: order.vat ?? null,
    totalAmount: order.totalAmount ?? null,
    paymentType: order.paymentType || null,
    actorName: order.actorName || null,
    actorPhone: order.actorPhone || null,
    currentStatus: order.currentStatus,
    currentStatusDate: order.currentStatusDate,
    normalizedStatus: order.normalizedStatus || 'UNKNOWN',
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

async function attachPartnerInfo(orders) {
  const partnerIds = [...new Set(orders.map((o) => String(o.partnerId)).filter(Boolean))];
  const partners = partnerIds.length
    ? await Partner.find({ _id: { $in: partnerIds } }).select('publicId companyName').lean()
    : [];
  const map = new Map(partners.map((p) => [String(p._id), p]));
  return orders.map((o) => toOrderPublic(o, map));
}

// FR-08: partner only sees its own orders; admin is unrestricted.
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

  if (query.keyword) {
    const term = toSafeSearchRegex(query.keyword);
    if (term) {
      filter.$or = [
        { vtpCode: term },
        { receiverName: term },
        { receiverPhone: term },
      ];
    }
  }
  if (query.vtpCode) {
    const term = toSafeSearchRegex(query.vtpCode);
    if (term) filter.vtpCode = term;
  }
  if (query.receiverPhone) {
    const term = toSafeSearchRegex(query.receiverPhone);
    if (term) filter.receiverPhone = term;
  }
  if (query.currentStatus) {
    const term = toSafeSearchRegex(query.currentStatus);
    if (term) filter.currentStatus = term;
  }

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

async function getOrderDetail({ requester, vtpCode }) {
  const order = await Order.findOne({ vtpCode }).lean();
  if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);

  if (requester.role === 'partner') {
    const partner = await Partner.findOne({ publicId: requester.partnerId }).select('_id').lean();
    if (!partner || String(order.partnerId) !== String(partner._id)) {
      throw new AppError('Không tìm thấy đơn hàng', 404);
    }
  }

  const [orderPublic] = await attachPartnerInfo([order]);

  const events = await OrderEvent.find({ orderId: order._id }).sort({ eventTime: -1 }).lean();
  const actorIds = [...new Set(events.filter((e) => e.actorUserId).map((e) => String(e.actorUserId)))];
  const actors = actorIds.length
    ? await User.find({ _id: { $in: actorIds } }).select('publicId displayName').lean()
    : [];
  const actorMap = new Map(actors.map((a) => [String(a._id), a]));

  return {
    ...orderPublic,
    events: events.map((e) => toEventPublic(e, actorMap)),
  };
}

module.exports = { listOrders, getOrderDetail };
