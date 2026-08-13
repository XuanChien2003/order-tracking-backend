const authService = require('../../application/services/auth.service');
const { Partner } = require('../../domain/models');

async function register(req, res) {
  const { partner, user } = await authService.registerPartner(req.body);
  res.status(201).json({
    partner: {
      publicId: partner.publicId,
      companyName: partner.companyName,
      contactEmail: partner.contactEmail,
      contactPhone: partner.contactPhone,
      status: partner.status,
    },
    user: {
      publicId: user.publicId,
      username: user.username,
      role: user.role,
    },
  });
}

async function list(req, res) {
  const partners = await Partner.find({ status: 'active' }).select('publicId companyName contactEmail contactPhone').lean();
  res.json({ items: partners });
}

module.exports = { register, list };

