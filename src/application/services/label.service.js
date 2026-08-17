const path = require('path');
const bwipjs = require('bwip-js');
const PDFDocument = require('pdfkit');
const { Order, Partner } = require('../../domain/models');
const AppError = require('../errors/AppError');

const LABEL_SIZE = [288, 432]; // ~4x6 inch, points
const MAX_BATCH_SIZE = 100;

// PDFKit's built-in fonts (Helvetica etc.) only cover WinAnsi - Vietnamese diacritics render as
// missing glyphs/boxes. Inter has full Vietnamese coverage, so every label embeds it explicitly.
// Registered once per document (registerFont parses the 876KB font file - doing that per page
// would be wasteful on a 100-label batch); drawLabel just switches to it by name per page.
const VN_FONT_PATH = path.join(__dirname, '../../assets/fonts/Inter-Variable.ttf');
const VN_FONT_NAME = 'Inter-VN';

function registerVietnameseFont(doc) {
  doc.registerFont(VN_FONT_NAME, VN_FONT_PATH);
  doc.font(VN_FONT_NAME);
}

async function generateBarcodePng(text, format) {
  const isQr = format === 'qr';
  const options = {
    bcid: isQr ? 'qrcode' : 'code128',
    text,
    scale: 3,
    includetext: !isQr,
    textxalign: 'center',
  };
  if (!isQr) {
    options.height = 10;
  }
  return bwipjs.toBuffer(options);
}

function drawLabel(doc, order, barcodePng) {
  doc.font(VN_FONT_NAME);
  doc.fontSize(14).text('PHIẾU GIAO HÀNG', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10);
  doc.text(`Mã đơn: ${order.internalCode}`);
  doc.text(`Mã VTP: ${order.vtpCode}`);
  doc.text(`Người nhận: ${order.receiverName}`);
  if (order.receiverPhone) doc.text(`SĐT: ${order.receiverPhone}`);
  if (order.receiverAddress) doc.text(`Địa chỉ: ${order.receiverAddress}`);
  if (order.productInfo) doc.text(`Hàng hóa: ${order.productInfo}`);
  if (order.weightKg !== null && order.weightKg !== undefined) doc.text(`Khối lượng: ${order.weightKg} kg`);
  // Reserve a fixed area near the bottom of every label for the barcode.
  // It must not follow the text cursor because long order details can push
  // the image beyond the visible/printable page area.
  const barcodeX = 20;
  const barcodeY = 292;
  const barcodeWidth = 248;
  const barcodeHeight = 104;
  doc.save();
  doc.lineWidth(0.5).strokeColor('#C9CED8').rect(barcodeX, barcodeY - 18, barcodeWidth, barcodeHeight + 24).stroke();
  doc.fillColor('#334155').fontSize(8).text('SCAN BARCODE', barcodeX, barcodeY - 14, { width: barcodeWidth, align: 'center' });
  doc.image(barcodePng, barcodeX, barcodeY, {
    fit: [barcodeWidth, barcodeHeight],
    align: 'center',
    valign: 'center',
  });
  doc.restore();
}

// Same ownership rule as FR-08 order detail: partner only prints its own orders.
async function findOrderForRequester({ requester, internalCode }) {
  const order = await Order.findOne({ internalCode }).lean();
  if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
  if (requester.role === 'partner') {
    const partner = await Partner.findOne({ publicId: requester.partnerId }).select('_id').lean();
    if (!partner || String(order.partnerId) !== String(partner._id)) {
      throw new AppError('Không tìm thấy đơn hàng', 404);
    }
  }
  return order;
}

// FR-04: barcode/QR from vtpCode + PDF label. Streams directly to res to avoid buffering the whole PDF in memory.
async function streamSingleLabelPdf({ requester, internalCode, format, res }) {
  const order = await findOrderForRequester({ requester, internalCode });
  const barcodePng = await generateBarcodePng(order.vtpCode, format);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${order.internalCode}.pdf"`);

  const doc = new PDFDocument({ size: LABEL_SIZE, margin: 20 });
  doc.pipe(res);
  registerVietnameseFont(doc);
  drawLabel(doc, order, barcodePng);
  doc.end();
}

async function streamBatchLabelPdf({ requester, internalCodes, format, res }) {
  if (!Array.isArray(internalCodes) || internalCodes.length === 0) {
    throw new AppError('internalCodes phải là mảng và không được rỗng', 400);
  }
  if (internalCodes.length > MAX_BATCH_SIZE) {
    throw new AppError(`Chỉ hỗ trợ tối đa ${MAX_BATCH_SIZE} nhãn/lần in`, 400);
  }

  const orders = [];
  const notFound = [];
  for (const internalCode of internalCodes) {
    try {
      // eslint-disable-next-line no-await-in-loop
      orders.push(await findOrderForRequester({ requester, internalCode }));
    } catch (err) {
      notFound.push(internalCode);
    }
  }
  if (notFound.length > 0) {
    throw new AppError(`Không tìm thấy hoặc không có quyền in đơn: ${notFound.join(', ')}`, 404);
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="labels-batch.pdf"');

  const doc = new PDFDocument({ size: LABEL_SIZE, margin: 20, autoFirstPage: false });
  doc.pipe(res);
  registerVietnameseFont(doc);
  for (const order of orders) {
    // eslint-disable-next-line no-await-in-loop
    const barcodePng = await generateBarcodePng(order.vtpCode, format);
    doc.addPage();
    drawLabel(doc, order, barcodePng);
  }
  doc.end();
}

module.exports = { streamSingleLabelPdf, streamBatchLabelPdf };
