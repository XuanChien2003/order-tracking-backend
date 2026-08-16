const { Partner } = require('../../domain/models');
const AppError = require('../errors/AppError');

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

module.exports = { listPartners, updatePartner };
