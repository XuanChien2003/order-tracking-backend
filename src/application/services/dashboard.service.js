const { Order, Partner } = require('../../domain/models');
const AppError = require('../errors/AppError');

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// FR-09: total orders, orders by status, orders created in the last 7 days.
// Same scoping as FR-08: partner sees only its own orders, admin sees everything.
async function getDashboardStats({ requester }) {
  const filter = {};
  if (requester.role === 'partner') {
    const partner = await Partner.findOne({ publicId: requester.partnerId }).select('_id').lean();
    if (!partner) throw new AppError('Không tìm thấy đối tác', 404);
    filter.partnerId = partner._id;
  }

  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);

  const [totalOrders, byStatusAgg, recentOrders] = await Promise.all([
    Order.countDocuments(filter),
    Order.aggregate([
      { $match: filter },
      { $group: { _id: '$currentStatus', count: { $sum: 1 } } },
      { $project: { _id: 0, status: '$_id', count: 1 } },
      { $sort: { status: 1 } },
    ]),
    Order.countDocuments({ ...filter, createdAt: { $gte: sevenDaysAgo } }),
  ]);

  return {
    totalOrders,
    byStatus: byStatusAgg,
    recentOrders7d: recentOrders,
  };
}

module.exports = { getDashboardStats };
