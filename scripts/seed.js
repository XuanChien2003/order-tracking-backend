require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');
const { connectDb } = require('../src/infrastructure/db/mongoose');
const { User, Partner, Order, OrderEvent } = require('../src/domain/models');
const { hashPassword } = require('../src/application/services/password.service');
const { generatePublicId } = require('../src/application/utils/publicId.util');

const SEED_ACCOUNTS = [
  {
    username: process.env.SEED_ADMIN_USERNAME || 'nguyenxuanchienbk23@gmail.com',
    role: 'admin',
    displayName: 'Quản trị hệ thống',
    password: process.env.SEED_ADMIN_PASSWORD || 'Chien2003@',
  },
  {
    username: process.env.SEED_SCANNER_USERNAME || 'nguyenxuanchienbkn@gmail.com',
    role: 'scanner',
    displayName: 'Nhân viên quét kho',
    password: process.env.SEED_SCANNER_PASSWORD || 'Chien2003@',
  },
];

const SAMPLE_ORDERS = [
  {
    internalCode: 'TUANPAD3024822',
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
    actorName: 'Phạm Minh Đức',
    actorPhone: '84967299927',
    currentStatus: 'Đang VC',
    currentStatusDate: new Date('2025-11-10T11:07:00'),
  },
  {
    internalCode: 'TUANPAD3024823',
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
    actorName: 'Phạm Minh Đức',
    actorPhone: '84967299927',
    currentStatus: 'Đã giao',
    currentStatusDate: new Date('2025-11-09T15:30:00'),
  },
  {
    internalCode: 'TUANPAD3024824',
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
    actorName: 'Phạm Minh Đức',
    actorPhone: '84967299927',
    currentStatus: 'Đang phát',
    currentStatusDate: new Date('2025-11-09T08:20:00'),
  },
  {
    internalCode: 'TUANPAD3024825',
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
    actorName: 'Phạm Minh Đức',
    actorPhone: '84967299927',
    currentStatus: 'Chờ XL',
    currentStatusDate: new Date('2025-11-08T16:45:00'),
  },
  {
    internalCode: 'TUANPAD3024826',
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
    actorName: 'Phạm Minh Đức',
    actorPhone: '84967299927',
    currentStatus: 'Đang VC',
    currentStatusDate: new Date('2025-11-08T10:10:00'),
  },
  {
    internalCode: 'TUANPAD3024827',
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
    actorName: 'Phạm Minh Đức',
    actorPhone: '84967299927',
    currentStatus: 'Hoàn',
    currentStatusDate: new Date('2025-11-07T09:30:00'),
  },
  {
    internalCode: 'TUANPAD3024822076',
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
    actorName: 'Phạm Minh Đức',
    actorPhone: '84967299927',
    currentStatus: 'Giao bưu tá đi nhận',
    currentStatusDate: new Date('2025-11-10T11:07:00'),
  },
];

async function seed() {
  await connectDb();

  // 1. Seed accounts
  for (const account of SEED_ACCOUNTS) {
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
      console.log(`[seed] Đã tạo tài khoản ${account.role}: ${account.username}`);
    }
  }

  // 2. Seed default Partner
  let partner = await Partner.findOne();
  if (!partner) {
    partner = await Partner.create({
      publicId: 'PARTNER01',
      companyName: 'Viettel Post Partner',
      email: 'partner@vtp.vn',
      phone: '0988888888',
      secretKeyHash: await hashPassword('PartnerSecret@123'),
      isActive: true,
    });
    console.log('[seed] Đã tạo Partner mặc định: PARTNER01');
  }

  // 3. Seed orders
  for (const item of SAMPLE_ORDERS) {
    const existing = await Order.findOne({ internalCode: item.internalCode });
    if (!existing) {
      const createdOrder = await Order.create({
        ...item,
        partnerId: partner._id,
      });
      console.log(`[seed] Đã tạo đơn hàng: ${item.internalCode}`);

      // If TUANPAD3024822076, add timeline events
      if (item.internalCode === 'TUANPAD3024822076') {
        const events = [
          {
            orderId: createdOrder._id,
            source: 'scan_pda',
            eventType: 'Giao cho Bưu tá đi nhận',
            location: 'HNI, GLM, Bưu cục Gia Lâm',
            note: 'Phân công bưu tá nhận hàng',
            eventTime: new Date('2025-11-10T11:07:00'),
            receivedAt: new Date('2025-11-10T11:07:00'),
            contentHash: crypto.createHash('sha256').update(`event1-${createdOrder._id}`).digest('hex'),
          },
          {
            orderId: createdOrder._id,
            source: 'scan_pda',
            eventType: 'Đã điều phối',
            location: 'HNI - Hà Nội',
            note: '',
            eventTime: new Date('2025-11-09T08:30:00'),
            receivedAt: new Date('2025-11-09T08:30:00'),
            contentHash: crypto.createHash('sha256').update(`event2-${createdOrder._id}`).digest('hex'),
          },
          {
            orderId: createdOrder._id,
            source: 'system',
            eventType: 'Tiếp nhận đơn',
            location: 'Online',
            note: '',
            eventTime: new Date('2025-11-08T14:15:00'),
            receivedAt: new Date('2025-11-08T14:15:00'),
            contentHash: crypto.createHash('sha256').update(`event3-${createdOrder._id}`).digest('hex'),
          },
        ];

        for (const ev of events) {
          try {
            await OrderEvent.create(ev);
          } catch (e) {
            // Ignore hash collisions if re-running
          }
        }
      }
    }
  }

  await mongoose.disconnect();
  console.log('[seed] Hoàn tất seeding dữ liệu.');
}

if (require.main === module) {
  seed().catch((err) => {
    console.error('[seed] Lỗi:', err);
    process.exit(1);
  });
}

module.exports = { seed };
