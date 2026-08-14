const { User } = require('../../domain/models');
const { hashPassword } = require('./password.service');
const { generatePublicId } = require('../utils/publicId.util');
const AppError = require('../errors/AppError');

// Admin-only: provisions 'admin' or 'scanner' accounts (see createUserSchema - 'partner' goes
// through POST /partners/register instead, which creates the Partner record atomically).
async function createUser({ username, password, displayName, role }) {
  const existing = await User.findOne({ username }).select('_id').lean();
  if (existing) {
    throw new AppError('username already exists', 409);
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({
    publicId: generatePublicId(),
    username,
    passwordHash,
    role,
    partnerId: null,
    displayName,
    isActive: true,
  });

  return user;
}

async function listUsers() {
  return User.find({ role: { $in: ['admin', 'scanner'] } })
    .select('publicId username role displayName isActive createdAt')
    .sort({ createdAt: -1 })
    .lean();
}

module.exports = { createUser, listUsers };
