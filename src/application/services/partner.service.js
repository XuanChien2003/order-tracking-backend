const { Partner, User } = require('../../domain/models');
const AppError = require('../errors/AppError');
const { hashPassword, generateTempPassword } = require('./password.service');
const emailService = require('./email.service');

// Default (includeAll=false) stays active-only - this is what the order-import partner
// dropdown uses, and it shouldn't offer disabled partners as an import target.
async function listPartners({ includeAll } = {}) {
  const filter = includeAll ? {} : { status: 'active' };
  return Partner.find(filter)
    .select('publicId companyName contactEmail contactPhone status createdAt')
    .sort({ createdAt: -1 })
    .lean();
}

async function updatePartner({ publicId, updates }) {
  const partner = await Partner.findOne({ publicId });
  if (!partner) throw new AppError('Không tìm thấy đối tác', 404);

  if (updates.contactEmail && updates.contactEmail !== partner.contactEmail) {
    const existing = await Partner.findOne({ contactEmail: updates.contactEmail });
    if (existing) throw new AppError('contactEmail đã được dùng bởi đối tác khác', 409);
  }

  Object.assign(partner, updates);
  await partner.save();
  return partner;
}

// Recovery path for the case admin creation already succeeded but the credentials email never
// arrived (SMTP misconfigured, deliverability issue, etc.) - the original password is never
// stored anywhere, only its hash, so it can't be re-sent - a new one has to be issued instead.
async function resetCredentials({ publicId }) {
  const partner = await Partner.findOne({ publicId });
  if (!partner) throw new AppError('Không tìm thấy đối tác', 404);

  const user = await User.findOne({ partnerId: partner._id, role: 'partner' });
  if (!user) throw new AppError('Không tìm thấy tài khoản đăng nhập của đối tác này', 404);

  const tempPassword = generateTempPassword();
  user.passwordHash = await hashPassword(tempPassword);
  await user.save();

  let emailSent = false;
  let emailError = null;
  try {
    await emailService.sendPartnerCredentialsEmail({
      to: partner.contactEmail,
      companyName: partner.companyName,
      username: user.username,
      password: tempPassword,
    });
    emailSent = true;
  } catch (err) {
    emailError = err.message;
  }

  return { emailSent, emailError };
}

module.exports = { listPartners, updatePartner, resetCredentials };
