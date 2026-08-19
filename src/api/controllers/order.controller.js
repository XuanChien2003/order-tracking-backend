const orderImportService = require('../../application/services/orderImport.service');
const orderService = require('../../application/services/order.service');
const labelService = require('../../application/services/label.service');
const { Partner, User } = require('../../domain/models');
const AppError = require('../../application/errors/AppError');

async function resolvePartnerObjectId(req) {
  if (req.user.role === 'partner') {
    if (!req.user.partnerId) {
      throw new AppError('Tài khoản partner không hợp lệ', 403);
    }
    const partner = await Partner.findOne({ publicId: req.user.partnerId }).select('_id').lean();
    if (!partner) {
      throw new AppError('Không tìm thấy đối tác', 404);
    }
    return partner._id;
  }

  // admin: must specify which partner these orders belong to
  const { partnerId } = req.body;
  if (!partnerId) {
    throw new AppError('Admin phải cung cấp partnerId (publicId của đối tác)', 400);
  }
  const partner = await Partner.findOne({ publicId: partnerId }).select('_id').lean();
  if (!partner) {
    throw new AppError('Không tìm thấy đối tác', 404);
  }
  return partner._id;
}

async function importOrders(req, res) {
  if (!req.file) {
    throw new AppError('Thiếu file Excel (field "file")', 400);
  }

  const partnerObjectId = await resolvePartnerObjectId(req);

  const actorUser = await User.findOne({ publicId: req.user.publicId }).select('_id').lean();
  if (!actorUser) {
    throw new AppError('Không xác định được người thực hiện', 401);
  }

  const summary = await orderImportService.importOrdersFromExcel({
    fileBuffer: req.file.buffer,
    partnerObjectId,
    actorUserObjectId: actorUser._id,
  });

  res.status(200).json(summary);
}

async function list(req, res) {
  const result = await orderService.listOrders({ requester: req.user, query: req.query });
  res.json(result);
}

async function detail(req, res) {
  const result = await orderService.getOrderDetail({ requester: req.user, vtpCode: req.params.vtpCode });
  res.json(result);
}

async function label(req, res) {
  const format = req.query.format === 'qr' ? 'qr' : 'code128';
  await labelService.streamSingleLabelPdf({ requester: req.user, vtpCode: req.params.vtpCode, format, res });
}

async function barcode(req, res) {
  const format = req.query.format === 'qr' ? 'qr' : 'code128';
  const barcodePng = await labelService.getSingleLabelBarcode({ requester: req.user, vtpCode: req.params.vtpCode, format });
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.send(barcodePng);
}

async function printBatch(req, res) {
  const format = req.body.format === 'qr' ? 'qr' : 'code128';
  await labelService.streamBatchLabelPdf({ requester: req.user, vtpCodes: req.body.vtpCodes, format, res });
}

module.exports = { importOrders, list, detail, label, barcode, printBatch };
