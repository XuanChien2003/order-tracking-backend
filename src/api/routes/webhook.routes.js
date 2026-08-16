const express = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const { webhookLimiter } = require('../middlewares/rateLimit.middleware');
const webhookController = require('../controllers/webhook.controller');

const router = express.Router();

/**
 * @openapi
 * /webhook/vtp:
 *   post:
 *     summary: Nhận webhook trạng thái từ Viettel Post (FR-07) - xác thực token, ghi nhanh vào hàng đợi, xử lý nghiệp vụ ở background job
 *     tags: [Webhook]
 *     parameters:
 *       - in: header
 *         name: x-vtp-token
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vtpCode]
 *             properties:
 *               vtpCode: { type: string }
 *               status: { type: string }
 *               eventTime: { type: string, format: date-time }
 *               location: { type: string }
 *               note: { type: string }
 *               providerEventId: { type: string }
 *     responses:
 *       200:
 *         description: Đã nhận (luôn trả nhanh, kể cả khi trùng lặp)
 *       401:
 *         description: Token không hợp lệ
 */
router.post('/vtp', webhookLimiter, asyncHandler(webhookController.receiveVtpWebhook));

module.exports = router;
