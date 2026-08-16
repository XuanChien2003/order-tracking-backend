const USER_ROLES = ['admin', 'scanner', 'partner'];
const PARTNER_STATUS = ['active', 'disabled'];
const ORDER_EVENT_SOURCE = ['scan_pda', 'webhook_vtp', 'import'];
const SCAN_EVENT_TYPES = ['nhap_kho', 'xuat_kho', 'ban_giao'];
const WEBHOOK_STATUS = ['pending', 'processed', 'failed'];
const ORDER_STATUS_DEFAULT = 'imported';

// Fixed internal status set (list_các_lỗi_cần_sửa.md #4). currentStatus stays the free-text
// display string (VTP's own wording, or the scan eventType) so nothing that already reads it
// breaks; normalizedStatus is an additive field carrying one of these stable codes, meant for
// future dashboard/filter logic that shouldn't have to regex-match Vietnamese status text.
const ORDER_STATUS_NORMALIZED = [
  'IMPORTED',
  'WAREHOUSE_RECEIVED',
  'WAREHOUSE_DISPATCHED',
  'HANDED_OVER',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'DELIVERY_FAILED',
  'RETURNING',
  'RETURNED',
  'CANCELLED',
  'UNKNOWN',
];

module.exports = {
  USER_ROLES,
  PARTNER_STATUS,
  ORDER_EVENT_SOURCE,
  SCAN_EVENT_TYPES,
  WEBHOOK_STATUS,
  ORDER_STATUS_DEFAULT,
  ORDER_STATUS_NORMALIZED,
};
