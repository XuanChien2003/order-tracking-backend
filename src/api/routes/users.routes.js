const express = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const { validateBody } = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { createUserSchema } = require('../validators/schemas');
const userController = require('../controllers/user.controller');

const router = express.Router();

/**
 * @openapi
 * /users:
 *   post:
 *     summary: Tạo tài khoản admin/scanner (chỉ admin) - tài khoản partner phải qua /partners/register
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password, displayName, role]
 *             properties:
 *               username: { type: string }
 *               password: { type: string, minLength: 8 }
 *               displayName: { type: string }
 *               role: { type: string, enum: [admin, scanner] }
 *     responses:
 *       201:
 *         description: Tạo tài khoản thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       403:
 *         description: Không đủ quyền (chỉ admin)
 *       409:
 *         description: username đã tồn tại
 *   get:
 *     summary: Danh sách tài khoản admin/scanner (chỉ admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách tài khoản
 *       403:
 *         description: Không đủ quyền (chỉ admin)
 */
router.post('/', authenticate, authorize('admin'), validateBody(createUserSchema), asyncHandler(userController.create));
router.get('/', authenticate, authorize('admin'), asyncHandler(userController.list));

module.exports = router;
