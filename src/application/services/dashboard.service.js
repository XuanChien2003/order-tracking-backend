const { Order, Partner, OrderEvent, User } = require('../../domain/models');
const AppError = require('../errors/AppError');

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// FR-09: total orders, orders by status, orders created in the last 7 days.
async function getDashboardStats({ requester }) {
  const filter = {};
  if (requester.role === 'partner') {
    const partner = await Partner.findOne({ publicId: requester.partnerId }).select('_id').lean();
    if (!partner) throw new AppError('Không tìm thấy đối tác', 404);
    filter.partnerId = partner._id;
  }

  const now = new Date();
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);

  const [totalOrders, byStatusAgg, inTransitCount, deliveredCount, pendingCount, dailyAgg] = await Promise.all([
    Order.countDocuments(filter),

    Order.aggregate([
      { $match: filter },
      { $group: { _id: '$currentStatus', count: { $sum: 1 } } },
      { $project: { _id: 0, status: '$_id', count: 1 } },
      { $sort: { status: 1 } },
    ]),

    Order.countDocuments({ ...filter, currentStatus: { $regex: /vc|vận chuyển/i } }),
    Order.countDocuments({ ...filter, currentStatus: { $regex: /đã giao|giao thành công/i } }),
    Order.countDocuments({ ...filter, currentStatus: { $regex: /chờ|xl|mới/i } }),

    // Group orders by calendar date (YYYY-MM-DD) within the last 7 days
    Order.aggregate([
      { $match: { ...filter, createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]),
  ]);

  // Build a date key → count map from aggregation results
  const dailyMap = new Map();
  for (const item of dailyAgg) {
    const key = `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`;
    dailyMap.set(key, item.count);
  }

  // Vietnamese short day labels (CN=Sunday, T2=Monday, ..., T7=Saturday)
  const VI_DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  // Build chart data for each of the last 7 calendar days (oldest → newest)
  const chart7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const key = `${year}-${month}-${day}`;
    const count = dailyMap.get(key) || 0;
    const dayLabel = VI_DAYS[d.getDay()]; // 0=Sun → CN, 1=Mon → T2, ...
    chart7Days.push({ label: dayLabel, val: count });
  }

  // Normalize bar heights to percentage (0–100) of the max day count
  const maxVal = Math.max(...chart7Days.map((d) => d.val), 1);
  const chart7DaysNormalized = chart7Days.map((d) => ({
    label: d.label,
    count: d.val,
    val: Math.round((d.val / maxVal) * 100),
  }));

  // Scan activity (who scanned what, how many times) is internal warehouse-staff data - scanners
  // aren't tied to a partner (PROJECT_CONTEXT.md 2.3), so this is admin-only, not shown to partner.
  const scanStats = requester.role === 'admin' ? await getScanStats() : null;

  return {
    totalOrders,
    inTransitCount,
    deliveredCount,
    pendingCount,
    byStatus: byStatusAgg,
    recentOrders7d: chart7Days.reduce((sum, d) => sum + d.count, 0),
    chart7Days: chart7DaysNormalized,
    scanStats,
  };
}

const SCAN_STATS_RECENT_LIMIT = 50;

// Scan lượt quét: tổng theo loại sự kiện (nhap_kho/xuat_kho) và nhật ký SCAN_STATS_RECENT_LIMIT
// lượt quét gần nhất (mỗi dòng = 1 lượt quét thật, kèm đơn/nhân viên/vị trí/thời gian), để admin
// theo dõi hoạt động kho theo trình tự thời gian thay vì chỉ xem số tổng theo đơn.
async function getScanStats() {
  const [byTypeAgg, recentEventsRaw] = await Promise.all([
    OrderEvent.aggregate([
      { $match: { source: 'scan_pda' } },
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
      { $project: { _id: 0, eventType: '$_id', count: 1 } },
    ]),

    OrderEvent.find({ source: 'scan_pda' })
      .sort({ eventTime: -1 })
      .limit(SCAN_STATS_RECENT_LIMIT)
      .select('orderId eventType location actorUserId eventTime')
      .lean(),
  ]);

  const orderIds = [...new Set(recentEventsRaw.map((e) => String(e.orderId)))];
  const orders = orderIds.length
    ? await Order.find({ _id: { $in: orderIds } }).select('vtpCode receiverName').lean()
    : [];
  const orderMap = new Map(orders.map((o) => [String(o._id), o]));

  const actorIds = [...new Set(recentEventsRaw.filter((e) => e.actorUserId).map((e) => String(e.actorUserId)))];
  const actors = actorIds.length
    ? await User.find({ _id: { $in: actorIds } }).select('username displayName').lean()
    : [];
  const actorMap = new Map(actors.map((a) => [String(a._id), a]));

  const recentEvents = recentEventsRaw.map((e) => {
    const order = orderMap.get(String(e.orderId));
    const actor = e.actorUserId ? actorMap.get(String(e.actorUserId)) : null;
    return {
      vtpCode: order?.vtpCode || null,
      receiverName: order?.receiverName || null,
      eventType: e.eventType,
      location: e.location,
      actorDisplayName: actor?.displayName || actor?.username || null,
      eventTime: e.eventTime,
    };
  });

  return {
    byEventType: byTypeAgg,
    recentEvents,
  };
}

module.exports = { getDashboardStats };
