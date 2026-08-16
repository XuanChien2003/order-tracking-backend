const mongoose = require('mongoose');
const { ORDER_STATUS_DEFAULT, ORDER_STATUS_NORMALIZED } = require('../constants/enums');

const orderSchema = new mongoose.Schema(
  {
    internalCode: { type: String, required: true, unique: true },
    vtpCode: { type: String, required: true, unique: true },
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true },
    receiverName: { type: String, required: true },
    receiverPhone: { type: String, default: null },
    receiverAddress: { type: String, default: null },
    productInfo: { type: String, default: null },
    weightKg: { type: Number, default: null, min: 0 },
    serviceName: { type: String, default: 'VHT - Phát hỏa tốc' },
    cod: { type: Number, default: 0 },
    shippingFee: { type: Number, default: 0 },
    vat: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    paymentType: { type: String, default: 'Người gửi trả' },
    actorName: { type: String, default: null },
    actorPhone: { type: String, default: null },
    currentStatus: { type: String, required: true, default: ORDER_STATUS_DEFAULT },
    currentStatusDate: { type: Date, required: true },
    // Additive alongside currentStatus (free-text display) - a stable code for dashboards/filters
    // to key off instead of matching Vietnamese text. See statusMapping.util.js.
    normalizedStatus: { type: String, enum: ORDER_STATUS_NORMALIZED, default: 'IMPORTED' },
    version: { type: Number, default: 0 },
  },
  { timestamps: true }
);

orderSchema.index({ partnerId: 1, currentStatus: 1, currentStatusDate: -1 });
orderSchema.index(
  { partnerId: 1, receiverPhone: 1 },
  { partialFilterExpression: { receiverPhone: { $type: 'string' } } }
);
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema, 'orders');
