const express = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const { authenticate, authorize, requireActiveAccount } = require('../middlewares/auth.middleware');
const dashboardController = require('../controllers/dashboard.controller');

const router = express.Router();

/**
 * @openapi
 * /dashboard/stats:
 *   get:
 *     summary: Thống kê dashboard (FR-09) - tổng số đơn, số đơn theo trạng thái, số đơn 7 ngày gần nhất
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thống kê (partner chỉ thấy đơn của mình, admin toàn hệ thống)
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không đủ quyền
 */
router.get('/stats', authenticate, authorize('admin', 'partner'), requireActiveAccount, asyncHandler(dashboardController.stats));

module.exports = router;
