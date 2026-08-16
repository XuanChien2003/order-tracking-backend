const authService = require('../../application/services/auth.service');
const partnerService = require('../../application/services/partner.service');

function toPartnerPublic(partner) {
  return {
    publicId: partner.publicId,
    companyName: partner.companyName,
    contactEmail: partner.contactEmail,
    contactPhone: partner.contactPhone,
    status: partner.status,
    createdAt: partner.createdAt,
  };
}

async function register(req, res) {
  const { partner, user } = await authService.registerPartner(req.body);
  res.status(201).json({
    partner: toPartnerPublic(partner),
    user: {
      publicId: user.publicId,
      username: user.username,
      role: user.role,
    },
  });
}

// Admin-initiated creation - same underlying logic as self-service register, just gated by
// authenticate+authorize('admin') at the route instead of being public.
async function adminCreate(req, res) {
  const { partner, user } = await authService.registerPartner(req.body);
  res.status(201).json({
    partner: toPartnerPublic(partner),
    user: {
      publicId: user.publicId,
      username: user.username,
      role: user.role,
    },
  });
}

async function list(req, res) {
  const includeAll = req.user?.role === 'admin' && req.query.status === 'all';
  const partners = await partnerService.listPartners({ includeAll });
  res.json({ items: partners.map(toPartnerPublic) });
}

async function update(req, res) {
  const partner = await partnerService.updatePartner({ publicId: req.params.publicId, updates: req.body });
  res.json(toPartnerPublic(partner));
}

module.exports = { register, adminCreate, list, update };
