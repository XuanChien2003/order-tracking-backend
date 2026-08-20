const mongoose = require('mongoose');
const { ORDER_EVENT_SOURCE, SCAN_EVENT_TYPES } = require('../constants/enums');

const orderEventSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    source: { type: String, enum: ORDER_EVENT_SOURCE, required: true },
    eventType: { type: String, required: true },
    location: { type: String, default: null },
    note: { type: String, default: null },
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rawPayload: { type: mongoose.Schema.Types.Mixed, default: null },
    contentHash: { type: String, required: true, unique: true, match: /^[0-9a-f]{64}$/ },
    requestId: { type: String, default: null },
    providerEventId: { type: String, default: null },
    externalStatus: { type: String, default: null },
    eventTime: { type: Date, required: true },
    receivedAt: { type: Date, required: true },
  },
  { timestamps: false }
);

orderEventSchema.pre('validate', function enforceEventInvariants(next) {
  if (this.source === 'scan_pda' && !SCAN_EVENT_TYPES.includes(this.eventType)) {
    next(new Error(`eventType must be one of ${SCAN_EVENT_TYPES.join(', ')} when source is scan_pda`));
    return;
  }
  if (this.source === 'webhook_vtp' && this.actorUserId) {
    next(new Error('actorUserId must be null when source is webhook_vtp'));
    return;
  }
  if (this.eventTime && this.eventTime.getTime() > Date.now()) {
    next(new Error('eventTime cannot be in the future'));
    return;
  }
  next();
});

// orderEvents is append-only (NFR-03): block any update/delete at the model layer.
const forbidMutation = function forbidMutation() {
  throw new Error('orderEvents is append-only: update/delete operations are not allowed');
};
['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndDelete', 'deleteOne', 'deleteMany'].forEach(
  (method) => {
    orderEventSchema.pre(method, forbidMutation);
  }
);

orderEventSchema.index({ orderId: 1, eventTime: -1 });
// One warehouse account only ever gets one saved nhap_kho/xuat_kho/ban_giao per order - a
// network failure + retry (or a duplicate manual/scan entry) must land on the same record, not
// create a second one. See scan.service.js recordScan.
orderEventSchema.index(
  { orderId: 1, eventType: 1, actorUserId: 1 },
  { unique: true, partialFilterExpression: { source: 'scan_pda' } }
);
// Scoped to actorUserId (not just source) - a requestId is only meaningful as "this device's
// retry of its own request"; two different scanners coincidentally generating the same requestId
// should never collide with each other.
orderEventSchema.index(
  { actorUserId: 1, requestId: 1 },
  { unique: true, partialFilterExpression: { source: 'scan_pda', requestId: { $type: 'string' } } }
);
orderEventSchema.index(
  { providerEventId: 1 },
  { unique: true, partialFilterExpression: { providerEventId: { $type: 'string' } } }
);
orderEventSchema.index(
  { actorUserId: 1, source: 1, eventTime: -1 },
  { partialFilterExpression: { actorUserId: { $type: 'objectId' } } }
);

module.exports = mongoose.model('OrderEvent', orderEventSchema, 'orderEvents');
