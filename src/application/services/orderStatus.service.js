const { Order, OrderEvent } = require('../../domain/models');
const { ORDER_STATUS_DEFAULT } = require('../../domain/constants/enums');

// eventType on an import event is the literal 'import', but the order status for that
// state is 'imported' (see orderImport.service.js) - keep both in sync here.
function deriveStatusFromEvent(event) {
  if (event.source === 'webhook_vtp') return event.externalStatus || event.eventType;
  if (event.source === 'import') return ORDER_STATUS_DEFAULT;
  return event.eventType; // scan_pda
}

// Invariant (PROJECT_CONTEXT.md 3.4 #3): currentStatus/currentStatusDate must always
// reflect the most recent orderEvents entry (by eventTime), regardless of arrival order.
async function refreshOrderCurrentStatus(orderId) {
  const latest = await OrderEvent.findOne({ orderId }).sort({ eventTime: -1 }).lean();
  if (!latest) return;
  const status = deriveStatusFromEvent(latest);
  await Order.updateOne({ _id: orderId }, { $set: { currentStatus: status, currentStatusDate: latest.eventTime } });
}

module.exports = { refreshOrderCurrentStatus };
