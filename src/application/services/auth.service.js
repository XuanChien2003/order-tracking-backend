const mongoose = require('mongoose');
const { Partner, User } = require('../../domain/models');
const { hashPassword, comparePassword } = require('./password.service');
const { signAccessToken } = require('./token.service');
const { generatePublicId } = require('../utils/publicId.util');
const AppError = require('../errors/AppError');

// FR-01: register a partner -> creates partners(status=active) + users(role=partner), no approval needed.
// Both creates run in one transaction - without it, a crash between them would leave an orphaned
// Partner with no login (or vice versa), and duplicate-check races could sneak past too.
async function registerPartner({ companyName, contactEmail, contactPhone, password }) {
  const existingPartner = await Partner.findOne({ contactEmail });
  if (existingPartner) {
    throw new AppError('contactEmail already registered', 409);
  }
  // username convention: contactEmail (see PROJECT_CONTEXT.md section 7)
  const existingUser = await User.findOne({ username: contactEmail });
  if (existingUser) {
    throw new AppError('username already exists', 409);
  }

  const passwordHash = await hashPassword(password);

  const session = await mongoose.startSession();
  try {
    let partner;
    let user;
    await session.withTransaction(async () => {
      [partner] = await Partner.create(
        [{ publicId: generatePublicId(), companyName, contactEmail, contactPhone, status: 'active' }],
        { session }
      );
      [user] = await User.create(
        [
          {
            publicId: generatePublicId(),
            username: contactEmail,
            passwordHash,
            role: 'partner',
            partnerId: partner._id,
            displayName: companyName,
            isActive: true,
          },
        ],
        { session }
      );
    });
    return { partner, user };
  } catch (err) {
    if (err.code === 11000) {
      throw new AppError('contactEmail hoặc username đã tồn tại', 409);
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

// FR-02: login for all 3 roles, returns a JWT that only carries publicId/role/partnerId.
async function login({ username, password }) {
  const user = await User.findOne({ username });
  if (!user || !user.isActive) {
    throw new AppError('Invalid username or password', 401);
  }

  const isMatch = await comparePassword(password, user.passwordHash);
  if (!isMatch) {
    throw new AppError('Invalid username or password', 401);
  }

  let partnerPublicId = null;
  if (user.role === 'partner') {
    const partner = await Partner.findById(user.partnerId);
    if (!partner || partner.status !== 'active') {
      throw new AppError('Partner account is disabled', 403);
    }
    partnerPublicId = partner.publicId;
  }

  const token = signAccessToken({
    publicId: user.publicId,
    role: user.role,
    partnerId: partnerPublicId,
  });

  return {
    token,
    user: {
      publicId: user.publicId,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
      partnerId: partnerPublicId,
    },
  };
}

// Self-service change: any authenticated role (admin/partner/scanner) can change their own
// password, gated only by knowing the current one - no admin/reset-credentials involvement.
async function changePassword({ userPublicId, currentPassword, newPassword }) {
  const user = await User.findOne({ publicId: userPublicId });
  if (!user) throw new AppError('Không tìm thấy tài khoản', 404);

  const isMatch = await comparePassword(currentPassword, user.passwordHash);
  if (!isMatch) throw new AppError('Mật khẩu hiện tại không đúng', 401);

  user.passwordHash = await hashPassword(newPassword);
  await user.save();
}

module.exports = { registerPartner, login, changePassword };
