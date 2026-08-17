const express = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const { validateBody } = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth.middleware');
const { loginLimiter } = require('../middlewares/rateLimit.middleware');
const { loginSchema, changePasswordSchema } = require('../validators/schemas');
const authController = require('../controllers/auth.controller');

const router = express.Router();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Đăng nhập (FR-02) - dùng chung cho admin/partner/scanner
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Đăng nhập thành công, trả JWT (chỉ chứa publicId/role/partnerId)
 *       400:
 *         description: Thiếu username/password
 *       401:
 *         description: Sai tài khoản hoặc mật khẩu
 */
router.post('/login', loginLimiter, validateBody(loginSchema), asyncHandler(authController.login));

/**
 * @openapi
 * /auth/change-password:
 *   post:
 *     summary: Tự đổi mật khẩu (admin/partner/scanner) - cần biết mật khẩu hiện tại
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 description: Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số
 *     responses:
 *       200:
 *         description: Đổi mật khẩu thành công
 *       400:
 *         description: Mật khẩu mới không đủ mạnh
 *       401:
 *         description: Mật khẩu hiện tại không đúng
 */
router.post(
  '/change-password',
  authenticate,
  loginLimiter,
  validateBody(changePasswordSchema),
  asyncHandler(authController.changePassword)
);

module.exports = router;
