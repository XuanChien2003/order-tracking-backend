const express = require('express');
const multer = require('multer');
const asyncHandler = require('../middlewares/asyncHandler');
const { authenticate, authorize, requireActiveAccount } = require('../middlewares/auth.middleware');
const { importLimiter, searchLimiter, printLimiter } = require('../middlewares/rateLimit.middleware');
const orderController = require('../controllers/order.controller');
const AppError = require('../../application/errors/AppError');

const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new AppError('Chỉ chấp nhận file Excel (.xlsx, .xls)', 400));
  },
});

const router = express.Router();

/**
 * @openapi
 * /orders/import:
 *   post:
 *     summary: Import đơn hàng từ file Excel (FR-03, tối đa 500 dòng/lần)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File .xlsx/.xls, cột bắt buộc vtpCode + receiverName
 *               partnerId:
 *                 type: string
 *                 description: Bắt buộc khi role=admin - publicId của đối tác sở hữu các đơn này
 *     responses:
 *       200:
 *         description: Kết quả import theo từng dòng (không dừng khi 1 dòng lỗi)
 *       400:
 *         description: File không hợp lệ / vượt quá 500 dòng / thiếu cột bắt buộc
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không đủ quyền (chỉ partner/admin)
 */
router.post(
  '/import',
  authenticate,
  authorize('partner', 'admin'),
  requireActiveAccount,
  importLimiter,
  upload.single('file'),
  asyncHandler(orderController.importOrders)
);

/**
 * @openapi
 * /orders:
 *   get:
 *     summary: Tra cứu/danh sách đơn hàng (FR-08) - partner chỉ thấy đơn của mình, admin không giới hạn
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema: { type: string }
 *         description: Tìm theo vtpCode, tên hoặc SĐT người nhận
 *       - in: query
 *         name: vtpCode
 *         schema: { type: string }
 *         description: Lọc chính xác theo vtpCode
 *       - in: query
 *         name: receiverPhone
 *         schema: { type: string }
 *       - in: query
 *         name: currentStatus
 *         schema: { type: string }
 *       - in: query
 *         name: partnerId
 *         schema: { type: string }
 *         description: Chỉ admin dùng được - publicId của đối tác cần lọc
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Danh sách đơn hàng có phân trang
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không đủ quyền
 */
router.get('/', authenticate, authorize('admin', 'partner'), searchLimiter, asyncHandler(orderController.list));

/**
 * @openapi
 * /orders/{vtpCode}:
 *   get:
 *     summary: Chi tiết đơn hàng kèm lịch sử sự kiện (FR-08)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vtpCode
 *         required: true
 *         schema: { type: string }
 *         description: Mã VTP của đơn hàng (mã duy nhất - app scan tra cứu bằng chính mã vừa quét, không cần ghi log)
 *     responses:
 *       200:
 *         description: Chi tiết đơn hàng + danh sách orderEvents
 *       401:
 *         description: Chưa đăng nhập
 *       404:
 *         description: Không tìm thấy đơn hàng (hoặc không thuộc quyền xem của partner)
 */
router.get(
  '/:vtpCode',
  authenticate,
  authorize('admin', 'partner', 'scanner'),
  requireActiveAccount,
  asyncHandler(orderController.detail)
);

/**
 * @openapi
 * /orders/{vtpCode}/label:
 *   get:
 *     summary: Xuất nhãn PDF (mã vạch Code128/QR từ vtpCode) cho 1 đơn hàng (FR-04)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vtpCode
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [code128, qr], default: code128 }
 *     responses:
 *       200:
 *         description: File PDF nhãn
 *         content:
 *           application/pdf: {}
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không đủ quyền (chỉ partner/admin)
 *       404:
 *         description: Không tìm thấy đơn hàng
 */
router.get(
  '/:vtpCode/label',
  authenticate,
  authorize('admin', 'partner'),
  requireActiveAccount,
  printLimiter,
  asyncHandler(orderController.label)
);

router.get(
  '/:vtpCode/barcode',
  authenticate,
  authorize('admin', 'partner'),
  requireActiveAccount,
  printLimiter,
  asyncHandler(orderController.barcode)
);

/**
 * @openapi
 * /orders/print-batch:
 *   post:
 *     summary: Xuất nhãn PDF hàng loạt (FR-04)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vtpCodes]
 *             properties:
 *               vtpCodes:
 *                 type: array
 *                 items: { type: string }
 *                 maxItems: 100
 *               format:
 *                 type: string
 *                 enum: [code128, qr]
 *                 default: code128
 *     responses:
 *       200:
 *         description: File PDF gồm nhiều trang nhãn
 *         content:
 *           application/pdf: {}
 *       400:
 *         description: vtpCodes rỗng hoặc vượt quá 100 mã
 *       404:
 *         description: Có mã không tồn tại hoặc không thuộc quyền in
 */
router.post(
  '/print-batch',
  authenticate,
  authorize('admin', 'partner'),
  requireActiveAccount,
  printLimiter,
  asyncHandler(orderController.printBatch)
);

module.exports = router;
