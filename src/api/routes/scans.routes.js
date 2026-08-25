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
 *               force:
 *                 type: boolean
 *                 description: >
 *                   "Quét lại" - xác nhận rõ ràng của người dùng rằng họ biết đã có bản ghi
 *                   (order, eventType) này từ tài khoản của họ và muốn ghi đè bằng 1 bản ghi mới
 *                   (VD: quét nhầm loại sự kiện). Chỉ được phép trong vòng 24h kể từ bản ghi đầu
 *                   tiên; mặc định false.
 *     responses:
 *       200:
 *         description: Ghi nhận thành công (idempotent=true nếu là bản ghi trùng lặp, chưa gửi force)
 *       400:
 *         description: Thiếu/sai vtpCode hoặc eventType
 *       403:
 *         description: force=true nhưng đã quá 24h kể từ lần quét đầu tiên
 *       404:
 *         description: >
 *           Không tìm thấy đơn hàng với vtpCode này - riêng eventType=nhap_kho thì KHÔNG trả 404,
 *           mà tự tạo 1 đơn tối thiểu (gắn Partner "Chưa xác định") để không chặn kho biên giới
 *           nhận hàng trước khi đối tác kịp import Excel
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
