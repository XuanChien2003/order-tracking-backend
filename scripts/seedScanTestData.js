// One-off helper to populate the (real, shared) database with clearly-tagged test data for
// exercising the new scan-history / geofence / dashboard-by-employee features end to end:
// 2 test scanner accounts, 1 test partner, 5 test orders, and a spread of scan_pda events
// (nhap_kho/xuat_kho/ban_giao/tra_cuu) across both scanners over the last few days.
//
// Everything this script creates is prefixed "TEST" (usernames, order codes, partner name) so
// it's easy to find and delete later without touching real data. Safe to re-run - it looks up
// existing TEST records by their unique keys instead of duplicating them.
//
// Usage: node scripts/seedScanTestData.js   (run from the BE/ directory)

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDb } = require('../src/infrastructure/db/mongoose');
const { User, Partner, Order } = require('../src/domain/models');
const userService = require('../src/application/services/user.service');
const scanService = require('../src/application/services/scan.service');
const env = require('../src/infrastructure/config/env');

const TEST_SCANNER_PASSWORD = 'Test@12345';

const TEST_SCANNERS = [
  { username: 'test_scanner1', displayName: 'TEST - Nhân viên kho A' },
  { username: 'test_scanner2', displayName: 'TEST - Nhân viên kho B' },
];

const TEST_PARTNER = {
  publicId: 'TEST-PARTNER01',
  companyName: 'TEST - Đối tác Demo',
  contactEmail: 'test-partner-demo@example.com',
  contactPhone: '0900000000',
  status: 'active',
};

const TEST_ORDERS = [1, 2, 3, 4, 5].map((n) => ({
  internalCode: `TEST-000${n}`,
  vtpCode: `TESTVTP000${n}`,
  receiverName: `TEST Khách hàng ${n}`,
  receiverPhone: `090000000${n}`,
  receiverAddress: 'Hà Nội (dữ liệu test)',
  productInfo: 'Hàng test seed',
  weightKg: 1,
  cod: n % 2 === 0 ? 100000 : 0,
  currentStatusDate: new Date(),
}));

function daysAgo(n, hour = 9) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function ensureScanners() {
  const created = [];
  for (const s of TEST_SCANNERS) {
    let user = await User.findOne({ username: s.username });
    if (!user) {
      user = await userService.createUser({
        username: s.username,
        password: TEST_SCANNER_PASSWORD,
        displayName: s.displayName,
        role: 'scanner',
      });
      console.log(`[seed-test] Đã tạo tài khoản scanner: ${s.username} / ${TEST_SCANNER_PASSWORD}`);
    } else {
      console.log(`[seed-test] Tài khoản scanner đã tồn tại: ${s.username}`);
    }
    created.push(user);
  }
  return created;
}

async function ensurePartner() {
  let partner = await Partner.findOne({ publicId: TEST_PARTNER.publicId });
  if (!partner) {
    partner = await Partner.create(TEST_PARTNER);
    console.log(`[seed-test] Đã tạo partner test: ${TEST_PARTNER.companyName}`);
  }
  return partner;
}

async function ensureOrders(partner) {
  const orders = [];
  for (const o of TEST_ORDERS) {
    let order = await Order.findOne({ internalCode: o.internalCode });
    if (!order) {
      order = await Order.create({ ...o, partnerId: partner._id, currentStatus: 'imported' });
      console.log(`[seed-test] Đã tạo đơn test: ${o.internalCode}`);
    }
    orders.push(order);
  }
  return orders;
}

async function seedScanEvents(orders, scanners) {
  const [scannerA, scannerB] = scanners;
  // (order index, actor, eventType, days ago, needs GPS)
  const plan = [
    [0, scannerA, 'nhap_kho', 4],
    [0, scannerA, 'xuat_kho', 3],
    [0, scannerB, 'tra_cuu', 1],
    [1, scannerA, 'nhap_kho', 4],
    [1, scannerB, 'xuat_kho', 2],
    [1, scannerB, 'ban_giao', 1],
    [2, scannerB, 'nhap_kho', 3],
    [2, scannerA, 'xuat_kho', 2],
    [2, scannerA, 'ban_giao', 0],
    [3, scannerA, 'nhap_kho', 2],
    [3, scannerB, 'nhap_kho', 2],
    [3, scannerB, 'tra_cuu', 0],
    [4, scannerB, 'nhap_kho', 1],
    [4, scannerA, 'xuat_kho', 1],
    [4, scannerA, 'ban_giao', 0],
  ];

  let createdCount = 0;
  for (const [orderIdx, actor, eventType, daysBack] of plan) {
    const order = orders[orderIdx];
    const needsGps = eventType === 'nhap_kho' || eventType === 'xuat_kho';
    try {
      const result = await scanService.recordScan({
        vtpCode: order.vtpCode,
        eventType,
        eventTime: daysAgo(daysBack, 8 + (orderIdx % 8)).toISOString(),
        requestId: `seed-test-${order.internalCode}-${eventType}-${daysBack}-${actor.username}`,
        actorUserObjectId: actor._id,
        lat: needsGps ? env.warehouseLat : undefined,
        lng: needsGps ? env.warehouseLng : undefined,
      });
      if (!result.idempotent) createdCount += 1;
    } catch (err) {
      console.error(`[seed-test] Bỏ qua 1 sự kiện (${order.internalCode}/${eventType}): ${err.message}`);
    }
  }
  console.log(`[seed-test] Đã ghi ${createdCount} sự kiện quét mới.`);
}

async function main() {
  await connectDb();
  const scanners = await ensureScanners();
  const partner = await ensurePartner();
  const orders = await ensureOrders(partner);
  await seedScanEvents(orders, scanners);
  await mongoose.disconnect();

  console.log('\n[seed-test] Hoàn tất. Đăng nhập test trên App/Web Admin bằng:');
  for (const s of TEST_SCANNERS) {
    console.log(`  - ${s.username} / ${TEST_SCANNER_PASSWORD}`);
  }
  console.log(`  Mã đơn test: ${TEST_ORDERS.map((o) => o.internalCode).join(', ')}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[seed-test] Lỗi:', err);
    process.exit(1);
  });
}

module.exports = { main };
