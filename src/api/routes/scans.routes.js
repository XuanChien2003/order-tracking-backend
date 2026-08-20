const express = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const { authenticate, authorize, requireActiveAccount } = require('../middlewares/auth.middleware');
const { scanLimiter } = require('../middlewares/rateLimit.middleware');
const scanController = require('../controllers/scan.controller');

const router = express.Router();

/**
 * @openapi
 * /scans:
 *   post:
 *     summary: Ghi nhận quét mã (FR-05) - giá trị đọc là vtpCode
 *     tags: [Scans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vtpCode, eventType]
 *             properties:
 *               vtpCode: { type: string }
 *               eventType: { type: string, enum: [nhap_kho, xuat_kho, ban_giao] }
 *               location: { type: string }
 *               note: { type: string }
 *               eventTime: { type: string, format: date-time }
 *               requestId:
 *                 type: string
 *                 description: Khóa idempotency tùy chọn do client sinh (phòng khi thiết bị gửi lại do timeout mạng)
 *     responses:
 *       200:
 *         description: Ghi nhận thành công (idempotent=true nếu là bản ghi trùng lặp)
 *       400:
 *         description: Thiếu/sai vtpCode hoặc eventType
 *       404:
 *         description: Không tìm thấy đơn hàng với vtpCode này
 */
router.post('/', authenticate, authorize('scanner'), requireActiveAccount, scanLimiter, asyncHandler(scanController.createScan));

/**
 * @openapi
 * /scans/history:
 *   get:
 *     summary: Lịch sử quét của chính người dùng hiện tại (FR-06)
 *     tags: [Scans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Danh sách lịch sử quét có phân trang, sắp xếp giảm dần theo thời gian
 */
router.get('/history', authenticate, authorize('scanner'), asyncHandler(scanController.scanHistory));

module.exports = router;
