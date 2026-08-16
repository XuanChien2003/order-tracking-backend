const { Order, OrderEvent } = require('../../domain/models');
const { ORDER_STATUS_DEFAULT } = require('../../domain/constants/enums');
const { mapEventToNormalizedStatus } = require('../utils/statusMapping.util');

// eventType on an import event is the literal 'import', but the order status for that
// state is 'imported' (see orderImport.service.js) - keep both in sync here.
function deriveStatusFromEvent(event) {
  if (event.source === 'webhook_vtp') return event.externalStatus || event.eventType;
  if (event.source === 'import') return ORDER_STATUS_DEFAULT;
  return event.eventType; // scan_pda
}

// Invariant (PROJECT_CONTEXT.md 3.4 #3): currentStatus/currentStatusDate must always
// reflect the most recent orderEvents entry (by eventTime), regardless of arrival order.
//
// Two events for the same order can be processed concurrently (e.g. a webhook and a scan
// landing at nearly the same time). A plain "read latest, then unconditionally write" has a
// race: the slower call's write can land *after* the faster one's and clobber it with stale
// data, even though it read a correct snapshot at the time. The fix is to condition the write
// on the order's currently-stored currentStatusDate at write time (not what was read moments
// earlier) - only advance forward, never backward. The find's sort (eventTime, then receivedAt,
// then _id) makes "latest" deterministic when several events share the same eventTime.
async function refreshOrderCurrentStatus(orderId) {
  const latest = await OrderEvent.findOne({ orderId }).sort({ eventTime: -1, receivedAt: -1, _id: -1 }).lean();
  if (!latest) return;
  const status = deriveStatusFromEvent(latest);
  const normalizedStatus = mapEventToNormalizedStatus(latest);
  await Order.updateOne(
    { _id: orderId, currentStatusDate: { $lt: latest.eventTime } },
    { $set: { currentStatus: status, currentStatusDate: latest.eventTime, normalizedStatus } }
  );
}

module.exports = { refreshOrderCurrentStatus };
