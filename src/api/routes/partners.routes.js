const express = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const { validateBody } = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth.middleware');
const { partnerRegisterSchema } = require('../validators/schemas');
const partnerController = require('../controllers/partner.controller');

const router = express.Router();

/**
 * @openapi
 * /partners/register:
 *   post:
 *     summary: Đăng ký đối tác (FR-01) - tạo partners(status=active) + users(role=partner), không cần duyệt
 *     tags: [Partners]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [companyName, contactEmail, contactPhone, password]
 *             properties:
 *               companyName: { type: string }
 *               contactEmail: { type: string, format: email }
 *               contactPhone: { type: string }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       201:
 *         description: Tạo đối tác + tài khoản partner thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       409:
 *         description: contactEmail/username đã tồn tại
 */
router.post('/register', validateBody(partnerRegisterSchema), asyncHandler(partnerController.register));

/**
 * @openapi
 * /partners:
 *   get:
 *     summary: Danh sách đối tác đang hoạt động (cho dropdown chọn đối tác)
 *     tags: [Partners]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách đối tác
 */
router.get('/', authenticate, asyncHandler(partnerController.list));

module.exports = router;

