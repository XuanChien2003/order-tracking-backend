const mongoose = require('mongoose');
const { ORDER_STATUS_DEFAULT } = require('../constants/enums');

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
    currentStatus: { type: String, required: true, default: ORDER_STATUS_DEFAULT },
    currentStatusDate: { type: Date, required: true },
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
