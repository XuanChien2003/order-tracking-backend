const SCAN_EVENT_TO_NORMALIZED = {
  nhap_kho: 'WAREHOUSE_RECEIVED',
  xuat_kho: 'WAREHOUSE_DISPATCHED',
  ban_giao: 'HANDED_OVER',
};

// Keyword rules, checked in order - mirrors the categories the FE badge logic already
// recognizes (getStatusBadgeInfo in OrdersListPage.jsx), just centralized here as the one place
// that decides meaning. Falls back to UNKNOWN rather than guessing, so a genuinely new VTP
// status string never gets silently misfiled into an existing bucket.
const VTP_STATUS_RULES = [
  { normalized: 'DELIVERED', keywords: ['đã giao', 'da giao', 'giao thành công', 'giao thanh cong'] },
  { normalized: 'DELIVERY_FAILED', keywords: ['giao không thành công', 'giao khong thanh cong', 'thất bại', 'that bai'] },
  { normalized: 'OUT_FOR_DELIVERY', keywords: ['đang phát', 'dang phat'] },
  { normalized: 'RETURNING', keywords: ['đang hoàn', 'dang hoan'] },
  { normalized: 'RETURNED', keywords: ['đã hoàn', 'da hoan', 'hoàn thành', 'hoan thanh'] },
  { normalized: 'CANCELLED', keywords: ['hủy', 'huy'] },
  { normalized: 'IN_TRANSIT', keywords: ['đang vc', 'vận chuyển', 'van chuyen'] },
  { normalized: 'WAREHOUSE_DISPATCHED', keywords: ['xuất kho', 'xuat kho'] },
  {
    normalized: 'WAREHOUSE_RECEIVED',
    keywords: ['nhập kho', 'nhap kho', 'tiếp nhận', 'tiep nhan', 'điều phối', 'dieu phoi', 'bưu cục', 'buu cuc', 'bưu tá', 'buu ta'],
  },
  { normalized: 'HANDED_OVER', keywords: ['bàn giao', 'ban giao'] },
];

function normalizeVtpStatusText(text) {
  if (!text) return 'UNKNOWN';
  const s = String(text).toLowerCase();
  const rule = VTP_STATUS_RULES.find((r) => r.keywords.some((k) => s.includes(k)));
  return rule ? rule.normalized : 'UNKNOWN';
}

// Given an orderEvent-shaped object ({ source, eventType, externalStatus }), returns its
// normalized internal status. Never touches the original text/code elsewhere (currentStatus,
// externalStatus, rawPayload) - this is purely a derived, stable classification.
function mapEventToNormalizedStatus(event) {
  if (event.source === 'import') return 'IMPORTED';
  if (event.source === 'scan_pda') return SCAN_EVENT_TO_NORMALIZED[event.eventType] || 'UNKNOWN';
  if (event.source === 'webhook_vtp') return normalizeVtpStatusText(event.externalStatus || event.eventType);
  return 'UNKNOWN';
}

module.exports = { mapEventToNormalizedStatus, normalizeVtpStatusText };
