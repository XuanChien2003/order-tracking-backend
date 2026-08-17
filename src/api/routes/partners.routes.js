const express = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const { validateBody } = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { registerLimiter } = require('../middlewares/rateLimit.middleware');
const { partnerRegisterSchema, partnerAdminCreateSchema, partnerUpdateSchema } = require('../validators/schemas');
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
router.post('/register', registerLimiter, validateBody(partnerRegisterSchema), asyncHandler(partnerController.register));

/**
 * @openapi
 * /partners:
 *   post:
 *     summary: Admin tạo đối tác + tài khoản partner thay cho tự đăng ký - mật khẩu được sinh tự động và gửi qua email liên hệ
 *     tags: [Partners]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [companyName, contactEmail, contactPhone]
 *             properties:
 *               companyName: { type: string }
 *               contactEmail: { type: string, format: email }
 *               contactPhone: { type: string }
 *     responses:
 *       201:
 *         description: Tạo đối tác + tài khoản partner thành công (emailSent cho biết email gửi thông tin đăng nhập có thành công không)
 *       403:
 *         description: Không đủ quyền (chỉ admin)
 *       409:
 *         description: contactEmail/username đã tồn tại
 */
router.post('/', authenticate, authorize('admin'), validateBody(partnerAdminCreateSchema), asyncHandler(partnerController.adminCreate));

/**
 * @openapi
 * /partners:
 *   get:
 *     summary: Danh sách đối tác (mặc định chỉ đang hoạt động, cho dropdown chọn đối tác)
 *     tags: [Partners]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [all] }
 *         description: "status=all - chỉ admin dùng được, trả về mọi trạng thái (kể cả disabled) để quản lý"
 *     responses:
 *       200:
 *         description: Danh sách đối tác
 */
router.get('/', authenticate, asyncHandler(partnerController.list));

/**
 * @openapi
 * /partners/{publicId}:
 *   patch:
 *     summary: Admin sửa thông tin đối tác hoặc bật/tắt trạng thái hoạt động
 *     tags: [Partners]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: publicId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               companyName: { type: string }
 *               contactEmail: { type: string, format: email }
 *               contactPhone: { type: string }
 *               status: { type: string, enum: [active, disabled] }
 *     responses:
 *       200:
 *         description: Đã cập nhật
 *       403:
 *         description: Không đủ quyền (chỉ admin)
 *       404:
 *         description: Không tìm thấy đối tác
 *       409:
 *         description: contactEmail đã được dùng bởi đối tác khác
 */
router.patch('/:publicId', authenticate, authorize('admin'), validateBody(partnerUpdateSchema), asyncHandler(partnerController.update));

/**
 * @openapi
 * /partners/{publicId}/reset-credentials:
 *   post:
 *     summary: Sinh mật khẩu mới cho tài khoản đối tác và gửi lại qua email liên hệ (dùng khi email lúc tạo tài khoản bị lỗi)
 *     tags: [Partners]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: publicId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Đã sinh mật khẩu mới (emailSent cho biết email gửi có thành công không)
 *       403:
 *         description: Không đủ quyền (chỉ admin)
 *       404:
 *         description: Không tìm thấy đối tác hoặc tài khoản đăng nhập của đối tác
 */
router.post(
  '/:publicId/reset-credentials',
  authenticate,
  authorize('admin'),
  asyncHandler(partnerController.resetCredentials)
);

module.exports = router;
