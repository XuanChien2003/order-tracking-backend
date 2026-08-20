const crypto = require('crypto');
const { User, Partner, Order, OrderEvent } = require('../../domain/models');
const { hashPassword } = require('../../application/services/password.service');
const { generatePublicId } = require('../../application/utils/publicId.util');

// No hardcoded fallback passwords - a default like 'Admin@12345' baked into source would end up
// valid on every environment that forgets to override it, including by accident in production.
function seedAccounts() {
  const required = ['SEED_ADMIN_PASSWORD', 'SEED_SCANNER_PASSWORD'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`ENABLE_AUTO_SEED=true but missing env vars: ${missing.join(', ')}`);
  }
  return [
    {
      username: process.env.SEED_ADMIN_USERNAME || 'admin',
      role: 'admin',
      displayName: 'Quản trị hệ thống',
      password: process.env.SEED_ADMIN_PASSWORD,
    },
    {
      username: process.env.SEED_SCANNER_USERNAME || 'scanner1',
      role: 'scanner',
      displayName: 'Nhân viên quét kho',
      password: process.env.SEED_SCANNER_PASSWORD,
    },
  ];
}

const SAMPLE_ORDERS = [
  {
    vtpCode: 'VTP3024822',
    receiverName: 'Nguyễn Văn A',
    receiverPhone: '0901234567',
    receiverAddress: 'Hà Nội',
    productInfo: 'Quần áo',
    weightKg: 1.2,
    serviceName: 'VHT',
    cod: 0,
    shippingFee: 25000,
    vat: 2500,
    totalAmount: 27500,
    paymentType: 'Người gửi trả',
    currentStatus: 'Đang VC',
    currentStatusDate: new Date('2025-11-10T11:07:00'),
  },
  {
    vtpCode: 'VTP3024823',
    receiverName: 'Trần Thị B',
    receiverPhone: '0912345678',
    receiverAddress: 'Đà Nẵng',
    productInfo: 'Giày thể thao',
    weightKg: 2.5,
    serviceName: 'VCN',
    cod: 150000,
    shippingFee: 35000,
    vat: 3500,
    totalAmount: 188500,
    paymentType: 'Người gửi trả',
    currentStatus: 'Đã giao',
    currentStatusDate: new Date('2025-11-09T15:30:00'),
  },
  {
    vtpCode: 'VTP3024824',
    receiverName: 'Lê Văn C',
    receiverPhone: '0923456789',
    receiverAddress: 'TP HCM',
    productInfo: 'Đồng hồ',
    weightKg: 0.8,
    serviceName: 'VHT',
    cod: 0,
    shippingFee: 20000,
    vat: 2000,
    totalAmount: 22000,
    paymentType: 'Người gửi trả',
    currentStatus: 'Đang phát',
    currentStatusDate: new Date('2025-11-09T08:20:00'),
  },
  {
    vtpCode: 'VTP3024825',
    receiverName: 'Phạm Thị D',
    receiverPhone: '0934567890',
    receiverAddress: 'Cần Thơ',
    productInfo: 'Mỹ phẩm',
    weightKg: 3.1,
    serviceName: 'VCN',
    cod: 200000,
    shippingFee: 40000,
    vat: 4000,
    totalAmount: 244000,
    paymentType: 'Người gửi trả',
    currentStatus: 'Chờ XL',
    currentStatusDate: new Date('2025-11-08T16:45:00'),
  },
  {
    vtpCode: 'VTP3024826',
    receiverName: 'Hoàng Văn E',
    receiverPhone: '0945678901',
    receiverAddress: 'Hải Phòng',
    productInfo: 'Phụ kiện',
    weightKg: 1.5,
    serviceName: 'VHT',
    cod: 0,
    shippingFee: 28000,
    vat: 2800,
    totalAmount: 30800,
    paymentType: 'Người gửi trả',
    currentStatus: 'Đang VC',
    currentStatusDate: new Date('2025-11-08T10:10:00'),
  },
  {
    vtpCode: 'VTP3024827',
    receiverName: 'Đỗ Thị F',
    receiverPhone: '0956789012',
    receiverAddress: 'Bắc Ninh',
    productInfo: 'Sách vở',
    weightKg: 0.5,
    serviceName: 'VCN',
    cod: 50000,
    shippingFee: 15000,
    vat: 1500,
    totalAmount: 66500,
    paymentType: 'Người gửi trả',
    currentStatus: 'Hoàn',
    currentStatusDate: new Date('2025-11-07T09:30:00'),
  },
  {
    vtpCode: 'VTP3024822076',
    receiverName: 'Nguyễn Cường',
    receiverPhone: '0334128111',
    receiverAddress: 'Gia Lâm, Hà Nội',
    productInfo: 'Linh kiện điện tử',
    weightKg: 7.1,
    serviceName: 'VHT - Phát hỏa tốc',
    cod: 0,
    shippingFee: 236115,
    vat: 19769,
    totalAmount: 266884,
    paymentType: 'Người gửi trả',
    currentStatus: 'Giao bưu tá đi nhận',
    currentStatusDate: new Date('2025-11-10T11:07:00'),
  },
];

// Only ever called from server.js when ENABLE_AUTO_SEED=true and NODE_ENV!=='production' -
// dev/CI convenience only, never a silent production side effect.
async function ensureInitialData() {
  try {
    // 1. Seed accounts
    for (const account of seedAccounts()) {
      const existing = await User.findOne({ username: account.username });
      if (!existing) {
        const passwordHash = await hashPassword(account.password);
        await User.create({
          publicId: generatePublicId(),
          username: account.username,
          passwordHash,
          role: account.role,
          displayName: account.displayName,
          isActive: true,
        });
      }
    }

    // 2. Seed Partner
    let partner = await Partner.findOne();
    if (!partner) {
      partner = await Partner.create({
        publicId: 'PARTNER01',
        companyName: 'Viettel Post Partner',
        contactEmail: 'partner@vtp.vn',
        contactPhone: '0988888888',
        status: 'active',
      });
    }

    // 3. Seed orders if DB has fewer than 2 orders
    const orderCount = await Order.countDocuments();
    if (orderCount < 2) {
      for (const item of SAMPLE_ORDERS) {
        const existing = await Order.findOne({ vtpCode: item.vtpCode });
        if (!existing) {
          const createdOrder = await Order.create({
            ...item,
            partnerId: partner._id,
          });

          if (item.vtpCode === 'VTP3024822076') {
            const events = [
              {
                orderId: createdOrder._id,
                source: 'webhook_vtp',
                eventType: 'Giao cho Bưu tá đi nhận',
                location: 'HNI, GLM, Bưu cục Gia Lâm',
                note: 'Phân công bưu tá nhận hàng',
                eventTime: new Date('2025-11-10T11:07:00'),
                receivedAt: new Date('2025-11-10T11:07:00'),
                contentHash: crypto.createHash('sha256').update(`auto-event1-${createdOrder._id}`).digest('hex'),
              },
              {
                orderId: createdOrder._id,
                source: 'webhook_vtp',
                eventType: 'Đã điều phối',
                location: 'HNI - Hà Nội',
                note: '',
                eventTime: new Date('2025-11-09T08:30:00'),
                receivedAt: new Date('2025-11-09T08:30:00'),
                contentHash: crypto.createHash('sha256').update(`auto-event2-${createdOrder._id}`).digest('hex'),
              },
              {
                orderId: createdOrder._id,
                source: 'webhook_vtp',
                eventType: 'Tiếp nhận đơn',
                location: 'Online',
                note: '',
                eventTime: new Date('2025-11-08T14:15:00'),
                receivedAt: new Date('2025-11-08T14:15:00'),
                contentHash: crypto.createHash('sha256').update(`auto-event3-${createdOrder._id}`).digest('hex'),
              },
            ];

            for (const ev of events) {
              try {
                await OrderEvent.create(ev);
              } catch (e) {
                // Ignore
              }
            }
          }
        }
      }
      console.log('[AutoSeed] Successfully populated initial database orders.');
    }
  } catch (err) {
    // Fail loud in dev - a half-seeded DB (accounts but no partner/orders, or vice versa) is
    // more confusing to debug later than a startup crash pointing at the exact cause now.
    console.error('[AutoSeed] Seeding failed:', err.message);
    throw err;
  }
}

module.exports = { ensureInitialData };
