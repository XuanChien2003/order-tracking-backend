const express = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const { validateBody } = require('../middlewares/validate');
const { loginLimiter } = require('../middlewares/rateLimit.middleware');
const { loginSchema } = require('../validators/schemas');
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

module.exports = router;
