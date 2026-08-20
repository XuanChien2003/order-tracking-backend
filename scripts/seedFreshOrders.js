// One-off helper to (re)populate a freshly-wiped `orders`/`orderEvents` with a clean baseline of
// sample data - dated within the last 7 days so the dashboard's stat cards and "Đơn 7 ngày" chart
// actually show something, spanning the normal status range, matching the CURRENT schema
// (vtpCode only, no internalCode). Attached to an existing partner (passed in below), not a new
// one - this is demo/sample data, not real customer orders.
//
// Usage: node scripts/seedFreshOrders.js   (run from the BE/ directory)

require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const { connectDb } = require('../src/infrastructure/db/mongoose');
const { Order, OrderEvent, Partner, User } = require('../src/domain/models');

const PARTNER_PUBLIC_ID = 'fd54cecb-7c40-4741-9542-e6a18d8cfffe'; // Quy Don

function daysAgo(n, hour = 9, min = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, min, 0, 0);
  return d;
}

function buildOrders() {
  return [
    {
      vtpCode: 'VTP50000001',
      receiverName: 'Nguyễn Minh Anh',
      receiverPhone: '0901112223',
      receiverAddress: 'Số 12 Láng Hạ, Đống Đa, Hà Nội',
      productInfo: 'Áo khoác',
      weightKg: 0.8,
      serviceName: 'VCN',
      cod: 350000,
      shippingFee: 22000,
      vat: 2200,
      totalAmount: 372000,
      currentStatus: 'Chờ XL',
      currentStatusDate: daysAgo(0, 8, 30),
    },
    {
      vtpCode: 'VTP50000002',
      receiverName: 'Trần Bảo Ngọc',
      receiverPhone: '0912223334',
      receiverAddress: '45 Nguyễn Trãi, Thanh Xuân, Hà Nội',
      productInfo: 'Sách giáo khoa',
      weightKg: 1.5,
      serviceName: 'VHT',
      cod: 0,
      shippingFee: 18000,
      vat: 1800,
      totalAmount: 19800,
      currentStatus: 'Đang VC',
      currentStatusDate: daysAgo(1, 14, 10),
    },
    {
      vtpCode: 'VTP50000003',
      receiverName: 'Lê Hoàng Phúc',
      receiverPhone: '0923334445',
      receiverAddress: '78 Trần Phú, Hải Châu, Đà Nẵng',
      productInfo: 'Balo laptop',
      weightKg: 1.1,
      serviceName: 'VHT - Phát hỏa tốc',
      cod: 590000,
      shippingFee: 45000,
      vat: 4500,
      totalAmount: 639500,
      currentStatus: 'Đang phát',
      currentStatusDate: daysAgo(2, 9, 45),
    },
    {
      vtpCode: 'VTP50000004',
      receiverName: 'Phạm Thu Trang',
      receiverPhone: '0934445556',
      receiverAddress: '23 Nguyễn Huệ, Quận 1, TP HCM',
      productInfo: 'Mỹ phẩm',
      weightKg: 0.5,
      serviceName: 'VCN',
      cod: 0,
      shippingFee: 20000,
      vat: 2000,
      totalAmount: 22000,
      currentStatus: 'Đã giao',
      currentStatusDate: daysAgo(3, 16, 20),
    },
    {
      vtpCode: 'VTP50000005',
      receiverName: 'Vũ Đình Khôi',
      receiverPhone: '0945556667',
      receiverAddress: '9 Lê Lợi, Ninh Kiều, Cần Thơ',
      productInfo: 'Đồ chơi trẻ em',
      weightKg: 2.0,
      serviceName: 'VHT',
      cod: 250000,
      shippingFee: 30000,
      vat: 3000,
      totalAmount: 283000,
      currentStatus: 'Hoàn',
      currentStatusDate: daysAgo(4, 11, 0),
    },
    {
      vtpCode: 'VTP50000006',
      receiverName: 'Đặng Gia Hân',
      receiverPhone: '0956667778',
      receiverAddress: '156 Trần Hưng Đạo, Hồng Bàng, Hải Phòng',
      productInfo: 'Phụ kiện điện thoại',
      weightKg: 0.3,
      serviceName: 'VCN',
      cod: 120000,
      shippingFee: 15000,
      vat: 1500,
      totalAmount: 136500,
      currentStatus: 'Đang VC',
      currentStatusDate: daysAgo(5, 10, 15),
    },
    {
      vtpCode: 'VTP50000007',
      receiverName: 'Bùi Anh Tuấn',
      receiverPhone: '0967778889',
      receiverAddress: '34 Ngô Quyền, Bắc Ninh',
      productInfo: 'Linh kiện máy tính',
      weightKg: 3.2,
      serviceName: 'VHT - Phát hỏa tốc',
      cod: 0,
      shippingFee: 55000,
      vat: 5500,
      totalAmount: 60500,
      currentStatus: 'Chờ XL',
      currentStatusDate: daysAgo(6, 13, 40),
    },
    {
      vtpCode: 'VTP50000008',
      receiverName: 'Ngô Thảo Vy',
      receiverPhone: '0978889990',
      receiverAddress: '67 Hoàng Diệu, Hạ Long, Quảng Ninh',
      productInfo: 'Quần áo trẻ em',
      weightKg: 0.9,
      serviceName: 'VCN',
      cod: 180000,
      shippingFee: 25000,
      vat: 2500,
      totalAmount: 207500,
      currentStatus: 'Đã giao',
      currentStatusDate: daysAgo(0, 15, 5),
    },
  ];
}

async function main() {
  await connectDb();

  const partner = await Partner.findOne({ publicId: PARTNER_PUBLIC_ID });
  if (!partner) {
    throw new Error(`Partner ${PARTNER_PUBLIC_ID} not found - aborting so nothing gets attached to the wrong partner`);
  }
  console.log(`[seed-fresh] Gắn đơn mẫu vào đối tác: ${partner.companyName} (${partner.publicId})`);

  const scanner = await User.findOne({ username: 'nguyenxuanchienbk234@gmail.com' });

  let createdCount = 0;
  for (const item of buildOrders()) {
    const existing = await Order.findOne({ vtpCode: item.vtpCode });
    if (existing) {
      console.log(`[seed-fresh] Bỏ qua ${item.vtpCode} (đã tồn tại)`);
      continue;
    }
    const order = await Order.create({ ...item, partnerId: partner._id });
    createdCount += 1;
    console.log(`[seed-fresh] Đã tạo đơn: ${item.vtpCode} - ${item.currentStatus}`);

    // Give the two "Đang VC" orders a short import + webhook history for a realistic timeline.
    if (item.vtpCode === 'VTP50000002' || item.vtpCode === 'VTP50000006') {
      const importedAt = new Date(item.currentStatusDate.getTime() - 3 * 60 * 60 * 1000);
      try {
        await OrderEvent.create({
          orderId: order._id,
          source: 'import',
          eventType: 'import',
          rawPayload: null,
          contentHash: crypto.createHash('sha256').update(`fresh-import:${item.vtpCode}`).digest('hex'),
          eventTime: importedAt,
          receivedAt: importedAt,
        });
        await OrderEvent.create({
          orderId: order._id,
          source: 'webhook_vtp',
          eventType: item.currentStatus,
          externalStatus: item.currentStatus,
          location: 'HNI - Hà Nội',
          eventTime: item.currentStatusDate,
          receivedAt: item.currentStatusDate,
          contentHash: crypto.createHash('sha256').update(`fresh-webhook:${item.vtpCode}`).digest('hex'),
        });
      } catch (e) {
        console.error(`[seed-fresh] Lỗi tạo sự kiện cho ${item.vtpCode}: ${e.message}`);
      }
    }

    // VTP50000006 also gets a real nhap_kho/xuat_kho scan trail from an actual scanner account.
    if (item.vtpCode === 'VTP50000006' && scanner) {
      try {
        await OrderEvent.create({
          orderId: order._id,
          source: 'scan_pda',
          eventType: 'nhap_kho',
          actorUserId: scanner._id,
          eventTime: daysAgo(6, 8, 0),
          receivedAt: daysAgo(6, 8, 0),
          contentHash: crypto.createHash('sha256').update(`fresh-scan-nhap:${item.vtpCode}`).digest('hex'),
        });
        await OrderEvent.create({
          orderId: order._id,
          source: 'scan_pda',
          eventType: 'xuat_kho',
          actorUserId: scanner._id,
          eventTime: daysAgo(5, 17, 0),
          receivedAt: daysAgo(5, 17, 0),
          contentHash: crypto.createHash('sha256').update(`fresh-scan-xuat:${item.vtpCode}`).digest('hex'),
        });
      } catch (e) {
        console.error(`[seed-fresh] Lỗi tạo sự kiện quét cho ${item.vtpCode}: ${e.message}`);
      }
    }
  }

  console.log(`\n[seed-fresh] Hoàn tất. Đã tạo ${createdCount} đơn mẫu mới.`);
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[seed-fresh] Lỗi:', err);
    process.exit(1);
  });
}

module.exports = { main };
