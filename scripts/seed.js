require('dotenv').config();
const mongoose = require('mongoose');
const { connectDb } = require('../src/infrastructure/db/mongoose');
const { User } = require('../src/domain/models');
const { hashPassword } = require('../src/application/services/password.service');
const { generatePublicId } = require('../src/application/utils/publicId.util');

// PROJECT_CONTEXT.md section 7: SRS has no public API to create admin/scanner accounts
// (FR-01 only creates 'partner' accounts) - these are seeded manually instead.
const SEED_ACCOUNTS = [
  {
    username: process.env.SEED_ADMIN_USERNAME || 'admin',
    role: 'admin',
    displayName: 'Quản trị hệ thống',
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin@12345',
  },
  {
    username: process.env.SEED_SCANNER_USERNAME || 'scanner1',
    role: 'scanner',
    displayName: 'Nhân viên quét kho',
    password: process.env.SEED_SCANNER_PASSWORD || 'Scanner@12345',
  },
];

async function seed() {
  await connectDb();

  for (const account of SEED_ACCOUNTS) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await User.findOne({ username: account.username });
    if (existing) {
      console.log(`[seed] Bỏ qua, đã tồn tại: ${account.username} (${account.role})`);
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const passwordHash = await hashPassword(account.password);
    // eslint-disable-next-line no-await-in-loop
    await User.create({
      publicId: generatePublicId(),
      username: account.username,
      passwordHash,
      role: account.role,
      displayName: account.displayName,
      isActive: true,
    });
    console.log(`[seed] Đã tạo tài khoản ${account.role}: ${account.username} / mật khẩu: ${account.password}`);
  }

  await mongoose.disconnect();
  console.log('[seed] Hoàn tất. Đổi mật khẩu mặc định trước khi dùng ở production.');
}

seed().catch((err) => {
  console.error('[seed] Lỗi:', err);
  process.exit(1);
});
