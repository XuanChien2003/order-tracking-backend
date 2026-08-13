const { Partner, User } = require('../../domain/models');
const { hashPassword, comparePassword } = require('./password.service');
const { signAccessToken } = require('./token.service');
const { generatePublicId } = require('../utils/publicId.util');
const AppError = require('../errors/AppError');

// FR-01: register a partner -> creates partners(status=active) + users(role=partner), no approval needed.
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

  const partner = await Partner.create({
    publicId: generatePublicId(),
    companyName,
    contactEmail,
    contactPhone,
    status: 'active',
  });

  const passwordHash = await hashPassword(password);
  const user = await User.create({
    publicId: generatePublicId(),
    username: contactEmail,
    passwordHash,
    role: 'partner',
    partnerId: partner._id,
    displayName: companyName,
    isActive: true,
  });

  return { partner, user };
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

module.exports = { registerPartner, login };
