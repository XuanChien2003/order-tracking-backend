const USER_ROLES = ['admin', 'scanner', 'partner'];
const PARTNER_STATUS = ['active', 'disabled'];
const ORDER_EVENT_SOURCE = ['scan_pda', 'webhook_vtp', 'import'];
const SCAN_EVENT_TYPES = ['nhap_kho', 'xuat_kho', 'ban_giao'];
const WEBHOOK_STATUS = ['pending', 'processed', 'failed'];
const ORDER_STATUS_DEFAULT = 'imported';

module.exports = {
  USER_ROLES,
  PARTNER_STATUS,
  ORDER_EVENT_SOURCE,
  SCAN_EVENT_TYPES,
  WEBHOOK_STATUS,
  ORDER_STATUS_DEFAULT,
};
